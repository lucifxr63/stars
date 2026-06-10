"""
scripts/apply_sprint5.py
Sprint 5 — VC-Grade Nodes: Retención y Cohortes, Eficiencia de Capital,
Estrategia de Salida.

Uso:
  py scripts/apply_sprint5.py           # inserta nodos + aristas
  py scripts/apply_sprint5.py --check   # solo cuenta nodos existentes
"""
from __future__ import annotations
import argparse
import sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from src.db.supabase_client import get_client, bulk_insert_nodes


# ── SPRINT 5: RETENCIÓN + EFICIENCIA DE CAPITAL + ESTRATEGIA DE SALIDA ────────

SPRINT5_NODES: list[dict] = [

    # ── CATEGORÍA: Retención y Cohortes ──────────────────────────────────────

    {
        "document_title": "Net Revenue Retention (NRR)",
        "header_path": "Retención y Cohortes",
        "content": (
            "Net Revenue Retention (NRR), también llamado Net Dollar Retention (NDR), mide el porcentaje "
            "de ingresos retenidos de una cohorte de clientes existentes tras un período (generalmente 12 meses), "
            "incluyendo expansión (upgrades, upsell, cross-sell), contracción (downgrades) y churn. "
            "Fórmula: NRR = (MRR inicio de período + Expansión MRR - Contracción MRR - Churn MRR) / MRR inicio de período × 100. "
            "Benchmarks VC: NRR < 90% = modelo con fuga estructural, no invertible; NRR 90–100% = aceptable pero sin crecimiento orgánico por expansión; "
            "NRR > 100% = el negocio crece aunque no adquiera ni un cliente nuevo — la base existente expande (regla de oro SaaS B2B); "
            "NRR > 120% = clase mundial, tier Snowflake/Datadog, múltiplo de valoración premium. "
            "Protocolo adversarial ValidateAI: si la startup declara NRR > 100% sin cohortes reales de al menos 6 meses, "
            "el NRR es una proyección optimista, no un hecho — rechazar como evidencia hasta verificación. "
            "Impacto en valoración: cada punto porcentual de NRR por encima de 100% añade entre 0.3–0.5x al múltiplo ARR en rondas Series A+. "
            "Un NRR de 130% vs 100% puede duplicar la valoración con el mismo ARR."
        ),
        "category": "Retención y Cohortes",
        "tags": ["nrr", "net_revenue_retention", "retencion", "expansion", "churn", "saas", "b2b", "cohorts", "valoracion", "vc_diligence"],
        "metadata": {
            "entity_type": "RETENTION_METRIC",
            "entity_value": "NRR",
            "formula": "(MRR + Expansión - Contracción - Churn) / MRR inicial × 100",
            "benchmark_oro": "> 100%",
            "benchmark_clase_mundial": "> 120%",
            "impacto_valoracion": "0.3-0.5x ARR por punto pct sobre 100%",
            "dimension": "Retención y Cohortes",
            "sprint": 5,
        },
        "embedding": None,
    },

    {
        "document_title": "Gross Churn Rate — Efecto Cubeta Agujereada",
        "header_path": "Retención y Cohortes",
        "content": (
            "El Gross Churn Rate mide el porcentaje de ingresos o clientes perdidos en un período sin considerar expansión. "
            "Fórmula MRR: Gross Churn = MRR perdido por cancelaciones / MRR inicio de período × 100. "
            "El 'efecto cubeta agujereada' describe el fenómeno donde una startup vierte clientes nuevos "
            "(costosos de adquirir) por un balde que tiene fuga en la base: si el churn mensual es 5%, "
            "en 12 meses la empresa pierde el 46% de su base original (1 - 0.95^12). "
            "Benchmarks por segmento: SMB SaaS churn mensual aceptable ≤ 3% (≈ 30% anual); "
            "Mid-Market ≤ 1.5% mensual (≈ 16% anual); Enterprise ≤ 0.5% mensual (≈ 6% anual). "
            "Alarma de insolvencia: si el Gross Churn mensual supera el 5%, el CAC pagado se destruye "
            "antes de recuperarse — el Payback Period efectivo se vuelve infinito. "
            "Protocolo adversarial: el churn auto-reportado por founders en early-stage tiende a subestimarse "
            "por selección de muestra (solo cuentan clientes 'reales', no trials o clientes inactivos). "
            "Solicitar exportación de Stripe/Fintoc/Mercado Pago con MRR por cliente por mes antes de aceptar "
            "cifras de churn como válidas. Un Gross Churn mensual > 3% invalida el LTV declarado y requiere "
            "recalcular todas las proyecciones de unit economics desde cero."
        ),
        "category": "Retención y Cohortes",
        "tags": ["churn", "gross_churn", "retencion", "cubeta_agujereada", "unit_economics", "ltv", "saas", "smb", "due_diligence", "cohorts"],
        "metadata": {
            "entity_type": "RETENTION_METRIC",
            "entity_value": "Gross Churn Rate",
            "formula": "MRR cancelado / MRR inicio × 100",
            "benchmark_smb_mensual_max": "3%",
            "benchmark_midmarket_mensual_max": "1.5%",
            "benchmark_enterprise_mensual_max": "0.5%",
            "alerta_critica_mensual": "> 5%",
            "dimension": "Retención y Cohortes",
            "sprint": 5,
        },
        "embedding": None,
    },

    # ── CATEGORÍA: Eficiencia de Capital ─────────────────────────────────────

    {
        "document_title": "Cash Runway — Regla VC 18-24 Meses",
        "header_path": "Eficiencia de Capital",
        "content": (
            "El Cash Runway es el número de meses que la empresa puede operar con el efectivo disponible "
            "al ritmo de quema actual antes de quedarse sin dinero. "
            "Fórmula: Runway (meses) = Caja Total Disponible / Burn Rate Neto Mensual. "
            "Regla VC universal: toda ronda de financiamiento debe garantizar un mínimo de 18 a 24 meses "
            "de runway — por debajo de 18 meses, la startup entra en modo de supervivencia, "
            "las negociaciones de rondas futuras se hacen en posición de debilidad extrema, "
            "y el fundador se ve forzado a aceptar términos desfavorables (down rounds, dilución agresiva, ratchets). "
            "Protocolo de alarma ValidateAI: si la startup proyecta levantar USD 500K con un Burn Rate "
            "mensual de USD 50K, el Runway resultante es 10 meses — ALERTA DE INSOLVENCIA INMINENTE. "
            "Con 10 meses de runway, la startup debe iniciar el siguiente fundraising en el mes 4–5 para "
            "tener opciones reales de cerrar en el mes 8–10. A partir del mes 6 sin nueva ronda visible, "
            "la probabilidad de cierre involuntario supera el 70%. "
            "Regla de oro del timing VC: siempre levantar la próxima ronda cuando quedan 9–12 meses de runway, "
            "nunca menos. Cada mes de runway adicional vale más que cualquier mejora en métricas en ese período."
        ),
        "category": "Eficiencia de Capital",
        "tags": ["runway", "cash_runway", "eficiencia_capital", "burn_rate", "fundraising", "insolvencia", "vc", "seed", "down_round", "due_diligence"],
        "metadata": {
            "entity_type": "CAPITAL_EFFICIENCY",
            "entity_value": "Cash Runway",
            "formula": "Caja Disponible / Burn Rate Neto Mensual",
            "minimo_vc_meses": 18,
            "optimo_vc_meses": 24,
            "alerta_critica_meses": 10,
            "timing_siguiente_ronda_meses_antes_de_0": 9,
            "dimension": "Eficiencia de Capital",
            "sprint": 5,
        },
        "embedding": None,
    },

    {
        "document_title": "Burn Rate — Quema Mensual vs Crecimiento MRR",
        "header_path": "Eficiencia de Capital",
        "content": (
            "El Burn Rate es la quema neta de caja mensual: la diferencia entre los egresos totales "
            "y los ingresos totales del período. Burn Neto = Egresos Totales - Ingresos Totales. "
            "La métrica que combina Burn Rate y MRR para evaluar eficiencia de capital es el Burn Multiple: "
            "Burn Multiple = Burn Neto / Net New ARR. "
            "Benchmarks Burn Multiple (Bessemer Venture Partners): < 1x = excelente; 1–1.5x = bueno; "
            "1.5–2x = aceptable; 2–3x = preocupante; > 3x = capital-ineficiente, no invertible. "
            "Un Burn Rate que crece más rápido que el MRR es la señal más temprana de un modelo de negocio "
            "que pierde eficiencia de escala — lo opuesto de lo que los VCs buscan. "
            "Análisis adversarial crítico: desagregar el Burn en categorías (nómina, infraestructura, marketing, G&A) "
            "para identificar qué categoría genera el burn sin traducirse en crecimiento. "
            "Señal de alarma en fintech/SaaS Chile: nómina > 70% del burn sin evidencia de hiring plan "
            "vinculado a hitos de revenue — indica riesgo de burn sin retorno medible. "
            "Regla del Triángulo de Hierro VC: Burn Rate × Payback Period × Churn Rate = "
            "indicador compuesto de sostenibilidad del modelo. Si los tres son altos simultáneamente, "
            "el modelo no es viable sin financiamiento perpetuo."
        ),
        "category": "Eficiencia de Capital",
        "tags": ["burn_rate", "burn_multiple", "eficiencia_capital", "mrr", "runway", "saas", "vc", "nómina", "due_diligence", "sostenibilidad"],
        "metadata": {
            "entity_type": "CAPITAL_EFFICIENCY",
            "entity_value": "Burn Rate",
            "formula_burn_neto": "Egresos Totales - Ingresos Totales",
            "formula_burn_multiple": "Burn Neto / Net New ARR",
            "benchmark_burn_multiple_excelente": "< 1x",
            "benchmark_burn_multiple_critico": "> 3x",
            "alerta_nómina_porcentaje_max": "70%",
            "fuente_benchmark": "Bessemer Venture Partners",
            "dimension": "Eficiencia de Capital",
            "sprint": 5,
        },
        "embedding": None,
    },

    # ── CATEGORÍA: Estrategia de Salida ──────────────────────────────────────

    {
        "document_title": "M&A Estratégico — Compradores Corporativos LatAm",
        "header_path": "Estrategia de Salida",
        "content": (
            "La Estrategia de Salida (Exit Strategy) más probable para startups LatAm Seed/Series A "
            "es el M&A Estratégico: adquisición por parte de un corporativo que valora el producto, "
            "la tecnología, el equipo o la base de clientes como activo estratégico. "
            "La IPO en mercados latinoamericanos es prácticamente inviable en etapas tempranas: "
            "el mercado de capitales chileno (Santiago Stock Exchange) tiene liquidez insuficiente para tecnología, "
            "y listar en NYSE/NASDAQ requiere ARR > USD 100M sostenido — 95% de las startups nunca llegan. "
            "Compradores corporativos estratégicos en LatAm por vertical: "
            "Fintech → Bancos (BCI, Santander Chile, Banco Estado), retailers financieros (Falabella, CMR, Cencosud), "
            "Telcos (Entel, Movistar — billeteras digitales); "
            "SaaS B2B → grupos empresariales diversificados (Sigdo Koppers, SAAM, Arauco digitización); "
            "HealthTech → ISAPRES, clínicas privadas (Red Salud, Alemana), laboratorios; "
            "AgriTech → exportadoras de fruta, viñas, retailers agrícolas. "
            "Valoración M&A estratégico vs. financiero: el comprador estratégico paga una prima de control "
            "(20–40% sobre valoración financiera) si la startup tiene un moat que el comprador no puede replicar internamente. "
            "Due diligence M&A: los compradores corporativos LatAm realizan due diligence legal en Ley 21.719, "
            "Ley 21.521 y propiedad intelectual antes de cualquier acuerdo vinculante — "
            "una startup sin compliance en estas leyes no puede cerrar un M&A en Chile sin rectificación previa. "
            "Señal de preparación para exit: el founder puede nombrar 3 o más compradores corporativos específicos "
            "que se beneficiarían de adquirir la empresa y por qué — sin esto, el 'exit strategy' es marketing, no plan."
        ),
        "category": "Estrategia de Salida",
        "tags": ["ma", "exit", "salida", "corporativos", "latam", "chile", "bancos", "ipo", "valoracion", "due_diligence", "moat", "adquisicion"],
        "metadata": {
            "entity_type": "LIQUIDITY_EVENT",
            "entity_value": "M&A Estratégico",
            "ipo_viabilidad_latam_early": "prácticamente inviable < ARR USD 100M",
            "prima_control_ma_estrategico": "20-40% sobre valoración financiera",
            "compradores_fintech": ["BCI", "Santander Chile", "Banco Estado", "Falabella", "Cencosud"],
            "compradores_saas": ["grupos diversificados Chile", "SAAM", "Arauco"],
            "bloqueador_ma": "incumplimiento Ley 21.719 / Ley 21.521 impide cierre legal",
            "dimension": "Estrategia de Salida",
            "sprint": 5,
        },
        "embedding": None,
    },
]


