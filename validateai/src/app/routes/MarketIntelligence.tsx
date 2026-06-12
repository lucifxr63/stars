import { Radar, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useMarketSignals, type Trend, type Sentiment } from '@/hooks/useMarketSignals';

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <TrendingUp className="w-4 h-4 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

const SENTIMENT: Record<Sentiment, { dot: string; label: string; cls: string }> = {
  positive: { dot: 'bg-emerald-500', label: 'Oportunidad', cls: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' },
  neutral: { dot: 'bg-sky-500', label: 'Contexto', cls: 'text-sky-600 dark:text-sky-400 bg-sky-500/10' },
  risk: { dot: 'bg-amber-500', label: 'Riesgo', cls: 'text-amber-600 dark:text-amber-400 bg-amber-500/10' },
};

function deltaCls(delta: number | null): string {
  if (delta == null || delta === 0) return 'text-gray-400 dark:text-[#afaebb]';
  return delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
}

export function MarketIntelligence() {
  const { data, loading } = useMarketSignals();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-10">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-11 h-11 rounded-2xl bg-[#0EB5C6]/10 flex items-center justify-center shrink-0">
          <Radar className="w-5 h-5 text-[#0EB5C6]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8] leading-tight">Inteligencia de Mercado</h1>
          <p className="text-sm text-gray-500 dark:text-[#8B8AA0]">
            Señales macro y de demanda para tu startup · motor Bralidus
          </p>
        </div>
      </div>

      {/* Indicadores */}
      <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Indicadores clave</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-4 py-4">
                <div className="h-3 w-12 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse mb-2" />
                <div className="h-6 w-16 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
              </div>
            ))
          : data?.indicators.map((ind) => (
              <div key={ind.key} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] px-4 py-4">
                <p className="text-[11px] text-gray-400 dark:text-[#8B8AA0] uppercase tracking-wide mb-1">{ind.label}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xl font-black text-gray-900 dark:text-[#F0EFF8] tabular-nums">{ind.value}</span>
                  <TrendIcon trend={ind.trend} />
                </div>
                {ind.deltaPct != null && (
                  <span className={`text-xs font-semibold tabular-nums ${deltaCls(ind.deltaPct)}`}>
                    {ind.deltaPct > 0 ? '+' : ''}{ind.deltaPct}%
                  </span>
                )}
              </div>
            ))}
      </div>

      {/* Señales */}
      <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-3">Señales de mercado</h2>
      <div className="space-y-3">
        {loading
          ? [1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-5">
                <div className="h-4 w-2/3 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse mb-2" />
                <div className="h-3 w-full bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
              </div>
            ))
          : data?.signals.map((sig) => {
              const s = SENTIMENT[sig.sentiment];
              return (
                <div key={sig.id} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-5">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${s.dot}`} />
                      <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] truncate">{sig.headline}</h3>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${s.cls}`}>{s.label}</span>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed">{sig.detail}</p>
                  <p className="text-[11px] text-gray-400 dark:text-[#afaebb] mt-2">{sig.source}</p>
                </div>
              );
            })}
      </div>

      {/* Procedencia */}
      {!loading && data?.source === 'mock' && (
        <div className="mt-6 flex items-center gap-2 px-4 py-3 bg-[#0EB5C6]/5 border border-[#0EB5C6]/15 rounded-xl">
          <span className="w-1.5 h-1.5 rounded-full bg-[#0EB5C6] shrink-0" />
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">
            Estás viendo datos de demostración. El feed en vivo del motor Bralidus (macro BCCh, forex, señales de demanda) se conecta próximamente.
          </p>
        </div>
      )}
    </div>
  );
}
