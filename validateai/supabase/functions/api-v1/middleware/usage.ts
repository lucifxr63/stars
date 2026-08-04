import { getSupabase, uuidONulo } from './auth.ts'

/**
 * Devuelve la PLANTILLA de la ruta, nunca la ruta concreta.
 *
 * POR QUÉ: acá se guardaba `new URL(c.req.url).pathname`. El gateway tiene 47
 * rutas con parámetros en la URL, así que lo que quedaba escrito en el log de
 * uso era el identificador real:
 *
 *   /api/v1/data/pjud/suprema/causas/Civil/289/2023   ← una causa con partes reales
 *   /api/v1/data/companies/76543210-K/profile          ← el RUT de una empresa
 *
 * Eso es la agenda de investigación del usuario —qué causas revisa un abogado,
 * qué empresas mira un analista, con fecha y hora— y no hace falta para nada de
 * lo que esta tabla existe, que es medir consumo.
 *
 * Se usa `c.req.routePath`, que es el patrón que Hono YA resolvió al hacer el
 * match, en vez de una lista de 47 rutas mantenida a mano que se desincronizaría
 * al agregar la 48.
 *
 * El respaldo por regex existe por si `routePath` no está disponible: prefiere
 * enmascarar de más (un segmento legítimo confundido con un id sólo degrada la
 * métrica) antes que dejar pasar un identificador.
 */
export function plantillaDeRuta(c: any): string {
  // `routePath` sólo sirve DESPUÉS de que Hono resolvió el handler. Este
  // middleware corre tras `await next()`, así que acá ya está disponible; el
  // limitador, en cambio, rechaza ANTES y sólo vería el patrón del propio
  // middleware ('/api/v1/*'), por eso usa `normalizarRuta` directamente.
  const patron = c.req?.routePath
  if (typeof patron === 'string' && patron.length > 0 && !patron.endsWith('*')) {
    return patron
  }
  return normalizarRuta(new URL(c.req.url).pathname)
}

/**
 * Respaldo por regex, y única opción cuando todavía no hay ruta resuelta.
 * Prefiere enmascarar de más —un segmento legítimo confundido con un id sólo
 * degrada la métrica— antes que dejar pasar un identificador real.
 */
export function normalizarRuta(crudo: string): string {
  return crudo
    .split('/')
    .map((seg) => {
      if (!seg) return seg
      if (/^\d+$/.test(seg)) return ':id'                       // rol, año, ids numéricos
      if (/^\d{1,3}\.?\d{3}\.?\d{3}-[\dkK]$/.test(seg)) return ':rut'
      if (/^\d{7,8}-[\dkK]$/.test(seg)) return ':rut'
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ':uuid'
      if (/^\d+-\d+-[A-Z]{2}\d+$/i.test(seg)) return ':codigo'  // códigos de Mercado Público
      return seg
    })
    .join('/')
}

