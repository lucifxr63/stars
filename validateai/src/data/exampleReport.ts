import type { ScoreBreakdown, MarketSizing, CompetitiveAnalysis, RiskAnalysis, UnitEconomics } from '@/types/validation';

export const EXAMPLE_IDEA = {
  idea_name: 'FreshBox',
  idea_description:
    'Servicio de suscripción de cajas de verduras y frutas orgánicas con entrega semanal a domicilio en Santiago. Las cajas se arman según preferencias del usuario y provienen de agricultores locales verificados.',
  idea_industry: 'ecommerce',
  target_country: 'Chile',
  target_region: 'Región Metropolitana',
  business_model: 'b2c',
  business_stage: 'idea',
  pricing_range: '10-50 USD',
};

export const EXAMPLE_SCORE = 78;

export const EXAMPLE_SCORE_BREAKDOWN: ScoreBreakdown = {
  problem: 82,
  market: 85,
  competition: 65,
  solution: 80,
  execution: 72,
};

export const EXAMPLE_AI_FEEDBACK =
  'FreshBox aborda un problema real y creciente: el acceso a alimentos frescos y orgánicos de forma conveniente. El mercado chileno de delivery de alimentos ha crecido 40% post-pandemia y hay espacio para un jugador especializado en orgánicos. El mayor riesgo es la logística de última milla y la fidelización del cliente en un mercado con baja lealtad a suscripciones.';

export const EXAMPLE_QUESTIONS_ANSWERS = [
  {
    question: '¿Quién es tu cliente ideal y cuál es su mayor frustración hoy?',
    answer:
      'Familias urbanas de 25-45 años con hijos que quieren comer sano pero no tienen tiempo de ir al mercado a elegir productos de calidad.',
    ai_followup:
      'Interesante. ¿Qué los detiene de comprar en el supermercado habitual? ¿Es el precio, la calidad o la experiencia?',
  },
  {
    question: '¿Por qué alguien te elegiría sobre un supermercado con delivery?',
    answer:
      'Porque nosotros garantizamos origen local verificado, temporada y orgánico certificado. El supermercado tiene conveniencia pero no autenticidad.',
    ai_followup:
      '¿Cómo validarías que ese diferenciador justifica un precio premium? ¿Has hablado con clientes potenciales?',
  },
  {
    question: '¿Cuál es el costo de adquisición estimado de un cliente?',
    answer:
      'Calculamos unos $8.000 CLP por cliente mediante Instagram + referidos. El LTV estimado es $180.000 CLP anuales si se queda 6 meses.',
    ai_followup: null,
  },
];

export const EXAMPLE_CUSTOMER = {
  customer_segment:
    'Familias urbanas ABC1-C2 en Providencia, Las Condes y Ñuñoa, con ingresos sobre $1.5M CLP mensuales, que valoran la salud y la sostenibilidad.',
  customer_pain_points: [
    'No confían en la calidad y origen de los vegetales del supermercado',
    'No tienen tiempo para ir al mercado campesino los fines de semana',
    'Compran más de lo necesario y terminan botando comida',
  ],
  customer_context:
    'Este segmento ya paga por servicios premium como Netflix y gimnasios. Tiene smartphones y usa apps habitualmente. La pandemia normalizó el delivery y cambiaron sus hábitos de consumo.',
};

export const EXAMPLE_VALUE_PROP = {
  value_proposition:
    'La única caja de verduras y frutas 100% orgánicas de agricultores locales verificados, armada según tus preferencias y entregada en tu puerta cada semana — sin ir al mercado y sin sorpresas.',
  differentiator:
    'Trazabilidad completa del origen del producto + curaduría personalizada por preferencias + red propia de agricultores con certificación verificada.',
};

export const EXAMPLE_MVP = {
  mvp_type: 'web_app',
  mvp_features: [
    { name: 'Configurador de caja', description: 'Seleccionar tamaño y preferencias básicas', priority: 'must' as const },
    { name: 'Suscripción semanal', description: 'Cobro recurrente con Transbank o Mercado Pago', priority: 'must' as const },
    { name: 'Tracking de entrega', description: 'Notificación SMS del estado del pedido', priority: 'should' as const },
    { name: 'Perfil del agricultor', description: 'Historia y fotos del productor detrás de cada caja', priority: 'could' as const },
  ],
  mvp_user_flow:
    'Landing → Configura tu caja (tamaño + restricciones) → Selecciona día de entrega → Pago → Confirmación por email → Recordatorio 24h antes → Entrega + encuesta de satisfacción',
};

