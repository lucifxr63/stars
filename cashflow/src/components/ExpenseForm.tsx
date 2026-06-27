import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { formatCLP } from '@/lib/utils';
import type { ExpenseInsert } from '@/lib/cashflow-extra';
import type { VatStatus } from '@/types/cashflow';

// Gasto operacional — captura la FUENTE de fondeo + IVA configurable (sin 19% rígido).
const schema = z.object({
  record_date: z.string().min(1, 'Requerida'),
  funded_by: z.enum(['COMPANY', 'PARTNER']),
  category: z.string().max(80).optional(),
  provider: z.string().max(120).optional(),
  description: z.string().max(280).optional(),
  net_amount: z.coerce.number().nonnegative('No puede ser negativo'),
  vat_status: z.enum(['AFECTO', 'EXENTO']),
  vat_amount: z.coerce.number().nonnegative('No puede ser negativo').optional(),
});

type FormValues = z.input<typeof schema>;
type SubmitValues = Omit<ExpenseInsert, 'tenant_id' | 'owner_id'>;

const inputCls =
  'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60';
const labelCls = 'mb-1.5 block text-xs font-medium text-muted-foreground';

export function ExpenseForm({ onSubmit }: { onSubmit: (v: SubmitValues) => Promise<void> }) {
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
    defaultValues: { record_date: today, funded_by: 'COMPANY', vat_status: 'EXENTO', net_amount: undefined, vat_amount: 0 },
  });

  const vatStatus = watch('vat_status');
  const net = Number(watch('net_amount')) || 0;
  const vat = vatStatus === 'AFECTO' ? Number(watch('vat_amount')) || 0 : 0;
  const total = net + vat;

  const setVat = (s: VatStatus) => {
    setValue('vat_status', s);
    if (s === 'EXENTO') setValue('vat_amount', 0);
  };

  const submit = handleSubmit(async (v) => {
    try {
      const vatAmount = v.vat_status === 'AFECTO' ? Number(v.vat_amount) || 0 : 0;
      const netAmount = Number(v.net_amount);
      await onSubmit({
        record_date: v.record_date,
        funded_by: v.funded_by,
        category: v.category?.trim() || null,
        provider: v.provider?.trim() || null,
        description: v.description?.trim() || null,
        net_amount: netAmount,
        vat_status: v.vat_status,
        vat_amount: vatAmount,
        total_amount: netAmount + vatAmount,
      });
      reset({ record_date: today, funded_by: v.funded_by, vat_status: 'EXENTO', net_amount: undefined, vat_amount: 0, category: '', provider: '', description: '' });
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'No se pudo guardar' });
    }
  });

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <h3 className="mb-1 font-semibold">Gasto operacional</h3>
      <p className="mb-4 text-xs text-muted-foreground">Egreso con fuente de fondeo e IVA configurable</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="ex-funded">Fuente de fondeo</label>
          <select id="ex-funded" className={inputCls} {...register('funded_by')}>
            <option value="COMPANY">Cuenta Empresa</option>
            <option value="PARTNER">Aporte de Socios</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="ex-cat">Categoría</label>
          <input id="ex-cat" type="text" placeholder="Ej: COGS Servidores" className={inputCls} {...register('category')} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ex-provider">Proveedor</label>
          <input id="ex-provider" type="text" placeholder="Ej: AWS" className={inputCls} {...register('provider')} />
        </div>
        <div>
          <label className={labelCls} htmlFor="ex-date">Fecha</label>
          <input id="ex-date" type="date" className={inputCls} {...register('record_date')} />
          {errors.record_date && <p className="mt-1 text-xs text-danger">{errors.record_date.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="ex-net">Neto (CLP)</label>
          <input id="ex-net" type="number" min="0" step="1" placeholder="0" className={inputCls} {...register('net_amount')} />
          {errors.net_amount && <p className="mt-1 text-xs text-danger">{errors.net_amount.message}</p>}
        </div>

        {/* IVA configurable — toggle Afecto / Exento (sin 19% automático) */}
        <div>
          <span className={labelCls}>IVA</span>
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
                {s === 'EXENTO' ? 'Exento' : 'Afecto'}
              </button>
            ))}
          </div>
        </div>

        {vatStatus === 'AFECTO' && (
          <div className="sm:col-span-2">
            <label className={labelCls} htmlFor="ex-vat">Monto IVA (CLP)</label>
            <input id="ex-vat" type="number" min="0" step="1" placeholder="0" className={inputCls} {...register('vat_amount')} />
            {errors.vat_amount && <p className="mt-1 text-xs text-danger">{errors.vat_amount.message}</p>}
          </div>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-background/60 px-4 py-2.5 text-sm">
        <span className="text-muted-foreground">Total</span>
        <span className="font-semibold">{formatCLP(total)}</span>
      </div>

      {errors.root && <p role="alert" className="mt-3 text-sm text-danger">{errors.root.message}</p>}

      <div className="mt-4">
        <Button type="submit" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Registrar gasto'}
        </Button>
      </div>
    </form>
  );
}
