import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowUpRight, ArrowDownRight, Trash2 } from 'lucide-react';
import { formatCLP } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm';
import type { Transaction } from '@/lib/queries';

interface Props {
  transactions: Transaction[];
  onDelete: (id: string) => Promise<void>;
}

export function MovementsList({ transactions, onDelete }: Props) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const recent = transactions.slice(0, 8);

  async function handleDelete(tx: Transaction) {
    const label = tx.category || (tx.type === 'IN' ? 'Ingreso' : 'Egreso');
    if (!(await confirm({ title: '¿Eliminar movimiento?', message: `${label} · ${formatCLP(Number(tx.amount))}`, danger: true, confirmLabel: 'Eliminar' }))) return;
    setBusy(tx.id);
    try {
      await onDelete(tx.id);
      toast.success('Movimiento eliminado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Movimientos recientes</h3>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aún no hay movimientos.</p>
      ) : (
        <ul className="space-y-1.5">
          {recent.map((tx) => {
            const income = tx.type === 'IN';
            return (
              <li key={tx.id} className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={`grid size-7 shrink-0 place-items-center rounded-md ${income ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'}`}>
                    {income ? <ArrowUpRight className="size-4" aria-hidden="true" /> : <ArrowDownRight className="size-4" aria-hidden="true" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{tx.category || (income ? 'Ingreso' : 'Egreso')}</span>
                    <span className="text-xs text-muted-foreground">{tx.transaction_date}</span>
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${income ? 'text-primary' : 'text-danger'}`}>
                    {income ? '+' : '-'}{formatCLP(Number(tx.amount))}
                  </span>
                  <button
                    onClick={() => handleDelete(tx)}
                    disabled={busy === tx.id}
                    className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-danger group-hover:opacity-100 cursor-pointer disabled:opacity-50"
                    aria-label="Eliminar movimiento"
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
}
