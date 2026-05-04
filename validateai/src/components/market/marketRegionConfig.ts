// Configuración de las 16 regiones de Chile con pesos de mercado
// Basado en datos de PIB regional 2023 (Banco Central de Chile)

export interface RegionConfig {
  code: string;       // Código región
  name: string;       // Nombre oficial
  shortName: string;  // Nombre corto para labels
  // Pesos para distribución de mercado (deben sumar 1.0)
  populationWeight: number; // Peso por población
  gdpWeight: number;        // Peso por PIB regional
  // Ajustes por industria (multiplicador sobre peso base)
  industryMultipliers: Partial<Record<Industry, number>>;
}

export type Industry =
  | 'fintech' | 'edtech' | 'healthtech' | 'ecommerce' | 'saas'
  | 'marketplace' | 'social' | 'logistics' | 'foodtech' | 'proptech' | 'other';

export type MapMetric = 'TAM' | 'SAM' | 'SOM';

export const REGION_CONFIGS: RegionConfig[] = [
  {
    code: 'XV', name: 'Arica y Parinacota', shortName: 'Arica',
    populationWeight: 0.013, gdpWeight: 0.008,
    industryMultipliers: { logistics: 1.8, ecommerce: 0.7 },
  },
  {
    code: 'I', name: 'Tarapacá', shortName: 'Tarapacá',
    populationWeight: 0.018, gdpWeight: 0.022,
    industryMultipliers: { logistics: 1.5, fintech: 1.2 },
  },
  {
    code: 'II', name: 'Antofagasta', shortName: 'Antofagasta',
    populationWeight: 0.035, gdpWeight: 0.085,
    industryMultipliers: { logistics: 2.0, fintech: 1.5, saas: 1.3, proptech: 1.4 },
  },
  {
    code: 'III', name: 'Atacama', shortName: 'Atacama',
    populationWeight: 0.016, gdpWeight: 0.025,
    industryMultipliers: { logistics: 1.5, fintech: 1.2 },
  },
  {
    code: 'IV', name: 'Coquimbo', shortName: 'Coquimbo',
    populationWeight: 0.040, gdpWeight: 0.032,
    industryMultipliers: { foodtech: 1.3, ecommerce: 0.9, proptech: 1.2 },
  },
  {
    code: 'V', name: 'Valparaíso', shortName: 'Valparaíso',
    populationWeight: 0.100, gdpWeight: 0.090,
    industryMultipliers: { logistics: 1.6, ecommerce: 1.2, fintech: 1.3, edtech: 1.2, proptech: 1.4 },
  },
  {
    code: 'RM', name: 'Metropolitana de Santiago', shortName: 'Santiago',
    populationWeight: 0.420, gdpWeight: 0.480,
    industryMultipliers: {
      fintech: 2.0, saas: 2.0, edtech: 1.8, healthtech: 1.8,
      ecommerce: 1.8, marketplace: 2.0, social: 1.8, proptech: 2.0,
    },
  },
  {
    code: 'VI', name: "Lib. Gral. B. O'Higgins", shortName: "O'Higgins",
    populationWeight: 0.050, gdpWeight: 0.042,
    industryMultipliers: { foodtech: 1.5, logistics: 1.2 },
  },
  {
    code: 'VII', name: 'Maule', shortName: 'Maule',
    populationWeight: 0.055, gdpWeight: 0.038,
    industryMultipliers: { foodtech: 1.8, ecommerce: 0.8 },
  },
  {
    code: 'XVI', name: 'Ñuble', shortName: 'Ñuble',
    populationWeight: 0.030, gdpWeight: 0.020,
    industryMultipliers: { foodtech: 1.6, ecommerce: 0.7 },
  },
  {
    code: 'VIII', name: 'Biobío', shortName: 'Biobío',
    populationWeight: 0.085, gdpWeight: 0.075,
    industryMultipliers: { logistics: 1.4, ecommerce: 1.1, fintech: 1.1, saas: 1.0 },
  },
  {
    code: 'IX', name: 'La Araucanía', shortName: 'Araucanía',
    populationWeight: 0.050, gdpWeight: 0.028,
    industryMultipliers: { foodtech: 1.4, edtech: 1.2, ecommerce: 0.8 },
  },
  {
    code: 'XIV', name: 'Los Ríos', shortName: 'Los Ríos',
    populationWeight: 0.024, gdpWeight: 0.018,
    industryMultipliers: { foodtech: 1.3, ecommerce: 0.8 },
  },
  {
    code: 'X', name: 'Los Lagos', shortName: 'Los Lagos',
    populationWeight: 0.046, gdpWeight: 0.038,
    industryMultipliers: { foodtech: 1.5, logistics: 1.3, ecommerce: 0.9 },
  },
  {
    code: 'XI', name: 'Aysén', shortName: 'Aysén',
    populationWeight: 0.006, gdpWeight: 0.008,
    industryMultipliers: { logistics: 1.2 },
  },
  {
    code: 'XII', name: 'Magallanes', shortName: 'Magallanes',
    populationWeight: 0.012, gdpWeight: 0.017,
    industryMultipliers: { logistics: 1.3, ecommerce: 0.6 },
  },
];

// Mapeo nombre GeoJSON → código región
export const GEO_NAME_TO_CODE: Record<string, string> = {
  'Arica y Parinacota': 'XV',
  'Tarapacá': 'I',
  'Antofagasta': 'II',
  'Atacama': 'III',
  'Coquimbo': 'IV',
  'Valparaíso': 'V',
  'Metropolitana de Santiago': 'RM',
  "Libertador Gral. Bernardo O'Higgins": 'VI',
  'Maule': 'VII',
  'Ñuble': 'XVI',
  'Biobío': 'VIII',
  'La Araucanía': 'IX',
  'Los Ríos': 'XIV',
  'Los Lagos': 'X',
  'Aysén del Gral. Carlos Ibáñez del Campo': 'XI',
  'Magallanes y de la Antártica Chilena': 'XII',
};

export const METRIC_COLORS: Record<MapMetric, { low: string; high: string; accent: string }> = {
  TAM: { low: '#1e3a5f', high: '#3b82f6', accent: '#60a5fa' },
  SAM: { low: '#2d1b69', high: '#8b5cf6', accent: '#a78bfa' },
  SOM: { low: '#0d3d38', high: '#14b8a6', accent: '#2dd4bf' },
};
