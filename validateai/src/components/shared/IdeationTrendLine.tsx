import { useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';

interface ValidationForTrend {
  created_at: string;
  status?: string;
}

interface IdeationTrendLineProps {
  validations: ValidationForTrend[];
}

function isoWeekStart(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function shortLabel(isoDate: string): string {
  if (!isoDate || isoDate === '__ghost__') return '';
  const [, m, d] = isoDate.split('-');
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${parseInt(d)} ${months[parseInt(m) - 1]}`;
}

// Calcula racha de semanas consecutivas con actividad
function calcStreak(sorted: [string, number][]): number {
  if (sorted.length === 0) return 0;
  let streak = 1;
  for (let i = sorted.length - 1; i > 0; i--) {
    const curr = new Date(sorted[i][0]);
    const prev = new Date(sorted[i - 1][0]);
    const diff = (curr.getTime() - prev.getTime()) / (7 * 24 * 60 * 60 * 1000);
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label || label === '__ghost__') return null;
  return (
    <div className="bg-[#12121A] border border-white/[0.08] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-0.5">Semana del {shortLabel(label)}</p>
      <p className="text-[#0EB5C6] font-bold text-sm">
        {payload[0].value}
        <span className="text-gray-500 font-normal text-xs ml-1">
          {payload[0].value === 1 ? 'idea' : 'ideas'}
        </span>
      </p>
    </div>
  );
}

export function IdeationTrendLine({ validations }: IdeationTrendLineProps) {
  const { data, streak, totalWeeks, bestWeek } = useMemo(() => {
    if (validations.length === 0) {
      return { data: [], streak: 0, totalWeeks: 0, bestWeek: 0 };
    }

    const counts: Record<string, number> = {};
    for (const v of validations) {
      const week = isoWeekStart(v.created_at);
      counts[week] = (counts[week] ?? 0) + 1;
    }

    const sorted = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
    const streak = calcStreak(sorted);
    const totalWeeks = sorted.length;
    const bestWeek = Math.max(...sorted.map(([, c]) => c));

    // Un solo punto: añadir fantasmas para centrar
    if (sorted.length === 1) {
      const [date] = sorted[0];
      const prev = new Date(date);
      prev.setUTCDate(prev.getUTCDate() - 7);
      const next = new Date(date);
      next.setUTCDate(next.getUTCDate() + 7);
      return {
        data: [
          { week: prev.toISOString().slice(0, 10), count: 0, ghost: true },
          { week: date, count: sorted[0][1], ghost: false },
          { week: next.toISOString().slice(0, 10), count: 0, ghost: true },
        ],
        streak, totalWeeks, bestWeek,
      };
    }

    return {
      data: sorted.map(([week, count]) => ({ week, count, ghost: false })),
      streak, totalWeeks, bestWeek,
    };
  }, [validations]);

  // Estado vacío
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2">
        {/* Línea fantasma decorativa */}
        <svg viewBox="0 0 200 60" className="w-full opacity-[0.06]" preserveAspectRatio="none">
          <path d="M 0 45 C 30 45 40 20 70 25 C 100 30 110 40 140 20 C 170 5 180 30 200 28"
            fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <p className="text-[11px] text-gray-400 dark:text-[#8B8AA0]">Sin actividad aún</p>
      </div>
    );
  }

  // Semana actual para marcar con referencia
  const currentWeek = isoWeekStart(new Date().toISOString());

  return (
    <div className="flex flex-col h-full gap-1">
      {/* Métricas inline */}
      <div className="flex items-center gap-3 px-1">
        {streak >= 2 && (
          <span className="flex items-center gap-1 text-[10px] font-bold text-amber-500">
            🔥 {streak} semanas seguidas
          </span>
        )}
        {bestWeek > 1 && (
          <span className="text-[10px] text-gray-400 dark:text-[#afaebb]">
            Mejor semana: <strong className="text-gray-600 dark:text-[#8B8AA0]">{bestWeek}</strong>
          </span>
        )}
        <span className="ml-auto text-[10px] text-gray-400 dark:text-[#afaebb]">
          {totalWeeks} sem. de actividad
        </span>
      </div>

      {/* Gráfico */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0EB5C6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#0EB5C6" stopOpacity={0.0} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f3f4f6"
              className="dark:[stroke:rgba(255,255,255,0.05)]"
              vertical={false}
            />

            <XAxis
              dataKey="week"
              tickFormatter={(v) => v === '__ghost__' ? '' : shortLabel(v)}
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />

            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 9, fill: '#9ca3af' }}
              axisLine={false}
              tickLine={false}
              width={24}
            />

            <Tooltip content={<CustomTooltip />} />

            {/* Línea de referencia para semana actual */}
            {data.some((d) => d.week === currentWeek) && (
              <ReferenceLine
                x={currentWeek}
                stroke="#0EB5C6"
                strokeDasharray="4 2"
                strokeOpacity={0.4}
                label={{ value: 'hoy', position: 'top', fontSize: 9, fill: '#0EB5C6', dy: -2 }}
              />
            )}

            <Area
              type="monotone"
              dataKey="count"
              stroke="#0EB5C6"
              strokeWidth={2}
              fill="url(#trendGradient)"
              dot={false}
              activeDot={{ r: 5, fill: '#0EB5C6', stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive
              animationDuration={800}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Accesibilidad para lectores de pantalla */}
      <p className="sr-only">
        Línea de tendencia: {validations.length} ideas validadas en las últimas {totalWeeks} semanas.
        {streak >= 2 && ` Racha activa de ${streak} semanas consecutivas.`}
      </p>
    </div>
  );
}
