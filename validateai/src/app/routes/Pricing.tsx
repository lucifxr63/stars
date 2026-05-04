import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type Tier = 'basic' | 'pro' | 'premium';

const PLANS = [
  {
    tier: 'basic' as Tier,
    name: 'Basic',
    price: '$9.990',
    period: '/mes',
    description: 'Para explorar tu idea con análisis completo.',
    color: '#7C6FF7',
    highlight: false,
    features: [
      'Score + breakdown 5 dimensiones',
      'Análisis de cliente objetivo',
      'Propuesta de valor generada por IA',
      'Preguntas clave de validación',
      'Análisis de riesgos',
      '20 análisis / día',
    ],
    cta: 'Empezar con Basic',
  },
  {
    tier: 'pro' as Tier,
    name: 'Pro',
    price: '$19.990',
    period: '/mes',
    description: 'Para fundadores que van en serio.',
    color: '#F7C56C',
    highlight: true,
    features: [
      'Todo lo de Basic',
      'MVP Roadmap con Kanban',
      'SWOT automático',
      'Unit Economics (CAC / LTV / Churn)',
      'Founder-Market Fit',
      'Gobernanza y Cap Table',
      '50 análisis / día',
    ],
    cta: 'Empezar con Pro',
  },
  {
    tier: 'premium' as Tier,
    name: 'Premium',
    price: '$29.990',
    period: '/mes',
    description: 'Análisis completo para levantar capital.',
    color: '#34D399',
    highlight: false,
    features: [
      'Todo lo de Pro',
      'TAM / SAM / SOM con datos reales',
      'Análisis competitivo con web search',
      'Market signals (Reddit + Trends)',
      'Fundraising Roadmap',
      'Evidence Wall de mercado',
      '200 análisis / día',
    ],
    cta: 'Empezar con Premium',
  },
] as const;

export function Pricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<Tier | null>(null);

  const handleCheckout = async (tier: Tier) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate('/login', { state: { redirectAfter: `/pricing?tier=${tier}` } });
      return;
    }

    setLoading(tier);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            tier,
            success_url: `${window.location.origin}/dashboard?upgrade=success`,
            cancel_url:  `${window.location.origin}/pricing`,
          }),
        }
      );

      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok || !data.url) throw new Error(data.error ?? 'Error al crear sesión de pago');

      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al iniciar el pago');
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-gray-50/80 dark:bg-[#0A0A0F]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#7C6FF7] flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">ValidateAI</span>
          </Link>
          <Link
            to="/login"
            className="text-sm font-semibold bg-[#7C6FF7] text-white px-4 py-2 rounded-lg hover:bg-[#6B5EE6] transition-all"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-16">

        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 rounded-full text-xs font-semibold text-[#A78BFA] mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF7] animate-pulse" />
            Planes y precios
          </span>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
            Valida más rápido.<br />Construye con confianza.
          </h1>
          <p className="text-gray-500 dark:text-[#8B8AA0] max-w-xl mx-auto">
            Empieza gratis. Upgradea cuando necesites el análisis completo para tomar decisiones reales.
          </p>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan) => (
            <div
              key={plan.tier}
              className={`relative rounded-2xl border overflow-hidden flex flex-col
                ${plan.highlight
                  ? 'border-[#F7C56C]/40 bg-white dark:bg-[#12121A] shadow-xl shadow-[#F7C56C]/10'
                  : 'border-white/[0.06] bg-white dark:bg-[#12121A]'}`}
            >
              {plan.highlight && (
                <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#F7C56C] to-transparent" />
              )}
              {plan.highlight && (
                <div className="absolute top-3 right-3">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-[#F7C56C]/15 text-[#F7C56C] rounded-full border border-[#F7C56C]/20">
                    Más popular
                  </span>
                </div>
              )}

              <div className="p-6 flex-1">
                <div className="mb-5">
                  <span className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: plan.color }}>
                    {plan.name}
                  </span>
                  <div className="flex items-baseline gap-1 mb-1">
                    <span className="font-heading text-3xl font-bold text-gray-900 dark:text-[#F0EFF8]">
                      {plan.price}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-[#8B8AA0]">{plan.period}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{plan.description}</p>
                </div>

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700 dark:text-[#C4C4D4]">
                      <svg className="w-4 h-4 shrink-0 mt-0.5" style={{ color: plan.color }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="px-6 pb-6">
                <button
                  onClick={() => handleCheckout(plan.tier)}
                  disabled={loading !== null}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all duration-150 disabled:opacity-60"
                  style={{
                    background: plan.highlight ? plan.color : 'transparent',
                    color: plan.highlight ? '#0A0A0F' : plan.color,
                    border: `1.5px solid ${plan.color}`,
                  }}
                >
                  {loading === plan.tier ? 'Redirigiendo...' : plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Free note */}
        <div className="mt-10 text-center">
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">
            ¿No estás listo?{' '}
            <Link to="/login" className="text-[#A78BFA] hover:underline font-medium">
              El plan Free siempre está disponible
            </Link>
            {' '}— score básico + preguntas de validación, sin tarjeta.
          </p>
        </div>

        {/* Trust */}
        <div className="mt-12 grid sm:grid-cols-3 gap-4">
          {[
            { icon: '🔒', label: 'Pago seguro', sub: 'Procesado por Stripe' },
            { icon: '↩️', label: 'Cancela cuando quieras', sub: 'Sin penalidades ni contratos' },
            { icon: '🇨🇱', label: 'Precios en CLP', sub: 'Sin conversión ni sorpresas' },
          ].map((t) => (
            <div key={t.label} className="flex items-center gap-3 p-4 bg-white dark:bg-[#12121A] rounded-xl border border-white/[0.06]">
              <span className="text-xl">{t.icon}</span>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">{t.label}</p>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{t.sub}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-gray-500 dark:text-[#8B8AA0] mt-10">
          ¿Tienes preguntas?{' '}
          <a href="mailto:lucianoalonso2000@gmail.com" className="text-[#7C6FF7] hover:underline">
            lucianoalonso2000@gmail.com
          </a>
        </p>

      </main>
    </div>
  );
}
