-- ============================================================
-- ValidateAI — Sprint 3: Motor de Crecimiento, Tracción y
-- Financiamiento
-- Familia A Growth Nodes: Estrategia Fundraising, Tracción/
-- Evidencia (TRL+CRL), Moat Competitivo, MVP Roadmap GTM
-- ============================================================
-- entity_type: FUNDING_REQUIREMENT | MATURITY_METRIC |
--              STRATEGIC_MOAT | GTM_STRATEGY
-- embedding = NULL → vectorización asíncrona posterior
-- Idempotente: ON CONFLICT DO UPDATE / DO NOTHING
-- Cross-sprint con Sprint 1 (Unit Economics) y Sprint 2 (Legal)
-- ============================================================


-- ── BLOQUE 1: ESTRATEGIA FUNDRAISING + TRACCIÓN (TRL/CRL) ────────────────────
DO $$
DECLARE
  v_inicia_id  UUID;
  v_expande_id UUID;
  v_trl_id     UUID;
  v_crl_id     UUID;
BEGIN

  -- 1.1 Corfo Semilla Inicia — Criterios de elegibilidad (etapa idea/prototipo)
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Corfo Semilla Inicia — Requisitos de Postulación',
    'Estrategia Fundraising',
    'Corfo Semilla Inicia es el instrumento de financiamiento público de Corfo Chile más accesible para startups en etapa idea o prototipo. Criterios de elegibilidad que el evaluador debe verificar en due diligence: (1) Fase tecnológica TRL 1–3 — idea validada teóricamente hasta prototipo funcional demostrable en laboratorio o entorno controlado; (2) Ventas netas iguales a CLP $0 — la presencia de cualquier ingreso por ventas o servicios en los últimos 12 meses descalifica automáticamente; (3) Antigüedad legal de la empresa menor a 18 meses desde la fecha de constitución en el Registro de Comercio; (4) Contar con un Servicio de Apoyo (incubadora o aceleradora) certificado por Corfo que acompañe la postulación y responda por el cumplimiento del plan. Beneficio máximo: CLP $35.000.000 como subsidio no reembolsable (90% Corfo / 10% aporte propio del emprendedor). Evaluación adversarial ValidateAI: si la startup tiene usuarios pagando aunque sea informalmente (transferencias, cobros por Mercado Pago), debe redirigirse a Semilla Expande — el SII puede cruzar información con Corfo. Si el equipo operó bajo cualquier razón social relacionada durante más de 18 meses antes de la postulación, la antigüedad efectiva puede superar el límite. Un TRL declarado de 3 sin evidencia técnica verificable (demo funcional, repositorio, arquitectura) es la causal de rechazo más común.',
    'Estrategia Fundraising',
    ARRAY['corfo','semilla_inicia','financiamiento','fondos_publicos','trl','prototipo','chile','startup_temprana','due_diligence'],
    '{"entity_type": "FUNDING_REQUIREMENT", "entity_value": "Corfo Semilla Inicia", "monto_max_clp": 35000000, "cofinanciamiento_corfo": 0.90, "trl_requerido": "1-3", "ventas_maximas_clp": 0, "antiguedad_max_meses": 18, "organismo": "Corfo Chile", "dimension": "Estrategia Fundraising", "sprint": 3}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_inicia_id;

  -- 1.2 Corfo Semilla Expande — Criterios de elegibilidad (etapa tracción inicial)
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Corfo Semilla Expande — Requisitos de Postulación',
    'Estrategia Fundraising',
    'Corfo Semilla Expande financia startups chilenas que han superado la etapa de prototipo y demuestran tracción comercial inicial verificable. Criterios de elegibilidad: (1) Ventas netas acumuladas mínimas de CLP $100.000 en los últimos 12 meses, verificables en SII mediante boleta electrónica, factura o contrato de servicios con pago efectuado; (2) Fase tecnológica TRL 4–6 — desde prototipo validado en entorno relevante hasta sistema demostrado en condiciones de piloto real; (3) Antigüedad legal entre 6 meses y 4 años desde la constitución; (4) Empresa legalmente constituida en Chile (SpA, Ltda., S.A. o EIRL); (5) Servicio de Apoyo certificado por Corfo que acompañe el plan de escala. Beneficio máximo: CLP $100.000.000 en subsidio no reembolsable (85% Corfo / 15% aporte propio). Criterios de evaluación competitiva que determinan el score: potencial de escalabilidad del mercado direccionable (TAM Bottom-Up documentado); grado de diferenciación del modelo de negocio (por qué ahora, por qué este equipo); equipo fundador con capacidades complementarias demostradas; evidencia de aprendizaje iterativo (pivots documentados con datos de cohorts, no narrativas). Evaluación adversarial ValidateAI: startups con ventas de CLP $100.000 pero LTV:CAC < 1:1 no superan evaluación de escalabilidad aunque cumplan el requisito mínimo de ventas.',
    'Estrategia Fundraising',
    ARRAY['corfo','semilla_expande','financiamiento','fondos_publicos','trl','traccion','ventas','chile','due_diligence','escalabilidad'],
    '{"entity_type": "FUNDING_REQUIREMENT", "entity_value": "Corfo Semilla Expande", "monto_max_clp": 100000000, "cofinanciamiento_corfo": 0.85, "trl_requerido": "4-6", "ventas_min_clp": 100000, "antiguedad_min_meses": 6, "antiguedad_max_meses": 48, "organismo": "Corfo Chile", "dimension": "Estrategia Fundraising", "sprint": 3}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_expande_id;

  -- 1.3 TRL — Technology Readiness Level (escala formal NASA/Corfo)
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'TRL — Technology Readiness Level',
    'Traccion y Evidencia',
    'El Technology Readiness Level (TRL) es la escala estándar de madurez tecnológica (origen NASA, adoptada por Corfo, ESA y la UE). Escala completa para due diligence ValidateAI: TRL 1 = principios básicos observados (hipótesis teórica sin código ni prototipo); TRL 2 = concepto tecnológico formulado (solución imaginada con especificación técnica, sin implementación); TRL 3 = prueba de concepto analítica o experimental (demo funcional mínima, puede ser proceso manual o Wizard of Oz); TRL 4 = validación de componentes en laboratorio (MVP funcional interno, no desplegado con usuarios reales); TRL 5 = validación en entorno relevante (primeros usuarios beta reales bajo condiciones controladas, sin pago); TRL 6 = demostración de sistema en entorno relevante (piloto con usuarios reales bajo condiciones controladas, producto funcional en producción); TRL 7 = demostración en entorno operacional (usuarios reales con acceso abierto, primeras ventas o suscripciones activas); TRL 8 = sistema completo y calificado (escalado inicial demostrado, integrations de terceros estables); TRL 9 = sistema probado en entorno operacional completo (product-market fit declarado, escala sostenida). Protocolo de verificación adversarial: el TRL declarado por el founder debe ser confirmado con evidencia técnica concreta — repositorio de código con commits history, arquitectura de sistema documentada, demo en vivo con datos reales. Una divergencia TRL declarado vs. TRL real de más de 2 niveles es señal de founder inflation y descalifica la evaluación positiva.',
    'Traccion y Evidencia',
    ARRAY['trl','technology_readiness','madurez_tecnologica','corfo','innovacion','prototipo','mvp','evidencia','due_diligence'],
    '{"entity_type": "MATURITY_METRIC", "entity_value": "TRL Scale 1-9", "estandar": "NASA / Corfo / EU Horizon", "niveles": 9, "dimension": "Traccion y Evidencia", "sprint": 3}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_trl_id;

  -- 1.4 CRL — Commercial Readiness Level (escala de madurez comercial)
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'CRL — Commercial Readiness Level',
    'Traccion y Evidencia',
    'El Commercial Readiness Level (CRL) es la escala análoga al TRL para medir la madurez comercial de un modelo de negocio, adaptada por ValidateAI al ecosistema chileno y LATAM. Escala CRL 1–9: CRL 1 = segmento de mercado identificado sin validación (solo hipótesis de buyer persona sin contacto real); CRL 2 = hipótesis de problema formulada con evidencia documental secundaria (informes, datos públicos); CRL 3 = 10 o más entrevistas Mom Test completadas con incidentes específicos documentados y consecuencias cuantificadas; CRL 4 = MVP entregado a primeros usuarios beta (sin cobrar, bajo acuerdo de evaluación); CRL 5 = primera venta real facturada o cobrada (el monto es irrelevante — la voluntad de pago es la métrica); CRL 6 = clientes recurrentes con al menos 2 ciclos de pago completados y churn mensual < 25%; CRL 7 = Product-Market Fit declarado con evidencia cuantitativa (40% rule de Sean Ellis: al menos 40% de usuarios reportan que quedarían "muy decepcionados" sin el producto, con n > 30); CRL 8 = crecimiento orgánico medible y sostenido (>15% MoM por 3 meses consecutivos sin incremento proporcional de CAC); CRL 9 = liderazgo de segmento con ventaja competitiva defensible demostrada. Regla de balance ValidateAI: el ratio ideal para una ronda Seed es TRL 5–6 + CRL 5–6. TRL 8 con CRL 3 = scientific founder trap (tecnología sin mercado). TRL 3 con CRL 6 = hackeo comercial sin profundidad técnica (frágil bajo escrutinio técnico de due diligence).',
    'Traccion y Evidencia',
    ARRAY['crl','commercial_readiness','madurez_comercial','traccion','pmf','product_market_fit','ventas','churn','evidencia','due_diligence'],
    '{"entity_type": "MATURITY_METRIC", "entity_value": "CRL Scale 1-9", "pmf_threshold_40rule": 0.40, "churn_max_crl6": 0.25, "crecimiento_min_crl8_mom": 0.15, "dimension": "Traccion y Evidencia", "sprint": 3}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_crl_id;

  -- Aristas Fundraising + Tracción
  INSERT INTO public.knowledge_edges (source_title, target_title, relation_type) VALUES
    ('TRL — Technology Readiness Level',              'Corfo Semilla Inicia — Requisitos de Postulación',  'QUALIFIES_FOR'),
    ('TRL — Technology Readiness Level',              'Corfo Semilla Expande — Requisitos de Postulación', 'QUALIFIES_FOR'),
    ('CRL — Commercial Readiness Level',              'Corfo Semilla Expande — Requisitos de Postulación', 'QUALIFIES_FOR'),
    ('CRL — Commercial Readiness Level',              'Corfo Semilla Inicia — Requisitos de Postulación',  'DISQUALIFIES_FROM'),
    ('Corfo Semilla Expande — Requisitos de Postulación', 'Corfo Semilla Inicia — Requisitos de Postulación', 'DISQUALIFIES_FROM'),
    ('CRL — Commercial Readiness Level',              'TRL — Technology Readiness Level',                  'MEASURES_SUCCESS_OF')
  ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

  RAISE NOTICE '[Sprint 3] Fundraising+Traccion: Inicia=%, Expande=%, TRL=%, CRL=%',
    v_inicia_id, v_expande_id, v_trl_id, v_crl_id;

