import type { UserTier } from '@/hooks/useUserTier';

export interface TierLimits { total: number; expensive: number }

// Fallback PRE-CARGA solamente. La fuente de verdad es el servidor: la RPC
// tier_limit() (supabase/migrations/20260624000000_tier_limits_single_source.sql),
// cuyos valores devuelve get_usage_summary. El test tierLimits.test.ts ancla estos
// valores a los del SQL para que no diverjan.
export const TIER_LIMITS: Record<UserTier, TierLimits> = {
  free:    { total: 3,   expensive: 0   },
  basic:   { total: 15,  expensive: 5   },
  pro:     { total: 50,  expensive: 50  },
  premium: { total: 999, expensive: 999 },
  admin:   { total: 999, expensive: 999 },
};

/**
 * Resuelve los límites efectivos priorizando los del servidor (server-authoritative).
 * Cae al constant TIER_LIMITS solo mientras el summary aún no cargó (pre-carga).
 */
export function resolveLimits(
  serverLimits: { total_limit?: number; expensive_limit?: number } | null | undefined,
  tier: UserTier,
): TierLimits {
  const fallback = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  return {
    total:     serverLimits?.total_limit     ?? fallback.total,
    expensive: serverLimits?.expensive_limit ?? fallback.expensive,
  };
}
