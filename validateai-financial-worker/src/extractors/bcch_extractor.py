"""
src/extractors/bcch_extractor.py — Extractor BCCH: Comunicados TPM, Minutas e IPoM.

Pipeline por documento:
  1. Scrapea la página de listado BCCH → URLs de PDFs recientes
  2. Descarga el PDF (vía proxy ScraperAPI si está configurado)
  3. Extrae texto con pdfplumber (fallback: pypdf)
  4. Chunking por sección (Comunicado: 1 chunk; Minuta: 3-5; IPoM: resumen + perspectivas)
  5. Scoring hawkish/dovish (keyword + Haiku para zona gris)
  6. Produce nodos knowledge_nodes PERMANENTES + actualiza nodo ancla del entity_router

Dependencias adicionales: pip install pdfplumber beautifulsoup4
pdfplumber ya debería estar si se usa pdfminer.six; bs4 es liviana.

Variables de entorno:
  BCCH_COMUNICADOS_URL  — URL de la página de listado de Comunicados TPM
  BCCH_MINUTAS_URL      — URL de la página de listado de Minutas
  BCCH_IPOM_URL         — URL de la página del IPoM (opcional, alto costo de proceso)
  BCCH_MAX_DOCS         — cuántos docs recientes procesar por tipo (default: 2)
"""
from __future__ import annotations
import hashlib
import logging
import os
import re
from datetime import datetime, timezone
from typing import TYPE_CHECKING

log = logging.getLogger(__name__)

CATEGORY = "Banco Central Chile"
ANCHOR_TITLE = "BCCH Política Monetaria Chile — Estado Actual"

_COMUNICADOS_URL = os.getenv(
    "BCCH_COMUNICADOS_URL",
    "https://www.bcentral.cl/prensa/comunicados-de-politica-monetaria",
)
_MINUTAS_URL = os.getenv(
    "BCCH_MINUTAS_URL",
    "https://www.bcentral.cl/prensa/minutas",
)
_IPOM_URL = os.getenv(
    "BCCH_IPOM_URL",
    "https://www.bcentral.cl/investigacion-y-publicaciones/publicaciones-y-documentos/informes/ipom",
)
_MAX_DOCS = int(os.getenv("BCCH_MAX_DOCS", "2"))

# Páginas máximas a procesar por tipo de documento (controla costo de embeddings)
_PAGE_LIMITS: dict[str, int] = {
    "comunicado_tpm": 8,    # Comunicados son cortos
    "minuta":         30,   # Minutas ~15-25 páginas
    "ipom":           20,   # Solo resumen ejecutivo del IPoM
}


# ── Descarga y extracción ─────────────────────────────────────────────────────

def _fetch_content(url: str) -> bytes:
    """Descarga URL como bytes. Usa proxy si SCRAPERAPI_KEY está configurado."""
    from api.radar.proxy import fetch_feed_content
    try:
        text = fetch_feed_content(url)
        return text.encode("utf-8") if isinstance(text, str) else text
    except Exception:
        import requests
        resp = requests.get(url, timeout=30, headers={
            "User-Agent": "Mozilla/5.0 (compatible; BralidusBot/1.0)",
        })
        resp.raise_for_status()
        return resp.content


def _fetch_pdf_bytes(pdf_url: str) -> bytes:
    import requests
    scraperapi_key = os.getenv("SCRAPERAPI_KEY", "")
    if scraperapi_key:
        resp = requests.get(
            "https://api.scraperapi.com",
            params={"api_key": scraperapi_key, "url": pdf_url},
            timeout=60,
        )
    else:
        resp = requests.get(pdf_url, timeout=60, headers={
            "User-Agent": "Mozilla/5.0 (compatible; BralidusBot/1.0)",
        })
    resp.raise_for_status()
    return resp.content


def _extract_text(pdf_bytes: bytes, max_pages: int) -> str:
    """
    Extrae texto del PDF. pdfplumber primero (mejor calidad para español),
    pypdf como fallback.
    """
    import io
    text_parts: list[str] = []

    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            for i, page in enumerate(pdf.pages):
                if i >= max_pages:
                    break
                t = page.extract_text() or ""
                if t.strip():
                    text_parts.append(t)
        return "\n\n".join(text_parts)
    except Exception as exc:
        log.debug("[bcch] pdfplumber falló (%s). Intentando pypdf.", exc)

    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(pdf_bytes))
        for i, page in enumerate(reader.pages):
            if i >= max_pages:
                break
            t = page.extract_text() or ""
            if t.strip():
                text_parts.append(t)
        return "\n\n".join(text_parts)
    except Exception as exc:
        log.error("[bcch] Extracción PDF falló: %s", exc)
        return ""