export const usageMiddleware = async (c: any, next: any) => {
  if (c.req.method === 'OPTIONS') {
    return await next()
  }

  const arranque = Date.now()

  // Wait for the request to complete
  await next()

  const latencyMs = Date.now() - arranque

  // La guarda anterior era `if (!apiKeyId) return`, y descartaba justamente el
  // tráfico de sesión (que no tiene API key). Lo que hay que descartar es lo que
  // no pasó por auth: authMiddleware siempre deja auth_type cuando deja pasar.
  if (!c.get('auth_type')) return

  const apiKeyId = uuidONulo(c.get('api_key_id'))
  const profileId = uuidONulo(c.get('profile_id'))

  // Dos unidades distintas, a propósito en columnas distintas (ver migración
  // 20260804000002). `credits_cost` lo fija ratelimit.ts desde ENDPOINT_CREDITS:
  // es lo que ya se reservó y lo que se le anunció al cliente en el header
  // X-RateLimit-Request-Cost, así que es lo que hay que cobrar. `tokens_used` lo
  // fijan los handlers y es una estimación del costo real; sirve de telemetría,
  // no de precio. Antes se guardaba sólo el segundo y el limitador lo sumaba
  // contra un tope en créditos: se cotizaba 1 y se cobraba 30.
  const creditsCost = c.get('credits_cost') || 1
  const tokensUsed = c.get('tokens_used') ?? creditsCost
  const endpoint = plantillaDeRuta(c)

  // `ip_address` salía NULL en el 100% de las filas, incluidas las de mayo, y no
  // era culpa del trigger: `anonymize_ip` (BEFORE INSERT, sprint de privacidad)
  // trunca a /24 y devuelve NULL ante cualquier formato que no sea una IP
  // limpia, a propósito, "para no crear falsa trazabilidad". Se le pasaban dos
  // cosas que nunca iban a matchear:
  //
  //   - la cadena cruda de x-forwarded-for, que es una LISTA: "cliente, proxy1"
  //   - el literal 'unknown' cuando no había header
  //
  // Sin IP no se puede distinguir un abusador de muchos usuarios legítimos, que
  // es justo lo que hay que saber para dimensionar cualquier cupo compartido.
  // Se toma sólo la primera entrada (el cliente) y se manda null si no hay nada:
  // null es honesto, 'unknown' era ruido que terminaba en null igual.
  const primeraIp = (v: string | undefined | null): string | null => {
    const ip = (v ?? '').split(',')[0].trim()
    return ip.length > 0 ? ip : null
  }
  const ipAddress =
    primeraIp(c.req.header('x-forwarded-for')) ??
    primeraIp(c.req.header('x-real-ip')) ??
    primeraIp(c.req.header('cf-connecting-ip'))

  // Asynchronously log usage
  try {
    const supabase = getSupabase()

    // Ambos campos van ya normalizados por uuidONulo. Esto es lo que hacía
    // fallar TODO insert (ver migración 20260804000001):
    //   - se metía el literal 'demo_public_key' en una columna uuid NOT NULL
    //   - se escribía `profile_id`, una columna que no existía en la tabla
    // El único rastro era un console.error, así que la tabla dejó de crecer el
    // 2026-05-26 sin que nadie se enterara — y con ella murió la cuota, porque
    // el limitador calcula el consumo leyendo de acá.
    const logPayload: Record<string, unknown> = {
      api_key_id: apiKeyId,
      profile_id: profileId,
      endpoint: endpoint,
      requests_count: 1,
      credits_used: creditsCost,
      tokens_used: tokensUsed,
      ip_address: ipAddress,
      // Sin esto un 200 y un 500 del handler quedaban idénticos en la tabla.
      status: c.res?.status ?? null,
      // Ya venía en cada petición y se descartaba. El MCP manda
      // 'Animus-Engine-MCP/<version>': permite separar su tráfico del de curl o
      // del portal, y saber quién actualizó cuando se publica un arreglo.
      client: (c.req.header('x-client') ?? '').slice(0, 120) || null,
      latency_ms: latencyMs,
    }

    const escritura = supabase
      .from('api_usage_logs')
      .insert(logPayload)
      .then(({ error }: { error: unknown }) => {
        if (error) console.error('Failed to log API usage:', error)
      })

    // ── POR QUÉ waitUntil Y NO DEJARLO SUELTO ────────────────────────────────
    // Esta escritura estaba sin esperar. En serverless el isolate puede
    // terminar en cuanto se devuelve la respuesta, y la promesa pendiente muere
    // con él: `api_usage_logs` no registraba NADA desde el 2026-05-26.
    //
    // Comprobado: 3 peticiones seguidas, 0 filas escritas.
    //
    // Y como el rate limiter cuenta el consumo LEYENDO esa tabla, la cuota
    // mensual daba siempre cero usado. O sea que no había control de acceso:
    // no por una política permisiva, sino porque el medidor no andaba.
    //
    // `waitUntil` mantiene vivo el isolate hasta que la escritura termina, sin
    // agregarle latencia a la respuesta — que es lo que pasaría con un `await`.
    const runtime = (globalThis as any).EdgeRuntime
    if (runtime?.waitUntil) {
      runtime.waitUntil(escritura)
    } else {
      // Sin waitUntil (dev local, otro runtime) se espera: preferible pagar
      // unos milisegundos a perder la medición en silencio.
      await escritura
    }
  } catch (err) {
    console.error('Usage middleware error:', err)
  }
}
