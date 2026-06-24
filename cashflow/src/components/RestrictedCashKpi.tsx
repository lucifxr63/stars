import { Landmark, RotateCcw } from 'lucide-react';
import { Kpi } from '@/components/Kpi';
import { useRestrictedCash } from '@/hooks/useRestrictedCash';
import { formatCLP } from '@/lib/utils';

const ICON = <Landmark className="size-4" aria-hidden="true" />;
const LABEL_RPC = 'Provisión fiscal (IVA neto + PPM)';
const LABEL_HEURISTIC = 'Reserva de caja (estimación)';

interface Props {
  tenantId: string | null;
  /** Valor heurístico heredado: rama de rollback (env flag) y fallback de despliegue. */
  heuristicValue: number;
  taxRate: number;
}

// KPI fiscal AISLADO. Su loading/error viven dentro del tile (sin layout shift ni
// banner a nivel board): si la RPC tropieza, solo esta celda se degrada — el panel
// transaccional (formularios, Centro de Resolución, What-If) sigue operativo.
export function RestrictedCashKpi({ tenantId, heuristicValue, taxRate }: Props) {
  const { status, source, value, display, reload } = useRestrictedCash(tenantId);

  if (status === 'loading') {
    return <Kpi label={LABEL_RPC} value="" tone="text-amber" icon={ICON} loading />;
  }

  if (status === 'error') {
    return (
      <Kpi
        label={LABEL_RPC}
        value="—"
        tone="text-amber"
        icon={ICON}
        sub={
          <button
            onClick={reload}
            className="inline-flex items-center gap-1 text-amber hover:underline cursor-pointer"
          >
            <RotateCcw className="size-3" aria-hidden="true" /> No disponible · reintentar
          </button>
        }
      />
    );
  }

  // status === 'ready'
  if (source === 'heuristic') {
    return (
      <Kpi
        label={LABEL_HEURISTIC}
        value={formatCLP(heuristicValue)}
        sub={taxRate > 0 ? `Estimación · ${taxRate}% sobre ingresos` : 'Configura tu tasa en Ajustes'}
        tone="text-amber"
        icon={ICON}
      />
    );
  }

  return (
    <Kpi
      label={LABEL_RPC}
      value={display ?? (value !== null ? formatCLP(value) : '—')}
      sub="Cálculo fiscal del período"
      tone="text-amber"
      icon={ICON}
    />
  );
}
