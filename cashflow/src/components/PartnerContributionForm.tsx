import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import type { PartnerContributionInsert } from '@/lib/cashflow-extra';

// Aporte de Socios — premisa: PRÉSTAMO a la empresa. Trazabilidad de emisor + ref.
const schema = z.object({
  record_date: z.string().min(1, 'Requerida'),
  partner_name: z.string().min(1, 'Indica el socio'),
  amount_clp: z.coerce.number().positive('El monto debe ser mayor a 0'),
  transaction_reference: z.string().max(120).optional(),
  financial_item: z.string().max(120).optional(),
  description: z.string().max(280).optional(),
});

type FormValues = z.input<typeof schema>;
type SubmitValues = Omit<PartnerContributionInsert, 'tenant_id' | 'owner_id'>;

const inputCls =
  'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60';
const labelCls = 'mb-1.5 block text-xs font-medium text-muted-foreground';

export function PartnerContributionForm({ onSubmit }: { onSubmit: (v: SubmitValues) => Promise<void> }) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { record_date: today } });

  const submit = handleSubmit(async (v) => {
    try {
      await onSubmit({
        record_date: v.record_date,
        partner_name: v.partner_name.trim(),
        amount_clp: Number(v.amount_clp),
        transaction_reference: v.transaction_reference?.trim() || null,
        financial_item: v.financial_item?.trim() || null,
        description: v.description?.trim() || null,
      });
      reset({ record_date: today, partner_name: '', amount_clp: undefined, transaction_reference: '', financial_item: '', description: '' });
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'No se pudo guardar' });
    }
  });

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <h3 className="mb-1 font-semibold">Aporte de socio</h3>
      <p className="mb-4 text-xs text-muted-foreground">Inyección de capital (préstamo a la empresa)</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="pc-partner">Socio</label>
          <input id="pc-partner" type="text" placeholder="Ej: Luciano Alonso" className={inputCls} {...register('partner_name')} />
          {errors.partner_name && <p className="mt-1 text-xs text-danger">{errors.partner_name.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-amount">Monto (CLP)</label>
          <input id="pc-amount" type="number" min="0" step="1" placeholder="0" className={inputCls} {...register('amount_clp')} />
          {errors.amount_clp && <p className="mt-1 text-xs text-danger">{errors.amount_clp.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-ref">Referencia de transacción</label>
          <input id="pc-ref" type="text" placeholder="Ej: TRX-00123 / N° transferencia" className={inputCls} {...register('transaction_reference')} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-item">Ítem financiero</label>
          <input id="pc-item" type="text" placeholder="Ej: Capital operativo" className={inputCls} {...register('financial_item')} />
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-date">Fecha</label>
          <input id="pc-date" type="date" className={inputCls} {...register('record_date')} />
          {errors.record_date && <p className="mt-1 text-xs text-danger">{errors.record_date.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="pc-desc">Descripción</label>
          <input id="pc-desc" type="text" placeholder="Opcional" className={inputCls} {...register('description')} />
        </div>
      </div>

      {errors.root && <p role="alert" className="mt-3 text-sm text-danger">{errors.root.message}</p>}

      <div className="mt-4">
        <Button type="submit" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Registrar aporte'}
        </Button>
      </div>
    </form>
  );
}
