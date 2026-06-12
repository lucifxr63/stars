import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, Radar } from 'lucide-react';
import { useMarketSignals, type Trend, type Sentiment } from '@/hooks/useMarketSignals';

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'up') return <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-gray-400" />;
}

const SENTIMENT_DOT: Record<Sentiment, string> = {
  positive: 'bg-emerald-500',
  neutral: 'bg-sky-500',
  risk: 'bg-amber-500',
};

function deltaCls(delta: number | null): string {
  if (delta == null || delta === 0) return 'text-gray-400 dark:text-[#afaebb]';
  return delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400';
}

/**
 * Widget secundario del Command Center: inteligencia de mercado (Bralidus).
 * Da una razón para volver al dashboard aunque no haya una validación activa.
 */
export function MarketSignalsWidget() {
  const { data, loading } = useMarketSignals();

  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#0EB5C6]/10 flex items-center justify-center shrink-0">
            <Radar className="w-4 h-4 text-[#0EB5C6]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] leading-tight">Inteligencia de Mercado</h2>
            <p className="text-[11px] text-gray-400 dark:text-[#8B8AA0] leading-tight">Bralidus · señales para tu PyME</p>
          </div>
        </div>
        <Link to="/market-intelligence" className="text-xs text-[#0EB5C6] hover:underline font-medium shrink-0">
          Ver más →
        </Link>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100 dark:divide-white/[0.06]">
        {loading
          ? [1, 2, 3, 4].map((i) => (
              <div key={i} className="px-4 py-3.5">
                <div className="h-3 w-12 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse mb-2" />
                <div className="h-5 w-16 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
              </div>
            ))
          : data?.indicators.map((ind) => (
              <div key={ind.key} className="px-4 py-3.5">
                <p className="text-[11px] text-gray-400 dark:text-[#8B8AA0] uppercase tracking-wide mb-1">{ind.label}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-base font-black text-gray-900 dark:text-[#F0EFF8] tabular-nums">{ind.value}</span>
                  <TrendIcon trend={ind.trend} />
                </div>
                {ind.deltaPct != null && (
                  <span className={`text-[11px] font-semibold tabular-nums ${deltaCls(ind.deltaPct)}`}>
                    {ind.deltaPct > 0 ? '+' : ''}{ind.deltaPct}%
                  </span>
                )}
              </div>
            ))}
      </div>

      {/* Señales */}
      <div className="px-5 py-4 space-y-3 border-t border-gray-100 dark:border-white/[0.06]">
        {loading
          ? [1, 2].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="h-3.5 w-3/4 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
                <div className="h-3 w-full bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
              </div>
            ))
          : data?.signals.map((sig) => (
              <div key={sig.id} className="flex gap-2.5">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1.5 ${SENTIMENT_DOT[sig.sentiment]}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8] leading-snug">{sig.headline}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-snug mt-0.5">{sig.detail}</p>
                  <p className="text-[10px] text-gray-400 dark:text-[#afaebb] mt-1">{sig.source}</p>
                </div>
              </div>
            ))}
      </div>

      {/* Footer: procedencia de datos (honestidad sobre mock vs real) */}
      {!loading && data?.source === 'mock' && (
        <div className="px-5 py-2 bg-gray-50 dark:bg-white/[0.02] border-t border-gray-100 dark:border-white/[0.06]">
          <p className="text-[10px] text-gray-400 dark:text-[#afaebb]">
            Datos de demostración · el feed en vivo de Bralidus se conecta próximamente
          </p>
        </div>
      )}
    </div>
  );
}
