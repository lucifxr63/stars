import { PieChart, Info, Filter, Users, Globe, Target } from 'lucide-react';
import type { MarketSizing, MarketSizingTier } from '@/types/validation';

const CONFIDENCE_STYLES = {
  high: { badge: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20', dot: 'bg-emerald-500', label: 'Alta' },
  medium: { badge: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20', dot: 'bg-amber-400', label: 'Media' },
  low: { badge: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20', dot: 'bg-red-400', label: 'Baja' },
};

const ICONS = {
  TAM: Globe,
  SAM: Users,
  SOM: Target,
};

function formatUSD(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value}`;
}

function TierBar({
  tier,
  label,
  widthPct,
  accentColor,
}: {
  tier: MarketSizingTier;
  label: 'TAM' | 'SAM' | 'SOM';
  widthPct: number;
  accentColor: string;
}) {
  const conf = CONFIDENCE_STYLES[tier.confidence];
  const Icon = ICONS[label];

  return (
    <div className="bg-white dark:bg-[#1A1A24] rounded-2xl p-4 border border-gray-100 dark:border-white/5 shadow-sm transition-all hover:shadow-md hover:border-gray-200 dark:hover:border-white/10 group">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 mb-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm" style={{ background: accentColor, boxShadow: `0 4px 14px ${accentColor}40` }}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider">{label}</span>
            </div>
            <span className="text-lg font-black text-gray-900 dark:text-[#F0EFF8] tracking-tight">
              {formatUSD(tier.value_low)} <span className="text-gray-400 font-medium">a</span> {formatUSD(tier.value_high)}
            </span>
          </div>
        </div>
        <span className={`text-[10px] uppercase font-black tracking-wider px-2.5 py-1 rounded-full border flex items-center gap-1.5 shrink-0 ${conf.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${conf.dot} animate-pulse`} />
          {conf.label}
        </span>
      </div>
      <div className="h-3 bg-gray-100 dark:bg-[#0A0A0F] rounded-full overflow-hidden shadow-inner relative mb-3">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${widthPct}%`, background: accentColor, boxShadow: `0 0 12px ${accentColor}80` }}
        />
      </div>
      <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed group-hover:text-gray-700 dark:group-hover:text-[#C4C4D4] transition-colors">{tier.description}</p>
    </div>
  );
}

export function MarketFunnel({ data }: { data: MarketSizing }) {
  const tamMax = data.tam.value_high;

  return (
    <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-3xl overflow-hidden shadow-sm relative">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-teal-500"></div>
      
      <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0 border border-blue-100 dark:border-blue-500/20 shadow-inner">
          <PieChart className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Tamaño de mercado estimado</h2>
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0] flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Actualizado: {data.data_freshness}
          </p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-[#0A0A0F]/60 p-6 space-y-4">
        <TierBar tier={data.tam} label="TAM" accentColor="#3b82f6" widthPct={100} />
        <TierBar tier={data.sam} label="SAM" accentColor="#8b5cf6" widthPct={tamMax > 0 ? Math.max(10, (data.sam.value_high / tamMax) * 100) : 60} />
        <TierBar tier={data.som} label="SOM" accentColor="#14b8a6" widthPct={tamMax > 0 ? Math.max(5, (data.som.value_high / tamMax) * 100) : 30} />

        <div className="grid sm:grid-cols-2 gap-4 pt-2">
          {/* Metodología */}
          <div className="bg-white dark:bg-[#1A1A24] rounded-2xl p-4 border border-gray-100 dark:border-white/5 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-purple-500" />
              <p className="text-xs font-black text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider">Metodología</p>
            </div>
            <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{data.methodology}</p>
          </div>

          {/* Asunciones SOM */}
          {data.som.assumptions && data.som.assumptions.length > 0 && (
            <div className="bg-white dark:bg-[#1A1A24] rounded-2xl p-4 border border-gray-100 dark:border-white/5 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-teal-500" />
                <p className="text-xs font-black text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider">Asunciones SOM</p>
              </div>
              <ul className="space-y-1.5">
                {data.som.assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#C4C4D4] leading-relaxed">
                    <span className="text-teal-500 shrink-0 mt-0.5">•</span>{a}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Source notes colapsables */}
        <details className="group bg-white dark:bg-[#1A1A24] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden shadow-sm">
          <summary className="text-xs font-black text-gray-600 dark:text-[#8B8AA0] uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 px-4 py-3 transition select-none flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              Ver fuentes de datos
            </div>
            <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
          </summary>
          <div className="px-4 pb-4 pt-1 space-y-3 bg-gray-50/50 dark:bg-transparent">
            {[
              { label: 'TAM', note: data.tam.source_notes, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-500/20' },
              { label: 'SAM', note: data.sam.source_notes, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-500/20' },
              { label: 'SOM', note: data.som.source_notes, color: 'text-teal-500', bg: 'bg-teal-100 dark:bg-teal-500/20' },
            ].map(({ label, note, color, bg }) => (
              <div key={label} className="flex items-start gap-3">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${bg} ${color}`}>{label}</span>
                <span className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed mt-0.5">{note}</span>
              </div>
            ))}
          </div>
        </details>

        <div className="flex items-center gap-2 px-1 opacity-60">
          <Info className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <p className="text-[10px] text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide font-semibold">
            Estimaciones generadas con IA. Requieren validación humana adicional.
          </p>
        </div>
      </div>
    </div>
  );
}
