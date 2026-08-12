import { getSupabase, uuidONulo } from './auth.ts'
import { normalizarRuta } from './usage.ts'
import { errorJson } from '../utils/errors.ts'

// Tier Monthly Credit Quotas (weighted credits per calendar month)
export const TIER_CREDIT_LIMITS: Record<string, number> = {
  // Sin API key. Existe para que el playground del portal y las demos de la
  // landing funcionen sin registro, NO para consumir la API en serio.
  //
  // Antes el tráfico anónimo caía a `basic` (1.000 créditos, 60 req/min), o sea
  // MÁS que un usuario registrado en `free` (500 y 30): no autenticarse daba el
  // doble de cuota que autenticarse. Quedaba premiado justamente lo que se
  // quiere desalentar.
  anon:       150,      // alcanza para probar; no para integrar
  free:       500,      // Free tier para pruebas de desarrolladores (500 créditos/mes)
  basic:      1000,     // ~$19/mo (approx 200 light reqs or ~30 GraphRAG calls)
  pro:        15000,    // ~$79/mo (approx 1000 GraphRAG calls or ~400 MoE calls)
  premium:    100000,   // ~$299/mo (enterprise-grade high throughput)
  admin:      1000000,  // Unlimited admin testing
  enterprise: 5000000,  // Dedicated corporate SLA
}

// Burst limit per minute based on plan
export const TIER_BURST_LIMITS: Record<string, number> = {
  anon:       10,      // suficiente para clicar el playground, no para un script
  free:       30,
  basic:      60,
  pro:        180,
  premium:    300,
  admin:      600,
  enterprise: 1200,
}

// Cost-weighted credits per endpoint
export const ENDPOINT_CREDITS: Record<string, number> = {
  '/api/v1/data/economy': 1,
  '/api/v1/data/macro': 1,
  '/api/v1/data/chilecompra': 2,
  '/api/v1/data/chilecompra/metricas': 2,
  '/api/v1/data/spulse/companies/search': 2,
  '/api/v1/data/spulse/companies': 3,
  '/api/v1/data/licitus/proveedor': 3,
  '/api/v1/data/licitus/mercado': 3,
  '/api/v1/data/mercado-publico': 3,
  '/api/v1/mercado-publico': 3,
  '/api/v1/rag/query': 5,
  '/api/v1/rag/ingest/text': 10,
  '/api/v1/rag/ingest/file': 15,
  '/api/v1/intel/query': 15,
  '/api/v1/intel/query/moe': 35,
  '/functions/v1/assemble-mega-prompt': 120,
  '/api/v1/validate': 50,
}

export function getEndpointCreditCost(pathname: string): number {
  for (const [pattern, cost] of Object.entries(ENDPOINT_CREDITS)) {
    if (pathname.startsWith(pattern) || pathname === pattern) {
      return cost
    }
  }
  return 1
}

