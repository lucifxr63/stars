import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { trackDemoViewed } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
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

/* ─── Logo Validus (inline SVG dual-mode) ─── */
function Logo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 338 426" className={className} aria-label="Validus" role="img">
      <path d="M111 187 A78 78 0 0 1 168 123" fill="none"
        className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt" />
      <path d="M213 123 A78 78 0 0 1 271 187" fill="none"
        className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt" />
      <path d="M66 198 H118 L169 292 L220 198 H272 L169 358 Z"
        className="fill-[#001431] dark:fill-white" />
      <path d="M134 252 L152 252 L169 286 L187 252 L205 252 L169 324 Z"
        className="fill-white dark:fill-[#0A0A0F]" />
      <path d="M155 253 L169 279 L192 253 L200 263 L169 303 L148 263 Z"
        className="fill-[#001431] dark:fill-white" />
      <path d="M169 68 L193 257 L169 237 L156 254 Z"
        className="fill-[#ff2b23] dark:fill-[#7C6FF7]" />
    </svg>
  );
}

/* ─── Types ─── */
const TABS = ['Resumen', 'Mercado', 'Competencia', 'Riesgo', 'Economía'] as const;
type Tab = typeof TABS[number];

const fmt = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(0)}M` : `$${(n / 1_000).toFixed(0)}K`;

/* ─── Score circle ─── */
function ScoreCircle({ score }: { score: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const fill = circ * (1 - score / 100);
  const color = score >= 70 ? '#34D399' : score >= 50 ? '#FBBF24' : '#F87171';
  return (
    <div className="relative w-24 h-24 flex items-center justify-center shrink-0">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} stroke="rgba(0,0,0,0.06)" className="dark:[stroke:rgba(255,255,255,0.06)]" strokeWidth="8" fill="none" />
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

/* ─── Example report tabs ─── */
function ExampleReport() {
  const [activeTab, setActiveTab] = useState<Tab>('Resumen');
  return (
    <section className="py-20 bg-gray-50 dark:bg-[#0A0A0F] border-t border-gray-100 dark:border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 rounded-full text-[11px] font-semibold text-[#7C6FF7] dark:text-[#A78BFA] mb-4">
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

        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-200 dark:border-white/[0.06] overflow-hidden shadow-sm dark:shadow-none">
          <div className="bg-gray-50 dark:bg-[#1A1A26] px-5 py-4 flex items-center justify-between border-b border-gray-200 dark:border-white/[0.06]">
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

          <div className="flex gap-1 px-4 pt-3 border-b border-gray-200 dark:border-white/[0.06] overflow-x-auto">
            {TABS.map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-all duration-150 cursor-pointer
                  ${activeTab === tab
                    ? 'text-[#7C6FF7] dark:text-[#A78BFA] border-b-2 border-[#7C6FF7] bg-[#7C6FF7]/5'
                    : 'text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8]'}`}>
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
                        <div key={key} className="bg-gray-50 dark:bg-[#12121A]/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
                          <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0] capitalize mb-1.5">{key}</p>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-gray-200 dark:bg-white/8 rounded-full">
                              <div className="h-full bg-[#7C6FF7] rounded-full" style={{ width: `${val}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8] tabular-nums">{val}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="bg-[#7C6FF7]/8 border border-[#7C6FF7]/15 rounded-xl p-4">
                    <p className="text-[11px] font-bold text-[#7C6FF7] dark:text-[#A78BFA] uppercase tracking-wide mb-1.5">Segmento objetivo</p>
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
              </div>
            )}

            {activeTab === 'Competencia' && (
              <div className="space-y-3">
                {EXAMPLE_COMPETITIVE.competitors.map((c) => (
                  <div key={c.name} className="border border-gray-200 dark:border-white/[0.06] rounded-xl p-4 bg-gray-50 dark:bg-[#12121A]/[0.02]">
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
                    <div key={dim.label} className="bg-gray-50 dark:bg-[#12121A]/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3">
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
                    <div key={item.label} className="bg-gray-50 dark:bg-[#12121A]/[0.03] border border-gray-200 dark:border-white/[0.06] rounded-xl p-3 text-center">
                      <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0] mb-1">{item.label}</p>
                      <p className="font-bold text-gray-900 dark:text-[#F0EFF8] text-sm font-heading">{item.value}</p>
                      <p className="text-[11px] text-gray-400 dark:text-[#4A495E] mt-0.5">{item.sub}</p>
                    </div>
                  ))}
                </div>
                <div className="bg-[#34D399]/8 border border-[#34D399]/15 rounded-xl p-4">
                  <p className="text-xs text-[#34D399]">
                    <span className="font-semibold">Break-even:</span> {EXAMPLE_UNIT_ECONOMICS.breakEvenUsers} usuarios ·{' '}
                    <span className="font-semibold">Churn:</span> {EXAMPLE_UNIT_ECONOMICS.monthlyChurnEstimate}%/mes
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Google icon ─── */
function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

/* ─── CTA buttons ─── */
function CtaButtons({ onGoogle, onEmail }: { onGoogle: () => void; onEmail: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
      <button onClick={onGoogle}
        className="group flex items-center justify-center gap-2.5 px-6 py-3.5
                   bg-white dark:bg-[#12121A] text-gray-900 dark:text-[#F0EFF8]
                   font-semibold rounded-xl border border-gray-200 dark:border-white/10
                   hover:bg-gray-50 dark:hover:bg-white/5 active:scale-[0.98]
                   shadow-md dark:shadow-none text-sm transition-all duration-150
                   w-full sm:w-auto cursor-pointer">
        <GoogleIcon />
        Continuar con Google
      </button>
      <button onClick={onEmail}
        className="px-6 py-3.5 bg-[#7C6FF7] text-white font-semibold rounded-xl
                   hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150
                   shadow-lg shadow-[#7C6FF7]/25 text-sm w-full sm:w-auto cursor-pointer">
        Entrar con email →
      </button>
    </div>
  );
}

/* ─── Check icon ─── */
function CheckIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/* ─── Main Landing ─── */
export function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [validationCount, setValidationCount] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
      const v = params.get(k);
      if (v) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem('utm_params', JSON.stringify(utm));
      if (typeof window !== 'undefined' && (window as any).posthog) {
        (window as any).posthog.people?.set_once(utm);
      }
    }
  }, [location.search]);

  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase
        .from('validations')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .then(({ count }) => { if (count && count > 0) setValidationCount(count); });
    });
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };
  const handleCTA = () => navigate('/login');

  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] flex flex-col">

      {/* ── Navbar ── */}
      <header className={`sticky top-0 z-50 transition-all duration-200
        bg-[#F8F7FF]/80 dark:bg-[#0A0A0F]/80 backdrop-blur-xl
        ${scrolled ? 'border-b border-black/[0.07] dark:border-white/[0.06]' : 'border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Logo className="w-8 h-10" />
            <span className="font-heading text-base font-semibold text-gray-900 dark:text-[#F0EFF8] tracking-tight">Validus</span>
          </div>

          {/* Desktop nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {[
              { label: 'Características', href: '#features' },
              { label: 'Cómo funciona', href: '#how' },
              { label: 'Precios', href: '#pricing' },
            ].map((l) => (
              <a key={l.href} href={l.href}
                className="px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-[#8B8AA0]
                           hover:text-gray-900 dark:hover:text-[#F0EFF8] hover:bg-black/5 dark:hover:bg-white/5
                           transition-all duration-150">
                {l.label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={handleCTA}
              className="hidden sm:block text-sm font-medium text-gray-600 dark:text-[#8B8AA0]
                         hover:text-gray-900 dark:hover:text-[#F0EFF8] px-3 py-2 transition-colors cursor-pointer">
              Iniciar sesión
            </button>
            <button onClick={handleCTA}
              className="text-sm font-semibold bg-[#7C6FF7] text-white px-4 py-2 rounded-lg
                         hover:bg-[#6B5EE6] active:scale-[0.98] transition-all duration-150
                         shadow-md shadow-[#7C6FF7]/20 cursor-pointer">
              Empezar gratis
            </button>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileMenuOpen((v) => !v)}
              className="md:hidden p-2 rounded-lg text-gray-500 dark:text-[#8B8AA0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Menú">
              {mobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-black/[0.07] dark:border-white/[0.06] bg-white dark:bg-[#12121A] px-4 py-3 space-y-1">
            {[
              { label: 'Características', href: '#features' },
              { label: 'Cómo funciona', href: '#how' },
              { label: 'Precios', href: '#pricing' },
            ].map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}
                className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-[#8B8AA0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                {l.label}
              </a>
            ))}
            <div className="pt-1 border-t border-black/[0.05] dark:border-white/[0.06] mt-1">
              <button onClick={handleCTA}
                className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-[#8B8AA0] hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer">
                Iniciar sesión
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">

        {/* ── Hero ── */}
        <section className="relative overflow-hidden pt-20 sm:pt-28 pb-16 sm:pb-24">
          <div className="absolute inset-0 grid-pattern" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[450px] bg-[#7C6FF7]/10 dark:bg-[#7C6FF7]/12 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-24 left-1/4 w-64 h-64 bg-[#F7C56C]/6 rounded-full blur-[80px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-[#7C6FF7]/5 rounded-full blur-[60px] pointer-events-none" />

          <div className="relative max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center max-w-3xl mx-auto">

              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 rounded-full text-[11px] font-semibold text-[#7C6FF7] dark:text-[#A78BFA] mb-8 uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF7] animate-pulse" />
                IA entrenada para startups · Chile y LatAm
              </div>

              {/* H1 */}
              <h1 className="font-heading text-[clamp(2.4rem,5vw,4.5rem)] font-extrabold text-gray-900 dark:text-[#F0EFF8] leading-[1.06] tracking-[-0.02em] mb-5">
                Valida tu idea de startup
                <br />
                <span className="gradient-text">antes de construirla</span>
              </h1>

              <p className="text-base sm:text-lg text-gray-500 dark:text-[#8B8AA0] mb-10 max-w-2xl mx-auto leading-relaxed">
                Un mentor de IA te guía en 3 pasos para descubrir si tu idea tiene potencial real.
                Score, mercado, competencia y finanzas — en 10 minutos.
              </p>

              <CtaButtons onGoogle={handleGoogleLogin} onEmail={handleCTA} />

              <p className="mt-5 text-xs text-gray-400 dark:text-[#4A495E]">
                Sin tarjeta de crédito · Resultados en 10 min · Ley 21.719 compliant
              </p>

              <Link to="/demo" onClick={() => trackDemoViewed('hero')}
                className="inline-block mt-3 text-xs text-[#7C6FF7] dark:text-[#A78BFA] hover:text-[#6B5EE6] underline underline-offset-2 transition-colors">
                Ver ejemplo de reporte →
              </Link>
            </div>

            {/* Floating score card */}
            <div className="mt-16 max-w-xs mx-auto">
              <div className="glass-card rounded-2xl p-5 animate-float glow-brand-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 rounded-xl bg-[#7C6FF7] flex items-center justify-center text-white font-black text-sm font-heading">78</div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">FreshBox</p>
                    <p className="text-xs text-[#34D399]">Bien validada</p>
                  </div>
                  <span className="ml-auto text-xs px-2 py-0.5 bg-[#34D399]/15 text-[#34D399] rounded-full border border-[#34D399]/20 font-medium">78 pts</span>
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
                      <div className="h-1 bg-gray-200 dark:bg-white/8 rounded-full">
                        <div className="h-full rounded-full transition-all" style={{ width: `${item.val}%`, backgroundColor: item.color }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-200 dark:border-white/[0.06]">
                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed">
                    "Idea con buen potencial. El mercado es amplio y el diferenciador es claro."
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Social Proof Bar ── */}
        <section className="py-8 border-y border-black/[0.05] dark:border-white/[0.06] bg-white/60 dark:bg-[#12121A]/40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10">
              <p className="text-xs font-semibold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide">
                {validationCount ? `+${validationCount} ideas validadas en Chile` : 'Analizamos ideas desde Chile'}
              </p>
              <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-white/10" />
              <div className="flex items-center gap-5">
                {['FinTech', 'EdTech', 'SaaS B2B', 'Retail', 'HealthTech'].map((ind) => (
                  <span key={ind} className="text-xs font-medium text-gray-400 dark:text-[#4A495E]">{ind}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how" className="py-20 border-t border-black/[0.05] dark:border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <p className="text-[11px] font-bold uppercase tracking-widest text-[#7C6FF7] dark:text-[#8B8AA0] mb-2">El proceso</p>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 dark:text-[#F0EFF8]">
                De la idea al análisis en 3 pasos
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {[
                {
                  num: '01', label: 'Tu idea', color: '#7C6FF7', time: '~3 min',
                  desc: 'Describe tu problema, solución e industria. Sin plantillas, en tus propias palabras.',
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  ),
                },
                {
                  num: '02', label: 'Tu mercado', color: '#34D399', time: '~4 min',
                  desc: 'Identifica el segmento, tamaño de mercado y cómo llegas a tus primeros 100 clientes.',
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                  ),
                },
                {
                  num: '03', label: 'Tu reporte', color: '#F7C56C', time: '~3 min',
                  desc: 'Score 0–100, análisis completo, unit economics, riesgos y próximos pasos concretos.',
                  icon: (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  ),
                },
              ].map((step, i) => (
                <div key={step.num} className="relative bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/[0.06] rounded-2xl p-6 hover:border-gray-200 dark:hover:border-white/12 hover:shadow-md dark:hover:shadow-none transition-all duration-200 cursor-default">
                  {i < 2 && (
                    <div className="hidden md:block absolute top-9 right-0 translate-x-1/2 z-10">
                      <svg className="w-4 h-4 text-gray-300 dark:text-[#4A495E]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                  <span className="absolute top-4 right-4 font-heading text-[4rem] font-black leading-none opacity-[0.04] text-gray-900 dark:text-white select-none">{step.num}</span>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${step.color}18`, color: step.color }}>
                      {step.icon}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-[#4A495E] tracking-widest uppercase">{step.time}</span>
                  </div>
                  <h3 className="font-heading text-base font-semibold text-gray-900 dark:text-[#F0EFF8] mb-2">{step.label}</h3>
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features Bento ── */}
        <section id="features" className="py-24 border-t border-black/[0.05] dark:border-white/[0.06] bg-white dark:bg-[#12121A]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#34D399]/10 border border-[#34D399]/20 rounded-full text-[11px] font-semibold text-[#34D399] mb-4 uppercase tracking-wide">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Todo en un solo lugar
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
                El análisis más completo
              </h2>
              <p className="text-gray-500 dark:text-[#8B8AA0] max-w-2xl mx-auto text-base sm:text-lg">
                No solo opinión — datos duros, estrategia de mercado y proyecciones financieras
                para tomar decisiones con confianza.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* col-span-2 */}
              <div className="md:col-span-2 bg-[#F8F7FF] dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-3xl p-8 hover:border-[#7C6FF7]/20 dark:hover:border-white/10 hover:shadow-lg dark:hover:shadow-none transition-all duration-200 cursor-default">
                <div className="w-12 h-12 rounded-2xl bg-[#7C6FF7]/10 text-[#7C6FF7] flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Mercado y Competencia</h3>
                <p className="text-gray-500 dark:text-[#8B8AA0] mb-6 text-sm leading-relaxed">
                  Dimensionamos tu mercado con TAM, SAM y SOM. Analizamos competidores directos identificando fortalezas, debilidades y la ventaja competitiva que puedes explotar.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Cálculo TAM/SAM/SOM', 'Radar Competitivo', 'Gaps de Mercado'].map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">{tag}</span>
                  ))}
                </div>
              </div>

              <div className="bg-[#F8F7FF] dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-3xl p-8 hover:border-[#F7C56C]/20 dark:hover:border-white/10 hover:shadow-lg dark:hover:shadow-none transition-all duration-200 cursor-default">
                <div className="w-12 h-12 rounded-2xl bg-[#F7C56C]/10 text-[#F7C56C] flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Unit Economics</h3>
                <p className="text-gray-500 dark:text-[#8B8AA0] text-sm leading-relaxed">
                  CAC, LTV, ratio de rentabilidad, payback period y punto crítico de churn — los números que los inversores quieren ver.
                </p>
              </div>

              <div className="bg-[#F8F7FF] dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-3xl p-8 hover:border-[#34D399]/20 dark:hover:border-white/10 hover:shadow-lg dark:hover:shadow-none transition-all duration-200 cursor-default">
                <div className="w-12 h-12 rounded-2xl bg-[#34D399]/10 text-[#34D399] flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Compliance Chileno</h3>
                <p className="text-gray-500 dark:text-[#8B8AA0] text-sm leading-relaxed">
                  Validación cruzada con SII, INAPI y CMF. Tu idea analizada contra el marco regulatorio real de Chile desde el día 1.
                </p>
              </div>

              <div className="md:col-span-2 bg-[#F8F7FF] dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-3xl p-8 hover:border-[#A78BFA]/20 dark:hover:border-white/10 hover:shadow-lg dark:hover:shadow-none transition-all duration-200 cursor-default">
                <div className="w-12 h-12 rounded-2xl bg-[#A78BFA]/10 text-[#A78BFA] flex items-center justify-center mb-6">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Founder Fit y Mentoría</h3>
                <p className="text-gray-500 dark:text-[#8B8AA0] mb-6 text-sm leading-relaxed">
                  Evaluamos el fit entre tus habilidades actuales y lo que la idea necesita. Te recomendamos los roles clave a contratar y te emparejamos con mentores sugeridos por IA.
                </p>
                <div className="flex flex-wrap gap-2">
                  {['Radar Founder-Fit', 'Perfiles Requeridos', 'Mentores AI'].map((tag) => (
                    <span key={tag} className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">{tag}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Example Report ── */}
        <ExampleReport />

        {/* ── Stats ── */}
        <section className="py-16 border-y border-black/[0.05] dark:border-white/[0.06]">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-8 text-center">
              {[
                { num: validationCount ? `+${validationCount}` : '3', label: 'Pasos guiados', sub: 'proceso simple' },
                { num: '10', label: 'Minutos', sub: 'tiempo promedio' },
                { num: '10', label: 'Dimensiones', sub: 'de análisis' },
                { num: '4', label: 'Planes', sub: 'free hasta premium' },
              ].map((item) => (
                <div key={item.label}>
                  <p className="font-heading text-3xl sm:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">{item.num}</p>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 dark:text-[#8B8AA0]">{item.label}</p>
                  <p className="hidden sm:block text-xs text-gray-400 dark:text-[#4A495E] mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Testimonials ── */}
        <section className="py-20 border-t border-black/[0.05] dark:border-white/[0.06] bg-white dark:bg-[#12121A]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 dark:text-[#F0EFF8]">
                Lo que dicen los founders
              </h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  name: 'Valentina M.',
                  role: 'Founder · EdTech Santiago',
                  quote: 'Tenía mi idea hace 6 meses y no sabía si tenía sentido. Validus me dio un score de 74 y un roadmap concreto en 10 minutos.',
                  score: 74,
                  color: '#7C6FF7',
                },
                {
                  name: 'Rodrigo C.',
                  role: 'Co-founder · FinTech Concepción',
                  quote: 'El análisis de competidores con datos del CMF fue lo que más me sorprendió. Algo que habría tomado semanas lo tuve en horas.',
                  score: 81,
                  color: '#34D399',
                },
                {
                  name: 'Catalina V.',
                  role: 'CEO · HealthTech Valparaíso',
                  quote: 'La sección de Unit Economics me ayudó a convencer a mi primer angel investor. El PDF es investor-ready desde el día 1.',
                  score: 69,
                  color: '#F7C56C',
                },
              ].map((t) => (
                <div key={t.name} className="bg-[#F8F7FF] dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-2xl p-6 flex flex-col gap-4 hover:border-gray-200 dark:hover:border-white/10 hover:shadow-md dark:hover:shadow-none transition-all duration-200">
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <svg key={i} className="w-3.5 h-3.5 text-[#F7C56C]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    ))}
                  </div>
                  <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed flex-1">"{t.quote}"</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">{t.name}</p>
                      <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{t.role}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm font-heading text-white shrink-0"
                      style={{ backgroundColor: t.color }}>
                      {t.score}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="py-24 border-t border-black/[0.05] dark:border-white/[0.06] bg-[#F8F7FF] dark:bg-[#0A0A0F]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 rounded-full text-[11px] font-semibold text-[#7C6FF7] dark:text-[#A78BFA] mb-4 uppercase tracking-wide">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                </svg>
                Simple y transparente
              </span>
              <h2 className="font-heading text-3xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
                Elige tu nivel de profundidad
              </h2>
              <p className="text-gray-500 dark:text-[#8B8AA0] max-w-xl mx-auto text-base">
                Comienza gratis. Escala cuando necesites datos duros y planes de acción.
              </p>
              <p className="text-xs text-gray-400 dark:text-[#4A495E] mt-2">Todos los planes incluyen Ley 21.719 de Privacidad</p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {/* Free */}
              <div className="flex flex-col p-7 rounded-3xl bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-all duration-200">
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">Free</h3>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-5">Para explorar el potencial de tu idea.</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-gray-900 dark:text-[#F0EFF8] font-heading">$0</span>
                  <span className="text-sm text-gray-500 dark:text-[#8B8AA0]">/mes</span>
                </div>
                <button onClick={handleCTA}
                  className="w-full py-2.5 px-4 bg-gray-100 dark:bg-[#1A1A24] text-gray-900 dark:text-[#F0EFF8] font-semibold rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/5 transition mb-7 text-sm cursor-pointer">
                  Comenzar gratis
                </button>
                <ul className="space-y-3 flex-1">
                  {['1 idea gratis', 'Score general 0–100', 'Resumen ejecutivo + feedback IA', 'Análisis básico de competidores', 'Export PDF estándar'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-[#C4C4D4]">
                      <CheckIcon className="w-4 h-4 text-[#34D399] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pro — highlighted */}
              <div className="relative flex flex-col p-7 rounded-3xl bg-white dark:bg-[#12121A] border-2 border-[#7C6FF7] shadow-2xl shadow-[#7C6FF7]/10 dark:shadow-[#7C6FF7]/8 overflow-hidden">
                <div className="absolute top-0 right-0 px-4 py-1.5 bg-[#7C6FF7] text-white text-[10px] font-bold rounded-bl-xl tracking-wide">
                  POPULAR
                </div>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-28 bg-[#7C6FF7]/8 blur-3xl pointer-events-none" />

                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1 relative z-10">Pro</h3>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-5 relative z-10">Para founders que toman decisiones con datos.</p>
                <div className="mb-6 relative z-10">
                  <span className="text-4xl font-black text-gray-900 dark:text-[#F0EFF8] font-heading">$20.000</span>
                  <span className="text-sm text-gray-500 dark:text-[#8B8AA0]"> CLP/mes</span>
                </div>
                <button onClick={handleCTA}
                  className="w-full py-2.5 px-4 bg-[#7C6FF7] text-white font-semibold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] transition shadow-lg shadow-[#7C6FF7]/20 mb-7 text-sm relative z-10 cursor-pointer">
                  Crear cuenta Pro
                </button>
                <ul className="space-y-3 flex-1 relative z-10">
                  <li className="flex items-start gap-2.5 text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">
                    <CheckIcon className="w-4 h-4 text-[#7C6FF7] shrink-0 mt-0.5" />
                    Todo lo del plan Free, más:
                  </li>
                  {['Ideas y pivotes ilimitados', 'TAM/SAM/SOM dimensionado', 'Unit Economics (CAC, LTV, Payback)', 'Matriz de Riesgos y Mitigaciones', 'Founder Fit + recomendación de equipo', 'PDF multitema investor-ready'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-[#C4C4D4]">
                      <CheckIcon className="w-4 h-4 text-[#7C6FF7] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Premium */}
              <div className="flex flex-col p-7 rounded-3xl bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/5 hover:border-gray-300 dark:hover:border-white/10 transition-all duration-200">
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">Premium</h3>
                <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-5">Para startups en etapa seed y growth.</p>
                <div className="mb-6">
                  <span className="text-4xl font-black text-gray-900 dark:text-[#F0EFF8] font-heading">$50.000</span>
                  <span className="text-sm text-gray-500 dark:text-[#8B8AA0]"> CLP/mes</span>
                </div>
                <button onClick={handleCTA}
                  className="w-full py-2.5 px-4 bg-gray-100 dark:bg-[#1A1A24] text-gray-900 dark:text-[#F0EFF8] font-semibold rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/5 transition mb-7 text-sm cursor-pointer">
                  Crear cuenta Premium
                </button>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-start gap-2.5 text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">
                    <CheckIcon className="w-4 h-4 text-[#F7C56C] shrink-0 mt-0.5" />
                    Todo lo del plan Pro, más:
                  </li>
                  {['Due Diligence completo (SII + INAPI + CMF)', 'Encuestas Mom Test con análisis de sesgos', 'Data Room PDF para inversores', 'API acceso completo', 'Soporte prioritario en español'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-[#C4C4D4]">
                      <CheckIcon className="w-4 h-4 text-[#F7C56C] shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="py-24 text-center px-4 border-t border-black/[0.05] dark:border-white/[0.06]">
          <div className="relative max-w-2xl mx-auto">
            <div className="absolute inset-0 bg-[#7C6FF7]/6 dark:bg-[#7C6FF7]/8 rounded-3xl blur-2xl pointer-events-none" />
            <div className="relative bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/[0.06] rounded-3xl px-8 py-16 shadow-xl dark:shadow-none">
              <span className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 rounded-full text-[11px] font-semibold text-[#7C6FF7] dark:text-[#A78BFA] mb-6 uppercase tracking-wide">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Comienza ahora · Es gratis
              </span>
              <h2 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
                ¿Tu idea tiene potencial?
              </h2>
              <p className="text-gray-500 dark:text-[#8B8AA0] mb-10 max-w-sm mx-auto text-base">
                Descúbrelo en 10 minutos con un análisis completo impulsado por IA.
              </p>
              <CtaButtons onGoogle={handleGoogleLogin} onEmail={handleCTA} />
              <p className="mt-6 text-xs text-gray-400 dark:text-[#4A495E]">
                Sin tarjeta · Cancela cuando quieras · Soporte en español
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-black/[0.05] dark:border-white/[0.06] py-12 bg-[#F8F7FF] dark:bg-[#0A0A0F]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-8">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <Logo className="w-7 h-8" />
                <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">Validus</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-4">
                Valida tu idea de startup antes de construirla.
              </p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#34D399]/10 border border-[#34D399]/20 rounded-lg text-[10px] font-semibold text-[#34D399]">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                Ley 21.719 Compliance
              </div>
            </div>

            {/* Producto */}
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8] uppercase tracking-wide mb-3">Producto</p>
              <ul className="space-y-2">
                {[
                  { label: 'Características', href: '#features' },
                  { label: 'Precios', href: '#pricing' },
                  { label: 'Demo', to: '/demo' },
                  { label: 'API & Developers', to: '/developers' },
                ].map((l) => (
                  <li key={l.label}>
                    {'to' in l
                      ? <Link to={l.to!} className="text-xs text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">{l.label}</Link>
                      : <a href={l.href} className="text-xs text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">{l.label}</a>
                    }
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8] uppercase tracking-wide mb-3">Legal</p>
              <ul className="space-y-2">
                <li><span className="text-xs text-gray-500 dark:text-[#8B8AA0]">Términos de uso</span></li>
                <li><span className="text-xs text-gray-500 dark:text-[#8B8AA0]">Política de privacidad</span></li>
                <li>
                  <a href="mailto:contacto@validus.scouttech.lat"
                    className="text-xs text-gray-500 dark:text-[#8B8AA0] hover:text-[#7C6FF7] transition-colors">
                    contacto@validus.scouttech.lat
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-black/[0.05] dark:border-white/[0.06] pt-6">
            <p className="text-xs text-gray-400 dark:text-[#4A495E] text-center">
              © {new Date().getFullYear()} Validus · Hecho en Chile
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