# ── Scraping de listados ──────────────────────────────────────────────────────

def _scrape_pdf_links(listing_url: str, limit: int) -> list[tuple[str, str]]:
    """
    Extrae hasta `limit` URLs de PDFs desde la página de listado del BCCH.
    Retorna lista de (pdf_url, titulo_inferido).
    """
    from bs4 import BeautifulSoup

    try:
        content = _fetch_content(listing_url)
        html = content.decode("utf-8", errors="replace")
    except Exception as exc:
        log.error("[bcch] No se pudo acceder a listado %s: %s", listing_url, exc)
        return []

    soup = BeautifulSoup(html, "html.parser")
    results: list[tuple[str, str]] = []

    for tag in soup.find_all("a", href=True):
        href: str = tag["href"]
        if not href.lower().endswith(".pdf"):
            continue
        if not href.startswith("http"):
            href = "https://www.bcentral.cl" + href
        titulo = tag.get_text(strip=True) or href.split("/")[-1]
        results.append((href, titulo))
        if len(results) >= limit:
            break

    log.info("[bcch] %d PDFs encontrados en %s", len(results), listing_url)
    return results


# ── Chunking por sección ──────────────────────────────────────────────────────

_SECTION_HEADERS = re.compile(
    r"\n((?:I{1,3}V?|VI{0,3}|IX|X)\.?\s+[A-ZÁÉÍÓÚÑ][^\n]{5,60}|"
    r"(?:Antecedentes|Perspectivas|Acuerdos|Sesión|Resumen|Decisión|"
    r"Balance de riesgos|Escenario central)[^\n]*)",
    re.IGNORECASE,
)


def _chunk_by_section(text: str, tipo: str) -> list[tuple[str, str]]:
    """
    Divide el texto en secciones semánticas.
    Retorna lista de (header_path, contenido).
    """
    if tipo == "comunicado_tpm":
        return [("Comunicado Completo", text.strip())]

    parts = _SECTION_HEADERS.split(text)
    chunks: list[tuple[str, str]] = []

    if len(parts) <= 1:
        # Sin secciones detectadas → chunks de ~2000 chars
        size = 2000
        for i in range(0, len(text), size):
            chunk = text[i:i + size].strip()
            if len(chunk) > 100:
                chunks.append((f"Sección {i // size + 1}", chunk))
        return chunks

    # Reconstruir pares (header, contenido)
    current_header = "Introducción"
    current_body: list[str] = []

    if parts[0].strip():
        current_body.append(parts[0].strip())

    for i in range(1, len(parts), 2):
        if i < len(parts):
            header = parts[i].strip()
            body = parts[i + 1].strip() if i + 1 < len(parts) else ""
            if current_body:
                content = " ".join(current_body)
                if len(content) > 100:
                    chunks.append((current_header, content))
            current_header = header
            current_body = [body] if body else []

    if current_body:
        content = " ".join(current_body)
        if len(content) > 100:
            chunks.append((current_header, content))

    return chunks or [("Documento Completo", text.strip())]


def _extract_perspectivas_section(text: str) -> str:
    """Extrae el fragmento de perspectivas/decisión para el scorer Haiku."""
    match = re.search(
        r"(perspectivas|decisión de política|acuerdos).{0,50}\n(.*?)(?=\n[IVX]+\.|$)",
        text, re.IGNORECASE | re.DOTALL,
    )
    if match:
        return match.group(0)[:2000]
    return text[-2000:]  # últimas 2000 chars como fallback


# ── Construcción de nodos ─────────────────────────────────────────────────────

