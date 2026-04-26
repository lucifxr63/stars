import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'Preguntas guiadas por IA',
    desc: 'Claude te hace las preguntas correctas para descubrir si tu idea tiene tracción real en el mercado.',
    color: 'bg-violet-50 text-violet-600 border-violet-100',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Perfil de cliente exacto',
    desc: 'Identifica tu segmento ideal y sus dolores más profundos con análisis automático de contexto.',
    color: 'bg-blue-50 text-blue-600 border-blue-100',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    title: 'Plan de MVP en minutos',
    desc: 'Obtén funcionalidades priorizadas y el flujo de usuario para construir tu primer producto.',
    color: 'bg-amber-50 text-amber-600 border-amber-100',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Score de validación',
    desc: 'Un puntaje de 0 a 100 con feedback concreto sobre fortalezas y puntos ciegos de tu idea.',
    color: 'bg-teal-50 text-teal-600 border-teal-100',
  },
];

const STEPS = [
  { num: 1, label: 'Tu Idea', desc: 'Define el problema' },
  { num: 2, label: 'Preguntas', desc: 'IA te interroga' },
  { num: 3, label: 'Cliente', desc: 'Perfil objetivo' },
  { num: 4, label: 'Propuesta', desc: 'Valor diferencial' },
  { num: 5, label: 'MVP', desc: 'Plan de producto' },
  { num: 6, label: 'Resultado', desc: 'Score y feedback' },
];

const TABS = ['Resumen', 'Mercado', 'Competencia', 'Riesgo', 'Economía'] as const;
type Tab = typeof TABS[number];

function ScoreCircle({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const color = score >= 70 ? '#14b8a6' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} stroke="#f3f4f6" strokeWidth="8" fill="none" />
        <circle cx="44" cy="44" r={r} stroke={color} strokeWidth="8" fill="none"
          strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <div className="text-center z-10">
        <p className="text-2xl font-black text-gray-900">{score}</p>
        <p className="text-[10px] text-gray-400 font-medium">/100</p>
      </div>
    </div>
  );
}

