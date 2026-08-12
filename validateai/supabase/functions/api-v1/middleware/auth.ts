import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorJson } from '../utils/errors.ts'

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

/**
 * Cuenta un rechazo de autenticación. Es el fallo que MÁS necesitamos ver —con
 * él choca todo usuario nuevo que pega mal su key— y hasta ahora era
 * completamente invisible: este middleware devuelve sin llamar a `next()`, así
 * que `usageMiddleware`, que va después en la cadena, nunca llegaba a correr.
 * Comprobado: 4 peticiones rechazadas producían 0 filas.
 *
 * Va a un CONTADOR agregado por (prefijo de IP, día) y no a un historial, porque
 * es el único rechazo que puede provocar cualquiera desde fuera sin credencial:
 * una fila por intento dejaría que un tercero haga crecer la tabla sin techo.
 *
 * No bloquea la respuesta: el usuario ya sabe que su key falló, no tiene por qué
 * esperar a que lo anotemos.
 */
const contarFalloAuth = (c: any, code: string) => {
  try {
    const crudo = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? ''
    const ip = String(crudo).split(',')[0].trim()
    const escritura = getSupabase()
      .rpc('registrar_fallo_auth', { p_ip: ip || null, p_code: code })
      .then(({ error }: { error: unknown }) => {
        if (error) console.error('No se contó el fallo de auth:', error)
      })
    const runtime = (globalThis as any).EdgeRuntime
    if (runtime?.waitUntil) runtime.waitUntil(escritura)
  } catch (err) {
    console.error('contarFalloAuth:', err)
  }
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
    contarFalloAuth(c, 'AUTH_REQUIRED')
    return errorJson(c, 401, 'AUTH_REQUIRED',
      'Se requiere una API key. Obtén la tuya en https://animus.scouttech.lat')
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
      return errorJson(c, 500, 'SERVER_ERROR',
        'No se pudo verificar la credencial contra la base. Es un problema nuestro, no de tu clave.')
    }

    if (!keyRecord) {
      contarFalloAuth(c, 'INVALID_KEY')
      // API_KEY_INVALID y API_KEY_REVOKED se separan a propósito: una se arregla
      // copiando bien la clave (o usando la correcta, que fue el caso real que
      // motivó esto), la otra generando una nueva. Juntarlas en un solo texto
      // le costó un día de diagnóstico a un integrador.
      return errorJson(c, 401, 'API_KEY_INVALID',
        'La API key no corresponde a ninguna credencial registrada. Revisa que sea la que ' +
        'generaste en https://animus.scouttech.lat y que no estés usando una anterior. ' +
        'No existe una clave pública compartida.')
    }

    if (!keyRecord.is_active) {
      contarFalloAuth(c, 'KEY_REVOKED')
      return errorJson(c, 403, 'API_KEY_REVOKED',
        'Esta API key existe pero fue revocada. Genera una nueva en https://animus.scouttech.lat; ' +
        'copiarla de nuevo no va a servir.')
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
    // Una excepción acá NO es culpa de la credencial, así que se responde 500 y
    // no 401: devolver 401 mandaba al integrador a revisar su clave por un fallo
    // nuestro. Es reintentable, y el `code` lo dice.
    return errorJson(c, 500, 'SERVER_ERROR',
      'Falló la verificación de la credencial por un error interno. Reintenta en unos momentos.')
  }
}
