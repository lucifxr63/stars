import * as Sentry from '@sentry/react';

const DSN     = import.meta.env.VITE_SENTRY_DSN as string | undefined;
const isProd  = import.meta.env.MODE === 'production';
const enabled = !!DSN;

export function initSentry() {
  if (!enabled) return;

  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.MODE,
    release:     import.meta.env.VITE_SENTRY_RELEASE as string | undefined,

    // Captura de errores: 100% en prod; desactivado en dev para no contaminar
    sampleRate: 1.0,

    // Performance tracing: 10% en prod (ajustar según volumen)
    tracesSampleRate: isProd ? 0.1 : 0,

    // Integrations: React router + session replay desactivado (datos PII)
    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Ignorar errores no accionables
    ignoreErrors: [
      'ResizeObserver loop',
      'Non-Error exception captured',
      'ChunkLoadError',
      /Loading (CSS )?chunk \d+ failed/,
      'AbortError',
    ],

    // No enviar datos de usuario en mensajes (solo ID anónimo)
    beforeSend(event) {
      return event;
    },
  });
}

/**
 * Setea el contexto del usuario autenticado.
 * Llama después de que Supabase confirme la sesión.
 * Solo pasa el ID interno — no email ni nombre (Ley 21.719).
 */
export function setSentryUser(userId: string, tier: string) {
  if (!enabled) return;
  Sentry.setUser({ id: userId });
  Sentry.setTag('tier', tier);
}

/** Limpia el contexto cuando el usuario cierra sesión. */
export function clearSentryUser() {
  if (!enabled) return;
  Sentry.setUser(null);
  Sentry.setTag('tier', 'anonymous');
}

/**
 * Registra un breadcrumb de llamada a la IA.
 * Ayuda a rastrear el flujo exacto antes de un error.
 */
export function sentryAIBreadcrumb(
  promptType: string,
  status: 'started' | 'success' | 'rate_limited' | 'error',
  extra?: Record<string, unknown>,
) {
  if (!enabled) return;
  Sentry.addBreadcrumb({
    category: 'ai.call',
    message:  `${promptType} — ${status}`,
    level:    status === 'error' ? 'error' : status === 'rate_limited' ? 'warning' : 'info',
    data:     extra,
  });
}

/** Captura manualmente un error con contexto adicional. */
export function captureError(err: unknown, context?: Record<string, unknown>) {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context) scope.setExtras(context);
    Sentry.captureException(err);
  });
}
