-- ============================================================
-- Sprint 6 — Advanced Risk & B2G Due Diligence Nodes
-- Categorías: Riesgo Conductual, Propiedad Intelectual,
--             Ciberseguridad e Infraestructura, Compras Públicas B2G
-- Nodos: 6 | Aristas: 22 | Embeddings: NULL (vectorización asíncrona)
-- Fuentes: rag_08_psychology.md, INAPI_KNOWLEDGE_VAULT_FASE2.md,
--          Ley 21.663, CHILECOMPRA_INTELIGENCIA.md
-- Aplicado vía: scripts/apply_sprint6.py
-- ============================================================

DO $$
DECLARE
  v_sesgo_conf_id      uuid;
  v_sesgo_opt_id       uuid;
  v_fto_id             uuid;
  v_niza_id            uuid;
  v_ley21663_id        uuid;
  v_b2g_id             uuid;
  -- IDs nodos existentes para aristas cross-sprint
  v_burn_id            uuid;
  v_runway_id          uuid;
  v_ma_id              uuid;
  v_ltv_id             uuid;
  v_payback_id         uuid;
  v_ley719_id          uuid;
  v_ley719_consent_id  uuid;
  v_trl_id             uuid;
  v_crl_id             uuid;
  v_corfo_exp_id       uuid;
  v_nrr_id             uuid;
BEGIN

-- ── NODOS SPRINT 6 ────────────────────────────────────────────────────────────

-- [1] Sesgo de Confirmación
INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Sesgo de Confirmación — Puntos Ciegos del Founder',
  'Riesgo Conductual y Sesgos',
  'RED FLAGS: El Sesgo de Confirmación es la tendencia del equipo fundador a filtrar la realidad '
  'para percibir solo los datos que confirman su hipótesis inicial, generando puntos ciegos estratégicos '
  'severos. Señales críticas de alarma: (1) El founder presenta exclusivamente feedback positivo de clientes '
  'sin mencionar objeciones ni rechazos — en el 35% de los fracasos estudiados, la causa raíz fue construir '
  'un producto sin necesidad de mercado ("no market need"), originado por ignorar señales negativas del mercado. '
  '(2) El founder interpreta preguntas de due diligence como ataques en lugar de oportunidades de mejora. '
  '(3) La startup no tiene un proceso documentado de recopilación de feedback adversarial (Mom Test, entrevistas '
  'de cancelación, análisis de churned customers). (4) Las proyecciones financieras asumen solo el escenario '
  'base sin análisis de sensibilidad ante supuestos negativos. '
  'OPORTUNIDADES ESTRATÉGICAS: Un founder que demuestra capacidad de "buscar activamente la mala noticia" '
  'antes de cualquier decisión estratégica es una señal de madurez ejecutiva. Equipos que practican pre-mortem '
  'analysis (asumir que el proyecto fracasó y razonar hacia atrás) y diversidad estructural de perspectivas '
  '(incluyendo perfiles de negocio cuando el equipo es técnico) mitigan este sesgo sistemáticamente. '
  'Protocolo ValidateAI: si el founder no puede describir al menos 3 feedback negativos reales de potenciales '
  'clientes y qué aprendizaje operativo generaron, marcar como riesgo conductual alto.',
  'Riesgo Conductual y Sesgos',
  ARRAY['sesgo_confirmacion','founder_risk','behavioral_risk','puntos_ciegos','feedback','mom_test','cognitive_bias','due_diligence','pre_mortem'],
  '{"entity_type":"BEHAVIORAL_RISK","entity_value":"Sesgo de Confirmación","fuente":"rag_08_psychology.md","impacto_fracaso_pct":"35% startups — no market need","protocolo":"solicitar 3 feedback negativos documentados","dimension":"Riesgo Conductual y Sesgos","sprint":6}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_sesgo_conf_id;