END $$;


-- ── BLOQUE 2: MOAT COMPETITIVO ────────────────────────────────────────────────
DO $$
DECLARE
  v_blueocean_id UUID;
  v_network_id   UUID;
BEGIN

  -- 2.1 Blue Ocean Strategy — Value Innovation
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Blue Ocean Strategy — Value Innovation',
    'Moat Competitivo',
    'Blue Ocean Strategy (Kim & Mauborgne) propone que la ventaja competitiva sostenible no se construye siendo mejor en las mismas dimensiones que los competidores (Red Ocean = océano rojo de competencia sangrienta), sino creando un espacio de mercado no disputado donde la competencia sea irrelevante. Marco ERRC (Eliminar-Reducir-Aumentar-Crear) para evaluación de moat: Eliminar = ¿qué factores que la industria da por sentados deberían eliminarse por no agregar valor real al cliente objetivo?; Reducir = ¿qué factores deben reducirse muy por debajo del estándar de la industria porque el cliente los sobrevalora?; Aumentar = ¿qué factores deben elevarse por encima del estándar actual porque el cliente los subestima?; Crear = ¿qué factores inexistentes en la industria deben crearse para destrabar nueva demanda? Aplicación en due diligence ValidateAI: si la startup no puede responder la columna Crear con al menos 1 elemento genuinamente nuevo para el mercado chileno o LATAM, está compitiendo en Red Ocean y su ventaja competitiva es temporal y frágil. Señal de Value Innovation auténtica: la startup puede perder en métricas tradicionales de la industria (precio, velocidad, cobertura) pero gana en la dimensión que sus clientes objetivo más valoran y que los competidores ignoran. Señal de falsa diferenciación: el pitch menciona "somos mejores que X" en 5 features — eso es competencia incremental, no Blue Ocean.',
    'Moat Competitivo',
    ARRAY['blue_ocean','value_innovation','moat','diferenciacion','estrategia','competencia','errc','due_diligence','pitch'],
    '{"entity_type": "STRATEGIC_MOAT", "entity_value": "Blue Ocean Value Innovation", "framework": "ERRC Grid — Kim & Mauborgne", "dimension": "Moat Competitivo", "sprint": 3}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_blueocean_id;

  -- 2.2 Network Effects — Efecto de Red
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Network Effects — Efecto de Red',
    'Moat Competitivo',
    'Los efectos de red son el moat más poderoso para startups de plataforma y marketplace: el valor del producto aumenta con cada nuevo usuario que se incorpora, creando una barrera de entrada progresivamente más difícil de escalar para competidores. Tipos relevantes para el ecosistema LATAM: Efectos directos (mismo lado) = más usuarios → más valor para todos los usuarios existentes (ej. WhatsApp, redes de segunda mano, plataformas de talento); Efectos indirectos (cross-side) = más compradores → más vendedores y viceversa, con flywheel de liquidez (ej. marketplaces B2B2C, plataformas de pagos); Efectos de datos = más interacciones → modelo ML más preciso → mejor producto → más usuarios → más datos (ej. fintech crediticia con scoring propio, diagnóstico médico AI, motores de recomendación). Métricas de verificación de network effects en due diligence: coeficiente viral K (K > 1 = crecimiento exponencial autosostenido sin inversión incremental en adquisición); ratio de invitaciones orgánicas por usuario activo mensual; curva de retención cohorts — en productos con network effects reales, la retención de cohortes antiguas es igual o superior a la de cohortes nuevas (el inverso indica ausencia de efectos de red reales). Señal de falso network effect: el founder afirma efectos de red pero el producto funciona igual de bien con 10 usuarios que con 10.000 — el valor es estático, no incremental con la base de usuarios.',
    'Moat Competitivo',
    ARRAY['network_effects','efecto_red','moat','plataforma','marketplace','viral','flywheel','latam','due_diligence','k_coefficient'],
    '{"entity_type": "STRATEGIC_MOAT", "entity_value": "Network Effects", "k_coefficient_threshold": 1.0, "tipos": ["directo", "indirecto", "datos"], "dimension": "Moat Competitivo", "sprint": 3}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_network_id;

  -- Aristas Moat Competitivo
  INSERT INTO public.knowledge_edges (source_title, target_title, relation_type) VALUES
    ('Network Effects — Efecto de Red',          'Blue Ocean Strategy — Value Innovation',   'MEASURES_SUCCESS_OF'),
    ('Blue Ocean Strategy — Value Innovation',   'Network Effects — Efecto de Red',          'MITIGATES_RISK_OF')
  ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

  RAISE NOTICE '[Sprint 3] Moat: BlueOcean=%, NetworkEffects=%', v_blueocean_id, v_network_id;

