import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { INDUSTRIES } from '@/utils/constants';

const ROLES = [
  'CEO / Founder', 'CTO', 'CMO', 'COO', 'Product Manager', 'Otro',
];

interface StartupForm {
  full_name: string;
  role: string;
  startup_name: string;
  startup_sector: string;
  founder_pitch: string;
}

const inputCls =
  'w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm ' +
  'text-gray-900 dark:text-[#F0EFF8] bg-transparent placeholder:text-gray-400 ' +
  'dark:placeholder:text-[#afaebb] focus:border-[#0EB5C6] focus:ring-2 ' +
  'focus:ring-[#0EB5C6]/20 outline-none transition-all';

const selectCls =
  'w-full px-4 py-3 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm ' +
  'text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#12121A] focus:border-[#0EB5C6] ' +
  'focus:ring-2 focus:ring-[#0EB5C6]/20 outline-none transition-all';

const labelCls = 'block text-xs font-medium text-gray-600 dark:text-[#8B8AA0] mb-1.5';

export function MyStartup() {
  const [form, setForm] = useState<StartupForm>({
    full_name: '',
    role: '',
    startup_name: '',
    startup_sector: '',
    founder_pitch: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || cancelled) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name, role, startup_name, startup_sector, founder_pitch')
        .eq('id', user.id)
        .single();

      if (cancelled) return;
      if (data) {
        setForm({
          full_name: data.full_name ?? '',
          role: data.role ?? '',
          startup_name: data.startup_name ?? '',
          startup_sector: data.startup_sector ?? '',
          founder_pitch: data.founder_pitch ?? '',
        });
      }
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  const set =
    (field: keyof StartupForm) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: form.full_name || null,
        role: form.role || null,
        startup_name: form.startup_name || null,
        startup_sector: form.startup_sector || null,
        founder_pitch: form.founder_pitch || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (error) toast.error('No se pudo guardar el perfil.');
    else toast.success('Perfil actualizado correctamente.');
    setSaving(false);
  };

  const pitchLen = form.founder_pitch.length;

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
        <div className="space-y-4 animate-pulse">
          {[80, 56, 80, 56, 120].map((h, i) => (
            <div key={i} style={{ height: h }} className="bg-gray-100 dark:bg-white/[0.05] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 md:py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">Mi Startup</h1>
        <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mt-1">
          Esta información pre-llena el wizard de validación automáticamente.
        </p>
      </div>

      <div className="space-y-5">
        {/* Perfil del founder */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-[#0EB5C6]/10 flex items-center justify-center text-[10px]">👤</span>
            Perfil del Founder
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Nombre completo</label>
              <input
                type="text"
                value={form.full_name}
                onChange={set('full_name')}
                placeholder="Tu nombre completo"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Rol en la empresa</label>
              <select value={form.role} onChange={set('role')} className={selectCls}>
                <option value="">Seleccionar rol...</option>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Datos de la startup */}
        <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-6">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] mb-4 flex items-center gap-2">
            <span className="w-5 h-5 rounded-md bg-[#0EB5C6]/10 flex items-center justify-center text-[10px]">🚀</span>
            Datos de la Startup
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelCls}>Nombre de la startup</label>
              <input
                type="text"
                value={form.startup_name}
                onChange={set('startup_name')}
                placeholder="Ej: MediConnect, DataFlow, EcoMarket..."
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Sector / Industria</label>
              <select value={form.startup_sector} onChange={set('startup_sector')} className={selectCls}>
                <option value="">Seleccionar industria...</option>
                {INDUSTRIES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Founder Pitch
                <span className="ml-1.5 font-normal text-gray-400">¿Qué problema resuelves y para quién?</span>
              </label>
              <textarea
                value={form.founder_pitch}
                onChange={set('founder_pitch')}
                rows={4}
                placeholder="Ej: Ayudamos a pymes chilenas a validar sus ideas de negocio con IA antes de invertir en desarrollo, reduciendo el riesgo de fracaso en etapa temprana."
                className={`${inputCls} resize-none`}
              />
              <div className="flex justify-end mt-1.5">
                <span className={`text-xs font-medium ${pitchLen >= 80 ? 'text-green-500' : 'text-gray-400 dark:text-[#afaebb]'}`}>
                  {pitchLen} car. {pitchLen >= 80 ? '✓' : `(mín. 80)`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 bg-[#0EB5C6] text-white font-semibold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:cursor-not-allowed text-sm shadow-lg shadow-[#0EB5C6]/20"
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Guardando...
            </span>
          ) : (
            'Guardar cambios'
          )}
        </button>
      </div>
    </div>
  );
}