export const rateLimitMiddleware = async (c: any, next: any) => {
  if (c.req.method === 'OPTIONS') {
    return await next()
  }

  if (!c.get('auth_type')) {
    return await next()
  }

  // El sujeto que se cobra, con la MISMA normalización que usa usage.ts al
  // escribir. Si acá se contara por un criterio y allá se escribiera por otro,
  // el limitador leería un balde distinto del que se llena y la cuota volvería
  // a ser decorativa.
  const apiKeyId = uuidONulo(c.get('api_key_id'))
  const profileId = uuidONulo(c.get('profile_id'))

  const supabase = getSupabase()

  // 1. Fetch user profile tier
  const { data: profile } = profileId
    ? await supabase.from('profiles').select('tier').eq('id', profileId).maybeSingle()
    : { data: null }

  const authType = c.get('auth_type') || ''
  // Deny by default también en el tier: sólo una credencial verificada hereda
  // 'free'; cualquier otra cosa cae en 'anon', el más bajo. Hoy authMiddleware
  // ya rechaza el tráfico sin credencial, así que la rama 'anon' no debería
  // alcanzarse — se conserva a propósito para que, si alguien reabre un camino
  // anónimo, herede el cupo más restrictivo y no el de un usuario registrado
  // (que es exactamente lo que pasaba antes, cuando el default era 'basic').
  const defaultTier = (authType === 'session' || authType === 'api_key') ? 'free' : 'anon'
  const tier = (profile?.tier ?? defaultTier) as string
  const creditLimit = TIER_CREDIT_LIMITS[tier] ?? 0
  const burstLimit = TIER_BURST_LIMITS[tier] ?? 60

  // Free tier tiene 500 créditos mensuales para que desarrolladores prueben la API
  if (creditLimit === 0 && tier !== 'admin') {
    return errorJson(c, 403, 'TIER_INSUFFICIENT',
      'Acceso API deshabilitado en este plan. Actualiza tu cuenta en el portal de desarrolladores.',
      { upgrade_url: 'https://validus.scouttech.lat/pricing' })
  }

  const pathname = new URL(c.req.url).pathname
  const costOfCurrentReq = getEndpointCreditCost(pathname)
  c.set('credits_cost', costOfCurrentReq)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString()

  // Acota la consulta al mismo sujeto con que usage.ts escribe la fila:
  //   - con API key      -> por la key (aunque el dueño tenga varias)
  //   - sesión logueada  -> por el perfil
  //   - sin credencial   -> el balde común de todo el tráfico anónimo
  const porSujeto = (q: any) =>
    apiKeyId
      ? q.eq('api_key_id', apiKeyId)
      : profileId
        ? q.is('api_key_id', null).eq('profile_id', profileId)
        : q.is('api_key_id', null).is('profile_id', null)

  // Count requests in last minute and total credits used this month
  const [creditsRes, minuteRes] = await Promise.all([
    porSujeto(
      supabase.from('api_usage_logs').select('credits_used').gte('created_at', startOfMonth),
    ),
    porSujeto(
      supabase
        .from('api_usage_logs')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneMinuteAgo),
    ),
  ])

  // Se suma `credits_used`, la misma unidad del tope y del header. Antes se
  // sumaba `tokens_used`, que es un conteo de tokens: comparar tokens contra un
  // límite de créditos hacía que 3 llamadas triviales gastaran 61 de 150.
  const currentCreditsUsed = (creditsRes.data ?? []).reduce((acc: number, row: any) => acc + (row.credits_used ?? 1), 0)
  const minuteReqs = (minuteRes.count ?? 0)

  // Los rechazos por cuota eran INVISIBLES: este middleware devuelve sin llamar
  // a next(), así que `usageMiddleware` —que va después en la cadena— nunca se
  // ejecutaba. Para un producto medido por créditos, no ver el agotamiento de
  // cuota es no ver la señal de que a alguien le quedó chico el plan.
  //
  // Se registran con 0 créditos cobrados: la petición se rechazó, no se sirvió.
  // Está acotado por definición —sólo lo alcanza quien ya tiene credencial
  // válida, y su propio límite lo frena— así que no permite inflar la tabla.
  const registrarRechazo = (status: number) => {
    const fila: Record<string, unknown> = {
      api_key_id: apiKeyId,
      profile_id: profileId,
      // NO se usa `c.req.routePath` acá: este middleware rechaza ANTES de que
      // Hono resuelva el handler, así que sólo vería el patrón del propio
      // middleware ('/api/v1/*') y se perdería qué endpoint fue rechazado.
      endpoint: normalizarRuta(pathname),
      requests_count: 1,
      credits_used: 0,
      tokens_used: 0,
      status,
      client: (c.req.header('x-client') ?? '').slice(0, 120) || null,
      latency_ms: 0,
    }
    const escritura = supabase.from('api_usage_logs').insert(fila).then(
      ({ error }: { error: unknown }) => { if (error) console.error('No se registró el rechazo:', error) },
    )
    const runtime = (globalThis as any).EdgeRuntime
    if (runtime?.waitUntil) runtime.waitUntil(escritura)
  }

  // Enforce burst limit per minute
  if (minuteReqs >= burstLimit) {
    registrarRechazo(429)
    return errorJson(c, 429, 'RATE_LIMIT_BURST',
      `Límite por minuto alcanzado (${burstLimit} req/min para tu plan ${tier}).`,
      { retry_after_seconds: 60 })
  }

  // Enforce monthly credit quota
  if (currentCreditsUsed + costOfCurrentReq > creditLimit) {
    registrarRechazo(429)
    return errorJson(c, 429, 'RATE_LIMIT_MONTHLY',
      `Cuota mensual de créditos agotada (${currentCreditsUsed.toLocaleString()}/${creditLimit.toLocaleString()} créditos en plan ${tier}).`,
      { quota: { limit: creditLimit, used: currentCreditsUsed, tier },
        upgrade_url: 'https://validus.scouttech.lat/pricing' })
  }

  const remaining = Math.max(0, creditLimit - currentCreditsUsed - costOfCurrentReq)
  c.set('quota_remaining', remaining)
  c.set('quota_limit', creditLimit)
  c.set('tier', tier)

  // Execute request
  await next()

  // Inject standard RateLimit response headers
  c.res.headers.set('X-RateLimit-Limit-Credits', String(creditLimit))
  c.res.headers.set('X-RateLimit-Remaining-Credits', String(remaining))
  c.res.headers.set('X-RateLimit-Tier', tier)
  c.res.headers.set('X-RateLimit-Request-Cost', String(costOfCurrentReq))
}

