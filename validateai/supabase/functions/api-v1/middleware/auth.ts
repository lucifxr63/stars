import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Perfil ficticio que se le asigna al tráfico sin credencial. NO existe como
// fila en profiles (ni podría: profiles.id tiene FK a auth.users), así que no
// puede escribirse en ninguna columna con FK. Quien mida consumo debe tratarlo
// como "sin identificar", no como un usuario.
export const PERFIL_ANONIMO = '00000000-0000-0000-0000-000000000000'

const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Devuelve el uuid si el valor es un uuid real y no el centinela anónimo; si no,
 * null. Existe porque el contexto de Hono mezcla uuids con literales como
 * 'demo_public_key', y meter ese literal en una columna uuid revienta el insert
 * en silencio (era la causa de que api_usage_logs no registrara nada desde
 * mayo, y con ello de que la cuota nunca se aplicara).
 */
export const uuidONulo = (v: unknown): string | null =>
  typeof v === 'string' && RE_UUID.test(v) && v !== PERFIL_ANONIMO ? v : null

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

  // Sin credencial no se pasa. Antes había DOS puertas abiertas acá:
  //
  //   1. sin token  -> auth_type 'anonymous'
  //   2. el literal 'demo_public_key' / 'demo_*' / 'sb_publishable_*' -> 'demo'
  //
  // Cerrar sólo la primera no habría servido de nada: la segunda la abre
  // cualquiera que mande esa cadena, que además está publicada en la doc.
  //
  // Esto NO afecta al panel de estado de la portada pública: /health/services se
  // registra en index.ts antes del app.use de este middleware, así que nunca
  // pasa por acá (verificado: responde 200 sin token y sin headers de cuota).
  if (!token) {
    return c.json({
      error: 'Se requiere una API key. Obtén la tuya en https://animus.scouttech.lat',
      code: 'AUTH_REQUIRED',
      docs: 'https://animus.scouttech.lat/llms.txt',
    }, 401)
  }

  try {
    const supabase = getSupabase()

    // 1. Check if token is a Supabase Auth User Session JWT (starts with 'ey')
    if (token.startsWith('ey')) {
      const { data: { user }, error: userError } = await supabase.auth.getUser(token)
      if (user && !userError) {
        c.set('profile_id', user.id)
        c.set('user_email', user.email)
        // Explícito: una sesión no tiene API key. Antes esto quedaba sin setear
        // y el middleware de uso cortaba en su guarda `if (!apiKeyId) return`,
        // así que el tráfico de usuarios logueados no se registraba nunca y el
        // limitador lo contaba dentro del cupo anónimo compartido.
        c.set('api_key_id', null)
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
