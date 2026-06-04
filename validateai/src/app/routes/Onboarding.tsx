import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ThemeToggle } from '@/components/shared/ThemeToggle';
import { INDUSTRIES } from '@/utils/constants';

const ROLES = [
  'CEO / Founder', 'CTO', 'CMO', 'COO', 'Product Manager', 'Otro',
];

const inputCls =
  'w-full px-4 py-3.5 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm ' +
  'text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#12121A] ' +
  'placeholder:text-gray-400 dark:placeholder:text-[#4A495E] ' +
  'focus:border-[#7C6FF7] focus:ring-2 focus:ring-[#7C6FF7]/20 outline-none transition-all';

const selectCls =
  'w-full px-4 py-3.5 border border-gray-200 dark:border-white/[0.08] rounded-xl text-sm ' +
  'text-gray-900 dark:text-[#F0EFF8] bg-white dark:bg-[#12121A] ' +
  'focus:border-[#7C6FF7] focus:ring-2 focus:ring-[#7C6FF7]/20 outline-none transition-all';

const labelCls = 'block text-xs font-medium text-gray-600 dark:text-[#8B8AA0] mb-1.5';

function OnboardingLogo() {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 338 426" className="w-6 h-8 shrink-0" aria-hidden="true">
        <path d="M111 187 A78 78 0 0 1 168 123" fill="none" className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt"/>
        <path d="M213 123 A78 78 0 0 1 271 187" fill="none" className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt"/>
        <path d="M66 198 H118 L169 292 L220 198 H272 L169 358 Z" className="fill-[#001431] dark:fill-white"/>
        <path d="M134 252 L152 252 L169 286 L187 252 L205 252 L169 324 Z" className="fill-white dark:fill-[#0A0A0F]"/>
        <path d="M155 253 L169 279 L192 253 L200 263 L169 303 L148 263 Z" className="fill-[#001431] dark:fill-white"/>
        <path d="M169 68 L193 257 L169 237 L156 254 Z" className="fill-[#ff2b23] dark:fill-[#7C6FF7]"/>
      </svg>
      <span className="font-heading text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Validus</span>
    </div>
  );
}

interface OnboardingForm {
  full_name: string;
  role: string;
  startup_name: string;
  startup_sector: string;
  founder_pitch: string;
}

