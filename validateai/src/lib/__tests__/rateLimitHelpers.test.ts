import { describe, it, expect } from 'vitest';
import { TIER_LIMITS } from '@/lib/tierLimits';
import { deriveTierNeeded, calcRemaining } from '@/lib/rateLimitHelpers';

// ── TIER_LIMITS — contrato con el RPC del servidor ────────────────────────────
// Si estos valores cambian aquí, DEBEN cambiarse también en:
//   supabase/migrations/20260603_usage_counters.sql (función check_and_increment_usage)

describe('TIER_LIMITS — contratos por tier', () => {
  it('free: 3 análisis totales, 0 costosos', () => {
    expect(TIER_LIMITS.free.total).toBe(3);
    expect(TIER_LIMITS.free.expensive).toBe(0);
  });

  it('basic: 15 análisis totales, 5 costosos', () => {
    expect(TIER_LIMITS.basic.total).toBe(15);
    expect(TIER_LIMITS.basic.expensive).toBe(5);
  });

  it('pro: 50 análisis totales, 50 costosos', () => {
    expect(TIER_LIMITS.pro.total).toBe(50);
    expect(TIER_LIMITS.pro.expensive).toBe(50);
  });

  it('premium: 999 análisis totales, 999 costosos', () => {
    expect(TIER_LIMITS.premium.total).toBe(999);
    expect(TIER_LIMITS.premium.expensive).toBe(999);
  });

  it('los 4 tiers están definidos y no undefined', () => {
    for (const tier of ['free', 'basic', 'pro', 'premium'] as const) {
      expect(TIER_LIMITS[tier]).toBeDefined();
      expect(typeof TIER_LIMITS[tier].total).toBe('number');
      expect(typeof TIER_LIMITS[tier].expensive).toBe('number');
    }
  });

  it('expensive siempre ≤ total por tier', () => {
    for (const tier of ['free', 'basic', 'pro', 'premium'] as const) {
      expect(TIER_LIMITS[tier].expensive).toBeLessThanOrEqual(TIER_LIMITS[tier].total);
    }
  });

  it('total crece con el tier (free < basic < pro < premium)', () => {
    expect(TIER_LIMITS.free.total).toBeLessThan(TIER_LIMITS.basic.total);
    expect(TIER_LIMITS.basic.total).toBeLessThan(TIER_LIMITS.pro.total);
    expect(TIER_LIMITS.pro.total).toBeLessThan(TIER_LIMITS.premium.total);
  });
});

// ── deriveTierNeeded ──────────────────────────────────────────────────────────

describe('deriveTierNeeded', () => {
  it('tier_blocked siempre requiere basic (free no puede acceder a análisis costosos)', () => {
    expect(deriveTierNeeded('tier_blocked', 'free')).toBe('basic');
  });

  it('expensive_limit siempre requiere pro', () => {
    expect(deriveTierNeeded('expensive_limit', 'basic')).toBe('pro');
    expect(deriveTierNeeded('expensive_limit', 'free')).toBe('pro');
  });

  it('monthly_limit con tier free → requiere basic', () => {
    expect(deriveTierNeeded('monthly_limit', 'free')).toBe('basic');
  });

  it('monthly_limit con tier basic → requiere pro', () => {
    expect(deriveTierNeeded('monthly_limit', 'basic')).toBe('pro');
  });

  it('monthly_limit con tier pro → requiere pro (no pro-plus)', () => {
    // Pro en límite mensual: el upgrade natural sería premium,
    // pero devolvemos 'pro' para mantener coherencia — en práctica pro tiene 50 calls
    expect(deriveTierNeeded('monthly_limit', 'pro')).toBe('pro');
  });
});

// ── calcRemaining ─────────────────────────────────────────────────────────────

describe('calcRemaining', () => {
  it('usuario free con 0 llamadas tiene 3 restantes', () => {
    expect(calcRemaining('free', 0)).toBe(3);
  });

  it('usuario free con 2 llamadas tiene 1 restante', () => {
    expect(calcRemaining('free', 2)).toBe(1);
  });

  it('usuario free con 3 llamadas (límite exacto) tiene 0 restantes', () => {
    expect(calcRemaining('free', 3)).toBe(0);
  });

  it('nunca retorna negativo aunque supere el límite', () => {
    // Caso de condición de carrera: contador llega a 4 en free
    expect(calcRemaining('free', 4)).toBe(0);
    expect(calcRemaining('free', 999)).toBe(0);
  });

  it('usuario basic con 10 llamadas tiene 5 restantes', () => {
    expect(calcRemaining('basic', 10)).toBe(5);
  });

  it('usuario pro con 49 llamadas tiene 1 restante', () => {
    expect(calcRemaining('pro', 49)).toBe(1);
  });

  it('usuario premium con 500 llamadas tiene 499 restantes', () => {
    expect(calcRemaining('premium', 500)).toBe(499);
  });
});
