-- ============================================================
-- ValidateAI — Sprint 1: El Núcleo de Supervivencia
-- Familia A Framework Nodes: Unit Economics, Definición del
-- Problema (Mom Test + Lean Startup), TAM/SAM/SOM
-- ============================================================
-- entity_type: FRAMEWORK | BENCHMARK | METHODOLOGY
-- embedding = NULL → vectorización asíncrona posterior
-- Idempotente: ON CONFLICT DO UPDATE / DO NOTHING
-- ============================================================


-- ── BLOQUE 1: UNIT ECONOMICS ─────────────────────────────────────────────────
DO $$
DECLARE
  v_cac_id     UUID;
  v_ltv_id     UUID;
  v_payback_id UUID;
  v_ltvcac_id  UUID;
  v_pb12_id    UUID;
BEGIN

  -- 1.1 CAC — Fórmula base
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'CAC — Costo de Adquisición de Cliente',
    'Unit Economics',
    'CAC = Total Gasto Marketing y Ventas / Nuevos Clientes Adquiridos en el período. Un CAC elevado sin LTV proporcional destruye caja. El CAC debe incluir salarios del equipo de ventas, ad spend, herramientas, eventos y cualquier costo directamente atribuible a la adquisición. Para startups B2B SaaS: CAC < USD 5.000 es saludable en early-stage; CAC > USD 20.000 requiere justificación con contratos enterprise de alto ACV. Segmentar CAC por canal (paid/organic/referral) revela el canal más eficiente para escalar.',
    'Unit Economics',
    ARRAY['cac','unit_economics','adquisicion','marketing','ventas','saas','b2b'],
    '{"entity_type": "FRAMEWORK", "entity_value": "CAC", "formula": "Total Gasto Marketing y Ventas / Nuevos Clientes", "dimension": "Unit Economics", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_cac_id;

  -- 1.2 LTV — Fórmula base
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'LTV — Lifetime Value del Cliente',
    'Unit Economics',
    'LTV = ARPU × Margen Bruto × (1 / Tasa de Churn). Para SaaS: LTV = MRR promedio por cliente × margen bruto / churn rate mensual. El LTV proyecta los ingresos futuros que un cliente típico generará. Nunca usar LTV contable sin descontar; usar tasa de descuento 10–15% para proyecciones honestas. Un LTV inflado por churn subestimado es una de las señales de alarma más comunes que detectan los VCs en due diligence. Usar cohorts reales de al menos 6 meses antes de presentar LTV a un inversor.',
    'Unit Economics',
    ARRAY['ltv','lifetime_value','unit_economics','churn','arpu','saas','vc_diligence'],
    '{"entity_type": "FRAMEWORK", "entity_value": "LTV", "formula": "ARPU × Margen Bruto / Churn Rate", "dimension": "Unit Economics", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_ltv_id;

  -- 1.3 Payback Period — Fórmula base
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Payback Period — Periodo de Recuperación CAC',
    'Unit Economics',
    'Payback Period = CAC / (ARPU × Margen Bruto mensual). Mide cuántos meses tarda un cliente en recuperar su costo de adquisición. Es la métrica de caja más honesta para startups: indica cuánto capital necesitas para crecer antes de ser rentable. Un Payback corto (<12 meses) significa que puedes reinvertir el CAC recuperado en nuevos clientes sin necesitar nueva ronda de financiamiento. Payback >24 meses en early-stage es una señal de modelo de negocio frágil que requiere validación adicional antes de escalar.',
    'Unit Economics',
    ARRAY['payback','payback_period','unit_economics','cac','caja','runway','b2b'],
    '{"entity_type": "FRAMEWORK", "entity_value": "Payback Period", "formula": "CAC / (ARPU × Margen Bruto mensual)", "dimension": "Unit Economics", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_payback_id;

  -- 1.4 Benchmark LTV:CAC > 3:1
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Benchmark LTV:CAC > 3:1',
    'Benchmarks',
    'El ratio LTV:CAC mínimo aceptable es 3:1: por cada peso invertido en adquirir un cliente, el negocio debe retornar al menos 3 pesos en valor de vida. Benchmarks de referencia: <1:1 = modelo roto, no escalar; 1:1–2:1 = márgenes insuficientes para financiar growth orgánico; 3:1–5:1 = rango óptimo para VC funding y expansión; >5:1 = posible subinversión en adquisición, considerar acelerar spend. LTV:CAC se reporta al board en toda ronda Serie A+. Calcularlo siempre con cohorts reales, no proyecciones optimistas de churn futuro.',
    'Unit Economics',
    ARRAY['ltv_cac','benchmark','unit_economics','vc_funding','series_a','board_metrics','cohorts'],
    '{"entity_type": "BENCHMARK", "entity_value": "LTV:CAC > 3:1", "threshold": 3.0, "dimension": "Unit Economics", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_ltvcac_id;

  -- 1.5 Benchmark Payback < 12 meses
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Benchmark Payback < 12 meses',
    'Benchmarks',
    'El Payback Period benchmark para startups VC-backable es menor a 12 meses. Interpretación por rango: 0–6 meses = excelente, modelo de caja muy eficiente; 6–12 meses = bueno, estándar SaaS saludable; 12–18 meses = aceptable con contrato anual o enterprise; >18 meses = capital-intensivo, requiere fundraising frecuente para sostener el crecimiento. En Chile y LATAM, un Payback <18 meses con contratos anuales es competitivo. Empresas con Payback >24 meses raramente obtienen Serie A sin evidencia de reducción de churn sostenida en al menos 3 cohortes consecutivas.',
    'Unit Economics',
    ARRAY['payback','benchmark','unit_economics','saas','latam','chile','series_a','churn'],
    '{"entity_type": "BENCHMARK", "entity_value": "Payback < 12 meses", "threshold_months": 12, "dimension": "Unit Economics", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_pb12_id;

  -- Aristas Unit Economics
  INSERT INTO public.knowledge_edges (source_title, target_title, relation_type) VALUES
    ('LTV — Lifetime Value del Cliente',              'CAC — Costo de Adquisición de Cliente',        'MEASURES_SUCCESS_OF'),
    ('Payback Period — Periodo de Recuperación CAC',  'CAC — Costo de Adquisición de Cliente',        'REQUIRES'),
    ('Benchmark LTV:CAC > 3:1',                       'LTV — Lifetime Value del Cliente',             'REQUIRES'),
    ('Benchmark LTV:CAC > 3:1',                       'CAC — Costo de Adquisición de Cliente',        'REQUIRES'),
    ('Benchmark Payback < 12 meses',                  'Payback Period — Periodo de Recuperación CAC', 'REQUIRES')
  ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

  RAISE NOTICE '[Sprint 1] Unit Economics: CAC=%, LTV=%, Payback=%, Bench LTV:CAC=%, Bench PB12=%',
    v_cac_id, v_ltv_id, v_payback_id, v_ltvcac_id, v_pb12_id;

