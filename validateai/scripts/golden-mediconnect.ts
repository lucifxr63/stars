/**
 * Golden Validation — MediConnect (telemedicina rural Chile).
 *
 * Payload curado y ESTÁTICO para el Demo 100. NO proviene de una corrida real
 * de IA: es un entorno controlado para que el pitch muestre el producto en su
 * mejor versión, al instante y de forma determinista (sin latencia ni riesgo de
 * timeout de la API de IA en escena). Los datos del EvidenceWall (Reddit/Trends)
 * son ilustrativos, no señales reales.
 *
 * Las formas de cada objeto se verificaron contra src/types/validation.ts.
 */

// Marcador de idempotencia: el seed borra validaciones con este idea_name antes
// de insertar, para que re-correrlo no duplique.
export const GOLDEN_IDEA_NAME = 'MediConnect';

type Tier = 'pro' | 'premium';

// ── Score 5 dimensiones (0-100). 84 ponderado. ──────────────────────────────
const SCORE_BREAKDOWN = {
  problem: 90,
  market: 86,
  competition: 72,
  solution: 85,
  execution: 82,
};
const VALIDATION_SCORE = 84;

const AI_FEEDBACK =
  'MediConnect ataca un dolor real, cuantificable y políticamente visible: la brecha de ' +
  'acceso a especialistas entre el Chile urbano y el rural. La propuesta destaca por su ' +
  'enfoque offline-first —el verdadero diferenciador frente a la telemedicina urbana— y por ' +
  'un canal de venta B2B2G (municipios y Servicios de Salud) con contratos recurrentes y baja ' +
  'rotación. El mayor riesgo no es técnico ni de demanda, sino regulatorio y de ciclo de venta ' +
  'al sector público: el manejo de datos de salud bajo la Ley 21.719 y los tiempos de ' +
  'contratación estatal deben gobernarse desde el día uno. Con un piloto pagado en 2–3 comunas ' +
  'y la ficha clínica integrada, el caso es claramente invertible.';

// ── Deliverables jsonb ──────────────────────────────────────────────────────

const SUMMARY_JSON = {
  score: VALIDATION_SCORE,
  feedback: AI_FEEDBACK,
  score_breakdown: SCORE_BREAKDOWN,
  strengths: [
    'Dolor cuantificable: listas de espera de especialidad de 6–18 meses en regiones extremas',
    'Diferenciador técnico defendible: triage asíncrono offline-first para conectividad intermitente',
    'Canal B2B2G con ingresos recurrentes y baja rotación (contratos anuales con municipios)',
    'Timing óptimo: empuje de salud digital del MINSAL post-pandemia y Hospital Digital',
  ],
  weaknesses: [
    'Ciclo de venta al sector público largo (licitaciones, presupuesto municipal anual)',
    'Datos de salud sensibles bajo Ley 21.719 — exige cumplimiento robusto desde el inicio',
    'Dependencia de integración con la ficha clínica electrónica del Estado (RAYEN/SIDRA)',
  ],
  next_steps: [
    'Cerrar un piloto pagado en 2–3 comunas rurales con un Servicio de Salud como sponsor',
    'Formalizar Data Processing Agreement y encargado de prevención de datos (Ley 21.719)',
    'Validar la integración con RAYEN/SIDRA antes de escalar a nuevas comunas',
  ],
};

