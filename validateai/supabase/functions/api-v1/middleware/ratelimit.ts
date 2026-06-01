import { getSupabase } from './auth.ts'

// Limits per plan (requests per calendar month)
const MONTHLY_LIMITS: Record<string, number> = {
  free:    0,    // API key access requires at least basic
  basic:   500,
  pro:     5000,
  premium: 50000,
}

// Per-minute burst limit (applied to all tiers via sliding window)
const PER_MINUTE_LIMIT = 100

export const rateLimitMiddleware = async (c: any, next: any) => {
  const apiKeyId: string = c.get('api_key_id')
  const profileId: string = c.get('profile_id')

  if (!apiKeyId || !profileId) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const supabase = getSupabase()

  // 1. Fetch profile tier
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', profileId)
    .maybeSingle()

  const tier = (profile?.tier ?? 'free') as string
  const monthlyLimit = MONTHLY_LIMITS[tier] ?? 0

  // Free tier has no API access
  if (monthlyLimit === 0) {
    return c.json({
      error: 'API access requires a Basic plan or higher.',
      code: 'TIER_INSUFFICIENT',
      upgrade_url: 'https://validus.scouttech.lat/pricing',
    }, 403)
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const oneMinuteAgo = new Date(now.getTime() - 60_000).toISOString()

  // Run monthly count and per-minute count in parallel
  const [monthlyRes, minuteRes] = await Promise.all([
    supabase
      .from('api_usage_logs')
      .select('requests_count.sum()', { count: 'exact', head: false })
      .eq('api_key_id', apiKeyId)
      .gte('created_at', startOfMonth),
    supabase
      .from('api_usage_logs')
      .select('id', { count: 'exact', head: true })
      .eq('api_key_id', apiKeyId)
      .gte('created_at', oneMinuteAgo),
  ])

  const monthlyUsed = (monthlyRes.count ?? 0)
  const minuteUsed = (minuteRes.count ?? 0)

  // Enforce per-minute burst limit
  if (minuteUsed >= PER_MINUTE_LIMIT) {
    return c.json({
      error: 'Rate limit exceeded. Maximum 100 requests per minute.',
      code: 'RATE_LIMIT_BURST',
      retry_after_seconds: 60,
    }, 429)
  }

  // Enforce monthly quota
  if (monthlyUsed >= monthlyLimit) {
    return c.json({
      error: `Monthly quota exhausted. Your ${tier} plan allows ${monthlyLimit} requests/month.`,
      code: 'RATE_LIMIT_MONTHLY',
      quota: { limit: monthlyLimit, used: monthlyUsed, tier },
      upgrade_url: 'https://validus.scouttech.lat/pricing',
    }, 429)
  }

  // Inject remaining quota into context (response headers added in usage middleware)
  c.set('quota_remaining', monthlyLimit - monthlyUsed - 1)
  c.set('tier', tier)

  await next()
}
