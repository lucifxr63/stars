"""
entity_router.py — Motor de routing dinámico de entidades.

Dado el perfil de una startup (industria, etapa, geografía), determina qué
document_titles del grafo de conocimiento son relevantes para activar.

El RPC search_hybrid_graphrag usa estos títulos para traversal de aristas
(GRAPH path) antes de caer al fallback vectorial (VECTOR path).
"""
from __future__ import annotations
from dataclasses import dataclass, field

# ── Catálogo de entidades disponibles ────────────────────────────────────────
# Cada grupo mapea a document_titles reales en knowledge_nodes.
# Grupos 'macro_*' corresponden a FRED (siempre disponibles).
# Resto corresponden a yfinance (disponibles tras pipeline Paso 2).

ENTITY_GROUPS: dict[str, list[str]] = {
    # FRED — Macroeconomia (Phase 1: siempre disponibles)
    "macro_base": [
        "PIB USA (GDP)",
        "Inflación USA (CPI All Urban Consumers)",
        "Tasa de Fondos Federales (Fed Funds Rate)",
    ],
    # yfinance — Mercados globales (Phase 2)
    "mercados": [
        "S&P 500 (Indice Mercado USA)",
        "NASDAQ Composite (Tecnologia USA)",
    ],
    # yfinance — Mercados Chile (Phase 2)
    "mercados_chile": [
        "IPSA (Indice Bursatil Chile)",
        "iShares MSCI Chile ETF",
    ],
    # yfinance — LATAM (Phase 2)
    "mercados_latam": [
        "iShares Latin America 40 ETF",
    ],
    # yfinance — Commodities (Phase 2)
    "commodities": [
        "Cobre Futuros (Commodity Chile)",
        "WTI Petroleo Crudo (Futuros)",
        "Oro (Gold Futures)",
        "Albemarle Corp (Proxy Litio Chile)",
    ],
    # yfinance — Forex (Phase 2)
    "forex_chile": [
        "USD/CLP (Tipo de Cambio Chile)",
    ],
    # yfinance — Riesgo (Phase 2)
    "riesgo": [
        "VIX (Indice de Volatilidad de Mercados)",
    ],
    # yfinance — Tasas (Phase 2)
    "tasas_usa": [
        "Tasa del Tesoro USA 10 Anos",
    ],

    # ── Phase 3A: OpenBB / FRED extendido ────────────────────────────────────
    # Activo tras: pip install openbb>=4.3.3 && py main.py --phase3
    "empleo_usa": [
        "Desempleo USA (Unemployment Rate)",
    ],
    "liquidez_global": [
        "M2 Money Supply USA",
    ],
    "riesgo_macro": [
        "Spread Curva 10Y-2Y USA (Indicador Recesion)",
        "High Yield Credit Spread (Apetito Riesgo Credito)",
    ],
    "ciclo_industrial": [
        "Produccion Industrial USA (Industrial Production Index)",
    ],
    "forex_global": [
        "USD/CNY (Tipo de Cambio Yuan)",
    ],

    # ── Phase 3B: OpenBB / World Bank Chile ──────────────────────────────────
    # Activo tras: openbb economy.indicators con World Bank provider
    "chile_macro": [
        "PIB per Capita Chile (USD corrientes)",
        "Desempleo Chile (% fuerza laboral)",
        "Inversion Extranjera Directa Chile (% PIB)",
    ],
}

# ── Routing por industria → grupos de entidades ───────────────────────────────
# Agrupa las entidades más relevantes para cada tipo de startup.

INDUSTRY_ROUTING: dict[str, list[str]] = {
    # ── Finanzas / Capital ────────────────────────────────────────────────────
    "fintech":      ["macro_base", "tasas_usa", "riesgo", "mercados", "empleo_usa", "liquidez_global", "riesgo_macro"],
    "credito":      ["macro_base", "tasas_usa", "riesgo", "empleo_usa", "riesgo_macro"],
    "insurtech":    ["macro_base", "tasas_usa", "riesgo", "riesgo_macro"],

    # ── Software / Tech ───────────────────────────────────────────────────────
    "saas":         ["macro_base", "mercados", "tasas_usa", "riesgo", "forex_chile", "liquidez_global", "riesgo_macro"],
    "b2b_saas":     ["macro_base", "mercados", "tasas_usa", "forex_chile", "liquidez_global"],
    "b2c":          ["macro_base", "mercados_chile", "forex_chile", "empleo_usa", "chile_macro"],

    # ── Comercio / Retail ─────────────────────────────────────────────────────
    "ecommerce":    ["macro_base", "forex_chile", "mercados_chile", "empleo_usa", "chile_macro"],
    "retail":       ["macro_base", "forex_chile", "mercados_chile", "chile_macro"],
    "marketplace":  ["macro_base", "mercados_chile", "forex_chile", "chile_macro"],

    # ── Recursos naturales / Commodities ──────────────────────────────────────
    "agro":         ["macro_base", "commodities", "mercados_chile", "forex_chile", "forex_global"],
    "agricultura":  ["macro_base", "commodities", "mercados_chile", "forex_chile", "forex_global"],
    "mineria":      ["macro_base", "commodities", "forex_chile", "mercados_chile", "forex_global"],
    "cleantech":    ["macro_base", "commodities", "tasas_usa", "mercados", "liquidez_global"],
    "energia":      ["macro_base", "commodities", "tasas_usa", "ciclo_industrial"],

    # ── Comercio exterior ─────────────────────────────────────────────────────
    "exportacion":  ["macro_base", "commodities", "forex_chile", "mercados_chile", "mercados_latam", "forex_global", "chile_macro"],
    "importacion":  ["macro_base", "commodities", "forex_chile", "forex_global"],
    "logistica":    ["macro_base", "commodities", "forex_chile", "ciclo_industrial"],

    # ── Salud / Educación ─────────────────────────────────────────────────────
    "healthtech":   ["macro_base", "tasas_usa", "empleo_usa"],
    "salud":        ["macro_base", "tasas_usa", "empleo_usa"],
    "edtech":       ["macro_base", "mercados_chile", "chile_macro"],

    # ── Inmobiliaria ──────────────────────────────────────────────────────────
    "proptech":     ["macro_base", "tasas_usa", "mercados_chile", "riesgo_macro", "empleo_usa"],
    "inmobiliaria": ["macro_base", "tasas_usa", "mercados_chile", "riesgo_macro"],

    # ── Turismo / Alimentos ───────────────────────────────────────────────────
    "turismo":      ["macro_base", "forex_chile", "mercados_chile", "chile_macro"],
    "foodtech":     ["macro_base", "commodities", "mercados_chile", "ciclo_industrial"],

    # ── Ciencias / Hardware ───────────────────────────────────────────────────
    "biotech":      ["macro_base", "tasas_usa", "mercados", "liquidez_global"],
    "hardware":     ["macro_base", "commodities", "forex_chile", "tasas_usa", "ciclo_industrial", "forex_global"],

    # fallback genérico
    "default":      ["macro_base", "riesgo"],
}

