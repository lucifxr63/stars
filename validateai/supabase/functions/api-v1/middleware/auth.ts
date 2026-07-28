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
  // 0. HTTP OPTIONS requests (CORS Preflight) always pass instantly
  if (c.req.method === 'OPTIONS') {
    return await next()
  }

  const authHeader = c.req.header('Authorization') || c.req.header('x-bralidus-key') || c.req.header('apikey') || c.req.query('apikey')
  const token = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : ''

  // Sin token: perfil público demo (consultas abiertas del portal/playground).
  // Este es el ÚNICO caso que degrada a demo — errores reales de auth (key
  // inválida, fallo de DB, excepción) deben rechazar, no dejar pasar (bug
  // corregido 2026-07-28: la versión anterior caía a "demo" también en esos
  // casos, dejando el gateway efectivamente sin autenticación).
  if (!token) {
    c.set('profile_id', '00000000-0000-0000-0000-000000000000')
    c.set('api_key_id', 'demo_public_key')
    c.set('auth_type', 'anonymous')
    return await next()
  }

  // Soporte explícito para llaves demo/publishable conocidas del portal.
  if (token === 'demo_public_key' || token.startsWith('demo_') || token.startsWith('sb_publishable_')) {
    c.set('profile_id', '00000000-0000-0000-0000-000000000000')
    c.set('api_key_id', 'demo_public_key')
    c.set('auth_type', 'demo')
    return await next()
  }

  try {
    const supabase = getSupabase()

    // 1. Check if token is a Supabase Auth User Session JWT (starts with 'ey')
    if (token.startsWith('ey')) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      if (user && !userError) {
        c.set('profile_id', user.id)
        c.set('user_email', user.email)
        c.set('auth_type', 'session')
        return await next()
      }
    }

    // 2. Check if token is a valid RaaS API Key in api_keys table
    const keyHash = await hashApiKey(token)

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
      return c.json({ error: 'Invalid API key or session token' }, 401)
    }

    if (!keyRecord.is_active) {
      return c.json({ error: 'API key has been revoked' }, 403)
    }

    // Update last_used_at non-blocking (fire and forget)
    supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id).then()

    // Inject profile and key info into Hono context
    c.set('profile_id', keyRecord.profile_id)
    c.set('api_key_id', keyRecord.id)
    c.set('auth_type', 'api_key')
    return await next()
  } catch (err) {
    console.error('Auth middleware exception:', err)
    return c.json({ error: 'Authentication failed' }, 401)
  }
}