const RISK_ANALYSIS = {
  overallRiskScore: 42, // 0-100, menor es mejor
  dimensions: {
    market: {
      score: 30,
      label: 'Bajo',
      description:
        'Demanda estructural y respaldada por política pública: déficit crónico de especialistas ' +
        'en regiones y presión presupuestaria por reducir traslados de pacientes (GES/no-GES).',
      keyFactors: [
        'Listas de espera de especialidad documentadas por el MINSAL',
        'Costo país de traslados clínicos desde zonas extremas',
        'Presupuesto municipal y de Servicios de Salud asignable a telesalud',
      ],
    },
    technical: {
      score: 48,
      label: 'Medio',
      description:
        'La conectividad intermitente en zonas rurales es el reto central. Mitigable con una ' +
        'arquitectura offline-first (sincronización diferida y triage asíncrono).',
      keyFactors: [
        'Conectividad inestable en postas rurales',
        'Sincronización de historia clínica sin pérdida de datos',
        'Calidad de video adaptativa a bajo ancho de banda',
      ],
    },
    regulatory: {
      score: 62,
      label: 'Alto',
      description:
        'Datos de salud = datos sensibles bajo la Ley 21.719. Exige base de licitud, DPA con cada ' +
        'organismo y medidas de seguridad reforzadas. Es el riesgo a gobernar primero.',
      keyFactors: [
        'Ley 21.719 (datos personales sensibles)',
        'Normativa MINSAL de telemedicina y receta electrónica',
        'Interoperabilidad y resguardo de la ficha clínica del Estado',
      ],
    },
    timing: {
      score: 28,
      label: 'Bajo',
      description:
        'Ventana favorable: la pandemia normalizó la teleconsulta y existe voluntad institucional ' +
        '(Hospital Digital, estrategia de salud digital) para escalar telesalud en atención primaria.',
      keyFactors: [
        'Adopción de teleconsulta post-COVID',
        'Hospital Digital y agenda de salud digital MINSAL',
        'Disponibilidad de fondos públicos para innovación en salud',
      ],
    },
  },
  mitigations: [
    'Contratar asesoría legal en datos de salud y firmar un DPA modelo antes del primer piloto',
    'Diseñar la app offline-first con colas de sincronización idempotentes y cifrado en reposo',
    'Acordar SLA de integración con el proveedor de ficha clínica antes de comprometer comunas',
    'Estructurar el primer contrato como piloto pagado acotado para acortar el ciclo de venta',
  ],
};

const UNIT_ECONOMICS = {
  cac: { min: 250000, max: 600000, currency: 'CLP' },
  ltv: { min: 4200000, max: 11000000, currency: 'CLP' },
  ltvCacRatio: { value: 11.3, assessment: 'viable' },
  paybackMonths: { min: 4, max: 9 },
  breakEvenUsers: 14, // comunas/postas contratadas para break-even operacional
  monthlyChurnEstimate: 1.5, // % mensual — contratos anuales B2G, baja rotación
  assumptions: [
    'Contrato anual por comuna/posta entre $4,2M y $11M CLP según número de profesionales',
    'CAC dominado por ciclo de venta institucional (licitación + onboarding clínico)',
    'Retención alta por costo de cambio y dependencia operacional una vez integrado',
  ],
  benchmarkComparison: {
    sector: 'healthtech',
    model: 'b2b2g',
    sector_cac_usd: { min: 400, max: 2500 },
    sector_ltv_usd: { min: 3000, max: 18000 },
    sector_churn_pct: { min: 1, max: 4 },
    your_cac_vs_benchmark: 'in_range',
    your_ltv_vs_benchmark: 'in_range',
    benchmark_note:
      'Healthtech B2B2G (telesalud para prestadores públicos): CAC alto por venta institucional, ' +
      'compensado por LTV elevado y churn bajo gracias a contratos plurianuales.',
  },
};

const FOUNDER_FIT = {
  score: 81,
  dimensions: {
    problemKnowledge: 88,
    industryExperience: 84,
    technicalCapability: 80,
    networkStrength: 76,
    trackRecord: 72,
  },
  assessment:
    'Equipo con fuerte conocimiento del problema y experiencia clínica/operacional en el sistema ' +
    'público de salud, complementado con capacidad técnica para construir la plataforma ' +
    'offline-first. La principal brecha es la experiencia previa cerrando contratos B2G a escala.',
  gaps: [
    'Experiencia comercial vendiendo a municipios y Servicios de Salud (licitaciones)',
    'Antecedentes regulatorios en manejo de datos de salud sensibles',
  ],
  recommendations: [
    'Sumar un asesor con trayectoria en compras públicas de salud (ChileCompra/licitaciones)',
    'Incorporar contraparte legal especializada en Ley 21.719 antes del primer despliegue',
  ],
};

const FOUNDER_CONTEXT = {
  yearsInIndustry: 8,
  hasTechnicalCofounder: true,
  personallyFacedProblem: true,
  hasBuiltBefore: true,
  networkInTargetMarket: 'strong',
  team_composition: 'founding_team',
  traction_status: 'mvp_launched_no_sales',
};

