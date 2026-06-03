import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserTier } from '@/hooks/useUserTier';

// Fuente de verdad de UI — debe mantenerse sincronizado con el RPC
// check_and_increment_usage en supabase/migrations/20260603_usage_counters.sql
export const TIER_LIMITS: Record<UserTier, { total: number; expensive: number }> = {
  free:    { total: 3,   expensive: 0   },
  basic:   { total: 15,  expensive: 5   },
  pro:     { total: 50,  expensive: 50  },
  premium: { total: 999, expensive: 999 },
};

// Evento custom para invalidar el contador sin prop-drilling.
// useAI.ts lo dispara tras cada call exitoso; useUsage lo escucha para refetch.
export const USAGE_UPDATED_EVENT = 'validateai:usage-updated';

/** Dispara el evento desde cualquier parte de la app (ej: useAI.ts). */
export function dispatchUsageUpdated() {
  window.dispatchEvent(new CustomEvent(USAGE_UPDATED_EVENT));
}

interface UsageSummary {
  period:    string;
  total:     number;
  expensive: number;
  reset_at:  string;
}

export interface UseUsageResult {
  usage:     UsageSummary | null;
  limits:    { total: number; expensive: number };
  remaining: number;
}

export function useUsage(tier: UserTier): UseUsageResult {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const limits = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

  const refetch = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.rpc('get_usage_summary', { p_user_id: user.id });
    if (data) setUsage(data as UsageSummary);
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
