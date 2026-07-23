import { getSupabase } from './auth.ts'

// Tier Monthly Credit Quotas (weighted credits per calendar month)
export const TIER_CREDIT_LIMITS: Record<string, number> = {
  free:       0,        // Free tier has no API access
  basic:      1000,     // ~$19/mo (approx 200 light reqs or ~30 GraphRAG calls)
  pro:        15000,    // ~$79/mo (approx 1000 GraphRAG calls or ~400 MoE calls)
  premium:    100000,   // ~$299/mo (enterprise-grade high throughput)
  admin:      1000000,  // Unlimited admin testing
  enterprise: 5000000,  // Dedicated corporate SLA
}

// Burst limit per minute based on plan
export const TIER_BURST_LIMITS: Record<string, number> = {
  free:       0,
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
  const apiKeyId: string = c.get('api_key_id')
  const profileId: string = c.get('profile_id')

  if (!apiKeyId || !profileId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const supabase = getSupabase()

  // 1. Fetch user profile tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', profileId)
    .maybeSingle()

  const tier = (profile?.tier ?? 'free') as string
  const creditLimit = TIER_CREDIT_LIMITS[tier] ?? 0
  const burstLimit = TIER_BURST_LIMITS[tier] ?? 60

  // Free tier has no API key access
  if (tier !== 'admin' && creditLimit === 0) {
    return c.json({
      error: 'Acceso API deshabilitado en el plan Free. Actualiza a Basic o superior.',
      code: 'TIER_INSUFFICIENT',
      upgrade_url: 'https://validus.scouttech.lat/pricing',
    }, 403)
  }

  const pathname = new URL(c.req.url).pathname
  const costOfCurrentReq = getEndpointCreditCost(pathname)
  c.set('credits_cost', costOfCurrentReq)

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString()

  // Count requests in last minute and total credits used this month
  const [creditsRes, minuteRes] = await Promise.all([
    supabase
      .from('api_usage_logs')
      .select('tokens_used')
      .eq('api_key_id', apiKeyId)
      .gte('created_at', startOfMonth),
    supabase
      .from('api_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('api_key_id', apiKeyId)
      .gte('created_at', oneMinuteAgo),
  ])

  const currentCreditsUsed = (creditsRes.data ?? []).reduce((acc: number, row: any) => acc + (row.tokens_used || 1), 0)
  const minuteReqs = (minuteRes.count ?? 0)

  // Enforce burst limit per minute
  if (minuteReqs >= burstLimit) {
    return c.json({
      error: `Límite por minuto alcanzado (${burstLimit} req/min para tu plan ${tier}).`,
      code: 'RATE_LIMIT_BURST',
      retry_after_seconds: 60,
    }, 429)
  }

  // Enforce monthly credit quota
  if (currentCreditsUsed + costOfCurrentReq > creditLimit) {
    return c.json({
      error: `Cuota mensual de créditos agotada (${currentCreditsUsed.toLocaleString()}/${creditLimit.toLocaleString()} créditos en plan ${tier}).`,
      code: 'RATE_LIMIT_MONTHLY',
      quota: { limit: creditLimit, used: currentCreditsUsed, tier },
      upgrade_url: 'https://validus.scouttech.lat/pricing',
    }, 429)
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

