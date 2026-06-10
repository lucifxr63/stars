"""
src/extractors/seia_extractor.py — SEIA (Servicio de Evaluación Ambiental).

Fuente: https://seia.sea.gob.cl/ — portal público de proyectos EIA/DGA.

Lógica de valor para Bralidus:
  - Proyecto APROBADO → señal de CAPEX futuro garantizado en ese sector/región.
    Es la señal más temprana de inversión real (antes de la noticia, antes de la licitación).
  - Proyecto EN CALIFICACIÓN → inversión potencial en pipeline.
  - Proyecto RECHAZADO/SUSPENDIDO → SECTOR_RISK para minería/energía.

Produce dos outputs:
  1. Nodos PERMANENTES en knowledge_nodes (category='SEIA').
  2. Nodo ancla estable: "SEIA Proyectos Aprobados Chile — Estado Actual".
  3. RadarSignal solo para rechazos/suspensiones de proyectos grandes.

Nota: las aprobaciones NO generan RadarSignal porque el Radar está calibrado
para riesgo negativo. Las aprobaciones enriquecen el contexto del RAG.
"""
from __future__ import annotations
import logging
import os
import re
from datetime import datetime, timedelta, timezone

log = logging.getLogger(__name__)

CATEGORY = "SEIA"
ANCHOR_TITLE = "SEIA Proyectos Aprobados Chile — Estado Actual"

_BASE_URL = os.getenv("SEIA_BASE_URL", "https://seia.sea.gob.cl")
_SEARCH_PATH = "/busqueda/buscarProyectoAction.php"
_MAX_PROJECTS = int(os.getenv("SEIA_MAX_PROJECTS", "30"))
_DAYS_WINDOW = int(os.getenv("SEIA_DAYS_WINDOW", "14"))

# Tipologías más relevantes para el portafolio Bralidus (IDs del SEIA)
# 0 = todas las tipologías
_TIPOLOGIAS_RELEVANTES = ["0"]  # extrae todas y filtra en postproceso

_SECTOR_KEYWORDS: dict[str, list[str]] = {
    "mineria":      ["minero", "minería", "cobre", "litio", "hierro", "molibdeno", "extracción"],
    "energia":      ["energía", "eléctrico", "solar", "eólico", "central", "planta fotovoltaica",
                     "hidroeléctrica", "térmica"],
    "cleantech":    ["solar", "eólico", "fotovoltaica", "hidrógeno verde", "geotérmica"],
    "inmobiliaria": ["inmobiliario", "habitacional", "condominio", "edificio", "loteo"],
    "logistica":    ["puerto", "aeropuerto", "terminal", "bodega", "logística"],
    "agro":         ["agrícola", "forestal", "plantación", "agroindustria"],
    "infraestructura": ["vialidad", "autopista", "embalse", "tranque", "ducto"],
}


def _classify_sector(nombre: str, tipo: str) -> list[str]:
    text = (nombre + " " + tipo).lower()
    sectors: list[str] = []
    for sector, keywords in _SECTOR_KEYWORDS.items():
        if any(kw in text for kw in keywords):
            sectors.append(sector)
    return sectors or ["infraestructura"]


def _parse_monto(text: str) -> float:
    """Extrae monto en millones USD del texto si está disponible."""
    m = re.search(r"[\$US\s]*([\d.,]+)\s*(millones|MM|M)\s*(USD|US\$|\$)?", text, re.IGNORECASE)
    if m:
        try:
            return float(m.group(1).replace(",", "."))
        except ValueError:
            pass
    return 0.0


def _fetch_projects(estado: str, dias_atras: int = _DAYS_WINDOW) -> list[dict]:
    """
    Consulta el buscador SEIA por estado y ventana de días.
    Retorna lista de dicts con los campos del proyecto.
    """
    import requests
    from api.radar.proxy import fetch_feed_content

    ahora = datetime.now(timezone.utc)
    desde = (ahora - timedelta(days=dias_atras)).strftime("%d/%m/%Y")
    hasta = ahora.strftime("%d/%m/%Y")

    form_data = {
        "idRegion": "0",
        "idTipologia": "0",
        "nombreTitular": "",
        "nombreProyecto": "",
        "estadoTransaccion": estado,
        "fechaIngresoDesde": desde,
        "fechaIngresoHasta": hasta,
        "pagina": "1",
    }

    url = _BASE_URL + _SEARCH_PATH

    try:
        scraperapi_key = os.getenv("SCRAPERAPI_KEY", "")
        if scraperapi_key:
            resp = requests.post(
                "https://api.scraperapi.com",
                params={"api_key": scraperapi_key, "url": url},
                data=form_data,
                timeout=40,
            )
        else:
            resp = requests.post(url, data=form_data, timeout=40, headers={
                "User-Agent": "Mozilla/5.0 (compatible; BralidusBot/1.0)",
                "Content-Type": "application/x-www-form-urlencoded",
            })
        resp.raise_for_status()
        return _parse_html(resp.text, estado)
    except Exception as exc:
        log.error("[seia] Error consultando estado=%s: %s", estado, exc)
        return []