const MARKET_SIGNALS = {
  trendDirection: 'growing',
  trendDescription:
    'La telesalud en atención primaria pública crece de forma sostenida en Chile, impulsada por la ' +
    'normalización de la teleconsulta y la estrategia de salud digital del MINSAL.',
  recentFunding: [
    { company: 'Examedi', amount: 'US$ 20M (Serie A)', date: '2022', source_url: 'https://www.examedi.com' },
    { company: 'Cero (Lab a domicilio)', amount: 'US$ 5M', date: '2021' },
  ],
  timingAssessment: 'optimal',
  timingRationale:
    'Post-pandemia la teleconsulta dejó de ser experimental y pasó a ser una herramienta esperada ' +
    'por gestores de salud; existen fondos públicos e institucionales para escalarla en regiones.',
  relevantNews: [
    { title: 'MINSAL amplía el Hospital Digital y la teleconsulta en atención primaria', impact: 'positive' },
    { title: 'Listas de espera de especialidad siguen sobre los 12 meses en regiones extremas', impact: 'positive' },
    { title: 'Ley 21.719 endurece el tratamiento de datos personales sensibles', impact: 'negative' },
  ],
};

const COMPETITIVE_ANALYSIS = {
  competitors: [
    {
      name: 'Examedi',
      url: 'https://www.examedi.com',
      description: 'Plataforma de salud a domicilio y telemedicina con foco en mercado urbano y privado.',
      target_market: 'Pacientes urbanos, isapres y clínicas privadas',
      strengths: ['Marca y capital (Serie A)', 'Logística de exámenes a domicilio', 'UX consumer pulida'],
      weaknesses: ['Foco urbano/privado', 'No resuelve conectividad rural ni venta B2G', 'Sin modo offline'],
      pricing: 'B2C por consulta / convenios con isapres',
      source: 'ai_identified',
    },
    {
      name: 'TeleMedicina UC CHRISTUS',
      url: 'https://www.ucchristus.cl',
      description: 'Servicio de teleconsulta de un prestador privado de alta complejidad.',
      target_market: 'Pacientes de red privada UC CHRISTUS',
      strengths: ['Respaldo de red hospitalaria', 'Cartera de especialistas', 'Confianza de marca'],
      weaknesses: ['Cerrado a su propia red', 'No diseñado para el sistema público rural', 'Costo elevado'],
      pricing: 'Privado por consulta',
      source: 'ai_identified',
    },
    {
      name: 'Almamedis / Entérate (EHR)',
      url: null,
      description: 'Software de gestión clínica y ficha electrónica para prestadores.',
      target_market: 'Centros médicos y prestadores privados',
      strengths: ['Ficha clínica robusta', 'Integraciones administrativas'],
      weaknesses: ['No es telemedicina offline-first', 'Poca penetración en APS rural pública'],
      pricing: 'SaaS por prestador',
      source: 'ai_identified',
    },
  ],
  market_gaps: [
    {
      gap: 'Ningún actor resuelve la teleconsulta para conectividad rural intermitente (offline-first)',
      opportunity:
        'Ser el estándar de telesalud para la atención primaria pública en zonas extremas, con ' +
        'triage asíncrono que funciona sin señal continua.',
      confidence: 'high',
    },
    {
      gap: 'La oferta actual es B2C/privada; el canal B2B2G público está desatendido',
      opportunity: 'Capturar contratos recurrentes con municipios y Servicios de Salud con bajo churn.',
      confidence: 'medium',
    },
  ],
  unmet_pains: [
    'Pacientes rurales esperan meses y viajan horas para ver a un especialista',
    'Gestores de salud carecen de una herramienta de telesalud que opere sin conectividad estable',
    'La historia clínica no acompaña al paciente entre la posta rural y el especialista urbano',
  ],
  competitive_advantage_suggestion:
    'Posicionar el modo offline-first + integración con la ficha clínica estatal como un foso ' +
    'defendible: una vez integrado y operando sin señal, el costo de cambio para la comuna es alto.',
  data_sources: ['ai_knowledge'],
};

