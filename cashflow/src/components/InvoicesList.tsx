import { useState } from 'react';
import { toast } from 'sonner';
import { Check, XCircle, Trash2, Eye, EyeOff } from 'lucide-react';
import { formatCLP } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm';
import type { Invoice } from '@/lib/queries';

interface Props {
  invoices: Invoice[];
  onResolve: (id: string, patch: { status?: 'PAID' | 'CANCELLED' }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  ignoredIds?: Set<string>;
  onToggleIgnore?: (id: string) => void;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING: 'bg-amber-500/15 text-amber-400',
  PAID: 'bg-primary/15 text-primary',
  CANCELLED: 'bg-muted text-muted-foreground line-through',
};
const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendiente', PAID: 'Pagada', CANCELLED: 'Cancelada' };

export function InvoicesList({ invoices, onResolve, onDelete, ignoredIds, onToggleIgnore }: Props) {
  const confirm = useConfirm();
  const [busy, setBusy] = useState<string | null>(null);
  const items = invoices.slice(0, 8);

  async function act(id: string, fn: () => Promise<void>, okMsg: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(okMsg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo completar');
    } finally {
      setBusy(null);
    }
  }

  const btn = 'grid size-7 place-items-center rounded-md transition-colors cursor-pointer disabled:opacity-50';

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">Facturas</h3>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin facturas registradas.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((inv) => {
            const hidden = ignoredIds?.has(inv.id);
            return (
            <li key={inv.id} className={`group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/40 ${hidden ? 'opacity-40' : ''}`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${inv.type === 'AR' ? 'bg-primary/15 text-primary' : 'bg-danger/15 text-danger'}`}>{inv.type}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm">{inv.contact_name || 'Sin nombre'}</span>
                  <span className="text-xs text-muted-foreground">
                    vence {inv.due_date} ·{' '}
                    <span className={`rounded px-1 ${STATUS_STYLE[inv.status]}`}>{STATUS_LABEL[inv.status]}</span>
                  </span>
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-sm font-medium">{formatCLP(Number(inv.total_amount))}</span>
                {onToggleIgnore && inv.status === 'PENDING' && (
                  <button
                    className={`${btn} ${hidden ? 'text-accent' : 'text-muted-foreground opacity-0 group-hover:opacity-100'} hover:bg-muted`}
                    title={hidden ? 'Incluir en la proyección' : 'Excluir (simular sin esta factura)'}
                    aria-label="Excluir de la proyección"
                    onClick={() => onToggleIgnore(inv.id)}
                  >
                    {hidden ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
                  </button>
                )}
                <span className="flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                  {inv.status === 'PENDING' && (
                    <>
                      <button
                        className={`${btn} text-muted-foreground hover:bg-primary/15 hover:text-primary`}
                        disabled={busy === inv.id}
                        title="Marcar pagada"
                        aria-label="Marcar pagada"
                        onClick={() => act(inv.id, () => onResolve(inv.id, { status: 'PAID' }), 'Factura marcada como pagada')}
                      >
                        <Check className="size-4" aria-hidden="true" />
                      </button>
                      <button
                        className={`${btn} text-muted-foreground hover:bg-muted hover:text-foreground`}
                        disabled={busy === inv.id}
                        title="Cancelar"
                        aria-label="Cancelar factura"
                        onClick={async () => {
                          if (await confirm({ title: '¿Cancelar factura?', message: 'Dejará de afectar la proyección.', confirmLabel: 'Cancelar factura' }))
                            act(inv.id, () => onResolve(inv.id, { status: 'CANCELLED' }), 'Factura cancelada');
                        }}
                      >
                        <XCircle className="size-4" aria-hidden="true" />
                      </button>
                    </>
                  )}
                  <button
                    className={`${btn} text-muted-foreground hover:bg-muted hover:text-danger`}
                    disabled={busy === inv.id}
                    title="Eliminar"
                    aria-label="Eliminar factura"
                    onClick={async () => {
                      if (await confirm({ title: '¿Eliminar factura?', message: `${inv.contact_name || 'Sin nombre'} · ${formatCLP(Number(inv.total_amount))}`, danger: true, confirmLabel: 'Eliminar' }))
                        act(inv.id, () => onDelete(inv.id), 'Factura eliminada');
                    }}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                </span>
              </span>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