END $$;


-- ── BLOQUE 2: DEFINICIÓN DEL PROBLEMA ────────────────────────────────────────
DO $$
DECLARE
  v_mom1_id UUID;
  v_mom2_id UUID;
  v_mom3_id UUID;
  v_bml_id  UUID;
  v_cdcv_id UUID;
  v_vl_id   UUID;
BEGIN

  -- 2.1 Mom Test — Hechos No Opiniones
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Mom Test — Regla de Hechos No Opiniones',
    'Mom Test',
    'El Mom Test prohíbe preguntar opiniones sobre tu idea o producto futuro. Las preguntas válidas son sobre comportamiento pasado y presente: "¿Cuándo fue la última vez que enfrentaste este problema? ¿Cómo lo resolviste? ¿Cuánto tiempo y dinero gastaste?" Las preguntas inválidas son hipotéticas: "¿Usarías X? ¿Pagarías Y?" — las personas mienten por cortesía cuando quieren evitar herirte. La evidencia real es: alguien que ya gasta dinero o tiempo en solucionar el problema ahora mismo, sin que exista tu producto todavía.',
    'Definicion del Problema',
    ARRAY['mom_test','customer_discovery','entrevistas','validacion','problema','comportamiento','evidencia'],
    '{"entity_type": "METHODOLOGY", "entity_value": "Mom Test Regla 1 — Hechos", "source": "The Mom Test — Rob Fitzpatrick", "dimension": "Definicion del Problema", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_mom1_id;

  -- 2.2 Mom Test — No Presentar la Solución
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Mom Test — Regla de No Presentar la Solución',
    'Mom Test',
    'Durante las entrevistas de descubrimiento nunca reveles tu solución propuesta antes de entender profundamente el problema. Si revelas la idea primero, el entrevistado responderá en función de no herirte. La secuencia correcta es: contexto del problema → experiencias pasadas → cuantificación del dolor (tiempo, dinero, frustración) → soluciones actuales que usa hoy → solo al final, si corresponde, mencionar la hipótesis de solución. El objetivo de las primeras 30 entrevistas es falsificar la hipótesis del problema, no confirmar que tu solución es brillante.',
    'Definicion del Problema',
    ARRAY['mom_test','customer_discovery','entrevistas','sesgos','problem_first','hipotesis','sesgo_confirmacion'],
    '{"entity_type": "METHODOLOGY", "entity_value": "Mom Test Regla 2 — No Solución", "source": "The Mom Test — Rob Fitzpatrick", "dimension": "Definicion del Problema", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_mom2_id;

  -- 2.3 Mom Test — Conversaciones Específicas e Incidentes
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Mom Test — Regla de Conversaciones Específicas e Incidentes',
    'Mom Test',
    'Las entrevistas Mom Test deben profundizar en incidentes específicos, no generalizaciones. Técnica: cuando alguien menciona el problema, preguntar inmediatamente "¿Puedes contarme la última vez que esto te pasó?" y reconstruir el incidente paso a paso. Las generalizaciones ("A veces tengo ese problema") son señales débiles; los incidentes específicos con consecuencias reales ("La semana pasada perdí un cliente porque...") son señales fuertes. Objetivo: 3 o más incidentes concretos con consecuencias cuantificables antes de declarar problem-market fit y avanzar a Customer Validation.',
    'Definicion del Problema',
    ARRAY['mom_test','customer_discovery','entrevistas','incidentes','problem_market_fit','evidencia','cuantificacion'],
    '{"entity_type": "METHODOLOGY", "entity_value": "Mom Test Regla 3 — Incidentes", "source": "The Mom Test — Rob Fitzpatrick", "dimension": "Definicion del Problema", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_mom3_id;

  -- 2.4 Lean Startup — Build-Measure-Learn
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Lean Startup — Build-Measure-Learn',
    'Lean Startup',
    'El ciclo Build-Measure-Learn de Lean Startup define el ritmo de iteración de una startup: Build = construir el experimento mínimo (MVP o smoke test); Measure = medir la métrica de aprendizaje (no métricas vanidad como pageviews); Learn = decidir pivotar o perseverar con datos, no intuición. La velocidad del ciclo es la ventaja competitiva real de una startup frente a corporaciones. Un ciclo de 2 semanas vs 2 meses significa 26 iteraciones vs 6 en el mismo año. El experimento debe estar diseñado para falsificar una hipótesis específica, con criterio de éxito definido antes de ejecutar.',
    'Definicion del Problema',
    ARRAY['lean_startup','bml','build_measure_learn','mvp','iteracion','pivot','hipotesis','experimento'],
    '{"entity_type": "FRAMEWORK", "entity_value": "Build-Measure-Learn", "source": "The Lean Startup — Eric Ries", "dimension": "Definicion del Problema", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_bml_id;

  -- 2.5 Lean Startup — Customer Discovery vs Customer Validation
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Lean Startup — Customer Discovery vs Customer Validation',
    'Lean Startup',
    'Lean Startup define dos fases distintas e irrepetibles antes del product-market fit: Customer Discovery = aprender si el problema existe y es suficientemente significativo (mínimo 20 entrevistas sin intentar vender); Customer Validation = aprender si el mercado pagará por tu solución (primeras ventas reales, no pilotos gratuitos ni PoCs). El error más común es mezclar ambas fases: intentar vender antes de entender el problema, o continuar en descubrimiento cuando ya hay señales claras de demanda. Criterio de paso: 3 o más clientes con intención de pago demostrada por carta de intención firmada o pre-pago efectivo.',
    'Definicion del Problema',
    ARRAY['customer_discovery','customer_validation','lean_startup','entrevistas','ventas','problem_solution_fit','pmf'],
    '{"entity_type": "FRAMEWORK", "entity_value": "Customer Discovery vs Validation", "source": "The Lean Startup — Eric Ries", "dimension": "Definicion del Problema", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_cdcv_id;

  -- 2.6 Lean Startup — Validated Learning
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Lean Startup — Validated Learning',
    'Lean Startup',
    'Validated Learning es la unidad de progreso de una startup: el aprendizaje demostrado empíricamente sobre lo que los clientes realmente quieren. No equivale a datos cualitativos ni a features construidas. Requiere: hipótesis explícita formulada antes del experimento, métrica de éxito definida antes de ejecutar, datos reales de comportamiento (no entrevistas de opinión). Ejemplo canónico: "Hipótesis: 40% de los usuarios invitará a un colega en las primeras 24h. Resultado real: 12%. Aprendizaje validado: el loop viral no funciona con este incentivo — rediseñar mecánica de referido." El pivot estratégico se justifica con Validated Learning, nunca con intuición o presión de inversores.',
    'Definicion del Problema',
    ARRAY['validated_learning','lean_startup','hipotesis','experimento','pivot','metricas','evidencia','aprendizaje'],
    '{"entity_type": "FRAMEWORK", "entity_value": "Validated Learning", "source": "The Lean Startup — Eric Ries", "dimension": "Definicion del Problema", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_vl_id;

  -- Aristas Definición del Problema
  INSERT INTO public.knowledge_edges (source_title, target_title, relation_type) VALUES
    ('Mom Test — Regla de Hechos No Opiniones',                    'Lean Startup — Customer Discovery vs Customer Validation', 'VALIDATES_PROBLEM'),
    ('Mom Test — Regla de No Presentar la Solución',               'Lean Startup — Customer Discovery vs Customer Validation', 'VALIDATES_PROBLEM'),
    ('Mom Test — Regla de Conversaciones Específicas e Incidentes','Lean Startup — Customer Discovery vs Customer Validation', 'VALIDATES_PROBLEM'),
    ('Lean Startup — Build-Measure-Learn',                         'Lean Startup — Customer Discovery vs Customer Validation', 'REQUIRES'),
    ('Lean Startup — Validated Learning',                          'Lean Startup — Build-Measure-Learn',                      'REQUIRES'),
    ('Lean Startup — Validated Learning',                          'Lean Startup — Customer Discovery vs Customer Validation', 'REQUIRES')
  ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

  RAISE NOTICE '[Sprint 1] Definicion del Problema: Mom1=%, Mom2=%, Mom3=%, BML=%, CDCV=%, VL=%',
    v_mom1_id, v_mom2_id, v_mom3_id, v_bml_id, v_cdcv_id, v_vl_id;

