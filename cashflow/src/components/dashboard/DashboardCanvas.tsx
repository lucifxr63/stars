import type { ReactNode } from 'react';
import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { getDashboardLayout } from '@/config/dashboards';
import { useDashboardMetricsPayload } from '@/hooks/useDashboardMetricsPayload';
import { WIDGET_REGISTRY } from './widgets';
import {
  useDashboardSlot,
  resolveAction,
  LIST_WIDGET_REGISTRY,
  ACTION_WIDGET_REGISTRY,
} from './slotContract';

// Lienzo config-driven. Lee el modelo activo, resuelve su layout JSON e instancia
// los widgets despachando por `kind`: 'metric' (inyecta la métrica del hook),
// 'list' (inyecta una colección viva) o 'action-form' (inyecta la acción declarada
// y resuelta contra el orquestador). No conoce ningún widget en concreto.

// Map estático span → clase de columnas (JIT-safe; las clases dinámicas se purgan).
const SPAN_CLASS: Record<number, string> = {
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
};

function UnregisteredSlot({ id }: { id: string }) {
  return (
    <div className="h-full rounded-xl border border-dashed border-amber/50 bg-amber/5 p-5 text-sm text-amber">
      Widget no registrado: <code>{id}</code>
    </div>
  );
}

function NeedsProviderSlot({ title }: { title: string }) {
  return (
    <div className="h-full rounded-xl border border-dashed border-border bg-card/40 p-5">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">Slot interactivo · requiere DashboardSlotProvider (cableado pendiente)</p>
    </div>
  );
}

export function DashboardCanvas() {
  const model = useWorkspaceStore((s) => s.model);
  const layout = getDashboardLayout(model);
  const { data, loading, error, degraded } = useDashboardMetricsPayload();
  const slotCtx = useDashboardSlot(); // transporte de deps para slots interactivos (opcional)

  return (
    <section>
      <div className="mb-6">
        <h1 className="font-display text-3xl font-bold tracking-tight">{layout.title}</h1>
        <p className="mt-1 text-muted-foreground">{layout.subtitle}</p>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      )}

      {degraded && (
        <p className="mb-6 rounded-lg border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-amber">
          Datos simulados — el backend de métricas aún no está desplegado. Estos valores no son reales.
        </p>
      )}

      {!loading && !error && data === null ? (
        <p className="rounded-lg border border-border bg-card/60 px-4 py-8 text-center text-sm text-muted-foreground">
          No hay una empresa configurada todavía. Crea tu empresa en el Dashboard para ver tus métricas por modelo.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {layout.widgets.map((slot, i) => {
            const kind = slot.kind ?? 'metric';
            let content: ReactNode;

            if (kind === 'list') {
              const ListWidget = LIST_WIDGET_REGISTRY[slot.widgetId];
              if (!ListWidget) content = <UnregisteredSlot id={slot.widgetId} />;
              else if (!slotCtx || !slot.collection) content = <NeedsProviderSlot title={slot.title} />;
              else content = <ListWidget title={slot.title} items={slotCtx.collections[slot.collection]} />;
            } else if (kind === 'action-form') {
              const ActionWidget = ACTION_WIDGET_REGISTRY[slot.widgetId];
              if (!ActionWidget) content = <UnregisteredSlot id={slot.widgetId} />;
              else if (!slotCtx || !slot.binding) content = <NeedsProviderSlot title={slot.title} />;
              else content = <ActionWidget title={slot.title} action={resolveAction(slotCtx.orchestrator, slot.binding)} />;
            } else {
              const MetricWidget = WIDGET_REGISTRY[slot.widgetId];
              if (!MetricWidget) content = <UnregisteredSlot id={slot.widgetId} />;
              else {
                // Mientras carga pasamos metric undefined → el widget muestra su skeleton.
                const metric = loading ? undefined : data?.[slot.widgetId];
                content = <MetricWidget title={slot.title} metric={metric} />;
              }
            }

            return (
              <div key={`${slot.widgetId}-${i}`} className={SPAN_CLASS[slot.span]}>
                {content}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
