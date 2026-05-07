import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier } from '@/hooks/useUserTier';
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
import { OnboardingOverlay, useOnboarding } from '@/components/shared/OnboardingOverlay';

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
  const { currentStep, validationId, reset, setValidationMode, validationMode } = useValidationStore();
  const { isPro: isPremium, loading: tierLoading } = useUserTier();
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();

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
    if (!validationId) {
      // Sin ID persistido — flujo limpio, no hacer nada
      return;
    }
    supabase
      .from('validations')
      .select('id, status')
      .eq('id', validationId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          // El row no existe (borrado o ID corrupto) — resetear store
          reset();
          return;
        }
        if (data.status === 'completed') {
          // Ya está completa, ir directo al resultado sin gastar tokens
          navigate(`/results/${data.id}`, { replace: true });
        }
      });
  }, [validationId]);
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
            {!isPremiumMode && (
              <p className="text-xs font-bold text-[#7C6FF7] uppercase tracking-widest mb-1">
                Paso {currentStep} de {isQuickMode ? 1 : 3}
              </p>
            )}
            {isPremiumMode && (
              <p className="text-xs font-bold text-[#7C6FF7] uppercase tracking-widest mb-1">
                ✦ Validación Premium · Paso {currentStep} de 2
              </p>
            )}
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
    </div>
  );
}
