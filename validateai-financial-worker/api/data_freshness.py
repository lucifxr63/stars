"""
data_freshness.py — Detección de frescura de datos para /query/moe.

Cuando una query menciona fuentes que tienen scrapers programados (Mercado Público,
SII, etc.), verifica si los datos están frescos y dispara un refresh en background
si han pasado más de STALE_HOURS sin actualización.

Arquitectura de refresh:
  - > STALE_HOURS (24h): refresh en background, responde con datos existentes + data_note
  - Nunca bloquea la respuesta — el caller siempre recibe contexto disponible inmediatamente
"""
from __future__ import annotations
import logging
import time
from datetime import datetime, timezone, timedelta

log = logging.getLogger(__name__)

STALE_HOURS = 24
CRITICAL_HOURS = 168  # 7 días — señal de alerta en data_note

# Categoría en knowledge_nodes para cada fuente.
#
# OJO: estos strings deben coincidir EXACTAMENTE con la constante CATEGORY del
# extractor correspondiente. Si no coinciden, la consulta no devuelve filas,
# is_stale(None) da True y la fuente queda marcada como vencida para siempre.
# Eso fue justamente el bug: acá decía "Compras Públicas B2G" mientras
# src/extractors/mercadopublico_extractor.py escribe "Mercado Público".
SOURCE_CATEGORIES: dict[str, str] = {
    "mercado_publico": "Mercado Público",  # = mercadopublico_extractor.CATEGORY
    "sii": "SII Chile",
    "bcch": "Banco Central Chile",
    "cmf": "Regulatorio CMF",
}

# Ventana mínima entre refreshes disparados por consulta, POR FUENTE.
#
# Sin esto, una fuente que nunca sincronizó (cero nodos) es "vencida" en cada
# request: check_category_freshness devuelve None, is_stale(None) es True, y el
# refresh se dispara en CADA /query/moe que mencione la fuente — sin límite,
# contra APIs con cuota diaria (la de Mercado Público admite ~1.000 req/día).
# Corregir el nombre de la categoría no basta: mientras la fuente esté vacía,
# el disparo sigue siendo permanente. Este cooldown es lo que lo acota.
REFRESH_COOLDOWN_S = 3600

# Última vez que se disparó refresh por fuente. Vive en memoria del proceso: en
# serverless se pierde entre instancias frías, igual que el dedupe del
# circuit breaker y el de ops-alert (mismo trade-off ya aceptado en el
# ecosistema). Alcanza para cortar el caso real —ráfagas de consultas sobre la
# misma instancia tibia— sin pretender ser un lock distribuido.
_last_refresh_at: dict[str, float] = {}


def should_trigger_refresh(source: str, cooldown_s: int = REFRESH_COOLDOWN_S) -> bool:
    """
    True si corresponde disparar un refresh de `source` ahora. Registra el
    disparo, así que llamarla dos veces seguidas devuelve True y luego False.
    """
    now = time.monotonic()
    last = _last_refresh_at.get(source)
    if last is not None and now - last < cooldown_s:
        return False
    _last_refresh_at[source] = now
    return True

_MP_KEYWORDS = {
    "licitacion", "licitación", "mercado público", "mercado publico",
    "chilecompra", "b2g", "compra publica", "compra pública",
    "adjudicacion", "adjudicación", "contrato gobierno", "proveedor estado",
    "convenio marco", "portal compras", "tenderchile", "proveedor del estado",
}

_SII_KEYWORDS = {
    "sii", "rut empresa", "tributario", "contribuyente", "impuesto renta",
    "declaracion renta", "giro comercial",
}


def detect_sources_needed(query: str) -> list[str]:
    """Retorna lista de source_keys que la query necesita."""
    q = query.lower()
    needed: list[str] = []
    if any(kw in q for kw in _MP_KEYWORDS):
        needed.append("mercado_publico")
    if any(kw in q for kw in _SII_KEYWORDS):
        needed.append("sii")
    return needed


def check_category_freshness(client, category: str) -> datetime | None:
    """
    Retorna el updated_at más reciente de knowledge_nodes para esa categoría.
    None si no hay nodos (nunca sincronizado).
    """
    try:
        result = (
            client.table("knowledge_nodes")
            .select("updated_at")
            .eq("category", category)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        if not rows:
            return None
        ts_str = rows[0]["updated_at"]
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except Exception as exc:
        log.warning("[freshness] Error checking '%s': %s", category, exc)
        return None


def is_stale(last_updated: datetime | None, hours: int = STALE_HOURS) -> bool:
    """True si last_updated es más antiguo que `hours` horas, o None (jamás actualizado)."""
    if last_updated is None:
        return True
    return last_updated < datetime.now(timezone.utc) - timedelta(hours=hours)


def build_freshness_dict(
    client,
    sources: list[str],
) -> tuple[dict[str, str], list[str]]:
    """
    Para cada source en `sources`, consulta la frescura y retorna:
      - freshness_map: { source_key → ISO timestamp } con los timestamps
      - stale_sources: lista de sources que superaron STALE_HOURS
    """
    freshness_map: dict[str, str] = {}
    stale_sources: list[str] = []

    for source in sources:
        category = SOURCE_CATEGORIES.get(source)
        if not category:
            continue
        last_updated = check_category_freshness(client, category)
        if last_updated:
            freshness_map[source] = last_updated.isoformat()
        else:
            freshness_map[source] = "nunca"

        if is_stale(last_updated, hours=STALE_HOURS):
            stale_sources.append(source)

    return freshness_map, stale_sources