export const EXAMPLE_MARKET_SIZING: MarketSizing = {
  tam: {
    value_low: 800_000_000,
    value_high: 1_200_000_000,
    currency: 'CLP',
    description: 'Mercado total de alimentos frescos con delivery en Chile',
    source_notes: 'INE 2024 + estimaciones Euromonitor',
    confidence: 'medium',
    assumptions: ['Penetración de internet 85% en RM', 'Gasto promedio familia en alimentos frescos'],
  },
  sam: {
    value_low: 150_000_000,
    value_high: 280_000_000,
    currency: 'CLP',
    description: 'Segmento orgánicos premium en Región Metropolitana',
    source_notes: 'ODEPA + estimación de mercado orgánico certificado Chile 2024',
    confidence: 'medium',
    assumptions: ['ABC1-C2 representan 30% de la RM', 'Conversión del 15% al canal online'],
  },
  som: {
    value_low: 5_000_000,
    value_high: 18_000_000,
    currency: 'CLP',
    description: 'Mercado alcanzable en primeros 18 meses con marketing focalizado',
    source_notes: 'Proyección con 500–1800 suscriptores activos a $10.000 CLP/semana',
    confidence: 'low',
    assumptions: ['Capacidad logística para 500–1800 entregas/semana', 'Budget marketing $2M CLP primer año'],
  },
  methodology: 'Top-down desde datos de mercado de alimentos orgánicos ODEPA + bottom-up desde CAC estimado y capacidad operativa.',
  data_freshness: '2024',
};

export const EXAMPLE_COMPETITIVE: CompetitiveAnalysis = {
  competitors: [
    {
      name: 'Canasta Verde',
      url: null,
      description: 'Cajas de verduras orgánicas en Santiago, sin personalización',
      target_market: 'Chile — Región Metropolitana',
      strengths: ['Marca establecida', 'Red de proveedores'],
      weaknesses: ['Sin personalización', 'UX web anticuada', 'Sin app'],
      pricing: '~$22.000 CLP / caja semanal',
      source: 'ai_identified',
    },
    {
      name: 'Cornershop / Uber Eats',
      url: null,
      description: 'Delivery genérico con sección de supermercados',
      target_market: 'Latinoamérica',
      strengths: ['Red logística masiva', 'Marca conocida'],
      weaknesses: ['No especializado en orgánicos', 'Sin trazabilidad de origen'],
      pricing: 'Variable según supermercado',
      source: 'ai_identified',
    },
  ],
  market_gaps: [
    {
      gap: 'Personalización real por preferencias del hogar',
      opportunity: 'Primera caja 100% adaptada a restricciones y gustos familiares',
      confidence: 'high',
    },
    {
      gap: 'Trazabilidad verificada del origen',
      opportunity: 'QR por producto con historia del agricultor y certificación',
      confidence: 'medium',
    },
  ],
  unmet_pains: [
    'Desconfianza en la certificación orgánica de los supermercados',
    'Desperdicio por no saber qué vendrá en la caja',
    'Falta de vínculo con el productor local',
  ],
  competitive_advantage_suggestion:
    'Enfócate en la trazabilidad como diferenciador emocional. Un QR que conecte al cliente con "María de Curacaví, que cultivó tus zanahorias" genera una lealtad que ningún supermercado puede replicar.',
  data_sources: ['Google Search', 'Instagram búsqueda orgánicos Chile', 'ODEPA registros orgánicos 2024'],
};

export const EXAMPLE_RISK: RiskAnalysis = {
  overallRiskScore: 42,
  dimensions: {
    market: {
      score: 35,
      label: 'Riesgo de Mercado',
      description: 'El mercado orgánico crece pero la sensibilidad al precio es alta en recesión',
      keyFactors: ['Crecimiento sostenido post-pandemia', 'Competencia de supermercados con sección orgánica'],
    },
    technical: {
      score: 25,
      label: 'Riesgo Técnico',
      description: 'Plataforma web/app con complejidad moderada, sin barreras técnicas mayores',
      keyFactors: ['Integración de pagos recurrentes', 'Optimización de rutas de entrega'],
    },
    regulatory: {
      score: 30,
      label: 'Riesgo Regulatorio',
      description: 'Certificación orgánica requiere cumplir normativa SAG, bajo riesgo con proveedores ya certificados',
      keyFactors: ['Ley 20.606 sobre alimentación saludable', 'Normas SAG para orgánicos certificados'],
    },
    timing: {
      score: 40,
      label: 'Riesgo de Timing',
      description: 'Momento favorable pero con señales mixtas por inflación en alimentos',
      keyFactors: ['Tendencia healthtech en alza', 'Inflación alimentaria reduce gasto en premium'],
    },
  },
  mitigations: [
    'Empezar con preventa de 50 suscriptores antes de lanzar para validar demanda real',
    'Negociar con 3+ agricultores para no depender de uno solo',
    'Ofrecer pausa de suscripción para reducir churn por vacaciones',
  ],
};

export const EXAMPLE_UNIT_ECONOMICS: UnitEconomics = {
  cac: { min: 6000, max: 12000, currency: 'CLP' },
  ltv: { min: 120000, max: 240000, currency: 'CLP' },
  ltvCacRatio: { value: 15, assessment: 'viable' },
  paybackMonths: { min: 1, max: 2 },
  breakEvenUsers: 280,
  monthlyChurnEstimate: 8,
  assumptions: [
    'Precio suscripción semanal: $19.900 CLP',
    'Margen bruto estimado: 35%',
    'Costo logística por entrega: $2.500 CLP',
    'Canal principal: Instagram + referidos',
  ],
};
