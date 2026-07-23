import { getSupabase } from './auth.ts'

export const usageMiddleware = async (c: any, next: any) => {
  // Wait for the request to complete
  await next()

  const apiKeyId = c.get('api_key_id')
  const profileId = c.get('profile_id')
  if (!apiKeyId) return // If it failed auth, don't log usage

  // Get tokens/credits used from context (route-specific or credit cost from ratelimit)
  const creditsCost = c.get('credits_cost') || 1
  const tokensUsed = c.get('tokens_used') || creditsCost
  const endpoint = new URL(c.req.url).pathname

  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

  // Asynchronously log usage
  try {
    const supabase = getSupabase()
    const logPayload: Record<string, unknown> = {
      api_key_id: apiKeyId,
      endpoint: endpoint,
      requests_count: 1,
      tokens_used: tokensUsed,
      ip_address: ipAddress,
    }
    if (profileId) {
      logPayload.profile_id = profileId
    }

    supabase.from('api_usage_logs').insert(logPayload).then(({ error }) => {
      if (error) console.error('Failed to log API usage:', error)
    })
  } catch (err) {
    console.error('Usage middleware error:', err)
  }
}
