import { useEffect, useRef } from 'react';
import { ShieldCheck } from 'lucide-react';
import { useMarketSignals } from '@/hooks/useMarketSignals';
import { TrustLegend } from '@/components/shared/TrustLayer';
import { trackEvent } from '@/lib/analytics';

// ── TrustSourcesPanel ─────────────────────────────────────────────────────────
// Punto 5 (Opción A): sube el modelo de confianza al Command Center sin backend.
// Reutiliza TrustLegend (cómo leer los análisis) y muestra el estado HONESTO de la
// fuente de datos de mercado (live/mock), leído de useMarketSignals. No fabrica un
// agregado de confianza por validación (ese dato no está persistido) — la
// trazabilidad por sección sigue viviendo dentro de cada dossier.

const SOURCE_STATUS: Record<string, { dot: string; label: string; detail: string }> = {
  live:     { dot: 'bg-emerald-500', label: 'En vivo',     detail: 'mindicador.cl' },
  bralidus: { dot: 'bg-emerald-500', label: 'En vivo',     detail: 'Bralidus' },
  mock:     { dot: 'bg-amber-500',   label: 'Datos demo',  detail: 'feed en vivo próximamente' },
};

export function TrustSourcesPanel() {
  const { data, loading } = useMarketSignals();
  const src = data?.source ?? null;
  const status = src ? SOURCE_STATUS[src] : null;

  // Analítica PII-safe: solo el estado de la fuente, ningún contenido.
  const viewedRef = useRef(false);
  useEffect(() => {
    if (loading || viewedRef.current) return;
    viewedRef.current = true;
    trackEvent('dashboard_trust_viewed', { source_status: src ?? 'unknown', source: 'dashboard' });
  }, [loading, src]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">
          <ShieldCheck className="w-4 h-4 text-[#0EB5C6] shrink-0" />
          Confianza y fuentes
        </h2>
        {loading ? (
          <span className="h-3.5 w-32 bg-gray-100 dark:bg-white/[0.06] rounded animate-pulse" />
        ) : status ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-[#8B8AA0]">
            Datos de mercado
            <span className="inline-flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
              {status.label} · {status.detail}
            </span>
          </span>
        ) : (
          <span className="text-[11px] text-gray-400 dark:text-[#afaebb]">Datos de mercado · no disponible</span>
        )}
      </div>

      {/* Reusa la leyenda de interpretación del Trust Layer (misma que el dossier). */}
      <TrustLegend />
    </div>
  );
}
