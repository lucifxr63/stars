import { TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, HelpCircle, Newspaper, DollarSign, Activity } from 'lucide-react';
import type { MarketSignals } from '@/types/validation';

interface Props {
  data: MarketSignals;
}

const TREND_CONFIG: Record<string, { label: string; badge: string; text: string; icon: any; glow: string }> = {
  growing:  { label: 'Creciendo',  badge: 'bg-green-100 dark:bg-green-500/20',  text: 'text-green-700 dark:text-green-400',  icon: TrendingUp, glow: 'bg-green-400/20 dark:bg-green-500/10' },
  stable:   { label: 'Estable',    badge: 'bg-amber-100 dark:bg-amber-500/20',  text: 'text-amber-700 dark:text-amber-400',  icon: Minus, glow: 'bg-amber-400/20 dark:bg-amber-500/10' },
  declining:{ label: 'En declive', badge: 'bg-red-100 dark:bg-red-500/20',    text: 'text-red-700 dark:text-red-400',    icon: TrendingDown, glow: 'bg-red-400/20 dark:bg-red-500/10' },
};

const TIMING_CONFIG: Record<string, { label: string; badge: string; text: string; icon: any }> = {
  optimal:   { label: 'Timing óptimo',           badge: 'bg-green-100 dark:bg-green-500/20',  text: 'text-green-700 dark:text-green-400', icon: Clock },
  too_early: { label: 'Muy temprano',       badge: 'bg-amber-100 dark:bg-amber-500/20',  text: 'text-amber-700 dark:text-amber-400', icon: Clock },
  late:      { label: 'Tarde para el mercado',    badge: 'bg-red-100 dark:bg-red-500/20',    text: 'text-red-700 dark:text-red-400',   icon: AlertTriangle },
  uncertain: { label: 'Timing incierto',          badge: 'bg-gray-100 dark:bg-white/10',   text: 'text-gray-700 dark:text-gray-300',  icon: HelpCircle },
};

const NEWS_CONFIG: Record<string, { dot: string; text: string }> = {
  positive: { dot: 'bg-green-500', text: 'text-green-600 dark:text-green-400' },
  negative: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400'   },
  neutral:  { dot: 'bg-gray-400 dark:bg-gray-600', text: 'text-gray-600 dark:text-gray-400'  },
};

export function MarketSignalsCard({ data }: Props) {
  const trend  = TREND_CONFIG[data.trendDirection]  ?? TREND_CONFIG.stable;
  const timing = TIMING_CONFIG[data.timingAssessment] ?? TIMING_CONFIG.uncertain;
  const TrendIcon = trend.icon;
  const TimingIcon = timing.icon;

  return (
    <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-3xl p-6 relative overflow-hidden group shadow-sm hover:shadow-md transition-shadow">
      <div className={`absolute -right-20 -top-20 w-64 h-64 ${trend.glow} rounded-full blur-[60px] opacity-70 group-hover:opacity-100 transition-opacity duration-700`}></div>
      
      {/* Header */}
      <div className="relative flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 shadow-inner">
          <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Señales de Mercado</h3>
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">Tendencias e inversión reciente en el espacio</p>
        </div>
      </div>

      {/* Chips de tendencia + timing */}
      <div className="relative flex flex-wrap gap-2.5 mb-5">
        <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-transparent ${trend.badge} ${trend.text}`}>
          <TrendIcon className="w-4 h-4" /> {trend.label}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider border border-transparent ${timing.badge} ${timing.text}`}>
          <TimingIcon className="w-4 h-4" /> {timing.label}
        </span>
      </div>

      {/* Descripción de tendencia */}
      {data.trendDescription && (
        <p className="relative text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed mb-4 bg-gray-50 dark:bg-[#0A0A0F]/50 rounded-xl p-4 border border-gray-100 dark:border-white/5">
          {data.trendDescription}
        </p>
      )}

      {/* Timing rationale */}
      {data.timingRationale && (
        <div className={`relative rounded-xl px-4 py-4 mb-6 border ${trend.badge} border-opacity-30 bg-opacity-30 backdrop-blur-sm`}>
          <p className={`text-xs leading-relaxed ${trend.text}`}>
            <span className="font-black uppercase tracking-wider block mb-1">Análisis de timing</span>
            <span className="opacity-90">{data.timingRationale}</span>
          </p>
        </div>
      )}

      <div className="relative grid lg:grid-cols-2 gap-5 pt-2">
        {/* Rondas de inversión */}
        {data.recentFunding?.length > 0 && (
          <div className="bg-gray-50 dark:bg-[#0A0A0F]/40 rounded-2xl p-4 border border-gray-100 dark:border-white/5">
            <h4 className="text-xs font-black text-gray-900 dark:text-[#F0EFF8] uppercase tracking-wider mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-500" /> Rondas recientes
            </h4>
            <div className="space-y-3">
              {data.recentFunding.map((f, i) => (
                <div key={i} className="bg-white dark:bg-[#1A1A24] rounded-xl p-3 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col gap-1">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-bold text-sm text-gray-900 dark:text-[#F0EFF8] truncate">{f.company}</span>
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">{f.amount}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 dark:text-[#8B8AA0] uppercase tracking-wide font-semibold">{f.date}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Noticias relevantes */}
        {data.relevantNews?.length > 0 && (
          <div className="bg-gray-50 dark:bg-[#0A0A0F]/40 rounded-2xl p-4 border border-gray-100 dark:border-white/5">
            <h4 className="text-xs font-black text-gray-900 dark:text-[#F0EFF8] uppercase tracking-wider mb-3 flex items-center gap-2">
              <Newspaper className="w-4 h-4 text-blue-500" /> Noticias clave
            </h4>
            <ul className="space-y-3">
              {data.relevantNews.map((n, i) => {
                const nc = NEWS_CONFIG[n.impact] ?? NEWS_CONFIG.neutral;
                return (
                  <li key={i} className="flex items-start gap-3 bg-white dark:bg-[#1A1A24] rounded-xl p-3 shadow-sm border border-gray-100 dark:border-white/5">
                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 shadow-sm ${nc.dot}`} />
                    <span className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-snug font-medium">{n.title}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
