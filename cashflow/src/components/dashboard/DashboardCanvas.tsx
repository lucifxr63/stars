import { useWorkspaceStore } from '@/store/useWorkspaceStore';
import { getDashboardLayout } from '@/config/dashboards';
import { useDashboardMetricsPayload } from '@/hooks/useDashboardMetricsPayload';
import { WIDGET_REGISTRY } from './widgets';

// Lienzo config-driven. Lee el modelo activo, resuelve su layout JSON e instancia
// los widgets del registro inyectándoles la métrica que entrega el hook
// orquestador. No conoce ningún widget en concreto: todo sale de datos.

// Map estático span → clase de columnas (JIT-safe; las clases dinámicas se purgan).
const SPAN_CLASS: Record<number, string> = {
  4: 'lg:col-span-4',
  6: 'lg:col-span-6',
  8: 'lg:col-span-8',
  12: 'lg:col-span-12',
};

export function DashboardCanvas() {
  const model = useWorkspaceStore((s) => s.model);
  const layout = getDashboardLayout(model);
  const { data, loading, error, degraded } = useDashboardMetricsPayload();

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
          const Widget = WIDGET_REGISTRY[slot.widgetId];
          if (!Widget) {
            // Layout referencia un widgetId no registrado: lo señalamos sin romper.
            return (
              <div
                key={`${slot.widgetId}-${i}`}
                className={`${SPAN_CLASS[slot.span]} rounded-xl border border-dashed border-amber/50 bg-amber/5 p-5 text-sm text-amber`}
              >
                Widget no registrado: <code>{slot.widgetId}</code>
              </div>
            );
          }
          // Mientras carga (loading) pasamos metric undefined → el widget muestra su skeleton.
          const metric = loading ? undefined : data?.[slot.widgetId];
          return (
            <div key={`${slot.widgetId}-${i}`} className={SPAN_CLASS[slot.span]}>
              <Widget title={slot.title} metric={metric} />
            </div>
          );
        })}
      </div>
      )}
    </section>
  );
}
