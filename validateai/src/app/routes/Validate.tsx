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
  1: { title: 'Tu idea', hint: 'Define el problema y solución' },
  2: { title: 'Tu mercado', hint: 'A quién le vendes y cómo' },
  3: { title: 'Tú como Founder', hint: 'Tu experiencia importa' },
  4: { title: 'Analizando', hint: 'Construyendo validación...' },
};

export function Validate() {
  const { currentStep } = useValidationStore();
  const StepComponent = STEP_COMPONENTS[currentStep];
  const meta = STEP_TITLES[currentStep];
  const totalSteps = 4;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 md:py-10">
        <div className="mb-6">
          <ProgressBar current={currentStep} />
        </div>

        {currentStep < 4 && (
          <div className="mb-4 px-1">
            <p className="text-xs font-bold text-indigo-600 uppercase tracking-widest mb-0.5">
              Paso {currentStep} de 3
            </p>
            <h1 className="text-xl font-black text-gray-900">{meta?.title}</h1>
            <p className="text-sm text-gray-400 mt-0.5">{meta?.hint}</p>
          </div>
        )}

        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-10 overflow-hidden">
          <StepTransition stepKey={currentStep}>
            <StepComponent />
          </StepTransition>
        </div>
      </div>

      <Footer />
    </div>
  );
}
