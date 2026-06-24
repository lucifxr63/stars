import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { CashflowAnalyticsPanel } from '@/components/CashflowAnalyticsPanel';
import { PartnerContributionForm } from '@/components/PartnerContributionForm';
import { ExpenseForm } from '@/components/ExpenseForm';
import { RevenueForm } from '@/components/RevenueForm';
import { useCashflowExtra } from '@/hooks/useCashflowExtra';
import { getDefaultTenant } from '@/lib/queries';
import { formatCLP } from '@/lib/utils';
import type { Tenant } from '@/lib/queries';

// DRAFT (Opción B). Página del lente "SaaS" (aportes / gastos / ingresos SaaS).
// Aislada del Dashboard PRD para no tocar la pantalla viva. Ruta: /saas.
export function SaasCashflow() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const cf = useCashflowExtra(tenant?.id ?? null);

  useEffect(() => {
    getDefaultTenant().then(setTenant).catch(() => setTenant(null));
  }, []);

  const addContribution = async (v: Parameters<typeof cf.addContribution>[0]) => {
    await cf.addContribution(v); toast.success('Aporte registrado');
  };
  const addExpense = async (v: Parameters<typeof cf.addExpense>[0]) => {
    await cf.addExpense(v); toast.success('Gasto registrado');
  };
  const addRevenue = async (v: Parameters<typeof cf.addRevenue>[0]) => {
    await cf.addRevenue(v); toast.success('Ingreso registrado');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/80 px-6 py-4 backdrop-blur">
        <span className="flex items-center gap-2.5 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Building2 className="size-5" aria-hidden="true" />
          </span>
          <span className="font-display text-lg font-bold">Cashflow · SaaS</span>
        </span>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <Link
            to="/dashboard"
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-transparent px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold tracking-tight">Control financiero SaaS</h1>
          <p className="mt-1 text-muted-foreground">{tenant?.name ?? 'Tu empresa'} · aportes, gastos e ingresos</p>
        </div>

        {cf.error && (
          <p role="alert" className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {cf.error}
          </p>
        )}

        <CashflowAnalyticsPanel tenantId={tenant?.id ?? null} />

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <RevenueForm onSubmit={addRevenue} />
          <ExpenseForm onSubmit={addExpense} />
        </div>
        <div className="mt-6">
          <PartnerContributionForm onSubmit={addContribution} />
        </div>

        {/* Detalle de ingresos: bruto/comisión expuestos como desglose */}
        <section className="mt-8">
          <h2 className="mb-3 font-semibold">Detalle de ingresos</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-card/60">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-4 py-2.5 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2.5 text-left font-medium">Plan</th>
                  <th className="px-4 py-2.5 text-right font-medium">Bruto USD</th>
                  <th className="px-4 py-2.5 text-right font-medium">Bruto CLP</th>
                  <th className="px-4 py-2.5 text-right font-medium">Comisión</th>
                  <th className="px-4 py-2.5 text-right font-medium">Neto CLP</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {cf.revenues.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">Aún no hay ingresos registrados.</td></tr>
                ) : (
                  cf.revenues.map((r) => (
                    <tr key={r.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2.5">{r.record_date}</td>
                      <td className="px-4 py-2.5">{r.plan_name ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">${r.gross_amount_usd.toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCLP(r.gross_amount_clp)}</td>
                      <td className="px-4 py-2.5 text-right text-muted-foreground">{formatCLP(r.gateway_commission)}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-primary">{formatCLP(r.net_income_clp)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => cf.removeRevenue(r.id).then(() => toast.success('Ingreso eliminado'))}
                          className="text-muted-foreground hover:text-danger cursor-pointer"
                          aria-label="Eliminar"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
