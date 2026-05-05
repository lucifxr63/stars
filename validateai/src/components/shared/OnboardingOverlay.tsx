import { useEffect, useState } from 'react';

const STORAGE_KEY = 'validateai_onboarded';

const STEPS = [
  {
    icon: '💡',
    title: 'Describe tu idea',
    body: 'Cuéntanos el problema que resuelves, tu solución y en qué industria estás. Sin plantillas — en tus propias palabras.',
  },
  {
    icon: '📊',
    title: 'Define tu mercado',
    body: 'Identifica a quién le vendes, cuánto pagarían y cómo llegas a tus primeros clientes.',
  },
  {
    icon: '🤖',
    title: 'Obtén tu reporte',
    body: 'La IA analiza viabilidad, mercado, competencia, riesgos y economía unitaria — todo en 10 minutos.',
  },
] as const;

interface Props {
  onDone: () => void;
}

export function OnboardingOverlay({ onDone }: Props) {
  const [step, setStep] = useState(0);

  const advance = () => {
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      localStorage.setItem(STORAGE_KEY, '1');
      onDone();
    }
  };

  const current = STEPS[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-white dark:bg-[#12121A] rounded-2xl border border-white/[0.06] shadow-2xl overflow-hidden">

        {/* Progress dots */}
        <div className="flex gap-1.5 justify-center pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-[#7C6FF7]' : i < step ? 'w-1.5 bg-[#7C6FF7]/40' : 'w-1.5 bg-gray-200 dark:bg-white/10'
              }`}
            />
          ))}
        </div>

        <div className="p-7 text-center">
          <div className="text-5xl mb-5">{current.icon}</div>
          <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">
            {current.title}
          </h2>
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed mb-8">
            {current.body}
          </p>

          <button
            onClick={advance}
            className="w-full py-3 bg-[#7C6FF7] text-white font-semibold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] transition-all shadow-lg shadow-[#7C6FF7]/25 text-sm"
          >
            {step < STEPS.length - 1 ? 'Siguiente →' : 'Empezar →'}
          </button>

          <button
            onClick={() => { localStorage.setItem(STORAGE_KEY, '1'); onDone(); }}
            className="mt-3 text-xs text-gray-400 hover:text-gray-500 transition-colors"
          >
            Saltar intro
          </button>
        </div>
      </div>
    </div>
  );
}

export function useOnboarding() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) setShow(true);
  }, []);

  return { show, dismiss: () => setShow(false) };
}