# ── ARISTAS SPRINT 5 ──────────────────────────────────────────────────────────

SPRINT5_EDGES: list[dict] = [
    # Retención → Unit Economics (cross-sprint crítico)
    {"source_title": "Net Revenue Retention (NRR)",
     "target_title": "LTV — Lifetime Value del Cliente",
     "relation_type": "MULTIPLY_VALUATION_OF"},

    {"source_title": "Net Revenue Retention (NRR)",
     "target_title": "Benchmark LTV:CAC > 3:1",
     "relation_type": "MULTIPLY_VALUATION_OF"},

    {"source_title": "Gross Churn Rate — Efecto Cubeta Agujereada",
     "target_title": "LTV — Lifetime Value del Cliente",
     "relation_type": "INVALIDATES"},

    {"source_title": "Gross Churn Rate — Efecto Cubeta Agujereada",
     "target_title": "Benchmark LTV:CAC > 3:1",
     "relation_type": "INVALIDATES"},

    {"source_title": "Gross Churn Rate — Efecto Cubeta Agujereada",
     "target_title": "Benchmark Payback < 12 meses",
     "relation_type": "INVALIDATES"},

    {"source_title": "Gross Churn Rate — Efecto Cubeta Agujereada",
     "target_title": "Net Revenue Retention (NRR)",
     "relation_type": "DEPLETES_RUNWAY"},

    # Eficiencia de Capital → Runway
    {"source_title": "Burn Rate — Quema Mensual vs Crecimiento MRR",
     "target_title": "Cash Runway — Regla VC 18-24 Meses",
     "relation_type": "DEPLETES_RUNWAY"},

    {"source_title": "Cash Runway — Regla VC 18-24 Meses",
     "target_title": "Burn Rate — Quema Mensual vs Crecimiento MRR",
     "relation_type": "REQUIRES"},

    {"source_title": "Gross Churn Rate — Efecto Cubeta Agujereada",
     "target_title": "Cash Runway — Regla VC 18-24 Meses",
     "relation_type": "DEPLETES_RUNWAY"},

    # Eficiencia de Capital → Unit Economics cross-sprint
    {"source_title": "Burn Rate — Quema Mensual vs Crecimiento MRR",
     "target_title": "CAC — Costo de Adquisición de Cliente",
     "relation_type": "REQUIRES"},

    {"source_title": "Burn Rate — Quema Mensual vs Crecimiento MRR",
     "target_title": "Payback Period — Periodo de Recuperación CAC",
     "relation_type": "REQUIRES"},

    {"source_title": "Cash Runway — Regla VC 18-24 Meses",
     "target_title": "Corfo Semilla Inicia — Requisitos de Postulación",
     "relation_type": "QUALIFIES_FOR"},

    {"source_title": "Cash Runway — Regla VC 18-24 Meses",
     "target_title": "Corfo Semilla Expande — Requisitos de Postulación",
     "relation_type": "QUALIFIES_FOR"},

    # Estrategia de Salida → Moat (REQUIRES_PROOF_OF)
    {"source_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "target_title": "Network Effects — Efecto de Red",
     "relation_type": "REQUIRES_PROOF_OF"},

    {"source_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "target_title": "Blue Ocean Strategy — Value Innovation",
     "relation_type": "REQUIRES_PROOF_OF"},

    {"source_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "target_title": "Net Revenue Retention (NRR)",
     "relation_type": "REQUIRES_PROOF_OF"},

    {"source_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "target_title": "Gross Churn Rate — Efecto Cubeta Agujereada",
     "relation_type": "REQUIRES_PROOF_OF"},

    # M&A bloqueado por compliance (cross-sprint Sprint 2)
    {"source_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "target_title": "Ley 21.719 — Estándar GDPR Chile",
     "relation_type": "REQUIRES_COMPLIANCE_WITH"},

    {"source_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "target_title": "Ley Fintech 21.521 — Registro CMF de Prestadores",
     "relation_type": "REQUIRES_COMPLIANCE_WITH"},

    {"source_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "target_title": "Estructura SpA (Sociedad por Acciones)",
     "relation_type": "REQUIRES_COMPLIANCE_WITH"},

    {"source_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "target_title": "Drag-along — Derecho de Arrastre",
     "relation_type": "REQUIRES_COMPLIANCE_WITH"},

    # NRR → Retención + Gobernanza cross
    {"source_title": "Net Revenue Retention (NRR)",
     "target_title": "Vesting y Cliff — Retención de Fundadores",
     "relation_type": "MEASURES_SUCCESS_OF"},

    {"source_title": "Cash Runway — Regla VC 18-24 Meses",
     "target_title": "Vesting y Cliff — Retención de Fundadores",
     "relation_type": "MITIGATES_RISK_OF"},
]


