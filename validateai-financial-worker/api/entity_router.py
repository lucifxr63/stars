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
    "chile_macro": [
        "PIB per Capita Chile (USD corrientes)",
        "Desempleo Chile (% fuerza laboral)",
        "Inversion Extranjera Directa Chile (% PIB)",
    ],

    # ── Sprint 3: BCCH Política Monetaria ────────────────────────────────────
    "bcch_tpm": [
        "BCCH Política Monetaria Chile — Estado Actual",
    ],

    # ── Sprint 4: SEIA — Proyectos de inversión ───────────────────────────────
    # Ancla con resumen de aprobaciones recientes → CAPEX futuro por sector.
    "seia_inversiones": [
        "SEIA Proyectos Aprobados Chile — Estado Actual",
    ],

    # ── Familia A — Sprint 1: Unit Economics ─────────────────────────────────
    # Nodos de due diligence financiero. Activados en seed/series_a y por
    # industrias que requieren justificar unit economics ante VCs.
    "unit_economics": [
        "CAC — Costo de Adquisición de Cliente",
        "LTV — Lifetime Value del Cliente",
        "Benchmark LTV:CAC > 3:1",
        "Benchmark Payback < 12 meses",
    ],

    # ── Familia A — Sprint 2: Compliance Fintech (Ley 21.521) ────────────────
    # Activado cuando la industria es fintech, credito o insurtech.
    "compliance_fintech": [
        "Ley Fintech 21.521 — Registro CMF de Prestadores",
        "Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)",
    ],

    # ── Familia A — Sprint 2: Compliance Datos (Ley 21.719) ──────────────────
    # Activado para cualquier startup que use datos de usuarios o pauta digital.
    "compliance_datos": [
        "Ley 21.719 — Gestión de Consentimiento",
        "Ley 21.719 — Estándar GDPR Chile",
    ],

    # ── Familia A — Sprint 2: Gobernanza Cap Table ────────────────────────────
    # Activado en etapas early-stage para alertar sobre vesting/SpA.
    "gobernanza_core": [
        "Estructura SpA (Sociedad por Acciones)",
        "Vesting y Cliff — Retención de Fundadores",
    ],

    # ── Familia A — Sprint 3: Tracción TRL/CRL ───────────────────────────────
    # Activado en pre_seed y seed para cruzar madurez tecnológica/comercial.
    "trl_crl": [
        "TRL — Technology Readiness Level",
        "CRL — Commercial Readiness Level",
    ],

    # ── Familia A — Sprint 3: Fundraising Corfo (solo geo chile) ─────────────
    "fundraising_chile": [
        "Corfo Semilla Inicia — Requisitos de Postulación",
        "Corfo Semilla Expande — Requisitos de Postulación",
    ],

    # ── Familia A — Sprint 3: Moat Competitivo ───────────────────────────────
    # Activado para plataformas, SaaS y marketplaces.
    "moat_estrategia": [
        "Network Effects — Efecto de Red",
        "Blue Ocean Strategy — Value Innovation",
    ],

    # ── Familia A — Sprint 3: GTM LatAm ──────────────────────────────────────
    "gtm_latam": [
        "WhatsApp-first GTM — Adopción Conversacional LatAm",
    ],

    # ── Sprint 6 — Riesgo Conductual y Sesgos ────────────────────────────────
    # Activado siempre en due diligence de equipo fundador (pre_seed/seed).
    "riesgo_conductual": [
        "Sesgo de Confirmación — Puntos Ciegos del Founder",
        "Sesgo de Optimismo — Sobreestimación de Resultados",
    ],

    # ── Sprint 6 — Propiedad Intelectual (INAPI) ──────────────────────────────
    # Activado en cualquier startup con marca/producto tecnológico.
    "propiedad_intelectual": [
        "Freedom to Operate (FTO) — Libertad de Operación INAPI",
        "Protección de Clases Niza — Registro de Marca Temprano",
    ],

    # ── Sprint 6 — Ciberseguridad e Infraestructura ───────────────────────────
    # Activado en B2G, B2B enterprise, fintech y SaaS con datos sensibles.
    "ciberseguridad": [
        "Ley Marco de Ciberseguridad (Ley 21.663)",
    ],

    # ── Sprint 6 — Compras Públicas B2G ──────────────────────────────────────
    # Activado cuando modelo de negocio incluye ventas al Estado chileno.
    "b2g_chile": [
        "Mercado Público y Convenio Marco — Estrategia B2G Chile",
    ],

    # ── Sprint 5 — Retención y Cohortes ──────────────────────────────────────
    # NRR + Gross Churn. Activado en modelos SaaS/subscription.
    "retencion_cohortes": [
        "Net Revenue Retention (NRR)",
        "Gross Churn Rate — Efecto Cubeta Agujereada",
    ],

    # ── Sprint 5 — Eficiencia de Capital ─────────────────────────────────────
    # Cash Runway + Burn Rate. Activado en seed/pre_seed para alertas de caja.
    "eficiencia_capital": [
        "Cash Runway — Regla VC 18-24 Meses",
        "Burn Rate — Quema Mensual vs Crecimiento MRR",
    ],

    # ── Sprint 5 — Estrategia de Salida ──────────────────────────────────────
    # M&A corporativo LatAm. Activado en series_a/growth y geo chile.
    "exit_strategy": [
        "M&A Estratégico — Compradores Corporativos LatAm",
    ],
}

