-- ============================================================
-- Sprint 5 — VC-Grade Knowledge Graph Nodes
-- Categorías: Retención y Cohortes, Eficiencia de Capital,
--             Estrategia de Salida
-- Nodos: 5 | Aristas: 23 | Embeddings: NULL (vectorización asíncrona)
-- Aplicado vía: scripts/apply_sprint5.py
-- ============================================================

DO $$
DECLARE
  v_nrr_id           uuid;
  v_churn_id         uuid;
  v_runway_id        uuid;
  v_burn_id          uuid;
  v_ma_id            uuid;
  -- IDs nodos existentes (Sprint 1-3)
  v_ltv_id           uuid;
  v_cac_id           uuid;
  v_payback_id       uuid;
  v_ltv_cac_id       uuid;
  v_payback12_id     uuid;
  v_network_id       uuid;
  v_blue_ocean_id    uuid;
  v_corfo_inicia_id  uuid;
  v_corfo_expande_id uuid;
  v_vesting_id       uuid;
  v_spa_id           uuid;
  v_drag_id          uuid;
  v_ley719_id        uuid;
  v_ley721_id        uuid;
BEGIN

-- ── NODOS SPRINT 5 ────────────────────────────────────────────────────────────

INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Net Revenue Retention (NRR)',
  'Retención y Cohortes',
  'Net Revenue Retention (NRR), también llamado Net Dollar Retention (NDR), mide el porcentaje '
  'de ingresos retenidos de una cohorte de clientes existentes tras 12 meses, incluyendo expansión '
  '(upgrades, upsell), contracción (downgrades) y churn. Fórmula: NRR = (MRR inicio + Expansión - '
  'Contracción - Churn) / MRR inicio × 100. Benchmarks VC: NRR < 90% = modelo con fuga estructural; '
  'NRR 90–100% = aceptable sin crecimiento orgánico; NRR > 100% = regla de oro SaaS B2B — crece sin '
  'adquirir clientes nuevos; NRR > 120% = clase mundial (Snowflake/Datadog), múltiplo premium. '
  'Protocolo adversarial: NRR declarado > 100% sin cohortes reales de al menos 6 meses = proyección '
  'optimista, no hecho verificable. Cada punto pct de NRR sobre 100% añade 0.3–0.5x al múltiplo ARR.',
  'Retención y Cohortes',
  ARRAY['nrr','net_revenue_retention','retencion','expansion','churn','saas','b2b','cohorts','valoracion','vc_diligence'],
  '{"entity_type":"RETENTION_METRIC","entity_value":"NRR","formula":"(MRR + Expansión - Contracción - Churn) / MRR inicial × 100","benchmark_oro":"> 100%","benchmark_clase_mundial":"> 120%","impacto_valoracion":"0.3-0.5x ARR por punto pct sobre 100%","dimension":"Retención y Cohortes","sprint":5}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_nrr_id;

INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Gross Churn Rate — Efecto Cubeta Agujereada',
  'Retención y Cohortes',
  'Gross Churn Rate = MRR perdido por cancelaciones / MRR inicio × 100. El efecto cubeta agujereada: '
  'con 5% churn mensual, en 12 meses se pierde 46% de la base original (1-0.95^12). Benchmarks: '
  'SMB ≤ 3% mensual; Mid-Market ≤ 1.5%; Enterprise ≤ 0.5%. ALARMA CRÍTICA: churn > 5% mensual '
  'destruye el CAC antes de recuperarse — Payback Period efectivo se vuelve infinito. '
  'Protocolo adversarial: exigir exportación de Stripe/Fintoc por cliente/mes para verificar '
  'churn real — el auto-reportado subestima sistemáticamente. Churn mensual > 3% invalida el LTV '
  'declarado y requiere recalcular todos los unit economics desde cero.',
  'Retención y Cohortes',
  ARRAY['churn','gross_churn','retencion','cubeta_agujereada','unit_economics','ltv','saas','smb','due_diligence','cohorts'],
  '{"entity_type":"RETENTION_METRIC","entity_value":"Gross Churn Rate","formula":"MRR cancelado / MRR inicio × 100","benchmark_smb_mensual_max":"3%","benchmark_midmarket_mensual_max":"1.5%","benchmark_enterprise_mensual_max":"0.5%","alerta_critica_mensual":"> 5%","dimension":"Retención y Cohortes","sprint":5}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_churn_id;

INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Cash Runway — Regla VC 18-24 Meses',
  'Eficiencia de Capital',
  'Cash Runway (meses) = Caja Total Disponible / Burn Rate Neto Mensual. Regla VC universal: '
  'toda ronda debe garantizar mínimo 18–24 meses de runway. Bajo 18 meses: modo supervivencia, '
  'negociaciones de ronda en posición de debilidad, dilución agresiva inevitable. '
  'PROTOCOLO ALARMA: startup levanta USD 500K con Burn Rate USD 50K/mes → Runway 10 meses → '
  'ALERTA DE INSOLVENCIA INMINENTE. Con 10 meses de runway debe iniciar fundraising en mes 4–5; '
  'en mes 6 sin ronda visible, probabilidad de cierre > 70%. Regla de timing: iniciar la próxima '
  'ronda siempre con 9–12 meses de runway restante. Nunca menos.',
  'Eficiencia de Capital',
  ARRAY['runway','cash_runway','eficiencia_capital','burn_rate','fundraising','insolvencia','vc','seed','down_round','due_diligence'],
  '{"entity_type":"CAPITAL_EFFICIENCY","entity_value":"Cash Runway","formula":"Caja Disponible / Burn Rate Neto Mensual","minimo_vc_meses":18,"optimo_vc_meses":24,"alerta_critica_meses":10,"timing_siguiente_ronda_meses_antes_de_0":9,"dimension":"Eficiencia de Capital","sprint":5}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_runway_id;

INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Burn Rate — Quema Mensual vs Crecimiento MRR',
  'Eficiencia de Capital',
  'Burn Neto = Egresos Totales - Ingresos Totales. Burn Multiple = Burn Neto / Net New ARR. '
  'Benchmarks Burn Multiple (Bessemer VP): < 1x = excelente; 1–1.5x = bueno; 1.5–2x = aceptable; '
  '2–3x = preocupante; > 3x = capital-ineficiente, no invertible. Un Burn Rate que crece más rápido '
  'que el MRR es la señal más temprana de pérdida de eficiencia de escala — lo opuesto de lo que '
  'los VCs buscan. Análisis adversarial: desagregar burn en categorías (nómina, infra, marketing, G&A). '
  'ALERTA: nómina > 70% del burn sin hiring plan vinculado a hitos de revenue = riesgo crítico. '
  'Triángulo de Hierro VC: Burn Rate × Payback × Churn altos simultáneamente = modelo no viable.',
  'Eficiencia de Capital',
  ARRAY['burn_rate','burn_multiple','eficiencia_capital','mrr','runway','saas','vc','nomina','due_diligence','sostenibilidad'],
  '{"entity_type":"CAPITAL_EFFICIENCY","entity_value":"Burn Rate","formula_burn_neto":"Egresos - Ingresos","formula_burn_multiple":"Burn Neto / Net New ARR","benchmark_excelente":"< 1x","benchmark_critico":"> 3x","alerta_nomina_porcentaje_max":"70%","fuente":"Bessemer Venture Partners","dimension":"Eficiencia de Capital","sprint":5}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_burn_id;

INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'M&A Estratégico — Compradores Corporativos LatAm',
  'Estrategia de Salida',
  'La Estrategia de Salida más probable para startups LatAm Seed/Series A es M&A Estratégico. '
  'IPO en LatAm es prácticamente inviable antes de ARR > USD 100M. Compradores por vertical: '
  'Fintech → BCI, Santander Chile, Banco Estado, Falabella, Cencosud; SaaS B2B → Sigdo Koppers, '
  'SAAM, Arauco; HealthTech → ISAPREs, Red Salud, Alemana; AgriTech → exportadoras, viñas. '
  'Prima de control M&A estratégico: 20–40% sobre valoración financiera si existe moat no replicable. '
  'DUE DILIGENCE BLOQUEANTE: incumplimiento Ley 21.719 o Ley 21.521 impide cierre legal de cualquier '
  'M&A en Chile sin rectificación previa completa. Señal de preparación: founder nombra 3+ compradores '
  'corporativos específicos con tesis de adquisición clara — sin esto el exit plan es marketing.',
  'Estrategia de Salida',
  ARRAY['ma','exit','salida','corporativos','latam','chile','bancos','ipo','valoracion','due_diligence','moat','adquisicion'],
  '{"entity_type":"LIQUIDITY_EVENT","entity_value":"M&A Estratégico","ipo_viabilidad_latam_early":"inviable < ARR USD 100M","prima_control_ma":"20-40%","compradores_fintech":["BCI","Santander Chile","Banco Estado","Falabella","Cencosud"],"bloqueador_ma":"incumplimiento Ley 21.719 / Ley 21.521","dimension":"Estrategia de Salida","sprint":5}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_ma_id;


