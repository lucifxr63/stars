export interface CorfoInstrument {
  id: string;
  name: string;
  acronym: string;
  category: 'seed' | 'innovation' | 'acceleration' | 'internationalization' | 'credit';
  description: string;
  maxAmountClp: number | null;
  stages: ('idea' | 'pre-product' | 'early' | 'growth')[];
  industries: string[] | 'all';
  businessModels: ('b2b' | 'b2c' | 'b2b2c' | 'marketplace')[] | 'all';
  url: string;
  deadline: string | null;
  requirements: string[];
}

export const CORFO_INSTRUMENTS: CorfoInstrument[] = [
  {
    id: 'startup-ciencia',
    name: 'Startup Ciencia',
    acronym: 'SC',
    category: 'seed',
    description: 'Fondo para emprendimientos basados en ciencia o tecnología en etapas tempranas. Cofinancia investigación aplicada y prototipado.',
    maxAmountClp: 100_000_000,
    stages: ['idea', 'pre-product'],
    industries: ['healthtech', 'fintech', 'edtech', 'saas', 'logistics'],
    businessModels: 'all',
    url: 'https://www.corfo.cl/sites/cpp/emprender/startup_ciencia',
    deadline: null,
    requirements: [
      'Emprendedor chileno o residente con visa vigente',
      'Idea con base tecnológica o científica',
      'Postulación en portal CORFO',
    ],
  },
  {
    id: 'capital-semilla-emprendedor',
    name: 'Capital Semilla Emprendedor',
    acronym: 'CSE',
    category: 'seed',
    description: 'Subsidio para iniciar o fortalecer un emprendimiento con potencial de crecimiento. Hasta $20M CLP para validación y primeras ventas.',
    maxAmountClp: 20_000_000,
    stages: ['idea', 'pre-product', 'early'],
    industries: 'all',
    businessModels: 'all',
    url: 'https://www.corfo.cl/sites/cpp/emprender/capital_semilla',
    deadline: null,
    requirements: [
      'Persona natural chilena o extranjera con RUT',
      'Negocio con menos de 3 años de operación',
      'Proyecto con proyección de ventas demostrables',
    ],
  },
  {
    id: 'programa-startup',
    name: 'Programa de Apoyo al Entorno Emprendedor',
    acronym: 'PAE',
    category: 'acceleration',
    description: 'Apoyo para aceleradoras e incubadoras que trabajan con startups en etapas tempranas.',
    maxAmountClp: 200_000_000,
    stages: ['early', 'growth'],
    industries: 'all',
    businessModels: 'all',
    url: 'https://www.corfo.cl/sites/cpp/emprender',
    deadline: null,
    requirements: [
      'Pertenecer a una incubadora o aceleradora CORFO reconocida',
      'Producto o servicio con ventas iniciales',
    ],
  },
  {
    id: 'subsidio-innovacion-empresarial',
    name: 'Subsidio a la Innovación Empresarial Individual',
    acronym: 'SIE',
    category: 'innovation',
    description: 'Cofinanciamiento para proyectos de innovación en empresa ya constituida. Ideal para startups con primeras ventas que quieren escalar.',
    maxAmountClp: 120_000_000,
    stages: ['early', 'growth'],
    industries: 'all',
    businessModels: ['b2b', 'b2b2c', 'marketplace'],
    url: 'https://www.corfo.cl/sites/cpp/innovacion',
    deadline: null,
    requirements: [
      'Empresa constituida con RUT empresa',
      'Ventas anuales entre UF 2.400 y UF 100.000',
      'Proyecto de innovación diferenciador',
    ],
  },
  {
    id: 'go-global',
    name: 'Go Global',
    acronym: 'GG',
    category: 'internationalization',
    description: 'Subsidio para que startups chilenas desarrollen su primer proceso de internacionalización a mercados como México, Colombia o España.',
    maxAmountClp: 45_000_000,
    stages: ['early', 'growth'],
    industries: ['saas', 'fintech', 'edtech', 'marketplace', 'ecommerce'],
    businessModels: ['b2b', 'b2b2c', 'saas' as never],
    url: 'https://www.corfo.cl/sites/cpp/go_global',
    deadline: null,
    requirements: [
      'Empresa chilena con al menos 1 año de operación',
      'Producto o servicio con tracción local demostrada',
      'Plan de internacionalización documentado',
    ],
  },
  {
    id: 'innova-corfo',
    name: 'INNOVA CORFO — Escalamiento',
    acronym: 'IC',
    category: 'innovation',
    description: 'Fondo de cofinanciamiento no reembolsable para proyectos de innovación tecnológica con alto potencial de impacto económico.',
    maxAmountClp: 300_000_000,
    stages: ['growth'],
    industries: 'all',
    businessModels: 'all',
    url: 'https://www.corfo.cl/sites/cpp/innova_corfo',
    deadline: null,
    requirements: [
      'Empresa con RUT y ventas anuales superiores a UF 2.400',
      'Proyecto de I+D aplicado con componente de innovación disruptiva',
      'Presentar contraparte financiera (30% del proyecto)',
    ],
  },
];

export interface CorfoMatch {
  instrument: CorfoInstrument;
  matchScore: number;
  matchReasons: string[];
}

export function matchCorfoInstruments(params: {
  stage: string;
  industry: string;
  businessModel: string;
}): CorfoMatch[] {
  const { stage, industry, businessModel } = params;

  return CORFO_INSTRUMENTS
    .map((inst): CorfoMatch => {
      let score = 0;
      const reasons: string[] = [];

      const stageMatch = inst.stages.includes(stage as CorfoInstrument['stages'][number]);
      if (stageMatch) { score += 40; reasons.push(`Disponible para etapa "${stage}"`); }

      const industryMatch =
        inst.industries === 'all' || inst.industries.includes(industry);
      if (industryMatch) { score += 30; reasons.push('Aplica a tu industria'); }

      const modelMatch =
        inst.businessModels === 'all' || inst.businessModels.includes(businessModel as never);
      if (modelMatch) { score += 30; reasons.push('Compatible con tu modelo de negocio'); }

      return { instrument: inst, matchScore: score, matchReasons: reasons };
    })
    .filter((m) => m.matchScore >= 40)
    .sort((a, b) => b.matchScore - a.matchScore);
}
