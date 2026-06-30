import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserTier } from '@/hooks/useUserTier';
import { TIER_LIMITS, resolveLimits } from '@/lib/tierLimits';
import { EVENTS } from '@/lib/storageKeys';

export { TIER_LIMITS };

// Evento custom para invalidar el contador sin prop-drilling.
// useAI.ts lo dispara tras cada call exitoso; useUsage lo escucha para refetch.
export const USAGE_UPDATED_EVENT = EVENTS.usageUpdated;

/** Dispara el evento desde cualquier parte de la app (ej: useAI.ts). */
export function dispatchUsageUpdated() {
  window.dispatchEvent(new CustomEvent(USAGE_UPDATED_EVENT));
}

interface UsageSummary {
  period:    string;
  total:     number;
  expensive: number;
  reset_at:  string;
  // Límites devueltos por el servidor (fuente de verdad — RPC tier_limit).
  // Opcionales por retrocompatibilidad: si faltan, caemos al constant TIER_LIMITS.
  total_limit?:     number;
  expensive_limit?: number;
}

export interface UseUsageResult {
  usage:     UsageSummary | null;
  limits:    { total: number; expensive: number };
  remaining: number;
}

export function useUsage(tier: UserTier): UseUsageResult {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  // El servidor es la fuente de verdad; TIER_LIMITS es solo el fallback pre-carga.
  const limits = resolveLimits(usage, tier);

  const refetch = useCallback(async () => {
    // getSession (local, sin red) en vez de getUser: evita retener el Web Lock
    // de gotrue durante una llamada a /auth/v1/user. Con varios consumidores
    // montando a la vez, getUser saturaba el lock → NavigatorLockAcquireTimeout.
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;
    const { data } = await supabase.rpc('get_usage_summary', { p_user_id: user.id });
    if (data) setUsage(data as unknown as UsageSummary);
  }, []);

  useEffect(() => { refetch(); }, [refetch]);

  // Escucha el evento para refrescar cuando useAI.ts completa un call exitoso
  useEffect(() => {
    window.addEventListener(USAGE_UPDATED_EVENT, refetch);
    return () => window.removeEventListener(USAGE_UPDATED_EVENT, refetch);
  }, [refetch]);

  const remaining = Math.max(0, limits.total - (usage?.total ?? 0));

  return { usage, limits, remaining };
}
