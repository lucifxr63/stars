import { useState } from 'react';
import { toast } from 'sonner';
import { Repeat, Plus, Trash2, ArrowUpRight, ArrowDownRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCLP } from '@/lib/utils';
import { monthlyEquivalent } from '@/lib/projection';
import { useConfirm } from '@/components/ui/confirm';
import type { RecurringTransaction, Frequency, TxType } from '@/lib/queries';

const FREQ_LABEL: Record<Frequency, string> = {
  WEEKLY: 'Semanal',
  MONTHLY: 'Mensual',
  QUARTERLY: 'Trimestral',
  YEARLY: 'Anual',
};

interface Props {
  items: RecurringTransaction[];
  onAdd: (input: { type: TxType; name: string; amount: number; frequency: Frequency; next_date: string }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  ignoredIds?: Set<string>;
  onToggleIgnore?: (id: string) => void;
}

const inputCls =
  'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60';

export function RecurringPanel({ items, onAdd, onRemove, ignoredIds, onToggleIgnore }: Props) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<TxType>('OUT');
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Frequency>('MONTHLY');
  const [nextDate, setNextDate] = useState(new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const incomes = items.filter((i) => i.type === 'IN');
  const expenses = items.filter((i) => i.type === 'OUT');
  const monthlyIncome = incomes.reduce((s, x) => s + monthlyEquivalent(x), 0);
  const monthlyExpense = expenses.reduce((s, x) => s + monthlyEquivalent(x), 0);
  const net = monthlyIncome - monthlyExpense;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!name.trim() || !(Number(amount) > 0)) {
      setErr('Indica nombre y monto válido.');
      return;
    }
    setBusy(true);
    try {
      await onAdd({ type, name: name.trim(), amount: Number(amount), frequency, next_date: nextDate });
      setName('');
      setAmount('');
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo crear');
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: RecurringTransaction) {
    if (!(await confirm({ title: '¿Eliminar fijo?', message: `${item.name} · ${formatCLP(Number(item.amount))}`, danger: true, confirmLabel: 'Eliminar' }))) return;
    try {
      await onRemove(item.id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  const column = (title: string, list: RecurringTransaction[], income: boolean) => (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {income ? <ArrowUpRight className="size-3.5 text-primary" aria-hidden="true" /> : <ArrowDownRight className="size-3.5 text-danger" aria-hidden="true" />}
        {title}
      </p>
      {list.length === 0 ? (
        <p className="text-xs text-muted-foreground">—</p>
      ) : (
        <ul className="space-y-1.5">
          {list.map((x) => {
            const hidden = ignoredIds?.has(x.id);
            return (
            <li key={x.id} className={`group flex items-center justify-between gap-2 rounded-lg border border-border bg-card/40 px-3 py-2 ${hidden ? 'opacity-40' : ''}`}>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{x.name}</span>
                <span className="text-xs text-muted-foreground">{FREQ_LABEL[x.frequency as Frequency]} · próx. {x.next_date}</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className={`text-sm font-semibold ${income ? 'text-primary' : 'text-danger'}`}>
                  {income ? '+' : '-'}{formatCLP(Number(x.amount))}
                </span>
                {onToggleIgnore && (
                  <button
                    onClick={() => onToggleIgnore(x.id)}
                    className={`grid size-7 place-items-center rounded-md cursor-pointer transition-all hover:bg-muted ${hidden ? 'text-accent' : 'text-muted-foreground opacity-0 group-hover:opacity-100'}`}
                    title={hidden ? 'Incluir en la proyección' : 'Excluir (simular)'}
                    aria-label="Excluir de la proyección"
                  >
                    {hidden ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                )}
                <button
                  onClick={() => remove(x)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-danger group-hover:opacity-100 cursor-pointer"
                  aria-label={`Eliminar ${x.name}`}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </span>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="mb-1 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Repeat className="size-5 text-accent" aria-hidden="true" />
          <h3 className="font-semibold">Piloto Automático (Fijos)</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          <Plus className="size-4" aria-hidden="true" />
          Nuevo fijo
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Reglas de proyección (no ensucian la BD). Neto mensual fijo:{' '}
        <span className={`font-semibold ${net >= 0 ? 'text-primary' : 'text-danger'}`}>{net >= 0 ? '+' : ''}{formatCLP(net)}</span>
      </p>

      {open && (
        <form onSubmit={submit} className="mb-4 space-y-3 rounded-lg border border-border bg-background/40 p-4">
          <div className="flex rounded-lg border border-border p-0.5 text-sm">
            <button type="button" onClick={() => setType('IN')} className={`flex-1 rounded-md py-1.5 font-medium transition-colors cursor-pointer ${type === 'IN' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
              Ingreso fijo
            </button>
            <button type="button" onClick={() => setType('OUT')} className={`flex-1 rounded-md py-1.5 font-medium transition-colors cursor-pointer ${type === 'OUT' ? 'bg-danger/15 text-danger' : 'text-muted-foreground'}`}>
              Gasto fijo
            </button>
          </div>
          <input className={inputCls} placeholder={type === 'IN' ? 'Nombre (ej: Iguala Cliente X, MRR)' : 'Nombre (ej: Nómina, Arriendo, AWS)'} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" />
          <div className="grid grid-cols-2 gap-3">
            <input className={inputCls} type="number" min="0" step="1" placeholder="Monto" value={amount} onChange={(e) => setAmount(e.target.value)} aria-label="Monto" />
            <select className={inputCls} value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)} aria-label="Frecuencia">
              {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
                <option key={f} value={f}>{FREQ_LABEL[f]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="rec-next">Próxima ocurrencia</label>
            <input id="rec-next" className={inputCls} type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
          </div>
          {err && <p className="text-xs text-danger">{err}</p>}
          <Button type="submit" size="sm" disabled={busy} className="w-full">
            {busy ? 'Guardando…' : type === 'IN' ? 'Agregar ingreso fijo' : 'Agregar gasto fijo'}
          </Button>
        </form>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin fijos. Carga tus ingresos (igualas, MRR) y gastos (nómina, arriendo) una vez y el motor los proyecta a 90 días.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {column('Ingresos fijos', incomes, true)}
          {column('Gastos fijos', expenses, false)}
        </div>
      )}
    </div>
  );
}
