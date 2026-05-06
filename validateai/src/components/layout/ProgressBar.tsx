import { STEPS } from '@/utils/constants';

const STEPS_PREMIUM = [
  { num: 1, label: 'Documento' },
  { num: 2, label: 'Tu idea' },
  { num: 3, label: 'Analizando' },
] as const;

export function ProgressBar({ current, mode = 'detailed' }: { current: number; mode?: 'quick' | 'detailed' }) {
  const steps = mode === 'quick' ? STEPS_PREMIUM : STEPS;
  // Para modo quick: step 1→1, step 2→2, step 3→3
  const displayCurrent = mode === 'quick' ? Math.min(current, 3) : current;
  const pct = Math.round((displayCurrent / steps.length) * 100);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Mobile — barra simple */}
      <div className="sm:hidden flex items-center gap-3 mb-1">
        <div className="flex-1 h-0.5 bg-white dark:bg-[#12121A]/8 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7C6FF7] rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-500 dark:text-[#8B8AA0] shrink-0 tabular-nums">
          {displayCurrent}/{steps.length}
        </span>
      </div>

      {/* Desktop — dots + línea */}
      <div className="hidden sm:flex items-center">
        {steps.map((step, i) => {
          const isCompleted = displayCurrent > (i + 1);
          const isActive    = displayCurrent === (i + 1);
          return (
          <div key={step.num} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
                transition-all duration-300
                ${isCompleted
                  ? 'bg-[#7C6FF7] text-white'
                  : isActive
                  ? 'bg-[#7C6FF7] text-white ring-4 ring-[#7C6FF7]/20'
                  : 'bg-gray-100 dark:bg-white/5 text-[#4A495E] border border-gray-200 dark:border-white/8'}
              `}>
                {isCompleted ? (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (i + 1)}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap transition-colors ${
                displayCurrent >= (i + 1) ? 'text-gray-900 dark:text-[#F0EFF8]' : 'text-[#4A495E]'
              }`}>
                {step.label}
              </span>
            </div>

            {i < steps.length - 1 && (
              <div className="flex-1 mx-2 mb-5">
                <div className="h-px w-full bg-white dark:bg-[#12121A]/8 overflow-hidden rounded-full">
                  <div className={`h-full transition-all duration-500 bg-[#7C6FF7] ${
                    isCompleted ? 'w-full' : 'w-0'
                  }`} />
                </div>
              </div>
            )}
          </div>
          );
        })}
      </div>
    </div>
  );
}
