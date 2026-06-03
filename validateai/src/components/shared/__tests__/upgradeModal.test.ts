import { describe, it, expect } from 'vitest';
import {
  reasonText,
  FEATURE_NAME,
  TIER_INFO,
  type PaywallHitDetail,
} from '../UpgradeModal';

// ── FEATURE_NAME — cobertura de los prompt types más críticos ─────────────────

describe('FEATURE_NAME — tipos costosos cubiertos', () => {
  const EXPENSIVE_TYPES = [
    'competitive_analysis',
    'market_sizing',
    'market_signals',
  ] as const;

  it.each(EXPENSIVE_TYPES)('tiene nombre para el tipo costoso: %s', (type) => {
    expect(FEATURE_NAME[type]).toBeDefined();
    expect(FEATURE_NAME[type].length).toBeGreaterThan(3);
  });

  const PRO_TYPES = [
    'risk_analysis',
    'unit_economics',
    'founder_fit',
    'governance_assessment',
    'fundraising_roadmap',
  ] as const;

  it.each(PRO_TYPES)('tiene nombre para el tipo Pro: %s', (type) => {
    expect(FEATURE_NAME[type]).toBeDefined();
    expect(FEATURE_NAME[type].length).toBeGreaterThan(3);
  });
});

// ── TIER_INFO — integridad de datos de planes ─────────────────────────────────

describe('TIER_INFO — completitud de datos por tier', () => {
  it('todos los tiers pagos tienen precio no vacío', () => {
    for (const tier of ['basic', 'pro', 'premium'] as const) {
      expect(TIER_INFO[tier].price).toBeTruthy();
      expect(TIER_INFO[tier].price).toContain('CLP');
    }
  });

  it('todos los tiers tienen label, color y bg', () => {
    for (const tier of ['free', 'basic', 'pro', 'premium'] as const) {
      expect(TIER_INFO[tier].label).toBeTruthy();
      expect(TIER_INFO[tier].color).toBeTruthy();
      expect(TIER_INFO[tier].bg).toBeTruthy();
    }
  });

  it('basic cuesta menos que pro', () => {
    // Extrae el número del string de precio (ej: "$9.990 CLP/mes" → 9990)
    const toNum = (s: string) => parseInt(s.replace(/\D/g, ''), 10);
    expect(toNum(TIER_INFO.basic.price)).toBeLessThan(toNum(TIER_INFO.pro.price));
    expect(toNum(TIER_INFO.pro.price)).toBeLessThan(toNum(TIER_INFO.premium.price));
  });
});

// ── reasonText — textos de error para el usuario ──────────────────────────────

describe('reasonText — tier_blocked', () => {
  it('menciona el tier requerido', () => {
    const detail: PaywallHitDetail = {
      reason:       'tier_blocked',
      prompt_type:  'competitive_analysis',
      tier_current: 'free',
      tier_needed:  'basic',
    };
    const text = reasonText(detail);
    expect(text).toContain('Basic');
  });
});

describe('reasonText — monthly_limit', () => {
  it('con used/limit muestra el conteo', () => {
    const detail: PaywallHitDetail = {
      reason:       'monthly_limit',
      prompt_type:  'summary',
      tier_current: 'free',
      tier_needed:  'basic',
      used:         3,
      limit:        3,
    };
    const text = reasonText(detail);
    expect(text).toContain('3');
    expect(text).toContain('3/3');
  });

  it('sin used/limit muestra símbolo de interrogación', () => {
    const detail: PaywallHitDetail = {
      reason:       'monthly_limit',
      prompt_type:  'summary',
      tier_current: 'free',
      tier_needed:  'basic',
    };
    const text = reasonText(detail);
    expect(text).toContain('?');
  });

  it('menciona renovación el 1°', () => {
    const detail: PaywallHitDetail = {
      reason:       'monthly_limit',
      prompt_type:  'summary',
      tier_current: 'free',
      tier_needed:  'basic',
    };
    const text = reasonText(detail);
    expect(text).toContain('1°');
  });
});

describe('reasonText — expensive_limit', () => {
  it('con used/limit muestra el conteo de análisis de mercado', () => {
    const detail: PaywallHitDetail = {
      reason:       'expensive_limit',
      prompt_type:  'market_sizing',
      tier_current: 'basic',
      tier_needed:  'pro',
      used:         5,
      limit:        5,
    };
    const text = reasonText(detail);
    expect(text).toContain('5');
  });

  it('menciona renovación el 1°', () => {
    const detail: PaywallHitDetail = {
      reason:       'expensive_limit',
      prompt_type:  'market_signals',
      tier_current: 'basic',
      tier_needed:  'pro',
    };
    const text = reasonText(detail);
    expect(text).toContain('1°');
  });
});
