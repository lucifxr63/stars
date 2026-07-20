import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Cliente service-role propio: este módulo se importa desde funciones sueltas
// (assemble-mega-prompt, extract-founder-profile, enqueue-generation), no solo
// desde api-v1, así que no depende de su middleware.
function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

/**
 * Creates an HMAC-SHA256 signature for the given payload using the secret.
 */
async function createSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const messageData = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
  const signatureArray = Array.from(new Uint8Array(signatureBuffer))
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('')

  return signatureHex
}

/**
 * Dispatches an event to all active webhooks subscribed to it for a given profile.
 *
 * @param eventName Name of the event (e.g. 'validation.complete', 'analysis.ready', 'profile.updated')
 * @param payload Data payload to send
 * @param targetProfileId Only trigger webhooks owned by this profile. If null, triggers globally (for all profiles subscribed to the event).
 */
export async function dispatchWebhook(eventName: string, payload: any, targetProfileId?: string) {
  const supabase = getSupabase()

  // 1. Fetch active subscriptions for this event
  let query = supabase
    .from('webhook_subscriptions')
    .select('id, endpoint_url, secret')
    .eq('is_active', true)
    .contains('events', [eventName])

  if (targetProfileId) {
    query = query.eq('profile_id', targetProfileId)
  }

  const { data: subscriptions, error } = await query

  if (error || !subscriptions || subscriptions.length === 0) {
    return // No webhooks to trigger
  }

  const payloadString = JSON.stringify({
    event: eventName,
    timestamp: new Date().toISOString(),
    data: payload
  })

  // 2. Dispatch to all endpoints in parallel
  const dispatchPromises = subscriptions.map(async (sub) => {
    try {
      const signature = await createSignature(payloadString, sub.secret)

      const response = await fetch(sub.endpoint_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
          'User-Agent': 'Validus-RaaS-Webhook/1.0'
        },
        body: payloadString,
        // Short timeout for webhooks to not block our processes
        signal: AbortSignal.timeout(5000)
      })

      if (!response.ok) {
        console.warn(`Webhook ${sub.id} failed with status ${response.status} at ${sub.endpoint_url}`)
        // TODO: En el futuro, implementar lógica de retries o auto-desactivación (is_active = false) tras N fallos.
      }
    } catch (err: any) {
      console.error(`Webhook ${sub.id} dispatch error to ${sub.endpoint_url}:`, err.message)
    }
  })

  // We don't await the results here strictly if we don't want to block the main thread,
  // but in Edge Functions it's safer to await Promise.allSettled to ensure they fire before execution context dies.
  await Promise.allSettled(dispatchPromises)
}
