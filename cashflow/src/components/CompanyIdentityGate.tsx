import { useEffect, useState, type ReactNode } from 'react';
import { isValidRut, formatRut } from '@/lib/rut';
import { getCompanyIdentity, saveCompanyIdentity } from '@/lib/companyIdentity';

/**
 * Envuelve las rutas protegidas: si el usuario no registró la identidad de su
 * EMPRESA (RUT de negocio + razón social) en la tabla compartida `company_identity`,
 * la pide antes de dejar pasar. Info compartida por todo el ecosistema Scouttech
 * (grafo societario S-Pulse). NO es el RUT personal. Degrada si la tabla no existe.
 */
export function CompanyIdentityGate({ children }: { children: ReactNode }) {
  const [needed, setNeeded] = useState<boolean | null>(null);
  const [rut, setRut] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getCompanyIdentity().then((c) => { if (active) setNeeded(c === null); });
    return () => { active = false; };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isValidRut(rut)) { setError('RUT de empresa inválido. Revisá el dígito verificador (ej: 76.123.456-K).'); return; }
    if (name.trim().length < 2) { setError('Ingresá la razón social.'); return; }
    setSaving(true);
    try {
      await saveCompanyIdentity({ company_rut: formatRut(rut), company_name: name.trim() });
      setNeeded(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  if (needed === null) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Cargando…</div>;
  }
  if (!needed) return <>{children}</>;

  const inputCls =
    'w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ' +
    'placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-foreground">Identificá tu empresa</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          Usamos el RUT de tu <strong>empresa</strong> (no tu RUT personal) para el análisis
          societario y de flujo. Se guarda una vez y lo comparte todo el ecosistema.
        </p>
        <form onSubmit={handleSubmit} className="grid gap-3">
          <input type="text" value={rut} onChange={(e) => setRut(e.target.value)}
            placeholder="RUT de la empresa (ej: 76.123.456-K)" autoComplete="off" required className={inputCls} />
          <input type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Razón social" autoComplete="organization" required className={inputCls} />
          <button type="submit" disabled={saving}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
            {saving ? 'Guardando…' : 'Continuar'}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </form>
      </div>
    </div>
  );
}
