"""
scripts/apply_sprint6.py
Sprint 6 — Advanced Risk & B2G Nodes: Riesgo Conductual, Propiedad Intelectual,
Ciberseguridad e Infraestructura, Compras Públicas B2G.

Uso:
  py scripts/apply_sprint6.py           # inserta nodos + aristas
  py scripts/apply_sprint6.py --check   # solo cuenta nodos existentes
"""
from __future__ import annotations
import argparse
import sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from src.db.supabase_client import get_client, bulk_insert_nodes


# ── SPRINT 6: RIESGO CONDUCTUAL + IP + CIBERSEGURIDAD + B2G ──────────────────

SPRINT6_NODES: list[dict] = [

    # ── CATEGORÍA: Riesgo Conductual y Sesgos ────────────────────────────────

    {
        "document_title": "Sesgo de Confirmación — Puntos Ciegos del Founder",
        "header_path": "Riesgo Conductual y Sesgos",
        "content": (
            "RED FLAGS: El Sesgo de Confirmación es la tendencia del equipo fundador a filtrar la realidad "
            "para percibir solo los datos que confirman su hipótesis inicial, generando puntos ciegos estratégicos "
            "severos. Señales críticas de alarma: (1) El founder presenta exclusivamente feedback positivo de clientes "
            "sin mencionar objeciones ni rechazos — en el 35% de los fracasos estudiados, la causa raíz fue construir "
            "un producto sin necesidad de mercado ('no market need'), originado por ignorar señales negativas del mercado. "
            "(2) El founder interpreta preguntas de due diligence como ataques en lugar de oportunidades de mejora. "
            "(3) La startup no tiene un proceso documentado de recopilación de feedback adversarial (Mom Test, entrevistas "
            "de cancelación, análisis de churned customers). (4) Las proyecciones financieras asumen solo el escenario "
            "base sin análisis de sensibilidad ante supuestos negativos. "
            "OPORTUNIDADES ESTRATÉGICAS: Un founder que demuestra capacidad de 'buscar activamente la mala noticia' "
            "antes de cualquier decisión estratégica es una señal de madurez ejecutiva. Equipos que practican pre-mortem "
            "analysis y diversidad estructural de perspectivas mitigan este sesgo sistemáticamente. "
            "Protocolo ValidateAI: si el founder no puede describir al menos 3 feedback negativos reales de potenciales "
            "clientes y qué aprendizaje operativo generaron, marcar como riesgo conductual alto."
        ),
        "category": "Riesgo Conductual y Sesgos",
        "tags": ["sesgo_confirmacion", "founder_risk", "behavioral_risk", "puntos_ciegos",
                 "feedback", "mom_test", "cognitive_bias", "due_diligence", "pre_mortem"],
        "metadata": {
            "entity_type": "BEHAVIORAL_RISK",
            "entity_value": "Sesgo de Confirmación",
            "fuente": "rag_08_psychology.md",
            "impacto_fracaso_pct": "35% startups — no market need",
            "protocolo": "solicitar 3 feedback negativos documentados",
            "dimension": "Riesgo Conductual y Sesgos",
            "sprint": 6,
        },
        "embedding": None,
    },

    {
        "document_title": "Sesgo de Optimismo — Sobreestimación de Resultados",
        "header_path": "Riesgo Conductual y Sesgos",
        "content": (
            "RED FLAGS: El Sesgo de Optimismo es la tendencia sistemática a sobreestimar la probabilidad de resultados "
            "positivos y subestimar tiempos de desarrollo, costos operativos y obstáculos de mercado. Señales críticas: "
            "(1) Proyecciones financieras que exhiben hockey-stick sin drivers cuantitativos que los justifiquen — "
            "la triplicación de MRR en 6 meses requiere evidencia histórica, no voluntarismo. "
            "(2) Timelines de desarrollo que no incluyen buffer de al menos 40% sobre la estimación inicial — "
            "el 90% de las startups técnicas subestima cronogramas de producto. "
            "(3) Burn Rate proyectado significativamente menor al histórico sin cambio estructural que lo explique. "
            "(4) Ilusión de Control: el founder asume que puede dominar variables inherentemente impredecibles. "
            "(5) Síndrome de burnout: founders con +80 horas semanales prolongadas pierden capacidad de decisión — "
            "el 5% de startups cierran por agotamiento extremo o pérdida de pasión. "
            "OPORTUNIDADES ESTRATÉGICAS: Founders que presentan escenarios base, optimista y pesimista con "
            "probabilidades asignadas y actualizan modelos ante nueva evidencia demuestran rigor institucional. "
            "Protocolo ValidateAI: comparar cada proyección declarada con el desempeño histórico real de los "
            "últimos 3 meses — la brecha entre proyectado y ejecutado mide directamente el nivel de sesgo."
        ),
        "category": "Riesgo Conductual y Sesgos",
        "tags": ["sesgo_optimismo", "founder_risk", "behavioral_risk", "burn_rate",
                 "proyecciones", "ilusión_control", "burnout", "cognitive_bias", "due_diligence"],
        "metadata": {
            "entity_type": "BEHAVIORAL_RISK",
            "entity_value": "Sesgo de Optimismo",
            "fuente": "rag_08_psychology.md",
            "impacto_fracaso": "subestimación costos y tiempos → Burn Rate real > proyectado",
            "protocolo": "comparar proyección vs ejecución histórica 3 meses",
            "burnout_pct_fracasos": "5%",
            "dimension": "Riesgo Conductual y Sesgos",
            "sprint": 6,
        },
        "embedding": None,
    },

    # ── CATEGORÍA: Propiedad Intelectual ─────────────────────────────────────

    {
        "document_title": "Freedom to Operate (FTO) — Libertad de Operación INAPI",
        "header_path": "Propiedad Intelectual",
        "content": (
            "RED FLAGS: El Freedom to Operate (FTO) determina si una startup puede comercializar su producto "
            "sin infringir derechos de propiedad intelectual existentes. Señales críticas: (1) La startup opera "
            "con marca no registrada que colisiona con registros activos en INAPI — corpus de 503K registros "
            "(marcas + patentes) con estatus: Registrada, En Trámite, Esperando Renovación. Una colisión en la "
            "misma Clase Niza obliga a rebranding estimado entre USD 15K-80K según estado de desarrollo de marca. "
            "(2) Startup con más de 12 meses en mercado sin solicitud de registro en INAPI — ventana crítica "
            "donde competidor puede registrar la marca primero (sistema first-to-file). "
            "(3) Debido diligence de M&A: cualquier adquirente corporativo exige FTO clean antes del cierre — "
            "marca no registrada es bloqueante de M&A. "
            "OPORTUNIDADES ESTRATÉGICAS: INAPI ofrece subsidios vía CORFO de hasta 80% en tarifas de registro. "
            "Clases Niza clave para SaaS B2B: Clase 42 (software/tech), Clase 35 (servicios empresariales), "
            "Clase 38 (telecomunicaciones). Registro temprano protege el moat de marca durante los 12-18 meses "
            "de tramitación. FTO clean incrementa valoración en M&A al eliminar contingencias legales."
        ),
        "category": "Propiedad Intelectual",
        "tags": ["fto", "freedom_to_operate", "inapi", "marca", "patentes", "propiedad_intelectual",
                 "ip", "niza", "colision_marcaria", "ma", "due_diligence", "chile"],
        "metadata": {
            "entity_type": "IP_DEFENSIBILITY",
            "entity_value": "Freedom to Operate",
            "fuente": "INAPI_KNOWLEDGE_VAULT_FASE2.md",
            "corpus_inapi_registros": 503000,
            "clases_niza_saas": ["42", "35", "38"],
            "costo_rebranding_usd": "15K-80K",
            "subsidio_corfo": "hasta 80% tarifas INAPI",
            "sistema_chile": "first-to-file",
            "dimension": "Propiedad Intelectual",
            "sprint": 6,
        },
        "embedding": None,
    },

    {
        "document_title": "Protección de Clases Niza — Registro de Marca Temprano",
        "header_path": "Propiedad Intelectual",
        "content": (
            "RED FLAGS: El sistema de Clasificación de Niza organiza bienes y servicios en 45 clases internacionales. "
            "La protección de marca en Chile es clase-específica: registrar en Clase 42 no protege en Clase 35. "
            "Señales críticas: (1) Startup multi-vertical sin estrategia de registro multi-clase — competidor puede "
            "bloquear expansión a nuevas verticales. (2) Registro solo en Chile sin Madrid Protocol — startups con "
            "tesis LatAm expuestas a conflictos marcarios en México, Colombia, Perú, Brasil. "
            "(3) Nombre de marca descriptivo o genérico — INAPI rechaza sistemáticamente marcas que describen "
            "directamente el bien/servicio. (4) Sin búsqueda de antecedentes en INAPI antes del lanzamiento de marca. "
            "OPORTUNIDADES ESTRATÉGICAS: Portfolio de marcas registradas (nominativa + figurativa + slogans) "
            "aumenta el múltiplo de valoración en M&A. Clases prioritarias por tipo: "
            "Fintech → 36 + 38 + 42; HealthTech → 44 + 42; MarketTech → 35 + 42; AgriTech → 1 + 44. "
            "Proceso INAPI: 12-18 meses desde solicitud — iniciar en el día 1 es la única estrategia "
            "para cerrar M&A limpios sin contingencias de IP."
        ),
        "category": "Propiedad Intelectual",
        "tags": ["niza", "clases_niza", "marca", "inapi", "ip", "propiedad_intelectual",
                 "registro_marca", "madrid_protocol", "latam", "ma", "due_diligence", "fintech", "saas"],
        "metadata": {
            "entity_type": "IP_DEFENSIBILITY",
            "entity_value": "Protección Clases Niza",
            "fuente": "INAPI_KNOWLEDGE_VAULT_FASE2.md",
            "clases_45_totales": 45,
            "plazo_registro_chile_meses": "12-18",
            "protocolo_madrid": "extensión internacional disponible",
            "clases_fintech": ["36", "38", "42"],
            "clases_healthtech": ["44", "42"],
            "clases_saas": ["42", "35"],
            "dimension": "Propiedad Intelectual",
            "sprint": 6,
        },
        "embedding": None,
    },

    # ── CATEGORÍA: Ciberseguridad e Infraestructura ───────────────────────────

    {
        "document_title": "Ley Marco de Ciberseguridad (Ley 21.663)",
        "header_path": "Ciberseguridad e Infraestructura",
        "content": (
            "RED FLAGS: La Ley Marco de Ciberseguridad (Ley 21.663), promulgada el 8 de marzo de 2024 en Chile, "
            "establece obligaciones para Operadores de Servicios Esenciales e Importantes. "
            "Señales críticas para startups B2B/B2G: (1) Proveedor de servicios tecnológicos al Estado sin plan "
            "de respuesta a incidentes documentado — la Ley exige notificación al CSIRT Nacional dentro de 72 horas. "
            "Incumplimiento: multas hasta 10.000 UTM (≈ CLP $682M en 2026). "
            "(2) SaaS B2B que procesa datos en sectores regulados (salud, finanzas, gobierno) sin ISO 27001 — "
            "compradores corporativos lo exigen para contratos > UF 1.000. "
            "(3) Infraestructura sin backups georeplicados ni Business Continuity Plan (BCP). "
            "(4) Doble violación Ley 21.719 + Ley 21.663 = responsabilidad administrativa agravada. "
            "OPORTUNIDADES ESTRATÉGICAS: Cumplimiento temprano = moat competitivo en ventas B2G: "
            "bases de licitación post-2025 exigen acreditación de ciberseguridad como requisito habilitante. "
            "Startup con ISO 27001 puede optar a Convenio Marco de Tecnología (ChileCompra), "
            "canalizando ventas recurrentes al Estado sin proceso licitatorio. "
            "Sectores Operadores Esenciales: energía, agua, transporte, salud, banca, telecomunicaciones, gobierno digital."
        ),
        "category": "Ciberseguridad e Infraestructura",
        "tags": ["ley_21663", "ciberseguridad", "csirt", "b2g", "b2b", "infraestructura",
                 "iso27001", "compliance", "chile", "gobierno", "mercado_publico", "fintech", "saas"],
        "metadata": {
            "entity_type": "CYBERSECURITY_COMPLIANCE",
            "entity_value": "Ley 21.663",
            "promulgacion": "2024-03-08",
            "multa_max_utu": 10000,
            "plazo_notificacion_incidente_horas": 72,
            "sectores_esenciales": ["energia", "agua", "transporte", "salud", "banca", "telecom", "gobierno"],
            "certificacion_recomendada": "ISO 27001",
            "dimension": "Ciberseguridad e Infraestructura",
            "sprint": 6,
        },
        "embedding": None,
    },

    # ── CATEGORÍA: Compras Públicas B2G ──────────────────────────────────────

    {
        "document_title": "Mercado Público y Convenio Marco — Estrategia B2G Chile",
        "header_path": "Compras Públicas B2G",
        "content": (
            "RED FLAGS: El Mercado Público (ChileCompra) maneja más de USD 12B en transacciones anuales. "
            "La Estrategia B2G es un canal de liquidez rápida con riesgos estructurales críticos: "
            "(1) Dependencia fiscal > 60%: más del 60% de ingresos del Estado — cualquier cambio de gobierno "
            "o recorte presupuestario elimina la base de revenue. "
            "(2) Trato Directo > 70% del monto adjudicado: señal de opacidad o proveedor cautivo. "
            "(3) Deuda del Estado > 3 meses de facturación promedio: la startup entregó bienes pero no cobró — "
            "crisis de liquidez activa que el Cash Runway no refleja correctamente. "
            "(4) Win Rate < 5% con Trato Directo > 60%: inconsistencia competitiva — no puede ganar en igualdad. "
            "(5) Concentración > 70% en un organismo comprador: equivalente a cliente único B2B sin contractualidad garantizada. "
            "OPORTUNIDADES ESTRATÉGICAS: Convenio Marco elimina el proceso licitatorio por transacción — "
            "venta recurrente al Estado sin competir cada vez, con pagos garantizados a 30-90 días. "
            "El Estado es el 'pagador seguro' de LatAm: reduce riesgo de incobrables y estabiliza el Cash Runway. "
            "Tickets de tecnología: UF 50-5.000 por contrato — viable desde etapa seed. "
            "Win rate normal Chile: 15-35% por rubro. Diversificación en ≥ 4 sectores estatales reduce riesgo sectorial. "
            "Métricas clave API ChileCompra: M1 (ingresos fiscales 12m), M2 (tendencia interanual %), "
            "M3 (deuda estado pendiente CLP), M4 (% trato directo), M8 (win rate competitivo)."
        ),
        "category": "Compras Públicas B2G",
        "tags": ["b2g", "mercado_publico", "chilecompra", "convenio_marco", "licitacion",
                 "trato_directo", "dependencia_fiscal", "liquidez", "estado", "chile", "win_rate", "due_diligence"],
        "metadata": {
            "entity_type": "B2G_STRATEGY",
            "entity_value": "Mercado Público / Convenio Marco",
            "fuente": "CHILECOMPRA_INTELIGENCIA.md",
            "mercado_anual_usd_b": "12",
            "alerta_dependencia_fiscal_pct": 60,
            "alerta_trato_directo_pct": 70,
            "win_rate_normal_chile_pct": "15-35",
            "metricas_clave": ["M1", "M2", "M3", "M4", "M8"],
            "plazo_pago_dias": "30-90",
            "dimension": "Compras Públicas B2G",
            "sprint": 6,
        },
        "embedding": None,
    },
]


