import { getSupabase } from '../middleware/auth.ts'

/**
 * Helper to generate a random hex string for webhook secrets
 */
function generateSecret(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

/**
 * Endpoint: POST /api/v1/webhooks
 * Creates a new webhook subscription
 */
export const createWebhookHandler = async (c: any) => {
  try {
    const { endpoint_url, events } = await c.req.json()

    if (!endpoint_url || !endpoint_url.startsWith('http')) {
      return c.json({ error: 'Valid HTTPS endpoint_url is required' }, 400)
    }

    if (!Array.isArray(events) || events.length === 0) {
      return c.json({ error: 'At least one event must be specified in the "events" array' }, 400)
    }

    const profileId = c.get('profile_id')
    const apiKeyId = c.get('api_key_id')
    const secret = generateSecret()

    const supabase = getSupabase()
    
    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .insert({
        profile_id: profileId,
        api_key_id: apiKeyId,
        endpoint_url,
        events,
        secret
      })
      .select('id, endpoint_url, events, secret, is_active, created_at')
      .single()

    if (error) throw error

    return c.json({ success: true, webhook: data }, 201)
  } catch (err: any) {
    console.error('createWebhookHandler error:', err)
    return c.json({ error: 'Failed to create webhook', details: err.message }, 500)
  }
}

/**
 * Endpoint: GET /api/v1/webhooks
 * Lists all active webhooks for the user
 */
export const listWebhooksHandler = async (c: any) => {
  try {
    const profileId = c.get('profile_id')
    const supabase = getSupabase()

    const { data, error } = await supabase
      .from('webhook_subscriptions')
      .select('id, endpoint_url, events, is_active, created_at')
      .eq('profile_id', profileId)
      .order('created_at', { ascending: false })

    if (error) throw error

    return c.json({ webhooks: data })
  } catch (err: any) {
    console.error('listWebhooksHandler error:', err)
    return c.json({ error: 'Failed to retrieve webhooks' }, 500)
  }
}

/**
 * Endpoint: DELETE /api/v1/webhooks/:id
 * Deletes a webhook subscription
 */
export const deleteWebhookHandler = async (c: any) => {
  try {
    const webhookId = c.req.param('id')
    const profileId = c.get('profile_id')
    
    const supabase = getSupabase()

    // RLS ensures they can only delete their own
    const { error } = await supabase
      .from('webhook_subscriptions')
      .delete()
      .eq('id', webhookId)
      .eq('profile_id', profileId)

    if (error) throw error

    return c.json({ success: true, message: 'Webhook deleted successfully' })
  } catch (err: any) {
    console.error('deleteWebhookHandler error:', err)
    return c.json({ error: 'Failed to delete webhook' }, 500)
  }
}
