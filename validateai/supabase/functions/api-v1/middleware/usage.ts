import { getSupabase, uuidONulo } from './auth.ts'

export const usageMiddleware = async (c: any, next: any) => {
  if (c.req.method === 'OPTIONS') {
    return await next()
  }

  // Wait for the request to complete
  await next()

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
  const endpoint = new URL(c.req.url).pathname

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