const MARKET_SIZING = {
  tam: {
    value_low: 180000000,
    value_high: 320000000,
    currency: 'USD',
    description: 'Gasto potencial en telesalud y salud digital en Chile (público + privado).',
    source_notes: 'Estimación a partir de gasto en salud y penetración esperada de telesalud.',
    confidence: 'medium',
  },
  sam: {
    value_low: 35000000,
    value_high: 70000000,
    currency: 'USD',
    description: 'Atención primaria pública en comunas rurales y semirrurales (postas + CESFAM).',
    source_notes: 'Acotado al segmento B2B2G de prestadores públicos en territorios con brecha de acceso.',
    confidence: 'medium',
  },
  som: {
    value_low: 2000000,
    value_high: 5500000,
    currency: 'USD',
    description: 'Captura realista a 3 años: 60–120 comunas con contrato anual recurrente.',
    source_notes: 'Asume expansión gradual vía Servicios de Salud tras pilotos pagados exitosos.',
    confidence: 'medium',
    assumptions: [
      'Ticket anual promedio por comuna entre US$ 6k y US$ 14k',
      'Expansión por referencia institucional dentro de cada Servicio de Salud',
      'Tasa de renovación anual > 90%',
    ],
  },
  methodology:
    'Top-down desde gasto en salud digital (TAM) → segmento APS rural público (SAM) → captura por ' +
    'penetración gradual de comunas con contrato recurrente (SOM).',
  data_freshness: 'Estimaciones ilustrativas para Demo 100 — calibrar con datos DEIS/MINSAL antes de fundraising.',
};

const PLAYBOOK_ANALYSIS = {
  harsh_truth:
    'Tu cuello de botella no es la tecnología ni la demanda: es el ciclo de venta al Estado y el ' +
    'cumplimiento de datos de salud. Si no cierras un piloto pagado con un sponsor institucional en ' +
    '6 meses, el mejor producto del mundo se queda en el laboratorio.',
  jtbd_analysis:
    'El "job" del gestor de salud municipal es reducir listas de espera y traslados sin aumentar su ' +
    'carga administrativa ni su exposición legal. MediConnect se contrata para que "mi comuna ' +
    'resuelva especialidad sin mover al paciente y sin que me caiga un sumario por datos".',
  validation_playbook: [
    'Conseguir una carta de intención de un Servicio de Salud como sponsor del piloto',
    'Definir 2–3 comunas faro con peor brecha de acceso y conectividad intermitente real',
    'Correr un piloto pagado de 90 días midiendo tiempo-a-especialista y traslados evitados',
    'Documentar el caso de cumplimiento (Ley 21.719) como activo de venta, no como costo',
    'Convertir el resultado del piloto en una plantilla replicable de licitación',
  ],
  unit_economics_check:
    'Con LTV/CAC ~11x y payback de 4–9 meses, la unidad económica es sólida SIEMPRE que el churn se ' +
    'mantenga bajo vía contratos anuales. El riesgo real es el CAC inflado por ciclos de licitación ' +
    'largos: acórtalos con pilotos pagados de entrada directa.',
  tech_and_legal_stack:
    'Arquitectura offline-first (cola de sincronización idempotente, cifrado en reposo y tránsito), ' +
    'video adaptativo a bajo ancho de banda, e integración con ficha clínica estatal (RAYEN/SIDRA). ' +
    'Capa legal: SpA, DPA por organismo, encargado de prevención y base de licitud para datos sensibles.',
  gtm_and_growth_plan:
    'Go-to-market de tierra: vender al Servicio de Salud, no comuna por comuna. Un piloto exitoso se ' +
    'replica por referencia institucional dentro del mismo Servicio, comprimiendo el CAC en cada ola.',
  funding_verdict:
    'Invertible en etapa pre-seed/seed condicionado a un piloto pagado. Instrumento recomendado: SAFE ' +
    'con fondos no dilutivos de CORFO en paralelo para financiar el cumplimiento y la integración.',
  product_ai_strategy:
    'La IA aporta en el triage asíncrono (priorización de casos) y en resúmenes clínicos para el ' +
    'especialista, no como reemplazo del juicio médico. Mantener al humano en el loop es además un ' +
    'requisito regulatorio y de confianza.',
  founder_bias_warning:
    'Cuidado con el sesgo de "constructor": el equipo tiende a sobre-invertir en features offline y a ' +
    'sub-invertir en el trabajo aburrido pero decisivo de compras públicas y cumplimiento. Ahí se gana.',
  viability_score: VALIDATION_SCORE,
};

