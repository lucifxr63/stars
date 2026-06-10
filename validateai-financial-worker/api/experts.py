"""
experts.py — Definición de los 5 Expertos del sistema MoE.

Cada Expert encapsula un dominio semántico del knowledge graph.
Los grupos (`group_ids`) mapean a keys de entity_router.ENTITY_GROUPS,
por lo que no se duplica ningún nodo — solo se crean vistas lógicas
sobre los mismos datos en Supabase.

Dominios:
  macro           → Macroeconomía global + Chile
  mercados        → Índices, commodities, forex, volatilidad
  unit_economics  → CAC, LTV, NRR, burn, runway, M&A
  legal           → Compliance regulatorio + gobernanza corporativa
  estrategia      → GTM, moat, TRL/CRL, Corfo, sesgos fundadores
"""
from __future__ import annotations
from dataclasses import dataclass, field
from api.entity_router import ENTITY_GROUPS


@dataclass
class Expert:
    id: str
    name: str
    description: str        # Usado para routing semántico (coseno vs embedding de query)
    group_ids: list[str]    # Keys de entity_router.ENTITY_GROUPS
    keywords: list[str]     # Routing rápido por substring (lowercase)
    match_threshold: float = 0.40
    top_k: int = 6

    @property
    def entity_titles(self) -> list[str]:
        """Expande group_ids → document_titles únicos (preserva orden de grupos)."""
        seen: set[str] = set()
        result: list[str] = []
        for gid in self.group_ids:
            for title in ENTITY_GROUPS.get(gid, []):
                if title not in seen:
                    seen.add(title)
                    result.append(title)
        return result


EXPERTS: dict[str, Expert] = {
    "macro": Expert(
        id="macro",
        name="Experto Macroeconómico",
        description=(
            "Indicadores macroeconómicos globales y Chile: PIB, inflación CPI, "
            "tasa de interés Fed, desempleo, M2 money supply, spread curva 10Y-2Y, "
            "producción industrial, IED Chile, PIB per cápita"
        ),
        group_ids=[
            "macro_base",
            "empleo_usa",
            "liquidez_global",
            "riesgo_macro",
            "ciclo_industrial",
            "forex_global",
            "chile_macro",
        ],
        keywords=[
            "pib", "gdp", "inflación", "inflacion", "cpi", "tasa", "fed",
            "macro", "economía", "economia", "recesión", "recesion",
            "m2", "desempleo", "producción", "produccion", "spread",
            "curva", "ied", "inversión extranjera", "inversion extranjera",
            "bank", "bcch", "banco central",
        ],
        match_threshold=0.38,
        top_k=8,
    ),

    "mercados": Expert(
        id="mercados",
        name="Experto en Mercados Financieros",
        description=(
            "Mercados de capitales, índices bursátiles, commodities, forex, "
            "volatilidad VIX, tasas del tesoro USA, IPSA Chile, S&P 500, "
            "NASDAQ, cobre, litio, oro, petróleo WTI, ETF LATAM"
        ),
        group_ids=[
            "mercados",
            "mercados_chile",
            "mercados_latam",
            "commodities",
            "forex_chile",
            "tasas_usa",
            "riesgo",
        ],
        keywords=[
            "s&p", "nasdaq", "ipsa", "bolsa", "mercado", "índice", "indice",
            "cobre", "litio", "oro", "petróleo", "petroleo", "wti",
            "vix", "volatilidad", "dólar", "dolar", "clp", "forex",
            "etf", "yield", "bono", "tesoro", "treasury",
            "albemarle", "msci", "latam 40", "iShares",
        ],
        match_threshold=0.42,
        top_k=6,
    ),

    "unit_economics": Expert(
        id="unit_economics",
        name="Experto en Unit Economics",
        description=(
            "Métricas financieras SaaS y VC due diligence: CAC costo adquisición, "
            "LTV lifetime value, NRR net revenue retention, gross churn, "
            "burn rate, cash runway, payback period, M&A estratégico"
        ),
        group_ids=[
            "unit_economics",
            "retencion_cohortes",
            "eficiencia_capital",
            "exit_strategy",
        ],
        keywords=[
            "cac", "ltv", "nrr", "churn", "burn", "runway", "payback",
            "retención", "retencion", "cohorte", "cohort",
            "mrr", "arr", "revenue", "ingreso",
            "m&a", "adquisición", "adquisicion", "fusión", "fusion",
            "capital eficiencia", "quema", "caja", "runway",
            "lifetime value", "adquisicion de cliente",
        ],
        match_threshold=0.35,
        top_k=5,
    ),

    "legal": Expert(
        id="legal",
        name="Experto Legal y Regulatorio",
        description=(
            "Compliance regulatorio Chile: Ley Fintech 21.521 registro CMF, "
            "Ley Datos 21.719 consentimiento GDPR, Ley Ciberseguridad 21.663, "
            "gobernanza SpA vesting cliff, INAPI marcas FTO, B2G Mercado Público"
        ),
        group_ids=[
            "compliance_fintech",
            "compliance_datos",
            "gobernanza_core",
            "ciberseguridad",
            "propiedad_intelectual",
            "b2g_chile",
        ],
        keywords=[
            "ley", "cmf", "gdpr", "spa", "s.p.a.", "vesting", "cliff",
            "inapi", "marca", "patente", "fto", "libertad de operación",
            "ciberseguridad", "mercado público", "mercado publico",
            "convenio marco", "consentimiento", "datos personales",
            "regulatorio", "regulación", "regulacion",
            "21.521", "21.719", "21.663",
            "registro", "fiscalización", "fiscalizacion",
            "finanzas abiertas", "sfa", "open banking",
            "propiedad intelectual", "clase niza",
        ],
        match_threshold=0.33,
        top_k=6,
    ),

    "estrategia": Expert(
        id="estrategia",
        name="Experto en Estrategia y GTM",
        description=(
            "Estrategia competitiva y go-to-market: moat network effects, "
            "blue ocean value innovation, GTM LatAm WhatsApp-first, "
            "TRL CRL madurez tecnológica comercial, Corfo Semilla, "
            "sesgos fundadores confirmación optimismo"
        ),
        group_ids=[
            "moat_estrategia",
            "gtm_latam",
            "trl_crl",
            "fundraising_chile",
            "riesgo_conductual",
        ],
        keywords=[
            "moat", "network effect", "efecto de red", "blue ocean",
            "gtm", "go-to-market", "corfo", "trl", "crl",
            "madurez tecnológica", "madurez tecnologica",
            "sesgo", "sesgo de confirmación", "sesgo de confirmacion",
            "optimismo", "whatsapp", "tracción", "traccion",
            "semilla inicia", "semilla expande", "postulación", "postulacion",
            "fondos", "aceleración", "aceleracion",
            "innovación", "innovacion", "diferenciación", "diferenciacion",
        ],
        match_threshold=0.38,
        top_k=5,
    ),
}
