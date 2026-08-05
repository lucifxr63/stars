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

# Dominio nuevo del Boletín Concursal. La SUPERIR lo movió fuera de su sitio:
# `superir.gob.cl/informacion-publica/boletin-concursal/` hoy responde 404.
_BOLETIN_BASE = os.getenv("BOLETIN_CONCURSAL_URL", "https://www.boletinconcursal.cl")
_BOLETIN_PAGINA = "/boletin/procedimientos"
_BOLETIN_DATOS = "/boletin/getRIP/"

# ── SÓLO EMPRESAS — decisión deliberada, no un descuido ──────────────────────
#
# El Boletín publica procedimientos de "Empresa Deudora" y de "Persona Deudora".
# Medido sobre 100 registros: 70 son PERSONAS NATURALES, con nombre y apellido,
# en quiebra personal.
#
# El Boletín es público por ley, pero su finalidad es la PUBLICIDAD LEGAL —que
# acreedores y tribunales se enteren—. Meter eso en un grafo que alimenta un
# producto comercial de inteligencia es una finalidad distinta, y la Ley 21.719
# distingue justamente eso. Más allá del cumplimiento: la quiebra personal de
# alguien apareciendo en un producto que se le vende a terceros es lo que termina
# en un reclamo, aunque el dato sea público.
#
# Se filtra en la extracción y no aguas abajo a propósito: así el dato personal
# no llega a entrar a la base ni siquiera de paso.
_SOLO_EMPRESAS = "empresa deudora"


def _fetch_concursal_empresas(objetivo: int = 25) -> list[dict]:
    """
    Procedimientos concursales de EMPRESAS desde el Boletín Concursal.

    POR QUÉ ESTO YA NO ES SCRAPING DE PDF
    -------------------------------------
    Hasta el 2026-08-05 esto buscaba enlaces a PDF en la página de la SUPERIR,
    extraía el texto y le pasaba una regex. Esa página devuelve 404 desde hace
    meses —el Boletín se mudó a dominio propio— y el job reportaba 0 nodos sin
    error. Nunca produjo un solo nodo.

    El sitio nuevo expone la tabla por un endpoint DataTables que devuelve JSON
    estructurado: nada de regex sobre texto de PDF.

    Requiere sesión y token CSRF, que es el manejo normal de cualquier navegador
    contra una app Spring —la página es pública, sin login ni captcha—, así que
    se replica el mismo flujo: pedir la página, tomar el token, usarlo.
    """
    import requests

    ses = requests.Session()
    ses.headers.update({"User-Agent": "Mozilla/5.0 (compatible; BralidusBot/1.0)"})

    try:
        pagina = ses.get(_BOLETIN_BASE + _BOLETIN_PAGINA, timeout=30)
        pagina.raise_for_status()
        m = re.search(r'name="_csrf"\s+content="([^"]+)"', pagina.text)
        if not m:
            log.error("[concursal] No se encontró el token CSRF en %s", _BOLETIN_PAGINA)
            return []
        csrf = m.group(1)
    except Exception as exc:
        log.error("[concursal] No se pudo abrir el Boletín Concursal: %s", exc)
        return []

    empresas: list[dict] = []
    por_pagina = 100
    inicio = 0

    # Se piden varias páginas porque sólo ~30% son empresas: pedir `objetivo`
    # filas devolvería mayormente personas que luego se descartan.
    while len(empresas) < objetivo and inicio < 600:
        try:
            resp = ses.post(
                _BOLETIN_BASE + _BOLETIN_DATOS,
                headers={
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN": csrf,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data={"draw": 1, "start": inicio, "length": por_pagina},
                timeout=40,
            )
            resp.raise_for_status()
            payload = resp.json()
        except Exception as exc:
            log.error("[concursal] Error consultando procedimientos (start=%d): %s", inicio, exc)
            break

        filas = payload.get("data") or []
        if not filas:
            break

        for f in filas:
            tipo = (f.get("tipoProcedimiento") or "")
            if _SOLO_EMPRESAS not in tipo.lower():
                continue  # persona natural: no entra
            empresas.append({
                "razon_social": (f.get("deudorNombre") or "").strip()[:120],
                # El endpoint no expone RUT. Se deja vacío en vez de inventarlo:
                # el consumidor distingue "no hay" de "es este".
                "rut": "",
                "tipo_procedimiento": tipo.strip(),
                "fecha": f.get("fchPublicacion") or "",
                "procedimiento": str(f.get("procedimiento") or ""),
                "publicacion": (f.get("nombrePublicacion") or "").strip(),
            })
            if len(empresas) >= objetivo:
                break

        if len(filas) < por_pagina:
            break
        inicio += por_pagina

    log.info(
        "[concursal] %d procedimientos de EMPRESA extraídos (personas naturales excluidas por diseño)",
        len(empresas),
    )
    return empresas


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

    # 1. Boletín Concursal — SÓLO empresas (ver nota en _fetch_concursal_empresas)
    try:
        empresas = _fetch_concursal_empresas()
        if empresas:
            concursal_nodes, _ = _concursal_to_nodes_and_signals(
                empresas, _BOLETIN_BASE + _BOLETIN_PAGINA, empresas[0].get("fecha", ""),
            )
            nodes.extend(concursal_nodes)
    except Exception as exc:
        log.error("[concursal] Error extrayendo procedimientos: %s", exc)

    # 2. Diario Oficial — Sociedades
    do_entries = _fetch_do_sociedades()
    nodes.extend(_do_entry_to_node(e) for e in do_entries)

    log.info("[do/concursal] Total nodos: %d", len(nodes))
    return nodes


def fetch_all_as_signals() -> list:
    """Señales de radar por insolvencias de EMPRESAS. Ver _fetch_concursal_empresas."""
    signals: list = []
    try:
        empresas = _fetch_concursal_empresas()
        if empresas:
            _, sigs = _concursal_to_nodes_and_signals(
                empresas, _BOLETIN_BASE + _BOLETIN_PAGINA, empresas[0].get("fecha", ""),
            )
            signals.extend(sigs)
    except Exception as exc:
        log.error("[concursal] Error generando señales: %s", exc)
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
