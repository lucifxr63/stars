import { useState } from 'react';
import type { FC, ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics';

// ─── Trust Layer v1 ───────────────────────────────────────────────────────────
// Capa presentacional de confianza. NO produce datos: solo etiqueta y explica los
// metadatos que la IA y las fuentes ya generan (confidence, source, status,
// assumptions, data_sources, etc.). El nivel de confianza es una GUÍA de
// interpretación, no una certificación.

// ── Tipos de procedencia de la información ──
export type TrustKind =
  | 'dato-usuario'
  | 'fuente-externa'
  | 'inferencia-ia'
  | 'supuesto'
  | 'no-disponible'
  | 'datos-demo'
  | 'requiere-validacion';

interface KindConfig {
  label: string;
  color: string;     // hex base
  title: string;     // tooltip explicativo
}

const KIND_CONFIG: Record<TrustKind, KindConfig> = {
  'dato-usuario':       { label: 'Dato del usuario',   color: '#34D399', title: 'Información entregada por ti.' },
  'fuente-externa':     { label: 'Fuente externa',     color: '#38D5E3', title: 'Proviene de una fuente externa, cuando está disponible.' },
  'inferencia-ia':      { label: 'Inferencia IA',      color: '#0EB5C6', title: 'Conclusión derivada por la IA. Interpretación, no un hecho verificado.' },
  'supuesto':           { label: 'Supuesto',           color: '#A78BFA', title: 'Condición asumida ante falta de información. Hipótesis a validar.' },
  'no-disponible':      { label: 'No disponible',      color: '#8B8AA0', title: 'La fuente no está disponible. No se inventan datos para reemplazarla.' },
  'datos-demo':         { label: 'Datos demo',         color: '#F59E0B', title: 'Contenido demostrativo / simulado. No representa evidencia real.' },
  'requiere-validacion':{ label: 'Requiere validación', color: '#F87171', title: 'Verifica esta información de forma independiente antes de decidir.' },
};

/** Badge simple y reutilizable para etiquetar la procedencia de un dato. */
export const TrustBadge: FC<{ kind: TrustKind; className?: string }> = ({ kind, className = '' }) => {
  const c = KIND_CONFIG[kind];
  return (
    <span
      title={c.title}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide whitespace-nowrap ${className}`}
      style={{ color: c.color, borderColor: `${c.color}33`, backgroundColor: `${c.color}14` }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: c.color }} />
      {c.label}
    </span>
  );
};

// ── Indicador de confianza ──
export type ConfidenceLevel = 'alta' | 'media' | 'baja' | 'no-evaluada';

/** Normaliza valores típicos del backend (high/medium/low) al set en español. */
export function normalizeConfidence(v: string | null | undefined): ConfidenceLevel {
  const s = (v ?? '').toLowerCase();
  if (s === 'high' || s === 'alta') return 'alta';
  if (s === 'medium' || s === 'media') return 'media';
  if (s === 'low' || s === 'baja') return 'baja';
  return 'no-evaluada';
}

const CONF_CONFIG: Record<ConfidenceLevel, { label: string; color: string }> = {
  'alta':         { label: 'Confianza alta',  color: '#34D399' },
  'media':        { label: 'Confianza media', color: '#F59E0B' },
  'baja':         { label: 'Confianza baja',  color: '#F87171' },
  'no-evaluada':  { label: 'Confianza no evaluada', color: '#8B8AA0' },
};

/** Indicador de confianza. Es una guía de interpretación, NO una certificación. */
export const ConfidenceIndicator: FC<{ level: ConfidenceLevel; className?: string }> = ({ level, className = '' }) => {
  const c = CONF_CONFIG[level];
  return (
    <span
      title="El nivel de confianza es una guía de interpretación, no una certificación."
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold ${className}`}
      style={{ color: c.color }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block shrink-0" style={{ backgroundColor: c.color }} />
      {c.label}
    </span>
  );
};

/** Etiqueta una fuente concreta (ej. "Reddit API", "Banco Central", "Dato del usuario"). */
export const SourceLabel: FC<{ children: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <span className={`inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-[#8B8AA0] ${className}`}>
    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5m6.656-1.828a4 4 0 00-5.656 0l-3 3" />
    </svg>
    <span className="truncate">Fuente: {children}</span>
  </span>
);

/** Nota breve y reutilizable para secciones críticas del dossier. Una sola línea. */
export const SectionTrustNote: FC<{ children?: ReactNode; className?: string }> = ({ children, className = '' }) => (
  <p className={`text-[11px] leading-relaxed text-gray-500 dark:text-[#8B8AA0] flex items-start gap-1.5 ${className}`}>
    <svg className="w-3.5 h-3.5 shrink-0 mt-px text-[#0EB5C6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>
      {children ?? (
        <>Este análisis combina datos del usuario, inferencias de IA y, cuando está disponible, fuentes externas.
        Es orientativo, no asesoría: valida la información crítica antes de decidir.</>
      )}
    </span>
  </p>
);

// ── Leyenda de interpretación (colapsable) ──
const LEGEND_ITEMS: { kind: TrustKind }[] = [
  { kind: 'dato-usuario' },
  { kind: 'fuente-externa' },
  { kind: 'inferencia-ia' },
  { kind: 'supuesto' },
  { kind: 'no-disponible' },
  { kind: 'datos-demo' },
  { kind: 'requiere-validacion' },
];

/**
 * Panel de interpretación del Trust Layer. Colapsable por defecto.
 * Explica en lenguaje simple cada etiqueta y los niveles de confianza.
 */
export const TrustLegend: FC<{ className?: string; defaultOpen?: boolean }> = ({ className = '', defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`rounded-2xl border border-gray-200 dark:border-white/[0.08] bg-white dark:bg-[#12121A] ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => { if (!o) trackEvent('trust_layer_opened', { source: 'dossier' }); return !o; })}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#0EB5C6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
          </svg>
          <span className="text-sm font-semibold text-gray-900 dark:text-[#F0EFF8]">Cómo leer este análisis</span>
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 space-y-4 border-t border-gray-100 dark:border-white/[0.06]">
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed pt-3">
            Validus separa lo que es dato, inferencia y supuesto para que decidas con criterio.
            Estas etiquetas son una <strong>guía de interpretación</strong>, no una certificación.
          </p>

          <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {LEGEND_ITEMS.map(({ kind }) => (
              <div key={kind} className="flex items-center gap-2.5">
                <TrustBadge kind={kind} />
                <span className="text-[11px] text-gray-500 dark:text-[#8B8AA0]">{KIND_CONFIG[kind].title}</span>
              </div>
            ))}
          </div>

          <div className="pt-1">
            <p className="text-[11px] font-semibold text-gray-700 dark:text-[#C4C4D4] mb-2">Nivel de confianza</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <ConfidenceIndicator level="alta" />
              <ConfidenceIndicator level="media" />
              <ConfidenceIndicator level="baja" />
              <ConfidenceIndicator level="no-evaluada" />
            </div>
          </div>

          <p className="text-[11px] text-gray-400 dark:text-[#afaebb] leading-relaxed border-t border-gray-100 dark:border-white/[0.06] pt-3">
            Validus <strong>no entrega asesoría legal, financiera ni de inversión</strong>. La IA puede cometer errores;
            los resultados son orientativos. Valida la información crítica de forma independiente antes de tomar decisiones.
          </p>
        </div>
      )}
    </div>
  );
};
