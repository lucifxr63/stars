import { useState } from 'react';
import { toast } from 'sonner';
import { isValidRut, formatRut } from '@/lib/rut';
import { saveCompanyIdentity } from '@/lib/companyIdentity';

/**
 * Modal bloqueante que pide la identidad de la EMPRESA del usuario (RUT de negocio
 * + razón social) cuando todavía no está registrada en la tabla compartida
 * `company_identity`. Ese dato lo usa todo el ecosistema Scouttech (grafo
 * societario S-Pulse, inteligencia macro). NO es el RUT personal (ese va hasheado).
 */
export function CompanyIdentityModal({ onDone }: { onDone: () => void }) {
  const [rut, setRut] = useState('');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValidRut(rut)) {
      toast.error('RUT de empresa inválido. Revisá el dígito verificador (ej: 76.123.456-K).');
      return;
    }
    if (name.trim().length < 2) {
      toast.error('Ingresá la razón social.');
      return;
    }
    setSaving(true);
    try {
      await saveCompanyIdentity({ company_rut: formatRut(rut), company_name: name.trim() });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo guardar. Intentá de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  function handleSkip() {
    try {
      sessionStorage.setItem('validus_company_identity_skipped', 'true');
    } catch (e) {
      console.warn('sessionStorage error:', e);
    }
    onDone();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="relative w-full max-w-md bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/[0.08] rounded-2xl shadow-2xl p-6">
        <button
          type="button"
          onClick={handleSkip}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:text-[#8B8AA0] dark:hover:text-[#F0EFF8] hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-colors"
          title="Omitir por ahora"
          aria-label="Cerrar modal"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1 pr-6">
          Identificá tu empresa
        </h2>
        <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mb-5">
          Usamos el RUT de tu <strong>empresa</strong> (no tu RUT personal) para el análisis
          societario y de mercado. Se guarda una vez y lo comparte todo el ecosistema.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-[#8B8AA0] mb-1.5">
              RUT de la empresa
            </label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="76.123.456-K"
              autoComplete="off"
              required
              className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm
                         text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#0A0A0F]
                         placeholder:text-gray-400 dark:placeholder:text-[#afaebb]
                         focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20 transition-all outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-[#8B8AA0] mb-1.5">
              Razón social
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre de la empresa"
              autoComplete="organization"
              required
              className="w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm
                         text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#0A0A0F]
                         placeholder:text-gray-400 dark:placeholder:text-[#afaebb]
                         focus:border-[#0EB5C6] focus:ring-2 focus:ring-[#0EB5C6]/20 transition-all outline-none"
            />
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-[#0EB5C6] text-white font-semibold rounded-xl hover:bg-[#6B5EE6]
                         active:scale-[0.98] transition-all shadow-lg shadow-[#0EB5C6]/25
                         disabled:opacity-40 disabled:cursor-not-allowed text-sm"
            >
              {saving ? 'Guardando…' : 'Continuar'}
            </button>
            <button
              type="button"
              onClick={handleSkip}
              disabled={saving}
              className="w-full py-2 bg-transparent text-gray-500 hover:text-gray-700 dark:text-[#8B8AA0] dark:hover:text-[#F0EFF8] text-xs font-medium transition-colors"
            >
              Omitir por ahora
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
