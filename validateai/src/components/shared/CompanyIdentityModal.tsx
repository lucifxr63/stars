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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="w-full max-w-md bg-white dark:bg-[#12121A] border border-gray-100 dark:border-white/[0.08] rounded-2xl shadow-2xl p-6">
        <h2 className="font-heading text-xl font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">
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
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 bg-[#0EB5C6] text-white font-semibold rounded-xl hover:bg-[#6B5EE6]
                       active:scale-[0.98] transition-all shadow-lg shadow-[#0EB5C6]/25
                       disabled:opacity-40 disabled:cursor-not-allowed text-sm mt-1"
          >
            {saving ? 'Guardando…' : 'Continuar'}
          </button>
        </form>
      </div>
    </div>
  );
}