SPRINT5_CATEGORIES = ["Retención y Cohortes", "Eficiencia de Capital", "Estrategia de Salida"]


def check(client) -> None:
    result = (
        client.table("knowledge_nodes")
        .select("id, document_title, category, embedding")
        .in_("category", SPRINT5_CATEGORIES)
        .execute()
    )
    rows = result.data
    total = len(rows)
    with_emb = sum(1 for r in rows if r.get("embedding") is not None)
    print(f"\n  Nodos Sprint 5 en DB: {total}/{len(SPRINT5_NODES)}")
    print(f"  Con embedding:        {with_emb}/{total}")
    cats_found = set(r["category"] for r in rows)
    print(f"  Categorías presentes: {cats_found}")
    if total > 0:
        missing = [n["document_title"] for n in SPRINT5_NODES
                   if not any(r["document_title"] == n["document_title"] for r in rows)]
        if missing:
            print(f"\n  Faltantes ({len(missing)}):")
            for m in missing:
                print(f"    - {m}")
        else:
            print("\n  Todos los nodos Sprint 5 presentes.")


def apply(client) -> None:
    print(f"\n  Insertando {len(SPRINT5_NODES)} nodos Sprint 5...")
    n_inserted = bulk_insert_nodes(client, SPRINT5_NODES)
    print(f"  OK: {n_inserted} nodos upserted")

    print(f"\n  Insertando {len(SPRINT5_EDGES)} aristas Sprint 5...")
    result = (
        client.table("knowledge_edges")
        .upsert(SPRINT5_EDGES, on_conflict="source_title,target_title,relation_type")
        .execute()
    )
    print(f"  OK: {len(result.data)} aristas upserted")
    print(f"\n  Sprint 5 aplicado. Ejecuta ahora:")
    print("    py scripts/vectorize_pending.py --familia-a")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Aplica nodos/aristas Sprint 5 (VC-Grade) a Supabase"
    )
    parser.add_argument("--check", action="store_true", help="Solo verifica estado, no inserta")
    args = parser.parse_args()

    client = get_client()
    if args.check:
        check(client)
    else:
        check(client)
        print()
        apply(client)
