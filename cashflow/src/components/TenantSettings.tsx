import { useState } from 'react';
import { toast } from 'sonner';
import { Percent, BellRing } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Tenant } from '@/lib/queries';

interface Props {
  tenant: Tenant;
  onSave: (taxRate: number, alerts: boolean) => Promise<void>;
  onClose: () => void;
}

const inputCls =
  'h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary/60';

export function TenantSettings({ tenant, onSave, onClose }: Props) {
  const [taxRate, setTaxRate] = useState(String(tenant.default_tax_rate ?? 0));
  const [alerts, setAlerts] = useState(tenant.weekly_alerts_enabled ?? true);
  const [busy, setBusy] = useState(false);

  async function save() {
    const rate = Number(taxRate);
    if (Number.isNaN(rate) || rate < 0 || rate > 100) {
      toast.error('La tasa debe estar entre 0 y 100.');
      return;
    }
    setBusy(true);
    try {
      await onSave(rate, alerts);
      toast.success('Configuración guardada');
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">Configuración</h2>
        <p className="mt-1 text-sm text-muted-foreground">{tenant.name}</p>

        <div className="mt-6 space-y-5">
          <div>
            <label className="mb-1.5 flex items-center gap-2 text-sm font-medium" htmlFor="tax">
              <Percent className="size-4 text-accent" aria-hidden="true" /> Reserva de impuestos
            </label>
            <div className="flex items-center gap-2">
              <input id="tax" type="number" min="0" max="100" step="0.5" className={inputCls} value={taxRate} onChange={(e) => setTaxRate(e.target.value)} />
              <span className="text-sm text-muted-foreground">%</span>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Se reserva este % de cada ingreso proyectado (ej. 19 = IVA Chile). <span className="text-amber-400">Estimación bruta</span>, no descuenta crédito fiscal.
            </p>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-background/40 px-4 py-3">
            <span className="flex items-center gap-2 text-sm font-medium">
              <BellRing className="size-4 text-accent" aria-hidden="true" /> Alertas semanales por correo
            </span>
            <input type="checkbox" checked={alerts} onChange={(e) => setAlerts(e.target.checked)} className="size-4 cursor-pointer accent-[var(--color-primary)]" />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancelar</Button>
          <Button size="sm" onClick={save} disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</Button>
        </div>
      </div>
    </div>
  );
}
