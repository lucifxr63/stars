import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type UserTier = 'free' | 'basic' | 'pro' | 'premium';

export const TIER_SECTIONS = {
  free:    ['score', 'breakdown', 'questions', 'nextSteps'],
  basic:   ['score', 'breakdown', 'questions', 'client', 'valueProposition', 'nextSteps', 'risks'],
  pro:     ['score', 'breakdown', 'questions', 'client', 'valueProposition', 'mvp', 'swot', 'nextSteps', 'risks', 'unitEconomics', 'founderFit', 'governance'],
  premium: 'all',
} as const;

export const ALL_SECTIONS = ['score', 'breakdown', 'questions', 'client', 'valueProposition', 'mvp', 'swot', 'nextSteps', 'risks', 'unitEconomics', 'founderFit', 'marketSizing', 'competitiveAnalysis', 'governance', 'fundraising'];

export function getUserSections(tier: UserTier): string[] {
  if (tier === 'premium') return ALL_SECTIONS;
  return [...TIER_SECTIONS[tier]];
}

export function useUserTier() {
  const [tier, setTier] = useState<UserTier>('free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setLoading(false); return; }
      supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          const t = data?.tier as UserTier | undefined;
          setTier(t && ['free', 'basic', 'pro', 'premium'].includes(t) ? t : 'free');
          setLoading(false);
        });
    });
  }, []);

  const isPremium = tier === 'premium';
  return { tier, loading, isPremium };
}
