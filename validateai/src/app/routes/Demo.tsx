import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EXAMPLE_IDEA,
  EXAMPLE_SCORE,
  EXAMPLE_SCORE_BREAKDOWN,
  EXAMPLE_AI_FEEDBACK,
  EXAMPLE_QUESTIONS_ANSWERS,
  EXAMPLE_CUSTOMER,
  EXAMPLE_VALUE_PROP,
  EXAMPLE_MVP,
  EXAMPLE_MARKET_SIZING,
  EXAMPLE_COMPETITIVE,
  EXAMPLE_RISK,
  EXAMPLE_UNIT_ECONOMICS,
} from '@/data/exampleReport';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { MarketFunnel } from '@/components/shared/MarketFunnel';
import { CompetitiveAnalysis } from '@/components/shared/CompetitiveAnalysis';
import { ScoreBreakdown } from '@/components/shared/ScoreBreakdown';
import { RiskAnalysisCard } from '@/components/shared/RiskAnalysisCard';
import { UnitEconomicsCard } from '@/components/shared/UnitEconomicsCard';

const TABS = ['Resumen', 'Mercado', 'Competencia', 'Riesgo', 'Economía', 'Producto'] as const;
type Tab = typeof TABS[number];

// ── Locked overlay for premium sections ──────────────────────────────────────

function DemoLocked({ label }: { label: string }) {
  return (
    <div className="relative rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="filter blur-[3px] pointer-events-none select-none p-5 opacity-40" aria-hidden>
        <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-1/3 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-200 dark:bg-white/10 rounded-xl" />)}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-[#12121A]/80 backdrop-blur-sm p-6 text-center">
        <div className="w-10 h-10 rounded-xl bg-[#7C6FF7]/10 border border-[#7C6FF7]/30 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-[#7C6FF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">{label}</p>
        <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-4 max-w-xs">Disponible en tu reporte personalizado</p>
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7C6FF7] text-white text-xs font-bold rounded-xl hover:bg-[#6B5EE6] transition-all"
        >
          Validar mi idea gratis →
        </Link>
      </div>
    </div>
  );
}

// ── Main Demo page ────────────────────────────────────────────────────────────