END $$;


-- ── BLOQUE 3: MVP ROADMAP & ESCALABILIDAD ────────────────────────────────────
DO $$
DECLARE
  v_whatsapp_id UUID;
  v_aifirst_id  UUID;
BEGIN

  -- 3.1 WhatsApp-first GTM — Adopción conversacional LatAm/Chile
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'WhatsApp-first GTM — Adopción Conversacional LatAm',
    'MVP Roadmap',
    'La estrategia WhatsApp-first GTM aprovecha la penetración superior al 90% de WhatsApp en Chile y LATAM para construir embudos de ventas conversacionales que eliminan la fricción de formularios web, onboarding digital complejo y demos pre-agendadas. Playbook validado para B2B SaaS con ticket < USD 500/mes en Chile: Fase 1 Inbound = capturar leads vía link wa.me directo o QR en material impreso/digital — cero fricción de email; Fase 2 Calificación = bot de calificación automatizado (WATI, BuilderBot, Twilio Conversations, or Chat-API) filtra el lead en menos de 5 mensajes con preguntas binarias de BANT; Fase 3 Demo = video de 90 segundos del producto + link de Calendly enviado dentro del mismo hilo de WhatsApp — tasa de show de demo 3x mayor que email frío; Fase 4 Cierre = link de pago Mercado Pago o Stripe enviado directamente al chat, sin salir de la aplicación; Fase 5 Onboarding = primeras instrucciones de uso por mensaje secuencial, sin PDF ni portal de aprendizaje en etapa temprana. Impacto en CAC medido en mercados chilenos SMB: el funnel WhatsApp-first reduce el CAC entre 40–70% vs. pauta digital + landing page + CRM tradicional, principalmente por eliminación de tasas de abandono de formularios web (promedio 65–70% en dispositivos móviles LATAM). Límite de escalabilidad: este modelo es óptimo hasta aproximadamente 500 clientes activos concurrentes — a partir de ese volumen requiere integración completa con WhatsApp Business API (costos por mensaje inician) y CRM conectado (HubSpot, Pipedrive) para no perder contexto histórico de conversaciones.',
    'MVP Roadmap',
    ARRAY['whatsapp','gtm','go_to_market','latam','chile','conversacional','smb','cac','ventas','onboarding','b2b'],
    '{"entity_type": "GTM_STRATEGY", "entity_value": "WhatsApp-first GTM", "mercado": "Chile / LATAM", "cac_reduccion_estimada": "40-70%", "limite_clientes_sin_api": 500, "herramientas": ["WATI", "BuilderBot", "Twilio Conversations"], "dimension": "MVP Roadmap", "sprint": 3}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_whatsapp_id;

  -- 3.2 AI-First Product Management
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'AI-First Product Management',
    'MVP Roadmap',
    'AI-First Product Management define el paradigma donde la inteligencia artificial es el núcleo de la propuesta de valor, no una feature adicional sobre un producto existente. Principios operativos para founders: (1) Data flywheel antes de AI — diseñar el producto para capturar los datos correctos desde el primer usuario; el modelo mejora con cada interacción, convirtiendo el uso en ventaja competitiva acumulativa; (2) Automate the baseline first — identificar el workflow más repetitivo y doloroso del usuario objetivo y automatizarlo al 80% de precisión antes de lanzar cualquier feature secundaria; (3) Design for exceptions — el AI maneja el 80% de casos predecibles; el humano maneja el 20% de casos edge con mayor valor y menor tolerancia al error; (4) Ship AI como código — versionar modelos en producción con los mismos estándares que el código fuente: branching, rollback automatizado, A/B testing de modelos, monitoreo de drift. Riesgos críticos para due diligence: AI hallucination liability — en sectores financiero, médico o legal chileno, una salida incorrecta del modelo puede generar responsabilidad civil bajo la Ley 21.719 (datos incorrectos tratados) o regulación CMF; verificar que la startup tiene mecanismo human-in-the-loop documentado para casos de alta consecuencia. Model drift monitoring — el comportamiento del modelo cambia con el tiempo a medida que los datos de producción divergen del training set; startups sin monitoreo de drift tienen deuda técnica crítica oculta que los VCs técnicos detectan en due diligence de código. Ventaja competitiva real de AI-First: el moat es el dataset propietario, no el modelo — cualquier competidor puede acceder a Claude o GPT, pero no puede replicar 2 años de datos de comportamiento de usuarios propietarios.',
    'MVP Roadmap',
    ARRAY['ai_first','product_management','llm','data_flywheel','moat','drift','hallucination','due_diligence','dataset','vc'],
    '{"entity_type": "GTM_STRATEGY", "entity_value": "AI-First Product Management", "moat_real": "dataset propietario no el modelo", "riesgo_regulatorio": "Ley 21.719 + CMF para outputs incorrectos", "dimension": "MVP Roadmap", "sprint": 3}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_aifirst_id;

  -- Aristas MVP Roadmap
  INSERT INTO public.knowledge_edges (source_title, target_title, relation_type) VALUES
    ('AI-First Product Management',                'Network Effects — Efecto de Red',           'MEASURES_SUCCESS_OF'),
    ('WhatsApp-first GTM — Adopción Conversacional LatAm', 'AI-First Product Management',       'QUALIFIES_FOR'),
    ('AI-First Product Management',                'Ley 21.719 — Estándar GDPR Chile',          'REQUIRES_COMPLIANCE_WITH')
  ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

  RAISE NOTICE '[Sprint 3] MVP Roadmap: WhatsApp=%, AIFirst=%', v_whatsapp_id, v_aifirst_id;