# ── ARISTAS SPRINT 6 ──────────────────────────────────────────────────────────

SPRINT6_EDGES: list[dict] = [
    # Behavioral Risk → Burn Rate / Runway (sesgo optimismo ciega sobre quema de caja)
    {"source_title": "Sesgo de Optimismo — Sobreestimación de Resultados",
     "target_title": "Burn Rate — Quema Mensual vs Crecimiento MRR",
     "relation_type": "BLINDS_FOUNDER_TO"},

    {"source_title": "Sesgo de Optimismo — Sobreestimación de Resultados",
     "target_title": "Cash Runway — Regla VC 18-24 Meses",
     "relation_type": "BLINDS_FOUNDER_TO"},

    {"source_title": "Sesgo de Optimismo — Sobreestimación de Resultados",
     "target_title": "Benchmark Payback < 12 meses",
     "relation_type": "BLINDS_FOUNDER_TO"},

    # Sesgo Confirmación → TRL/CRL (ciega sobre madurez real del producto/mercado)
    {"source_title": "Sesgo de Confirmación — Puntos Ciegos del Founder",
     "target_title": "TRL — Technology Readiness Level",
     "relation_type": "BLINDS_FOUNDER_TO"},

    {"source_title": "Sesgo de Confirmación — Puntos Ciegos del Founder",
     "target_title": "CRL — Commercial Readiness Level",
     "relation_type": "BLINDS_FOUNDER_TO"},

    # Sesgo Optimismo → NRR (infla retención proyectada sin cohortes reales)
    {"source_title": "Sesgo de Optimismo — Sobreestimación de Resultados",
     "target_title": "Net Revenue Retention (NRR)",
     "relation_type": "BLINDS_FOUNDER_TO"},

    # Sesgos se amplifican mutuamente
    {"source_title": "Sesgo de Confirmación — Puntos Ciegos del Founder",
     "target_title": "Sesgo de Optimismo — Sobreestimación de Resultados",
     "relation_type": "AMPLIFIES"},

    # IP → M&A (FTO limpio prerequisito para M&A sin contingencias)
    {"source_title": "Freedom to Operate (FTO) — Libertad de Operación INAPI",
     "target_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "relation_type": "PROTECTS_AGAINST"},

    {"source_title": "Protección de Clases Niza — Registro de Marca Temprano",
     "target_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "relation_type": "PROTECTS_AGAINST"},

    # IP → Ley 21.719 (datos y software IP van de la mano)
    {"source_title": "Freedom to Operate (FTO) — Libertad de Operación INAPI",
     "target_title": "Ley 21.719 — Estándar GDPR Chile",
     "relation_type": "REQUIRES_COMPLIANCE_WITH"},

    # IP par interno
    {"source_title": "Freedom to Operate (FTO) — Libertad de Operación INAPI",
     "target_title": "Protección de Clases Niza — Registro de Marca Temprano",
     "relation_type": "REQUIRES"},

    # Ciberseguridad UNLOCKS B2G (compliance = prerequisito licitatorio)
    {"source_title": "Ley Marco de Ciberseguridad (Ley 21.663)",
     "target_title": "Mercado Público y Convenio Marco — Estrategia B2G Chile",
     "relation_type": "UNLOCKS_CHANNEL"},

    # Ciberseguridad → Ley 21.719 (doble compliance obligatorio)
    {"source_title": "Ley Marco de Ciberseguridad (Ley 21.663)",
     "target_title": "Ley 21.719 — Gestión de Consentimiento",
     "relation_type": "REQUIRES_COMPLIANCE_WITH"},

    # Ciberseguridad protege M&A (compliance exigido por compradores corporativos)
    {"source_title": "Ley Marco de Ciberseguridad (Ley 21.663)",
     "target_title": "M&A Estratégico — Compradores Corporativos LatAm",
     "relation_type": "PROTECTS_AGAINST"},

    # B2G REDUCES riesgo Cash Runway (Estado = pagador seguro aunque lento)
    {"source_title": "Mercado Público y Convenio Marco — Estrategia B2G Chile",
     "target_title": "Cash Runway — Regla VC 18-24 Meses",
     "relation_type": "REDUCES_RISK_OF"},

    # B2G → Corfo Expande (track record B2G califica)
    {"source_title": "Mercado Público y Convenio Marco — Estrategia B2G Chile",
     "target_title": "Corfo Semilla Expande — Requisitos de Postulación",
     "relation_type": "QUALIFIES_FOR"},

    # B2G requiere compliance ciberseguridad
    {"source_title": "Mercado Público y Convenio Marco — Estrategia B2G Chile",
     "target_title": "Ley Marco de Ciberseguridad (Ley 21.663)",
     "relation_type": "REQUIRES_COMPLIANCE_WITH"},

    # B2G requiere compliance datos personales
    {"source_title": "Mercado Público y Convenio Marco — Estrategia B2G Chile",
     "target_title": "Ley 21.719 — Gestión de Consentimiento",
     "relation_type": "REQUIRES_COMPLIANCE_WITH"},

    # B2G → NRR (contratos Estado generan retención predecible si el organismo renueva)
    {"source_title": "Mercado Público y Convenio Marco — Estrategia B2G Chile",
     "target_title": "Net Revenue Retention (NRR)",
     "relation_type": "MEASURES_SUCCESS_OF"},

    # B2G requiere FTO limpio para licitaciones
    {"source_title": "Mercado Público y Convenio Marco — Estrategia B2G Chile",
     "target_title": "Freedom to Operate (FTO) — Libertad de Operación INAPI",
     "relation_type": "REQUIRES"},

    # Sesgo Confirmación ciega sobre riesgos B2G reales
    {"source_title": "Sesgo de Confirmación — Puntos Ciegos del Founder",
     "target_title": "Mercado Público y Convenio Marco — Estrategia B2G Chile",
     "relation_type": "BLINDS_FOUNDER_TO"},

    # IP defensible + infraestructura segura sostienen LTV
    {"source_title": "Freedom to Operate (FTO) — Libertad de Operación INAPI",
     "target_title": "LTV — Lifetime Value del Cliente",
     "relation_type": "PROTECTS_AGAINST"},
]


SPRINT6_CATEGORIES = [
    "Riesgo Conductual y Sesgos",
    "Propiedad Intelectual",
    "Ciberseguridad e Infraestructura",
    "Compras Públicas B2G",
]


def check(client) -> None:
    result = (
        client.table("knowledge_nodes")
        .select("id, document_title, category, embedding")
        .in_("category", SPRINT6_CATEGORIES)
        .execute()
    )
    rows = result.data
    total = len(rows)
    with_emb = sum(1 for r in rows if r.get("embedding") is not None)
    print(f"\n  Nodos Sprint 6 en DB: {total}/{len(SPRINT6_NODES)}")
    print(f"  Con embedding:        {with_emb}/{total}")
    cats_found = set(r["category"] for r in rows)
    print(f"  Categorías presentes: {cats_found}")
    if total > 0:
        missing = [n["document_title"] for n in SPRINT6_NODES
                   if not any(r["document_title"] == n["document_title"] for r in rows)]
        if missing:
            print(f"\n  Faltantes ({len(missing)}):")
            for m in missing:
                print(f"    - {m}")
        else:
            print("\n  Todos los nodos Sprint 6 presentes.")


def apply(client) -> None:
    print(f"\n  Insertando {len(SPRINT6_NODES)} nodos Sprint 6...")
    n_inserted = bulk_insert_nodes(client, SPRINT6_NODES)
    print(f"  OK: {n_inserted} nodos upserted")

    print(f"\n  Insertando {len(SPRINT6_EDGES)} aristas Sprint 6...")
    result = (
        client.table("knowledge_edges")
        .upsert(SPRINT6_EDGES, on_conflict="source_title,target_title,relation_type")
        .execute()
    )
    print(f"  OK: {len(result.data)} aristas upserted")
    print(f"\n  Sprint 6 aplicado. Ejecuta ahora:")
    print("    py scripts/vectorize_pending.py --familia-a")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Aplica nodos/aristas Sprint 6 (Advanced Risk & B2G) a Supabase"
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
