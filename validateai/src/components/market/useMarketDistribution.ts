import type { MarketSizing } from '@/types/validation';
import { REGION_CONFIGS, type Industry, type MapMetric } from './marketRegionConfig';

export interface RegionMarketValue {
  code: string;
  name: string;
  shortName: string;
  rawValue: number;    // valor en USD
  normalized: number;  // 0-1 para altura del mapa
}

function getBaseWeight(cfg: typeof REGION_CONFIGS[0], industry: Industry | null): number {
  // 50% población + 50% PIB como base
  const base = cfg.populationWeight * 0.5 + cfg.gdpWeight * 0.5;
  if (!industry) return base;
  const mult = cfg.industryMultipliers[industry] ?? 1.0;
  return base * mult;
}

export function useMarketDistribution(
  marketSizing: MarketSizing | null,
  industry: string | null,
  metric: MapMetric,
): RegionMarketValue[] {
  if (!marketSizing) return [];

  const tier = marketSizing[metric.toLowerCase() as 'tam' | 'sam' | 'som'];
  if (!tier) return [];

  const totalValue = (tier.value_low + tier.value_high) / 2;
  const ind = (industry as Industry | null);

  // Calcular pesos con ajuste por industria
  const weights = REGION_CONFIGS.map(cfg => ({
    cfg,
    weight: getBaseWeight(cfg, ind),
  }));

  // Normalizar pesos para que sumen 1
  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  const normalized = weights.map(w => ({ ...w, weight: w.weight / totalWeight }));

  // Asignar valor por región
  const values = normalized.map(({ cfg, weight }) => ({
    code: cfg.code,
    name: cfg.name,
    shortName: cfg.shortName,
    rawValue: totalValue * weight,
    normalized: weight, // ya normalizado, representa la proporción
  }));

  // Re-normalizar normalized al rango 0-1 relativo al máximo
  const maxNorm = Math.max(...values.map(v => v.normalized));
  return values.map(v => ({
    ...v,
    normalized: maxNorm > 0 ? v.normalized / maxNorm : 0,
  }));
}

export function formatMarketValue(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${Math.round(value)}`;
}