export function Demo() {
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');

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

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs font-medium text-[#8B8AA0] px-3 py-1.5 bg-[#7C6FF7]/10 rounded-full border border-[#7C6FF7]/20">
              Reporte demo — FreshBox
            </span>
            <Link
              to="/login"
              className="text-sm font-semibold bg-[#7C6FF7] text-white px-4 py-2 rounded-lg hover:bg-[#6B5EE6] transition-all shadow-lg shadow-[#7C6FF7]/25"
            >
              Validar mi idea →
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* Demo banner */}
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-[#7C6FF7]/8 border border-[#7C6FF7]/20 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-[#7C6FF7] animate-pulse shrink-0" />
          <p className="text-xs text-[#A78BFA] font-medium flex-1">
            Estás viendo un <strong>reporte de demostración</strong>. Los datos son de la idea "FreshBox" generada por IA para mostrarte qué obtendrías.
          </p>
          <Link to="/login" className="text-xs font-bold text-[#7C6FF7] hover:underline whitespace-nowrap">
            Crear el mío →
          </Link>
        </div>

        {/* Report header */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-white/[0.06] overflow-hidden mb-4">
          <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-[#7C6FF7] flex items-center justify-center text-white font-black text-lg font-heading shrink-0">
                {EXAMPLE_SCORE}
              </div>
              <div>
                <h1 className="font-heading text-lg font-bold text-gray-900 dark:text-[#F0EFF8]">{EXAMPLE_IDEA.idea_name}</h1>
                <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">
                  {EXAMPLE_IDEA.target_country} · {EXAMPLE_IDEA.idea_industry} · {EXAMPLE_IDEA.business_model}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs px-3 py-1.5 bg-[#34D399]/10 text-[#34D399] rounded-full font-semibold border border-[#34D399]/20">
                Score: {EXAMPLE_SCORE}/100
              </span>
              <span className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-[#8B8AA0] rounded-full border border-white/[0.06]">
                Demo
              </span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-2 overflow-x-auto border-b border-white/[0.06]">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-xs font-medium rounded-t-lg whitespace-nowrap transition-all duration-150
                  ${activeTab === tab
                    ? 'text-[#A78BFA] border-b-2 border-[#7C6FF7] bg-[#7C6FF7]/5'
                    : 'text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8]'}`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-6">

            {/* ── Resumen ── */}
            {activeTab === 'Resumen' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row gap-6">
                  <ScoreGauge score={EXAMPLE_SCORE} />
                  <div className="flex-1 space-y-3">
                    <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{EXAMPLE_AI_FEEDBACK}</p>
                    <ScoreBreakdown data={EXAMPLE_SCORE_BREAKDOWN} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-[#7C6FF7]/8 border border-[#7C6FF7]/15 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-[#A78BFA] uppercase tracking-wide mb-1.5">Segmento objetivo</p>
                    <p className="text-sm text-gray-900 dark:text-[#F0EFF8]">{EXAMPLE_CUSTOMER.customer_segment}</p>
                  </div>
                  <div className="bg-[#F7C56C]/8 border border-[#F7C56C]/15 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-[#F7C56C] uppercase tracking-wide mb-1.5">Propuesta de valor</p>
                    <p className="text-sm text-gray-900 dark:text-[#F0EFF8] line-clamp-4">{EXAMPLE_VALUE_PROP.value_proposition}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-3">Preguntas clave del análisis</p>
                  <div className="space-y-3">
                    {EXAMPLE_QUESTIONS_ANSWERS.map((qa, i) => (
                      <div key={i} className="bg-white dark:bg-[#0A0A0F] border border-white/[0.06] rounded-xl p-4">
                        <p className="text-xs font-semibold text-[#7C6FF7] mb-1.5">{qa.question}</p>
                        <p className="text-sm text-gray-700 dark:text-[#C4C4D4]">{qa.answer}</p>
                        {qa.ai_followup && (
                          <p className="text-xs text-gray-400 italic mt-2 pt-2 border-t border-white/[0.06]">
                            IA: "{qa.ai_followup}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Mercado ── */}
            {activeTab === 'Mercado' && (
              <div className="space-y-4">
                <MarketFunnel data={EXAMPLE_MARKET_SIZING} />
              </div>
            )}

            {/* ── Competencia ── */}
            {activeTab === 'Competencia' && (
              <div className="space-y-4">
                <CompetitiveAnalysis data={EXAMPLE_COMPETITIVE} />
              </div>
            )}

            {/* ── Riesgo ── */}
            {activeTab === 'Riesgo' && (
              <div className="space-y-4">
                <RiskAnalysisCard data={EXAMPLE_RISK} />
                <DemoLocked label="Matriz SWOT + Próximos pasos con timeline" />
              </div>
            )}

            {/* ── Economía ── */}
            {activeTab === 'Economía' && (
              <div className="space-y-4">
                <UnitEconomicsCard data={EXAMPLE_UNIT_ECONOMICS} />
                <DemoLocked label="Modelos de revenue alternativos + Founder Fit" />
              </div>
            )}

            {/* ── Producto ── */}
            {activeTab === 'Producto' && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide mb-3">Features del MVP</p>
                  <div className="space-y-2">
                    {EXAMPLE_MVP.mvp_features.map((f) => {
                      const priorityConfig = {
                        must:   { label: 'Must', color: 'text-red-600 bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20' },
                        should: { label: 'Should', color: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20' },
                        could:  { label: 'Could', color: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-500/20' },
                      };
                      const pc = priorityConfig[f.priority as keyof typeof priorityConfig] ?? priorityConfig.could;
                      return (
                        <div key={f.name} className="flex items-start gap-3 p-4 bg-white dark:bg-[#0A0A0F] border border-white/[0.06] rounded-xl">
                          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${pc.color}`}>
                            {pc.label}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">{f.name}</p>
                            <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{f.description}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#34D399]/8 border border-[#34D399]/15 rounded-xl p-4">
                  <p className="text-[11px] font-bold text-[#34D399] uppercase tracking-wide mb-2">User flow principal</p>
                  <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{EXAMPLE_MVP.mvp_user_flow}</p>
                </div>

                <DemoLocked label="Kanban interactivo del MVP + Roadmap regulatorio" />
              </div>
            )}

          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-[#7C6FF7]/10 to-[#F7C56C]/8 border border-[#7C6FF7]/20 p-8 text-center">
          <p className="text-xs font-bold text-[#A78BFA] uppercase tracking-widest mb-2">¿Lista tu idea?</p>
          <h2 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Obtén tu propio reporte en 10 minutos
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-6 max-w-md mx-auto">
            Este fue generado sobre una idea de ejemplo. El tuyo tendrá análisis real con tu contexto, mercado e industria específicos.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/login"
              className="px-6 py-3 bg-[#7C6FF7] text-white font-semibold rounded-xl hover:bg-[#6B5EE6] transition-all shadow-lg shadow-[#7C6FF7]/25 text-sm"
            >
              Validar mi idea gratis →
            </Link>
            <Link
              to="/"
              className="px-6 py-3 bg-white dark:bg-[#12121A] text-gray-700 dark:text-[#F0EFF8] font-semibold rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 transition-all text-sm"
            >
              Volver al inicio
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
