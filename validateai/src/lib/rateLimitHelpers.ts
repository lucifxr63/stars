import type { UserTier } from '@/hooks/useUserTier';
import { TIER_LIMITS } from '@/lib/tierLimits';

export type RateLimitReason = 'tier_blocked' | 'monthly_limit' | 'expensive_limit';

/**
 * Determina el tier mínimo que el usuario necesita para desbloquear el análisis.
 * Lógica extraída de useAI.ts para ser testeable de forma aislada.
 */
export function deriveTierNeeded(
  reason: RateLimitReason,
  tierCurrent: UserTier,
): UserTier {
  if (reason === 'tier_blocked')    return 'basic';
  if (reason === 'expensive_limit') return 'pro';
  // monthly_limit: si ya es basic necesita pro, si es free necesita basic
  return tierCurrent === 'free' ? 'basic' : 'pro';
}

/**
 * Calcula los análisis restantes este mes. Nunca retorna negativo.
 */
export function calcRemaining(tier: UserTier, usedTotal: number): number {
  return Math.max(0, TIER_LIMITS[tier].total - usedTotal);
}
