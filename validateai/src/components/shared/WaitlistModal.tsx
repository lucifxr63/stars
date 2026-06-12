import { useState, useCallback } from 'react';
import posthog from 'posthog-js';
import { toast } from 'sonner';

// ── WaitlistModal (contingencia de ingresos / BoFu) ───────────────────────────
// Secuestra los CTAs de pago mientras LemonSqueezy está bloqueado por Legal.
// Convierte el intento de compra en captura de un lead de ALTA intención
// (Deferred Revenue) reusando send-quick-lead → tabla email_leads (Scope Lock:
// sin tablas nuevas). El origen se distingue en PostHog (checkout_waitlist_*),
// no en la BD.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const TIER_LABEL: Record<string, string> = {
  basic: 'Basic', pro: 'Pro', premium: 'Premium',
};

interface WaitlistModalProps {
  /** Tier que el usuario intentó comprar — contexto para telemetría. */
  tier: string;
  onClose: () => void;
}

export function WaitlistModal({ tier, onClose }: WaitlistModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = useCallback(async () => {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return;
    setLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-quick-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value }),
      });
    } catch (err) {
      console.warn('[waitlist] network error:', err);
    }
    setLoading(false);
    setSent(true);
    posthog.capture('checkout_waitlist_captured', { tier });
    toast.success(`¡Cupo reservado! Te notificaremos a ${value} con tu link de pago exclusivo apenas abramos.`);
  }, [email, tier]);

  const tierLabel = TIER_LABEL[tier] ?? 'Premium';

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm bg-white dark:bg-[#12121A] rounded-3xl border border-[#0EB5C6]/30 shadow-2xl p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {sent ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">¡Cupo reservado!</h3>
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-5 leading-relaxed">
              Te avisamos en cuanto abramos cupos con tu link de pago exclusivo y tu 50% OFF.
            </p>
            <button
              onClick={onClose}
              className="w-full py-2.5 text-sm text-gray-500 dark:text-[#8B8AA0] hover:text-gray-700 dark:hover:text-[#C4C4D4] transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0EB5C6]/10 border border-[#0EB5C6]/20 mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0EB5C6] animate-pulse" />
              <span className="text-[10px] font-bold text-[#0EB5C6] dark:text-[#38D5E3] uppercase tracking-wider">
                Early Bird · {tierLabel}
              </span>
            </div>

            <h3 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8] mb-1.5 leading-snug">
              Asegura tu acceso anticipado
            </h3>
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-5 leading-relaxed">
              Estamos finalizando nuestra integración B2B oficial. Déjanos tu correo y asegura un
              <strong className="text-gray-700 dark:text-[#C4C4D4]"> descuento del 50% en tu primer mes</strong> cuando abramos cupos la próxima semana.
            </p>

            <div className="space-y-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submit()}
                placeholder="tu@email.com"
                autoComplete="email"
                autoFocus
                className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-[#F0EFF8] placeholder:text-gray-400 focus:outline-none focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20 transition-all"
              />
              <button
                onClick={submit}
                disabled={loading || !EMAIL_RE.test(email.trim())}
                className="w-full py-3 bg-[#0EB5C6] hover:bg-[#6B5EE6] disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
              >
                {loading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <>Reservar mi cupo (50% OFF) →</>}
              </button>
            </div>

            <p className="text-[11px] text-center text-gray-400 dark:text-[#afaebb] mt-3">
              Sin tarjeta ahora · cupos limitados de lanzamiento
            </p>
          </>
        )}
      </div>
    </div>
  );
}
