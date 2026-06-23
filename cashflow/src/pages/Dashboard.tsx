import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Wallet, LogOut, TrendingDown, Timer, Flame, Landmark, Settings, RotateCcw, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CashflowChart } from '@/components/CashflowChart';
import { InvoiceForm } from '@/components/InvoiceForm';
import { MovementForm } from '@/components/MovementForm';
import { ResolutionCenter } from '@/components/ResolutionCenter';
import { RecurringPanel } from '@/components/RecurringPanel';
import { AccountSetup } from '@/components/AccountSetup';
import { AccountsCard } from '@/components/AccountsCard';
import { InvoicesList } from '@/components/InvoicesList';
import { MovementsList } from '@/components/MovementsList';
import { TenantSettings } from '@/components/TenantSettings';
import { WelcomeTour } from '@/components/WelcomeTour';
import { useCashflow } from '@/hooks/useCashflow';
import { useAuth } from '@/store/auth';
import { signOut } from '@/lib/auth';
import { formatCLP } from '@/lib/utils';
import {
  buildDailyProjection,
  aggregate,
  computeKpis,
  overdueReceivables,
  restrictedTax,
  HORIZON_DAYS,
  type Granularity,
} from '@/lib/projection';

export function Dashboard() {
  const { user } = useAuth();
  const cf = useCashflow();
  const [granularity, setGranularity] = useState<Granularity>('week');
  const [ignored, setIgnored] = useState<Set<string>>(new Set());
  const [showSettings, setShowSettings] = useState(false);
  const [tourOpen, setTourOpen] = useState(() => typeof localStorage !== 'undefined' && !localStorage.getItem('cf_tour_seen'));

  const closeTour = () => {
    setTourOpen(false);
    try { localStorage.setItem('cf_tour_seen', '1'); } catch { /* noop */ }
  };

  const today = useMemo(() => new Date(), []);
  const taxRate = Number(cf.tenant?.default_tax_rate ?? 0);

  const toggleIgnore = (id: string) =>
    setIgnored((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  // Simulador What-If: la proyección excluye los eventos "ocultos".
  const visInvoices = useMemo(() => cf.invoices.filter((i) => !ignored.has(i.id)), [cf.invoices, ignored]);
  const visRecurring = useMemo(() => cf.recurringTransactions.filter((r) => !ignored.has(r.id)), [cf.recurringTransactions, ignored]);

  const daily = useMemo(
    () => buildDailyProjection(cf.currentCash, visInvoices, today, HORIZON_DAYS[granularity], visRecurring, taxRate),
    [cf.currentCash, visInvoices, today, granularity, visRecurring, taxRate],
  );
  const chartData = useMemo(() => aggregate(daily, granularity), [daily, granularity]);
  const kpis = useMemo(
    () => computeKpis(cf.currentCash, cf.transactions, daily, today, visRecurring, taxRate),
    [cf.currentCash, cf.transactions, daily, today, visRecurring, taxRate],
  );
  const restricted = useMemo(
    () => restrictedTax(visInvoices, visRecurring, today, HORIZON_DAYS[granularity], taxRate),
    [visInvoices, visRecurring, today, granularity, taxRate],
  );
  const overdue = useMemo(() => overdueReceivables(visInvoices, today), [visInvoices, today]);

  const runwayLabel =
    kpis.runwayMonths === null ? '∞' : kpis.runwayMonths > 24 ? '> 24 meses' : `${kpis.runwayMonths.toFixed(1)} meses`;
  const hasAccounts = cf.accounts.length > 0;
  const simActive = ignored.size > 0;

  // Wrappers con toast de éxito para los formularios de creación.
  const addInvoice = async (v: Parameters<typeof cf.addInvoice>[0]) => {
    await cf.addInvoice(v);
    toast.success('Factura registrada');
  };
  const addTransaction = async (v: Parameters<typeof cf.addTransaction>[0]) => {
    await cf.addTransaction(v);
    toast.success('Movimiento registrado');
  };
  const addRecurring = async (v: Parameters<typeof cf.addRecurringTransaction>[0]) => {
    await cf.addRecurringTransaction(v);
    toast.success(v.type === 'IN' ? 'Ingreso fijo agregado' : 'Gasto fijo agregado');
  };
  const removeRecurring = async (id: string) => {
    await cf.removeRecurringTransaction(id);
    toast.success('Fijo eliminado');
  };
  const resolveOverdue = async (id: string, patch: { status?: 'PAID' | 'CANCELLED'; due_date?: string }) => {
    await cf.resolveInvoice(id, patch);
    toast.success('Factura actualizada');
  };

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="flex items-center gap-2 font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-primary/15 text-primary">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          Cashflow
        </span>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={() => setTourOpen(true)} aria-label="Tutorial">
            <HelpCircle className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Tutorial</span>
          </Button>
          {cf.tenant && (
            <Button variant="outline" size="sm" onClick={() => setShowSettings(true)} aria-label="Configuración">
              <Settings className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Ajustes</span>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="size-4" aria-hidden="true" />
            Salir
          </Button>
        </div>
      </header>

      <WelcomeTour open={tourOpen} onClose={closeTour} />
      {showSettings && cf.tenant && (
        <TenantSettings tenant={cf.tenant} onSave={cf.updateSettings} onClose={() => setShowSettings(false)} />
      )}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        {cf.error && (
          <p role="alert" className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
            {cf.error}
          </p>
        )}

        {cf.loading ? (
          <DashboardSkeleton />
        ) : !hasAccounts ? (
          <div className="py-10">
            <AccountSetup onCreate={cf.addAccount} />
          </div>
        ) : (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-semibold">
                Hola{user?.user_metadata?.full_name ? `, ${String(user.user_metadata.full_name).split(' ')[0]}` : ''}
              </h1>
              <p className="mt-1 text-muted-foreground">{cf.tenant?.name ?? 'Tu empresa'} · flujo de caja en tiempo real</p>
            </div>

            {/* KPIs */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Kpi label="Caja actual" value={formatCLP(kpis.currentCash)} icon={<Wallet className="size-4" />} tone={kpis.currentCash >= 0 ? 'text-primary' : 'text-danger'} />
              <Kpi label="Burn mensual" value={kpis.monthlyBurn > 0 ? `${formatCLP(kpis.monthlyBurn)}/mes` : 'Sin quema'} icon={<Flame className="size-4" />} tone={kpis.monthlyBurn > 0 ? 'text-danger' : 'text-primary'} />
              <Kpi label="Runway" value={runwayLabel} icon={<Timer className="size-4" />} tone={kpis.runwayMonths !== null && kpis.runwayMonths < 3 ? 'text-danger' : 'text-foreground'} />
              <Kpi label="Saldo mínimo proyectado" value={formatCLP(kpis.lowestBalance)} sub={kpis.lowestDate ?? undefined} icon={<TrendingDown className="size-4" />} tone={kpis.lowestBalance < 0 ? 'text-danger' : 'text-foreground'} />
              <Kpi
                label="Caja Restringida (Impuestos)"
                value={formatCLP(restricted)}
                sub={taxRate > 0 ? `${taxRate}% reservado` : 'Configura tu tasa en Ajustes'}
                icon={<Landmark className="size-4" />}
                tone="text-amber-400"
              />
            </div>

            {/* Simulador activo */}
            {simActive && (
              <div className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-accent/40 bg-accent/10 px-4 py-2.5 text-sm">
                <span className="text-accent">Simulación activa — {ignored.size} evento{ignored.size === 1 ? '' : 's'} oculto{ignored.size === 1 ? '' : 's'} de la proyección.</span>
                <button onClick={() => setIgnored(new Set())} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-muted cursor-pointer">
                  <RotateCcw className="size-3.5" aria-hidden="true" /> Restablecer
                </button>
              </div>
            )}

            {/* Gráfico + cuentas */}
            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
              <CashflowChart
                data={chartData}
                granularity={granularity}
                onGranularityChange={setGranularity}
                lowest={kpis.lowestDate ? { date: kpis.lowestDate, balance: kpis.lowestBalance } : null}
              />
              <AccountsCard accounts={cf.accounts} onAdd={cf.addAccount} onEdit={cf.editAccount} onRemove={cf.removeAccount} />
            </div>

            {overdue.length > 0 && (
              <div className="mt-8">
                <ResolutionCenter overdue={overdue} onResolve={resolveOverdue} />
              </div>
            )}

            <div className="mt-8">
              <RecurringPanel items={cf.recurringTransactions} onAdd={addRecurring} onRemove={removeRecurring} ignoredIds={ignored} onToggleIgnore={toggleIgnore} />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <InvoiceForm onSubmit={addInvoice} onParse={cf.parsePdf} pdfUsed={cf.pdfUsed} pdfLimit={cf.pdfLimit} />
              <MovementForm accounts={cf.accounts} onSubmit={addTransaction} />
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <InvoicesList invoices={cf.invoices} onResolve={cf.resolveInvoice} onDelete={cf.removeInvoice} ignoredIds={ignored} onToggleIgnore={toggleIgnore} />
              <MovementsList transactions={cf.transactions} onDelete={cf.removeTransaction} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Kpi({ label, value, sub, icon, tone }: { label: string; value: string; sub?: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="flex items-center justify-between text-muted-foreground">
        <p className="text-xs">{label}</p>
        {icon}
      </div>
      <p className={`mt-2 text-xl font-semibold ${tone}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function DashboardSkeleton() {
  const sk = 'animate-pulse rounded-xl border border-border bg-card/40';
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Cargando">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <div key={i} className={`${sk} h-24`} />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className={`${sk} h-80`} />
        <div className={`${sk} h-80`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={`${sk} h-56`} />
        <div className={`${sk} h-56`} />
      </div>
    </div>
  );
}
