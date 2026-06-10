"""
src/extractors/empleo_extractor.py — Señal de empleo sectorial (proxy de expansión/contracción).

Lógica: el volumen de ofertas laborales por sector es un indicador adelantado de inversión.
Un aumento sostenido de ofertas en minería precede al ciclo de expansión;
una caída en retail anticipa contracción del consumo.

Fuente: Computrabajo Chile (https://www.computrabajo.cl/) — HTML paginado, sin API.
Proxy rotation vía ScraperAPI recomendado para esta fuente.

Produce:
  - 1 nodo por sector con el recuento actual + delta vs. snapshot anterior.
  - No genera RadarSignals directamente. El delta se almacena en metadata
    para que el RAG pueda responder preguntas como "¿hay señales de expansión
    en minería?".
  - Si la caída en un sector supera un umbral, sí genera MACRO_ALERT.

Frecuencia recomendada: semanal (sábados) — los datos diarios son ruidosos.
"""
from __future__ import annotations
import logging
import os
import re
from datetime import datetime, timedelta, timezone

log = logging.getLogger(__name__)

CATEGORY = "Señal Empleo"
_BASE_URL = os.getenv("EMPLEO_BASE_URL", "https://www.computrabajo.cl")

# Sectores y sus queries de búsqueda en Computrabajo
_SECTORES: dict[str, dict] = {
    "mineria": {
        "query": "minería cobre litio",
        "industrias": ["mineria", "exportacion"],
    },
    "tecnologia": {
        "query": "desarrollador software tecnología",
        "industrias": ["saas", "fintech", "b2b_saas"],
    },
    "finanzas": {
        "query": "finanzas banco crédito fintech",
        "industrias": ["fintech", "credito"],
    },
    "construccion": {
        "query": "construcción inmobiliaria obras",
        "industrias": ["inmobiliaria", "proptech"],
    },
    "energia": {
        "query": "energía solar eólica eléctrica",
        "industrias": ["energia", "cleantech"],
    },
    "retail": {
        "query": "retail comercio ventas tienda",
        "industrias": ["retail", "ecommerce"],
    },
    "logistica": {
        "query": "logística transporte distribución",
        "industrias": ["logistica"],
    },
    "salud": {
        "query": "salud médico enfermería clínica",
        "industrias": ["healthtech", "salud"],
    },
}

# Si el delta (%) cae más de este umbral → MACRO_ALERT
_CONTRACTION_THRESHOLD = -0.25  # -25%


def _count_listings(sector_key: str, query: str) -> int:
    """
    Obtiene el número de ofertas activas en Computrabajo para una query dada.
    Extrae el contador de resultados del HTML (ej: "1.234 empleos encontrados").
    """
    import requests

    url = f"{_BASE_URL}/ofertas-de-trabajo/"
    params = {"q": query, "p": "1"}

    scraperapi_key = os.getenv("SCRAPERAPI_KEY", "")
    try:
        if scraperapi_key:
            target = url + "?" + "&".join(f"{k}={v}" for k, v in params.items())
            resp = requests.get(
                "https://api.scraperapi.com",
                params={"api_key": scraperapi_key, "url": target},
                timeout=30,
            )
        else:
            resp = requests.get(url, params=params, timeout=20, headers={
                "User-Agent": "Mozilla/5.0 (compatible; BralidusBot/1.0)",
            })
        resp.raise_for_status()
        html = resp.text

        # Buscar el contador de resultados en el HTML
        m = re.search(r"([\d.,]+)\s*(?:empleos|ofertas|resultados)", html, re.IGNORECASE)
        if m:
            count_str = m.group(1).replace(".", "").replace(",", "")
            return int(count_str)
        return 0
    except Exception as exc:
        log.warning("[empleo] Error contando %s: %s", sector_key, exc)
        return -1  # -1 = dato no disponible


