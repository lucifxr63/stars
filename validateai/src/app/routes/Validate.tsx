import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useValidationStore } from '@/stores/validationStore';
import { ProgressBar } from '@/components/layout/ProgressBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { StepTransition } from '@/components/wizard/StepTransition';
import { StepIdea } from '@/components/wizard/StepIdea';
import { StepMarket } from '@/components/wizard/StepMarket';
import { StepFounder } from '@/components/wizard/StepFounder';
import { StepGenerating } from '@/components/wizard/StepGenerating';

const STEP_COMPONENTS: Record<number, React.FC> = {
  1: StepIdea,
  2: StepMarket,
  3: StepFounder,
  4: StepGenerating,
};

const STEP_TITLES: Record<number, { title: string; hint: string }> = {
  1: { title: 'Tu idea', hint: 'Define el problema y la solución' },
  2: { title: 'Tu mercado', hint: 'A quién le vendes y cómo llegas' },
  3: { title: 'Tú como Founder', hint: 'Tu experiencia importa' },
  4: { title: 'Analizando...', hint: 'La IA está construyendo tu validación' },
};

export function Validate() {
  const navigate = useNavigate();
  const { currentStep, validationId, reset } = useValidationStore();
  const StepComponent = STEP_COMPONENTS[currentStep];

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
  const meta = STEP_TITLES[currentStep];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">
      <Header />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 md:py-10">
        {/* Progress */}
        <div className="mb-8">
          <ProgressBar current={currentStep} />
        </div>

        {/* Step header */}
        {currentStep < 4 && (
          <div className="mb-5 px-1">
            <p className="text-xs font-bold text-[#7C6FF7] uppercase tracking-widest mb-1">
              Paso {currentStep} de 3
            </p>
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
