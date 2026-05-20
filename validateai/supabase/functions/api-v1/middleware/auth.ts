import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Utility to create a service role client (bypasses RLS)
export const getSupabase = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// Helper to hash the API key using Web Crypto API
export const hashApiKey = async (apiKey: string): Promise<string> => {
  const encoder = new TextEncoder()
  const data = encoder.encode(apiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header('Authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header. Expected "Bearer <api_key>"' }, 401)
  }

  const apiKey = authHeader.replace('Bearer ', '').trim()
  
  if (!apiKey) {
    return c.json({ error: 'Empty API key provided' }, 401)
  }

  try {
    const keyHash = await hashApiKey(apiKey)
    const supabase = getSupabase()

    const { data: keyRecord, error } = await supabase
      .from('api_keys')
      .select('id, profile_id, is_active')
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (error) {
      console.error('Auth middleware DB error:', error)
      return c.json({ error: 'Internal server error during authentication' }, 500)
    }

    if (!keyRecord) {
      return c.json({ error: 'Invalid API key' }, 401)
    }

    if (!keyRecord.is_active) {
      return c.json({ error: 'API key has been revoked' }, 403)
    }

    // Update last_used_at non-blocking (fire and forget)
    supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id).then()

    // Inject profile and key info into Hono context
    c.set('profile_id', keyRecord.profile_id)
    c.set('api_key_id', keyRecord.id)

    await next()

  } catch (err) {
    console.error('Auth middleware error:', err)
    return c.json({ error: 'Authentication failed' }, 500)
  }
}