END $$;


-- ── BLOQUE 3: TAM/SAM/SOM ────────────────────────────────────────────────────
DO $$
DECLARE
  v_bottomup_id UUID;
  v_topdown_id  UUID;
BEGIN

  -- 3.1 TAM/SAM/SOM — Metodología Bottom-Up
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'TAM/SAM/SOM — Metodología Bottom-Up',
    'Metodologia',
    'La metodología Bottom-Up construye el TAM desde el nivel de cliente individual: (Precio por cliente × Clientes potenciales en el segmento objetivo). Es la metodología preferida por VCs porque parte de datos reales y falsificables: número de empresas en el ICP, precio promedio de contrato, frecuencia de compra. Ejemplo B2B Chile: 15.000 empresas medianas × USD 200/mes = TAM Chile USD 36M/año. El Bottom-Up revela el esfuerzo comercial real para capturar el mercado. Un Bottom-Up con fuentes citables (SII, INE, CMF, Doing Business) tiene diez veces más credibilidad ante VCs que un Top-Down aplicando porcentajes del mercado global.',
    'TAM/SAM/SOM',
    ARRAY['tam','sam','som','bottom_up','market_sizing','vc_pitch','icp','sii','ine','cmf','chile'],
    '{"entity_type": "METHODOLOGY", "entity_value": "Bottom-Up Market Sizing", "fuentes_datos": ["SII", "INE", "CMF", "Doing Business"], "dimension": "TAM/SAM/SOM", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_bottomup_id;

  -- 3.2 TAM/SAM/SOM — Metodología Top-Down
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'TAM/SAM/SOM — Metodología Top-Down',
    'Metodologia',
    'La metodología Top-Down estima el TAM desde estadísticas de industria existentes aplicando porcentajes de penetración: si el mercado global de X es USD 50B y Chile representa 0.4% del PIB mundial, el TAM Chile estimado es USD 200M. Es útil como sanity check pero insuficiente como único método: los VCs rechazan TAMs puramente Top-Down porque esconden la ausencia de trabajo de campo real con clientes. El error clásico es aplicar tasas de penetración de mercados desarrollados (EE.UU., Europa) a mercados latinoamericanos con menor digitalización, resultando en TAMs fantasma que no resisten due diligence ni el primer cliente real.',
    'TAM/SAM/SOM',
    ARRAY['tam','sam','som','top_down','market_sizing','vc_pitch','latam','chile','due_diligence','sanity_check'],
    '{"entity_type": "METHODOLOGY", "entity_value": "Top-Down Market Sizing", "advertencia": "sanity check only — no usar como unico metodo ante VCs", "dimension": "TAM/SAM/SOM", "sprint": 1}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_topdown_id;

  -- Aristas TAM/SAM/SOM
  INSERT INTO public.knowledge_edges (source_title, target_title, relation_type) VALUES
    ('TAM/SAM/SOM — Metodología Bottom-Up', 'TAM/SAM/SOM — Metodología Top-Down',                        'MEASURES_SUCCESS_OF'),
    ('TAM/SAM/SOM — Metodología Bottom-Up', 'Lean Startup — Customer Discovery vs Customer Validation',   'REQUIRES'),
    ('TAM/SAM/SOM — Metodología Bottom-Up', 'Mom Test — Regla de Hechos No Opiniones',                    'REQUIRES')
  ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

  RAISE NOTICE '[Sprint 1] TAM/SAM/SOM: BottomUp=%, TopDown=%', v_bottomup_id, v_topdown_id;

