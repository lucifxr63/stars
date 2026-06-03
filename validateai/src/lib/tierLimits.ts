import type { UserTier } from '@/hooks/useUserTier';

// Fuente de verdad UI — sincronizar con el RPC check_and_increment_usage
// en supabase/migrations/20260603_usage_counters.sql
export const TIER_LIMITS: Record<UserTier, { total: number; expensive: number }> = {
  free:    { total: 3,   expensive: 0   },
  basic:   { total: 15,  expensive: 5   },
  pro:     { total: 50,  expensive: 50  },
  premium: { total: 999, expensive: 999 },
};
