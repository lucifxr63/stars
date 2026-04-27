interface NextStepsTimelineProps {
  steps: string[];
}

export function NextStepsTimeline({ steps }: NextStepsTimelineProps) {
  if (!steps || steps.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gradient-to-b dark:from-[#1A1A24] dark:to-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-6 shadow-sm">
      <h3 className="text-sm font-black text-gray-900 dark:text-[#F0EFF8] mb-6 uppercase tracking-wide">Plan de Acción Sugerido</h3>
      <div className="space-y-6 relative before:absolute before:inset-0 before:ml-3.5 before:-translate-x-px md:before:ml-[15px] before:h-full before:w-0.5 before:bg-gradient-to-b before:from-teal-500 before:to-blue-500">
        {steps.map((step, i) => (
          <div key={i} className="relative flex items-start gap-4 group">
            <div className="w-7 h-7 rounded-full bg-white dark:bg-[#12121A] border-2 border-teal-500 flex items-center justify-center text-[10px] font-black text-teal-600 dark:text-teal-400 shrink-0 z-10 shadow-sm transition-all group-hover:scale-110 group-hover:bg-teal-50 dark:group-hover:bg-teal-500/10">
              {i + 1}
            </div>
            <div className="flex-1 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5 p-4 shadow-sm transition-all group-hover:border-teal-200 dark:group-hover:border-teal-500/30 group-hover:bg-white dark:group-hover:bg-white/10">
              <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{step}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