END $$;


-- ── BLOQUE 4: ARISTAS CROSS-DIMENSION ────────────────────────────────────────
-- Unit Economics ↔ Definición del Problema ↔ TAM/SAM/SOM
INSERT INTO public.knowledge_edges (source_title, target_title, relation_type)
VALUES
  -- Los benchmarks financieros requieren Customer Discovery para tener churn/LTV realistas
  ('Benchmark LTV:CAC > 3:1',                       'Lean Startup — Customer Discovery vs Customer Validation', 'REQUIRES'),
  ('Benchmark Payback < 12 meses',                   'Lean Startup — Customer Discovery vs Customer Validation', 'REQUIRES'),
  -- Bottom-Up TAM requiere conocer el unit economics del cliente (CAC y LTV) para proyectar
  ('TAM/SAM/SOM — Metodología Bottom-Up',            'LTV — Lifetime Value del Cliente',                        'REQUIRES'),
  ('TAM/SAM/SOM — Metodología Bottom-Up',            'CAC — Costo de Adquisición de Cliente',                   'REQUIRES'),
  -- Validated Learning cierra el loop con los benchmarks de Unit Economics
  ('Lean Startup — Validated Learning',               'Benchmark LTV:CAC > 3:1',                                 'MEASURES_SUCCESS_OF'),
  ('Lean Startup — Validated Learning',               'Benchmark Payback < 12 meses',                            'MEASURES_SUCCESS_OF')
ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;
