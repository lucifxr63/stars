export interface RegionData {
  code: string;
  name: string;
  population: number;
  gdpPerCapitaClp: number;
  internetPenetration: number;
  ecommercePenetration: number;
  startupEcosystem: 'strong' | 'developing' | 'nascent';
  keyIndustries: string[];
  corfoOffice: boolean;
  notes: string;
}

export const CHILE_REGIONS: RegionData[] = [
  {
    code: 'RM',
    name: 'Región Metropolitana',
    population: 8_125_072,
    gdpPerCapitaClp: 18_500_000,
    internetPenetration: 92,
    ecommercePenetration: 68,
    startupEcosystem: 'strong',
    keyIndustries: ['fintech', 'edtech', 'healthtech', 'saas', 'marketplace'],
    corfoOffice: true,
    notes: 'Principal hub de startups. Concentra ~95% del ecosistema de venture capital chileno. Ideal para B2C masivo y B2B enterprise.',
  },
  {
    code: 'V',
    name: 'Región de Valparaíso',
    population: 1_958_522,
    gdpPerCapitaClp: 10_200_000,
    internetPenetration: 82,
    ecommercePenetration: 55,
    startupEcosystem: 'developing',
    keyIndustries: ['logistics', 'ecommerce', 'proptech', 'foodtech'],
    corfoOffice: true,
    notes: 'Segundo hub tecnológico. Puerto de Valparaíso = oportunidades en logística y comercio exterior. Universidad Federico Santa María = talento técnico.',
  },
  {
    code: 'VIII',
    name: 'Región del Biobío',
    population: 1_556_805,
    gdpPerCapitaClp: 8_900_000,
    internetPenetration: 79,
    ecommercePenetration: 48,
    startupEcosystem: 'developing',
    keyIndustries: ['logistics', 'foodtech', 'marketplace', 'saas'],
    corfoOffice: true,
    notes: 'Gran base industrial (forestal, pesquera, manufactura). Ecosistema universitario activo. Oportunidades en digitalización de industrias tradicionales.',
  },
  {
    code: 'II',
    name: 'Región de Antofagasta',
    population: 691_854,
    gdpPerCapitaClp: 22_000_000,
    internetPenetration: 88,
    ecommercePenetration: 52,
    startupEcosystem: 'developing',
    keyIndustries: ['logistics', 'saas', 'fintech'],
    corfoOffice: true,
    notes: 'PIB per cápita más alto de Chile por minería. Demanda de soluciones B2B para minería y logística. Menor densidad poblacional pero poder adquisitivo alto.',
  },
  {
    code: 'IX',
    name: 'Región de La Araucanía',
    population: 1_014_343,
    gdpPerCapitaClp: 5_200_000,
    internetPenetration: 68,
    ecommercePenetration: 35,
    startupEcosystem: 'nascent',
    keyIndustries: ['foodtech', 'ecommerce', 'edtech'],
    corfoOffice: true,
    notes: 'Una de las regiones con mayor pobreza. Brechas digitales significativas. Oportunidades en inclusión financiera, agtech y educación rural.',
  },
];

export function getRegionData(regionName: string): RegionData | null {
  const normalized = regionName.toLowerCase();
  return (
    CHILE_REGIONS.find(
      (r) =>
        r.name.toLowerCase().includes(normalized) ||
        normalized.includes(r.code.toLowerCase()),
    ) ?? null
  );
}

export interface LatamCountryData {
  name: string;
  code: string;
  population: number;
  gdpPerCapitaUsd: number;
  internetPenetration: number;
  paymentMethods: string[];
  startupEcosystem: 'strong' | 'developing' | 'nascent';
  entryBarriers: 'low' | 'medium' | 'high';
  notes: string;
}

export const LATAM_COUNTRIES: LatamCountryData[] = [
  { name: 'Chile', code: 'CL', population: 19_600_000, gdpPerCapitaUsd: 16_500, internetPenetration: 90, paymentMethods: ['Transbank', 'Mercado Pago', 'Tarjeta', 'Transferencia'], startupEcosystem: 'strong', entryBarriers: 'low', notes: 'Mercado maduro, alto poder adquisitivo, fácil de incorporar empresa.' },
  { name: 'México', code: 'MX', population: 128_000_000, gdpPerCapitaUsd: 11_200, internetPenetration: 78, paymentMethods: ['SPEI', 'OXXO', 'Mercado Pago', 'Tarjeta'], startupEcosystem: 'strong', entryBarriers: 'medium', notes: 'Mercado masivo. CDMX es el hub principal. Alta informalidad (OXXO como medio de pago es clave).' },
  { name: 'Colombia', code: 'CO', population: 51_000_000, gdpPerCapitaUsd: 7_200, internetPenetration: 73, paymentMethods: ['PSE', 'Nequi', 'Daviplata', 'Efecty'], startupEcosystem: 'strong', entryBarriers: 'medium', notes: 'Bogotá es el segundo hub de startups en LATAM. Fintech muy activo.' },
  { name: 'Argentina', code: 'AR', population: 46_000_000, gdpPerCapitaUsd: 9_800, internetPenetration: 87, paymentMethods: ['Mercado Pago', 'Tarjeta', 'Transferencia'], startupEcosystem: 'strong', entryBarriers: 'high', notes: 'Gran talento técnico y penetración digital, pero riesgo regulatorio y cambiario alto.' },
  { name: 'Perú', code: 'PE', population: 33_000_000, gdpPerCapitaUsd: 7_600, internetPenetration: 70, paymentMethods: ['Yape', 'PagoEfectivo', 'Tarjeta', 'BCP'], startupEcosystem: 'developing', entryBarriers: 'medium', notes: 'Crecimiento sostenido. Lima concentra el mercado. Yape tiene penetración masiva.' },
  { name: 'Brasil', code: 'BR', population: 215_000_000, gdpPerCapitaUsd: 9_100, internetPenetration: 84, paymentMethods: ['Pix', 'Boleto', 'Tarjeta', 'Mercado Pago'], startupEcosystem: 'strong', entryBarriers: 'high', notes: 'Mercado enorme pero requiere localización completa (portugués, regulación propia, Pix).' },
];