def _get_previous_count(sector_key: str, client) -> int:
    """Lee el último snapshot del sector desde knowledge_nodes metadata."""
    try:
        result = (
            client.table("knowledge_nodes")
            .select("metadata")
            .eq("document_title", f"Empleo — {sector_key.title()} — Snapshot")
            .limit(1)
            .execute()
        )
        if result.data:
            return int(result.data[0]["metadata"].get("count", 0))
    except Exception:
        pass
    return 0


def sector_to_node(
    sector_key: str,
    count: int,
    prev_count: int,
    industrias: list[str],
) -> dict:
    delta_pct = (count - prev_count) / prev_count if prev_count > 0 else 0.0
    tendencia = (
        "en expansión" if delta_pct > 0.10
        else "en contracción" if delta_pct < -0.10
        else "estable"
    )

    delta_str = f"{delta_pct:+.1%}" if prev_count > 0 else "sin baseline"
    content = (
        f"Señal de mercado laboral: sector {sector_key} en Chile. "
        f"Ofertas laborales activas en Computrabajo: {count:,}. "
        f"Variación vs. semana anterior: {delta_str} ({tendencia}). "
        f"El volumen de ofertas laborales es un indicador adelantado de inversión y expansión. "
        f"Un alza sostenida (>10%) indica contratación activa y crecimiento; "
        f"una caída (>10%) anticipa recorte de presupuestos o contracción sectorial. "
        f"Sectores relacionados: {', '.join(industrias)}."
    )

    return {
        "document_title": f"Empleo — {sector_key.title()} — Snapshot",
        "header_path": "Señal Empleo Sectorial",
        "content": content,
        "category": CATEGORY,
        "tags": ["empleo", "señal_laboral", tendencia.replace(" ", "_"), sector_key] + industrias,
        "metadata": {
            "fuente": "Computrabajo",
            "sector": sector_key,
            "count": count,
            "prev_count": prev_count,
            "delta_pct": round(delta_pct, 4),
            "tendencia": tendencia,
            "fecha": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "permanent": False,  # Este nodo se sobreescribe semanalmente
        },
        "embedding": None,
    }


def sector_to_signal(sector_key: str, count: int, prev_count: int, industrias: list[str]):
    if prev_count <= 0 or count < 0:
        return None
    delta_pct = (count - prev_count) / prev_count
    if delta_pct >= _CONTRACTION_THRESHOLD:
        return None  # No hay contracción significativa

    from api.radar.models import RadarSignal

    preview = (
        f"Señal Empleo: sector {sector_key.upper()} en contracción "
        f"({delta_pct:+.1%} vs semana anterior, {count:,} ofertas activas)."
    )

    return RadarSignal(
        sector=industrias[0] if industrias else sector_key,
        affected_industries=industrias,
        signal_type="MACRO_ALERT",
        severity=min(0.75, 0.45 + abs(delta_pct)),
        headline_preview=preview[:300],
        source="computrabajo",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=168),
        classified_by="empleo_structured",
    )


def fetch_all_as_nodes(client=None) -> list[dict]:
    nodes: list[dict] = []
    for sector_key, config in _SECTORES.items():
        count = _count_listings(sector_key, config["query"])
        if count < 0:
            continue  # fuente no disponible, skip silencioso
        prev_count = _get_previous_count(sector_key, client) if client else 0
        nodes.append(sector_to_node(sector_key, count, prev_count, config["industrias"]))
        log.info("[empleo] %s: %d ofertas (prev=%d)", sector_key, count, prev_count)
    return nodes


def fetch_all_as_signals(client=None) -> list:
    signals: list = []
    for sector_key, config in _SECTORES.items():
        count = _count_listings(sector_key, config["query"])
        if count < 0:
            continue
        prev_count = _get_previous_count(sector_key, client) if client else 0
        sig = sector_to_signal(sector_key, count, prev_count, config["industrias"])
        if sig:
            signals.append(sig)
    return signals
