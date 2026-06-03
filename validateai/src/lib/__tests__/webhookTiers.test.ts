import { describe, it, expect } from 'vitest';
import {
  resolveTierFromVariant,
  resolveEffectiveTier,
  deriveTierEventType,
  type SubscriptionStatus,
  type Tier,
} from '../webhookTiers';

const VARIANT_MAP: Record<string, Tier> = {
  'var_111': 'basic',
  'var_222': 'pro',
  'var_333': 'premium',
};

// ── resolveTierFromVariant ────────────────────────────────────────────────────

describe('resolveTierFromVariant', () => {
  it('variant conocido → tier correcto', () => {
    expect(resolveTierFromVariant('var_111', VARIANT_MAP)).toBe('basic');
    expect(resolveTierFromVariant('var_222', VARIANT_MAP)).toBe('pro');
    expect(resolveTierFromVariant('var_333', VARIANT_MAP)).toBe('premium');
  });

  it('variant desconocido → "free" como fallback seguro', () => {
    expect(resolveTierFromVariant('var_999', VARIANT_MAP)).toBe('free');
    expect(resolveTierFromVariant('',        VARIANT_MAP)).toBe('free');
  });

  it('map vacío → siempre "free"', () => {
    expect(resolveTierFromVariant('var_111', {})).toBe('free');
  });
});

// ── resolveEffectiveTier ──────────────────────────────────────────────────────

describe('resolveEffectiveTier — estados activos mantienen el tier', () => {
  const ACTIVE: SubscriptionStatus[] = ['active', 'on_trial'];

  it.each(ACTIVE)('status "%s" → mantiene el tier del variant', (status) => {
    expect(resolveEffectiveTier(status, 'pro')).toBe('pro');
    expect(resolveEffectiveTier(status, 'basic')).toBe('basic');
    expect(resolveEffectiveTier(status, 'premium')).toBe('premium');
  });
});

describe('resolveEffectiveTier — estados inactivos degradan a free', () => {
  const INACTIVE: SubscriptionStatus[] = ['paused', 'past_due', 'unpaid', 'cancelled', 'expired'];

  it.each(INACTIVE)('status "%s" → degradar a "free"', (status) => {
    expect(resolveEffectiveTier(status, 'pro')).toBe('free');
    expect(resolveEffectiveTier(status, 'premium')).toBe('free');
  });
});

// ── deriveTierEventType ───────────────────────────────────────────────────────

describe('deriveTierEventType — subscription_created / upgrade', () => {
  it('free → basic = upgrade', () => {
    expect(deriveTierEventType('free', 'basic', 'subscription_created')).toBe('upgrade');
  });

  it('basic → pro = upgrade', () => {
    expect(deriveTierEventType('basic', 'pro', 'subscription_updated')).toBe('upgrade');
  });

  it('pro → pro (renovación) = null (sin cambio)', () => {
    expect(deriveTierEventType('pro', 'pro', 'subscription_updated')).toBeNull();
  });
});

describe('deriveTierEventType — subscription_cancelled', () => {
  it('siempre devuelve cancel_scheduled sin importar el tier', () => {
    expect(deriveTierEventType('pro', 'pro',  'subscription_cancelled')).toBe('cancel_scheduled');
    expect(deriveTierEventType('basic', 'basic', 'subscription_cancelled')).toBe('cancel_scheduled');
  });
});

describe('deriveTierEventType — subscription_expired', () => {
  it('siempre devuelve downgrade_expired', () => {
    expect(deriveTierEventType('pro', 'free', 'subscription_expired')).toBe('downgrade_expired');
  });
});

describe('deriveTierEventType — downgrade manual', () => {
  it('tier cae a free sin ser expired/cancelled = downgrade_manual', () => {
    expect(deriveTierEventType('pro', 'free', 'subscription_updated')).toBe('downgrade_manual');
  });
});
