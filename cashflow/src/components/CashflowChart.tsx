import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, CartesianGrid } from 'recharts';
import type { ProjectionPoint, Granularity } from '@/lib/projection';
import { formatCLP, formatCLPShort } from '@/lib/utils';

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
                <stop offset={zeroOffset} stopColor="#10b981" stopOpacity={0.35} />
                <stop offset={zeroOffset} stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#f43f5e" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="balStroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset={zeroOffset} stopColor="#10b981" />
                <stop offset={zeroOffset} stopColor="#f43f5e" />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => fmtTick(v, granularity)}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              stroke="#1e293b"
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v) => formatCLPShort(Number(v))}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              stroke="#1e293b"
              width={56}
            />
            <Tooltip
              contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: '#94a3b8' }}
              formatter={(v) => [formatCLP(Number(v)), 'Saldo']}
              labelFormatter={(l) => new Date(l + 'T00:00:00').toLocaleDateString('es-CL')}
            />
            <ReferenceLine y={0} stroke="#f43f5e" strokeDasharray="4 4" />
            <Area type="monotone" dataKey="balance" stroke="url(#balStroke)" strokeWidth={2} fill="url(#balFill)" />
            {markLowest && (
              <ReferenceDot
                x={lowest!.date}
                y={lowest!.balance}
                r={4}
                fill="#f43f5e"
                stroke="#0b1120"
                strokeWidth={2}
                label={{ value: 'mínimo', position: 'bottom', fill: '#f43f5e', fontSize: 10 }}
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
