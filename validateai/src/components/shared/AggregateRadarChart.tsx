import { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { Link } from 'react-router-dom';

type RawDim = number | { score: number; feedback?: string } | null | undefined;
type ScoreBreakdownRaw = {
  problem?: RawDim;
  market?: RawDim;
  competition?: RawDim;
  solution?: RawDim;
  execution?: RawDim;
} | null;

interface ValidationForRadar {
  status: string;
  score_breakdown?: ScoreBreakdownRaw;
  validation_score?: number | null;
}

const DIMS = ['problem', 'market', 'competition', 'solution', 'execution'] as const;
type Dim = typeof DIMS[number];

const LABELS: Record<Dim, string> = {
  problem:     'Problema',
  market:      'Mercado',
  competition: 'Competencia',
  solution:    'Solución',
  execution:   'Ejecución',
};

function extractScore(v: RawDim): number {
  if (v == null) return 0;
  if (typeof v === 'number') return v;
  return v.score ?? 0;
}

// Tick personalizado que muestra label + score promedio
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTick({
  x, y, payload, chartData,
}: {
  // Recharts inyecta x/y como string | number — normalizamos a number
  x?: string | number; y?: string | number; payload?: { value: string };
  chartData: { subject: string; value: number }[];
}) {
  if (!payload) return null;
  const entry = chartData.find((d) => d.subject === payload.value);
  const score = entry?.value ?? null;
  const cx = Number(x ?? 0);
  const cy = Number(y ?? 0);

  return (
    <g>
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#9ca3af"
        fontSize={10}
        fontWeight={600}
      >
        {payload.value}
      </text>
      {score != null && (
        <text
          x={cx}
          y={cy + 12}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#14b8a6"
          fontSize={9}
          fontWeight={700}
        >
          {score}
        </text>
      )}
    </g>
  );
}

// Tooltip personalizado
function RadarTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { subject: string; fullMark: number } }[] }) {
  if (!active || !payload?.length) return null;
  const { value, payload: { subject, fullMark } } = payload[0];
  return (
    <div className="bg-[#12121A] border border-white/[0.08] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-0.5">{subject}</p>
      <p className="text-[#14b8a6] font-bold text-sm">{value} <span className="text-gray-500 font-normal">/ {fullMark}</span></p>
    </div>
  );
}

// Estado vacío — polígono esquelético + mensaje
function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4 py-2">
      <svg viewBox="0 0 180 160" className="w-36 h-32 opacity-[0.08]">
        {/* Cuadrícula polar */}
        <circle cx="90" cy="80" r="60" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="90" cy="80" r="40" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="90" cy="80" r="20" fill="none" stroke="currentColor" strokeWidth="1" />
        {/* Ejes */}
        {[0, 72, 144, 216, 288].map((deg) => {
          const rad = (deg - 90) * (Math.PI / 180);
          return (
            <line
              key={deg}
              x1="90" y1="80"
              x2={90 + 60 * Math.cos(rad)}
              y2={80 + 60 * Math.sin(rad)}
              stroke="currentColor" strokeWidth="1"
            />
          );
        })}
        {/* Polígono fantasma */}
        <polygon
          points="90,30 135,62 120,115 60,115 45,62"
          fill="currentColor" fillOpacity="0.12"
          stroke="currentColor" strokeWidth="1.5"
        />
      </svg>
      <div>
        <p className="text-xs font-semibold text-gray-500 dark:text-[#8B8AA0] mb-1">
          {hasAny
            ? 'Completa una validación para ver el desglose'
            : 'Inicia tu primera validación'}
        </p>
        <p className="text-[11px] text-gray-400 dark:text-[#4A495E] leading-relaxed">
          Tu perfil de fundador aparecerá aquí
        </p>
      </div>
      <Link
        to="/validate"
        className="text-[11px] font-bold text-[#14b8a6] hover:underline"
      >
        Validar idea →
      </Link>
    </div>
  );
}

interface AggregateRadarChartProps {
  validations: ValidationForRadar[];
}

export function AggregateRadarChart({ validations }: AggregateRadarChartProps) {
  const completed = validations.filter(
    (v) => v.status === 'completed' && v.score_breakdown != null,
  );

  const chartData = useMemo(() => {
    if (completed.length === 0) return null;

    return DIMS.map((key) => {
      const sum = completed.reduce((acc, v) => {
        const bd = v.score_breakdown as Record<Dim, RawDim>;
        return acc + extractScore(bd?.[key]);
      }, 0);
      return {
        subject:  LABELS[key],
        value:    Math.round(sum / completed.length),
        fullMark: 100,
      };
    });
  }, [completed]);

  // Promedio global del portfolio
  const avgScore = useMemo(() => {
    if (!chartData) return null;
    return Math.round(chartData.reduce((s, d) => s + d.value, 0) / chartData.length);
  }, [chartData]);

  if (!chartData) {
    return <EmptyState hasAny={validations.length > 0} />;
  }

  return (
    <div className="flex flex-col h-full gap-1">
      {/* Subtítulo con metadatos */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] text-gray-400 dark:text-[#4A495E]">
          {completed.length} validación{completed.length !== 1 ? 'es' : ''} promediada{completed.length !== 1 ? 's' : ''}
        </span>
        {avgScore != null && (
          <span className="text-[11px] font-bold text-[#14b8a6]">
            {avgScore} <span className="text-gray-400 font-normal text-[10px]">avg</span>
          </span>
        )}
      </div>

      {/* Gráfico */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={chartData} margin={{ top: 16, right: 28, bottom: 16, left: 28 }}>
            <PolarGrid
              stroke="#e5e7eb"
              className="dark:[stroke:rgba(255,255,255,0.07)]"
              gridType="polygon"
            />
            <PolarAngleAxis
              dataKey="subject"
              tick={(props) => (
                <CustomTick {...props} chartData={chartData} />
              )}
              tickLine={false}
            />
            <Tooltip content={<RadarTooltip />} />
            <Radar
              dataKey="value"
              stroke="#14b8a6"
              fill="#14b8a6"
              fillOpacity={0.22}
              strokeWidth={2}
              dot={{ fill: '#14b8a6', r: 3, strokeWidth: 0 }}
              isAnimationActive
              animationDuration={900}
              animationEasing="ease-out"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda de dimensiones con scores */}
      <div className="grid grid-cols-5 gap-1 mt-1">
        {chartData.map((d) => (
          <div key={d.subject} className="text-center">
            <p
              className="text-[11px] font-black tabular-nums"
              style={{ color: d.value >= 70 ? '#10b981' : d.value >= 40 ? '#f59e0b' : '#ef4444' }}
            >
              {d.value}
            </p>
            <p className="text-[9px] text-gray-400 dark:text-[#4A495E] leading-tight truncate">
              {d.subject.slice(0, 5)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
