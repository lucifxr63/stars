import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import posthog from 'posthog-js';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

function Logo({ className = 'w-5 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} aria-label="Validus" role="img">
      <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white"/>
      <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6"/>
      <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6"/>
    </svg>
  );
}
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Soft paywall: captura de email anónima (reusa send-quick-lead → email_leads) ──
// Convierte tráfico anónimo de /demo en leads SIN forzar registro completo.
// No requiere auth (la edge function es pública). KPI: Lead Capture Rate.

function submitDemoLead(email: string): Promise<boolean> {
  return fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-quick-lead`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, source: 'demo' }),
  })
    .then((res) => res.ok)
    .catch((err) => {
      console.warn('[demo-lead] network error:', err);
      return false;
    });
}

interface DemoLeadFormProps {
  /** Contexto de captura para telemetría (ej: 'bottom_cta', 'locked:Mercado'). */
  source: string;
  /** Texto del botón de envío. */
  cta?: string;
  /** Compacto = una sola fila (input + botón). */
  inline?: boolean;
  onCaptured?: () => void;
}

function DemoLeadForm({ source, cta = 'Enviar mi reporte →', inline = true, onCaptured }: DemoLeadFormProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = useCallback(async () => {
    const value = email.trim();
    if (!EMAIL_RE.test(value)) return;
    setLoading(true);
    posthog.capture('demo_lead_submit', { source });
    const ok = await submitDemoLead(value);
    setLoading(false);
    setSent(true);
    posthog.capture('demo_lead_captured', { source, delivered: ok });
    onCaptured?.();
  }, [email, source, onCaptured]);

  if (sent) {
    return (
      <div className="flex items-center gap-2.5 justify-center text-sm font-semibold text-emerald-600 dark:text-emerald-400 py-2">
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        ¡Listo! Revisa tu correo — te enviamos cómo obtener tu reporte real.
      </div>
    );
  }

  return (
    <div className={inline ? 'flex flex-col sm:flex-row gap-2 w-full max-w-md mx-auto' : 'space-y-2 w-full'}>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder="tu@email.com"
        autoComplete="email"
        className="flex-1 px-4 py-3 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-[#F0EFF8] placeholder:text-gray-400 focus:outline-none focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20 transition-all"
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !EMAIL_RE.test(email.trim())}
        className="shrink-0 px-5 py-3 bg-[#0EB5C6] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
      >
        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : cta}
      </button>
    </div>
  );
}

// ── Modal soft-wall lanzado desde secciones premium bloqueadas ────────────────

function DemoLeadModal({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white dark:bg-[#12121A] rounded-2xl shadow-2xl border border-[#0EB5C6]/30 p-6 max-w-sm w-full">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="w-11 h-11 rounded-xl bg-[#0EB5C6]/10 border border-[#0EB5C6]/30 flex items-center justify-center mb-4">
          <svg className="w-5 h-5 text-[#0EB5C6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        <h3 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">
          Desbloquea {label.toLowerCase()}
        </h3>
        <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-5 leading-relaxed">
          Déjanos tu email y te enviamos cómo generar este análisis sobre <strong>tu propia idea</strong> — sin tarjeta, en minutos.
        </p>

        <DemoLeadForm source={`locked:${label}`} cta="Enviarme acceso →" inline={false} />

        <p className="text-[11px] text-center text-gray-400 dark:text-[#afaebb] mt-4">
          ¿Prefieres crear tu cuenta directo?{' '}
          <Link to="/login" className="text-[#0EB5C6] font-semibold hover:underline" onClick={onClose}>
            Validar mi idea gratis
          </Link>
        </p>
      </div>
    </div>
  );
}

// ── Locked overlay for premium sections ──────────────────────────────────────

function DemoLocked({ label, onUnlock }: { label: string; onUnlock: (label: string) => void }) {
  return (
    <div className="relative rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10 overflow-hidden">
      <div className="filter blur-[3px] pointer-events-none select-none p-5 opacity-40" aria-hidden>
        <div className="h-4 bg-gray-200 dark:bg-white/10 rounded w-1/3 mb-3" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-gray-200 dark:bg-white/10 rounded-xl" />)}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 dark:bg-[#12121A]/80 backdrop-blur-sm p-6 text-center">
        <div className="w-10 h-10 rounded-xl bg-[#0EB5C6]/10 border border-[#0EB5C6]/30 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-[#0EB5C6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">{label}</p>
        <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-4 max-w-xs">Disponible en tu reporte personalizado</p>
        <button
          onClick={() => onUnlock(label)}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0EB5C6] text-white text-xs font-bold rounded-xl hover:bg-[#6B5EE6] transition-all"
        >
          Desbloquear con mi email →
        </button>
      </div>
    </div>
  );
}

// ── Main Demo page ────────────────────────────────────────────────────────────

export function Demo() {
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');
  const [lockedModal, setLockedModal] = useState<string | null>(null);

  const handleUnlock = useCallback((label: string) => {
    posthog.capture('demo_paywall_hit', { source: `locked:${label}` });
    setLockedModal(label);
  }, []);

  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] flex flex-col">

      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-black/[0.07] dark:border-white/[0.06] bg-[#F8F7FF]/85 dark:bg-[#0A0A0F]/85 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo/>
            <span className="font-heading text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Validus</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline text-xs font-semibold text-[#0EB5C6] dark:text-[#38D5E3] px-3 py-1.5 bg-[#0EB5C6]/10 rounded-full border border-[#0EB5C6]/20">
              Demo — FreshBox
            </span>
            <ThemeToggle/>
            <Link to="/login"
              className="text-sm font-semibold bg-[#0EB5C6] text-white px-4 py-2.5 rounded-xl hover:bg-[#6B5EE6] transition-all shadow-lg shadow-[#0EB5C6]/25">
              Validar mi idea →
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8">

        {/* Demo banner */}
        <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-[#0EB5C6]/8 border border-[#0EB5C6]/20 rounded-xl">
          <span className="w-2 h-2 rounded-full bg-[#0EB5C6] animate-pulse shrink-0" />
          <p className="text-xs text-[#38D5E3] font-medium flex-1">
            Estás viendo un <strong>reporte de demostración</strong>. Los datos son de la idea "FreshBox" generada por IA para mostrarte qué obtendrías.
          </p>
          <Link to="/login" className="text-xs font-bold text-[#0EB5C6] hover:underline whitespace-nowrap">
            Crear el mío →
          </Link>
        </div>

        {/* Report header */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] overflow-hidden mb-4 shadow-sm dark:shadow-none">
          <div className="px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-4 flex-1">
              <div className="w-12 h-12 rounded-xl bg-[#0EB5C6] flex items-center justify-center text-white font-black text-lg font-heading shrink-0">
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
                    ? 'text-[#0EB5C6] dark:text-[#38D5E3] border-b-2 border-[#0EB5C6] bg-[#0EB5C6]/5'
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
                  <div className="bg-[#0EB5C6]/8 border border-[#0EB5C6]/15 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-[#38D5E3] uppercase tracking-wide mb-1.5">Segmento objetivo</p>
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
                        <p className="text-xs font-semibold text-[#0EB5C6] mb-1.5">{qa.question}</p>
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
                <DemoLocked label="Matriz SWOT + Próximos pasos con timeline" onUnlock={handleUnlock} />
              </div>
            )}

            {/* ── Economía ── */}
            {activeTab === 'Economía' && (
              <div className="space-y-4">
                <UnitEconomicsCard data={EXAMPLE_UNIT_ECONOMICS} />
                <DemoLocked label="Modelos de revenue alternativos + Founder Fit" onUnlock={handleUnlock} />
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

                <DemoLocked label="Kanban interactivo del MVP + Roadmap regulatorio" onUnlock={handleUnlock} />
              </div>
            )}

          </div>
        </div>

        {/* Bottom CTA — soft paywall: captura email antes de empujar a registro */}
        <div className="mt-8 rounded-2xl bg-gradient-to-br from-[#0EB5C6]/10 to-[#F7C56C]/8 border border-[#0EB5C6]/20 p-8 text-center">
          <p className="text-xs font-bold text-[#38D5E3] uppercase tracking-widest mb-2">¿Lista tu idea?</p>
          <h2 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">
            Obtén tu propio reporte en 10 minutos
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-6 max-w-md mx-auto">
            Déjanos tu email y te mostramos cómo generar este análisis real con tu contexto, mercado e industria específicos.
          </p>

          <DemoLeadForm source="bottom_cta" />

          <p className="text-xs text-gray-400 dark:text-[#afaebb] mt-4">
            ¿Prefieres empezar ahora?{' '}
            <Link to="/login" className="text-[#0EB5C6] font-semibold hover:underline">
              Validar mi idea gratis →
            </Link>
          </p>
        </div>

      </main>

      {/* Soft-wall modal de secciones premium */}
      {lockedModal && <DemoLeadModal label={lockedModal} onClose={() => setLockedModal(null)} />}
    </div>
  );
}
