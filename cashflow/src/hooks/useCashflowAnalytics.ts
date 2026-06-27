import { useCallback, useEffect, useState } from 'react';
import { getCashflowAnalytics } from '@/lib/cashflow-extra';
import type { CashflowAnalytics } from '@/types/cashflow';

// DRAFT (Opción B). Hook de conexión a la Edge Function cashflow-analytics.
// La función devuelve UN período; para el ComposedChart (barras por mes + línea
// de saldo acumulado) pedimos los últimos `months` períodos en paralelo y
// armamos la serie. tenant_id queda inyectado desde el caller.

// Punto de la serie que consume el ComposedChart.
export interface AnalyticsSeriesPoint {
  period: string;            // YYYY-MM
  ingresos: number;          // total_revenues (net_income_clp)
  egresos: number;           // total_expenses
  aportes: number;           // partner_contributions
  saldoAcumulado: number;    // final_accumulated_balance
}

// Genera los últimos `count` períodos YYYY-MM, del más antiguo al más reciente.
export function lastPeriods(count: number, ref = new Date()): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return out;
}

interface State {
  series: AnalyticsSeriesPoint[];
  latest: CashflowAnalytics | null; // período más reciente (para breakdown/detalle)
  loading: boolean;
  error: string | null;
}

export function useCashflowAnalytics(tenantId: string | null, months = 6) {
  const [state, setState] = useState<State>({ series: [], latest: null, loading: false, error: null });

  const reload = useCallback(async () => {
    if (!tenantId) return;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const periods = lastPeriods(months);
      const results = await Promise.all(periods.map((p) => getCashflowAnalytics(tenantId, p)));
      const series: AnalyticsSeriesPoint[] = results.map((r) => ({
        period: r.period,
        ingresos: r.metrics.total_revenues,
        egresos: r.metrics.total_expenses,
        aportes: r.metrics.partner_contributions,
        saldoAcumulado: r.metrics.final_accumulated_balance,
      }));
      setState({ series, latest: results[results.length - 1] ?? null, loading: false, error: null });
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Error cargando analítica' }));
    }
  }, [tenantId, months]);

  useEffect(() => { void reload(); }, [reload]);

  return { ...state, reload };
}
