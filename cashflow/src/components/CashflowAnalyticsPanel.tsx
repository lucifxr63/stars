import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, ReferenceLine,
} from 'recharts';
import { formatCLP, formatCLPShort } from '@/lib/utils';
import { useCashflowAnalytics } from '@/hooks/useCashflowAnalytics';
import { useTheme } from '@/store/theme';

// Hero del dashboard SaaS (decisión Mesa Directiva): ComposedChart unificado —
// barras agrupadas Ingresos (net_income_clp) vs Egresos + línea de saldo
// acumulado. El bruto/comisión NO entran al KPI; viven en el detalle de ingresos.

function monthLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-CL', { month: 'short' });
}

export function CashflowAnalyticsPanel({ tenantId, months = 6 }: { tenantId: string | null; months?: number }) {
  const { series, latest, loading, error, reload } = useCashflowAnalytics(tenantId, months);
  const m = latest?.metrics;

  // Paleta del gráfico según el tema (recharts no consume utilidades de Tailwind).
  const dark = useTheme((s) => s.resolved === 'dark');
  const C = dark
    ? { ingresos: '#10b981', egresos: '#f43f5e', saldo: '#38bdf8', grid: '#1e293b', axis: '#94a3b8', surface: '#0f172a', zero: '#334155' }
    : { ingresos: '#059669', egresos: '#e11d48', saldo: '#0284c7', grid: '#e2e8f0', axis: '#64748b', surface: '#ffffff', zero: '#cbd5e1' };

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Flujo de caja mensual</h2>
          <p className="text-xs text-muted-foreground">
            Ingresos netos vs egresos · últimos {months} meses {latest ? `· ${latest.period}` : ''}
          </p>
        </div>
        <button
          onClick={() => void reload()}
          className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted cursor-pointer"
        >
          Actualizar
        </button>
      </div>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {/* KPIs del período más reciente */}
      {m && (
        <div className="mb-5 grid gap-3 sm:grid-cols-4">
          <Metric label="Ingresos netos" value={formatCLP(m.total_revenues)} tone="text-primary" />
          <Metric label="Egresos" value={formatCLP(m.total_expenses)} tone="text-danger" />
          <Metric label="Aportes de socios" value={formatCLP(m.partner_contributions)} tone="text-foreground" />
          <Metric label="Saldo acumulado" value={formatCLP(m.final_accumulated_balance)} tone="text-sky-600 dark:text-sky-400" />
        </div>
      )}

      <div className="h-80 w-full">
        {loading && series.length === 0 ? (
          <div className="size-full animate-pulse rounded-xl border border-border bg-card/40" aria-busy="true" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.grid} vertical={false} />
              <XAxis
                dataKey="period"
                tickFormatter={monthLabel}
                tick={{ fill: C.axis, fontSize: 11 }}
                stroke={C.grid}
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
                labelFormatter={(l) => monthLabel(String(l))}
                formatter={(value, name) => [formatCLP(Number(value)), name as string]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke={C.zero} />
              <Bar dataKey="ingresos" name="Ingresos netos" fill={C.ingresos} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Bar dataKey="egresos" name="Egresos" fill={C.egresos} radius={[3, 3, 0, 0]} maxBarSize={28} />
              <Line type="monotone" dataKey="saldoAcumulado" name="Saldo acumulado" stroke={C.saldo} strokeWidth={2} dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Desglose secundario del período: ingresos por plan / gastos por categoría */}
      {latest && (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Breakdown title="Ingresos por plan (neto)" items={latest.breakdown.revenues} tone="text-primary" />
          <Breakdown title="Gastos por categoría" items={latest.breakdown.expenses} tone="text-danger" />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

function Breakdown({ title, items, tone }: { title: string; items: { category: string; amount: number }[]; tone: string }) {
  const visible = items.filter((i) => i.amount !== 0);
  return (
    <div className="rounded-xl border border-border bg-background/60 p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      {visible.length === 0 ? (
        <p className="text-xs text-muted-foreground">Sin registros en el período.</p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((i) => (
            <li key={i.category} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{i.category}</span>
              <span className={`font-medium ${tone}`}>{formatCLP(i.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