def _build_nodes(
    pdf_url: str,
    titulo_raw: str,
    text: str,
    tipo: str,
) -> list[dict]:
    """
    A partir del texto extraído, produce una lista de nodos KG.
    Incluye el nodo ancla 'Estado Actual' que se upsertea con cada ejecución.
    """
    from src.extractors.bcch_sentiment import score_document

    if not text.strip():
        log.warning("[bcch] Texto vacío para %s — omitiendo.", titulo_raw)
        return []

    # Inferir fecha del título o URL
    fecha = _parse_fecha(titulo_raw + " " + pdf_url)

    # Scoring de sentimiento
    seccion_clave = _extract_perspectivas_section(text)
    sentiment = score_document(text, seccion_clave)

    tipo_label = {
        "comunicado_tpm": "Comunicado TPM",
        "minuta":         "Minuta",
        "ipom":           "IPoM",
    }.get(tipo, tipo.title())

    base_title = f"BCCH {tipo_label} — {fecha or titulo_raw[:40]}"
    tags = [
        "BCCH", "banco_central_chile", tipo,
        sentiment.tono, sentiment.tpm_decision,
    ]
    base_meta = {
        "fuente": "BCCH",
        "tipo_documento": tipo,
        "url_fuente": pdf_url,
        "fecha": fecha,
        "tono_sentimiento": sentiment.tono,
        "score_sentimiento": sentiment.score,
        "tpm_decision": sentiment.tpm_decision,
        "top_signals": sentiment.top_signals,
        "classified_by": sentiment.classified_by,
        "permanent": True,
    }

    # Chunking por sección
    chunks = _chunk_by_section(text, tipo)
    nodes: list[dict] = []

    for header, content in chunks:
        doc_hash = hashlib.md5(content[:200].encode()).hexdigest()[:8]
        nodes.append({
            "document_title": f"{base_title} — {header[:50]}",
            "header_path": header,
            "content": (
                f"Documento: {base_title}. Sección: {header}. "
                f"Tono político-monetario: {sentiment.tono} "
                f"(score={sentiment.score:+.2f}). "
                f"Decisión TPM: {sentiment.tpm_decision}.\n\n"
                f"{content[:4000]}"
            ),
            "category": CATEGORY,
            "tags": tags,
            "metadata": {**base_meta, "seccion": header, "hash": doc_hash},
            "embedding": None,
        })

    # Nodo ancla estable (se upsertea con cada ejecución, refleja estado más reciente)
    anchor = _build_anchor_node(tipo_label, fecha, sentiment, pdf_url)
    nodes.append(anchor)

    return nodes


def _build_anchor_node(
    tipo_label: str, fecha: str, sentiment, pdf_url: str
) -> dict:
    """
    Nodo estable con document_title fijo — es el ancla del entity_router.
    Se sobreescribe en cada ejecución con el dato más reciente del tipo.
    """
    from src.extractors.bcch_sentiment import SentimentResult

    decision_str = sentiment.tpm_decision.upper()
    tono_str = sentiment.tono.upper()
    score_str = f"{sentiment.score:+.2f}"

    content = (
        f"Estado actual de la política monetaria del Banco Central de Chile (BCCh). "
        f"Último documento procesado: {tipo_label} ({fecha}). "
        f"Tono del comunicado: {tono_str} (score={score_str}). "
        f"Decisión sobre la Tasa de Política Monetaria (TPM): {decision_str}. "
        f"Señales detectadas: {'; '.join(sentiment.top_signals[:3])}. "
        f"Un tono hawkish implica tasas altas sostenidas, mayor costo de capital, "
        f"presión sobre valuaciones y acceso al crédito para startups. "
        f"Un tono dovish indica espacio para recortes, menor costo de deuda y "
        f"mejores condiciones de inversión. "
        f"Fuente: {pdf_url}."
    )

    return {
        "document_title": ANCHOR_TITLE,
        "header_path": "Estado Actual",
        "content": content,
        "category": CATEGORY,
        "tags": ["BCCH", "banco_central_chile", "tpm", "politica_monetaria",
                 sentiment.tono, sentiment.tpm_decision],
        "metadata": {
            "fuente": "BCCH",
            "tipo_anchor": True,
            "permanent": True,
            "ultimo_tipo_doc": tipo_label,
            "ultima_fecha": fecha,
            "tono_sentimiento": sentiment.tono,
            "score_sentimiento": sentiment.score,
            "tpm_decision": sentiment.tpm_decision,
            "url_fuente": pdf_url,
        },
        "embedding": None,
    }


