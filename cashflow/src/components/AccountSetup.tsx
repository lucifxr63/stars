import { useState } from 'react';
import { Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Onboarding: el usuario necesita al menos una cuenta con saldo inicial para
// que la proyección tenga una caja base. Se muestra cuando no hay cuentas.
export function AccountSetup({ onCreate }: { onCreate: (name: string, opening: number) => Promise<void> }) {
  const [name, setName] = useState('Cuenta principal');
  const [opening, setOpening] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const inputCls =
    'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await onCreate(name.trim() || 'Cuenta principal', Number(opening) || 0);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'No se pudo crear la cuenta');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border bg-card/70 p-8 backdrop-blur-xl">
      <div className="mb-5 grid size-12 place-items-center rounded-xl bg-primary/15 text-primary">
        <Landmark className="size-6" aria-hidden="true" />
      </div>
      <h2 className="text-lg font-semibold">Configura tu primera cuenta</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Indica el saldo de caja actual para anclar tu proyección de flujo.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="acc-name">Nombre</label>
          <input id="acc-name" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground" htmlFor="acc-bal">Saldo actual (CLP)</label>
          <input id="acc-bal" type="number" min="0" step="1" placeholder="0" className={inputCls} value={opening} onChange={(e) => setOpening(e.target.value)} />
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>
          {busy ? 'Creando…' : 'Crear cuenta y empezar'}
        </Button>
      </form>
    </div>
  );
}
