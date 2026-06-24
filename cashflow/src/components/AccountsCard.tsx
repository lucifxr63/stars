import { useState } from 'react';
import { toast } from 'sonner';
import { Landmark, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCLP } from '@/lib/utils';
import { useConfirm } from '@/components/ui/confirm';
import type { BankAccount } from '@/lib/queries';

interface Props {
  accounts: BankAccount[];
  onAdd: (name: string, opening: number, currency: string) => Promise<void>;
  onEdit: (id: string, patch: { name?: string; currency?: string; current_balance?: number }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}

const inputCls =
  'h-10 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60';
const CURRENCIES = ['CLP', 'USD', 'EUR'];

export function AccountsCard({ accounts, onAdd, onEdit, onRemove }: Props) {
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [opening, setOpening] = useState('');
  const [currency, setCurrency] = useState('CLP');
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const mixed = new Set(accounts.map((a) => a.currency)).size > 1;

  async function submitNew(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onAdd(name.trim(), Number(opening) || 0, currency);
      toast.success('Cuenta creada');
      setName('');
      setOpening('');
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: BankAccount) {
    if (!(await confirm({ title: '¿Eliminar cuenta?', message: `${a.name} · ${formatCLP(Number(a.current_balance))}. También se eliminan sus movimientos.`, danger: true, confirmLabel: 'Eliminar' }))) return;
    try {
      await onRemove(a.id);
      toast.success('Cuenta eliminada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-5 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Landmark className="size-4" aria-hidden="true" /> Cuentas
        </h3>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          <Plus className="size-4" aria-hidden="true" /> Añadir
        </Button>
      </div>

      <ul className="space-y-1.5">
        {accounts.map((a) =>
          editId === a.id ? (
            <EditRow key={a.id} account={a} onCancel={() => setEditId(null)} onSave={async (patch) => { await onEdit(a.id, patch); setEditId(null); }} />
          ) : (
            <li key={a.id} className="group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-muted/40">
              <span className="min-w-0 truncate">{a.name} <span className="text-xs text-muted-foreground">{a.currency}</span></span>
              <span className="flex items-center gap-1.5">
                <span className={`font-medium ${Number(a.current_balance) < 0 ? 'text-danger' : ''}`}>{formatCLP(Number(a.current_balance))}</span>
                <button onClick={() => setEditId(a.id)} className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover:opacity-100 cursor-pointer" aria-label={`Editar ${a.name}`}>
                  <Pencil className="size-3.5" aria-hidden="true" />
                </button>
                <button onClick={() => remove(a)} className="grid size-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-muted hover:text-danger group-hover:opacity-100 cursor-pointer" aria-label={`Eliminar ${a.name}`}>
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>

      {mixed && (
        <p className="mt-2 text-[11px] text-amber">
          Tienes cuentas en distintas monedas. La proyección las suma sin convertir tipos de cambio (MVP).
        </p>
      )}

      {open && (
        <form onSubmit={submitNew} className="mt-3 space-y-2 rounded-lg border border-border bg-background/40 p-3">
          <input className={inputCls} placeholder="Nombre (ej: Banco Estado)" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de la cuenta" />
          <div className="grid grid-cols-2 gap-2">
            <input className={inputCls} type="number" min="0" step="1" placeholder="Saldo inicial" value={opening} onChange={(e) => setOpening(e.target.value)} aria-label="Saldo inicial" />
            <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Moneda">
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <Button type="submit" size="sm" className="w-full" disabled={busy}>
            {busy ? 'Creando…' : 'Crear cuenta'}
          </Button>
        </form>
      )}
    </div>
  );
}

function EditRow({ account, onSave, onCancel }: { account: BankAccount; onSave: (patch: { name: string; currency: string; current_balance: number }) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(account.name);
  const [currency, setCurrency] = useState(account.currency);
  const [balance, setBalance] = useState(String(account.current_balance));
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onSave({ name: name.trim(), currency, current_balance: Number(balance) || 0 });
      toast.success('Cuenta actualizada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
      setBusy(false);
    }
  }

  return (
    <li className="space-y-2 rounded-lg border border-border bg-background/40 p-3">
      <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" />
      <div className="grid grid-cols-2 gap-2">
        <input className={inputCls} type="number" step="1" value={balance} onChange={(e) => setBalance(e.target.value)} aria-label="Saldo" />
        <select className={inputCls} value={currency} onChange={(e) => setCurrency(e.target.value)} aria-label="Moneda">
          {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-muted-foreground">Editar el saldo lo fija directamente (los nuevos movimientos suman/restan desde ahí).</p>
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted cursor-pointer">
          <X className="size-3.5" aria-hidden="true" /> Cancelar
        </button>
        <button onClick={save} disabled={busy} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 cursor-pointer disabled:opacity-50">
          <Check className="size-3.5" aria-hidden="true" /> {busy ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </li>
  );
}
