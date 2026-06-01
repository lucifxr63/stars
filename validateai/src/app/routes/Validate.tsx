import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier, type UserTier } from '@/hooks/useUserTier';
import { ProgressBar } from '@/components/layout/ProgressBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { StepTransition } from '@/components/wizard/StepTransition';
import { StepIdea } from '@/components/wizard/StepIdea';
import { StepIdeaQuick } from '@/components/wizard/StepIdeaQuick';
import { StepIdeaPremium } from '@/components/wizard/StepIdeaPremium';
import { StepMarket } from '@/components/wizard/StepMarket';
import { StepMarketPremium } from '@/components/wizard/StepMarketPremium';
import { StepFounder } from '@/components/wizard/StepFounder';
import { StepGenerating } from '@/components/wizard/StepGenerating';
import { StepUpload } from '@/components/wizard/StepUpload';
import { trackWizardStep, trackWizardAbandoned } from '@/hooks/useAnalytics';
import { trackTelemetryEvent, trackTelemetryBeacon } from '@/lib/telemetry';
import { OnboardingOverlay, useOnboarding } from '@/components/shared/OnboardingOverlay';

const TIER_BADGE_CONFIG: Record<'free' | 'pro' | 'premium', {
  label: string;
  includes: string;
  cls: string;
  dot: string;
  upgrade: boolean;
}> = {
  free:    { label: 'Free',    includes: 'Veredicto + Validación base',            cls: 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:border-gray-500/40',  dot: 'bg-gray-400',   upgrade: true  },
  pro:     { label: 'Pro',     includes: 'Completo · Estrategia y Finanzas',       cls: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',                      dot: 'bg-indigo-400', upgrade: false },
  premium: { label: 'Premium', includes: 'Due Diligence completo — todo incluido', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20',                      dot: 'bg-violet-400', upgrade: false },
};

function ValidationPlanBadge({ tier }: { tier: UserTier }) {
  const key = (tier === 'pro' || tier === 'premium') ? tier : 'free';
  const cfg = TIER_BADGE_CONFIG[key];
  const inner = (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-semibold transition-colors ${cfg.cls}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      <span className="opacity-75">{cfg.includes}</span>
      <span className="opacity-40 mx-0.5">·</span>
      <span>{cfg.label}</span>
      {cfg.upgrade && <span className="opacity-50 ml-0.5">↑</span>}
    </span>
  );
  if (cfg.upgrade) return <Link to="/pricing">{inner}</Link>;
  return inner;
}

// Flujo detallado (free/basic): Idea → Mercado → Fundador → Generando
const STEP_COMPONENTS_DETAILED: Record<number, React.FC> = {
  1: StepIdea,
  2: StepMarket,
  3: StepFounder,
  4: StepGenerating,
};

// Flujo premium: Upload → IdeaPremium (revisión) → MarketPremium (revisión) → Generando
const STEP_COMPONENTS_PREMIUM: Record<number, React.FC> = {
  1: StepUpload,
  2: StepIdeaPremium,
  3: StepMarketPremium,
  4: StepGenerating,
};

// Flujo rápido manual (quick): IdeaQuick → Generando
const STEP_COMPONENTS_QUICK: Record<number, React.FC> = {
  1: StepIdeaQuick,
  2: StepGenerating,
};

const STEP_TITLES_DETAILED: Record<number, { title: string; hint: string }> = {
  1: { title: 'Tu idea', hint: 'Define el problema y la solución' },
  2: { title: 'Tu mercado', hint: 'A quién le vendes y cómo llegas' },
  3: { title: 'Tú como Founder', hint: 'Tu experiencia importa' },
  4: { title: 'Analizando...', hint: 'La IA está construyendo tu validación' },
};

const STEP_TITLES_PREMIUM: Record<number, { title: string; hint: string }> = {
  1: { title: 'Sube tu documento', hint: 'La IA extrae todo de tu Pitch Deck automáticamente' },
  2: { title: 'Revisa tu idea', hint: 'Confirma o ajusta los datos extraídos por la IA' },
  3: { title: 'Revisa tu mercado', hint: 'Confirma el ICP, modelo de negocio y precio' },
  4: { title: 'Analizando...', hint: 'Generando tu análisis Premium con datos en tiempo real' },
};

const STEP_TITLES_QUICK: Record<number, { title: string; hint: string }> = {
  1: { title: 'Tu idea', hint: 'Define el problema y la solución' },
  2: { title: 'Analizando...', hint: 'La IA está construyendo tu validación' },
};

export function Validate() {
  const navigate = useNavigate();
  const { currentStep, validationId, reset, setValidationMode, validationMode,
          stepIdea, updateStepIdea, updateStepMarket, updateStepIdeaQuick, setStep } = useValidationStore();
  const { isPro: isPremium, loading: tierLoading, tier } = useUserTier();
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const exitShownRef = useRef(false);
  const mountedAtRef = useRef(Date.now());
  const [emailInput, setEmailInput] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);

  const isPremiumMode = validationMode === 'premium';
  const isQuickMode = validationMode === 'quick';
  
  const stepMap = isPremiumMode ? STEP_COMPONENTS_PREMIUM : (isQuickMode ? STEP_COMPONENTS_QUICK : STEP_COMPONENTS_DETAILED);
  const titleMap = isPremiumMode ? STEP_TITLES_PREMIUM : (isQuickMode ? STEP_TITLES_QUICK : STEP_TITLES_DETAILED);
  const StepComponent = stepMap[currentStep] ?? STEP_COMPONENTS_DETAILED[currentStep];
  const prevStep = useRef(currentStep);

  // Track step completions
  useEffect(() => {
    const lastStep = isPremiumMode ? 4 : (isQuickMode ? 2 : 4);
    if (currentStep > prevStep.current && currentStep < lastStep) {
      const name = titleMap[prevStep.current]?.title ?? `Step ${prevStep.current}`;
      trackWizardStep(prevStep.current, name, validationMode);
    }
    prevStep.current = currentStep;
  }, [currentStep, validationMode]);

  // Track abandonment on unmount before generating step
  useEffect(() => {
    return () => {
      const step = prevStep.current;
      const lastStep = isPremiumMode ? 4 : (isQuickMode ? 2 : 4);
      if (step < lastStep) {
        const name = titleMap[step]?.title ?? `Step ${step}`;
        trackWizardAbandoned(step, name);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincronizar validationMode con el tier del usuario en cada mount
  useEffect(() => {
    if (tierLoading) return;
    const targetMode = isPremium ? 'premium' : 'detailed';
    if (validationMode !== targetMode && validationMode !== 'quick') {
      setValidationMode(targetMode);
    }
  }, [tierLoading, isPremium]);

  useEffect(() => {
    if (!validationId) return;

    supabase
      .from('validations')
      .select('id, status, current_step, idea_name, idea_description, idea_industry, current_solution, quick_icp, customer_segment, target_country, target_region, business_model, pricing_range, acquisition_channel, validation_mode')
      .eq('id', validationId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { reset(); return; }

        if (data.status === 'completed') {
          navigate(`/results/${data.id}`, { replace: true });
          return;
        }

        // Rehidratar store desde DB si el store está vacío (p.ej. otro browser)
        if (!stepIdea.idea_name && data.idea_name) {
          updateStepIdea({
            idea_name:        data.idea_name ?? '',
            idea_description: data.idea_description ?? '',
            idea_industry:    data.idea_industry ?? '',
            current_solution: data.current_solution ?? '',
          });
        }
        // Rehidratar stepIdeaQuick si era un análisis rápido
        if ((data as any).validation_mode === 'quick' && (data as any).quick_icp) {
          updateStepIdeaQuick({
            idea_name:        data.idea_name ?? '',
            idea_description: data.idea_description ?? '',
            idea_industry:    data.idea_industry ?? '',
            quick_icp:        (data as any).quick_icp ?? '',
            business_model:   data.business_model ?? '',
          });
        }
        if (!useValidationStore.getState().stepMarket.target_country && data.target_country) {
          updateStepMarket({
            customer_segment:    data.customer_segment ?? '',
            target_country:      data.target_country ?? '',
            target_region:       data.target_region ?? '',
            business_model:      data.business_model ?? '',
            pricing_range:       data.pricing_range ?? '',
            acquisition_channel: data.acquisition_channel ?? '',
          });
        }
        // Posicionar en el step correcto si el store está en step 1
        if (currentStep === 1 && data.current_step > 1 && data.current_step < 4) {
          setStep(data.current_step as number);
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validationId]);
  // Exit-intent: mouseleave viewport → show 1-click dialog (once per wizard session)
  // 400 ms delay prevents accidental triggers from fast mouse movements
  useEffect(() => {
    const lastStep = isPremiumMode ? 4 : (isQuickMode ? 2 : 4);
    let leaveTimer: ReturnType<typeof setTimeout> | null = null;
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY > 0) return;
      if (currentStep >= lastStep) return;
      if (exitShownRef.current) return;
      if (Date.now() - mountedAtRef.current < 20000) return;
      leaveTimer = setTimeout(() => {
        if (exitShownRef.current) return;
        exitShownRef.current = true;
        setShowExitDialog(true);
      }, 400);
    };
    const handleMouseEnter = () => {
      if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
      if (leaveTimer) clearTimeout(leaveTimer);
    };
  }, [currentStep, isPremiumMode, isQuickMode]);

  // Rem 1: visibilitychange + pagehide replace beforeunload (BFCache-compatible, mobile-safe).
  // Shared closure flag prevents duplicate events when both fire in the same unload sequence.
  useEffect(() => {
    const beaconSent = { value: false };

    const sendAbandonBeacon = () => {
      if (beaconSent.value) return;
      const { currentStep: step } = useValidationStore.getState();
      const lastStep = isPremiumMode ? 4 : (isQuickMode ? 2 : 4);
      if (step >= lastStep) return;
      beaconSent.value = true;
      trackTelemetryBeacon('wizard_abandoned', {
        tier: (tier ?? 'free') as 'free' | 'basic' | 'pro' | 'premium',
        action_taken: 'session_ended',
        step_reached: step,
      });
    };

    const onVisibility = () => { if (document.visibilityState === 'hidden') sendAbandonBeacon(); };
    const onPageHide = () => sendAbandonBeacon();

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremiumMode, isQuickMode, tier]);

  // Rem 3a: mobile exit-intent — scroll reversal velocity heuristic.
  // Triggers when user scrolled ≥ 300 px down then inverts fast (≥ 3.0 px/ms upward).
  useEffect(() => {
    let lastY = window.scrollY;
    let lastT = Date.now();
    let maxDepth = 0;
    const MIN_DEPTH = 300;
    const MIN_VELOCITY = 3.0; // px/ms

    const onScroll = () => {
      const now = Date.now();
      const y = window.scrollY;
      const dt = now - lastT;
      maxDepth = Math.max(maxDepth, y);

      if (dt > 0) {
        const velocity = (y - lastY) / dt;   // negative = scrolling up
        const lastStep = isPremiumMode ? 4 : (isQuickMode ? 2 : 4);
        const { currentStep: step } = useValidationStore.getState();
        if (
          velocity < -MIN_VELOCITY &&
          maxDepth > MIN_DEPTH &&
          step < lastStep &&
          !exitShownRef.current &&
          Date.now() - mountedAtRef.current >= 20000
        ) {
          exitShownRef.current = true;
          setShowExitDialog(true);
        }
      }

      lastY = y;
      lastT = now;
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isPremiumMode, isQuickMode]);

  // Rem 3b: mobile exit-intent — back-button intercept via history.pushState + popstate.
  // Injects a silent guard entry; popstate fires when the user navigates back through it.
  useEffect(() => {
    window.history.pushState({ validateai_guard: true }, '');

    const onPopState = () => {
      const { currentStep: step } = useValidationStore.getState();
      const lastStep = isPremiumMode ? 4 : (isQuickMode ? 2 : 4);
      if (step >= lastStep) return;

      // Re-inject guard so repeated back-button presses are caught
      window.history.pushState({ validateai_guard: true }, '');

      if (!exitShownRef.current && Date.now() - mountedAtRef.current >= 20000) {
        exitShownRef.current = true;
        setShowExitDialog(true);
      }
      trackTelemetryEvent({
        event_name: 'wizard_abandoned',
        context: {
          tier: (tier ?? 'free') as 'free' | 'basic' | 'pro' | 'premium',
          action_taken: 'back_button_intercepted',
          step_reached: step,
        },
      });
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremiumMode, isQuickMode, tier]);

  const handleExitChoice = (reason: string) => {
    setShowExitDialog(false);
    trackTelemetryEvent({
      event_name: 'wizard_abandoned',
      context: {
        tier: (tier ?? 'free') as 'free' | 'basic' | 'pro' | 'premium',
        action_taken: reason,
        step_reached: currentStep,
      },
    });
  };

  const handleEmailLead = async () => {
    const email = emailInput.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    setEmailLoading(true);
    try {
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-quick-lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, validation_id: validationId ?? undefined }),
      });
    } catch {
      // Silent fail — UX siempre muestra confirmación
    } finally {
      setEmailSent(true);
      setEmailLoading(false);
      trackTelemetryEvent({
        event_name: 'wizard_abandoned',
        context: {
          tier: (tier ?? 'free') as 'free' | 'basic' | 'pro' | 'premium',
          action_taken: 'email_lead_captured',
          step_reached: currentStep,
        },
      });
    }
  };

  const meta = titleMap[currentStep];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">
      {showOnboarding && <OnboardingOverlay onDone={dismissOnboarding} />}
      <Header />

      {/* Sticky progress bar — solo mobile. En desktop queda relativa dentro del content. */}
      <div className="sm:hidden sticky top-0 z-30 bg-gray-50/95 dark:bg-[#0A0A0F]/95 backdrop-blur-sm border-b border-gray-200/50 dark:border-white/5 px-4 py-2.5">
        <ProgressBar current={currentStep} mode={validationMode} />
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 md:py-10">
        {/* Progress desktop (oculto en mobile — ya está sticky arriba) */}
        <div className="hidden sm:block mb-8">
          <ProgressBar current={currentStep} mode={validationMode} />
        </div>

        {/* Step header */}
        {((isPremiumMode && currentStep < 4) || (isQuickMode && currentStep < 2) || (!isPremiumMode && !isQuickMode && currentStep < 4)) && (
          <div className="mb-5 px-1">
            <div className="flex items-center justify-between mb-1">
              {!isPremiumMode && (
                <p className="text-xs font-bold text-[#7C6FF7] uppercase tracking-widest">
                  Paso {currentStep} de {isQuickMode ? 1 : 3}
                </p>
              )}
              {isPremiumMode && (
                <p className="text-xs font-bold text-[#7C6FF7] uppercase tracking-widest">
                  ✦ Validación Premium · Paso {currentStep} de 3
                </p>
              )}
              {!tierLoading && <ValidationPlanBadge tier={tier} />}
            </div>
            <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-[#F0EFF8]">{meta?.title}</h1>
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mt-0.5">{meta?.hint}</p>
          </div>
        )}

        {/* Card */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-white/[0.06] p-6 md:p-10 overflow-hidden">
          <StepTransition stepKey={currentStep}>
            <StepComponent />
          </StepTransition>
        </div>
      </div>

      <Footer />

      {/* Exit-intent dialog — quick mode: captura email / detailed: opciones clásicas */}
      {showExitDialog && (
        <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4 pointer-events-none">
          {validationMode === 'quick' ? (
            // ── Dialog de captura de email (flujo rápido) ──────────────────────
            <div className="bg-white dark:bg-[#12121A] rounded-2xl shadow-2xl border border-[#7C6FF7]/30 p-5 max-w-sm w-full pointer-events-auto">
              {emailSent ? (
                <div className="text-center py-2">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-3">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">¡Listo! Revisa tu correo.</p>
                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-3">Te enviaremos tu Score Rápido en segundos.</p>
                  <button
                    onClick={() => setShowExitDialog(false)}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-[#7C6FF7]/10 flex items-center justify-center shrink-0">
                        <svg className="w-4 h-4 text-[#7C6FF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">No pierdas tu análisis</p>
                    </div>
                    <button
                      onClick={() => handleExitChoice('cerró sin captura email')}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mb-3 leading-relaxed">
                    Déjanos tu email y te enviamos tu Score Rápido para que lo revises luego.
                  </p>

                  <div className="space-y-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleEmailLead()}
                      placeholder="tu@email.com"
                      autoFocus
                      className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 text-gray-900 dark:text-[#F0EFF8] placeholder:text-gray-400 focus:outline-none focus:border-[#7C6FF7] focus:ring-2 focus:ring-[#7C6FF7]/20 transition-all"
                    />
                    <button
                      onClick={handleEmailLead}
                      disabled={emailLoading || !emailInput.includes('@')}
                      className="w-full py-2.5 bg-[#7C6FF7] hover:bg-[#6B5EE6] disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      {emailLoading ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>Enviar mi análisis →</>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            // ── Dialog clásico (flujo detallado / premium) ─────────────────────
            <div className="bg-white dark:bg-[#12121A] rounded-2xl shadow-2xl border border-gray-200 dark:border-white/10 p-4 max-w-sm w-full pointer-events-auto">
              <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] mb-3">
                Guardamos tu progreso. ¿Te faltó información para continuar?
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleExitChoice('Faltó información para continuar')}
                  className="flex-1 px-3 py-2 text-xs font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors"
                >
                  Sí, me faltan datos
                </button>
                <button
                  onClick={() => handleExitChoice('Solo estaba explorando')}
                  className="flex-1 px-3 py-2 text-xs font-bold bg-gray-50 dark:bg-white/5 text-gray-600 dark:text-[#8B8AA0] border border-gray-200 dark:border-white/10 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                >
                  Solo estaba explorando
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
