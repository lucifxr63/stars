import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { authMiddleware } from './middleware/auth.ts'
import { usageMiddleware } from './middleware/usage.ts'
import { rateLimitMiddleware } from './middleware/ratelimit.ts'
import { ragQueryHandler } from './routes/rag.ts'
import { economicDataHandler } from './routes/data.ts'
import { ingestTextHandler, ingestFileHandler } from './routes/ingest.ts'
import { createWebhookHandler, listWebhooksHandler, deleteWebhookHandler } from './routes/webhooks.ts'
import { validateHandler } from './routes/validate.ts'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
}

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
  allowMethods: ['POST', 'GET', 'DELETE', 'OPTIONS'],
}))

app.get('/', (c) => c.json({ status: 'ok', service: 'RaaS API Gateway v1' }))

// Protected sub-app — Hono v4 API
const v1 = new Hono()
v1.use('*', authMiddleware)
v1.use('*', rateLimitMiddleware)
v1.use('*', usageMiddleware)

v1.post('/validate', validateHandler)
v1.post('/rag/query', ragQueryHandler)
v1.get('/data/economy', economicDataHandler)
v1.post('/rag/ingest/text', ingestTextHandler)
v1.post('/rag/ingest/file', ingestFileHandler)
v1.post('/webhooks', createWebhookHandler)
v1.get('/webhooks', listWebhooksHandler)
v1.delete('/webhooks/:id', deleteWebhookHandler)

app.route('/api/v1', v1)

app.notFound((c) => c.json({ error: 'Endpoint not found' }, 404))
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  // Supabase passes the full URL: /functions/v1/api-v1/api/v1/...
  // Strip the Supabase function prefix so Hono sees /api/v1/...
  const url = new URL(req.url)
  const stripped = url.pathname.replace(/^\/functions\/v1\/[^/]+/, '') || '/'
  const rewritten = new Request(new URL(stripped + url.search, url.origin), req)
  return app.fetch(rewritten)
})
