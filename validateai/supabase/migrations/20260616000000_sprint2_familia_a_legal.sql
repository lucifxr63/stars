-- ============================================================
-- ValidateAI — Sprint 2: Blindaje Legal y Operativo
-- Familia A Legal Nodes: Gobernanza/Cap Table + Cumplimiento
-- Normativo (Ley Fintech 21.521 · Ley 21.719 · Ley Karin 21.643)
-- ============================================================
-- entity_type: LEGAL_FRAMEWORK | COMPLIANCE
-- embedding = NULL → vectorización asíncrona posterior
-- Idempotente: ON CONFLICT DO UPDATE / DO NOTHING
-- Relaciones cross-sprint con Unit Economics (Sprint 1)
-- ============================================================


-- ── BLOQUE 1: GOBERNANZA / CAP TABLE ─────────────────────────────────────────
DO $$
DECLARE
  v_spa_id    UUID;
  v_vest_id   UUID;
  v_drag_id   UUID;
  v_tag_id    UUID;
  v_nonc_id   UUID;
BEGIN

  -- 1.1 Estructura SpA — Vehículo societario estándar para VC
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Estructura SpA (Sociedad por Acciones)',
    'Cap Table y Gobernanza',
    'La Sociedad por Acciones (SpA) es el vehículo societario estándar para startups chilenas que buscan financiamiento de capital de riesgo. Ventajas clave para VC: permite múltiples clases de acciones (ordinarias, preferentes, fantasmas/phantom equity); puede operar con un solo accionista inicial; no requiere capital mínimo; sus estatutos y pacto de accionistas son privados. Due diligence legal pre-inversión: verificar que los estatutos permitan emisión de acciones preferentes con liquidation preference; que no existan compromisos de compra o promesas de venta previas no registradas; que todos los founders tengan sus acciones correctamente inscritas antes de la primera ronda. Una SpA mal estructurada (ej. sin cláusulas de veto, sin autorización para nuevas series de acciones) puede bloquear una ronda de inversión o requerir una reestructuración societaria costosa.',
    'Gobernanza',
    ARRAY['spa','sociedad_acciones','cap_table','gobernanza','fundadores','chile','vc','acciones_preferentes'],
    '{"entity_type": "LEGAL_FRAMEWORK", "entity_value": "Estructura SpA", "ley_referencia": "Ley 20.190 — SpA Chile", "dimension": "Gobernanza", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_spa_id;

  -- 1.2 Vesting y Cliff — Retención de founders y equipo clave
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Vesting y Cliff — Retención de Fundadores',
    'Cap Table y Gobernanza',
    'El vesting es el mecanismo por el cual founders y empleados clave adquieren sus acciones o stock options de forma gradual, condicionado a permanencia activa en la empresa. Estándar de mercado VC chileno y LATAM: 4 años de vesting con 1 año de cliff. El cliff significa que si un founder abandona antes del primer año, pierde el 100% de sus acciones vesting — protegiendo al equipo restante y a los inversores. Después del cliff, las acciones se liberan mensualmente (1/48 por mes). Due diligence crítico: si no existe acuerdo de vesting entre cofundadores antes de la primera inversión, la startup es prácticamente no-inversible — un cofundador puede abandonar en el año 2 con el 40–50% del cap table sin trabajar un día más. Fundadores con vesting no firmado es un hard block en procesos de due diligence de fondos LATAM Seed y Series A.',
    'Gobernanza',
    ARRAY['vesting','cliff','cap_table','gobernanza','fundadores','equity','retencion','due_diligence'],
    '{"entity_type": "LEGAL_FRAMEWORK", "entity_value": "Vesting y Cliff", "estandar": "4 años / 1 año cliff", "liberacion": "mensual 1/48", "dimension": "Gobernanza", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_vest_id;

  -- 1.3 Drag-along — Derecho de arrastre para salidas corporativas
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Drag-along — Derecho de Arrastre',
    'Cap Table y Gobernanza',
    'La cláusula Drag-Along otorga al accionista mayoritario (o a un grupo con mayoría calificada definida en el pacto) el derecho de obligar a los accionistas minoritarios a vender sus acciones en las mismas condiciones en una transacción de M&A o adquisición total de la empresa. Es esencial para los VCs: garantiza que un accionista minoritario con agenda personal no pueda bloquear una salida rentable para el resto. Condiciones estándar: se activa cuando el precio de venta supera el valor de liquidación preferente de todos los inversores; todos los accionistas reciben el mismo precio por acción de su misma clase. Protecciones mínimas para minoritarios (cláusulas anti-abuso): precio mínimo aceptable (floor), plazo de cierre razonable, derecho a recibir representations & warranties equivalentes. Due diligence: verificar que el drag-along está en el pacto de accionistas y en los estatutos de la SpA, no solo en un contrato privado no registrado.',
    'Gobernanza',
    ARRAY['drag_along','cap_table','gobernanza','ma','salida','liquidez','vc','mayoritario'],
    '{"entity_type": "LEGAL_FRAMEWORK", "entity_value": "Drag-along", "proposito": "garantizar salida limpia en M&A", "dimension": "Gobernanza", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_drag_id;

  -- 1.4 Tag-along — Derecho de acompañamiento para minoritarios
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Tag-along — Derecho de Acompañamiento',
    'Cap Table y Gobernanza',
    'La cláusula Tag-Along otorga al accionista minoritario el derecho de vender sus acciones en las mismas condiciones que el accionista mayoritario cuando este decida vender su participación a un tercero. Protege a founders tempranos, business angels y empleados con equity de quedar atrapados en la empresa con un nuevo controlador desconocido o potencialmente hostil. Mecanismo de ejercicio: si el mayoritario recibe una oferta de compra de sus acciones y la acepta, los minoritarios tienen derecho de unirse a la venta al mismo precio por acción y mismos términos, dentro del plazo establecido en el pacto (usualmente 15–30 días corridos desde la notificación). Due diligence: confirmar que el tag-along aplica también para transferencias entre partes relacionadas del mayoritario (para evitar estructuras de traspaso que evadan el derecho), y que el mecanismo de notificación es claro y ejecutable bajo el derecho chileno.',
    'Gobernanza',
    ARRAY['tag_along','cap_table','gobernanza','minoritarios','salida','liquidez','angel','empleados_equity'],
    '{"entity_type": "LEGAL_FRAMEWORK", "entity_value": "Tag-along", "plazo_ejercicio_dias": 30, "proposito": "proteger minoritarios en venta del mayoritario", "dimension": "Gobernanza", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_tag_id;

  -- 1.5 Cláusula de No Competencia y Permanencia
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Cláusula de No Competencia y Permanencia',
    'Cap Table y Gobernanza',
    'Las cláusulas de no competencia y permanencia en startups chilenas son compromisos contractuales de founders y empleados clave de: (1) Dedicación exclusiva durante la vigencia del pacto y contrato laboral; (2) No competir directamente con la empresa durante su participación y por un período post-salida. Bajo el derecho chileno, la no competencia post-contractual debe ser razonable en tiempo (máximo 2 años), territorio y actividad específica para ser ejecutable — cláusulas de más de 2 años o alcance global pueden ser declaradas nulas por tribunales laborales. Due diligence crítico: verificar que todos los cofundadores y empleados clave firmaron NDA + no competencia antes de acceder a IP, código fuente propietario, secretos comerciales o listas de clientes. La ausencia de estas cláusulas en los founders es un red flag mayor en procesos de M&A y puede reducir el precio de adquisición hasta un 30% por riesgo de pérdida de conocimiento clave.',
    'Gobernanza',
    ARRAY['no_competencia','permanencia','nda','cap_table','gobernanza','ip','fundadores','ma','riesgo_key_person'],
    '{"entity_type": "LEGAL_FRAMEWORK", "entity_value": "No Competencia y Permanencia", "plazo_maximo_chile": "2 años post-contrato", "dimension": "Gobernanza", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_nonc_id;

  -- Aristas Gobernanza / Cap Table
  INSERT INTO public.knowledge_edges (source_title, target_title, relation_type) VALUES
    ('Vesting y Cliff — Retención de Fundadores',    'Estructura SpA (Sociedad por Acciones)',  'MITIGATES_RISK_OF'),
    ('Drag-along — Derecho de Arrastre',             'Estructura SpA (Sociedad por Acciones)',  'MITIGATES_RISK_OF'),
    ('Tag-along — Derecho de Acompañamiento',        'Vesting y Cliff — Retención de Fundadores','PROTECTS'),
    ('Cláusula de No Competencia y Permanencia',     'Vesting y Cliff — Retención de Fundadores','MITIGATES_RISK_OF'),
    ('Drag-along — Derecho de Arrastre',             'Tag-along — Derecho de Acompañamiento',   'MITIGATES_RISK_OF'),
    ('Cláusula de No Competencia y Permanencia',     'Estructura SpA (Sociedad por Acciones)',   'MITIGATES_RISK_OF')
  ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

  RAISE NOTICE '[Sprint 2] Gobernanza: SpA=%, Vest=%, Drag=%, Tag=%, NonC=%',
    v_spa_id, v_vest_id, v_drag_id, v_tag_id, v_nonc_id;

