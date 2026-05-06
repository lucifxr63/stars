import { useEffect, useState } from 'react';

interface Props {
  cards: string[];
  /** Cadencia mínima por tarjeta en ms. Genera la "ilusión del esfuerzo" incluso si la API resuelve antes. */
  cadenceMs?: number;
  onComplete: () => void;
}

/**
 * Muestra tarjetas de tarea de forma coreografiada.
 * Garantiza una cadencia mínima por tarjeta para que el usuario perciba
 * trabajo real aunque la API haya resuelto instantáneamente.
 */
export function TaskCardStream({ cards, cadenceMs = 900, onComplete }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [doneIndex, setDoneIndex]       = useState<number | null>(null);

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    cards.forEach((_, i) => {
      // Each card appears after i * cadenceMs
      timers.push(
        setTimeout(() => {
          setVisibleCount(i + 1);
          // Mark previous card as "done" once the next one appears
          if (i > 0) setDoneIndex(i - 1);
        }, i * cadenceMs),
      );
    });

    // After all cards: mark last card done, then fire onComplete
    const totalDuration = cards.length * cadenceMs;
    timers.push(setTimeout(() => setDoneIndex(cards.length - 1), totalDuration));
    timers.push(setTimeout(onComplete, totalDuration + cadenceMs));

    return () => timers.forEach(clearTimeout);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-2.5">
      {cards.slice(0, visibleCount).map((card, i) => {
        const isDone    = doneIndex !== null && i <= doneIndex;
        const isActive  = i === visibleCount - 1 && !isDone;

        return (
          <div
            key={i}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 transition-all duration-400
              ${isDone
                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30'
                : isActive
                ? 'bg-[#7C6FF7]/5 border-[#7C6FF7]/30 dark:bg-[#7C6FF7]/8 dark:border-[#7C6FF7]/25'
                : 'bg-white dark:bg-[#12121A] border-gray-100 dark:border-white/5'
              }`}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {/* Status icon */}
            <div className="shrink-0">
              {isDone ? (
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-800/30 flex items-center justify-center">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              ) : isActive ? (
                <div className="w-7 h-7 rounded-lg bg-[#7C6FF7]/15 flex items-center justify-center">
                  <div className="w-3.5 h-3.5 border-2 border-[#7C6FF7]/30 border-t-[#7C6FF7] rounded-full animate-spin" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-white/20" />
                </div>
              )}
            </div>

            {/* Label */}
            <p className={`text-sm font-medium leading-tight flex-1 ${
              isDone
                ? 'text-emerald-700 dark:text-emerald-400'
                : isActive
                ? 'text-[#7C6FF7] dark:text-[#A78BFA]'
                : 'text-gray-400 dark:text-[#4A495E]'
            }`}>
              {card}
            </p>

            {/* Badge */}
            <span className={`shrink-0 text-xs font-bold ${
              isDone    ? 'text-emerald-600 dark:text-emerald-400' :
              isActive  ? 'text-[#7C6FF7] dark:text-[#A78BFA] animate-pulse' :
              'text-gray-300 dark:text-[#4A495E]'
            }`}>
              {isDone ? 'Listo' : isActive ? 'Procesando...' : 'En espera'}
            </span>
          </div>
        );
      })}
    </div>
  );
}