# ── Modificadores por etapa ───────────────────────────────────────────────────
# Startups early-stage priorizan riesgo/capital; growth priorizan expansión

STAGE_MODIFIER: dict[str, list[str]] = {
    "pre_seed": ["riesgo", "riesgo_macro"],
    "seed":     ["riesgo", "tasas_usa", "liquidez_global", "riesgo_macro"],
    "series_a": ["mercados", "riesgo", "liquidez_global"],
    "growth":   ["mercados", "mercados_latam", "ciclo_industrial"],
    "ipo":      ["mercados", "mercados_chile", "mercados_latam", "riesgo_macro"],
}

# ── Modificadores por geografía ───────────────────────────────────────────────

GEO_MODIFIER: dict[str, list[str]] = {
    "chile":   ["mercados_chile", "forex_chile", "chile_macro"],
    "latam":   ["mercados_latam", "mercados_chile", "forex_global"],
    "usa":     ["mercados", "macro_base", "empleo_usa"],
    "global":  ["mercados", "mercados_latam", "forex_global"],
}


# ── Resultado del routing ──────────────────────────────────────────────────────

@dataclass
class RoutingResult:
    entities: list[str] = field(default_factory=list)
    groups_activated: list[str] = field(default_factory=list)
    reason: str = ""


def route(
    industry: str | None = None,
    stage: str | None = None,
    geography: str | None = "chile",
) -> RoutingResult:
    """
    Convierte el contexto de una startup en una lista de document_titles
    para activar el path de grafo en search_hybrid_graphrag.

    El algoritmo:
      1. Normaliza la industria → busca en INDUSTRY_ROUTING (fuzzy fallback al default)
      2. Añade modificadores de etapa (pre_seed = más riesgo, ipo = más mercados)
      3. Añade modificadores geográficos (latam = mercados_latam, etc.)
      4. Expande grupos → document_titles únicos
    """
    groups: set[str] = set()
    reasons: list[str] = []

    # 1. Routing por industria
    industry_key = _normalize_industry(industry)
    industry_groups = INDUSTRY_ROUTING.get(industry_key, INDUSTRY_ROUTING["default"])
    groups.update(industry_groups)
    reasons.append(f"industria={industry_key} → grupos {industry_groups}")

    # 2. Modificador de etapa
    if stage:
        stage_extra = STAGE_MODIFIER.get(stage, [])
        groups.update(stage_extra)
        if stage_extra:
            reasons.append(f"etapa={stage} → +{stage_extra}")

    # 3. Modificador geográfico
    if geography:
        geo_key = geography.lower().strip()
        geo_extra = GEO_MODIFIER.get(geo_key, [])
        groups.update(geo_extra)
        if geo_extra:
            reasons.append(f"geo={geo_key} → +{geo_extra}")

    # 4. Expandir grupos → document_titles únicos (preserva orden de grupos)
    entities: list[str] = []
    for group in sorted(groups):  # sorted para determinismo
        for title in ENTITY_GROUPS.get(group, []):
            if title not in entities:
                entities.append(title)

    return RoutingResult(
        entities=entities,
        groups_activated=sorted(groups),
        reason="; ".join(reasons),
    )


def _normalize_industry(raw: str | None) -> str:
    """
    Normaliza la industria a una clave de INDUSTRY_ROUTING.
    Intenta match exacto, luego parcial (substring), luego 'default'.
    """
    if not raw:
        return "default"
    key = raw.lower().strip().replace(" ", "_").replace("-", "_")
    if key in INDUSTRY_ROUTING:
        return key
    # Búsqueda parcial
    for known_key in INDUSTRY_ROUTING:
        if known_key in key or key in known_key:
            return known_key
    return "default"