-- [2] Sesgo de Optimismo
INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Sesgo de Optimismo — Sobreestimación de Resultados',
  'Riesgo Conductual y Sesgos',
  'RED FLAGS: El Sesgo de Optimismo es la tendencia sistemática a sobreestimar la probabilidad de resultados '
  'positivos y subestimar tiempos de desarrollo, costos operativos y obstáculos de mercado. Señales críticas: '
  '(1) Proyecciones financieras que exhiben hockey-stick sin drivers cuantitativos que los justifiquen — '
  'la triplicación de MRR en 6 meses requiere evidencia histórica, no voluntarismo. '
  '(2) Timelines de desarrollo que no incluyen buffer de al menos 40% sobre la estimación inicial — '
  'el 90% de las startups técnicas subestima cronogramas de producto. '
  '(3) Burn Rate proyectado significativamente menor al histórico sin cambio estructural que lo explique. '
  '(4) Ilusión de Control: el founder asume que puede dominar variables de mercado inherentemente impredecibles '
  '(regulación, competencia de grandes players, cambios macroeconómicos). '
  '(5) Síndrome de burnout encubierto: founders que trabajan +80 horas semanales prolongadas pierden capacidad '
  'de toma de decisiones difíciles — el 5% de startups cierran por agotamiento extremo o pérdida de pasión. '
  'OPORTUNIDADES ESTRATÉGICAS: El calibrado de expectativas es una habilidad ejecutiva medible. '
  'Founders que pueden presentar escenarios base, optimista y pesimista con probabilidades asignadas '
  'y que actualizan sus modelos ante nueva evidencia (en lugar de defender la proyección original) '
  'demuestran rigor institucional. Protocolo ValidateAI: comparar cada proyección declarada con el '
  'desempeño histórico real de los últimos 3 meses — la brecha entre proyectado y ejecutado mide '
  'directamente el nivel de sesgo de optimismo del equipo.',
  'Riesgo Conductual y Sesgos',
  ARRAY['sesgo_optimismo','founder_risk','behavioral_risk','burn_rate','proyecciones','ilusión_control','burnout','cognitive_bias','due_diligence'],
  '{"entity_type":"BEHAVIORAL_RISK","entity_value":"Sesgo de Optimismo","fuente":"rag_08_psychology.md","impacto_fracaso":"subestimación costos y tiempos → Burn Rate real > proyectado","protocolo":"comparar proyección vs ejecución histórica 3 meses","burnout_pct_fracasos":"5%","dimension":"Riesgo Conductual y Sesgos","sprint":6}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_sesgo_opt_id;

-- [3] Freedom to Operate (FTO)
INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Freedom to Operate (FTO) — Libertad de Operación INAPI',
  'Propiedad Intelectual',
  'RED FLAGS: El Freedom to Operate (FTO) es el análisis que determina si una startup puede comercializar '
  'su producto/servicio bajo su marca y tecnología sin infringir derechos de propiedad intelectual existentes. '
  'Señales críticas de alarma: (1) La startup opera con una marca no registrada que colisiona con marcas '
  'activas en el registro INAPI — el corpus chileno contiene 503K registros (marcas + patentes) con '
  'estatus activo: Registrada, En Trámite, Esperando Renovación. Una colisión en la misma Clase Niza '
  'obliga a rebranding completo, estimado entre USD 15K-80K dependiendo del estado de desarrollo de la marca. '
  '(2) Startup con más de 12 meses en mercado sin ninguna solicitud de registro de marca en INAPI — '
  'window crítica de vulnerabilidad donde un competidor puede registrar la marca primero (sistema first-to-file). '
  '(3) Producto de software con funcionalidades que replican patentes de proceso existentes sin análisis FTO previo. '
  '(4) Debido diligence de M&A: cualquier adquirente corporativo exige FTO clean antes de cierre — '
  'una marca no registrada es un bloqueante de M&A. '
  'OPORTUNIDADES ESTRATÉGICAS: El INAPI ofrece subsidios para startups vía convenio con CORFO '
  '(hasta 80% de cobertura en tarifas de registro). Las Clases Niza clave para startups SaaS B2B en Chile: '
  'Clase 42 (servicios tecnológicos/software), Clase 35 (servicios empresariales/marketing), '
  'Clase 38 (telecomunicaciones). El registro temprano (aún en etapa de solicitud) otorga prioridad '
  'sobre registros posteriores — protege el moat de marca durante los 12-18 meses de tramitación. '
  'Una startup con FTO clean y marca registrada incrementa su valoración en procesos M&A al eliminar '
  'contingencias legales que los compradores descontarían del precio de adquisición.',
  'Propiedad Intelectual',
  ARRAY['fto','freedom_to_operate','inapi','marca','patentes','propiedad_intelectual','ip','niza','colision_marcaria','ma','due_diligence','chile'],
  '{"entity_type":"IP_DEFENSIBILITY","entity_value":"Freedom to Operate","fuente":"INAPI_KNOWLEDGE_VAULT_FASE2.md","corpus_inapi_registros":503000,"clases_niza_saas":["42","35","38"],"costo_rebranding_usd":"15K-80K","subsidio_corfo":"hasta 80% tarifas INAPI","sistema_chile":"first-to-file","dimension":"Propiedad Intelectual","sprint":6}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_fto_id;

