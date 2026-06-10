import requests
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type,
    before_sleep_log,
)
import logging

from src.config import FRED_API_KEY

logger = logging.getLogger(__name__)

FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations"

# Anclas macroeconómicas — Fase 1
# Columnas knowledge_nodes: document_title, header_path, content, category, tags, metadata, embedding
SERIES_CONFIG: dict[str, dict] = {
    "GDP": {
        "document_title": "PIB USA (GDP)",
        "unit": "Billones USD (SAAR)",
        "frequency": "trimestral",
        "tags": ["FRED", "GDP", "macro", "USA", "PIB"],
    },
    "CPIAUCSL": {
        "document_title": "Inflación USA (CPI All Urban Consumers)",
        "unit": "Índice 1982-84=100",
        "frequency": "mensual",
        "tags": ["FRED", "CPI", "inflacion", "macro", "USA"],
    },
    "FEDFUNDS": {
        "document_title": "Tasa de Fondos Federales (Fed Funds Rate)",
        "unit": "% anual",
        "frequency": "mensual",
        "tags": ["FRED", "FEDFUNDS", "tasa_interes", "macro", "USA", "Fed"],
    },
}

CATEGORY = "Macroeconomia"
OBSERVATIONS_LIMIT = 40


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    retry=retry_if_exception_type(
        (requests.HTTPError, requests.ConnectionError, requests.Timeout)
    ),
    before_sleep=before_sleep_log(logger, logging.WARNING),
)
def _fetch_observations(series_id: str) -> list[dict]:
    response = requests.get(
        FRED_BASE_URL,
        params={
            "series_id": series_id,
            "api_key": FRED_API_KEY,
            "file_type": "json",       # forzado — evita XML por defecto
            "sort_order": "desc",
            "limit": OBSERVATIONS_LIMIT,
        },
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["observations"]


def _parse_value(raw: str) -> float | None:
    # FRED usa "." para datos faltantes
    try:
        return float(raw)
    except (ValueError, TypeError):
        return None


def _build_content(series_id: str, config: dict, latest: dict | None) -> str:
    """
    Texto semántico para el campo content (usado por el motor RAG + pgvector).
    Debe ser descriptivo y denso en conceptos, no un dump de datos.
    """
    last_str = (
        f"Último dato disponible: {latest['value']} {config['unit']} ({latest['date']})."
        if latest
        else "Sin datos disponibles."
    )
    return (
        f"Serie macroeconómica: {config['document_title']}. "
        f"Fuente: FRED (Federal Reserve Bank of St. Louis). "
        f"Frecuencia: {config['frequency']}. Unidad: {config['unit']}. "
        f"{last_str} "
        f"URL de referencia: https://fred.stlouisfed.org/series/{series_id}."
    )


def series_to_node(series_id: str) -> dict:
    """Transforma una serie FRED en un dict compatible con knowledge_nodes."""
    config = SERIES_CONFIG[series_id]
    raw_observations = _fetch_observations(series_id)

    observations = [
        {"date": o["date"], "value": _parse_value(o["value"])}
        for o in raw_observations
        if o["value"] != "."
    ]

    latest = observations[0] if observations else None

    return {
        "document_title": config["document_title"],
        "header_path": "Introduccion",   # nodo raíz de la serie
        "content": _build_content(series_id, config, latest),
        "category": CATEGORY,
        "tags": config["tags"],
        "metadata": {
            "series_id": series_id,
            "fuente": "FRED",
            "url_fuente": f"https://fred.stlouisfed.org/series/{series_id}",
            "unidad": config["unit"],
            "frecuencia": config["frequency"],
            "ultima_fecha": latest["date"] if latest else None,
            "ultimo_valor": latest["value"] if latest else None,
            "observaciones": observations,
        },
        "embedding": None,
    }


def fetch_all() -> list[dict]:
    """Extrae todos los series configurados y los devuelve como lista de nodos."""
    nodes: list[dict] = []
    for series_id in SERIES_CONFIG:
        print(f"    -> FRED/{series_id} ({SERIES_CONFIG[series_id]['document_title']})...")
        nodes.append(series_to_node(series_id))
    return nodes