const STEP_META = [
  { title: 'Tu perfil',  subtitle: 'Cuéntanos quién eres para personalizar tu experiencia.' },
  { title: 'Tu startup', subtitle: '¿Qué estás construyendo? Esta info pre-llenará el wizard automáticamente.' },
  { title: '¡Listo!',    subtitle: 'Tu cuenta está configurada y lista para usar.' },
] as const;

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OnboardingForm>({
    full_name: '',
    role: '',
    startup_name: '',
    startup_sector: '',
    founder_pitch: '',
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata;
      const name = meta?.full_name ?? meta?.name ?? '';
      if (name) setForm((prev) => ({ ...prev, full_name: name }));
    });
  }, []);

  const set =
    (field: keyof OnboardingForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const saveAndComplete = async (skipData = false) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const payload: Record<string, unknown> = {
      onboarding_completed: true,
      updated_at: new Date().toISOString(),
    };

    if (!skipData) {
      if (form.full_name)      payload.full_name      = form.full_name;
      if (form.role)           payload.role           = form.role;
      if (form.startup_name)   payload.startup_name   = form.startup_name;
      if (form.startup_sector) payload.startup_sector = form.startup_sector;
      if (form.founder_pitch)  payload.founder_pitch  = form.founder_pitch;
    }

    const { error } = await supabase.from('profiles').update(payload).eq('id', user.id);
    if (error) {
      toast.error('No se pudo guardar el perfil. Intenta de nuevo.');
      setSaving(false);
      return;
    }

    navigate('/dashboard', { replace: true });
  };

  const meta = STEP_META[step - 1];
  const pitchLen = form.founder_pitch.length;
  // Pitch es opcional; si tiene contenido, requiere mínimo 30 chars para ser útil al pre-fill
  const pitchValid = pitchLen === 0 || pitchLen >= 30;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">
      {/* Topbar */}
      <div className="flex items-center justify-between px-4 sm:px-8 h-14 border-b border-gray-100 dark:border-white/[0.06]">
        <OnboardingLogo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {step < 3 && (
            <button
              onClick={() => saveAndComplete(true)}
              disabled={saving}
              className="text-sm text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
            >
              Omitir
            </button>
          )}
        </div>
      </div>

      {/* Progress dots */}
      <div className="flex justify-center gap-2 pt-8 pb-6">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1.5 rounded-full transition-all duration-500 ${
              s === step
                ? 'w-6 bg-[#7C6FF7]'
                : s < step
                ? 'w-6 bg-[#7C6FF7]/40'
                : 'w-3 bg-gray-200 dark:bg-white/[0.08]'
            }`}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-4 pb-16">
        <div className="w-full max-w-md">
          {/* Step header */}
          <div className="mb-7 text-center">
            <p className="text-xs font-bold text-[#7C6FF7] uppercase tracking-widest mb-2">
              Paso {step} de 3
            </p>
            <h1 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8] mb-2">
              {meta.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed">
              {meta.subtitle}
            </p>
          </div>

          {/* Step 1 — Perfil del founder */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Nombre completo</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={set('full_name')}
                  placeholder="Tu nombre"
                  autoFocus
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
              <button
                onClick={() => setStep(2)}
                className="w-full mt-2 py-3.5 bg-[#7C6FF7] text-white font-bold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] transition-all text-sm shadow-lg shadow-[#7C6FF7]/25"
              >
                Continuar →
              </button>
            </div>
          )}

          {/* Step 2 — Datos de la startup */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Nombre de tu startup</label>
                <input
                  type="text"
                  value={form.startup_name}
                  onChange={set('startup_name')}
                  placeholder="Ej: MediConnect, DataFlow..."
                  autoFocus
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
                  <span className="ml-1.5 font-normal text-gray-400">opcional</span>
                </label>
                <textarea
                  value={form.founder_pitch}
                  onChange={set('founder_pitch')}
                  rows={4}
                  placeholder="¿Qué problema resuelves y para quién? Ej: Ayudamos a pymes a validar sus ideas con IA antes de invertir en desarrollo..."
                  className={`${inputCls} resize-none`}
                />
                <div className="flex justify-end mt-1">
                  <span className={`text-xs ${pitchLen >= 80 ? 'text-green-500' : !pitchValid ? 'text-red-400' : 'text-gray-400 dark:text-[#4A495E]'}`}>
                    {pitchLen} car.{' '}
                    {pitchLen >= 80 ? '✓' : !pitchValid ? 'Mín. 30 caracteres' : '(mín. recomendado: 80)'}
                  </span>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3.5 border border-gray-200 dark:border-white/[0.08] text-gray-700 dark:text-[#8B8AA0] font-semibold rounded-xl hover:bg-gray-50 dark:hover:bg-white/[0.04] transition-all text-sm"
                >
                  ← Atrás
                </button>
                <button
                  onClick={() => pitchValid && setStep(3)}
                  disabled={!pitchValid}
                  className="flex-[2] py-3.5 bg-[#7C6FF7] text-white font-bold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] transition-all text-sm shadow-lg shadow-[#7C6FF7]/25 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Continuar →
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Confirmación */}
          {step === 3 && (
            <div className="text-center space-y-6">
              {/* Success icon */}
              <div className="w-20 h-20 rounded-full bg-[#7C6FF7]/10 border-2 border-[#7C6FF7]/20 flex items-center justify-center mx-auto">
                <svg className="w-10 h-10 text-[#7C6FF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>

              {/* Summary */}
              {(form.startup_name || form.role) && (
                <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-4 text-left space-y-2">
                  {form.full_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400 dark:text-[#8B8AA0]">Founder</span>
                      <span className="font-semibold text-gray-900 dark:text-[#F0EFF8]">{form.full_name}</span>
                    </div>
                  )}
                  {form.role && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400 dark:text-[#8B8AA0]">Rol</span>
                      <span className="font-semibold text-gray-900 dark:text-[#F0EFF8]">{form.role}</span>
                    </div>
                  )}
                  {form.startup_name && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400 dark:text-[#8B8AA0]">Startup</span>
                      <span className="font-semibold text-gray-900 dark:text-[#F0EFF8]">{form.startup_name}</span>
                    </div>
                  )}
                  {form.startup_sector && (
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400 dark:text-[#8B8AA0]">Sector</span>
                      <span className="font-semibold text-gray-900 dark:text-[#F0EFF8]">{form.startup_sector}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-sm text-gray-500 dark:text-[#8B8AA0] leading-relaxed">
                Puedes editar esta información en cualquier momento desde <strong className="text-gray-700 dark:text-[#C4C4D4]">Mi Startup</strong>.
              </p>

              <button
                onClick={() => saveAndComplete()}
                disabled={saving}
                className="w-full py-3.5 bg-[#7C6FF7] text-white font-bold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] transition-all text-sm shadow-lg shadow-[#7C6FF7]/25 disabled:opacity-40"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  'Ir a mi Dashboard →'
                )}
              </button>

              <button
                onClick={() => setStep(2)}
                className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                ← Editar información
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