def _parse_fecha(text: str) -> str:
    """Extrae fecha YYYY-MM-DD del texto si la encuentra."""
    m = re.search(r"(\d{4})[-/](\d{2})[-/](\d{2})", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    # Formato "15 enero 2026"
    meses = {"enero":"01","febrero":"02","marzo":"03","abril":"04",
             "mayo":"05","junio":"06","julio":"07","agosto":"08",
             "septiembre":"09","octubre":"10","noviembre":"11","diciembre":"12"}
    m2 = re.search(
        r"(\d{1,2})\s+(" + "|".join(meses) + r")\s+(\d{4})",
        text.lower()
    )
    if m2:
        return f"{m2.group(3)}-{meses[m2.group(2)]}-{m2.group(1).zfill(2)}"
    return datetime.now(timezone.utc).strftime("%Y-%m")


# ── Señal Radar desde BCCH ───────────────────────────────────────────────────

def _sentiment_to_signal(sentiment, fecha: str, tipo_label: str, pdf_url: str):
    """
    Genera un RadarSignal si la decisión o el tono es materialmente relevante.
    Alza TPM o hawkish fuerte → MACRO_ALERT para fintech, credito, proptech.
    """
    from api.radar.models import RadarSignal
    from datetime import timedelta

    if sentiment.tpm_decision == "alza":
        severity, signal_type = 0.78, "MACRO_ALERT"
    elif sentiment.tono == "hawkish" and sentiment.score > 0.35:
        severity, signal_type = 0.65, "MACRO_ALERT"
    elif sentiment.tpm_decision == "baja":
        severity, signal_type = 0.50, "MACRO_ALERT"
    elif sentiment.tono == "dovish" and sentiment.score < -0.35:
        severity, signal_type = 0.42, "MACRO_ALERT"
    else:
        return None

    preview = (
        f"BCCH {tipo_label} ({fecha}): tono {sentiment.tono.upper()}, "
        f"TPM {sentiment.tpm_decision.upper()} (score={sentiment.score:+.2f}). "
        f"{sentiment.top_signals[0] if sentiment.top_signals else ''}"
    )

    return RadarSignal(
        sector="macro",
        affected_industries=["fintech", "credito", "proptech", "inmobiliaria", "saas"],
        signal_type=signal_type,  # type: ignore[arg-type]
        severity=severity,
        headline_preview=preview[:300],
        source="bcch_pdf",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=168),  # 1 semana
        classified_by="bcch_structured",
    )


# ── Punto de entrada público ──────────────────────────────────────────────────

def fetch_all_as_nodes() -> list[dict]:
    """
    Descarga y procesa los documentos BCCH más recientes.
    Retorna nodos KG listos para upsert.
    """
    all_nodes: list[dict] = []

    for tipo, listing_url in [
        ("comunicado_tpm", _COMUNICADOS_URL),
        ("minuta",         _MINUTAS_URL),
    ]:
        links = _scrape_pdf_links(listing_url, limit=_MAX_DOCS)
        for pdf_url, titulo in links:
            try:
                log.info("[bcch] Procesando %s: %s", tipo, pdf_url)
                pdf_bytes = _fetch_pdf_bytes(pdf_url)
                text = _extract_text(pdf_bytes, _PAGE_LIMITS[tipo])
                if not text.strip():
                    log.warning("[bcch] Sin texto en %s", pdf_url)
                    continue
                nodes = _build_nodes(pdf_url, titulo, text, tipo)
                all_nodes.extend(nodes)
                log.info("[bcch] %d nodos generados desde %s", len(nodes), pdf_url)
            except Exception as exc:
                log.error("[bcch] Error procesando %s: %s", pdf_url, exc)

    return all_nodes


def fetch_all_as_signals() -> list:
    """
    Genera RadarSignals desde los documentos BCCH más recientes.
    Usado por el scheduler para inyectar en el Radar Forense.
    """
    from src.extractors.bcch_sentiment import score_document

    signals = []
    for tipo, listing_url in [("comunicado_tpm", _COMUNICADOS_URL)]:
        links = _scrape_pdf_links(listing_url, limit=1)  # solo el más reciente
        for pdf_url, titulo in links:
            try:
                pdf_bytes = _fetch_pdf_bytes(pdf_url)
                text = _extract_text(pdf_bytes, _PAGE_LIMITS[tipo])
                if not text:
                    continue
                sentiment = score_document(text, _extract_perspectivas_section(text))
                fecha = _parse_fecha(titulo + " " + pdf_url)
                signal = _sentiment_to_signal(sentiment, fecha, "Comunicado TPM", pdf_url)
                if signal:
                    signals.append(signal)
            except Exception as exc:
                log.error("[bcch] Error en señal para %s: %s", pdf_url, exc)
    return signals