-- [4] Protección de Clases Niza
INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Protección de Clases Niza — Registro de Marca Temprano',
  'Propiedad Intelectual',
  'RED FLAGS: El sistema de Clasificación de Niza organiza bienes y servicios en 45 clases internacionales '
  'para el registro de marcas. La protección de marca en Chile es clase-específica: registrar en Clase 42 '
  '(software) no protege en Clase 35 (servicios empresariales) ni viceversa. Señales críticas: '
  '(1) Startup con producto multi-vertical sin estrategia de registro multi-clase — un competidor puede '
  'bloquear legalmente la expansión a nuevas verticales registrando la marca en esas clases primero. '
  '(2) Registro solo en Chile sin extensión internacional vía Madrid Protocol — startups con tesis '
  'de expansión LatAm expuestas a conflictos marcarios en México, Colombia, Perú, Brasil. '
  '(3) Nombre de marca descriptivo o genérico del producto/servicio — INAPI rechaza sistemáticamente '
  'marcas que describen directamente el bien/servicio (ej. "ValidaSoft" para software de validación). '
  '(4) Sin evidencia de búsqueda de antecedentes en el corpus INAPI antes del lanzamiento de marca. '
  'OPORTUNIDADES ESTRATÉGICAS: Una estrategia de registro de clases Niza bien ejecutada construye '
  'una barrera de entrada geográfica y sectorial medible. El portfolio de marcas registradas '
  '(especialmente combinando marca nominativa + figurativa + slogans) aumenta el múltiplo de valoración '
  'en due diligence de M&A porque reduce las contingencias legales del comprador. '
  'Clases Niza prioritarias por tipo de startup: Fintech → Clase 36 (servicios financieros) + 38; '
  'HealthTech → Clase 44 (servicios médicos) + 42; MarketTech → Clase 35 + 42; '
  'AgriTech → Clase 1 (productos químicos agrícolas) + Clase 44. '
  'El proceso INAPI en Chile dura 12-18 meses desde solicitud hasta registro — iniciar en el día 1 '
  'es la única estrategia correcta para cerrar M&A limpios.',
  'Propiedad Intelectual',
  ARRAY['niza','clases_niza','marca','inapi','ip','propiedad_intelectual','registro_marca','madrid_protocol','latam','ma','due_diligence','fintech','saas'],
  '{"entity_type":"IP_DEFENSIBILITY","entity_value":"Protección Clases Niza","fuente":"INAPI_KNOWLEDGE_VAULT_FASE2.md","clases_45_totales":45,"plazo_registro_chile_meses":"12-18","protocolo_madrid":"extensión internacional disponible","clases_fintech":["36","38","42"],"clases_healthtech":["44","42"],"clases_saas":["42","35"],"dimension":"Propiedad Intelectual","sprint":6}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_niza_id;