END $$;


-- ── BLOQUE 2: CUMPLIMIENTO NORMATIVO ─────────────────────────────────────────
DO $$
DECLARE
  v_cmf_id     UUID;
  v_sfa_id     UUID;
  v_gdpr_id    UUID;
  v_cons_id    UUID;
  v_olvid_id   UUID;
  v_karin1_id  UUID;
  v_karin2_id  UUID;
BEGIN

  -- 2.1 Ley Fintech 21.521 — Registro CMF
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Ley Fintech 21.521 — Registro CMF de Prestadores',
    'Ley 21.521 Fintech',
    'La Ley Fintech 21.521 (vigente desde enero 2023, reglamentos en fuerza gradual hasta 2025) obliga a toda empresa que preste Servicios de Plataforma de Financiamiento Colectivo (crowdfunding), Intermediación de Instrumentos Financieros, Sistemas de Pago, Custodia de Valores, Enrutamiento de Órdenes, o Asesoría Crediticia a registrarse ante la CMF antes de operar en Chile. El proceso de registro requiere: plan de negocio aprobado, patrimonio mínimo según tipo de servicio (desde UF 5.000 hasta UF 50.000), políticas de continuidad operacional, y sistemas de gestión de riesgos documentados. Sanciones por operar sin registro: multas hasta UF 15.000 (~USD 650.000) y cierre forzado con responsabilidad personal de los directores. Due diligence pre-inversión: toda fintech debe presentar certificado vigente de registro CMF o demostrar que su actividad no está regulada — la opinión legal de un abogado externo especializado es obligatoria antes de cualquier ronda Serie A en el sector financiero chileno.',
    'Cumplimiento Normativo',
    ARRAY['fintech','cmf','registro','ley_21521','regulacion','chile','prestadores','financiero','due_diligence'],
    '{"entity_type": "COMPLIANCE", "entity_value": "Registro CMF Ley Fintech 21.521", "ley": "21.521", "organismo": "CMF Chile", "multa_maxima_uf": 15000, "dimension": "Cumplimiento Normativo", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_cmf_id;

  -- 2.2 Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)',
    'Ley 21.521 Fintech',
    'El Sistema de Finanzas Abiertas (SFA) establecido por la Ley 21.521 obliga a las instituciones financieras reguladas a compartir datos financieros de sus clientes (previa autorización expresa) con terceros certificados mediante APIs estandarizadas bajo normas de la CMF. Instituciones participantes obligadas: bancos, cooperativas de ahorro y crédito, emisores de tarjetas, fintechs registradas. Oportunidades para startups: el SFA permite construir productos de finanzas personales, crédito alternativo, agregadores de cuentas y asesores automáticos accediendo a datos bancarios reales del usuario sin necesidad de ser banco. Restricción operativa crítica: solo se puede acceder a datos SFA si el usuario otorgó consentimiento explícito, granular y revocable — cualquier acceso fuera de los términos del consentimiento constituye infracción simultánea de la Ley 21.521 y la Ley 21.719 (datos personales), con sanciones acumulativas. El modelo de negocio debe ser diseñado con consentimiento como capa de arquitectura, no como checkbox legal.',
    'Cumplimiento Normativo',
    ARRAY['sfa','finanzas_abiertas','open_banking','fintech','cmf','ley_21521','api','consentimiento','datos'],
    '{"entity_type": "COMPLIANCE", "entity_value": "Sistema de Finanzas Abiertas SFA", "ley": "21.521", "organismo": "CMF Chile", "dimension": "Cumplimiento Normativo", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_sfa_id;

  -- 2.3 Ley 21.719 — Estándar GDPR Chile (marco general)
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Ley 21.719 — Estándar GDPR Chile',
    'Ley 21.719 Proteccion de Datos',
    'La Ley 21.719 (en vigor desde 2026) reemplaza la Ley 19.628 y eleva el estándar de protección de datos personales en Chile al nivel del GDPR europeo. Cambios estructurales: bases legales de tratamiento taxativas (consentimiento, interés legítimo, obligación legal, ejecución contractual, interés vital); principio de minimización de datos (solo recolectar lo estrictamente necesario); obligación de Evaluaciones de Impacto en Protección de Datos (EIPD) para tratamientos de alto riesgo (perfilamiento, decisiones automatizadas, datos sensibles a escala); creación de la Agencia de Protección de Datos Personales como órgano fiscalizador independiente con poder sancionador. Sanciones escalonadas: infracciones leves hasta UF 1.000; infracciones graves hasta UF 5.000 (~USD 215.000); infracciones gravísimas hasta UF 10.000 (~USD 430.000). Due diligence: toda startup que procese datos de usuarios o clientes chilenos debe tener: mapeo de flujos de datos documentado, base legal identificada por cada tratamiento, y política de privacidad actualizada a los nuevos estándares antes de su lanzamiento comercial.',
    'Cumplimiento Normativo',
    ARRAY['ley_21719','gdpr','proteccion_datos','privacidad','chile','agencia_datos','eipd','multas','due_diligence'],
    '{"entity_type": "COMPLIANCE", "entity_value": "Ley 21.719 Estandar GDPR Chile", "ley": "21.719", "organismo": "Agencia de Proteccion de Datos", "multa_maxima_uf": 10000, "vigencia": "2026", "dimension": "Cumplimiento Normativo", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_gdpr_id;

  -- 2.4 Ley 21.719 — Gestión estricta del consentimiento
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Ley 21.719 — Gestión de Consentimiento',
    'Ley 21.719 Proteccion de Datos',
    'La Ley 21.719 exige que el consentimiento para el tratamiento de datos personales sea simultáneamente: libre (sin condicionamiento ni presión); específico (para cada finalidad concreta y declarada); informado (explicando qué datos, para qué finalidad, por cuánto tiempo, con quién se compartirá); e inequívoco (requiere acción afirmativa positiva del usuario — el silencio, las casillas pre-marcadas y la aceptación bundled de términos generales son nulos). Impacto operativo en growth marketing: la integración de GTM, Meta Pixel, Google Analytics 4, PostHog y cualquier herramienta de telemetría o behavioral analytics requiere un Consent Management Platform (CMP) que recabe consentimiento granular por herramienta y por finalidad, previo a cualquier carga de script. Consecuencia en costos de adquisición: la restricción de cookies de terceros más el requisito de consentimiento explícito puede reducir el audience addressable para pauta digital entre un 30–50%, encareciendo directamente el CAC en canales paid social y retargeting.',
    'Cumplimiento Normativo',
    ARRAY['consentimiento','ley_21719','gdpr','cmp','cookies','privacidad','growth','cac','paid_ads','marketing_digital'],
    '{"entity_type": "COMPLIANCE", "entity_value": "Gestion de Consentimiento Ley 21.719", "ley": "21.719", "impacto_cac": "reduccion audiencia addressable 30-50% en paid channels", "dimension": "Cumplimiento Normativo", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_cons_id;

  -- 2.5 Ley 21.719 — Derecho al olvido y portabilidad
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Ley 21.719 — Derecho al Olvido y Portabilidad',
    'Ley 21.719 Proteccion de Datos',
    'La Ley 21.719 consagra dos derechos fundamentales del titular de datos con implicancias técnicas directas para startups. Derecho de Supresión (al olvido): el usuario puede solicitar la eliminación de todos sus datos personales cuando ya no sean necesarios para la finalidad original, cuando retire su consentimiento, o cuando el tratamiento sea ilícito. La empresa tiene 15 días hábiles para ejecutar la supresión en todos sus sistemas, incluidos backups, sistemas analíticos y datos compartidos con terceros. Derecho de Portabilidad: el usuario puede solicitar sus datos en formato estructurado y legible por máquina (CSV, JSON), y transferirlos a otro proveedor sin obstáculos. Due diligence técnico crítico: los sistemas que solo hacen soft delete (campo deleted_at sin eliminación real) no cumplen el derecho al olvido — el dato sigue siendo "tratado" mientras exista. Las startups deben implementar un pipeline de eliminación real (hard delete + propagación a servicios de terceros + confirmación auditada) antes de procesar datos de usuarios chilenos a escala. Incumplimiento reportado por un solo usuario puede desencadenar una inspección de la Agencia de Protección de Datos.',
    'Cumplimiento Normativo',
    ARRAY['derecho_olvido','portabilidad','ley_21719','hard_delete','gdpr','privacidad','datos_personales','supresion'],
    '{"entity_type": "COMPLIANCE", "entity_value": "Derecho al Olvido y Portabilidad Ley 21.719", "ley": "21.719", "plazo_supresion_dias_habiles": 15, "dimension": "Cumplimiento Normativo", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_olvid_id;

  -- 2.6 Ley Karin 21.643 — Protocolo de Prevención Obligatorio
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Ley Karin 21.643 — Protocolo de Prevención Obligatorio',
    'Ley 21.643 Karin',
    'La Ley Karin 21.643 (vigente desde agosto 2024) obliga a todos los empleadores en Chile, sin excepción por tamaño de empresa o número de trabajadores, a implementar un Protocolo de Prevención del Acoso Laboral, Acoso Sexual y Violencia en el Trabajo. El protocolo debe contemplar: (1) diagnóstico de riesgos psicosociales mediante instrumento validado (ISTAS-21 o equivalente); (2) medidas de prevención concretas y evaluables; (3) canal de denuncias confidencial, accesible y con garantías de no-represalia; (4) procedimiento formal de investigación con plazos máximos de 30 días hábiles; (5) medidas de resguardo inmediato para la presunta víctima (separación física, trabajo remoto temporal, cambio de turno). Due diligence ESG/impacto: toda startup con al menos un trabajador en Chile está en infracción si no tiene este protocolo desde agosto 2024 — la Dirección del Trabajo puede cursar multas hasta 60 UTM (~USD 5.400) por trabajador afectado. Los fondos de impacto y ESG exigen evidencia documental del protocolo como condición de inversión.',
    'Cumplimiento Normativo',
    ARRAY['ley_karin','21643','acoso_laboral','protocolo','prevencion','rrhh','trabajadores','multas','esg','due_diligence'],
    '{"entity_type": "COMPLIANCE", "entity_value": "Protocolo Prevencion Ley Karin 21.643", "ley": "21.643", "vigencia": "agosto 2024", "multa_maxima_utm_por_trabajador": 60, "dimension": "Cumplimiento Normativo", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_karin1_id;

  -- 2.7 Ley Karin 21.643 — Definición de Conductas y Responsabilidad Patronal
  INSERT INTO public.knowledge_nodes
    (document_title, header_path, content, category, tags, metadata, embedding)
  VALUES (
    'Ley Karin 21.643 — Prevención de Acoso y Violencia Laboral',
    'Ley 21.643 Karin',
    'La Ley Karin 21.643 amplía y precisa las definiciones de conductas prohibidas en el trabajo: Acoso Laboral = conducta de agresión u hostigamiento reiterada (excepcionalmente, una sola conducta de especial gravedad también califica); Acoso Sexual = cualquier requerimiento de carácter sexual no consentido, independientemente de la jerarquía o relación entre las partes; Violencia en el Trabajo = conductas de terceros (clientes, proveedores, usuarios) que afecten a los trabajadores en el desempeño de sus funciones. La empresa es responsable de proteger a sus empleados también de conductas de agentes externos. Obligación de resguardo inmediato: ante cualquier denuncia formal, el empleador debe adoptar medidas dentro de las 24 horas siguientes (separación física de las partes, trabajo remoto temporal, reubicación en otro equipo o turno). Due diligence RRHH: verificar que todos los directivos, founders y líderes de equipo recibieron capacitación formal y documentada en Ley Karin — la ausencia de registro de capacitación agrava la responsabilidad patronal y elimina la posibilidad de alegar buena fe ante la Inspección del Trabajo.',
    'Cumplimiento Normativo',
    ARRAY['ley_karin','21643','acoso_laboral','acoso_sexual','violencia_laboral','rrhh','responsabilidad_patronal','capacitacion'],
    '{"entity_type": "COMPLIANCE", "entity_value": "Conductas y Responsabilidad Ley Karin 21.643", "ley": "21.643", "plazo_resguardo_horas": 24, "dimension": "Cumplimiento Normativo", "sprint": 2}'::jsonb,
    NULL
  )
  ON CONFLICT (document_title, header_path) DO UPDATE SET
    content  = EXCLUDED.content,
    category = EXCLUDED.category,
    tags     = EXCLUDED.tags,
    metadata = EXCLUDED.metadata
  RETURNING id INTO v_karin2_id;

  -- Aristas Cumplimiento Normativo (intra-categoría)
  INSERT INTO public.knowledge_edges (source_title, target_title, relation_type) VALUES
    -- Ley Fintech
    ('Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)',  'Ley Fintech 21.521 — Registro CMF de Prestadores',        'REQUIRES_COMPLIANCE_WITH'),
    ('Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)',  'Ley 21.719 — Gestión de Consentimiento',                  'REQUIRES_COMPLIANCE_WITH'),
    -- Ley 21.719 estructura interna
    ('Ley 21.719 — Gestión de Consentimiento',                   'Ley 21.719 — Estándar GDPR Chile',                        'REQUIRES_COMPLIANCE_WITH'),
    ('Ley 21.719 — Derecho al Olvido y Portabilidad',            'Ley 21.719 — Estándar GDPR Chile',                        'REQUIRES_COMPLIANCE_WITH'),
    ('Ley 21.719 — Derecho al Olvido y Portabilidad',            'Ley 21.719 — Gestión de Consentimiento',                  'REQUIRES_COMPLIANCE_WITH'),
    -- Ley Karin estructura interna
    ('Ley Karin 21.643 — Prevención de Acoso y Violencia Laboral','Ley Karin 21.643 — Protocolo de Prevención Obligatorio', 'REQUIRES_COMPLIANCE_WITH'),
    -- Fintech requiere estructura societaria válida
    ('Ley Fintech 21.521 — Registro CMF de Prestadores',         'Estructura SpA (Sociedad por Acciones)',                  'REQUIRES_COMPLIANCE_WITH')
  ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;

  RAISE NOTICE '[Sprint 2] Compliance: CMF=%, SFA=%, GDPR=%, Cons=%, Olvid=%, Karin1=%, Karin2=%',
    v_cmf_id, v_sfa_id, v_gdpr_id, v_cons_id, v_olvid_id, v_karin1_id, v_karin2_id;

