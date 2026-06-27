// Tipos permanentes del lente SaaS de cashflow que NO derivan de una tabla:
//   - uniones de literales para los toggles de UI (la DB los guarda como text)
//   - contrato JSON de la Edge Function cashflow-analytics
// Las filas/inserts de tablas viven en database.types.ts (generado) y se
// re-exportan desde @/lib/cashflow-extra.

export type VatStatus = 'AFECTO' | 'EXENTO';
export type FundedBy = 'COMPANY' | 'PARTNER';

export interface AnalyticsBreakdownItem {
  category: string;
  amount: number;
}

export interface CashflowAnalytics {
  tenant_id: string;
  period: string; // YYYY-MM
  currency: 'CLP';
  metrics: {
    initial_balance: number;
    total_revenues: number;
    total_expenses: number;
    net_monthly_flow: number;
    partner_contributions: number;
    final_accumulated_balance: number;
  };
  breakdown: {
    revenues: AnalyticsBreakdownItem[];
    expenses: AnalyticsBreakdownItem[];
  };
}
