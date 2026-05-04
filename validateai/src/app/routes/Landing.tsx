import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { trackDemoViewed } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import {
  EXAMPLE_IDEA,
  EXAMPLE_SCORE,
  EXAMPLE_SCORE_BREAKDOWN,
  EXAMPLE_AI_FEEDBACK,
  EXAMPLE_CUSTOMER,
  EXAMPLE_VALUE_PROP,
  EXAMPLE_MARKET_SIZING,
  EXAMPLE_COMPETITIVE,
  EXAMPLE_RISK,
  EXAMPLE_UNIT_ECONOMICS,
} from '@/data/exampleReport';

/* ─── Types ─── */
const TABS = ['Resumen', 'Mercado', 'Competencia', 'Riesgo', 'Economía'] as const;
type Tab = typeof TABS[number];

/* ─── Helpers ─── */
const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M` : `$${(n / 1_000).toFixed(0)}K`;

/* ─── Score gauge (dark) ─── */
function ScoreCircle({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const color = score >= 70 ? '#34D399' : score >= 50 ? '#FBBF24' : '#F87171';
  return (
    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} stroke="rgba(255,255,255,0.06)" strokeWidth="8" fill="none" />
        <circle cx="44" cy="44" r={r} stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="text-center z-10">
        <p className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8] font-heading">{score}</p>
        <p className="text-[10px] text-gray-500 dark:text-[#8B8AA0] font-medium">/100</p>
      </div>
    </div>
  );
}

/* ─── Example report (dark) ─── */
function ExampleReport() {
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');

  return (
    <section className="py-20 bg-gray-50 dark:bg-[#0A0A0F]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20
                           rounded-full text-xs font-semibold text-[#A78BFA] mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF7] animate-pulse" />
            Ejemplo de análisis real
          </span>
          <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Esto es lo que obtienes
          </h2>
          <p className="text-gray-500 dark:text-[#8B8AA0] max-w-xl mx-auto text-sm">
            Score, mercado, competencia, riesgos y economía unitaria — todo en un solo reporte.
          </p>
        </div>

        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-white/[0.06] overflow-hidden">
          {/* Report header */}
          <div className="bg-gray-50 dark:bg-[#1A1A26] px-5 py-4 flex items-center justify-between border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#7C6FF7] flex items-center justify-center text-white font-black text-sm font-heading">
                {EXAMPLE_SCORE}
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-[#F0EFF8] text-sm">{EXAMPLE_IDEA.idea_name}</p>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{EXAMPLE_IDEA.target_country} · {EXAMPLE_IDEA.idea_industry}</p>
              </div>
            </div>
            <span className="text-xs px-3 py-1 bg-[#34D399]/10 text-[#34D399] rounded-full font-medium border border-[#34D399]/20">
              Completada
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-3 border-b border-white/[0.06] overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-all duration-150
                  ${activeTab === tab
                    ? 'text-[#A78BFA] border-b-2 border-[#7C6FF7] bg-[#7C6FF7]/5'
                    : 'text-[#8B8AA0] hover:text-gray-900 dark:text-[#F0EFF8]'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-6">
            {activeTab === 'Resumen' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row gap-5 items-start">
                  <ScoreCircle score={EXAMPLE_SCORE} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-4">{EXAMPLE_AI_FEEDBACK}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {(Object.entries(EXAMPLE_SCORE_BREAKDOWN) as [string, number][]).map(([key, val]) => (
                        <div key={key} className="bg-white dark:bg-[#12121A]/[0.03] border border-white/[0.06] rounded-xl p-3">
                          <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0] capitalize mb-1.5">{key}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-white dark:bg-[#12121A]/8 rounded-full">
                              <div className="h-full bg-[#7C6FF7] rounded-full" style={{ width: `${val}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8] tabular-nums">{val}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  <div className="bg-[#7C6FF7]/8 border border-[#7C6FF7]/15 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-[#A78BFA] uppercase tracking-wide mb-1.5">Segmento objetivo</p>
                    <p className="text-sm text-gray-900 dark:text-[#F0EFF8]">{EXAMPLE_CUSTOMER.customer_segment}</p>
                  </div>
                  <div className="bg-[#F7C56C]/8 border border-[#F7C56C]/15 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-[#F7C56C] uppercase tracking-wide mb-1.5">Propuesta de valor</p>
                    <p className="text-sm text-gray-900 dark:text-[#F0EFF8] line-clamp-3">{EXAMPLE_VALUE_PROP.value_proposition}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Mercado' && (
              <div className="space-y-3">
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-3">Estimación TAM/SAM/SOM para {EXAMPLE_IDEA.target_country}</p>
                {(['tam', 'sam', 'som'] as const).map((tier) => {
                  const t = EXAMPLE_MARKET_SIZING[tier];
                  const colorMap = {
                    tam: { bg: 'bg-[#34D399]/8 border-[#34D399]/15', label: 'text-[#34D399]' },
                    sam: { bg: 'bg-[#7C6FF7]/8 border-[#7C6FF7]/15', label: 'text-[#A78BFA]' },
                    som: { bg: 'bg-[#F7C56C]/8 border-[#F7C56C]/15', label: 'text-[#F7C56C]' },
                  };
                  const c = colorMap[tier];
                  return (
                    <div key={tier} className={`${c.bg} border rounded-xl p-4`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-black ${c.label} uppercase tracking-wide`}>{tier}</span>
                        <span className="text-[11px] text-gray-500 dark:text-[#8B8AA0]">Confianza: {t.confidence}</span>
                      </div>
                      <p className="font-bold text-gray-900 dark:text-[#F0EFF8] font-heading">{fmt(t.value_low)} – {fmt(t.value_high)}</p>
                      <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-1">{t.description}</p>
                    </div>
                  );
                })}
                <p className="text-xs text-[#4A495E] pt-1">{EXAMPLE_MARKET_SIZING.methodology}</p>
              </div>
            )}

            {activeTab === 'Competencia' && (
              <div className="space-y-3">
                {EXAMPLE_COMPETITIVE.competitors.map((c) => (
                  <div key={c.name} className="border border-white/[0.06] rounded-xl p-4 bg-white dark:bg-[#12121A]/[0.02]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900 dark:text-[#F0EFF8] text-sm">{c.name}</p>
                      <span className="text-[11px] text-gray-500 dark:text-[#8B8AA0]">{c.pricing}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-3">{c.description}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] font-semibold text-[#34D399] mb-1">Fortalezas</p>
                        {c.strengths.map((s) => <p key={s} className="text-xs text-gray-500 dark:text-[#8B8AA0]">• {s}</p>)}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-[#F87171] mb-1">Debilidades</p>
                        {c.weaknesses.map((w) => <p key={w} className="text-xs text-gray-500 dark:text-[#8B8AA0]">• {w}</p>)}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-[#F7C56C]/8 border border-[#F7C56C]/15 rounded-xl p-4">
                  <p className="text-[11px] font-bold text-[#F7C56C] uppercase tracking-wide mb-1.5">Ventaja sugerida</p>
                  <p className="text-xs text-gray-900 dark:text-[#F0EFF8]">{EXAMPLE_COMPETITIVE.competitive_advantage_suggestion}</p>
                </div>
              </div>
            )}

            {activeTab === 'Riesgo' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="text-center shrink-0">
                    <p className="text-3xl font-black text-gray-900 dark:text-[#F0EFF8] font-heading">{EXAMPLE_RISK.overallRiskScore}</p>
                    <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0]">score de riesgo</p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">
                    Riesgo <span className="text-gray-900 dark:text-[#F0EFF8] font-medium">{EXAMPLE_RISK.overallRiskScore < 40 ? 'bajo' : EXAMPLE_RISK.overallRiskScore < 65 ? 'moderado' : 'alto'}</span> — hay mitigaciones claras.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {Object.values(EXAMPLE_RISK.dimensions).map((dim) => (
                    <div key={dim.label} className="bg-white dark:bg-[#12121A]/[0.03] border border-white/[0.06] rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-gray-900 dark:text-[#F0EFF8]">{dim.label}</p>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full
                          ${dim.score < 40 ? 'bg-[#34D399]/15 text-[#34D399]' : dim.score < 65 ? 'bg-[#FBBF24]/15 text-[#FBBF24]' : 'bg-[#F87171]/15 text-[#F87171]'}`}>
                          {dim.score}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0]">{dim.description}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-2">Mitigaciones</p>
                  {EXAMPLE_RISK.mitigations.map((m) => (
                    <div key={m} className="flex gap-2 text-xs text-gray-500 dark:text-[#8B8AA0] mb-1.5">
                      <span className="text-[#34D399] shrink-0">✓</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Economía' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { label: 'CAC', value: `${fmt(EXAMPLE_UNIT_ECONOMICS.cac.min)}–${fmt(EXAMPLE_UNIT_ECONOMICS.cac.max)}`, sub: 'costo adquisición' },
                    { label: 'LTV', value: `${fmt(EXAMPLE_UNIT_ECONOMICS.ltv.min)}–${fmt(EXAMPLE_UNIT_ECONOMICS.ltv.max)}`, sub: 'valor de vida' },
                    { label: 'LTV/CAC', value: `${EXAMPLE_UNIT_ECONOMICS.ltvCacRatio.value}x`, sub: EXAMPLE_UNIT_ECONOMICS.ltvCacRatio.assessment },
                    { label: 'Payback', value: `${EXAMPLE_UNIT_ECONOMICS.paybackMonths.min}–${EXAMPLE_UNIT_ECONOMICS.paybackMonths.max}m`, sub: 'recuperación' },
                  ].map((item) => (
                    <div key={item.label} className="bg-white dark:bg-[#12121A]/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                      <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0] mb-1">{item.label}</p>
                      <p className="font-bold text-gray-900 dark:text-[#F0EFF8] text-sm font-heading">{item.value}</p>
                      <p className="text-[11px] text-[#4A495E] mt-0.5">{item.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-[#34D399]/8 border border-[#34D399]/15 rounded-xl p-4">
                  <p className="text-xs text-[#34D399]">
                    <span className="font-semibold">Break-even:</span> {EXAMPLE_UNIT_ECONOMICS.breakEvenUsers} usuarios ·{' '}
                    <span className="font-semibold">Churn:</span> {EXAMPLE_UNIT_ECONOMICS.monthlyChurnEstimate}%/mes
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-2">Supuestos</p>
                  {EXAMPLE_UNIT_ECONOMICS.assumptions.map((a) => (
                    <p key={a} className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-1">• {a}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Main Landing ─── */
export function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [validationCount, setValidationCount] = useState<number | null>(null);

  // Capture UTM params and persist to sessionStorage for PostHog attribution
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
      const v = params.get(k);
      if (v) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem('utm_params', JSON.stringify(utm));
      // PostHog set_once so first touch wins
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.people?.set_once(utm);
      }
    }
  }, [location.search]);

  // Fetch real validation count for social proof
  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase
        .from('validations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .then(({ count }) => {
          if (count && count > 0) setValidationCount(count);
        });
    });
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleCTA = () => navigate('/login');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-gray-50 dark:bg-[#0A0A0F]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[#7C6FF7] flex items-center justify-center glow-brand-sm">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">ValidateAI</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCTA}
              className="hidden sm:block text-sm font-medium text-[#8B8AA0] hover:text-gray-900 dark:text-[#F0EFF8] transition-colors px-3 py-1.5"
            >
              Iniciar sesión
            </button>
            <button
              onClick={handleCTA}
              className="text-sm font-semibold bg-[#7C6FF7] text-white px-4 py-2 rounded-lg
                         hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150 shadow-lg shadow-[#7C6FF7]/25"
            >
              Empezar gratis
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden">
          {/* Background effects */}
          <div className="absolute inset-0 grid-pattern" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#7C6FF7]/12 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute top-32 left-1/4 w-64 h-64 bg-[#F7C56C]/6 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-20 sm:pt-28 pb-16 sm:pb-24">
            <div className="text-center max-w-3xl mx-auto">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20
                              rounded-full text-xs font-semibold text-[#A78BFA] mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF7] animate-pulse" />
                Impulsado por IA · Gratuito para empezar
              </div>

              {/* Headline */}
              <h1 className="font-heading text-4xl sm:text-6xl md:text-7xl font-bold text-gray-900 dark:text-[#F0EFF8] leading-[1.08] tracking-tight mb-5">
                Valida tu idea
                <br />
                <span className="gradient-text">antes de construirla</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-500 dark:text-[#8B8AA0] mb-10 max-w-2xl mx-auto leading-relaxed">
                Un mentor de IA te guía en 3 pasos para descubrir si tu startup tiene
                potencial real. En 10 minutos obtienes un análisis completo con score.
              </p>

              {/* CTAs */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-6">
                <button
                  onClick={handleGoogleLogin}
                  className="group flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white dark:bg-[#12121A] text-gray-900 dark:text-[#F0EFF8]
                             font-semibold rounded-xl hover:bg-gray-100 dark:bg-white/5 active:scale-[0.98]
                             shadow-lg text-sm transition-all duration-150 w-full sm:w-auto"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continuar con Google
                </button>
                <button
                  onClick={handleCTA}
                  className="px-6 py-3.5 bg-[#7C6FF7] text-white font-semibold rounded-xl
                             hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150
                             shadow-lg shadow-[#7C6FF7]/25 text-sm w-full sm:w-auto"
                >
                  Entrar con email →
                </button>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <p className="text-xs text-[#4A495E]">
                  Sin tarjeta de crédito · Resultados en 10 minutos
                </p>
                <Link
                  to="/demo"
                  onClick={() => trackDemoViewed('hero')}
                  className="text-xs text-[#A78BFA] hover:text-[#7C6FF7] underline underline-offset-2 transition-colors"
                >
                  Ver ejemplo de reporte →
                </Link>
              </div>
            </div>

            {/* Floating score card */}
            <div className="mt-16 max-w-xs mx-auto">
              <div className="glass-card rounded-2xl p-5 animate-float glow-brand-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-[#7C6FF7] flex items-center justify-center text-white font-black text-sm font-heading">
                    78
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">FreshBox</p>
                    <p className="text-xs text-[#34D399]">Bien validada ✓</p>
                  </div>
                  <span className="ml-auto text-xs px-2 py-0.5 bg-[#34D399]/15 text-[#34D399] rounded-full border border-[#34D399]/20 font-medium">
                    Score: 78
                  </span>
                </div>
                <div className="space-y-2.5">
                  {[
                    { label: 'Mercado objetivo', val: 85, color: '#7C6FF7' },
                    { label: 'Diferenciación', val: 72, color: '#34D399' },
                    { label: 'Viabilidad MVP', val: 90, color: '#F7C56C' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-gray-500 dark:text-[#8B8AA0]">{item.label}</span>
                        <span className="font-semibold text-gray-900 dark:text-[#F0EFF8] tabular-nums">{item.val}%</span>
                      </div>
                      <div className="h-1 bg-white dark:bg-[#12121A]/8 rounded-full">
                        <div className="h-full rounded-full" style={{ width: `${item.val}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-white/[0.06]">
                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed">
                    "Idea con buen potencial. El mercado es amplio y el diferenciador es claro."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works (3 pasos) ── */}
        <section className="py-20 border-t border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-xs text-gray-500 dark:text-[#8B8AA0] font-bold uppercase tracking-widest mb-2">El proceso</p>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 dark:text-[#F0EFF8]">
                De la idea al análisis en 3 pasos
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  num: '01', label: 'Tu idea', color: '#7C6FF7',
                  desc: 'Describe tu problema, solución e industria. Sin plantillas, en tus propias palabras.',
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  ),
                },
                {
                  num: '02', label: 'Tu mercado', color: '#34D399',
                  desc: 'Identifica el segmento, tamaño de mercado y cómo llegas a tus primeros clientes.',
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  ),
                },
                {
                  num: '03', label: 'Tu reporte', color: '#F7C56C',
                  desc: 'Score 0–100, análisis de competencia, riesgos, economía unitaria y próximos pasos.',
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  ),
                },
              ].map((step, i) => (
                <div key={step.num} className="relative bg-white dark:bg-[#12121A] border border-white/[0.06] rounded-2xl p-6 group hover:border-white/12 transition-all duration-200">
                  {i < 2 && (
                    <div className="hidden md:block absolute top-9 right-0 translate-x-1/2 z-10">
                      <svg className="w-4 h-4 text-[#4A495E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${step.color}15`, color: step.color }}>
                      {step.icon}
                    </div>
                    <span className="font-heading text-xs font-bold text-[#4A495E] tracking-widest">{step.num}</span>
                  </div>
                  <h3 className="font-heading text-base font-semibold text-gray-900 dark:text-[#F0EFF8] mb-2">{step.label}</h3>
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Lo que obtienes (Features Bento) ── */}
        <section className="py-24 bg-white dark:bg-[#12121A] border-t border-white/[0.06]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-teal-500/10 border border-teal-500/20 rounded-full text-xs font-semibold text-teal-600 dark:text-teal-400 mb-4">
                <span className="text-[10px]">✨</span> Todo en un solo lugar
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
                El análisis más completo
              </h2>
              <p className="text-gray-500 dark:text-[#8B8AA0] max-w-2xl mx-auto text-base sm:text-lg">
                No solo te damos una opinión. Generamos datos duros, estrategias de mercado y proyecciones financieras para que tomes decisiones con confianza.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Feature 1 */}
              <div className="md:col-span-2 bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-3xl p-8 hover:border-gray-200 dark:hover:border-white/10 transition">
                <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Mercado y Competencia</h3>
                <p className="text-gray-500 dark:text-[#8B8AA0] mb-6">Dimensionamos tu mercado usando la metodología TAM, SAM y SOM. Analizamos a tus competidores directos identificando sus fortalezas y debilidades para encontrar tu ventaja competitiva.</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">Cálculo TAM/SAM/SOM</span>
                  <span className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">Radar Competitivo</span>
                  <span className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">Gaps de Mercado</span>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-3xl p-8 hover:border-gray-200 dark:hover:border-white/10 transition">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Finanzas y Unit Economics</h3>
                <p className="text-gray-500 dark:text-[#8B8AA0] text-sm">Proyectamos tu LTV (Life Time Value) y tu CAC (Costo de Adquisición), estimando tu ratio de rentabilidad, payback y puntos críticos de churn.</p>
              </div>

              {/* Feature 3 */}
              <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-3xl p-8 hover:border-gray-200 dark:hover:border-white/10 transition">
                <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Producto y MVP</h3>
                <p className="text-gray-500 dark:text-[#8B8AA0] text-sm">Definimos los features obligatorios de tu MVP (Must-haves), el user flow principal y un mapa regulatorio inicial para lanzar sin fricción legal.</p>
              </div>

              {/* Feature 4 */}
              <div className="md:col-span-2 bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-3xl p-8 hover:border-gray-200 dark:hover:border-white/10 transition">
                <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Equipo y Mentoría Estratégica</h3>
                <p className="text-gray-500 dark:text-[#8B8AA0] mb-6">Evaluamos el fit entre tus habilidades actuales y lo que la idea necesita (Founder Fit). Además, te recomendamos roles clave para contratar y te emparejamos con mentores sugeridos.</p>
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">Radar Founder-Fit</span>
                  <span className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">Perfiles Requeridos</span>
                  <span className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">Mentores AI</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Example Report ── */}
        <ExampleReport />

        {/* ── Stats ── */}
        <section className="py-16 border-y border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
              {[
                { num: validationCount ? `+${validationCount}` : '3', label: validationCount ? 'Ideas validadas' : 'Pasos guiados', sub: validationCount ? 'y contando' : 'proceso simple' },
                { num: '10', label: 'Minutos', sub: 'tiempo promedio' },
                { num: '100', label: 'Puntos', sub: 'score máximo' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="font-heading text-3xl sm:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">{item.num}</p>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-[#8B8AA0]">{item.label}</p>
                  <p className="hidden sm:block text-xs text-[#4A495E] mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Planes de Precios ── */}
        <section className="py-24 bg-white dark:bg-[#12121A]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 rounded-full text-xs font-semibold text-[#A78BFA] mb-4">
                <span className="text-[10px]">💳</span> Simple y transparente
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
                Elige tu nivel de profundidad
              </h2>
              <p className="text-gray-500 dark:text-[#8B8AA0] max-w-xl mx-auto text-base">
                Comienza validando tu idea gratis. Pásate a Premium cuando necesites datos financieros duros y planes de acción concretos.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Plan Free */}
              <div className="flex flex-col p-8 rounded-3xl bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-2">Básico</h3>
                <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-6">Para emprendedores en etapa inicial buscando feedback rápido.</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-gray-900 dark:text-[#F0EFF8]">$0</span>
                  <span className="text-gray-500 dark:text-[#8B8AA0]">/mes</span>
                </div>
                <button
                  onClick={handleCTA}
                  className="w-full py-3 px-4 bg-white dark:bg-[#1A1A24] text-gray-900 dark:text-[#F0EFF8] font-semibold rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition mb-8"
                >
                  Comenzar gratis
                </button>
                <ul className="space-y-4 flex-1">
                  {[
                    '1 Idea gratis para validar',
                    'Score general de viabilidad (0-100)',
                    'Resumen Ejecutivo y Feedback de IA',
                    'Análisis básico de Competidores',
                    'Exportación a PDF (Estilo estándar)',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-600 dark:text-[#C4C4D4]">
                      <svg className="w-5 h-5 text-teal-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Plan Premium */}
              <div className="relative flex flex-col p-8 rounded-3xl bg-[#0A0A0F] dark:bg-[#12121A] border-2 border-[#7C6FF7] shadow-2xl shadow-[#7C6FF7]/10 overflow-hidden">
                <div className="absolute top-0 right-0 px-4 py-1.5 bg-[#7C6FF7] text-white text-xs font-bold rounded-bl-xl z-10">
                  RECOMENDADO
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 bg-[#7C6FF7]/20 blur-3xl pointer-events-none" />
                
                <h3 className="text-2xl font-bold text-white mb-2 relative z-10">Premium</h3>
                <p className="text-sm text-gray-400 mb-6 relative z-10">Análisis exhaustivo con estrategias de mercado y financieras.</p>
                <div className="mb-6 relative z-10">
                  <span className="text-4xl font-black text-white">$19.99</span>
                  <span className="text-gray-400">/mes</span>
                </div>
                <button
                  onClick={handleCTA}
                  className="w-full py-3 px-4 bg-[#7C6FF7] text-white font-semibold rounded-xl hover:bg-[#6B5EE6] transition shadow-lg shadow-[#7C6FF7]/20 mb-8 relative z-10"
                >
                  Crear cuenta Premium
                </button>
                <ul className="space-y-4 flex-1 relative z-10">
                  <li className="flex items-start gap-3 text-sm font-semibold text-white">
                    <svg className="w-5 h-5 text-[#34D399] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    Todo lo del plan Básico, más:
                  </li>
                  {[
                    'Ideas y pivotes ilimitados',
                    'Dimensionamiento TAM/SAM/SOM',
                    'Unit Economics (CAC, LTV, Payback)',
                    'Matriz de Riesgos y Mitigaciones',
                    'Founder Fit y Recomendación de Equipo',
                    'Exportación de PDF Multitema',
                  ].map((feature, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                      <svg className="w-5 h-5 text-[#7C6FF7] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA final ── */}
        <section className="py-24 text-center px-4">
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-0 bg-[#7C6FF7]/8 rounded-3xl blur-2xl pointer-events-none" />
            <div className="relative bg-white dark:bg-[#12121A] border border-white/[0.06] rounded-3xl px-8 py-16">
              <span className="inline-flex items-center gap-2 px-3 py-1 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20
                               rounded-full text-xs font-semibold text-[#A78BFA] mb-6">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Comienza ahora · Es gratis
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
                ¿Tu idea tiene potencial?
              </h2>
              <p className="text-gray-500 dark:text-[#8B8AA0] mb-10 max-w-sm mx-auto">
                Descúbrelo en 10 minutos con un análisis completo impulsado por IA.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleGoogleLogin}
                  className="group flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white dark:bg-[#12121A] text-gray-900 dark:text-[#F0EFF8]
                             font-semibold rounded-xl hover:bg-gray-100 dark:bg-white/5 active:scale-[0.98]
                             text-sm transition-all duration-150 shadow-xl"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Validar mi idea con Google
                </button>
                <button
                  onClick={handleCTA}
                  className="px-6 py-3.5 bg-[#7C6FF7] text-white font-semibold rounded-xl
                             hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150
                             shadow-lg shadow-[#7C6FF7]/25 text-sm"
                >
                  Entrar con email →
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-white/[0.06] py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-[#7C6FF7] flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">ValidateAI</span>
          </div>
          <p className="text-xs text-[#4A495E]">
            © {new Date().getFullYear()} ValidateAI — Valida tu idea antes de construirla
          </p>
        </div>
      </footer>
    </div>
  );
}
