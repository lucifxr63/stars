import type { ReactNode } from 'react';

// Mapea el tono del valor al tinte del cuadro de icono.
const KPI_TILE: Record<string, string> = {
  'text-primary': 'bg-primary/15 text-primary',
  'text-danger': 'bg-danger/15 text-danger',
  'text-amber': 'bg-amber/15 text-amber',
  'text-foreground': 'bg-muted text-muted-foreground',
};

export interface KpiProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon: ReactNode;
  tone: string;
  /** Muestra skeleton en el slot del valor (reserva el mismo alto → sin layout shift). */
  loading?: boolean;
}

// Tarjeta KPI del dashboard heredado. Extraída de Dashboard.tsx para poder
// reutilizarla desde componentes aislados (RestrictedCashKpi) sin import circular.
export function Kpi({ label, value, sub, icon, tone, loading }: KpiProps) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 backdrop-blur transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${KPI_TILE[tone] ?? KPI_TILE['text-foreground']}`}>
          {icon}
        </span>
      </div>
      {loading ? (
        // Mismo alto que valor + sub: evita salto de layout al resolver.
        <div className="mt-3 space-y-2" aria-busy="true" aria-label="Cargando">
          <div className="h-7 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted/70" />
        </div>
      ) : (
        <>
          <p className={`mt-3 font-display text-2xl font-bold tracking-tight ${tone}`}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </>
      )}
    </div>
  );
}
