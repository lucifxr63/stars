import { captureError } from '@/lib/sentry';

// Costura única (Adapter/Facade) de reporte de errores. Delega en Sentry vía el
// adaptador `captureError` (no-op hasta que se provisione VITE_SENTRY_DSN) y deja
// rastro en consola para diagnóstico local. Único punto que conoce al proveedor.
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  captureError(error, context);
  // eslint-disable-next-line no-console
  console.error('[cashflow] error capturado:', error, context ?? {});
}