END $$;


-- ── BLOQUE 3: ARISTAS CROSS-SPRINT (Legal → Sprint 1) ────────────────────────
-- Conecta Sprint 2 con nodos de Unit Economics y Definición del Problema del Sprint 1
INSERT INTO public.knowledge_edges (source_title, target_title, relation_type)
VALUES
  -- Ley 21.719 encarece el CAC al restringir audiencias de datos de terceros
  ('Ley 21.719 — Estándar GDPR Chile',             'CAC — Costo de Adquisición de Cliente',                   'IMPACTS_ACQUISITION_STRATEGY'),
  ('Ley 21.719 — Gestión de Consentimiento',        'CAC — Costo de Adquisición de Cliente',                   'IMPACTS_ACQUISITION_STRATEGY'),
  -- Open Banking via SFA impacta el LTV de productos financieros (más datos = mejor personalización = mayor retención)
  ('Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)', 'LTV — Lifetime Value del Cliente',             'IMPACTS_ACQUISITION_STRATEGY'),
  -- Vesting retiene talento clave → protege la continuidad del LTV (key person risk)
  ('Vesting y Cliff — Retención de Fundadores',     'LTV — Lifetime Value del Cliente',                        'MITIGATES_RISK_OF'),
  ('Cláusula de No Competencia y Permanencia',      'LTV — Lifetime Value del Cliente',                        'MITIGATES_RISK_OF'),
  -- Estructura legal adecuada es prerequisito para registrarse ante CMF (fintech) o levantar capital (VC)
  ('Estructura SpA (Sociedad por Acciones)',         'Benchmark LTV:CAC > 3:1',                                 'MITIGATES_RISK_OF'),
  -- El due diligence legal requiere haber completado customer discovery primero
  ('Ley Fintech 21.521 — Registro CMF de Prestadores', 'Lean Startup — Customer Discovery vs Customer Validation', 'REQUIRES_COMPLIANCE_WITH'),
  -- Ley Karin se activa con el primer empleado — correlacionado con etapa de validación superada
  ('Ley Karin 21.643 — Protocolo de Prevención Obligatorio', 'Lean Startup — Customer Discovery vs Customer Validation', 'REQUIRES_COMPLIANCE_WITH'),
  -- Hard delete (olvido) impacta los cohorts de churn — los datos eliminados distorsionan LTV histórico
  ('Ley 21.719 — Derecho al Olvido y Portabilidad', 'LTV — Lifetime Value del Cliente',                        'IMPACTS_ACQUISITION_STRATEGY'),
  -- TAM bottom-up fintech debe descontar el universo que no dará consentimiento de datos
  ('Ley 21.719 — Gestión de Consentimiento',        'TAM/SAM/SOM — Metodología Bottom-Up',                     'IMPACTS_ACQUISITION_STRATEGY')
ON CONFLICT (source_title, target_title, relation_type) DO NOTHING;
