import type { MarketSizing, MarketSizingTier } from '@/types/validation';

const CONFIDENCE_STYLES = {
  high: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Alta' },
  medium: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-400', label: 'Media' },
  low: { badge: 'bg-red-50 text-red-600 border-red-200', dot: 'bg-red-400', label: 'Baja' },
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
  label: string;
  widthPct: number;
  accentColor: string;
}) {
  const conf = CONFIDENCE_STYLES[tier.confidence];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-black tracking-wider px-2.5 py-1 rounded-lg text-white shrink-0" style={{ background: accentColor }}>
            {label}
          </span>
          <span className="text-sm font-bold text-gray-800">
            {formatUSD(tier.value_low)} – {formatUSD(tier.value_high)}
          </span>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full border flex items-center gap-1.5 shrink-0 ${conf.badge}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
          {conf.label}
        </span>
      </div>
      <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${widthPct}%`, background: accentColor }}
        />
      </div>
      <p className="text-xs text-gray-500 leading-relaxed">{tier.description}</p>
    </div>
  );
}

export function MarketFunnel({ data }: { data: MarketSizing }) {
  const tamMax = data.tam.value_high;

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800">Tamaño de mercado estimado</p>
            <p className="text-xs text-gray-400">{data.data_freshness}</p>
          </div>
        </div>
      </div>

      <div className="bg-gray-50/40 px-5 py-5 space-y-5">
        <TierBar
          tier={data.tam}
          label="TAM"
          accentColor="#3b82f6"
          widthPct={100}
        />
        <TierBar
          tier={data.sam}
          label="SAM"
          accentColor="#8b5cf6"
          widthPct={tamMax > 0 ? Math.max(10, (data.sam.value_high / tamMax) * 100) : 60}
        />
        <TierBar
          tier={data.som}
          label="SOM"
          accentColor="#14b8a6"
          widthPct={tamMax > 0 ? Math.max(5, (data.som.value_high / tamMax) * 100) : 30}
        />

        {/* Metodología */}
        <div className="pt-1 border-t border-gray-200">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Metodología</p>
          <p className="text-xs text-gray-500 leading-relaxed">{data.methodology}</p>
        </div>

        {/* Asunciones SOM */}
        {data.som.assumptions && data.som.assumptions.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Asunciones del SOM</p>
            <ul className="space-y-1">
              {data.som.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                  <span className="text-teal-400 shrink-0 mt-0.5">•</span>{a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Source notes colapsables */}
        <details className="group">
          <summary className="text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer hover:text-gray-600 transition select-none">
            Fuentes de datos ▾
          </summary>
          <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-gray-200">
            {[
              { label: 'TAM', note: data.tam.source_notes },
              { label: 'SAM', note: data.sam.source_notes },
              { label: 'SOM', note: data.som.source_notes },
            ].map(({ label, note }) => (
              <div key={label}>
                <span className="text-xs font-bold text-gray-500">{label}: </span>
                <span className="text-xs text-gray-400">{note}</span>
              </div>
            ))}
          </div>
        </details>

        <p className="text-xs text-gray-300 italic pt-1">
          Este análisis fue generado con IA y datos estimados. Los datos de mercado son aproximaciones y deben verificarse con investigación adicional.
        </p>
      </div>
    </div>
  );
}
