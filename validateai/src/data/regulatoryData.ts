export interface RegulatoryItem {
  id: string;
  title: string;
  entity: string;
  description: string;
  relevantIndustries: string[] | 'all';
  urgency: 'critical' | 'important' | 'informational';
  url: string | null;
  deadline: string | null;
  keyPoints: string[];
}

export const CHILE_REGULATORY: RegulatoryItem[] = [
  {
    id: 'ley-21719-datos',
    title: 'Ley 21.719 — Protección de Datos Personales',
    entity: 'Consejo para la Transparencia (CPLT)',
    description:
      'Nueva ley chilena de protección de datos personales, en vigencia plena desde 2026. Reemplaza la Ley 19.628 y eleva los estándares al nivel del GDPR europeo.',
    relevantIndustries: 'all',
    urgency: 'critical',
    url: 'https://www.bcn.cl/leychile/navegar?idNorma=1203081',
    deadline: '2026-12-31',
    keyPoints: [
      'Requiere base legal para tratar datos personales (consentimiento, contrato, interés legítimo)',
      'Derecho de acceso, rectificación, cancelación y portabilidad de datos',
      'Multas de hasta 5.000 UTM (~$350M CLP) por infracciones graves',
      'Obliga a designar Delegado de Protección de Datos si procesas datos sensibles a gran escala',
      'Privacy by design: la protección debe estar en el diseño del producto desde el inicio',
    ],
  },
  {
    id: 'sii-factura-electronica',
    title: 'SII — Facturación electrónica obligatoria',
    entity: 'Servicio de Impuestos Internos (SII)',
    description:
      'Toda empresa que emita documentos tributarios debe hacerlo vía factura electrónica. Desde 2026, el SII ha reforzado controles para nuevos contribuyentes.',
    relevantIndustries: 'all',
    urgency: 'critical',
    url: 'https://www.sii.cl/factura_electronica/',
    deadline: null,
    keyPoints: [
      'Iniciar actividades en el SII antes de la primera venta',
      'Integrar un proveedor de DTE (Bsale, Defontana, Nubox, u otro autorizado por SII)',
      'Obligación de enviar los documentos al SII en máximo 24 horas',
      'Nuevos SaaS deben evaluar si prestan "servicio digital" con impacto en IVA',
    ],
  },
  {
    id: 'cmf-fintech',
    title: 'Ley Fintech (Ley 21.521) — Regulación CMF',
    entity: 'Comisión para el Mercado Financiero (CMF)',
    description:
      'La Ley Fintech chilena regula plataformas de financiamiento colectivo, intermediación de instrumentos financieros y proveedores de infraestructura de movilidad financiera.',
    relevantIndustries: ['fintech'],
    urgency: 'critical',
    url: 'https://www.cmfchile.cl/portal/principal/613/w3-propertyvalue-47515.html',
    deadline: null,
    keyPoints: [
      'Plataformas de crowdfunding y lending P2P deben inscribirse en el Registro CMF',
      'Open Finance: acceso a datos bancarios con consentimiento del usuario',
      'Capital mínimo requerido según tipo de servicio financiero',
      'Prohíbe operar sin autorización previa en servicios regulados',
    ],
  },
  {
    id: 'isp-registro-electronico',
    title: 'ISP — Registro de productos electrónicos',
    entity: 'Instituto de Salud Pública (ISP)',
    description:
      'Para healthtech o dispositivos médicos digitales, el ISP regula el registro y comercialización de dispositivos médicos y aplicaciones de salud de diagnóstico.',
    relevantIndustries: ['healthtech'],
    urgency: 'critical',
    url: 'https://www.ispch.cl/anamed/dispositivos-medicos/',
    deadline: null,
    keyPoints: [
      'Apps de diagnóstico o monitoreo clínico pueden clasificarse como dispositivo médico clase I, II o III',
      'La clasificación determina el proceso de registro (simple a complejo)',
      'El software "de bienestar" (fitness, wellness) generalmente no requiere registro',
      'Consultar categorización con ISP antes de lanzar si hay funcionalidades diagnósticas',
    ],
  },
  {
    id: 'subtel-telecomunicaciones',
    title: 'SUBTEL — Regulación de telecomunicaciones y apps',
    entity: 'Subsecretaría de Telecomunicaciones (SUBTEL)',
    description:
      'Servicios de telecomunicaciones, VoIP, y plataformas que usen numeración telefónica o radioespectro deben coordinarse con SUBTEL.',
    relevantIndustries: ['saas', 'marketplace', 'social', 'logistics'],
    urgency: 'informational',
    url: 'https://www.subtel.gob.cl/',
    deadline: null,
    keyPoints: [
      'Apps de mensajería o VoIP que procesen llamadas en red pública pueden requerir concesión',
      'Plataformas de logística con flotas propias deben revisar normativa de taxis y transporte',
      'Marketplaces de servicios profesionales deben verificar requisitos sectoriales del servicio listado',
    ],
  },
  {
    id: 'sernac-consumidor',
    title: 'SERNAC — Ley del Consumidor (LPC)',
    entity: 'Servicio Nacional del Consumidor (SERNAC)',
    description:
      'La Ley 19.496 y sus modificaciones regulan el comercio electrónico, contratos de adhesión y derechos del consumidor en Chile.',
    relevantIndustries: ['ecommerce', 'marketplace', 'foodtech', 'proptech'],
    urgency: 'important',
    url: 'https://www.sernac.cl/',
    deadline: null,
    keyPoints: [
      'Derecho a retracto de 10 días hábiles en compras online',
      'Términos y condiciones deben ser claros, legibles y accesibles antes de la compra',
      'Obligación de tener canal de atención al cliente efectivo',
      'Multas de hasta 300 UTM (~$21M CLP) por infracción reiterada',
    ],
  },
];

export function getRegulatoryItems(industry: string): RegulatoryItem[] {
  return CHILE_REGULATORY.filter(
    (item) =>
      item.relevantIndustries === 'all' || item.relevantIndustries.includes(industry),
  ).sort((a, b) => {
    const order = { critical: 0, important: 1, informational: 2 };
    return order[a.urgency] - order[b.urgency];
  });
}
