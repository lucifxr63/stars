"""
src/extractors/diario_oficial_extractor.py — Diario Oficial + SUPERIR Boletín Concursal.

Dos sub-fuentes con naturaleza distinta:

1. SUPERIR Boletín Concursal (Superintendencia de Insolvencia y Reemprendimiento)
   URL: https://www.superir.gob.cl/informacion-publica/boletin-concursal/
   Valor: detección TEMPRANA de empresas en procedimientos concursales ANTES de que
   aparezca en prensa. Genera RadarSignals de alta severidad.
   Formato: PDFs diarios (lunes–viernes).

2. Diario Oficial — Sección Normas Particulares (sociedades)
   URL: https://www.diariooficial.interior.gob.cl/publicaciones/
   Valor: constituciones y disoluciones de sociedades → señal de mercado activo.
   Las disoluciones en volumen pueden indicar contracción sectorial.
   Formato: HTML + PDFs.

Ambas producen nodos PERMANENTES en knowledge_nodes.
SUPERIR además genera RadarSignals cuando hay procedimientos de liquidación.
"""
from __future__ import annotations
import logging
import os
import re
from datetime import datetime, timedelta, timezone

log = logging.getLogger(__name__)

CATEGORY_CONCURSAL = "Boletín Concursal"
CATEGORY_DO        = "Diario Oficial"

_SUPERIR_URL = os.getenv(
    "SUPERIR_BOLETIN_URL",
    "https://www.superir.gob.cl/informacion-publica/boletin-concursal/",
)
_DO_URL = os.getenv(
    "DO_URL",
    "https://www.diariooficial.interior.gob.cl/publicaciones/",
)
_MAX_PAGES_PDF = int(os.getenv("CONCURSAL_MAX_PAGES", "15"))


# ── SUPERIR Boletín Concursal ─────────────────────────────────────────────────

def _fetch_superir_pdf_links(limit: int = 3) -> list[tuple[str, str]]:
    """Scrape la página SUPERIR para encontrar PDFs del boletín."""
    from bs4 import BeautifulSoup
    from api.radar.proxy import fetch_feed_content

    try:
        html = fetch_feed_content(_SUPERIR_URL)
    except Exception as exc:
        log.error("[concursal] No se pudo acceder a SUPERIR: %s", exc)
        return []

    soup = BeautifulSoup(html, "html.parser")
    links: list[tuple[str, str]] = []

    for tag in soup.find_all("a", href=True):
        href: str = tag["href"]
        if ".pdf" in href.lower() and ("boletin" in href.lower() or "concursal" in href.lower()):
            if not href.startswith("http"):
                href = "https://www.superir.gob.cl" + href
            titulo = tag.get_text(strip=True) or href.split("/")[-1]
            links.append((href, titulo))
            if len(links) >= limit:
                break

    log.info("[concursal] %d PDFs boletín encontrados.", len(links))
    return links


def _extract_pdf_text(pdf_url: str) -> str:
    import io, requests

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

    pdf_bytes = resp.content
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            parts = []
            for i, page in enumerate(pdf.pages):
                if i >= _MAX_PAGES_PDF:
                    break
                t = page.extract_text() or ""
                if t.strip():
                    parts.append(t)
            return "\n\n".join(parts)
    except Exception:
        try:
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(pdf_bytes))
            return "\n".join(
                p.extract_text() or ""
                for i, p in enumerate(reader.pages)
                if i < _MAX_PAGES_PDF
            )
        except Exception as exc:
            log.error("[concursal] Extracción PDF falló: %s", exc)
            return ""