// ── Solo Premium ────────────────────────────────────────────────────────────

const GOVERNANCE_ASSESSMENT = {
  recommended_structure:
    'Sociedad por Acciones (SpA) — flexible para entrada de inversionistas vía SAFE y para pacto de ' +
    'accionistas con vesting.',
  founding_team_split:
    'Split 50/45/5 (CEO clínico-comercial / CTO / asesor), evitando el 50-50 plano que bloquea ' +
    'decisiones. Reservar 10–15% para pool de equipo futuro.',
  cap_table_entries: [
    { name: 'Fundador/a CEO', role: 'CEO (clínico/comercial)', percentage: 47, vesting: true, notes: '4 años, 1 de cliff' },
    { name: 'Fundador/a CTO', role: 'CTO (plataforma)', percentage: 43, vesting: true, notes: '4 años, 1 de cliff' },
    { name: 'Asesor de salud pública', role: 'Advisor', percentage: 4, vesting: true },
    { name: 'Pool de equipo (ESOP)', role: 'Reservado', percentage: 6, vesting: false },
  ],
  vesting_recommendation:
    'Vesting de 4 años con 1 año de cliff para ambos fundadores, formalizado en el pacto de ' +
    'accionistas antes de levantar capital.',
  legal_checklist: [
    { item: 'Constitución de SpA', priority: 'critical', description: 'Vía Empresa en un Día; estatutos con clases de acciones.', source: 'Ley 20.190' },
    { item: 'Pacto de accionistas con vesting', priority: 'critical', description: 'Cliff, leaver clauses y reglas de decisión.', source: 'Buenas prácticas VC' },
    { item: 'DPA y base de licitud (datos de salud)', priority: 'critical', description: 'Acuerdo de tratamiento por cada organismo público.', source: 'Ley 21.719' },
    { item: 'Términos de servicio y consentimiento informado', priority: 'important', description: 'Consentimiento de teleconsulta y manejo de datos.', source: 'Normativa MINSAL' },
  ],
  inapi_checklist: [
    { type: 'marca', recommendation: 'Registrar la marca "MediConnect" en clases 9, 42 y 44 (software y servicios de salud) — verificar disponibilidad antes de invertir en branding.', risk: 'critical' },
    { type: 'modelo_utilidad', recommendation: 'Evaluar protección del mecanismo de sincronización offline si resulta novedoso.', risk: 'nice_to_have' },
  ],
  ley_karin_required: true,
  ley_karin_notes:
    'Al contratar equipo, implementar protocolo de prevención de acoso laboral/sexual conforme a la ' +
    'Ley Karin (21.643), aunque el equipo sea pequeño.',
  regulatory_risk: 'high',
  regulatory_notes:
    'El tratamiento de datos de salud es el eje regulatorio. Designar encargado de prevención de ' +
    'datos y auditar seguridad antes de escalar.',
  cap_table_warnings: [
    'Evitar el split 50-50 plano: genera bloqueo en decisiones críticas.',
  ],
  omission_warnings: [
    'No operar pilotos con datos reales de pacientes antes de firmar el DPA correspondiente.',
  ],
};

