"""
src/extractors/cmf_extractor.py — Extractor oficial CMF API.

Fuente: https://api.cmfchile.cl/ (API pública CMF Chile)
Endpoint: /api-sbifv3/recursos/svs/api/hechos_esenciales

Produce DOS salidas:
  1. knowledge_nodes — nodos PERMANENTES (metadata.permanent=True, sin TTL)
  2. RadarSignal     — señal activa si el HE es materialmente negativo

Autenticación: query param `apikey` → CMF_API_KEY en .env

La CMF actualiza Hechos Esenciales en tiempo real (horario bursátil
09:00–18:00 hora Santiago). El scheduler los corre cada 4 horas.
"""
from __future__ import annotations
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import TYPE_CHECKING

import requests
from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type, before_sleep_log,
)

if TYPE_CHECKING:
    from api.radar.models import RadarSignal

log = logging.getLogger(__name__)

CMF_BASE_URL = "https://api.cmfchile.cl/api-sbifv3/recursos/svs/api"
CATEGORY = "Regulatorio CMF"

# Tipos de HE y su mapeo a señal Radar: None = persistir como nodo KG, no señal
_HE_SIGNAL_MAP: dict[str, tuple[str, float] | None] = {
    "FUSIÓN":                ("SECTOR_RISK", 0.55),
    "ADQUISICION":           ("SECTOR_RISK", 0.55),
    "ADQUISICIÓN":           ("SECTOR_RISK", 0.55),
    "MULTA":                 ("REGULATORY_ACTION", 0.88),
    "SANCIÓN":               ("REGULATORY_ACTION", 0.88),
    "SANCION":               ("REGULATORY_ACTION", 0.88),
    "QUIEBRA":               ("SECTOR_RISK", 0.95),
    "LIQUIDACIÓN":           ("SECTOR_RISK", 0.92),
    "LIQUIDACION":           ("SECTOR_RISK", 0.92),
    "INSOLVENCIA":           ("SECTOR_RISK", 0.92),
    "CONCURSO DE ACREEDORES": ("SECTOR_RISK", 0.90),
    "CAMBIO DIRECTORIO":     None,
    "AUMENTO DE CAPITAL":    None,
    "DISMINUCIÓN DE CAPITAL": None,
    "EMISION":               None,
    "EMISIÓN":               None,
}

_DEFAULT_INDUSTRIES = ["fintech", "credito", "saas", "marketplace"]