function ExampleReportSection() {
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(0)}M CLP`
      : `$${(n / 1_000).toFixed(0)}K CLP`;

  return (
    <section className="py-20 bg-gradient-to-b from-white to-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-50 border border-teal-200
                          rounded-full text-sm font-semibold text-teal-700 mb-4">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Ejemplo de análisis real
          </div>
          <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-3">
            Esto es lo que obtienes
          </h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Un reporte completo con score, análisis de mercado, competencia, riesgos y economía unitaria.
          </p>
        </div>

        <div className="bg-white rounded-3xl border border-gray-100 shadow-xl shadow-gray-100/80 overflow-hidden">
          {/* Report header */}
          <div className="bg-gradient-to-r from-gray-900 to-gray-800 px-6 py-5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-white font-black text-sm">
                {EXAMPLE_SCORE}
              </div>
              <div>
                <p className="font-bold text-white">{EXAMPLE_IDEA.idea_name}</p>
                <p className="text-xs text-gray-400">{EXAMPLE_IDEA.target_country} · {EXAMPLE_IDEA.idea_industry}</p>
              </div>
            </div>
            <span className="text-xs px-3 py-1 bg-teal-500/20 text-teal-300 rounded-full font-semibold border border-teal-500/30">
              Completada
            </span>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-4 border-b border-gray-100 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-semibold rounded-t-lg whitespace-nowrap transition-colors
                  ${activeTab === tab
                    ? 'text-teal-600 border-b-2 border-teal-500 bg-teal-50/50'
                    : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-6">
            {activeTab === 'Resumen' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-6 items-start">
                  <ScoreCircle score={EXAMPLE_SCORE} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 leading-relaxed mb-4">{EXAMPLE_AI_FEEDBACK}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {(Object.entries(EXAMPLE_SCORE_BREAKDOWN) as [string, number][]).map(([key, val]) => (
                        <div key={key} className="bg-gray-50 rounded-xl p-3">
                          <p className="text-xs text-gray-400 capitalize mb-1">{key}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-gray-200 rounded-full">
                              <div className="h-full bg-teal-500 rounded-full" style={{ width: `${val}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-700">{val}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4 pt-2">
                  <div className="bg-blue-50 rounded-2xl p-4">
                    <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-2">Segmento objetivo</p>
                    <p className="text-sm text-gray-700">{EXAMPLE_CUSTOMER.customer_segment}</p>
                  </div>
                  <div className="bg-violet-50 rounded-2xl p-4">
                    <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">Propuesta de valor</p>
                    <p className="text-sm text-gray-700 line-clamp-4">{EXAMPLE_VALUE_PROP.value_proposition}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'Mercado' && (
              <div className="space-y-4">
                <p className="text-sm text-gray-500 mb-4">Estimación TAM/SAM/SOM para {EXAMPLE_IDEA.target_country}</p>
                {(['tam', 'sam', 'som'] as const).map((tier) => {
                  const t = EXAMPLE_MARKET_SIZING[tier];
                  const colors = { tam: 'teal', sam: 'blue', som: 'violet' } as const;
                  const c = colors[tier];
                  return (
                    <div key={tier} className={`bg-${c}-50 rounded-2xl p-4 border border-${c}-100`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-black text-${c}-700 uppercase`}>{tier}</span>
                        <span className={`text-xs px-2 py-0.5 bg-${c}-100 text-${c}-700 rounded-full font-medium`}>
                          Confianza: {t.confidence}
                        </span>
                      </div>
                      <p className="font-bold text-gray-900 text-lg">{fmt(t.value_low)} – {fmt(t.value_high)}</p>
                      <p className="text-xs text-gray-500 mt-1">{t.description}</p>
                    </div>
                  );
                })}
                <p className="text-xs text-gray-400 pt-2">{EXAMPLE_MARKET_SIZING.methodology}</p>
              </div>
            )}

            {activeTab === 'Competencia' && (
              <div className="space-y-4">
                {EXAMPLE_COMPETITIVE.competitors.map((c) => (
                  <div key={c.name} className="border border-gray-100 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-gray-900">{c.name}</p>
                      <span className="text-xs text-gray-400">{c.pricing}</span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{c.description}</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-semibold text-green-700 mb-1">Fortalezas</p>
                        {c.strengths.map((s) => <p key={s} className="text-xs text-gray-600">• {s}</p>)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-red-700 mb-1">Debilidades</p>
                        {c.weaknesses.map((w) => <p key={w} className="text-xs text-gray-600">• {w}</p>)}
                      </div>
                    </div>
                  </div>
                ))}
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100">
                  <p className="text-xs font-bold text-amber-700 uppercase mb-2">Ventaja sugerida</p>
                  <p className="text-sm text-gray-700">{EXAMPLE_COMPETITIVE.competitive_advantage_suggestion}</p>
                </div>
              </div>
            )}

            {activeTab === 'Riesgo' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-2">
                  <div className="text-center">
                    <p className="text-3xl font-black text-gray-900">{EXAMPLE_RISK.overallRiskScore}</p>
                    <p className="text-xs text-gray-400">score de riesgo</p>
                  </div>
                  <p className="text-sm text-gray-500 flex-1">
                    Riesgo <strong>{EXAMPLE_RISK.overallRiskScore < 40 ? 'bajo' : EXAMPLE_RISK.overallRiskScore < 65 ? 'moderado' : 'alto'}</strong> — hay mitigaciones claras para los principales factores.
                  </p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {(Object.values(EXAMPLE_RISK.dimensions)).map((dim) => (
                    <div key={dim.label} className="bg-gray-50 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-900">{dim.label}</p>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full
                          ${dim.score < 40 ? 'bg-green-100 text-green-700' : dim.score < 65 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {dim.score}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">{dim.description}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Mitigaciones</p>
                  {EXAMPLE_RISK.mitigations.map((m) => (
                    <div key={m} className="flex gap-2 text-sm text-gray-600 mb-1.5">
                      <span className="text-teal-500 mt-0.5">✓</span>
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'Economía' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'CAC', value: `${fmt(EXAMPLE_UNIT_ECONOMICS.cac.min)}–${fmt(EXAMPLE_UNIT_ECONOMICS.cac.max)}`, sub: 'costo adquisición' },
                    { label: 'LTV', value: `${fmt(EXAMPLE_UNIT_ECONOMICS.ltv.min)}–${fmt(EXAMPLE_UNIT_ECONOMICS.ltv.max)}`, sub: 'valor de vida' },
                    { label: 'LTV/CAC', value: `${EXAMPLE_UNIT_ECONOMICS.ltvCacRatio.value}x`, sub: EXAMPLE_UNIT_ECONOMICS.ltvCacRatio.assessment },
                    { label: 'Payback', value: `${EXAMPLE_UNIT_ECONOMICS.paybackMonths.min}–${EXAMPLE_UNIT_ECONOMICS.paybackMonths.max} meses`, sub: 'recuperación' },
                  ].map((item) => (
                    <div key={item.label} className="bg-gray-50 rounded-xl p-4 text-center">
                      <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                      <p className="font-bold text-gray-900 text-sm">{item.value}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{item.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-teal-50 rounded-xl p-4 border border-teal-100">
                  <p className="text-sm text-teal-800">
                    <strong>Break-even:</strong> {EXAMPLE_UNIT_ECONOMICS.breakEvenUsers} usuarios activos ·{' '}
                    <strong>Churn estimado:</strong> {EXAMPLE_UNIT_ECONOMICS.monthlyChurnEstimate}%/mes
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Supuestos</p>
                  {EXAMPLE_UNIT_ECONOMICS.assumptions.map((a) => (
                    <p key={a} className="text-xs text-gray-500 mb-1">• {a}</p>
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

export function Landing() {
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-lg font-bold text-gray-900 tracking-tight">ValidateAI</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => navigate('/login')}
              className="hidden sm:block text-sm font-medium text-gray-600 hover:text-gray-900 transition px-3 py-1.5"
            >
              Iniciar sesión
            </button>
            <button
              onClick={() => navigate('/login')}
              className="text-sm font-semibold bg-gray-900 text-white px-3 sm:px-4 py-2 rounded-xl
                         hover:bg-gray-800 transition"
            >
              Empezar gratis
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1">
        <section className="relative overflow-hidden hero-gradient">
          {/* Grid pattern background */}
          <div className="absolute inset-0 grid-pattern opacity-60" />

          {/* Glow orbs */}
          <div className="absolute top-20 left-1/4 w-72 h-72 bg-teal-300/20 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-56 h-56 bg-violet-300/15 rounded-full blur-3xl" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-14 sm:pt-20 pb-20 sm:pb-28">
            <div className="text-center max-w-4xl mx-auto">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white border border-teal-200
                              rounded-full text-sm font-medium text-teal-700 shadow-sm mb-8">
                <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" />
                Impulsado por Claude AI de Anthropic
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-6xl md:text-7xl font-black text-gray-900 leading-[1.05] tracking-tight mb-6">
                Valida tu idea
                <br />
                <span className="gradient-text">antes de construirla</span>
              </h1>

              <p className="text-base sm:text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
                Un mentor de IA te guía en 6 pasos para descubrir si tu startup tiene
                potencial real. En 15 minutos obtienes un análisis completo con score.
              </p>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-5">
                <button
                  onClick={handleGoogleLogin}
                  className="group flex items-center justify-center gap-3 px-8 py-4 bg-teal-500 text-white
                             font-bold rounded-2xl hover:bg-teal-600 active:scale-[0.98]
                             shadow-lg shadow-teal-500/30 text-lg transition-all duration-150"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="white" opacity="0.9"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="white" opacity="0.8"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="white" opacity="0.7"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="white" opacity="0.6"/>
                  </svg>
                  Continuar con Google
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </button>
                <button
                  onClick={() => navigate('/login')}
                  className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold
                             rounded-2xl hover:border-gray-300 hover:bg-gray-50 transition-all text-lg"
                >
                  Entrar con email
                </button>
              </div>
              <p className="text-sm text-gray-400">
                Sin tarjeta de crédito · Gratis para empezar · Resultados en 15 min
              </p>
            </div>

            {/* Floating score card */}
            <div className="mt-16 max-w-sm mx-auto">
              <div className="bg-white rounded-3xl shadow-2xl shadow-gray-200/80 border border-gray-100 p-6 animate-float">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-white font-black text-sm">
                    78
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">FreshBox</p>
                    <p className="text-xs text-teal-600 font-medium">Bien validada ✓</p>
                  </div>
                  <div className="ml-auto">
                    <span className="text-xs px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                      Completada
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Mercado objetivo', val: '85%', color: 'bg-teal-500' },
                    { label: 'Diferenciación', val: '72%', color: 'bg-blue-500' },
                    { label: 'Viabilidad MVP', val: '90%', color: 'bg-violet-500' },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{item.label}</span>
                        <span className="font-semibold text-gray-700">{item.val}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full">
                        <div className={`h-full ${item.color} rounded-full`} style={{ width: item.val }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs text-gray-500 leading-relaxed">
                    "Idea con buen potencial. El mercado es amplio y el diferenciador es claro."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Steps flow */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">El proceso</p>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900">
                De la idea al análisis en 6 pasos
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {STEPS.map((step) => (
                <div key={step.num} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition group">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 rounded-full bg-teal-500 text-white text-sm font-black flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                      {step.num}
                    </div>
                    <p className="font-bold text-gray-900 text-sm">{step.label}</p>
                  </div>
                  <p className="text-xs text-gray-400">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mb-2">Capacidades</p>
            <h2 className="text-3xl md:text-4xl font-black text-gray-900">
              Todo lo que necesitas para validar
            </h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title}
                className="group bg-white rounded-2xl border border-gray-100 p-6 shadow-sm
                           hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
                <div className={`w-10 h-10 rounded-xl border flex items-center justify-center mb-4 ${f.color}`}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-gray-900 mb-2">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Example Report */}
        <ExampleReportSection />

        {/* Stats */}
        <section className="py-16 sm:py-20 bg-gray-900">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-3 gap-4 sm:gap-8 text-center">
              {[
                { num: '6', label: 'Pasos guiados', sub: 'con IA' },
                { num: '15', label: 'Minutos', sub: 'para completar' },
                { num: '100', label: 'Puntos', sub: 'score máximo' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-3xl sm:text-5xl font-black text-white mb-1">{item.num}</p>
                  <p className="text-xs sm:text-sm font-semibold text-gray-300">{item.label}</p>
                  <p className="hidden sm:block text-xs text-gray-500 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA final */}
        <section className="py-24 text-center px-4 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-50 border border-teal-200
                            rounded-full text-sm font-medium text-teal-700 mb-6">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Comienza ahora, es gratis
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 mb-4">
              ¿Tu idea tiene potencial?
            </h2>
            <p className="text-gray-500 mb-10 text-lg">
              Descúbrelo en 15 minutos con un análisis completo impulsado por IA.
            </p>
            <button
              onClick={handleGoogleLogin}
              className="group inline-flex items-center gap-2 px-10 py-4 bg-teal-500 text-white font-bold
                         rounded-2xl hover:bg-teal-600 active:scale-[0.98] transition-all
                         shadow-xl shadow-teal-500/30 text-lg"
            >
              Validar mi idea gratis
              <svg className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-teal-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-gray-700">ValidateAI</span>
          </div>
          <p className="text-xs text-gray-400">
            © {new Date().getFullYear()} ValidateAI — Valida tu idea antes de construirla
          </p>
        </div>
      </footer>
    </div>
  );
}
