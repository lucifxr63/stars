import { CheckCircle2, XCircle, Clock, HelpCircle, AlertTriangle } from 'lucide-react';
import type { MarketSignals } from '@/types/validation';
import { EmptyStateAI } from '@/components/shared/EmptyStateAI';

export function VerdictProsCons({ summary }: { summary: any }) {
  if (!summary?.strengths?.length && !summary?.weaknesses?.length) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {summary.strengths?.length > 0 && (
        <div className="bg-emerald-50/50 dark:bg-emerald-500/5 rounded-2xl p-5 border border-emerald-100 dark:border-emerald-500/20">
          <h4 className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Motivos para Invertir
          </h4>
          <ul className="space-y-3">
            {summary.strengths.slice(0, 3).map((s: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-gray-700 dark:text-[#C4C4D4] leading-relaxed">
                <span className="text-emerald-500 shrink-0 mt-0.5">•</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {summary.weaknesses?.length > 0 && (
        <div className="bg-red-50/50 dark:bg-red-500/5 rounded-2xl p-5 border border-red-100 dark:border-red-500/20">
          <h4 className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            Banderas Rojas
          </h4>
          <ul className="space-y-3">
            {summary.weaknesses.slice(0, 3).map((w: string, i: number) => (
              <li key={i} className="flex items-start gap-2.5 text-xs text-gray-700 dark:text-[#C4C4D4] leading-relaxed">
                <span className="text-red-500 shrink-0 mt-0.5">•</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

const TIMING_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  optimal:   { label: 'Timing óptimo',           bg: 'bg-green-50 dark:bg-green-500/10',  text: 'text-green-700 dark:text-green-400', icon: Clock },
  too_early: { label: 'Muy temprano',            bg: 'bg-amber-50 dark:bg-amber-500/10',  text: 'text-amber-700 dark:text-amber-400', icon: Clock },
  late:      { label: 'Mercado tardío',          bg: 'bg-red-50 dark:bg-red-500/10',      text: 'text-red-700 dark:text-red-400',   icon: AlertTriangle },
  uncertain: { label: 'Timing incierto',         bg: 'bg-gray-50 dark:bg-white/5',        text: 'text-gray-700 dark:text-gray-300',  icon: HelpCircle },
};

export function VerdictMarketTiming({
  data,
  onGenerate,
  generating,
}: {
  data?: MarketSignals | null;
  onGenerate?: () => void;
  generating?: boolean;
}) {
  if (!data) {
    return (
      <EmptyStateAI
        title="Señal de Mercado no analizada"
        description="Genera el análisis Pro para evaluar el timing de tu entrada al mercado: tendencias, rondas recientes y momentum sectorial."
        action={onGenerate ? { label: 'Generar Análisis Pro', onClick: onGenerate, loading: generating } : undefined}
      />
    );
  }

  const timing = TIMING_CONFIG[data.timingAssessment] ?? TIMING_CONFIG.uncertain;
  const TimingIcon = timing.icon;

  return (
    <div className={`rounded-2xl p-5 border shadow-sm ${timing.bg} border-gray-100 dark:border-white/5`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className={`text-xs font-black uppercase tracking-wider mb-2 flex items-center gap-2 ${timing.text}`}>
            <TimingIcon className="w-4 h-4" />
            Señal de Mercado
          </h3>
          <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed line-clamp-3">
            {data.timingRationale || data.trendDescription}
          </p>
        </div>
        <div className={`shrink-0 text-[10px] font-bold uppercase px-2.5 py-1 rounded-lg border ${timing.text} border-current opacity-80`}>
          {timing.label}
        </div>
      </div>
    </div>
  );
}