const FUNDRAISING_ROADMAP = {
  recommended_instrument: 'SAFE',
  instrument_rationale:
    'Un SAFE permite levantar capital rápido sin fijar valoración prematura, apropiado para una etapa ' +
    'con piloto en marcha pero métricas de ingreso aún tempranas.',
  suggested_ticket_size: { min: 150000, max: 400000, currency: 'USD' },
  pre_money_valuation_range: { min: 1500000, max: 3000000, currency: 'USD' },
  corfo_eligibility: {
    program: 'semilla_inicia',
    eligible: true,
    max_amount_clp: 25000000,
    cofinancing_rate: 0.85,
    rationale:
      'Startup chilena en etapa temprana con potencial de impacto y escalamiento; encaja con Semilla ' +
      'Inicia para financiar cumplimiento e integración (capital no dilutivo).',
    gender_bonus_applied: false,
  },
  non_dilutive_options: [
    { type: 'corfo', description: 'Subsidio Semilla Inicia para validación y primeros despliegues.', estimated_amount: 'Hasta $25M CLP', requirement: 'Postulación con patrocinador y co-financiamiento.' },
  ],
  ltv_cac_assessment: {
    ratio_estimate: 11.3,
    payback_months_estimate: 6,
    meets_latam_benchmark: true,
    notes: 'LTV/CAC y payback dentro del rango saludable para SaaS B2B2G en LatAm.',
  },
  recommended_funds: [
    { name: 'Platanus Ventures', focus: 'Pre-seed/seed LatAm, founders técnicos', stage: 'Pre-seed', url: 'https://platan.us' },
    { name: 'Fen Ventures', focus: 'Seed Chile/LatAm', stage: 'Seed', url: null },
    { name: 'Dadneo / The Yield Lab LatAm', focus: 'Impacto y salud', stage: 'Pre-seed/Seed', url: null },
  ],
  pitch_narrative:
    'Chile decidió que la salud digital es política de Estado, pero la última milla rural sigue sin ' +
    'resolver porque nadie construyó para la conectividad intermitente. MediConnect es el estándar ' +
    'offline-first de telesalud para la atención primaria pública: reduce de meses a días el acceso a ' +
    'especialista, con contratos recurrentes y bajo churn.',
  readiness_score: 68,
  readiness_rationale:
    'Producto y problema sólidos; falta convertir el piloto en ingreso recurrente firmado para subir ' +
    'la preparación a fondos institucionales.',
  blockers: [
    'Aún sin contrato pagado firmado con un prestador público',
    'DPA y cumplimiento de datos de salud por formalizar',
  ],
  next_milestones: [
    'Firmar piloto pagado con un Servicio de Salud',
    'Cerrar integración con ficha clínica estatal',
    'Alcanzar 3 comunas con contrato anual recurrente',
  ],
  omission_warnings: [
    'No comprometer valoración con inversionistas antes de tener señal de ingreso recurrente.',
  ],
};

// ── EvidenceWall (validation_agents_log) — solo Premium ─────────────────────

const REDDIT_DATA = {
  status: 'success',
  source: 'reddit_oauth',
  top_discussions: [
    {
      subreddit: 'r/chile',
      title: 'Llevo 11 meses esperando hora con el traumatólogo en región',
      upvotes: 1840,
      sentiment: 'frustration',
      snippet: 'En Santiago consigues hora en semanas, acá en región te mueres esperando. ¿Nadie hace algo con telemedicina?',
      url: 'https://www.reddit.com/r/chile/',
    },
    {
      subreddit: 'r/chile',
      title: 'Tuve que viajar 4 horas a la capital regional para una consulta de 15 minutos',
      upvotes: 1230,
      sentiment: 'concern',
      snippet: 'El pasaje, el día de trabajo perdido, todo por algo que pudo ser por video. El sistema rural está al debe.',
      url: 'https://www.reddit.com/r/chile/',
    },
    {
      subreddit: 'r/medicina',
      title: '¿Experiencias con teleconsulta en postas rurales? ¿Funciona con mala señal?',
      upvotes: 540,
      sentiment: 'curiosity',
      snippet: 'Trabajo en APS y la señal se cae todo el rato. Lo asíncrono sería clave más que el video en vivo.',
      url: 'https://www.reddit.com/r/medicina/',
    },
    {
      subreddit: 'r/emprendedores',
      title: 'Healthtech B2G en Chile: ¿alguien ha vendido a municipios? El ciclo es eterno',
      upvotes: 410,
      sentiment: 'discussion',
      snippet: 'El producto vende solo, el problema es la licitación. Pilotos pagados directos acortan todo.',
      url: 'https://www.reddit.com/r/emprendedores/',
    },
  ],
};

const TRENDS_DATA = {
  status: 'success',
  source: 'serpapi_google_trends',
  keyword: 'telemedicina rural',
  average_interest_last_12_months: 71,
  trend_trajectory: 'upward',
  related_breakout_queries: [
    'teleconsulta CESFAM',
    'hora especialista lista de espera',
    'hospital digital MINSAL',
    'telemedicina posta rural',
  ],
};

