import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { STORAGE_KEYS, EVENTS } from '@/lib/storageKeys';

export type UserTier = 'free' | 'basic' | 'pro' | 'premium' | 'admin';

export const TIER_SECTIONS = {
  free:    ['score', 'breakdown', 'questions', 'nextSteps'],
  basic:   ['score', 'breakdown', 'questions', 'nextSteps', 'competitiveAnalysis', 'valueProposition', 'client'],
  pro:     'all',
  premium: 'all',
  admin:   'all',
} as const;

export const ALL_SECTIONS = ['score', 'breakdown', 'questions', 'client', 'valueProposition', 'mvp', 'swot', 'nextSteps', 'risks', 'unitEconomics', 'founderFit', 'marketSizing', 'competitiveAnalysis', 'governance', 'fundraising'];

export function getUserSections(tier: UserTier): string[] {
  if (tier === 'pro' || tier === 'premium' || tier === 'admin') return [...ALL_SECTIONS];
  return [...TIER_SECTIONS[tier]];
}

// ── Preview override (admin only) ────────────────────────────────────────────
const PREVIEW_TIER_KEY = STORAGE_KEYS.previewTier.to;
const PREVIEW_EVENT    = EVENTS.tierPreview;
const VALID_TIERS      = ['free', 'basic', 'pro', 'premium', 'admin'] as const;

export function getPreviewTier(): UserTier | null {
  const v = localStorage.getItem(PREVIEW_TIER_KEY);
  return (v && (VALID_TIERS as readonly string[]).includes(v)) ? (v as UserTier) : null;
}

export function setPreviewTier(t: UserTier | null) {
  if (t) localStorage.setItem(PREVIEW_TIER_KEY, t);
  else localStorage.removeItem(PREVIEW_TIER_KEY);
  window.dispatchEvent(new CustomEvent(PREVIEW_EVENT, { detail: t }));
}

// ─────────────────────────────────────────────────────────────────────────────

export function useUserTier() {
  const [tier, setTier] = useState<UserTier>(() => getPreviewTier() ?? 'free');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const preview = getPreviewTier();
    if (preview) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      const user = session?.user;
      if (!user) { setLoading(false); return; }
      supabase
        .from('profiles')
        .select('tier')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const t = data?.tier as UserTier | undefined;
          setTier(t && (VALID_TIERS as readonly string[]).includes(t) ? t : 'free');
          setLoading(false);
        });
    });
  }, []);

  // Live-update when admin toggles preview
  useEffect(() => {
    const onPreview = (e: Event) => {
      const newTier = (e as CustomEvent<UserTier | null>).detail;
      if (newTier) {
        setTier(newTier);
        setLoading(false);
      } else {
        // Preview cleared — reload real tier
        setLoading(true);
        supabase.auth.getSession().then(({ data: { session } }) => {
          const user = session?.user;
          if (!user) { setLoading(false); return; }
          supabase.from('profiles').select('tier').eq('id', user.id).maybeSingle()
            .then(({ data }) => {
              const t = data?.tier as UserTier | undefined;
              setTier(t && (VALID_TIERS as readonly string[]).includes(t) ? t : 'free');
              setLoading(false);
            });
        });
      }
    };
    window.addEventListener(PREVIEW_EVENT, onPreview);
    return () => window.removeEventListener(PREVIEW_EVENT, onPreview);
  }, []);

  const isPro = tier === 'pro' || tier === 'premium' || tier === 'admin';
  const isPremium = tier === 'premium' || tier === 'admin';
  return { tier, loading, isPro, isPremium };
}
