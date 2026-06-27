import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, CartesianGrid } from 'recharts';
import type { ProjectionPoint, Granularity } from '@/lib/projection';
import { formatCLP, formatCLPShort } from '@/lib/utils';
import { useTheme } from '@/store/theme';

const TABS: { key: Granularity; label: string }[] = [
  { key: 'day', label: 'Diaria' },
  { key: 'week', label: 'Semanal' },
  { key: 'month', label: 'Mensual' },
];

function fmtTick(iso: string, g: Granularity): string {
  const d = new Date(iso + 'T00:00:00');
  if (g === 'month') return d.toLocaleDateString('es-CL', { month: 'short' });
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' });
}

interface Props {
  data: ProjectionPoint[];
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  lowest?: { date: string; balance: number } | null;
}

export function CashflowChart({ data, granularity, onGranularityChange, lowest }: Props) {
  // Offset del degradado en el cruce por cero: verde arriba, rojo abajo.
  const max = Math.max(0, ...data.map((d) => d.balance));
  const min = Math.min(0, ...data.map((d) => d.balance));
  const zeroOffset = max - min === 0 ? 0 : max / (max - min);
  const markLowest = lowest && lowest.balance < 0 && data.some((d) => d.date === lowest.date);

  // Paleta del gráfico según el tema (recharts no consume utilidades de Tailwind).
  const dark = useTheme((s) => s.resolved === 'dark');
  const C = dark
    ? { pos: '#10b981', neg: '#f43f5e', grid: '#1e293b', axis: '#94a3b8', surface: '#0f172a', bg: '#0b1120' }
    : { pos: '#059669', neg: '#e11d48', grid: '#e2e8f0', axis: '#64748b', surface: '#ffffff', bg: '#f8fafc' };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Proyección de caja</h2>
          <p className="text-xs text-muted-foreground">
            {granularity === 'week' ? '12 semanas (90 días)' : granularity === 'day' ? 'Próximos 30 días' : 'Próximos 12 meses'}
          </p>
        </div>
        <div className="flex rounded-lg border border-border p-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => onGranularityChange(t.key)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
                granularity === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="balFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zeroOffset} stopColor={C.pos} stopOpacity={0.35} />
                <stop offset={zeroOffset} stopColor={C.neg} stopOpacity={0.25} />
                <stop offset="100%" stopColor={C.neg} stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="balStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zeroOffset} stopColor={C.pos} />
                <stop offset={zeroOffset} stopColor={C.neg} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => fmtTick(v, granularity)}
              tick={{ fill: C.axis, fontSize: 11 }}
              stroke={C.grid}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v) => formatCLPShort(Number(v))}
              tick={{ fill: C.axis, fontSize: 11 }}
              stroke={C.grid}
              width={56}
            />
            <Tooltip
              contentStyle={{ background: C.surface, border: `1px solid ${C.grid}`, borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: C.axis }}
              formatter={(v) => [formatCLP(Number(v)), 'Saldo']}
              labelFormatter={(l) => new Date(l + 'T00:00:00').toLocaleDateString('es-CL')}
            />
            <ReferenceLine y={0} stroke={C.neg} strokeDasharray="4 4" />
            <Area type="monotone" dataKey="balance" stroke="url(#balStroke)" strokeWidth={2} fill="url(#balFill)" />
            {markLowest && (
              <ReferenceDot
                x={lowest!.date}
                y={lowest!.balance}
                r={4}
                fill={C.neg}
                stroke={C.bg}
                strokeWidth={2}
                label={{ value: 'mínimo', position: 'bottom', fill: C.neg, fontSize: 10 }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {markLowest && (
        <p className="mt-2 text-xs text-danger">
          ⚠ Tu saldo proyectado cae a {formatCLP(lowest!.balance)} el {lowest!.date}.
        </p>
      )}
    </div>
  );
}
