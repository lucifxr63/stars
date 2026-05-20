import { getSupabase } from './auth.ts'

export const usageMiddleware = async (c: any, next: any) => {
  // Wait for the request to complete
  await next()

  const apiKeyId = c.get('api_key_id')
  if (!apiKeyId) return // If it failed auth, don't log usage

  // Get tokens used from context, or default to 0
  const tokensUsed = c.get('tokens_used') || 0
  const endpoint = new URL(c.req.url).pathname

  // Get IP (Hono handles some headers, but in Deno we might need to check standard headers if behind a proxy)
  const ipAddress = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

  // Asynchronously log the usage
  try {
    const supabase = getSupabase()
    // Using fire and forget
    supabase.from('api_usage_logs').insert({
      api_key_id: apiKeyId,
      endpoint: endpoint,
      requests_count: 1,
      tokens_used: tokensUsed,
      ip_address: ipAddress
    }).then(({ error }) => {
      if (error) console.error('Failed to log API usage:', error)
    })
  } catch (err) {
    console.error('Usage middleware error:', err)
  }
}