def _parse_concursal_entries(text: str) -> list[dict]:
    """
    Extrae procedimientos del texto del boletín.
    El boletín tiene entradas con: razón social, RUT, tipo de procedimiento.
    """
    entries: list[dict] = []

    # Patrones típicos del boletín concursal chileno
    patterns = [
        # Liquidación forzosa: RAZÓN SOCIAL (RUT: XX.XXX.XXX-X) ... liquidación
        re.compile(
            r"([A-ZÁÉÍÓÚÑ][^(\n]{5,80})\s*"
            r"(?:RUT[:\s]+)?([\d]{2}\.[\d]{3}\.[\d]{3}[-\d])\s*"
            r".*?(liquidación|quiebra|insolvencia|reorganización)",
            re.IGNORECASE | re.DOTALL,
        ),
    ]

    for pattern in patterns:
        for match in pattern.finditer(text[:20000]):
            razon = match.group(1).strip()[:100]
            rut   = match.group(2).strip() if match.lastindex >= 2 else ""
            tipo  = match.group(3).strip() if match.lastindex >= 3 else "concursal"
            entries.append({
                "razon_social": razon,
                "rut": rut,
                "tipo_procedimiento": tipo,
            })

    # Fallback: busca secciones de liquidación por encabezados
    if not entries:
        seccion = re.search(
            r"(liquidaci[oó]n|quiebra).{0,2000}",
            text[:15000], re.IGNORECASE | re.DOTALL,
        )
        if seccion:
            entries.append({
                "razon_social": "Múltiples empresas",
                "rut": "",
                "tipo_procedimiento": "liquidación (múltiple)",
            })

    return entries[:20]  # cap para no generar ruido excesivo


def _concursal_to_nodes_and_signals(
    entries: list[dict],
    pdf_url: str,
    fecha: str,
) -> tuple[list[dict], list]:
    from api.radar.models import RadarSignal

    nodes: list[dict] = []
    signals: list = []

    for entry in entries:
        razon = entry["razon_social"]
        rut   = entry["rut"]
        tipo  = entry["tipo_procedimiento"]

        severity = 0.92 if "liquidación" in tipo.lower() or "quiebra" in tipo.lower() else 0.70

        content = (
            f"Procedimiento concursal publicado en el Boletín Concursal de Chile (SUPERIR). "
            f"Empresa: {razon}. RUT: {rut}. "
            f"Tipo de procedimiento: {tipo}. Fecha publicación: {fecha}. "
            f"Fuente oficial: {pdf_url}. "
            f"Los procedimientos de liquidación y quiebra son señales de estrés financiero "
            f"sectorial y pueden impactar proveedores, clientes y competidores del segmento."
        )

        node = {
            "document_title": f"Concursal — {razon[:60]} — {tipo[:30]}",
            "header_path": "Boletín Concursal",
            "content": content,
            "category": CATEGORY_CONCURSAL,
            "tags": ["concursal", "SUPERIR", tipo.lower().replace(" ", "_"), "insolvencia"],
            "metadata": {
                "fuente": "SUPERIR",
                "razon_social": razon,
                "rut": rut,
                "tipo_procedimiento": tipo,
                "fecha": fecha,
                "url_fuente": pdf_url,
                "permanent": True,
            },
            "embedding": None,
        }
        nodes.append(node)

        signal = RadarSignal(
            sector="fintech",
            affected_industries=["fintech", "credito", "saas", "marketplace", "retail"],
            signal_type="SECTOR_RISK",
            severity=severity,
            headline_preview=f"Concursal [{tipo.upper()}] {razon}: {fecha}",
            source="superir_boletin",
            expires_at=datetime.now(timezone.utc) + timedelta(hours=120),
            classified_by="concursal_structured",
        )
        signals.append(signal)

    return nodes, signals


# ── Diario Oficial — Sección Sociedades ──────────────────────────────────────

