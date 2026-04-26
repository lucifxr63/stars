import type { RiskAnalysis, RiskDimension } from '@/types/validation';

interface Props {
  data: RiskAnalysis;
}

const RISK_COLOR = (score: number): { bg: string; text: string; border: string; bar: string } => {
  if (score >= 70) return { bg: 'bg-red-50',   text: 'text-red-600',   border: 'border-red-200',   bar: 'bg-red-500'   };
  if (score >= 40) return { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', bar: 'bg-amber-500' };
  return              { bg: 'bg-green-50',  text: 'text-green-600',  border: 'border-green-200',  bar: 'bg-green-500'  };
};

const RISK_LABEL = (score: number) =>
  score >= 70 ? 'Alto' : score >= 40 ? 'Medio' : 'Bajo';

function DimensionCard({ label, d }: { label: string; d: RiskDimension }) {
  const c = RISK_COLOR(d.score);
  return (
    <div className={`rounded-2xl border-2 p-4 ${c.bg} ${c.border}`}>
      {/* Barra de riesgo (llena de derecha a izquierda) */}
      <div className="w-full h-1.5 bg-gray-200 rounded-full mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full ${c.bar} transition-all`}
          style={{ width: `${d.score}%`, marginLeft: 'auto' }}
        />
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700">{label}</span>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.bg} ${c.text} border ${c.border}`}>
          {d.score} · {d.label}
        </span>
      </div>

      <p className="text-xs text-gray-500 leading-snug mb-2 line-clamp-3">{d.description}</p>

      {d.keyFactors?.length > 0 && (
        <ul className="space-y-0.5">
          {d.keyFactors.map((f, i) => (
            <li key={i} className="flex items-start gap-1.5 text-xs text-gray-500">
              <div className={`w-1 h-1 rounded-full mt-1.5 shrink-0 ${c.bar}`} />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function RiskAnalysisCard({ data }: Props) {
  const overall = RISK_COLOR(data.overallRiskScore);
  const label   = RISK_LABEL(data.overallRiskScore);

  const dims = [
    { label: 'Riesgo de mercado',    d: data.dimensions.market      },
    { label: 'Riesgo técnico',       d: data.dimensions.technical    },
    { label: 'Riesgo regulatorio',   d: data.dimensions.regulatory  },
    { label: 'Riesgo de timing',     d: data.dimensions.timing       },
  ];

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${overall.bg} border-2 ${overall.border}`}>
          <span className={`text-lg font-black ${overall.text}`}>⚠</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900">Análisis de Riesgos</h3>
          <p className="text-xs text-gray-400">Score compuesto en 4 dimensiones (0 = mínimo, 100 = máximo riesgo)</p>
        </div>
        {/* Score general */}
        <div className={`flex flex-col items-center px-4 py-2 rounded-xl ${overall.bg} border-2 ${overall.border}`}>
          <span className={`text-2xl font-black ${overall.text}`}>{data.overallRiskScore}</span>
          <span className={`text-xs font-bold ${overall.text}`}>Riesgo {label}</span>
        </div>
      </div>

      {/* Grid 2×2 */}
      <div className="grid sm:grid-cols-2 gap-3 mb-4">
        {dims.map(({ label: l, d }) => (
          <DimensionCard key={l} label={l} d={d} />
        ))}
      </div>

      {/* Mitigaciones */}
      {data.mitigations?.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-green-700 mb-3 flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
              <span className="text-white text-[8px] font-black">✓</span>
            </div>
            Mitigaciones recomendadas
          </h4>
          <ol className="space-y-2">
            {data.mitigations.map((m, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-600 leading-relaxed">{m}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
