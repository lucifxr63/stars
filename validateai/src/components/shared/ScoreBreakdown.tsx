import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { ScoreBreakdown as ScoreBreakdownType } from '@/types/validation';

const LABELS: Record<keyof ScoreBreakdownType, string> = {
  problem: 'Problema',
  market: 'Mercado',
  competition: 'Competencia',
  solution: 'Solución',
  execution: 'Ejecución',
};

// Explicaciones contextuales para cada dimensión del radar.
// Se muestran en el tooltip al hacer hover sobre un nodo del gráfico.
const DIMENSION_DESCRIPTIONS: Record<keyof ScoreBreakdownType, {
  high: string;   // score >= 70
  mid: string;    // score >= 40
  low: string;    // score < 40
  insufficient: string; // datos insuficientes
}> = {
  problem: {
    high: 'Problema claro, urgente y validado. Los clientes lo reconocen activamente.',
    mid: 'El problema existe pero la urgencia o el tamaño del dolor no son evidentes.',
    low: 'No se identifica un dolor real o medible. Requiere más investigación de campo.',
    insufficient: 'Sin datos suficientes para evaluar el problema. Completa el análisis Detallado.',
  },
  market: {
    high: 'Mercado grande, en crecimiento y accesible. Buen timing para entrar.',
    mid: 'Mercado viable pero con limitaciones de tamaño, acceso o crecimiento.',
    low: 'Mercado pequeño, saturado o en declive. Considera pivotar el segmento.',
    insufficient: 'Sin datos de mercado. El análisis Detallado incluye TAM/SAM/SOM.',
  },
  competition: {
    high: 'Ventaja competitiva clara y defendible. Pocos incumbentes directos.',
    mid: 'Competencia presente pero con espacio para diferenciación.',
    low: 'Mercado muy competido sin diferenciador evidente. Red flag para inversores.',
    insufficient: 'Sin análisis de competidores. Añade la solución actual de incumbentes.',
  },
  solution: {
    high: 'Solución bien definida, técnicamente viable y con PMF potencial.',
    mid: 'La solución resuelve el problema parcialmente. Falta validación técnica o de usuario.',
    low: 'La solución no ataca el dolor principal o es demasiado compleja para el mercado.',
    insufficient: 'Sin datos de solución. Describe tu propuesta con más detalle.',
  },
  execution: {
    high: 'Equipo fuerte, tracción real y compromiso full-time. Listo para escalar.',
    mid: 'Equipo funcional pero con gaps en experiencia, tracción o dedicación.',
    low: 'Riesgo alto de ejecución: equipo incompleto, sin tracción ni experiencia relevante.',
    insufficient: 'Sin datos de equipo/fundador. Completa el paso de Founder para desbloquearlo.',
  },
};

// Normaliza el valor de cada dimensión: acepta tanto el formato plano (número)
// del flujo Detallado como el formato objeto { score, feedback } del flujo Rápido.
type RawDimension = number | { score: number; feedback: string };
type RawBreakdown = Record<keyof ScoreBreakdownType, RawDimension>;

function extractScore(val: RawDimension): number {
  if (typeof val === 'number') return val;
  return val?.score ?? 0;
}

function isInsufficient(val: RawDimension): boolean {
  if (typeof val === 'object' && val !== null) {
    return val.feedback === 'INSUFFICIENT_DATA';
  }
  return false;
}

// Tooltip personalizado para el radar chart.
// Muestra: nombre de la dimensión, score numérico y descripción contextual.
function RadarTooltip({ active, payload }: { active?: boolean; payload?: { payload: { subject: string; value: number; dimKey: keyof ScoreBreakdownType; isInsufficient: boolean } }[] }) {
  if (!active || !payload?.length) return null;
  const { subject, value, dimKey, isInsufficient: insuf } = payload[0].payload;
  const desc = DIMENSION_DESCRIPTIONS[dimKey];
  const explanation = insuf
    ? desc.insufficient
    : value >= 70
      ? desc.high
      : value >= 40
        ? desc.mid
        : desc.low;
  const color = insuf ? '#6b7280'
    : value >= 70 ? '#10b981'
      : value >= 40 ? '#f59e0b'
        : '#ef4444';

  return (
    <div className="bg-[#1A1A24]/95 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 shadow-2xl max-w-[220px]">
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <span className="text-xs font-bold text-[#F0EFF8]">{subject}</span>
        {insuf ? (
          <span className="text-[10px] font-bold text-gray-400 bg-white/5 px-1.5 py-0.5 rounded">—</span>
        ) : (
          <span className="text-xs font-black tabular-nums" style={{ color }}>{value}<span className="text-[10px] font-normal text-[#8B8AA0]">/100</span></span>
        )}
      </div>
      <p className="text-[11px] text-[#BDBDCF] leading-relaxed">{explanation}</p>
    </div>
  );
}

export function ScoreBreakdown({ data }: { data: ScoreBreakdownType | RawBreakdown }) {
  const rawData = data as RawBreakdown;
  const chartData = (Object.keys(LABELS) as (keyof ScoreBreakdownType)[]).map((key) => ({
    subject: LABELS[key],
    value: extractScore(rawData[key]),
    fullMark: 100,
    dimKey: key,
    isInsufficient: isInsufficient(rawData[key]),
  }));

  return (
    <div className="border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 bg-white dark:bg-[#12121A] border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-gray-800 dark:text-[#F0EFF8]">Desglose del score</p>
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-[#0A0A0F]/40 px-5 py-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full">
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }}
                />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#14b8a6"
                  fill="#14b8a6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                  activeDot={{ r: 5, stroke: '#14b8a6', strokeWidth: 2, fill: '#0d9488' }}
                />
                <Tooltip
                  content={<RadarTooltip />}
                  cursor={false}
                  wrapperStyle={{ outline: 'none', zIndex: 50 }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full sm:w-40 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-x-4 gap-y-2.5">
              {(Object.keys(LABELS) as (keyof ScoreBreakdownType)[]).map((key) => {
                const raw = rawData[key];
                const val = extractScore(raw);
                const insufficient = isInsufficient(raw);
                const color = insufficient ? '#6b7280'
                  : val >= 70 ? '#10b981'
                    : val >= 40 ? '#f59e0b'
                      : '#ef4444';
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-500 dark:text-[#8B8AA0]">{LABELS[key]}</span>
                      {insufficient ? (
                        <span className="text-[10px] font-bold text-gray-400">—</span>
                      ) : (
                        <span className="text-xs font-black" style={{ color }}>{val}</span>
                      )}
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${insufficient ? 'opacity-20' : ''}`}
                        style={{ width: insufficient ? '100%' : `${val}%`, background: insufficient ? '#374151' : color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
