import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { trackDemoViewed } from '@/hooks/useAnalytics';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { ProductShowcase } from '@/components/landing/ProductShowcase';
import { ProcessShowcase } from '@/components/landing/ProcessShowcase';
import { BralidusEngine } from '@/components/landing/BralidusEngine';
import { DenariusPromo } from '@/components/landing/DenariusPromo';
import { ScouttechSection } from '@/components/landing/ScouttechSection';
import { FaqSection } from '@/components/landing/FaqSection';

/* ─── Logo ─── */
function Logo({ className = 'w-9 h-9' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} aria-label="Validus" role="img">
      <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white" />
      <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6" />
      <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6" />
    </svg>
  );
}

/* ─── Product Mockup ─── */
function ProductMockup() {
  return (
    <div className="relative w-full select-none pt-8 pb-10 pl-6 pr-4 sm:pt-8 sm:pb-12 sm:pl-8 sm:pr-6">
      {/* Floating badge — top-left */}
      <div className="absolute top-0 left-0 z-20 bg-white dark:bg-[#1A1A26] rounded-2xl border border-gray-100 dark:border-white/10 shadow-xl px-3 py-2.5 flex items-center gap-2.5 animate-float">
        <div className="w-7 h-7 rounded-full bg-[#34D399] flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <div>
          <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8] leading-none">Score 78/100</p>
          <p className="text-[10px] text-[#34D399] mt-0.5">Alto potencial</p>
        </div>
      </div>

      {/* Floating economics — bottom-right */}
      <div className="absolute bottom-0 right-0 z-20 w-40 sm:w-44 bg-white dark:bg-[#1A1A26] rounded-2xl border border-gray-100 dark:border-white/10 shadow-xl p-3" style={{ animationDelay: '1s' }}>
        <p className="text-[9px] font-bold text-gray-400 dark:text-[#afaebb] uppercase tracking-widest mb-2">Unit Economics</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { label: 'LTV/CAC', value: '4.2x', color: '#34D399' },
            { label: 'Payback', value: '8m', color: '#0EB5C6' },
            { label: 'TAM', value: '$45M', color: '#F7C56C' },
            { label: 'Break', value: '180u', color: '#38D5E3' },
          ].map(m => (
            <div key={m.label} className="bg-gray-50 dark:bg-[#12121A] rounded-lg p-1.5 text-center">
              <p className="text-xs font-black font-heading" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[9px] text-gray-400 dark:text-[#afaebb]">{m.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Main browser window */}
      <div className="relative z-10 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-200 dark:border-white/[0.08] shadow-2xl overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 dark:bg-[#1A1A26] border-b border-gray-200 dark:border-white/[0.06]">
          <div className="flex gap-1.5 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
            <div className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div className="flex-1 bg-white dark:bg-[#0A0A0F] rounded-full px-3 py-1 flex items-center gap-1.5">
            <svg className="w-2.5 h-2.5 text-[#34D399] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            <span className="text-[10px] text-gray-400 dark:text-[#afaebb] font-mono truncate">validus.scouttech.lat/results</span>
          </div>
        </div>

        {/* App content */}
        <div className="p-5 space-y-4">
          {/* Top row: name + score badge */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#0EB5C6] flex items-center justify-center text-white font-black text-sm font-heading shrink-0">78</div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">FreshBox Chile</p>
                <p className="text-[11px] text-gray-500 dark:text-[#8B8AA0]">Retail D2C · Chile</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold px-2.5 py-1 bg-[#34D399]/12 text-[#34D399] rounded-full border border-[#34D399]/20">Completada</span>
          </div>

          {/* Score bars */}
          <div className="space-y-2">
            {[
              { label: 'Problema', val: 82, color: '#0EB5C6' },
              { label: 'Mercado', val: 75, color: '#34D399' },
              { label: 'Competencia', val: 68, color: '#F7C56C' },
              { label: 'Solución', val: 85, color: '#38D5E3' },
              { label: 'Ejecución', val: 71, color: '#F87171' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500 dark:text-[#8B8AA0] w-20 shrink-0">{item.label}</span>
                <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${item.val}%`, backgroundColor: item.color }} />
                </div>
                <span className="text-[10px] font-bold text-gray-700 dark:text-[#F0EFF8] tabular-nums w-5 text-right">{item.val}</span>
              </div>
            ))}
          </div>

          {/* AI insight */}
          <div className="bg-[#0EB5C6]/6 border border-[#0EB5C6]/15 rounded-xl p-3 flex gap-2.5">
            <div className="w-5 h-5 rounded-full bg-[#0EB5C6] flex items-center justify-center shrink-0 mt-0.5">
              <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-[#C4C4D4] leading-relaxed">
              "Propuesta sólida en mercado con alta demanda reprimida. El diferenciador de frescura directa reduce el CAC en ~40%."
            </p>
          </div>

          {/* PDF badge */}
          <div className="flex items-center gap-2 pt-1">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-[#1A1A26] border border-gray-200 dark:border-white/[0.06] rounded-lg">
              <svg className="w-3.5 h-3.5 text-[#F87171]" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" /></svg>
              <span className="text-[10px] font-medium text-gray-600 dark:text-[#8B8AA0]">Investor_FreshBox.pdf</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 dark:bg-[#1A1A26] border border-gray-200 dark:border-white/[0.06] rounded-lg">
              <svg className="w-3.5 h-3.5 text-[#0EB5C6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              <span className="text-[10px] font-medium text-gray-600 dark:text-[#8B8AA0]">Compartir reporte</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Google icon ─── */
function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
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


/* ══════════════════════════════════════
   MAIN LANDING
══════════════════════════════════════ */
export function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [validationCount, setValidationCount] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const utm: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach(k => {
      const v = params.get(k); if (v) utm[k] = v;
    });
    if (Object.keys(utm).length > 0) {
      sessionStorage.setItem('utm_params', JSON.stringify(utm));
      if (typeof window !== 'undefined' && (window as any).posthog)
        (window as any).posthog.people?.set_once(utm);
    }
  }, [location.search]);

  useEffect(() => {
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.from('validations').select('id', { count: 'exact', head: true }).eq('status', 'completed')
        .then(({ count }) => { if (count && count > 0) setValidationCount(count); });
    });
  }, []);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 16);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/auth/callback` } });
  };
  const handleCTA = () => navigate('/login');

  const NAV_LINKS = [
    { label: 'Cómo funciona', href: '#how' },
    { label: 'Demo', href: '#demo' },
    { label: 'Motor', href: '#bralidus' },
    { label: 'Precios', href: '#pricing' },
  ];

  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] flex flex-col overflow-x-hidden">

      {/* ══ NAVBAR ══ */}
      <header className={`sticky top-0 z-50 transition-all duration-300
        bg-[#F8F7FF]/85 dark:bg-[#0A0A0F]/85 backdrop-blur-xl
        ${scrolled ? 'border-b border-black/[0.07] dark:border-white/[0.06] shadow-sm dark:shadow-none' : 'border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

          {/* Brand */}
          <div className="flex items-center gap-2 shrink-0">
            <Logo className="w-6 h-8" />
            <span className="font-heading text-base font-bold text-gray-900 dark:text-[#F0EFF8] tracking-tight">Validus</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href}
                className="px-3.5 py-2 rounded-lg text-sm font-medium text-gray-600 dark:text-[#8B8AA0]
                           hover:text-gray-900 dark:hover:text-[#F0EFF8] hover:bg-black/[0.05] dark:hover:bg-white/[0.05]
                           transition-all duration-150">
                {l.label}
              </a>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <button onClick={handleCTA}
              className="hidden sm:block text-sm font-medium text-gray-600 dark:text-[#8B8AA0]
                         hover:text-gray-900 dark:hover:text-[#F0EFF8] px-3 py-2 rounded-lg
                         hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-all cursor-pointer whitespace-nowrap">
              Iniciar sesión
            </button>
            <button onClick={handleCTA}
              className="flex items-center gap-1.5 text-sm font-semibold bg-[#0EB5C6] text-white
                         px-4 py-2.5 rounded-xl hover:bg-[#6B5EE6] active:scale-[0.97]
                         transition-all duration-150 shadow-lg shadow-[#0EB5C6]/25 cursor-pointer whitespace-nowrap">
              Empezar gratis
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </button>
            {/* Mobile hamburger */}
            <button onClick={() => setMobileMenuOpen(v => !v)}
              className="lg:hidden p-2 rounded-xl text-gray-500 dark:text-[#8B8AA0]
                         hover:bg-black/[0.05] dark:hover:bg-white/[0.05] transition-colors cursor-pointer"
              aria-label="Menú">
              {mobileMenuOpen
                ? <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                : <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h7" /></svg>
              }
            </button>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-black/[0.07] dark:border-white/[0.06] bg-white dark:bg-[#0D0D15] px-4 py-4 space-y-1">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMobileMenuOpen(false)}
                className="block px-4 py-3 rounded-xl text-sm font-medium text-gray-700 dark:text-[#C4C4D4] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors">
                {l.label}
              </a>
            ))}
            <div className="pt-2 border-t border-gray-100 dark:border-white/[0.06] mt-2">
              <button onClick={handleCTA}
                className="w-full text-left px-4 py-3 rounded-xl text-sm font-medium text-gray-700 dark:text-[#C4C4D4] hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-colors cursor-pointer">
                Iniciar sesión
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">

        {/* ══ HERO ══ */}
        <section ref={heroRef} className="relative overflow-hidden pt-10 sm:pt-16 lg:pt-20 pb-8 sm:pb-16 lg:pb-20">
          {/* Background layers */}
          <div className="absolute inset-0 grid-pattern opacity-60" />
          <div className="absolute top-0 right-0 w-[70%] h-full bg-gradient-to-l from-[#0EB5C6]/6 dark:from-[#0EB5C6]/8 to-transparent pointer-events-none" />
          <div className="absolute top-1/2 left-1/3 -translate-y-1/2 w-[600px] h-[600px] bg-[#0EB5C6]/8 dark:bg-[#0EB5C6]/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-[#F7C56C]/8 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid lg:grid-cols-2 gap-6 sm:gap-10 lg:gap-16 items-center">

              {/* Left — text */}
              <div className="order-2 lg:order-1 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0EB5C6]/10 border border-[#0EB5C6]/20 rounded-full text-[11px] font-semibold text-[#0EB5C6] dark:text-[#38D5E3] mb-7 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0EB5C6] animate-pulse shrink-0" />
                  Hecho en Chile · construido para founders de LatAm
                </div>

                <h1 className="font-heading text-[clamp(1.85rem,5vw,3.75rem)] font-extrabold text-gray-900 dark:text-[#F0EFF8] leading-[1.08] tracking-[-0.02em] mb-4 sm:mb-6">
                  El dossier que un VC haría sobre tu startup —{' '}
                  <span className="gradient-text">antes de construirla</span>
                </h1>

                <p className="text-sm sm:text-base lg:text-lg text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-6 sm:mb-8 max-w-lg mx-auto lg:mx-0">
                  Un mentor de IA te guía en 4 pasos para descubrir si tu idea tiene
                  potencial real. Veredicto, mercado, finanzas e inversión — en 10 minutos.
                </p>

                {/* CTAs */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start mb-5">
                  <button onClick={handleGoogleLogin}
                    className="flex items-center justify-center gap-2.5 px-5 py-3.5
                               bg-white dark:bg-[#12121A] text-gray-900 dark:text-[#F0EFF8]
                               font-semibold rounded-xl border border-gray-200 dark:border-white/10
                               hover:bg-gray-50 dark:hover:bg-white/[0.06] active:scale-[0.98]
                               shadow-md text-sm transition-all duration-150 cursor-pointer">
                    <GoogleIcon />
                    Continuar con Google
                  </button>
                  <button onClick={handleCTA}
                    className="flex items-center justify-center gap-2 px-5 py-3.5 bg-[#0EB5C6] text-white
                               font-semibold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98]
                               shadow-lg shadow-[#0EB5C6]/30 text-sm transition-all duration-150 cursor-pointer">
                    Entrar con email
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3 sm:gap-5">
                  <p className="text-xs text-gray-400 dark:text-[#afaebb]">
                    Sin tarjeta · 10 min · Ley 21.719
                  </p>
                  <Link to="/demo" onClick={() => trackDemoViewed('hero')}
                    className="text-xs text-[#0EB5C6] dark:text-[#38D5E3] hover:underline transition-colors font-medium">
                    Ver demo en vivo →
                  </Link>
                </div>

                {/* LatAm reach + trust */}
                <div className="mt-6 pt-5 border-t border-gray-200 dark:border-white/[0.06] space-y-3">
                  <div className="flex flex-wrap items-center gap-2 justify-center lg:justify-start">
                    <span className="text-sm" aria-hidden="true">🇨🇱</span>
                    <span className="text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">Empezamos en Chile, construyendo para toda LatAm</span>
                    <span className="hidden sm:inline text-sm tracking-tight opacity-80" aria-hidden="true">🇲🇽 🇨🇴 🇦🇷 🇵🇪</span>
                  </div>
                  <div className="hidden sm:flex flex-wrap items-center gap-4 justify-center lg:justify-start">
                    {[
                      { icon: '🔒', label: 'Datos cifrados' },
                      { icon: '⚖️', label: 'Ley 21.719' },
                      { icon: '⚡', label: '10 min promedio' },
                    ].map(t => (
                      <div key={t.label} className="flex items-center gap-1.5">
                        <span className="text-sm" aria-hidden="true">{t.icon}</span>
                        <span className="text-xs font-medium text-gray-500 dark:text-[#8B8AA0]">{t.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right — product mockup */}
              <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
                <div className="w-full max-w-[360px] sm:max-w-[420px] lg:max-w-full lg:w-[460px]">
                  <ProductMockup />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ══ SOCIAL PROOF ══ */}
        <section className="py-6 border-y border-black/[0.05] dark:border-white/[0.04] bg-white/70 dark:bg-[#12121A]/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-8 text-center">
              <p className="text-xs font-semibold text-gray-400 dark:text-[#afaebb] uppercase tracking-widest whitespace-nowrap">
                {validationCount ? `+${validationCount} ideas validadas` : 'Análisis desde Chile'}
              </p>
              <div className="hidden sm:block w-px h-4 bg-gray-200 dark:bg-white/10" />
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
                {[
                  { label: 'FinTech', color: '#0EB5C6' },
                  { label: 'EdTech', color: '#34D399' },
                  { label: 'SaaS B2B', color: '#F7C56C' },
                  { label: 'Retail', color: '#F87171' },
                  { label: 'HealthTech', color: '#38D5E3' },
                  { label: 'AgriTech', color: '#FBBF24' },
                ].map(i => (
                  <span key={i.label}
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-full border"
                    style={{ color: i.color, borderColor: `${i.color}30`, backgroundColor: `${i.color}0f` }}>
                    {i.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ══ HOW IT WORKS — stepper interactivo ══ */}
        <ProcessShowcase />

        {/* ══ FEATURES BENTO ══ */}
        <section id="features" className="py-14 sm:py-20 lg:py-28 border-t border-black/[0.05] dark:border-white/[0.06] bg-white dark:bg-[#12121A]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-16">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#34D399]/10 border border-[#34D399]/20 rounded-full text-[11px] font-semibold text-[#34D399] mb-5 uppercase tracking-wider">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Todo incluido
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-5">
                El análisis más completo
              </h2>
              <p className="text-gray-500 dark:text-[#8B8AA0] max-w-2xl mx-auto text-base sm:text-lg leading-relaxed">
                No solo opinión — datos duros, estrategia de mercado y proyecciones financieras
                para tomar decisiones con confianza desde el primer día.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-5">

              {/* Veredicto VC — col-span-2 */}
              <div className="md:col-span-2 bg-[#F8F7FF] dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.05] rounded-3xl p-7 sm:p-8 group hover:border-[#0EB5C6]/25 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-[#0EB5C6]/10 text-[#0EB5C6] flex items-center justify-center mb-5">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Veredicto VC sin cortesías</h3>
                    <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-5">Un score de 5 dimensiones, la "verdad incómoda" que nadie te dice y tu Founder-Market Fit. El diagnóstico que haría un comité de inversión, no un chatbot complaciente.</p>
                    <div className="flex flex-wrap gap-2">
                      {['Score 5D', 'Verdad incómoda', 'Founder-Fit', 'Sesgos cognitivos'].map(t => (
                        <span key={t} className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">{t}</span>
                      ))}
                    </div>
                  </div>
                  {/* Mini score-bars */}
                  <div className="hidden sm:block w-48 shrink-0 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 space-y-2.5">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-[#afaebb] uppercase tracking-wide">Desglose</p>
                      <span className="text-[10px] font-black font-heading text-[#0EB5C6]">78/100</span>
                    </div>
                    {[
                      { name: 'Problema', val: 82, color: '#0EB5C6' },
                      { name: 'Mercado', val: 85, color: '#34D399' },
                      { name: 'Competencia', val: 65, color: '#F7C56C' },
                      { name: 'Solución', val: 80, color: '#38D5E3' },
                      { name: 'Ejecución', val: 72, color: '#F87171' },
                    ].map(c => (
                      <div key={c.name}>
                        <div className="flex justify-between text-[10px] mb-1">
                          <span className="text-gray-600 dark:text-[#8B8AA0] font-medium">{c.name}</span>
                          <span style={{ color: c.color }} className="font-bold">{c.val}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full">
                          <div className="h-full rounded-full transition-all" style={{ width: `${c.val}%`, backgroundColor: c.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Mercado & Competencia */}
              <div className="bg-[#F8F7FF] dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.05] rounded-3xl p-7 hover:border-[#A78BFA]/25 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-[#A78BFA]/10 text-[#A78BFA] flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Mercado & Competencia</h3>
                <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-4">TAM/SAM/SOM, radar de competidores con sus brechas, SWOT y señales de mercado en tiempo real.</p>
                <div className="space-y-1.5">
                  {[{ l: 'TAM', w: '100%', c: '#34D399' }, { l: 'SAM', w: '55%', c: '#38D5E3' }, { l: 'SOM', w: '22%', c: '#F7C56C' }].map(t => (
                    <div key={t.l} className="flex items-center gap-2">
                      <span className="text-[10px] font-bold w-8 shrink-0" style={{ color: t.c }}>{t.l}</span>
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/[0.06] rounded-full"><div className="h-full rounded-full" style={{ width: t.w, backgroundColor: t.c }} /></div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Finanzas & Riesgo */}
              <div className="bg-[#F8F7FF] dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.05] rounded-3xl p-7 hover:border-[#F7C56C]/25 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
                <div className="w-12 h-12 rounded-2xl bg-[#F7C56C]/10 text-[#F7C56C] flex items-center justify-center mb-5">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Finanzas & Riesgo</h3>
                <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-4">CAC, LTV, payback y una matriz de riesgos en 4 dimensiones con mitigaciones concretas. Los números que un inversor pide.</p>
                <div className="grid grid-cols-2 gap-2">
                  {[{ v: '4.2x', l: 'LTV/CAC', c: '#34D399' }, { v: '8m', l: 'Payback', c: '#0EB5C6' }].map(m => (
                    <div key={m.l} className="bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/[0.06] rounded-xl p-2.5 text-center">
                      <p className="font-black font-heading text-sm" style={{ color: m.c }}>{m.v}</p>
                      <p className="text-[10px] text-gray-500 dark:text-[#afaebb]">{m.l}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inversión, Legal & Due Diligence — col-span-2 */}
              <div className="md:col-span-2 bg-[#F8F7FF] dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/[0.05] rounded-3xl p-7 sm:p-8 hover:border-[#34D399]/25 hover:shadow-xl dark:hover:shadow-none transition-all duration-300">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-1">
                    <div className="w-12 h-12 rounded-2xl bg-[#34D399]/10 text-[#34D399] flex items-center justify-center mb-5">
                      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Inversión, Legal & Due Diligence</h3>
                    <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-5">Cap table con vesting, hoja de ruta de fundraising y un Due Diligence AI-RAG. Todo cruzado con el marco chileno real: Ley 21.719, INAPI y CMF.</p>
                    <div className="flex flex-wrap gap-2">
                      {['Cap Table', 'Fundraising', 'Due Diligence', 'Marco legal CL'].map(t => (
                        <span key={t} className="px-3 py-1 bg-white dark:bg-[#1A1A24] border border-gray-200 dark:border-white/10 rounded-lg text-xs font-medium text-gray-600 dark:text-[#C4C4D4]">{t}</span>
                      ))}
                    </div>
                  </div>
                  {/* Checklist legal */}
                  <div className="hidden sm:block w-48 shrink-0 bg-white dark:bg-[#12121A] rounded-2xl border border-gray-200 dark:border-white/[0.06] p-4 space-y-2.5">
                    <p className="text-[10px] font-bold text-gray-400 dark:text-[#afaebb] uppercase tracking-wide">Marco chileno</p>
                    {['Ley 21.719 privacidad', 'INAPI registro de marca', 'CMF compliance', 'Constitución SpA'].map(l => (
                      <div key={l} className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-[#34D399]/15 flex items-center justify-center shrink-0">
                          <svg className="w-2.5 h-2.5 text-[#34D399]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <span className="text-xs text-gray-600 dark:text-[#8B8AA0]">{l}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ══ PRODUCT SHOWCASE — dossier real 7 tabs ══ */}
        <ProductShowcase />

        {/* ══ BRALIDUS — motor de inteligencia ══ */}
        <BralidusEngine />

        {/* ══ STATS ══ */}
        <section className="py-16 border-y border-black/[0.05] dark:border-white/[0.06]">
          <div className="max-w-5xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
              {[
                { num: '4', label: 'Pasos guiados', sub: 'idea → reporte' },
                { num: '10', label: 'Minutos', sub: 'tiempo promedio' },
                { num: '7', label: 'Secciones', sub: 'de análisis' },
                { num: '4', label: 'Planes', sub: 'free hasta premium' },
              ].map(item => (
                <div key={item.label} className="group">
                  <p className="font-heading text-4xl sm:text-5xl font-extrabold text-gray-900 dark:text-[#F0EFF8] mb-1.5 group-hover:text-[#0EB5C6] transition-colors duration-300">{item.num}</p>
                  <p className="text-sm font-semibold text-gray-600 dark:text-[#8B8AA0]">{item.label}</p>
                  <p className="text-xs text-gray-400 dark:text-[#afaebb] mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ══ PRICING ══ */}
        <section id="pricing" className="py-14 sm:py-20 lg:py-28 border-t border-black/[0.05] dark:border-white/[0.06] bg-[#F8F7FF] dark:bg-[#0A0A0F]">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-14">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0EB5C6]/10 border border-[#0EB5C6]/20 rounded-full text-[11px] font-semibold text-[#0EB5C6] dark:text-[#38D5E3] mb-5 uppercase tracking-wider">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                SaaS freemium por tiers
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">
                Elige tu nivel de profundidad
              </h2>
              <p className="text-gray-500 dark:text-[#8B8AA0] max-w-2xl mx-auto leading-relaxed">
                No cobramos por generar texto: cobramos por la profundidad del motor de 5 dimensiones y el acceso a inteligencia de mercado. La cuota mensual escala del fundador solo al fondo de VC.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                {
                  name: 'Free', tagline: 'Para explorar el potencial.', price: '$0', period: '/mes',
                  accent: '#34D399', popular: false,
                  features: ['3 validaciones / mes', 'Score básico 5D', 'Demo Command Center', 'Captura de leads'],
                },
                {
                  name: 'Basic', tagline: 'Para validar en serie.', price: '$19', period: '/mes',
                  accent: '#38D5E3', popular: false,
                  features: ['15 validaciones / mes', 'Reportes estándar', 'Histórico de análisis', 'Score completo 5D'],
                },
                {
                  name: 'Pro', tagline: 'Para founders que deciden con datos.', price: '$49', period: '/mes',
                  accent: '#0EB5C6', popular: true,
                  features: ['50 validaciones / mes', 'RAG con datos macro CL', 'Entregables avanzados', 'Roadmap + Cap Table'],
                },
                {
                  name: 'Premium', tagline: 'Para fondos y aceleradoras.', price: '$149', period: '/mes',
                  accent: '#F7C56C', popular: false,
                  features: ['Uso ampliado · multi-proyecto', 'Acceso API (RaaS)', 'Para fondos y aceleradoras', 'Soporte prioritario'],
                },
              ].map(plan => (
                <div key={plan.name}
                  className={`relative flex flex-col p-6 rounded-3xl bg-white dark:bg-[#12121A] transition-all duration-200 overflow-hidden
                    ${plan.popular
                      ? 'border-2 border-[#0EB5C6] shadow-2xl shadow-[#0EB5C6]/12 lg:scale-[1.03] lg:-my-1'
                      : 'border border-gray-200 dark:border-white/[0.06] hover:border-gray-300 dark:hover:border-white/10'}`}>
                  {plan.popular && (
                    <>
                      <div className="absolute top-0 right-0 bg-[#0EB5C6] text-white text-[10px] font-bold px-4 py-1.5 rounded-bl-2xl tracking-wide">POPULAR</div>
                      <div className="absolute -top-10 -right-10 w-40 h-40 bg-[#0EB5C6]/10 blur-2xl rounded-full pointer-events-none" />
                    </>
                  )}
                  <div className="mb-5 relative z-10">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">{plan.name}</h3>
                    <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{plan.tagline}</p>
                  </div>
                  <div className="mb-6 relative z-10">
                    <span className="text-4xl font-extrabold text-gray-900 dark:text-[#F0EFF8] font-heading">{plan.price}</span>
                    <span className="text-sm text-gray-500 dark:text-[#8B8AA0]"> USD{plan.period}</span>
                  </div>
                  <button onClick={handleCTA}
                    className={`w-full py-3 font-semibold rounded-xl text-sm mb-6 relative z-10 cursor-pointer transition active:scale-[0.98]
                      ${plan.popular
                        ? 'bg-[#0EB5C6] text-white hover:bg-[#6B5EE6] shadow-lg shadow-[#0EB5C6]/25'
                        : 'bg-gray-100 dark:bg-[#1A1A24] text-gray-900 dark:text-[#F0EFF8] border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/[0.06]'}`}>
                    {plan.name === 'Free' ? 'Comenzar gratis' : `Elegir ${plan.name}`}
                  </button>
                  <ul className="space-y-3 flex-1 relative z-10">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600 dark:text-[#C4C4D4]">
                        <CheckIcon color={plan.accent} />{f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-gray-400 dark:text-[#afaebb] mt-8">
              Infraestructura de cobro: LemonSqueezy · Precios en USD · Todos los planes incluyen Ley 21.719 de Privacidad
            </p>
          </div>
        </section>

        {/* ══ FAQ — AEO/GEO + conversión ══ */}
        <FaqSection />

        {/* ══ DENARIUS — ecosistema ══ */}
        <DenariusPromo />

        {/* ══ SCOUTTECH — empresa matriz ══ */}
        <ScouttechSection />

        {/* ══ FINAL CTA ══ */}
        <section className="py-24 px-4 border-t border-black/[0.05] dark:border-white/[0.06] relative overflow-hidden">
          <div className="absolute inset-0 grid-pattern opacity-40" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-[#0EB5C6]/8 blur-[100px] pointer-events-none rounded-full" />
          <div className="relative max-w-2xl mx-auto text-center">
            <div className="bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/[0.06] rounded-3xl px-8 py-16 shadow-2xl dark:shadow-none">
              <span className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-[#0EB5C6]/10 border border-[#0EB5C6]/20 rounded-full text-[11px] font-semibold text-[#0EB5C6] dark:text-[#38D5E3] mb-6 uppercase tracking-wider">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                Comienza ahora · Es gratis
              </span>
              <h2 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-4">¿Tu idea tiene potencial?</h2>
              <p className="text-gray-500 dark:text-[#8B8AA0] mb-10 max-w-sm mx-auto">Descúbrelo en 10 minutos con un análisis completo impulsado por IA.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button onClick={handleGoogleLogin}
                  className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white dark:bg-[#1A1A26] text-gray-900 dark:text-[#F0EFF8] font-semibold rounded-xl border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/[0.06] active:scale-[0.98] shadow-md text-sm transition-all cursor-pointer">
                  <GoogleIcon />Validar mi idea con Google
                </button>
                <button onClick={handleCTA}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0EB5C6] text-white font-semibold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] shadow-lg shadow-[#0EB5C6]/25 text-sm transition-all cursor-pointer">
                  Entrar con email
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                </button>
              </div>
              <p className="mt-5 text-xs text-gray-400 dark:text-[#afaebb]">Sin tarjeta · Cancela cuando quieras · Soporte en español</p>
            </div>
          </div>
        </section>
      </main>

      {/* ══ FOOTER ══ */}
      <footer className="border-t border-black/[0.05] dark:border-white/[0.06] py-12 bg-[#F8F7FF] dark:bg-[#0A0A0F]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Logo className="w-5 h-7" />
                <span className="font-heading text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Validus</span>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-4 max-w-[180px]">El dossier de inversión de tu startup, antes de construirla.</p>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#34D399]/10 border border-[#34D399]/20 rounded-lg text-[10px] font-semibold text-[#34D399] mb-3">
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                Ley 21.719
              </div>
              <p className="text-[10px] text-gray-400 dark:text-[#afaebb]">
                Un producto de{' '}
                <a href="https://scouttech.lat/" target="_blank" rel="noopener noreferrer" className="font-semibold text-gray-500 dark:text-[#8B8AA0] hover:text-[#0EB5C6] transition-colors">Scouttech ↗</a>
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8] uppercase tracking-wide mb-4">Producto</p>
              <ul className="space-y-2.5">
                {[{ label: 'Cómo funciona', href: '#how' }, { label: 'Características', href: '#features' }, { label: 'Demo', href: '#demo' }, { label: 'Precios', href: '#pricing' }].map(l => (
                  <li key={l.label}><a href={l.href} className="text-xs text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">{l.label}</a></li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8] uppercase tracking-wide mb-4">Ecosistema</p>
              <ul className="space-y-2.5">
                <li>
                  <a href="https://denarius.scouttech.lat/" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-gray-500 dark:text-[#8B8AA0] hover:text-[#16A34A] transition-colors">
                    Denarius
                    <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                  </a>
                </li>
                <li><a href="#bralidus" className="text-xs text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">Motor Bralidus</a></li>
                <li><span className="text-xs text-gray-400 dark:text-[#afaebb]">API B2B (pronto)</span></li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-900 dark:text-[#F0EFF8] uppercase tracking-wide mb-4">Legal</p>
              <ul className="space-y-2.5">
                <li><span className="text-xs text-gray-500 dark:text-[#8B8AA0]">Términos de uso</span></li>
                <li><Link to="/privacy-policy" className="text-xs text-gray-500 dark:text-[#8B8AA0] hover:text-gray-900 dark:hover:text-[#F0EFF8] transition-colors">Política de privacidad</Link></li>
                <li><a href="mailto:contacto@validus.scouttech.lat" className="text-xs text-gray-500 dark:text-[#8B8AA0] hover:text-[#0EB5C6] transition-colors">Contacto</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-black/[0.05] dark:border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-400 dark:text-[#afaebb]">© {new Date().getFullYear()} Validus · Hecho en Chile, para LatAm 🌎</p>
            <p className="text-xs text-gray-400 dark:text-[#afaebb]">validus.scouttech.lat</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
