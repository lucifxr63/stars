import { useEffect, useState } from 'react';
import posthog from 'posthog-js';
import type { UserTier } from '@/hooks/useUserTier';
import { WaitlistModal } from '@/components/shared/WaitlistModal';
import { EVENTS } from '@/lib/storageKeys';
import { trackEvent } from '@/lib/analytics';
import { isCheckoutConfigured, getCheckoutMode, startCheckout, type PaidTier } from '@/lib/checkout';

// Evento despachado por useAI.ts cuando el backend retorna 429 con error de tier/cuota.
export const PAYWALL_HIT_EVENT = EVENTS.paywallHit;

export interface PaywallHitDetail {
  reason: 'tier_blocked' | 'monthly_limit' | 'expensive_limit';
  prompt_type: string;
  tier_current: UserTier;
  tier_needed: UserTier;
  used?: number;
  limit?: number;
}

export function dispatchPaywallHit(detail: PaywallHitDetail) {
  window.dispatchEvent(new CustomEvent(PAYWALL_HIT_EVENT, { detail }));
}

// ── Mapeos ───────────────────────────────────────────────────────────────────

export const FEATURE_NAME: Record<string, string> = {
  competitive_analysis: 'Análisis Competitivo',
  market_sizing: 'Tamaño de Mercado (TAM/SAM/SOM)',
  market_signals: 'Señales de Mercado',
  risk_analysis: 'Análisis de Riesgos',
  unit_economics: 'Unit Economics (CAC/LTV)',
  founder_fit: 'Founder-Market Fit',
  governance_assessment: 'Gobernanza y Estructura',
  fundraising_roadmap: 'Fundraising Roadmap',
  pitch_deck: 'Pitch Deck',
  lean_roadmap: 'Lean Roadmap',
  financial_projection: 'Proyección Financiera',
  compliance_roadmap: 'Compliance Roadmap',
  playbook_analysis: 'Playbook de Validación',
  summary: 'Resumen ejecutivo',
  questions: 'Preguntas Mom Test',
  value_prop: 'Propuesta de Valor',
  mvp_generation: 'Roadmap MVP',
};

export const TIER_INFO: Record<UserTier, { label: string; price: string; color: string; bg: string }> = {
  free: { label: 'Free', price: 'Gratis', color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-white/8' },
  basic: { label: 'Basic', price: '$9.990 CLP/mes', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 dark:bg-sky-500/10' },
  pro: { label: 'Pro', price: '$20.000 CLP/mes', color: 'text-[#0EB5C6]', bg: 'bg-[#0EB5C6]/10' },
  premium: { label: 'Premium', price: '$50.000 CLP/mes', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
  admin:   { label: 'Admin',   price: 'Interno',        color: 'text-rose-600 dark:text-rose-400',   bg: 'bg-rose-50 dark:bg-rose-500/10' },
};

export function reasonText(detail: PaywallHitDetail): string {
  if (detail.reason === 'tier_blocked') {
    return `Este análisis requiere plan ${TIER_INFO[detail.tier_needed]?.label ?? detail.tier_needed}.`;
  }
  if (detail.reason === 'monthly_limit') {
    const used = detail.used ?? '?', limit = detail.limit ?? '?';
    return `Alcanzaste el límite mensual de ${limit} análisis (${used}/${limit}). Se renueva el 1° del mes.`;
  }
  if (detail.reason === 'expensive_limit') {
    const used = detail.used ?? '?', limit = detail.limit ?? '?';
    return `Alcanzaste el límite de ${limit} análisis de mercado del mes (${used}/${limit}). Se renueva el 1° del mes.`;
  }
  return 'Límite de tu plan alcanzado.';
}

// ── Componente ────────────────────────────────────────────────────────────────

export function UpgradeModal() {
  const [detail, setDetail] = useState<PaywallHitDetail | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      setDetail((e as CustomEvent<PaywallHitDetail>).detail);
    };
    window.addEventListener(PAYWALL_HIT_EVENT, handler);
    return () => window.removeEventListener(PAYWALL_HIT_EVENT, handler);
  }, []);

  const closeAll = () => { setWaitlistOpen(false); setDetail(null); };

  // Fase 12: si el checkout está configurado, el CTA va a LemonSqueezy; si no,
  // abre la waitlist Early Bird (fallback por defecto, sin cargos). try/catch → nunca roto.
  const handleReserve = async () => {
    const tier = detail?.tier_needed;
    const isPaid = tier === 'basic' || tier === 'pro' || tier === 'premium';
    if (isPaid && isCheckoutConfigured()) {
      trackEvent('checkout_started', { plan: tier, source: 'upgrade_modal', mode: getCheckoutMode(), is_configured: true });
      try {
        const url = await startCheckout(tier as PaidTier);
        window.location.href = url;
        return;
      } catch {
        trackEvent('checkout_unavailable', { plan: tier, source: 'upgrade_modal', reason: 'create_checkout_error' });
      }
    } else {
      trackEvent('checkout_waitlist_fallback', { plan: tier ?? 'unknown', source: 'upgrade_modal', is_configured: false });
    }
    if (detail) posthog.capture('checkout_waitlist_hit', { tier: detail.tier_needed });
    setWaitlistOpen(true);
  };

  if (!detail) return null;

  if (waitlistOpen) {
    return <WaitlistModal tier={detail.tier_needed} source="upgrade_modal" onClose={closeAll} />;
  }

  const tierInfo = TIER_INFO[detail.tier_needed];
  const featureName = FEATURE_NAME[detail.prompt_type] ?? detail.prompt_type;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setDetail(null)}
      />

      {/* Panel */}
      <div className="relative w-full max-w-sm bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/[0.08] shadow-2xl p-6 space-y-5">
        {/* Close */}
        <button
          onClick={() => setDetail(null)}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className={`w-12 h-12 rounded-2xl ${tierInfo.bg} flex items-center justify-center`}>
          <svg className={`w-6 h-6 ${tierInfo.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>

        {/* Feature name */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 dark:text-[#afaebb] uppercase tracking-widest mb-1">
            Análisis bloqueado
          </p>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8] leading-snug">
            {featureName}
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mt-1.5 leading-relaxed">
            {reasonText(detail)}
          </p>
        </div>

        {/* Tier needed card */}
        <div className={`flex items-center justify-between p-3.5 rounded-2xl border ${tierInfo.bg} border-transparent`}>
          <div>
            <p className="text-[10px] font-semibold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-0.5">
              Plan requerido
            </p>
            <span className={`text-sm font-bold ${tierInfo.color}`}>
              {tierInfo.label}
            </span>
          </div>
          <span className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">
            {tierInfo.price}
          </span>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleReserve}
            className="block w-full text-center py-3 bg-[#0EB5C6] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] transition-all shadow-lg shadow-[#0EB5C6]/25"
          >
            Reservar Acceso {tierInfo.label} (Early Bird) →
          </button>
          <button
            onClick={() => setDetail(null)}
            className="w-full py-2.5 text-sm text-gray-500 dark:text-[#8B8AA0] hover:text-gray-700 dark:hover:text-[#C4C4D4] transition-colors"
          >
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