-- [5] Ley Marco de Ciberseguridad 21.663
INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Ley Marco de Ciberseguridad (Ley 21.663)',
  'Ciberseguridad e Infraestructura',
  'RED FLAGS: La Ley Marco de Ciberseguridad (Ley 21.663), promulgada el 8 de marzo de 2024 en Chile, '
  'establece obligaciones de ciberseguridad para Operadores de Servicios Esenciales e Importantes. '
  'Señales críticas para startups B2B/B2G: (1) Startup que provee servicios tecnológicos a organismos '
  'del Estado (Mercado Público, ChileCompra) sin tener un plan de respuesta a incidentes documentado — '
  'la Ley exige notificación obligatoria al CSIRT Nacional dentro de 72 horas de detectado un incidente. '
  'El incumplimiento de este plazo conlleva multas de hasta 10.000 UTM (≈ CLP $682M en 2026). '
  '(2) Proveedor SaaS B2B que procesa datos de clientes en sectores regulados (salud, finanzas, gobierno) '
  'sin certificación equivalente a ISO 27001 — los compradores corporativos exigen esto para contratos > UF 1.000. '
  '(3) Infraestructura cloud sin backups georeplicados ni planes de continuidad de negocio (BCP) — '
  'la Ley clasifica a los proveedores críticos como Operadores Importantes con obligations de resiliencia. '
  '(4) Startup que maneja datos personales bajo Ley 21.719 sin controles técnicos de seguridad alineados '
  'a la Ley 21.663 — la doble violación configura responsabilidad administrativa agravada. '
  'OPORTUNIDADES ESTRATÉGICAS: El cumplimiento temprano de Ley 21.663 es un moat competitivo real '
  'en ventas B2G: las bases de licitación de organismos públicos post-2025 requieren acreditación '
  'de ciberseguridad como requisito habilitante. Una startup con ISO 27001 o declaración de conformidad '
  'Ley 21.663 puede optar a Convenio Marco de Tecnología (ChileCompra), canalizando ventas recurrentes '
  'al Estado sin proceso licitatorio por cada venta. El cumplimiento también desbloquea contratos con '
  'corporativos del sector financiero (Ley 20.950 CMF) y salud (MINSAL). '
  'Sectores afectados como Operadores Esenciales: energía, agua, transporte, salud, banca, '
  'telecomunicaciones, gobierno digital.',
  'Ciberseguridad e Infraestructura',
  ARRAY['ley_21663','ciberseguridad','csirt','b2g','b2b','infraestructura','iso27001','compliance','chile','gobierno','mercado_publico','fintech','saas'],
  '{"entity_type":"CYBERSECURITY_COMPLIANCE","entity_value":"Ley 21.663","promulgacion":"2024-03-08","multa_max_utu":10000,"plazo_notificacion_incidente_horas":72,"sectores_esenciales":["energia","agua","transporte","salud","banca","telecom","gobierno"],"certificacion_recomendada":"ISO 27001","dimension":"Ciberseguridad e Infraestructura","sprint":6}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_ley21663_id;

