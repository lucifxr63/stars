import { CheckCircle2, XCircle, UserCheck, Clock, HelpCircle, AlertTriangle } from 'lucide-react';
import type { FounderFit, MarketSignals } from '@/types/validation';

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

const fitLabel = (v: number) => (v >= 70 ? 'Alto' : v >= 40 ? 'Medio' : 'Bajo');
const scoreColor = (v: number) =>
  v >= 70 ? 'bg-emerald-500' : v >= 40 ? 'bg-amber-500' : 'bg-red-500';
const textColor = (v: number) =>
  v >= 70 ? 'text-emerald-600 dark:text-emerald-400' : v >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';

export function VerdictFounderFit({ data }: { data: FounderFit }) {
  if (!data) return null;

  const dims = [
    { label: 'Problema', val: data.dimensions.problemKnowledge },
    { label: 'Industria', val: data.dimensions.industryExperience },
    { label: 'Técnica', val: data.dimensions.technicalCapability },
    { label: 'Contactos', val: data.dimensions.networkStrength },
    { label: 'Track Record', val: data.dimensions.trackRecord },
  ];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-gray-100 dark:border-white/5 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <UserCheck className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Founder Fit</h3>
        </div>
        <div className={`text-xs font-black uppercase tracking-wider ${textColor(data.score)} bg-gray-50 dark:bg-white/5 px-2 py-1 rounded-md border border-gray-100 dark:border-white/10`}>
          {fitLabel(data.score)} ({data.score})
        </div>
      </div>
      
      <div className="space-y-2.5">
        {dims.map((d) => (
          <div key={d.label} className="flex items-center gap-3">
            <span className="text-[10px] text-gray-500 dark:text-[#8B8AA0] font-bold uppercase tracking-wider w-24 truncate">{d.label}</span>
            <div className="flex-1 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${scoreColor(d.val)}`} 
                style={{ width: `${d.val}%` }} 
              />
            </div>
            <span className="text-[10px] font-black text-gray-400 w-6 text-right">{d.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const TIMING_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  optimal:   { label: 'Timing óptimo',           bg: 'bg-green-50 dark:bg-green-500/10',  text: 'text-green-700 dark:text-green-400', icon: Clock },
  too_early: { label: 'Muy temprano',            bg: 'bg-amber-50 dark:bg-amber-500/10',  text: 'text-amber-700 dark:text-amber-400', icon: Clock },
  late:      { label: 'Mercado tardío',          bg: 'bg-red-50 dark:bg-red-500/10',      text: 'text-red-700 dark:text-red-400',   icon: AlertTriangle },
  uncertain: { label: 'Timing incierto',         bg: 'bg-gray-50 dark:bg-white/5',        text: 'text-gray-700 dark:text-gray-300',  icon: HelpCircle },
};

export function VerdictMarketTiming({ data }: { data: MarketSignals }) {
  if (!data) return null;

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
