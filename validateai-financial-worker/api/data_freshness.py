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
from datetime import datetime, timezone, timedelta

log = logging.getLogger(__name__)

STALE_HOURS = 24
CRITICAL_HOURS = 168  # 7 días — señal de alerta en data_note

# Categoría en knowledge_nodes para cada fuente
SOURCE_CATEGORIES: dict[str, str] = {
    "mercado_publico": "Compras Públicas B2G",
    "sii": "SII Chile",
    "bcch": "Banco Central Chile",
    "cmf": "Regulatorio CMF",
}

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
