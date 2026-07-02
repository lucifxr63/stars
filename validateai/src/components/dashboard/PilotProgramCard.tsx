import { useEffect, useRef } from 'react';
import { Rocket, Check } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

// ── PilotProgramCard ──────────────────────────────────────────────────────────
// Punto 6 (Opción A, frontend-only): superficie del founder para solicitar un
// piloto. Presentacional, sin backend ni Supabase. El CTA es un mailto directo a
// contacto@scouttech.lat (la operación de pilotos se gestiona manualmente). No
// promete pilotos activos, revenue ni acuerdos; no inventa tracción.

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

interface PilotProgramCardProps {
  /** Solo para analítica (PII-safe). */
  tier?: string;
  /** Superficie de origen para analítica. */
  source?: string;
}

export function PilotProgramCard({ tier, source = 'dashboard' }: PilotProgramCardProps) {
  const viewedRef = useRef(false);
  useEffect(() => {
    if (viewedRef.current) return;
    viewedRef.current = true;
    trackEvent('dashboard_pilot_viewed', { tier, source });
  }, [tier, source]);

  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] overflow-hidden">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <div className="w-10 h-10 rounded-xl bg-[#0EB5C6]/10 flex items-center justify-center shrink-0">
          <Rocket className="w-5 h-5 text-[#0EB5C6]" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Programa de pilotos</h2>
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

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-2.5 sm:gap-4">
            <a
              href={PILOT_MAILTO}
              onClick={() => trackEvent('dashboard_pilot_cta_clicked', { tier, source })}
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#0EB5C6] text-white text-sm font-semibold rounded-xl hover:bg-[#6B5EE6] active:scale-[0.98] transition-all shadow-sm shadow-[#0EB5C6]/25 whitespace-nowrap"
            >
              Solicitar piloto →
            </a>
            <p className="text-[11px] text-gray-400 dark:text-[#afaebb] leading-snug">
              La operación de pilotos se gestiona manualmente por el equipo Scouttech.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
