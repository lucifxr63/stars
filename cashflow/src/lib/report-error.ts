// Costura única de reporte de errores. Hoy escribe a consola; es el ÚNICO punto
// donde se enchufará Sentry (captureException) cuando el stack de observabilidad
// esté listo, sin tocar ningún call-site.
//
// DEUDA TÉCNICA (post-MVP): integrar @sentry/react aquí. El proyecto aún no tiene
// Sentry instalado; fabricar el import rompería el build, así que dejamos el seam
// preparado y documentado.
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  // TODO(sentry): Sentry.captureException(error, { extra: context });
  // eslint-disable-next-line no-console
  console.error('[cashflow] error capturado:', error, context ?? {});
}