END $$;


-- ── BLOQUE 4: ARISTAS CROSS-SPRINT ───────────────────────────────────────────
-- Sprint 3 → Sprint 1 (Unit Economics) + Sprint 2 (Legal/Gobernanza)

INSERT INTO public.knowledge_edges (source_title, target_title, relation_type)
VALUES
  -- WhatsApp-first GTM reduce directamente el CAC (mandato explícito del Mega Prompt)
  ('WhatsApp-first GTM — Adopción Conversacional LatAm',  'CAC — Costo de Adquisición de Cliente',           'REDUCES_COST_OF'),

  -- Network Effects reduce CAC (virality = organic acquisition) y mejora LTV (stickiness)
  ('Network Effects — Efecto de Red',                     'CAC — Costo de Adquisición de Cliente',           'REDUCES_COST_OF'),
  ('Network Effects — Efecto de Red',                     'LTV — Lifetime Value del Cliente',                'MEASURES_SUCCESS_OF'),

  -- Blue Ocean mejora el ratio LTV:CAC al operar con menor competencia en el segmento
  ('Blue Ocean Strategy — Value Innovation',              'Benchmark LTV:CAC > 3:1',                         'MITIGATES_RISK_OF'),
  ('Blue Ocean Strategy — Value Innovation',              'TAM/SAM/SOM — Metodología Bottom-Up',             'REQUIRES'),

  -- AI-First reduce CAC (automatización de adquisición y onboarding) y mejora LTV
  ('AI-First Product Management',                         'CAC — Costo de Adquisición de Cliente',           'REDUCES_COST_OF'),
  ('AI-First Product Management',                         'LTV — Lifetime Value del Cliente',                'MITIGATES_RISK_OF'),

  -- Corfo requiere validación de problema previa (Mom Test) y estructura legal (SpA)
  ('Corfo Semilla Inicia — Requisitos de Postulación',    'Mom Test — Regla de Hechos No Opiniones',         'REQUIRES_COMPLIANCE_WITH'),
  ('Corfo Semilla Inicia — Requisitos de Postulación',    'Estructura SpA (Sociedad por Acciones)',           'REQUIRES_COMPLIANCE_WITH'),
  ('Corfo Semilla Expande — Requisitos de Postulación',   'Estructura SpA (Sociedad por Acciones)',           'REQUIRES_COMPLIANCE_WITH'),

  -- Semilla Expande requiere tracción demostrada con Unit Economics sanos
  ('Corfo Semilla Expande — Requisitos de Postulación',   'Benchmark Payback < 12 meses',                    'REQUIRES_COMPLIANCE_WITH'),
  ('Corfo Semilla Expande — Requisitos de Postulación',   'Benchmark LTV:CAC > 3:1',                         'REQUIRES_COMPLIANCE_WITH'),

  -- CRL se construye sobre la base de Customer Discovery (Sprint 1)
  ('CRL — Commercial Readiness Level',                    'Lean Startup — Customer Discovery vs Customer Validation', 'REQUIRES_COMPLIANCE_WITH'),
  ('CRL — Commercial Readiness Level',                    'Mom Test — Regla de Conversaciones Específicas e Incidentes', 'REQUIRES_COMPLIANCE_WITH'),

  -- TRL se alinea con el ciclo Build-Measure-Learn (Sprint 1)
  ('TRL — Technology Readiness Level',                    'Lean Startup — Build-Measure-Learn',              'MEASURES_SUCCESS_OF'),

  -- AI-First debe respetar Ley Karin (empleados que interactúan con el sistema) y Ley 21.719
  ('AI-First Product Management',                         'Ley 21.719 — Gestión de Consentimiento',          'REQUIRES_COMPLIANCE_WITH'),

  -- WhatsApp-first GTM impactado por Ley 21.719 (mensajería masiva requiere consentimiento)
  ('WhatsApp-first GTM — Adopción Conversacional LatAm',  'Ley 21.719 — Gestión de Consentimiento',          'REQUIRES_COMPLIANCE_WITH'),

  -- Semilla Inicia/Expande impactados positivamente por Vesting (equipo estable = mejor score)
  ('Corfo Semilla Expande — Requisitos de Postulación',   'Vesting y Cliff — Retención de Fundadores',       'REQUIRES_COMPLIANCE_WITH')

ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;