# ── Routing por industria → grupos de entidades ───────────────────────────────
# Agrupa las entidades más relevantes para cada tipo de startup.

INDUSTRY_ROUTING: dict[str, list[str]] = {
    # ── Finanzas / Capital ────────────────────────────────────────────────────
    "fintech":      ["macro_base", "tasas_usa", "riesgo", "mercados", "empleo_usa", "liquidez_global", "riesgo_macro",
                     "bcch_tpm",
                     "compliance_fintech", "compliance_datos", "unit_economics",
                     "retencion_cohortes", "eficiencia_capital", "exit_strategy",
                     "propiedad_intelectual", "ciberseguridad", "riesgo_conductual"],
    "credito":      ["macro_base", "tasas_usa", "riesgo", "empleo_usa", "riesgo_macro",
                     "bcch_tpm",
                     "compliance_fintech", "compliance_datos", "unit_economics",
                     "retencion_cohortes", "eficiencia_capital",
                     "ciberseguridad", "riesgo_conductual"],
    "insurtech":    ["macro_base", "tasas_usa", "riesgo", "riesgo_macro",
                     "compliance_datos", "unit_economics",
                     "retencion_cohortes", "eficiencia_capital",
                     "ciberseguridad", "riesgo_conductual"],

    # ── Software / Tech ───────────────────────────────────────────────────────
    "saas":         ["macro_base", "mercados", "tasas_usa", "riesgo", "forex_chile", "liquidez_global", "riesgo_macro",
                     "unit_economics", "moat_estrategia",
                     "retencion_cohortes", "eficiencia_capital", "exit_strategy",
                     "propiedad_intelectual", "ciberseguridad", "riesgo_conductual"],
    "b2b_saas":     ["macro_base", "mercados", "tasas_usa", "forex_chile", "liquidez_global",
                     "unit_economics",
                     "retencion_cohortes", "eficiencia_capital", "exit_strategy",
                     "propiedad_intelectual", "ciberseguridad", "b2g_chile", "riesgo_conductual"],
    "b2c":          ["macro_base", "mercados_chile", "forex_chile", "empleo_usa", "chile_macro",
                     "compliance_datos", "gtm_latam", "unit_economics",
                     "eficiencia_capital", "propiedad_intelectual", "riesgo_conductual"],

    # ── Comercio / Retail ─────────────────────────────────────────────────────
    "ecommerce":    ["macro_base", "forex_chile", "mercados_chile", "empleo_usa", "chile_macro"],
    "retail":       ["macro_base", "forex_chile", "mercados_chile", "chile_macro"],
    "marketplace":  ["macro_base", "mercados_chile", "forex_chile", "chile_macro"],

    # ── Recursos naturales / Commodities ──────────────────────────────────────
    "agro":         ["macro_base", "commodities", "mercados_chile", "forex_chile", "forex_global"],
    "agricultura":  ["macro_base", "commodities", "mercados_chile", "forex_chile", "forex_global"],
    "mineria":      ["macro_base", "commodities", "forex_chile", "mercados_chile", "forex_global",
                     "seia_inversiones"],
    "cleantech":    ["macro_base", "commodities", "tasas_usa", "mercados", "liquidez_global",
                     "seia_inversiones"],
    "energia":      ["macro_base", "commodities", "tasas_usa", "ciclo_industrial",
                     "seia_inversiones"],

    # ── Comercio exterior ─────────────────────────────────────────────────────
    "exportacion":  ["macro_base", "commodities", "forex_chile", "mercados_chile", "mercados_latam", "forex_global", "chile_macro"],
    "importacion":  ["macro_base", "commodities", "forex_chile", "forex_global"],
    "logistica":    ["macro_base", "commodities", "forex_chile", "ciclo_industrial"],

    # ── Salud / Educación ─────────────────────────────────────────────────────
    "healthtech":   ["macro_base", "tasas_usa", "empleo_usa",
                     "ciberseguridad", "propiedad_intelectual", "b2g_chile", "riesgo_conductual"],
    "salud":        ["macro_base", "tasas_usa", "empleo_usa",
                     "ciberseguridad", "b2g_chile"],
    "edtech":       ["macro_base", "mercados_chile", "chile_macro",
                     "b2g_chile", "riesgo_conductual"],

    # ── B2G puro (gobierno, municipios, organismos públicos) ──────────────────
    "b2g":          ["macro_base", "mercados_chile", "chile_macro", "forex_chile",
                     "b2g_chile", "ciberseguridad", "compliance_datos",
                     "unit_economics", "eficiencia_capital", "riesgo_conductual"],
    "gobierno":     ["macro_base", "mercados_chile", "chile_macro",
                     "b2g_chile", "ciberseguridad", "compliance_datos"],

    # ── Inmobiliaria ──────────────────────────────────────────────────────────
    "proptech":     ["macro_base", "tasas_usa", "mercados_chile", "riesgo_macro", "empleo_usa",
                     "bcch_tpm", "propiedad_intelectual", "riesgo_conductual"],
    "inmobiliaria": ["macro_base", "tasas_usa", "mercados_chile", "riesgo_macro", "bcch_tpm"],

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
    "pre_seed": ["riesgo", "riesgo_macro",
                 "trl_crl", "gobernanza_core",
                 "eficiencia_capital",
                 "riesgo_conductual", "propiedad_intelectual"],
    "seed":     ["riesgo", "tasas_usa", "liquidez_global", "riesgo_macro", "bcch_tpm",
                 "unit_economics", "gobernanza_core", "trl_crl",
                 "eficiencia_capital", "retencion_cohortes",
                 "riesgo_conductual", "propiedad_intelectual"],
    "series_a": ["mercados", "riesgo", "liquidez_global", "bcch_tpm",
                 "unit_economics", "moat_estrategia",
                 "retencion_cohortes", "eficiencia_capital", "exit_strategy",
                 "ciberseguridad", "propiedad_intelectual"],
    "growth":   ["mercados", "mercados_latam", "ciclo_industrial",
                 "moat_estrategia",
                 "retencion_cohortes", "exit_strategy",
                 "b2g_chile", "ciberseguridad"],
    "ipo":      ["mercados", "mercados_chile", "mercados_latam", "riesgo_macro",
                 "exit_strategy", "propiedad_intelectual", "ciberseguridad"],
}

# ── Modificadores por geografía ───────────────────────────────────────────────

GEO_MODIFIER: dict[str, list[str]] = {
    "chile":   ["mercados_chile", "forex_chile", "chile_macro", "fundraising_chile",
                "exit_strategy", "b2g_chile", "ciberseguridad"],
    "latam":   ["mercados_latam", "mercados_chile", "forex_global", "gtm_latam", "exit_strategy"],
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