-- [6] Mercado Público / Convenio Marco — Estrategia B2G
INSERT INTO knowledge_nodes (document_title, header_path, content, category, tags, metadata, embedding)
VALUES (
  'Mercado Público y Convenio Marco — Estrategia B2G Chile',
  'Compras Públicas B2G',
  'RED FLAGS: El Mercado Público (ChileCompra) es la plataforma de compras gubernamentales más grande '
  'de LatAm, con más de USD 12B en transacciones anuales. La Estrategia B2G es un canal de liquidez '
  'rápida pero con riesgos estructurales que deben monitorearse. Señales críticas: '
  '(1) Dependencia fiscal > 60%: la startup genera más del 60% de sus ingresos del Estado — '
  'cualquier cambio de gobierno, autoridad compradora o recorte presupuestario elimina la base de revenue. '
  '(2) Trato Directo > 70% del monto adjudicado: señal de opacidad en el proceso de adjudicación; '
  'posible captura del organismo comprador o proveedor cautivo — las licitaciones abiertas deben '
  'ser el canal principal en rubros no especializados. '
  '(3) Deuda del Estado > 3 meses de facturación promedio: la startup entregó bienes/servicios y '
  'el Estado no ha pagado — crisis de liquidez activa que el Cash Runway no refleja si no se ajusta '
  'por OC en estado Aceptada/Recepcionada sin fecha de pago. '
  '(4) Win Rate < 5% en licitaciones competitivas combinado con Alto Trato Directo: inconsistencia '
  'competitiva — la startup no puede ganar en igualdad de condiciones, solo por adjudicaciones directas. '
  '(5) Concentración > 70% en un solo organismo comprador: equivalente a tener un único cliente B2B, '
  'con la particularidad de que el presupuesto del organismo puede recortarse sin previo aviso. '
  'OPORTUNIDADES ESTRATÉGICAS: El Convenio Marco de ChileCompra elimina el proceso licitatorio por '
  'transacción — una startup inscrita en un Convenio Marco puede vender recurrentemente al Estado '
  'sin competir cada vez, con pagos garantizados aunque a 30-90 días. El Estado es el "pagador seguro" '
  'de LatAm: reduce el riesgo de incobrables y estabiliza el Cash Runway. Tickets promedios del Estado '
  'para tecnología están entre UF 50-5.000 por contrato — viable para startups desde etapa seed. '
  'Win rate normal en Chile: 15-35% dependiendo del rubro. Diversificación en ≥ 4 sectores estatales '
  '(Salud, Educación, Municipal, Defensa) reduce el riesgo sectorial. '
  'Métricas clave a monitorear vía API ChileCompra: M1 (ingresos fiscales 12m), M2 (tendencia interanual), '
  'M3 (deuda estado pendiente), M4 (% trato directo), M8 (win rate competitivo).',
  'Compras Públicas B2G',
  ARRAY['b2g','mercado_publico','chilecompra','convenio_marco','licitacion','trato_directo','dependencia_fiscal','liquidez','estado','chile','win_rate','due_diligence'],
  '{"entity_type":"B2G_STRATEGY","entity_value":"Mercado Público / Convenio Marco","fuente":"CHILECOMPRA_INTELIGENCIA.md","mercado_anual_usd_b":"12","alerta_dependencia_fiscal_pct":60,"alerta_trato_directo_pct":70,"win_rate_normal_chile_pct":"15-35","metricas_clave":["M1","M2","M3","M4","M8"],"plazo_pago_dias":"30-90","dimension":"Compras Públicas B2G","sprint":6}'::jsonb,
  NULL
)
ON CONFLICT (document_title) DO UPDATE
  SET content  = EXCLUDED.content,
      metadata = EXCLUDED.metadata,
      category = EXCLUDED.category
RETURNING id INTO v_b2g_id;


-- ── ARISTAS SPRINT 6 ──────────────────────────────────────────────────────────

