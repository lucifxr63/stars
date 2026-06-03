/**
 * Lógica pura de resolución de tiers para eventos de Lemon Squeezy.
 * Extraída de supabase/functions/lemonsqueezy-webhook/index.ts para tests.
 */

export type SubscriptionStatus =
  | 'active' | 'on_trial' | 'paused' | 'past_due' | 'unpaid' | 'cancelled' | 'expired';

export type Tier = 'free' | 'basic' | 'pro' | 'premium';

/**
 * Dado un variant ID y un map de variant→tier, devuelve el tier interno.
 * Si el variant no está en el map, devuelve 'free' como fallback seguro.
 */
export function resolveTierFromVariant(
  variantId: string,
  variantToTier: Record<string, Tier>,
): Tier {
  return variantToTier[variantId] ?? 'free';
}

/**
 * Dado el status de una suscripción de LS y el tier del variant,
 * devuelve el tier efectivo que debe quedar en profiles.
 * Solo 'active' y 'on_trial' mantienen el tier pagado; cualquier otro → 'free'.
 */
export function resolveEffectiveTier(status: SubscriptionStatus, variantTier: Tier): Tier {
  const isActive = status === 'active' || status === 'on_trial';
  return isActive ? variantTier : 'free';
}

/**
 * Tipo de evento de tier para audit en tier_events.
 */
export type TierEventType = 'upgrade' | 'downgrade_expired' | 'downgrade_manual' | 'cancel_scheduled';

/**
 * Determina el tipo de evento de auditoría para tier_events.
 */
export function deriveTierEventType(
  prevTier: Tier,
  newTier: Tier,
  lsEvent: string,
): TierEventType | null {
  if (lsEvent === 'subscription_cancelled') return 'cancel_scheduled';
  if (lsEvent === 'subscription_expired')   return 'downgrade_expired';
  if (newTier === prevTier) return null;       // sin cambio → no loguear
  if (newTier === 'free')   return 'downgrade_manual';
  return 'upgrade';
}
