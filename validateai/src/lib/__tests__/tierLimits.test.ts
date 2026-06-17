import { describe, it, expect } from 'vitest';
import { TIER_LIMITS, resolveLimits } from '@/lib/tierLimits';

/**
 * Sync guard (#7): el frontend usa los límites que devuelve el servidor
 * (RPC tier_limit vía get_usage_summary), pero TIER_LIMITS sigue siendo el
 * fallback pre-carga. Este test ancla los valores CANÓNICOS definidos en
 * supabase/migrations/20260624000000_tier_limits_single_source.sql para que
 * el fallback no diverja silenciosamente de lo que el backend realmente aplica.
 *
 * Si cambian los límites: actualizar la función SQL tier_limit() Y estos valores.
 */
const CANONICAL = {
  free:    { total: 3,   expensive: 0   },
  basic:   { total: 15,  expensive: 5   },
  pro:     { total: 50,  expensive: 50  },
  premium: { total: 999, expensive: 999 },
  admin:   { total: 999, expensive: 999 },
} as const;

describe('TIER_LIMITS (fallback pre-carga) ↔ SQL tier_limit()', () => {
  for (const tier of Object.keys(CANONICAL) as (keyof typeof CANONICAL)[]) {
    it(`${tier} coincide con el valor canónico del servidor`, () => {
      expect(TIER_LIMITS[tier]).toEqual(CANONICAL[tier]);
    });
  }
});

describe('resolveLimits — server-authoritative', () => {
  it('usa los límites del servidor cuando están presentes (aunque difieran del fallback)', () => {
    // Caso clave: el server dice 7 pero el constant free dice 3 → gana el server.
    expect(resolveLimits({ total_limit: 7, expensive_limit: 2 }, 'free')).toEqual({ total: 7, expensive: 2 });
  });

  it('cae al fallback del tier cuando el server aún no devolvió límites (pre-carga)', () => {
    expect(resolveLimits(null, 'basic')).toEqual({ total: 15, expensive: 5 });
    expect(resolveLimits(undefined, 'pro')).toEqual({ total: 50, expensive: 50 });
  });

  it('mezcla: usa server para total y fallback para expensive si falta uno', () => {
    expect(resolveLimits({ total_limit: 99 }, 'free')).toEqual({ total: 99, expensive: 0 });
  });

  it('tier desconocido cae a free', () => {
    expect(resolveLimits(null, 'no-existe' as never)).toEqual({ total: 3, expensive: 0 });
  });
});
