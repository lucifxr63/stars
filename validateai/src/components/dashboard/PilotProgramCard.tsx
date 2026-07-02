import { useCallback, useEffect, useRef, useState } from 'react';
import { Rocket, Check, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';
import { PilotRequestModal } from '@/components/dashboard/PilotRequestModal';

// ── PilotProgramCard ──────────────────────────────────────────────────────────
// Fase 1 pilotos reales: superficie del founder para solicitar un piloto y ver el
// estado de SU solicitud (vía RPC get_my_pilot_status, que solo devuelve campos
// seguros). No expone email/objective/admin_notes ni la lista de pilotos. La
// gestión del pipeline (admin) llega en Fase 2.

const PILOT_EMAIL = 'contacto@scouttech.lat';
const PILOT_SUBJECT = 'Solicitud de piloto Validus';
const PILOT_BODY = `Hola equipo Scouttech,

Quiero solicitar un piloto de Validus.

Contexto:
- Tipo de organización:
- Objetivo del piloto:
- Etapa del proyecto:
- Comentarios:

Gracias.`;
const PILOT_MAILTO = `mailto:${PILOT_EMAIL}?subject=${encodeURIComponent(PILOT_SUBJECT)}&body=${encodeURIComponent(PILOT_BODY)}`;

const BULLETS = [
  'Acceso guiado al flujo de validación.',
  'Feedback para mejorar el dossier.',
  'Espacio para evaluar fit con aceleradoras, fondos o equipos internos.',
];

type PilotStatusKey =
  | 'nuevo' | 'contactado' | 'demo_agendada' | 'piloto_activo'
  | 'feedback_recibido' | 'interes_pago' | 'cerrado' | 'no_califica';

// Estados que permiten volver a solicitar (coincide con el índice único parcial SQL).
const REOPENABLE: PilotStatusKey[] = ['cerrado', 'no_califica'];

const STATUS_LABEL: Record<PilotStatusKey, string> = {
  nuevo: 'Solicitud recibida',
  contactado: 'Contactado por Scouttech',
  demo_agendada: 'Demo agendada',
  piloto_activo: 'Piloto activo',
  feedback_recibido: 'Feedback recibido',
  interes_pago: 'Interés en pago',
  cerrado: 'Cerrado',
  no_califica: 'No califica',
};

const STATUS_DOT: Record<PilotStatusKey, string> = {
  nuevo: 'bg-[#0EB5C6]',
  contactado: 'bg-sky-500',
  demo_agendada: 'bg-indigo-500',
  piloto_activo: 'bg-emerald-500',
  feedback_recibido: 'bg-violet-500',
  interes_pago: 'bg-amber-500',
  cerrado: 'bg-gray-400',
  no_califica: 'bg-gray-400',
};

interface PilotStatusData {
  id: string;
  status: PilotStatusKey;
  segment: string;
  stage: string | null;
  plan_interes: string | null;
  source: string;
  created_at: string;
  updated_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Query pura del estado del founder (sin setState). fail-open ante error de red.
async function queryMyPilot(): Promise<PilotStatusData | null> {
  try {
    const { data } = await supabase.rpc('get_my_pilot_status');
    return (data as PilotStatusData | null) ?? null;
  } catch {
    return null;
  }
}

interface PilotProgramCardProps {
  tier?: string;
  source?: string;
}

export function PilotProgramCard({ tier, source = 'dashboard' }: PilotProgramCardProps) {
  // undefined = cargando; null = sin solicitud; objeto = solicitud existente.
  const [pilot, setPilot] = useState<PilotStatusData | null | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);

  // El setState vive en `.then` (asíncrono) → no dispara react-hooks/set-state-in-effect.
  const refresh = useCallback(() => { queryMyPilot().then(setPilot); }, []);

  useEffect(() => {
    let cancelled = false;
    queryMyPilot().then((p) => { if (!cancelled) setPilot(p); });
    return () => { cancelled = true; };
  }, []);

  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackEvent('dashboard_pilot_viewed', { tier, source });
  }, [tier, source]);

  const openModal = () => {
    trackEvent('dashboard_pilot_cta_clicked', { tier, source });
    setModalOpen(true);
  };

  const hasOpenRequest = pilot != null && !REOPENABLE.includes(pilot.status);

  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] overflow-hidden">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <div className="w-10 h-10 rounded-xl bg-[#0EB5C6]/10 flex items-center justify-center shrink-0">
          <Rocket className="w-5 h-5 text-[#0EB5C6]" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Programa de pilotos</h2>

          {/* ── Cargando ──────────────────────────────────────────────────── */}
          {pilot === undefined && (
            <p className="flex items-center gap-2 text-xs text-gray-400 dark:text-[#8B8AA0] mt-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Revisando estado de tu solicitud…
            </p>
          )}

          {/* ── Con solicitud abierta → estado ────────────────────────────── */}
          {pilot !== undefined && hasOpenRequest && pilot && (
            <div className="mt-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-50 dark:bg-white/[0.04] border border-gray-100 dark:border-white/[0.06]">
                <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[pilot.status]}`} />
                <span className="text-xs font-semibold text-gray-700 dark:text-[#C4C4D4]">
                  {STATUS_LABEL[pilot.status]}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed mt-2.5">
                Recibimos tu solicitud de piloto. El equipo Scouttech la gestiona manualmente y te contactará.
              </p>
              <p className="text-[11px] text-gray-400 dark:text-[#afaebb] mt-1.5">
                Solicitada el {formatDate(pilot.created_at)}
              </p>
            </div>
          )}

          {/* ── Sin solicitud (o reabrible) → CTA + formulario ────────────── */}
          {pilot !== undefined && !hasOpenRequest && (
            <>
              {pilot && REOPENABLE.includes(pilot.status) && (
                <p className="text-[11px] text-gray-400 dark:text-[#afaebb] mt-1.5">
                  Tu solicitud anterior figura como “{STATUS_LABEL[pilot.status]}”. Puedes volver a solicitar.
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed mt-1">
                Estamos abriendo cupos limitados para founders, aceleradoras y equipos de innovación que
                quieran usar Validus con acompañamiento y feedback estructurado.
              </p>

              <ul className="mt-3 space-y-1.5">
                {BULLETS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#C4C4D4]">
                    <Check className="w-3.5 h-3.5 text-[#0EB5C6] shrink-0 mt-0.5" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-3">
                <button
                  onClick={openModal}
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#0EB5C6] text-white text-sm font-semibold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] transition-all shadow-sm shadow-[#0EB5C6]/25 whitespace-nowrap"
                >
                  Solicitar piloto →
                </button>
                <a
                  href={PILOT_MAILTO}
                  onClick={() => trackEvent('dashboard_pilot_cta_clicked', { tier, source: `${source}_mailto` })}
                  className="text-xs font-semibold text-[#0EB5C6] hover:underline whitespace-nowrap"
                >
                  Contactar por correo
                </a>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-[#afaebb] leading-snug mt-2.5">
                La operación de pilotos se gestiona manualmente por el equipo Scouttech.
              </p>
            </>
          )}
        </div>
      </div>

      {modalOpen && (
        <PilotRequestModal
          tier={tier}
          source={source}
          onClose={() => setModalOpen(false)}
          onSubmitted={refresh}
        />
      )}
    </div>
  );
}