-- ── ARISTAS SPRINT 5 ──────────────────────────────────────────────────────────

INSERT INTO knowledge_edges (source_title, target_title, relation_type) VALUES
  ('Net Revenue Retention (NRR)',                     'LTV — Lifetime Value del Cliente',                  'MULTIPLY_VALUATION_OF'),
  ('Net Revenue Retention (NRR)',                     'Benchmark LTV:CAC > 3:1',                           'MULTIPLY_VALUATION_OF'),
  ('Gross Churn Rate — Efecto Cubeta Agujereada',     'LTV — Lifetime Value del Cliente',                  'INVALIDATES'),
  ('Gross Churn Rate — Efecto Cubeta Agujereada',     'Benchmark LTV:CAC > 3:1',                           'INVALIDATES'),
  ('Gross Churn Rate — Efecto Cubeta Agujereada',     'Benchmark Payback < 12 meses',                      'INVALIDATES'),
  ('Gross Churn Rate — Efecto Cubeta Agujereada',     'Net Revenue Retention (NRR)',                        'DEPLETES_RUNWAY'),
  ('Burn Rate — Quema Mensual vs Crecimiento MRR',    'Cash Runway — Regla VC 18-24 Meses',                'DEPLETES_RUNWAY'),
  ('Cash Runway — Regla VC 18-24 Meses',              'Burn Rate — Quema Mensual vs Crecimiento MRR',      'REQUIRES'),
  ('Gross Churn Rate — Efecto Cubeta Agujereada',     'Cash Runway — Regla VC 18-24 Meses',                'DEPLETES_RUNWAY'),
  ('Burn Rate — Quema Mensual vs Crecimiento MRR',    'CAC — Costo de Adquisición de Cliente',             'REQUIRES'),
  ('Burn Rate — Quema Mensual vs Crecimiento MRR',    'Payback Period — Periodo de Recuperación CAC',      'REQUIRES'),
  ('Cash Runway — Regla VC 18-24 Meses',              'Corfo Semilla Inicia — Requisitos de Postulación',  'QUALIFIES_FOR'),
  ('Cash Runway — Regla VC 18-24 Meses',              'Corfo Semilla Expande — Requisitos de Postulación', 'QUALIFIES_FOR'),
  ('M&A Estratégico — Compradores Corporativos LatAm','Network Effects — Efecto de Red',                   'REQUIRES_PROOF_OF'),
  ('M&A Estratégico — Compradores Corporativos LatAm','Blue Ocean Strategy — Value Innovation',             'REQUIRES_PROOF_OF'),
  ('M&A Estratégico — Compradores Corporativos LatAm','Net Revenue Retention (NRR)',                        'REQUIRES_PROOF_OF'),
  ('M&A Estratégico — Compradores Corporativos LatAm','Gross Churn Rate — Efecto Cubeta Agujereada',       'REQUIRES_PROOF_OF'),
  ('M&A Estratégico — Compradores Corporativos LatAm','Ley 21.719 — Estándar GDPR Chile',                  'REQUIRES_COMPLIANCE_WITH'),
  ('M&A Estratégico — Compradores Corporativos LatAm','Ley Fintech 21.521 — Registro CMF de Prestadores',  'REQUIRES_COMPLIANCE_WITH'),
  ('M&A Estratégico — Compradores Corporativos LatAm','Estructura SpA (Sociedad por Acciones)',             'REQUIRES_COMPLIANCE_WITH'),
  ('M&A Estratégico — Compradores Corporativos LatAm','Drag-along — Derecho de Arrastre',                  'REQUIRES_COMPLIANCE_WITH'),
  ('Net Revenue Retention (NRR)',                     'Vesting y Cliff — Retención de Fundadores',          'MEASURES_SUCCESS_OF'),
  ('Cash Runway — Regla VC 18-24 Meses',              'Vesting y Cliff — Retención de Fundadores',          'MITIGATES_RISK_OF')
ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

END $$;