def _fetch_do_sociedades(dias_atras: int = 2) -> list[dict]:
    """
    Scrape el Diario Oficial para constituciones/disoluciones de sociedades.
    Retorna entradas simples con título + descripción + fecha.
    """
    from bs4 import BeautifulSoup
    from api.radar.proxy import fetch_feed_content

    ahora  = datetime.now(timezone.utc)
    fecha_target = (ahora - timedelta(days=dias_atras)).strftime("%d/%m/%Y")

    # El DO permite filtrar por sección y fecha
    url = f"{_DO_URL}?fecha={fecha_target}&tipo=normas_particulares"

    try:
        html = fetch_feed_content(url)
    except Exception as exc:
        log.warning("[do] No se pudo acceder al Diario Oficial: %s", exc)
        return []

    soup = BeautifulSoup(html, "html.parser")
    entries: list[dict] = []

    for tag in soup.find_all(["h3", "h4", "li", "td"], string=re.compile(
        r"(sociedad|s\.a\.|spa|limitada|disolución|constitución|modificación)",
        re.IGNORECASE,
    )):
        texto = tag.get_text(strip=True)
        if len(texto) > 20:
            entries.append({"titulo": texto[:200], "fecha": fecha_target})

    log.info("[do] %d entradas de sociedades en Diario Oficial.", len(entries))
    return entries[:30]


def _do_entry_to_node(entry: dict) -> dict:
    titulo = entry.get("titulo", "")
    fecha  = entry.get("fecha", "")
    es_disolucion = any(kw in titulo.lower() for kw in ["disolución", "disolucion", "liquidación"])

    tipo_label = "Disolución de sociedad" if es_disolucion else "Constitución/Modificación de sociedad"

    content = (
        f"Publicación en el Diario Oficial de Chile — Normas Particulares. "
        f"Tipo: {tipo_label}. Fecha: {fecha}. "
        f"Extracto: {titulo}. "
        f"Las constituciones de sociedades reflejan formación de nuevos emprendimientos; "
        f"las disoluciones, contracción del tejido empresarial en el segmento afectado."
    )

    return {
        "document_title": f"DO — {tipo_label[:40]} — {fecha}",
        "header_path": tipo_label,
        "content": content,
        "category": CATEGORY_DO,
        "tags": ["DiarioOficial", "sociedades",
                 "disolucion" if es_disolucion else "constitucion"],
        "metadata": {
            "fuente": "DiarioOficial",
            "tipo": tipo_label,
            "fecha": fecha,
            "permanent": True,
        },
        "embedding": None,
    }


# ── Punto de entrada público ──────────────────────────────────────────────────

def fetch_all_as_nodes() -> list[dict]:
    nodes: list[dict] = []

    # 1. SUPERIR Boletín Concursal
    for pdf_url, titulo in _fetch_superir_pdf_links(limit=2):
        try:
            text = _extract_pdf_text(pdf_url)
            if not text:
                continue
            fecha = _parse_fecha(titulo + " " + pdf_url)
            entries = _parse_concursal_entries(text)
            concursal_nodes, _ = _concursal_to_nodes_and_signals(entries, pdf_url, fecha)
            nodes.extend(concursal_nodes)
        except Exception as exc:
            log.error("[concursal] Error en PDF %s: %s", pdf_url, exc)

    # 2. Diario Oficial — Sociedades
    do_entries = _fetch_do_sociedades()
    nodes.extend(_do_entry_to_node(e) for e in do_entries)

    log.info("[do/concursal] Total nodos: %d", len(nodes))
    return nodes


def fetch_all_as_signals() -> list:
    signals: list = []
    for pdf_url, titulo in _fetch_superir_pdf_links(limit=1):
        try:
            text = _extract_pdf_text(pdf_url)
            if not text:
                continue
            fecha = _parse_fecha(titulo + " " + pdf_url)
            entries = _parse_concursal_entries(text)
            _, sigs = _concursal_to_nodes_and_signals(entries, pdf_url, fecha)
            signals.extend(sigs)
        except Exception as exc:
            log.error("[concursal] Error señales %s: %s", pdf_url, exc)
    return signals


def _parse_fecha(text: str) -> str:
    text = text.strip()
    m = re.search(r"(\d{4})[-/](\d{2})[-/](\d{2})", text)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
    m2 = re.search(r"(\d{1,2})[-/](\d{1,2})[-/](\d{4})", text)
    if m2:
        return f"{m2.group(3)}-{m2.group(2).zfill(2)}-{m2.group(1).zfill(2)}"
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")
