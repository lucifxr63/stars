import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';

interface ConsentModalProps {
  userId: string;
  onAccepted: () => void;
}

// Validación de RUT chileno (formato XX.XXX.XXX-X o XXXXXXXX-X)
function validarRut(rut: string): boolean {
  const cleaned = rut.replace(/[.\s]/g, '').toUpperCase();
  if (!/^\d{7,8}-[\dK]$/.test(cleaned)) return false;
  const [body, dv] = cleaned.split('-');
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const expected = remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);
  return dv === expected;
}

function formatRut(value: string): string {
  const cleaned = value.replace(/[^0-9kK]/g, '');
  if (cleaned.length <= 1) return cleaned;
  const body = cleaned.slice(0, -1);
  const dv = cleaned.slice(-1).toUpperCase();
  const formatted = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formatted}-${dv}`;
}

export function ConsentModal({ userId, onAccepted }: ConsentModalProps) {
  const [rut, setRut] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rutError, setRutError] = useState('');

  const handleRutChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatRut(e.target.value);
    setRut(formatted);
    if (rutError) setRutError('');
  };

  const handleSubmit = async () => {
    // Validar RUT (obligatorio para usuarios chilenos)
    const rutCleaned = rut.trim();
    if (rutCleaned && !validarRut(rutCleaned)) {
      setRutError('RUT inválido. Verifica el formato (ej: 12.345.678-9)');
      return;
    }

    if (!accepted) return;
    setLoading(true);

    try {
      // Obtener IP del cliente
      let ipAddress = 'unknown';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const ipData = await ipRes.json();
        ipAddress = ipData.ip;
      } catch {
        // IP opcional, no bloquear si falla
      }

      // Insertar via Edge Function (usa SERVICE_ROLE para bypasear RLS)
      const { error } = await supabase.functions.invoke('register-consent', {
        body: {
          user_id: userId,
          ip_address: ipAddress,
          rut: rutCleaned || null,
          consent_type: 'data_processing',
        },
      });

      if (error) throw error;

      toast.success('Consentimiento registrado. Bienvenido a ValidateAI.');
      onAccepted();
    } catch (err) {
      console.error('[ConsentModal] Error al registrar consentimiento:', err);
      toast.error('Error al registrar el consentimiento. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    // Overlay: cubre toda la pantalla, no se puede cerrar
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      // Bloquear click fuera del modal
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-[#0D0D18] shadow-2xl overflow-hidden">

        {/* Barra decorativa superior */}
        <div className="h-1 w-full bg-gradient-to-r from-[#7C6FF7] via-[#A78BFA] to-[#7C6FF7]" />

        <div className="p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-[#7C6FF7]/15 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#7C6FF7]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">
                Consentimiento de Datos
              </h2>
              <p className="text-xs text-white/40">Ley N° 21.719 · Chile · 2026</p>
            </div>
          </div>

          {/* Aviso legal */}
          <div className="mb-6 rounded-xl bg-amber-500/8 border border-amber-500/20 p-4 flex gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-200/80 leading-relaxed">
              ValidateAI procesa tus datos personales (información de tu idea, perfil
              de fundador y métricas de validación) para generar análisis con IA.
              Conforme a la{' '}
              <strong className="text-amber-300">Ley N° 21.719</strong> de Protección
              de Datos Personales de Chile, vigente desde enero 2026, requerimos tu
              consentimiento expreso antes de procesar cualquier información.
            </p>
          </div>

          {/* Derechos del usuario */}
          <div className="mb-6 space-y-2">
            <p className="text-xs font-medium text-white/60 uppercase tracking-wider">
              Tus derechos incluyen
            </p>
            <ul className="space-y-1.5">
              {[
                'Acceder a los datos que almacenamos sobre ti',
                'Solicitar la rectificación o eliminación de tus datos',
                'Revocar este consentimiento en cualquier momento desde tu perfil',
                'Conocer con qué fines se usan tus datos (solo análisis de IA)',
              ].map((right) => (
                <li key={right} className="flex items-start gap-2 text-xs text-white/50">
                  <span className="text-[#7C6FF7] mt-0.5">✓</span>
                  {right}
                </li>
              ))}
            </ul>
          </div>

          {/* Campo RUT (opcional) */}
          <div className="mb-5">
            <label className="block text-xs font-medium text-white/60 mb-1.5">
              RUT chileno{' '}
              <span className="text-white/30 font-normal">(opcional, mejora el análisis regional)</span>
            </label>
            <input
              type="text"
              value={rut}
              onChange={handleRutChange}
              placeholder="12.345.678-9"
              maxLength={12}
              className={`w-full rounded-lg px-3.5 py-2.5 text-sm bg-white/5 border text-white placeholder-white/20 outline-none transition-colors
                ${rutError
                  ? 'border-red-500/50 focus:border-red-500'
                  : 'border-white/10 focus:border-[#7C6FF7]/50'
                }`}
            />
            {rutError && (
              <p className="mt-1.5 text-xs text-red-400">{rutError}</p>
            )}
          </div>

          {/* Checkbox de aceptación */}
          <label className="flex items-start gap-3 cursor-pointer group mb-6">
            <div className="relative flex-shrink-0 mt-0.5">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
                className="sr-only"
              />
              <div
                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all
                  ${accepted
                    ? 'bg-[#7C6FF7] border-[#7C6FF7]'
                    : 'bg-transparent border-white/20 group-hover:border-white/40'
                  }`}
              >
                {accepted && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <span className="text-sm text-white/70 leading-relaxed group-hover:text-white/90 transition-colors">
              Acepto el tratamiento de mis datos personales para los fines indicados,
              conforme a la{' '}
              <strong className="text-white">Ley N° 21.719</strong> de Protección de
              Datos Personales de Chile.
            </span>
          </label>

          {/* Botón de aceptación */}
          <button
            onClick={handleSubmit}
            disabled={!accepted || loading}
            className={`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center justify-center gap-2
              ${accepted && !loading
                ? 'bg-[#7C6FF7] hover:bg-[#6B5EF8] text-white shadow-lg shadow-[#7C6FF7]/25 hover:shadow-[#7C6FF7]/40'
                : 'bg-white/5 text-white/25 cursor-not-allowed'
              }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Registrando consentimiento...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Acepto y continúo
              </>
            )}
          </button>

          <p className="mt-4 text-center text-xs text-white/25">
            Este consentimiento queda registrado con fecha, hora e IP para efectos legales.
          </p>
        </div>
      </div>
    </div>
  );
}
