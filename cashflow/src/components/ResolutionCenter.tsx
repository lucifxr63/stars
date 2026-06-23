import { useState } from 'react';
import { AlertTriangle, Check, XCircle, CalendarClock } from 'lucide-react';
import { formatCLP } from '@/lib/utils';
import type { Invoice } from '@/lib/queries';

interface Props {
  overdue: Invoice[];
  onResolve: (id: string, patch: { status?: 'PAID' | 'CANCELLED'; due_date?: string }) => Promise<void>;
}

// A/R vencidas que NO entran a la proyección (modelo asimétrico). El usuario
// las acciona: Pagado, Reprogramar (nueva fecha) o Incobrable.
export function ResolutionCenter({ overdue, onResolve }: Props) {
  if (overdue.length === 0) return null;

  return (
    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 backdrop-blur">
      <div className="mb-1 flex items-center gap-2">
        <AlertTriangle className="size-5 text-amber-400" aria-hidden="true" />
        <h2 className="font-semibold">Resolution Center</h2>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        {overdue.length} cuenta{overdue.length === 1 ? '' : 's'} por cobrar vencida{overdue.length === 1 ? '' : 's'}. No se proyectan hasta que las acciones.
      </p>
      <ul className="space-y-2">
        {overdue.map((inv) => (
          <ResolutionRow key={inv.id} inv={inv} onResolve={onResolve} />
        ))}
      </ul>
    </div>
  );
}

function ResolutionRow({ inv, onResolve }: { inv: Invoice; onResolve: Props['onResolve'] }) {
  const [busy, setBusy] = useState(false);
  const [reprogram, setReprogram] = useState(false);
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));

  async function act(patch: { status?: 'PAID' | 'CANCELLED'; due_date?: string }) {
    setBusy(true);
    try {
      await onResolve(inv.id, patch);
    } finally {
      setBusy(false);
    }
  }

  const btn = 'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50';

  return (
    <li className="rounded-lg border border-border bg-card/60 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{inv.contact_name || 'Cliente sin nombre'}</p>
          <p className="text-xs text-muted-foreground">Venció el {inv.due_date} · {formatCLP(Number(inv.total_amount))}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className={`${btn} bg-primary/15 text-primary hover:bg-primary/25`} disabled={busy} onClick={() => act({ status: 'PAID' })}>
            <Check className="size-3.5" aria-hidden="true" /> Pagado
          </button>
          <button className={`${btn} bg-muted text-foreground hover:bg-border`} disabled={busy} onClick={() => setReprogram((v) => !v)}>
            <CalendarClock className="size-3.5" aria-hidden="true" /> Reprogramar
          </button>
          <button className={`${btn} bg-danger/15 text-danger hover:bg-danger/25`} disabled={busy} onClick={() => act({ status: 'CANCELLED' })}>
            <XCircle className="size-3.5" aria-hidden="true" /> Incobrable
          </button>
        </div>
      </div>
      {reprogram && (
        <div className="mt-3 flex items-center gap-2">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="h-9 rounded-md border border-border bg-background px-2 text-sm outline-none focus:border-primary/60"
            aria-label="Nueva fecha de vencimiento"
          />
          <button className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90 h-9`} disabled={busy} onClick={() => act({ due_date: newDate })}>
            Confirmar nueva fecha
          </button>
        </div>
      )}
    </li>
  );
}