@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(
        (requests.HTTPError, requests.ConnectionError, requests.Timeout)
    ),
    before_sleep=before_sleep_log(log, logging.WARNING),
)
def _get(endpoint: str, params: dict) -> dict:
    resp = requests.get(
        f"{CMF_BASE_URL}/{endpoint}",
        params=params,
        timeout=20,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_hechos_esenciales(
    desde: str | None = None,
    hasta: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """
    Obtiene Hechos Esenciales desde la API CMF.
    desde/hasta: formato YYYY-MM-DD. Default: últimos 7 días.
    """
    # La cabecera de este archivo documenta CMF_API_KEY y el codigo leia
    # CMF_BEST_KEY: quien siguiera la doc configuraba una variable que nadie
    # lee. Se aceptan ambos nombres para que el mismatch no vuelva a costar
    # semanas de sincronizaciones vacias.
    api_key = os.getenv("CMF_API_KEY", "") or os.getenv("CMF_BEST_KEY", "")
    if not api_key:
        log.error(
            "[cmf] Sin credencial: define CMF_API_KEY (se obtiene en "
            "api.cmfchile.cl). El extractor devuelve vacio y el job va a contar "
            "0 resultados."
        )
        return []

    now = datetime.now(timezone.utc)
    if not desde:
        desde = (now - timedelta(days=7)).strftime("%Y-%m-%d")
    if not hasta:
        hasta = now.strftime("%Y-%m-%d")

    try:
        data = _get("hechos_esenciales", {
            "apikey": api_key,
            "formato": "json",
            "desde": desde,
            "hasta": hasta,
        })
    except Exception as exc:
        log.error("[cmf] Error API CMF: %s", exc)
        return []

    # La API CMF ha variado la clave raíz entre versiones
    raw: list[dict] = (
        data.get("Hechos_Esenciales_Emisores_Valores")
        or data.get("Hechos_Esenciales")
        or data.get("hechos_esenciales")
        or []
    )
    log.info("[cmf] %d hechos esenciales (desde=%s hasta=%s)", len(raw), desde, hasta)
    return raw[:limit]


def _detect_tipo(descripcion: str) -> str:
    upper = descripcion.upper()
    for tipo in _HE_SIGNAL_MAP:
        if tipo in upper:
            return tipo
    return "OTRO"


def _classify_industries(descripcion: str, tipo: str) -> list[str]:
    text = (descripcion + " " + tipo).lower()
    industries: list[str] = []
    if any(k in text for k in ["banco", "crédito", "credito", "financier", "fintech", "pagos"]):
        industries += ["fintech", "credito"]
    if any(k in text for k in ["minera", "cobre", "litio", "energía", "energia", "solar"]):
        industries += ["mineria", "cleantech", "energia"]
    if any(k in text for k in ["retail", "comercio", "supermercado"]):
        industries += ["retail", "ecommerce"]
    if any(k in text for k in ["seguro", "insurtech", "previsión", "prevision"]):
        industries += ["insurtech"]
    if any(k in text for k in ["inmobil", "proptech", "construcción", "construccion"]):
        industries += ["proptech", "inmobiliaria"]
    if any(k in text for k in ["salud", "farmac", "healthtech"]):
        industries += ["healthtech", "salud"]
    return industries or _DEFAULT_INDUSTRIES


def _parse_fecha(raw: str) -> str:
    """DD/MM/YYYY o YYYY-MM-DD → YYYY-MM-DD."""
    raw = raw.strip()
    if not raw:
        return ""
    try:
        if "/" in raw:
            parts = raw.split("/")
            if len(parts) == 3:
                d, m, y = parts
                return f"{y}-{m.zfill(2)}-{d.zfill(2)}"
    except ValueError:
        pass
    return raw


def he_to_node(he: dict) -> dict:
    emisor = (he.get("Emisor") or he.get("emisor") or "Empresa Desconocida").strip()
    rut = (he.get("RUTEmisor") or he.get("rut") or "").strip()
    descripcion = (he.get("Descripcion") or he.get("descripcion") or "").strip()
    fecha_iso = _parse_fecha(he.get("FechaHecho") or he.get("fecha") or "")
    url = (he.get("URL") or he.get("url") or "").strip()
    tipo = _detect_tipo(descripcion)

    document_title = f"CMF HE — {emisor[:60]} — {tipo}"
    content = (
        f"Hecho Esencial CMF. Empresa emisora: {emisor}. RUT: {rut}. "
        f"Tipo de hecho: {tipo}. Fecha de reporte: {fecha_iso}. "
        f"Descripción oficial: {descripcion[:800]} "
        f"Documento fuente: {url}."
    )

    return {
        "document_title": document_title,
        "header_path": "Hecho Esencial",
        "content": content,
        "category": CATEGORY,
        "tags": ["CMF", "hecho_esencial", tipo.lower().replace(" ", "_"), emisor[:40]],
        "metadata": {
            "fuente": "CMF",
            "tipo_hecho": tipo,
            "emisor": emisor,
            "rut_emisor": rut,
            "fecha_hecho": fecha_iso,
            "url_documento": url,
            "permanent": True,
        },
        "embedding": None,
    }


def he_to_signal(he: dict) -> "RadarSignal | None":
    from api.radar.models import RadarSignal

    descripcion = (he.get("Descripcion") or he.get("descripcion") or "").strip()
    emisor = (he.get("Emisor") or he.get("emisor") or "Empresa").strip()
    tipo = _detect_tipo(descripcion)
    mapping = _HE_SIGNAL_MAP.get(tipo)
    if mapping is None:
        return None

    signal_type_str, severity = mapping
    industries = _classify_industries(descripcion, tipo)
    preview = f"CMF HE [{tipo}] {emisor}: {descripcion[:200]}"

    return RadarSignal(
        sector=industries[0] if industries else "global",
        affected_industries=industries,
        signal_type=signal_type_str,  # type: ignore[arg-type]
        severity=severity,
        headline_preview=preview,
        source="cmf_api",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=72),
        classified_by="cmf_structured",
    )


def fetch_all_as_nodes(desde: str | None = None) -> list[dict]:
    return [he_to_node(h) for h in fetch_hechos_esenciales(desde=desde)]


def fetch_all_as_signals(desde: str | None = None) -> list["RadarSignal"]:
    signals = [he_to_signal(h) for h in fetch_hechos_esenciales(desde=desde)]
    return [s for s in signals if s is not None]