const EXECUTIVE_SUMMARY =
  'La señal de campo respalda la tesis de MediConnect: la frustración por las listas de espera y los ' +
  'traslados en el Chile rural es alta y recurrente, mientras el interés de búsqueda en telemedicina ' +
  'rural mantiene una trayectoria al alza. El insight accionable repetido por gestores de salud es que ' +
  'el modo asíncrono/offline importa más que el video en vivo, lo que valida el diferenciador central. ' +
  '(Datos ilustrativos para el Demo 100.)';

// ── Builders ────────────────────────────────────────────────────────────────

/** Fila completa para insertar en `validations`. */
export function buildGoldenValidation(userId: string, tier: Tier): Record<string, unknown> {
  const now = new Date().toISOString();
  const base: Record<string, unknown> = {
    user_id: userId,
    status: 'completed',
    current_step: 4,
    validation_mode: tier === 'premium' ? 'premium' : 'detailed',

    idea_name: GOLDEN_IDEA_NAME,
    idea_description:
      'Plataforma de telemedicina offline-first para la atención primaria pública en zonas rurales de ' +
      'Chile. Conecta postas y CESFAM con especialistas urbanos mediante teleconsulta de bajo ancho de ' +
      'banda y triage asíncrono cuando no hay señal, con la historia clínica sincronizada de forma diferida.',
    idea_industry: 'healthtech',

    customer_segment: 'Municipios y Servicios de Salud rurales (atención primaria pública)',
    customer_pain_points: [
      'Listas de espera de especialidad de 6 a 18 meses en regiones',
      'Traslados largos y costosos de pacientes a centros urbanos',
      'Déficit estructural de especialistas en zonas extremas',
      'La historia clínica no acompaña al paciente entre la posta y el especialista',
    ],
    customer_context:
      'Gestores de salud municipal y de Servicios de Salud presionados por reducir listas de espera y ' +
      'costos de traslado, con conectividad intermitente y exposición legal por datos de pacientes.',

    value_proposition:
      'Reduce de meses a días el acceso a especialista para pacientes rurales, baja los costos de ' +
      'traslado y mantiene la historia clínica disponible incluso sin conexión.',
    differentiator:
      'Arquitectura offline-first con triage asíncrono e integración con la ficha clínica del Estado: ' +
      'funciona donde la telemedicina urbana no llega.',

    mvp_type: 'web_app',
    mvp_features: [
      'Agenda y sala de teleconsulta de bajo ancho de banda',
      'Triage asíncrono para conectividad intermitente',
      'Historia clínica offline-first con sincronización diferida',
      'Panel de gestión para el encargado de salud municipal',
    ],

    validation_score: VALIDATION_SCORE,
    score_breakdown: SCORE_BREAKDOWN,
    ai_feedback: AI_FEEDBACK,
    summary_json: SUMMARY_JSON,

    risk_analysis: RISK_ANALYSIS,
    unit_economics: UNIT_ECONOMICS,
    founder_fit: FOUNDER_FIT,
    founder_context: FOUNDER_CONTEXT,
    market_signals: MARKET_SIGNALS,
    competitive_analysis: COMPETITIVE_ANALYSIS,
    market_sizing: MARKET_SIZING,
    playbook_analysis: PLAYBOOK_ANALYSIS,

    completed_at: now,
  };

  // El músculo Premium: gobernanza + fundraising (la cuenta Pro no los lleva).
  if (tier === 'premium') {
    base.governance_assessment = GOVERNANCE_ASSESSMENT;
    base.fundraising_roadmap = FUNDRAISING_ROADMAP;
  }

  return base;
}

/** Fila para `validation_agents_log` que alimenta el EvidenceWall (solo Premium). */
export function buildGoldenAgentsLog(validationId: string, userId: string): Record<string, unknown> {
  return {
    validation_id: validationId,
    user_id: userId,
    reddit_data: REDDIT_DATA,
    trends_data: TRENDS_DATA,
    reddit_status: 'success',
    trends_status: 'success',
    executive_summary: EXECUTIVE_SUMMARY,
  };
}
