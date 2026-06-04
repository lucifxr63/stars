import { useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useConsentGuard } from '@/hooks/useConsentGuard';
import { ConsentModal } from '@/components/shared/ConsentModal';
import { Sidebar } from '@/components/layout/Sidebar';
import { UpgradeModal } from '@/components/shared/UpgradeModal';
import { getPreviewTier, setPreviewTier, type UserTier } from '@/hooks/useUserTier';
import { setSentryUser, clearSentryUser } from '@/lib/sentry';
import type { User } from '@supabase/supabase-js';

const PREVIEW_COLORS: Record<UserTier, string> = {
  free:    'bg-gray-800 text-gray-200 border-gray-600',
  basic:   'bg-sky-900 text-sky-200 border-sky-600',
  pro:     'bg-indigo-900 text-indigo-200 border-indigo-600',
  premium: 'bg-violet-900 text-violet-200 border-violet-600',
};

export function ProtectedLayout() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const consentStatus = useConsentGuard(user?.id);
  const [consentAccepted, setConsentAccepted] = useState(false);
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (!u) clearSentryUser();
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('onboarding_completed, tier')
      .eq('id', user.id)
      .single()
      .then(({ data, error }) => {
        setOnboardingDone(error ? true : (data?.onboarding_completed ?? true));
        // Setear contexto Sentry con ID anónimo + tier (sin PII)
        setSentryUser(user.id, data?.tier ?? 'free');
      });
  }, [user]);

  const handleConsentAccepted = useCallback(() => setConsentAccepted(true), []);

  // Wait for both auth + onboarding status before rendering
  if (user === undefined || (user !== null && onboardingDone === null)) return null;
  if (!user) return <Navigate to="/login" replace />;

  // Redirect new users to onboarding (skip if already there)
  if (onboardingDone === false && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  const needsConsent = consentStatus === 'required' && !consentAccepted;

  return (
    <>
      {needsConsent && (
        <ConsentModal userId={user.id} onAccepted={handleConsentAccepted} />
      )}
      <Outlet />
    </>
  );
}

// ─── AppLayout: sidebar persistente para las rutas de la app ──────────────────

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [previewTier, setPreviewTierState] = useState<UserTier | null>(() => getPreviewTier());
  const location = useLocation();

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const onPreview = (e: Event) => {
      setPreviewTierState((e as CustomEvent<UserTier | null>).detail);
    };
    window.addEventListener('validateai:tier-preview', onPreview);
    return () => window.removeEventListener('validateai:tier-preview', onPreview);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-[#0A0A0F]">

      {/* Sidebar fijo (desktop) */}
      <aside className="hidden lg:flex w-60 flex-col fixed inset-y-0 z-30 border-r border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#12121A]">
        <Sidebar />
      </aside>

      {/* Drawer (mobile) */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-60 max-w-[75vw] flex flex-col bg-white dark:bg-[#12121A] shadow-2xl z-10">
            <Sidebar onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Área de contenido */}
      <div className="flex flex-col flex-1 lg:pl-60 overflow-y-auto">

        {/* Banner tier preview (admin) */}
        {previewTier && (
          <div className={`flex items-center justify-between px-4 py-1.5 text-xs font-bold border-b ${PREVIEW_COLORS[previewTier]}`}>
            <span>Modo preview: vista como usuario <span className="uppercase">{previewTier}</span></span>
            <button
              onClick={() => { setPreviewTier(null); setPreviewTierState(null); }}
              className="ml-4 underline opacity-80 hover:opacity-100"
            >
              Salir del preview
            </button>
          </div>
        )}

        {/* Top bar mobile — oculto en el wizard porque Validate tiene su propio Header */}
        <header className={`lg:hidden sticky top-0 z-20 flex items-center h-14 px-4 gap-3 border-b border-gray-100 dark:border-white/[0.06] bg-white dark:bg-[#12121A] shrink-0 ${location.pathname === '/validate' ? 'hidden' : ''}`}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-500 dark:text-[#8B8AA0] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
            aria-label="Abrir menú"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <div className="flex-1 flex justify-center">
            <div className="flex items-center gap-2">
              <svg viewBox="0 0 500 500" className="w-6 h-6" aria-hidden="true">
                <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white"/>
                <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6"/>
                <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6"/>
              </svg>
              <span className="font-heading text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">Validus</span>
            </div>
          </div>

          {/* spacer para centrar logo */}
          <div className="w-9" />
        </header>

        <main className="flex-1">
          <Outlet />
        </main>

        <footer className="border-t border-gray-100 dark:border-white/[0.06] py-4 shrink-0">
          <p className="text-center text-xs text-gray-400 dark:text-[#4A495E]">
            © {new Date().getFullYear()} Validus
          </p>
        </footer>
      </div>

      {/* Modal global de upgrade — se activa via evento validateai:paywall-hit desde useAI */}
      <UpgradeModal />
    </div>
  );
}
