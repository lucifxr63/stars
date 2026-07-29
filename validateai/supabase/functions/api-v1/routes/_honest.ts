/**
 * Respuestas honestas para endpoints sin implementación real.
 *
 * Contexto: buena parte de este gateway se construyó devolviendo literales
 * hardcodeados con la misma forma que una respuesta real — y en varios casos
 * marcados `official: true` o `verified: true`. Un consumidor no podía
 * distinguir un dato verdadero de uno inventado, que es peor que no responder.
 *
 * La regla ahora es simple: **si no hay dato, no se inventa**. Estos helpers
 * devuelven un error explícito con la misma envoltura `{ data, meta, errors }`
 * que usa el resto del gateway, con `data: null`.
 *
 * Códigos:
 *  - 501 `NOT_IMPLEMENTED`  → la funcionalidad no existe todavía.
 *  - 503 `SOURCE_UNAVAILABLE` → existe, pero su fuente de datos no está
 *    disponible/configurada en este entorno.
 */

const meta = (source: string) => ({
  source,
  timestamp: new Date().toISOString(),
  page: 1,
  pageSize: 0,
  total: 0,
  totalPages: 0,
})

/** 501 — la funcionalidad no está implementada. */
export const notImplemented = (c: any, message: string, source = 'animus') =>
  c.json(
    {
      data: null,
      meta: meta(source),
      errors: [{ code: 'NOT_IMPLEMENTED', message }],
    },
    501,
  )

/** 503 — implementada, pero sin fuente de datos disponible. */
export const sourceUnavailable = (c: any, message: string, source = 'animus') =>
  c.json(
    {
      data: null,
      meta: meta(source),
      errors: [{ code: 'SOURCE_UNAVAILABLE', message }],
    },
    503,
  )

/**
 * Fábrica para handlers que solo responden 501. Evita repetir el mismo cuerpo
 * decenas de veces y deja el motivo a la vista en la definición del handler.
 */
export const stub = (message: string, source = 'animus') => (c: any) =>
  notImplemented(c, message, source)
