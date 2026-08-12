/**
 * Forma única de los errores del gateway.
 *
 * POR QUÉ EXISTE
 * --------------
 * Un integrador perdió un día diagnosticando mal una clave equivocada. El
 * gateway devolvía `{"error": "Invalid API key or session token"}` —sin `code`—
 * y el cliente MCP lo traducía a "es inválida, fue revocada o no se está
 * enviando". Tres causas distintas en una frase: la hipótesis correcta (era otra
 * clave, más vieja) quedó tapada entre las otras dos.
 *
 * Un texto no se puede ramificar. Un `code` sí. `API_KEY_INVALID` y
 * `API_KEY_REVOKED` son situaciones opuestas —una se arregla copiando bien la
 * clave, la otra generando una nueva— y hasta hoy salían indistinguibles para
 * quien las consumía por programa.
 *
 * `retryable` responde la única pregunta que un cliente automático necesita
 * hacerse ante un error: ¿vuelvo a intentar o no tiene sentido? Sin ese dato,
 * un reintento a ciegas ante un 401 gasta cuota sin arreglar nada.
 *
 * `request_id` viaja también en el encabezado `X-Request-Id`, para que sea
 * rastreable incluso cuando la respuesta no tiene cuerpo legible.
 */

export type CodigoError =
  // Autenticación — nunca reintentables: la credencial no va a mejorar sola.
  | 'AUTH_REQUIRED'
  | 'API_KEY_INVALID'
  | 'API_KEY_REVOKED'
  | 'TIER_INSUFFICIENT'
  // Cuota — reintentables, pero no de inmediato.
  | 'RATE_LIMIT_BURST'
  | 'RATE_LIMIT_MONTHLY'
  // Consulta del cliente — no reintentables sin cambiarla.
  | 'INVALID_PARAM'
  | 'NOT_FOUND'
  // Del lado del servidor o de la fuente — reintentables.
  | 'SOURCE_UNAVAILABLE'
  | 'SERVER_ERROR'

/**
 * Qué conviene reintentar. Se decide acá y no en cada llamada para que la
 * respuesta no dependa de quién la escribió: el mismo código siempre dice lo
 * mismo.
 */
const REINTENTABLE: Record<CodigoError, boolean> = {
  AUTH_REQUIRED: false,
  API_KEY_INVALID: false,
  API_KEY_REVOKED: false,
  TIER_INSUFFICIENT: false,
  RATE_LIMIT_BURST: true,
  RATE_LIMIT_MONTHLY: true,
  INVALID_PARAM: false,
  NOT_FOUND: false,
  SOURCE_UNAVAILABLE: true,
  SERVER_ERROR: true,
}

const DOCS = 'https://animus.scouttech.lat/llms.txt'

/**
 * Identificador de la petición. Se crea una sola vez y se guarda en el contexto:
 * si cada llamada generara el suyo, el que viaja en el cuerpo y el del
 * encabezado no coincidirían y no serviría para rastrear nada.
 */
export function requestId(c: any): string {
  let id = c.get('request_id')
  if (!id) {
    id = crypto.randomUUID()
    c.set('request_id', id)
  }
  return id
}

/**
 * Respuesta de error canónica. `extra` agrega campos propios del caso
 * (`retry_after_seconds`, `upgrade_url`, los encabezados de cuota) sin que cada
 * sitio tenga que rearmar la envoltura.
 */
export function errorJson(
  c: any,
  status: number,
  code: CodigoError,
  message: string,
  extra: Record<string, unknown> = {},
) {
  const id = requestId(c)
  c.header('X-Request-Id', id)
  return c.json(
    {
      error: message,
      code,
      retryable: REINTENTABLE[code],
      // Un rechazo no consume cuota. Se declara explícito porque el integrador
      // no tiene otra forma de saberlo y estaba descontándolo de su saldo.
      credits_charged: 0,
      request_id: id,
      docs: DOCS,
      ...extra,
    },
    status,
  )
}
