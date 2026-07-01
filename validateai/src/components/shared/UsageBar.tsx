import type { ReactNode } from 'react';

// ── UsageBar ──────────────────────────────────────────────────────────────────
// Bloque compacto y presentacional del uso mensual de cuota (Punto 1: fuente única).
// NO calcula nada: recibe los datos ya resueltos por `useUsage` (server-authoritative
// vía get_usage_summary / tierLimits.ts). Se reutiliza en el Sidebar y el Dashboard
// para garantizar que el número mostrado sea idéntico en todas las superficies.
//
// La métrica es "análisis del mes" (usage.total), NO "validaciones creadas".

interface UsageBarProps {
  /** Análisis usados en el ciclo actual (usage.total). */
  used: number;
  /** Límite del plan (limits.total — server-authoritative). */
  limit: number;
  /** Restantes ya calculados por useUsage. */
  remaining: number;
  /** reset_at crudo del servidor; si falta o es inválido se usa copy prudente. */
  resetAt?: string | null;
  /** true para pro/premium/admin: se muestra variante "sin límite" en vez de barra. */
  unlimited?: boolean;
  /** Etiqueta del plan para la variante unlimited (ej. "Pro"). */
  tierLabel?: string;
  /** Fondo del contenedor según contexto: 'muted' (sidebar) | 'card' (dashboard). */
  variant?: 'muted' | 'card';
  /** Slot al pie del box (ej. CTA de upgrade), renderizado dentro del contenedor. */
  children?: ReactNode;
}

/**
 * Copy de renovación derivado de reset_at (nunca inventa fecha).
 * reset_at del servidor = primer día del mes siguiente en UTC.
 */
function formatReset(resetAt?: string | null): string {
  if (!resetAt) return 'renovación mensual según ciclo de uso';
  const d = new Date(resetAt);
  if (Number.isNaN(d.getTime())) return 'renovación mensual según ciclo de uso';
  // reset_at es el primer día del mes siguiente en UTC. Formateamos en UTC para
  // que no se corra al día anterior en zonas al oeste de UTC (Chile UTC-3/-4).
  return `renueva el ${d.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`;
}

export function UsageBar({
  used,
  limit,
  remaining,
  resetAt,
  unlimited = false,
  tierLabel,
  variant = 'muted',
  children,
}: UsageBarProps) {
  const boxCls =
    variant === 'card'
      ? 'bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/[0.06] p-4'
      : 'bg-gray-50 dark:bg-white/[0.04] rounded-xl p-3 border border-gray-100 dark:border-white/[0.06]';

  // Variante planes "prácticamente ilimitados" (pro/premium/admin): sin barra ni %.
  if (unlimited) {
    return (
      <div className={boxCls}>
        <div className="flex justify-between items-center">
          <span className="text-[10px] font-semibold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide">
            Análisis este mes
          </span>
          <span className="text-[10px] font-bold text-gray-700 dark:text-[#C4C4D4] tabular-nums">
            {used}
          </span>
        </div>
        <p className="text-[10px] text-gray-400 dark:text-[#afaebb] mt-1.5">
          Plan {tierLabel ?? 'Pro'} · sin límite mensual práctico
        </p>
        {children}
      </div>
    );
  }

  const pct = Math.min(100, (used / Math.max(limit, 1)) * 100);
  const barColor =
    remaining === 0 ? 'bg-red-500' : remaining === 1 ? 'bg-amber-500' : 'bg-[#0EB5C6]';

  return (
    <div className={boxCls}>
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-[10px] font-semibold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide">
          Análisis este mes
        </span>
        <span className="text-[10px] font-bold text-gray-700 dark:text-[#C4C4D4] tabular-nums">
          {used} / {limit}
        </span>
      </div>
      <div className="w-full h-1.5 bg-gray-200 dark:bg-white/[0.08] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {remaining === 0 ? (
        <p className="text-[10px] text-red-500 dark:text-red-400 mt-1.5 font-medium">
          Límite alcanzado · {formatReset(resetAt)}
        </p>
      ) : (
        <p className="text-[10px] text-gray-400 dark:text-[#afaebb] mt-1.5">
          {remaining} restante{remaining !== 1 ? 's' : ''} · {formatReset(resetAt)}
        </p>
      )}
      {children}
    </div>
  );
}
