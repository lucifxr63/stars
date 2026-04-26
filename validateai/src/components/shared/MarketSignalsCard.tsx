import type { MarketSignals } from '@/types/validation';

interface Props {
  data: MarketSignals;
}

const TREND_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  growing:  { label: 'Creciendo',  bg: 'bg-green-100',  text: 'text-green-700',  icon: '📈' },
  stable:   { label: 'Estable',    bg: 'bg-amber-100',  text: 'text-amber-700',  icon: '➡️' },
  declining:{ label: 'Declining',  bg: 'bg-red-100',    text: 'text-red-700',    icon: '📉' },
};

const TIMING_CONFIG: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  optimal:   { label: 'Timing óptimo',           bg: 'bg-green-100',  text: 'text-green-700', icon: '✅' },
  too_early: { label: 'Demasiado temprano',       bg: 'bg-amber-100',  text: 'text-amber-700', icon: '⏰' },
  late:      { label: 'Tarde para el mercado',    bg: 'bg-red-100',    text: 'text-red-700',   icon: '⚠️' },
  uncertain: { label: 'Timing incierto',          bg: 'bg-gray-100',   text: 'text-gray-600',  icon: '❓' },
};

const NEWS_CONFIG: Record<string, { dot: string }> = {
  positive: { dot: 'bg-green-500' },
  negative: { dot: 'bg-red-500'   },
  neutral:  { dot: 'bg-gray-400'  },
};

export function MarketSignalsCard({ data }: Props) {
  const trend  = TREND_CONFIG[data.trendDirection]  ?? TREND_CONFIG.stable;
  const timing = TIMING_CONFIG[data.timingAssessment] ?? TIMING_CONFIG.uncertain;

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-indigo-50 border-2 border-indigo-200">
          <span className="text-xl">🔭</span>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">Señales de Mercado</h3>
          <p className="text-xs text-gray-400">Tendencias e inversión reciente en el espacio</p>
        </div>
      </div>

      {/* Chips de tendencia + timing */}
      <div className="flex flex-wrap gap-2 mb-4">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${trend.bg} ${trend.text}`}>
          {trend.icon} {trend.label}
        </span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${timing.bg} ${timing.text}`}>
          {timing.icon} {timing.label}
        </span>
      </div>

      {/* Descripción de tendencia */}
      {data.trendDescription && (
        <p className="text-sm text-gray-600 leading-relaxed mb-4">{data.trendDescription}</p>
      )}

      {/* Timing rationale */}
      {data.timingRationale && (
        <div className={`rounded-xl px-4 py-3 mb-4 ${timing.bg} border border-opacity-50`}>
          <p className="text-xs text-gray-500 leading-relaxed">
            <span className="font-bold">Análisis de timing: </span>
            {data.timingRationale}
          </p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Rondas de inversión */}
        {data.recentFunding?.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <span>💰</span> Rondas recientes
            </h4>
            <ul className="space-y-2">
              {data.recentFunding.map((f, i) => (
                <li key={i} className="text-xs bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                  <span className="font-semibold text-gray-800">{f.company}</span>
                  <span className="text-gray-400"> · {f.amount}</span>
                  <span className="text-gray-400 block">{f.date}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Noticias relevantes */}
        {data.relevantNews?.length > 0 && (
          <div>
            <h4 className="text-xs font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <span>📰</span> Noticias relevantes
            </h4>
            <ul className="space-y-2">
              {data.relevantNews.map((n, i) => {
                const nc = NEWS_CONFIG[n.impact] ?? NEWS_CONFIG.neutral;
                return (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                    <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${nc.dot}`} />
                    <span className="leading-snug">{n.title}</span>
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
