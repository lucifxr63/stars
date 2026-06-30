import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import posthog from 'posthog-js';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { WaitlistModal } from '@/components/shared/WaitlistModal';
import { trackCtaClick, trackEvent } from '@/lib/analytics';
import { isCheckoutConfigured, getCheckoutMode, startCheckout, type PaidTier } from '@/lib/checkout';

type Tier = 'free' | 'basic' | 'pro' | 'premium';

function Logo({ className = 'w-6 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} aria-label="Validus" role="img">
      <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white" />
      <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6" />
      <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6" />
    </svg>
  );
}

function CheckIcon({ color = '#34D399' }: { color?: string }) {
  return (
    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke={color} strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

const PLANS = [
  {
    tier: 'free' as Tier,
    name: 'Free',
    price: '$0',
    period: '/mes',
    description: 'Para explorar el potencial de tu idea.',
    color: '#8B8AA0',
    highlight: false,
    features: [
      '1 idea gratis',
      'Score general 0–100',
      'Resumen ejecutivo + feedback IA',
      'Análisis básico de competidores',
      'Export PDF estándar',
    ],
    cta: 'Comenzar gratis',
  },
  {
    tier: 'basic' as Tier,
    name: 'Basic',
    price: '$9.990',
    period: ' CLP/mes',
    description: 'Para validar en serio sin gastar de más.',
    color: '#34D399',
    highlight: false,
    features: [
      '15 análisis por mes',
      'Score detallado 5 dimensiones',
      'Análisis de competidores completo',
      'Propuesta de valor y segmento de clientes',
      'Export PDF estándar',
      '5 análisis de mercado (TAM/SAM/SOM)',
    ],
    cta: 'Reservar acceso (Early Bird)',
  },
  {
    tier: 'pro' as Tier,
    name: 'Pro',
    price: '$20.000',
    period: ' CLP/mes',
    description: 'Para founders que deciden con datos.',
    color: '#0EB5C6',
    highlight: true,
    features: [
      'Hasta 50 validaciones al mes',
      'TAM/SAM/SOM dimensionado',
      'Unit Economics (CAC, LTV, Payback)',
      'Gobernanza, Cap Table y Fundraising Roadmap',
      'Founder Fit + recomendación de equipo',
      'PDF multitema investor-ready',
    ],
    cta: 'Reservar acceso (Early Bird)',
  },
  {
    tier: 'premium' as Tier,
    name: 'Premium',
    price: '$50.000',
    period: ' CLP/mes',
    description: 'Para startups en seed y growth.',
    color: '#F7C56C',
    highlight: false,
    features: [
      'Todo lo del plan Pro',
      'Due Diligence (SII + INAPI + CMF)',
      'Encuestas Mom Test + análisis de sesgos',
      'Data Room PDF para inversores',
      'API acceso completo',
      'Soporte prioritario en español',
    ],
    cta: 'Reservar acceso (Early Bird)',
  },
] as const;

export function Pricing() {
  const navigate = useNavigate();
  const [waitlistTier, setWaitlistTier] = useState<Tier | null>(null);

  // Revenue readiness: medir intención de compra (vista de planes) sin PII.
  // Cierra el embudo junto a checkout_waitlist_hit / _captured y paywall_hit.
  useEffect(() => {
    posthog.capture('pricing_viewed', { source: 'pricing_page' });
  }, []);

  // Fase 12: si el checkout está configurado (VITE_CHECKOUT_ENABLED + secrets en
  // Supabase Edge), el CTA va a LemonSqueezy. Si NO, cae a la waitlist Early Bird
  // (comportamiento por defecto, sin cargos). Todo en try/catch → nunca estado roto.
  const handleReserve = async (tier: Tier) => {
    if (tier === 'free') { navigate('/login'); return; }
    if (isCheckoutConfigured()) {
      trackEvent('checkout_started', { plan: tier, source: 'pricing', mode: getCheckoutMode(), is_configured: true });
      try {
        const url = await startCheckout(tier as PaidTier);
        window.location.href = url;
        return;
      } catch {
        trackEvent('checkout_unavailable', { plan: tier, source: 'pricing', reason: 'create_checkout_error' });
        // continúa al fallback de waitlist abajo
      }
    } else {
      trackEvent('checkout_waitlist_fallback', { plan: tier, source: 'pricing', is_configured: false });
    }
    posthog.capture('checkout_waitlist_hit', { tier });
    setWaitlistTier(tier);
  };

  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] flex flex-col">

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-black/[0.07] dark:border-white/[0.06] bg-[#F8F7FF]/85 dark:bg-[#0A0A0F]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="font-heading text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Validus</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/login"
              className="text-sm font-semibold bg-[#0EB5C6] text-white px-4 py-2.5 rounded-xl hover:bg-[#6B5EE6] transition-all shadow-md shadow-[#0EB5C6]/20">
              Iniciar sesión
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-12 sm:py-16">

        {/* Header */}
        <div className="text-center mb-12 sm:mb-16">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0EB5C6]/10 border border-[#0EB5C6]/20 rounded-full text-[11px] font-semibold text-[#0EB5C6] dark:text-[#38D5E3] mb-5 uppercase tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-[#0EB5C6] animate-pulse" />
            Planes y precios
          </span>
          <h1 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
            Valida más rápido.<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-[#0EB5C6] to-[#38D5E3] bg-clip-text text-transparent"> Construye con confianza.</span>
          </h1>
          <p className="text-gray-500 dark:text-[#8B8AA0] max-w-xl mx-auto text-base">
            Empieza gratis. Pásate a Pro o Premium cuando necesites datos duros para tomar decisiones reales.
          </p>
          <p className="text-xs text-gray-400 dark:text-[#afaebb] mt-2">Todos los planes incluyen Ley 21.719 de Privacidad</p>
        </div>

        {/* Plans */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 lg:gap-4">
          {PLANS.map((plan) => (
            <div key={plan.tier}
              className={`relative rounded-3xl border flex flex-col transition-all duration-200
                ${plan.highlight
                  ? 'border-[#0EB5C6] bg-white dark:bg-[#12121A] shadow-2xl shadow-[#0EB5C6]/12 md:scale-[1.02] md:-my-1'
                  : 'border-gray-200 dark:border-white/[0.06] bg-white dark:bg-[#12121A] hover:border-gray-300 dark:hover:border-white/10 hover:shadow-lg dark:hover:shadow-none'}`}>
              {plan.highlight && (
                <>
                  <div className="absolute top-0 right-0 bg-[#0EB5C6] text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-2xl rounded-tr-3xl tracking-wide z-10">POPULAR</div>
                  <div className="absolute -top-8 -right-8 w-32 h-32 bg-[#0EB5C6]/8 blur-2xl rounded-full pointer-events-none" />
                </>
              )}

              <div className="p-7 flex-1">
                <div className="mb-6">
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: plan.color }}>{plan.name}</p>
                  <div className="flex items-baseline gap-0.5 mb-1">
                    <span className="font-heading text-3xl sm:text-4xl font-extrabold text-gray-900 dark:text-[#F0EFF8]">{plan.price}</span>
                    <span className="text-sm text-gray-500 dark:text-[#8B8AA0]">{plan.period}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{plan.description}</p>
                </div>

                <ul className="space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-[#C4C4D4]">
                      <CheckIcon color={plan.highlight ? '#0EB5C6' : plan.color} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-7 pb-7">
                <button onClick={() => handleReserve(plan.tier)}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150 cursor-pointer"
                  style={plan.highlight
                    ? { background: '#0EB5C6', color: '#fff' }
                    : { background: 'transparent', color: plan.color, border: `1.5px solid ${plan.color}` }
                  }>
                  {plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Free note */}
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">
            ¿Quieres explorar primero?{' '}
            <Link to="/login" className="text-[#0EB5C6] dark:text-[#38D5E3] hover:underline font-semibold">
              El plan Free es siempre gratis
            </Link>
            {' '}— score básico + feedback IA, sin tarjeta.
          </p>
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mt-3">
            ¿Aceleradora, incubadora o equipo de innovación?{' '}
            <a
              href="mailto:contacto@scouttech.lat?subject=Solicitud%20de%20piloto%20%E2%80%94%20Validus&body=Hola%2C%20me%20interesa%20un%20piloto%20de%20Validus.%20Contexto%3A"
              onClick={() => trackCtaClick('pricing', 'solicitar_piloto')}
              className="text-[#0EB5C6] dark:text-[#38D5E3] hover:underline font-semibold"
            >
              Solicita un piloto →
            </a>
          </p>
        </div>

        {/* Trust */}
        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          {[
            { label: 'Early Bird', sub: 'Cupos limitados de lanzamiento' },
            { label: 'Cancela cuando quieras', sub: 'Sin penalidades ni contratos' },
            { label: 'Precios en CLP', sub: 'Sin conversión ni sorpresas' },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-3 p-4 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] shadow-sm dark:shadow-none">
              <div className="w-8 h-8 rounded-xl bg-[#0EB5C6]/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-[#0EB5C6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">{t.label}</p>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-[#afaebb] mt-10">
          ¿Tienes preguntas?{' '}
          <a href="mailto:contacto@scouttech.lat" className="text-[#0EB5C6] hover:underline">
            contacto@scouttech.lat
          </a>
        </p>
      </main>

      {waitlistTier && (
        <WaitlistModal tier={waitlistTier} onClose={() => setWaitlistTier(null)} />
      )}
    </div>
  );
}