INSERT INTO knowledge_edges (source_title, target_title, relation_type) VALUES

  -- Behavioral Risk → Unit Economics (sesgo optimismo ciega sobre quema de caja)
  ('Sesgo de Optimismo — Sobreestimación de Resultados',
   'Burn Rate — Quema Mensual vs Crecimiento MRR',
   'BLINDS_FOUNDER_TO'),

  ('Sesgo de Optimismo — Sobreestimación de Resultados',
   'Cash Runway — Regla VC 18-24 Meses',
   'BLINDS_FOUNDER_TO'),

  ('Sesgo de Optimismo — Sobreestimación de Resultados',
   'Benchmark Payback < 12 meses',
   'BLINDS_FOUNDER_TO'),

  -- Behavioral Risk → TRL/CRL (sesgo confirmación ciega sobre madurez real del producto)
  ('Sesgo de Confirmación — Puntos Ciegos del Founder',
   'TRL — Technology Readiness Level',
   'BLINDS_FOUNDER_TO'),

  ('Sesgo de Confirmación — Puntos Ciegos del Founder',
   'CRL — Commercial Readiness Level',
   'BLINDS_FOUNDER_TO'),

  -- Behavioral Risk → NRR (sesgo optimismo infla retención proyectada)
  ('Sesgo de Optimismo — Sobreestimación de Resultados',
   'Net Revenue Retention (NRR)',
   'BLINDS_FOUNDER_TO'),

  -- Behavioral Risk pares internos
  ('Sesgo de Confirmación — Puntos Ciegos del Founder',
   'Sesgo de Optimismo — Sobreestimación de Resultados',
   'AMPLIFIES'),

  -- IP → M&A (FTO limpio es prerequisito para M&A sin contingencias)
  ('Freedom to Operate (FTO) — Libertad de Operación INAPI',
   'M&A Estratégico — Compradores Corporativos LatAm',
   'PROTECTS_AGAINST'),

  ('Protección de Clases Niza — Registro de Marca Temprano',
   'M&A Estratégico — Compradores Corporativos LatAm',
   'PROTECTS_AGAINST'),

  -- IP → Ley 21.719 (datos y software IP van de la mano)
  ('Freedom to Operate (FTO) — Libertad de Operación INAPI',
   'Ley 21.719 — Estándar GDPR Chile',
   'REQUIRES_COMPLIANCE_WITH'),

  -- IP pares internos
  ('Freedom to Operate (FTO) — Libertad de Operación INAPI',
   'Protección de Clases Niza — Registro de Marca Temprano',
   'REQUIRES'),

  -- Ciberseguridad UNLOCKS ventas B2G (compliance = prerequisito licitatorio)
  ('Ley Marco de Ciberseguridad (Ley 21.663)',
   'Mercado Público y Convenio Marco — Estrategia B2G Chile',
   'UNLOCKS_CHANNEL'),

  -- Ciberseguridad → Ley 21.719 (doble compliance obligatorio)
  ('Ley Marco de Ciberseguridad (Ley 21.663)',
   'Ley 21.719 — Gestión de Consentimiento',
   'REQUIRES_COMPLIANCE_WITH'),

  -- Ciberseguridad → M&A (compliance ciberseguridad requerido por compradores corporativos)
  ('Ley Marco de Ciberseguridad (Ley 21.663)',
   'M&A Estratégico — Compradores Corporativos LatAm',
   'PROTECTS_AGAINST'),

  -- B2G REDUCES riesgo de Cash Runway (Estado = pagador seguro, aunque lento)
  ('Mercado Público y Convenio Marco — Estrategia B2G Chile',
   'Cash Runway — Regla VC 18-24 Meses',
   'REDUCES_RISK_OF'),

  -- B2G → Corfo (track record B2G califica para Corfo Expande)
  ('Mercado Público y Convenio Marco — Estrategia B2G Chile',
   'Corfo Semilla Expande — Requisitos de Postulación',
   'QUALIFIES_FOR'),

  -- B2G requiere compliance ciberseguridad
  ('Mercado Público y Convenio Marco — Estrategia B2G Chile',
   'Ley Marco de Ciberseguridad (Ley 21.663)',
   'REQUIRES_COMPLIANCE_WITH'),

  -- B2G requiere compliance datos personales
  ('Mercado Público y Convenio Marco — Estrategia B2G Chile',
   'Ley 21.719 — Gestión de Consentimiento',
   'REQUIRES_COMPLIANCE_WITH'),

  -- B2G → NRR (contratos de Estado generan retención predecible si el organismo renueva)
  ('Mercado Público y Convenio Marco — Estrategia B2G Chile',
   'Net Revenue Retention (NRR)',
   'MEASURES_SUCCESS_OF'),

  -- B2G → IP (licitaciones exigen FTO + propiedad intelectual clean)
  ('Mercado Público y Convenio Marco — Estrategia B2G Chile',
   'Freedom to Operate (FTO) — Libertad de Operación INAPI',
   'REQUIRES'),

  -- Behavioral Risk bloquea capacidad de detectar riesgos B2G
  ('Sesgo de Confirmación — Puntos Ciegos del Founder',
   'Mercado Público y Convenio Marco — Estrategia B2G Chile',
   'BLINDS_FOUNDER_TO'),

  -- IP + Ciberseguridad → LTV (IP defensible + infraestructura segura sostiene el LTV)
  ('Freedom to Operate (FTO) — Libertad de Operación INAPI',
   'LTV — Lifetime Value del Cliente',
   'PROTECTS_AGAINST')

ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

END $$;
