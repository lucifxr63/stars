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
  refetch:   () => Promise<void>;
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

  const remaining = Math.max(0, limits.total - (usage?.total ?? 0));

  return { usage, limits, remaining, refetch };
}
