import * as Sentry from '@sentry/react';

// Adaptador de Sentry para Cashflow. Réplica de las convenciones del producto
// hermano (validateai/src/lib/sentry.ts) — cashflow es un proyecto npm
// independiente, así que no puede importar aquel módulo y mantiene el suyo.
//
// El cliente queda DESACTIVADO mientras no haya DSN (VITE_SENTRY_DSN está
// comentado en .env.local hasta provisionar el proyecto en sentry.io). Todas las
// funciones son no-op seguras hasta entonces: el wiring es real, no un TODO ciego.

const DSN     = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const isProd  = import.meta.env.MODE === 'production';
const enabled = !!DSN;

export function initSentry() {
  if (!enabled) return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    release: import.meta.env.VITE_SENTRY_RELEASE as string | undefined,
    sampleRate: 1.0,
    tracesSampleRate: isProd ? 0.1 : 0,
    integrations: [Sentry.browserTracingIntegration()],
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error exception captured',
      'ChunkLoadError',
      /Loading (CSS )?chunk \d+ failed/,
      'AbortError',
    ],
  });
}

/** Contexto del usuario autenticado. Solo ID interno — sin email/nombre (Ley 21.719). */
export function setSentryUser(userId: string) {
  if (!enabled) return;
  Sentry.setUser({ id: userId });
}

/** Limpia el contexto al cerrar sesión. */
export function clearSentryUser() {
  if (!enabled) return;
  Sentry.setUser(null);
}

/** Captura manual de un error con contexto adicional. */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}
