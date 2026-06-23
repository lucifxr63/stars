import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import type { BankAccount, TxType } from '@/lib/queries';

const schema = z.object({
  account_id: z.string().min(1, 'Selecciona una cuenta'),
  type: z.enum(['IN', 'OUT']),
  amount: z.coerce.number().positive('El monto debe ser mayor a 0'),
  category: z.string().max(80).optional(),
  transaction_date: z.string().min(1, 'Requerida'),
});

type FormValues = z.input<typeof schema>;

const inputCls =
  'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60';
const labelCls = 'mb-1.5 block text-xs font-medium text-muted-foreground';

interface Props {
  accounts: BankAccount[];
  onSubmit: (values: { account_id: string; type: TxType; amount: number; category: string | null; transaction_date: string }) => Promise<void>;
}

export function MovementForm({ accounts, onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'OUT', transaction_date: today, account_id: accounts[0]?.id ?? '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await onSubmit({
        account_id: values.account_id,
        type: values.type as TxType,
        amount: Number(values.amount),
        category: values.category?.trim() ? values.category.trim() : null,
        transaction_date: values.transaction_date,
      });
      reset({ account_id: values.account_id, type: values.type, transaction_date: today, amount: undefined, category: '' });
    } catch (e) {
      setError('root', { message: e instanceof Error ? e.message : 'No se pudo guardar' });
    }
  });

  return (
    <form onSubmit={submit} className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <h3 className="mb-1 font-semibold">Nuevo movimiento</h3>
      <p className="mb-4 text-xs text-muted-foreground">Ingreso o egreso de caja real</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls} htmlFor="mv-account">Cuenta</label>
          <select id="mv-account" className={inputCls} {...register('account_id')}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          {errors.account_id && <p className="mt-1 text-xs text-danger">{errors.account_id.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="mv-type">Tipo</label>
          <select id="mv-type" className={inputCls} {...register('type')}>
            <option value="OUT">Egreso</option>
            <option value="IN">Ingreso</option>
          </select>
        </div>
        <div>
          <label className={labelCls} htmlFor="mv-amount">Monto (CLP)</label>
          <input id="mv-amount" type="number" min="0" step="1" placeholder="0" className={inputCls} {...register('amount')} />
          {errors.amount && <p className="mt-1 text-xs text-danger">{errors.amount.message}</p>}
        </div>
        <div>
          <label className={labelCls} htmlFor="mv-cat">Categoría (opcional)</label>
          <input id="mv-cat" type="text" placeholder="Ej: Nómina" className={inputCls} {...register('category')} />
        </div>
        <div>
          <label className={labelCls} htmlFor="mv-date">Fecha</label>
          <input id="mv-date" type="date" className={inputCls} {...register('transaction_date')} />
        </div>
      </div>

      {errors.root && <p role="alert" className="mt-3 text-sm text-danger">{errors.root.message}</p>}

      <div className="mt-4">
        <Button type="submit" variant="outline" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando…' : 'Registrar movimiento'}
        </Button>
      </div>
    </form>
  );
}
