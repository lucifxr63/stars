import { STEPS } from '@/utils/constants';

export function ProgressBar({ current }: { current: number }) {
  const pct = Math.round((current / STEPS.length) * 100);

  return (
    <div className="w-full max-w-3xl mx-auto">
      {/* Mobile */}
      <div className="sm:hidden">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center">
              {current}
            </div>
            <span className="text-sm font-semibold text-gray-900">
              {STEPS[current - 1]?.label}
            </span>
          </div>
          <span className="text-xs font-medium text-gray-400">
            {current} de {STEPS.length}
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex items-center">
        {STEPS.map((step, i) => (
          <div key={step.num} className="flex items-center flex-1 last:flex-none">
            {/* Step */}
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                transition-all duration-300
                ${current > step.num
                  ? 'bg-teal-500 text-white shadow-md shadow-teal-500/30'
                  : current === step.num
                  ? 'bg-teal-500 text-white ring-4 ring-teal-100 shadow-md shadow-teal-500/30'
                  : 'bg-gray-100 text-gray-400'}
              `}>
                {current > step.num ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : step.num}
              </div>
              <span className={`text-xs font-medium whitespace-nowrap transition-colors ${
                current >= step.num ? 'text-teal-600' : 'text-gray-400'
              }`}>
                {step.label}
              </span>
            </div>

            {/* Connector */}
            {i < STEPS.length - 1 && (
              <div className="flex-1 mx-2 mb-5">
                <div className="h-0.5 w-full rounded-full overflow-hidden bg-gray-200">
                  <div className={`h-full rounded-full transition-all duration-500 ${
                    current > step.num ? 'bg-teal-400 w-full' : 'w-0'
                  }`} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
