"""
src/extractors/mercadopublico_extractor.py — Extractor API Mercado Público Chile.

Fuente: https://api.mercadopublico.cl/
Endpoint: /servicios/v1/publico/licitaciones.json

Ingesta licitaciones en estado ADJUDICADA. Un contrato adjudicado es una
señal de flujo de caja futuro garantizado para el proveedor ganador y una
señal de demanda sectorial para el Knowledge Graph de Bralidus.

Autenticación: query param `ticket` → MP_API_KEY en .env
Rate limit: ~1.000 req/día en tier estándar. Job diario = 1 req/ejecución.

Produce nodos PERMANENTES (metadata.permanent=True) en knowledge_nodes.
No genera RadarSignals — las licitaciones son señales oportunidad, no riesgo.
"""
from __future__ import annotations
import logging
import os
from datetime import datetime, timedelta, timezone

import requests
from tenacity import (
    retry, stop_after_attempt, wait_exponential,
    retry_if_exception_type, before_sleep_log,
)

log = logging.getLogger(__name__)

MP_BASE_URL = "https://api.mercadopublico.cl/servicios/v1/publico"
CATEGORY = "Mercado Público"

# Umbral mínimo en CLP para persistir una licitación como nodo (filtrar ruido)
MONTO_MINIMO_CLP = 5_000_000  # 5 millones CLP (~5.500 USD)


@retry(
    stop=stop_after_attempt(4),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    retry=retry_if_exception_type(
        (requests.HTTPError, requests.ConnectionError, requests.Timeout)
    ),
    before_sleep=before_sleep_log(log, logging.WARNING),
)
def _get_licitaciones(fecha: str, ticket: str) -> dict:
    resp = requests.get(
        f"{MP_BASE_URL}/licitaciones.json",
        params={"estado": "adjudicada", "fecha": fecha, "ticket": ticket},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def fetch_licitaciones(
    fecha: str | None = None,
    dias_atras: int = 1,
    limit: int = 200,
) -> list[dict]:
    """
    Obtiene licitaciones adjudicadas del día indicado.
    fecha: formato DDMMYYYY. Default: ayer.
    """
    ticket = os.getenv("MP_API_KEY", "")
    if not ticket:
        log.warning("[mp] MP_API_KEY no configurado — omitiendo extractor.")
        return []

    if not fecha:
        target = datetime.now(timezone.utc) - timedelta(days=dias_atras)
        fecha = target.strftime("%d%m%Y")

    try:
        data = _get_licitaciones(fecha, ticket)
    except Exception as exc:
        log.error("[mp] Error API Mercado Público: %s", exc)
        return []

    listado: list[dict] = data.get("Listado") or []
    log.info("[mp] %d licitaciones adjudicadas (fecha=%s)", len(listado), fecha)
    return listado[:limit]


def _calc_monto_total(lic: dict) -> float:
    """Suma MontoUnitario × Cantidad de todos los ítems adjudicados."""
    total = 0.0
    try:
        items = (lic.get("Adjudicacion") or {}).get("Items") or []
        for item in items:
            monto = float(item.get("MontoUnitario") or 0)
            cantidad = float(item.get("Cantidad") or 1)
            total += monto * cantidad
    except (TypeError, ValueError):
        pass
    return total


def _extract_proveedor(lic: dict) -> str:
    try:
        items = (lic.get("Adjudicacion") or {}).get("Items") or []
        if items:
            return (items[0].get("NombreProveedor") or "Proveedor Desconocido").strip()
    except (TypeError, KeyError):
        pass
    return "Proveedor Desconocido"


def _classify_sector(nombre: str, organismo: str) -> str:
    text = (nombre + " " + organismo).lower()
    if any(k in text for k in ["tecnolog", "software", "digital", "sistema", "plataforma"]):
        return "b2b_saas"
    if any(k in text for k in ["salud", "hospital", "clínica", "clinica", "medicamento"]):
        return "healthtech"
    if any(k in text for k in ["educación", "educacion", "escuela", "universidad"]):
        return "edtech"
    if any(k in text for k in ["obra", "infraestructura", "vialidad", "construcción"]):
        return "inmobiliaria"
    if any(k in text for k in ["seguridad", "vigilancia", "defensa"]):
        return "b2g"
    return "b2g"


def _parse_fecha_mp(raw: str) -> str:
    raw = raw.strip() if raw else ""
    if not raw:
        return ""
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw[:19], fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return raw


def licitacion_to_node(lic: dict) -> dict | None:
    codigo = (lic.get("CodigoExterno") or lic.get("Codigo") or "").strip()
    nombre = (lic.get("Nombre") or "Sin nombre").strip()[:120]
    organismo = (lic.get("NombreOrganismo") or lic.get("Organismo") or "Organismo").strip()
    proveedor = _extract_proveedor(lic)
    monto = _calc_monto_total(lic)
    fecha_iso = _parse_fecha_mp(
        lic.get("FechaAdjudicacion") or lic.get("FechaCierre") or ""
    )

    if monto < MONTO_MINIMO_CLP and monto > 0:
        log.debug("[mp] Licitación %s bajo umbral ($%.0f) — omitida.", codigo, monto)
        return None

    monto_str = f"${monto:,.0f} CLP" if monto > 0 else "monto no disponible"
    sector = _classify_sector(nombre, organismo)
    document_title = f"Licitación MP — {proveedor[:50]} — {organismo[:40]}"

    content = (
        f"Licitación pública adjudicada vía Mercado Público Chile. "
        f"Código: {codigo}. Objeto: {nombre}. "
        f"Organismo comprador: {organismo}. "
        f"Proveedor adjudicado: {proveedor}. "
        f"Monto total estimado: {monto_str}. Fecha adjudicación: {fecha_iso}. "
        f"Sector estimado: {sector}. "
        f"Un contrato gubernamental adjudicado garantiza flujo de caja futuro "
        f"al proveedor e indica demanda sostenida en el sector {sector}."
    )

    return {
        "document_title": document_title,
        "header_path": "Licitacion Adjudicada",
        "content": content,
        "category": CATEGORY,
        "tags": [
            "MercadoPublico", "licitacion", "b2g",
            proveedor[:30], organismo[:30], sector,
        ],
        "metadata": {
            "fuente": "MercadoPublico",
            "codigo_externo": codigo,
            "nombre_licitacion": nombre,
            "organismo": organismo,
            "proveedor": proveedor,
            "monto_total_clp": monto,
            "fecha_adjudicacion": fecha_iso,
            "sector_estimado": sector,
            "permanent": True,
        },
        "embedding": None,
    }


def fetch_all_as_nodes(fecha: str | None = None) -> list[dict]:
    """Punto de entrada para ingesta: devuelve nodos KG válidos."""
    licitaciones = fetch_licitaciones(fecha=fecha)
    nodes = [licitacion_to_node(l) for l in licitaciones]
    return [n for n in nodes if n is not None]