def _parse_html(html: str, estado: str) -> list[dict]:
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")
    projects: list[dict] = []

    # La tabla de resultados SEIA tiene class "tabla_proyectos" o similar
    table = (
        soup.find("table", class_=re.compile(r"tabla|result|project", re.I))
        or soup.find("table")
    )
    if not table:
        log.warning("[seia] No se encontró tabla de resultados en la respuesta HTML.")
        return []

    rows = table.find_all("tr")[1:]  # skip header
    for row in rows[:_MAX_PROJECTS]:
        cols = [td.get_text(strip=True) for td in row.find_all("td")]
        link_tag = row.find("a", href=True)
        link = link_tag["href"] if link_tag else ""
        if not link.startswith("http") and link:
            link = _BASE_URL + link

        if len(cols) < 3:
            continue

        # El orden de columnas varía según el año del sitio SEIA.
        # Inferimos por posición: nombre / tipo / titular / región / fecha / estado
        projects.append({
            "nombre": cols[0] if len(cols) > 0 else "",
            "tipo":   cols[1] if len(cols) > 1 else "",
            "titular": cols[2] if len(cols) > 2 else "",
            "region": cols[3] if len(cols) > 3 else "",
            "fecha":  cols[4] if len(cols) > 4 else "",
            "estado": estado,
            "url":    link,
        })

    log.info("[seia] %d proyectos extraídos (estado=%s)", len(projects), estado)
    return projects


def project_to_node(proj: dict) -> dict:
    nombre  = proj.get("nombre", "Sin nombre")
    tipo    = proj.get("tipo", "")
    titular = proj.get("titular", "")
    region  = proj.get("region", "")
    fecha   = proj.get("fecha", "")
    estado  = proj.get("estado", "")
    url     = proj.get("url", "")
    sectors = _classify_sector(nombre, tipo)

    document_title = f"SEIA — {nombre[:70]} — {estado[:25]}"
    estado_label = (
        "proyecto aprobado, inversión confirmada" if "favorable" in estado.lower()
        else "proyecto en evaluación ambiental" if "calificación" in estado.lower()
        else "proyecto rechazado o suspendido"
    )

    content = (
        f"Proyecto sometido al Sistema de Evaluación de Impacto Ambiental (SEIA) de Chile. "
        f"Nombre: {nombre}. Tipo: {tipo}. Empresa titular: {titular}. "
        f"Región: {region}. Fecha: {fecha}. Estado: {estado} ({estado_label}). "
        f"Sectores implicados: {', '.join(sectors)}. "
        f"Un proyecto aprobado por el SEIA representa CAPEX futuro comprometido en la región "
        f"y genera demanda de servicios tecnológicos, logísticos e inmobiliarios asociados. "
        f"Ficha SEIA: {url}."
    )

    return {
        "document_title": document_title,
        "header_path": "Proyecto SEIA",
        "content": content,
        "category": CATEGORY,
        "tags": ["SEIA", "inversion", estado.lower().replace(" ", "_")] + sectors,
        "metadata": {
            "fuente": "SEIA",
            "nombre_proyecto": nombre,
            "tipo_proyecto": tipo,
            "titular": titular,
            "region": region,
            "fecha": fecha,
            "estado": estado,
            "sectores": sectors,
            "url_ficha": url,
            "permanent": True,
        },
        "embedding": None,
    }


def project_to_signal(proj: dict):
    """
    Solo genera señal para rechazos/suspensiones de proyectos grandes.
    Las aprobaciones enriquecen el KG pero no activan el Radar de riesgo.
    """
    from api.radar.models import RadarSignal

    estado = proj.get("estado", "").lower()
    if not any(kw in estado for kw in ["rechazado", "suspendido", "observado"]):
        return None

    nombre = proj.get("nombre", "")
    tipo   = proj.get("tipo", "")
    sectors = _classify_sector(nombre, tipo)

    preview = (
        f"SEIA — Proyecto {estado.upper()}: {nombre[:100]}. "
        f"Titular: {proj.get('titular', '')}. Región: {proj.get('region', '')}."
    )

    return RadarSignal(
        sector=sectors[0] if sectors else "mineria",
        affected_industries=sectors,
        signal_type="SECTOR_RISK",
        severity=0.65,
        headline_preview=preview[:300],
        source="seia",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=168),
        classified_by="seia_structured",
    )


def _build_anchor_node(aprobados: list[dict]) -> dict:
    if not aprobados:
        resumen = "Sin proyectos aprobados en la ventana de consulta."
    else:
        proyectos_str = "; ".join(
            f"{p['nombre'][:50]} ({p['region']})"
            for p in aprobados[:5]
        )
        resumen = f"{len(aprobados)} proyectos aprobados recientemente: {proyectos_str}."

    content = (
        f"Estado actual de proyectos aprobados por el SEIA (Chile). "
        f"{resumen} "
        f"Los proyectos aprobados por el SEIA representan inversión privada futura "
        f"en infraestructura, minería, energía e industria. Son señales de CAPEX "
        f"que anticipan demanda en sectores de servicios, logística y tecnología. "
        f"Fuente: {_BASE_URL}."
    )

    return {
        "document_title": ANCHOR_TITLE,
        "header_path": "Estado Actual",
        "content": content,
        "category": CATEGORY,
        "tags": ["SEIA", "inversion", "capex", "chile"],
        "metadata": {
            "fuente": "SEIA",
            "tipo_anchor": True,
            "permanent": True,
            "n_aprobados_recientes": len(aprobados),
        },
        "embedding": None,
    }


def fetch_all_as_nodes() -> list[dict]:
    aprobados = _fetch_projects("Calificado Favorablemente")
    en_calificacion = _fetch_projects("En Calificación")
    rechazados = _fetch_projects("Rechazado")

    nodes = [project_to_node(p) for p in aprobados + en_calificacion + rechazados]
    nodes.append(_build_anchor_node(aprobados))
    log.info("[seia] Total nodos producidos: %d", len(nodes))
    return nodes


def fetch_all_as_signals() -> list:
    rechazados = _fetch_projects("Rechazado")
    signals = [project_to_signal(p) for p in rechazados]
    return [s for s in signals if s is not None]
