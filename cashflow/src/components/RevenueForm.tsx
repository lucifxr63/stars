import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { formatCLP } from '@/lib/utils';
import type { RevenueInsert } from '@/lib/cashflow-extra';
import type { VatStatus } from '@/types/cashflow';

// Ingreso SaaS — conciliación USD→CLP de la pasarela (Lemon Squeezy).
// net_income_clp = bruto CLP − comisión = lo que ENTRA a caja (KPI principal).
// El bruto y la comisión quedan como desglose secundario.
const schema = z.object({
  record_date: z.string().min(1, 'Requerida'),
  client_name: z.string().max(120).optional(),
  plan_name: z.string().max(80).optional(),
  gross_amount_usd: z.coerce.number().nonnegative('No puede ser negativo'),
  exchange_rate: z.coerce.number().nonnegative('No puede ser negativo'),
  gateway_commission: z.coerce.number().nonnegative('No puede ser negativo'),
  vat_status: z.enum(['AFECTO', 'EXENTO']),
  vat_amount: z.coerce.number().nonnegative('No puede ser negativo').optional(),
});

type FormValues = z.input<typeof schema>;
type SubmitValues = Omit<RevenueInsert, 'tenant_id' | 'owner_id'>;

const inputCls =
  'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60';
const labelCls = 'mb-1.5 block text-xs font-medium text-muted-foreground';

export function RevenueForm({ onSubmit }: { onSubmit: (v: SubmitValues) => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { record_date: today, vat_status: 'EXENTO', gross_amount_usd: undefined, exchange_rate: undefined, gateway_commission: 0, vat_amount: 0 },
  });

  const vatStatus = watch('vat_status');
  const usd = Number(watch('gross_amount_usd')) || 0;
  const rate = Number(watch('exchange_rate')) || 0;
  const commission = Number(watch('gateway_commission')) || 0;
  const grossClp = Math.round(usd * rate * 100) / 100;
  const netClp = Math.round((grossClp - commission) * 100) / 100;

  const setVat = (s: VatStatus) => {
    setValue('vat_status', s);
    if (s === 'EXENTO') setValue('vat_amount', 0);
  };

  const submit = handleSubmit(async (v) => {
    try {
      const gUsd = Number(v.gross_amount_usd);
      const xrate = Number(v.exchange_rate);
      const comm = Number(v.gateway_commission) || 0;
      const gClp = Math.round(gUsd * xrate * 100) / 100;
      const nClp = Math.round((gClp - comm) * 100) / 100;
      await onSubmit({
        record_date: v.record_date,
        client_name: v.client_name?.trim() || null,
        plan_name: v.plan_name?.trim() || null,
        gross_amount_usd: gUsd,
        exchange_rate: xrate,
        gross_amount_clp: gClp,
        gateway_commission: comm,
        net_income_clp: nClp < 0 ? 0 : nClp,
        vat_status: v.vat_status,
        vat_amount: v.vat_status === 'AFECTO' ? Number(v.vat_amount) || 0 : 0,
      });
      reset({ record_date: today, vat_status: 'EXENTO', gross_amount_usd: undefined, exchange_rate: undefined, gateway_commission: 0, vat_amount: 0, client_name: '', plan_name: '' });
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'No se pudo guardar' });
    }
  });

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <h3 className="mb-1 font-semibold">Ingreso SaaS</h3>
      <p className="mb-4 text-xs text-muted-foreground">Conciliación USD→CLP de la pasarela, comisión e IVA</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="rv-client">Cliente</label>
          <input id="rv-client" type="text" placeholder="Opcional" className={inputCls} {...register('client_name')} />
        </div>
        <div>
          <label className={labelCls} htmlFor="rv-plan">Plan</label>
          <input id="rv-plan" type="text" placeholder="Ej: Plan Basic" className={inputCls} {...register('plan_name')} />
        </div>
        <div>
          <label className={labelCls} htmlFor="rv-usd">Bruto (USD)</label>
          <input id="rv-usd" type="number" min="0" step="0.01" placeholder="0.00" className={inputCls} {...register('gross_amount_usd')} />
          {errors.gross_amount_usd && <p className="mt-1 text-xs text-danger">{errors.gross_amount_usd.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="rv-rate">Tipo de cambio (USD→CLP)</label>
          <input id="rv-rate" type="number" min="0" step="0.0001" placeholder="0" className={inputCls} {...register('exchange_rate')} />
          {errors.exchange_rate && <p className="mt-1 text-xs text-danger">{errors.exchange_rate.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="rv-comm">Comisión pasarela (CLP)</label>
          <input id="rv-comm" type="number" min="0" step="1" placeholder="0" className={inputCls} {...register('gateway_commission')} />
          {errors.gateway_commission && <p className="mt-1 text-xs text-danger">{errors.gateway_commission.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="rv-date">Fecha</label>
          <input id="rv-date" type="date" className={inputCls} {...register('record_date')} />
          {errors.record_date && <p className="mt-1 text-xs text-danger">{errors.record_date.message}</p>}
        </div>

        {/* IVA configurable — toggle Afecto / Exento */}
        <div className="sm:col-span-2">
          <span className={labelCls}>IVA Débito</span>
          <div className="flex rounded-lg border border-border p-0.5">
            {(['EXENTO', 'AFECTO'] as VatStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setVat(s)}
                className={`flex-1 rounded-md px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                  vatStatus === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'EXENTO' ? 'Exento (ej: servicio exportado)' : 'Afecto'}
              </button>
            ))}
          </div>
        </div>
        {vatStatus === 'AFECTO' && (
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="rv-vat">Monto IVA (CLP)</label>
            <input id="rv-vat" type="number" min="0" step="1" placeholder="0" className={inputCls} {...register('vat_amount')} />
            {errors.vat_amount && <p className="mt-1 text-xs text-danger">{errors.vat_amount.message}</p>}
          </div>
        )}
      </div>

      {/* Desglose: bruto/comisión secundarios; el neto es el indicador real de caja */}
      <div className="mt-4 space-y-1.5 rounded-lg border border-border bg-background/60 px-4 py-3 text-sm">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Bruto CLP (USD × TC)</span><span>{formatCLP(grossClp)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>− Comisión pasarela</span><span>{formatCLP(commission)}</span>
        </div>
        <div className="flex items-center justify-between border-t border-border pt-1.5 font-semibold text-primary">
          <span>Ingreso neto (a caja)</span><span>{formatCLP(netClp < 0 ? 0 : netClp)}</span>
        </div>
      </div>

      {errors.root && <p role="alert" className="mt-3 text-sm text-danger">{errors.root.message}</p>}

      <div className="mt-4">
        <Button type="submit" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Registrar ingreso'}
        </Button>
      </div>
    </form>
  );
}
