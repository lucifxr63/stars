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
import { StepMarket } from '@/components/wizard/StepMarket';
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

// Flujo premium (premium): Upload → Idea → Generando
const STEP_COMPONENTS_PREMIUM: Record<number, React.FC> = {
  1: StepUpload,
  2: StepIdea,
  3: StepGenerating,
};

// Flujo rápido manual (quick): Idea → Generando
const STEP_COMPONENTS_QUICK: Record<number, React.FC> = {
  1: StepIdea,
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
  2: { title: 'Tu idea', hint: 'Confirma o completa los datos extraídos' },
  3: { title: 'Analizando...', hint: 'Generando tu Due Diligence Score' },
};

const STEP_TITLES_QUICK: Record<number, { title: string; hint: string }> = {
  1: { title: 'Tu idea', hint: 'Define el problema y la solución' },
  2: { title: 'Analizando...', hint: 'La IA está construyendo tu validación' },
};

export function Validate() {
  const navigate = useNavigate();
  const { currentStep, validationId, reset, setValidationMode, validationMode,
          stepIdea, updateStepIdea, updateStepMarket, setStep } = useValidationStore();
  const { isPro: isPremium, loading: tierLoading, tier } = useUserTier();
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();
  const [showExitDialog, setShowExitDialog] = useState(false);
  const exitShownRef = useRef(false);

  const isPremiumMode = validationMode === 'premium';
  const isQuickMode = validationMode === 'quick';
  
  const stepMap = isPremiumMode ? STEP_COMPONENTS_PREMIUM : (isQuickMode ? STEP_COMPONENTS_QUICK : STEP_COMPONENTS_DETAILED);
  const titleMap = isPremiumMode ? STEP_TITLES_PREMIUM : (isQuickMode ? STEP_TITLES_QUICK : STEP_TITLES_DETAILED);
  const StepComponent = stepMap[currentStep] ?? STEP_COMPONENTS_DETAILED[currentStep];
  const prevStep = useRef(currentStep);

  // Track step completions
  useEffect(() => {
    const lastStep = isPremiumMode ? 3 : (isQuickMode ? 2 : 4);
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
      const lastStep = isPremiumMode ? 3 : (isQuickMode ? 2 : 4);
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
      .select('id, status, current_step, idea_name, idea_description, idea_industry, current_solution, customer_segment, target_country, target_region, business_model, pricing_range, acquisition_channel')
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
  useEffect(() => {
    const lastStep = isPremiumMode ? 3 : (isQuickMode ? 2 : 4);
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY > 0) return;
      if (currentStep >= lastStep) return;
      if (exitShownRef.current) return;
      exitShownRef.current = true;
      setShowExitDialog(true);
    };
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => document.removeEventListener('mouseleave', handleMouseLeave);
  }, [currentStep, isPremiumMode, isQuickMode]);

  // Rem 1: visibilitychange + pagehide replace beforeunload (BFCache-compatible, mobile-safe).
  // Shared closure flag prevents duplicate events when both fire in the same unload sequence.
  useEffect(() => {
    const beaconSent = { value: false };

    const sendAbandonBeacon = () => {
      if (beaconSent.value) return;
      const { currentStep: step } = useValidationStore.getState();
      const lastStep = isPremiumMode ? 3 : (isQuickMode ? 2 : 4);
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
  // Triggers when user scrolled ≥ 80 px down then inverts fast (≥ 1.5 px/ms upward).
  useEffect(() => {
    let lastY = window.scrollY;
    let lastT = Date.now();
    let maxDepth = 0;
    const MIN_DEPTH = 80;
    const MIN_VELOCITY = 1.5; // px/ms

    const onScroll = () => {
      const now = Date.now();
      const y = window.scrollY;
      const dt = now - lastT;
      maxDepth = Math.max(maxDepth, y);

      if (dt > 0) {
        const velocity = (y - lastY) / dt;   // negative = scrolling up
        const lastStep = isPremiumMode ? 3 : (isQuickMode ? 2 : 4);
        const { currentStep: step } = useValidationStore.getState();
        if (
          velocity < -MIN_VELOCITY &&
          maxDepth > MIN_DEPTH &&
          step < lastStep &&
          !exitShownRef.current
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
      const lastStep = isPremiumMode ? 3 : (isQuickMode ? 2 : 4);
      if (step >= lastStep) return;

      // Re-inject guard so repeated back-button presses are caught
      window.history.pushState({ validateai_guard: true }, '');

      if (!exitShownRef.current) {
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

  const meta = titleMap[currentStep];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">
      {showOnboarding && <OnboardingOverlay onDone={dismissOnboarding} />}
      <Header />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 md:py-10">
        {/* Progress */}
        <div className="mb-8">
          <ProgressBar current={currentStep} mode={validationMode} />
        </div>

        {/* Step header */}
        {((isPremiumMode && currentStep < 3) || (isQuickMode && currentStep < 2) || (!isPremiumMode && !isQuickMode && currentStep < 4)) && (
          <div className="mb-5 px-1">
            <div className="flex items-center justify-between mb-1">
              {!isPremiumMode && (
                <p className="text-xs font-bold text-[#7C6FF7] uppercase tracking-widest">
                  Paso {currentStep} de {isQuickMode ? 1 : 3}
                </p>
              )}
              {isPremiumMode && (
                <p className="text-xs font-bold text-[#7C6FF7] uppercase tracking-widest">
                  ✦ Validación Premium · Paso {currentStep} de 2
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

      {/* Exit-intent dialog */}
      {showExitDialog && (
        <div className="fixed inset-x-0 top-3 z-50 flex justify-center px-4 pointer-events-none">
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
        </div>
      )}
    </div>
  );
}
