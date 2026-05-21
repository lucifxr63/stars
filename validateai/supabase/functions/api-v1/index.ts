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

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'RaaS API Gateway v1' }))

// Debug: echo the path the worker actually receives
app.get('/debug', (c) => c.json({ pathname: new URL(c.req.url).pathname }))

// Auth + rate limit + usage on all /api/v1/* routes
app.use('/api/v1/*', authMiddleware)
app.use('/api/v1/*', rateLimitMiddleware)
app.use('/api/v1/*', usageMiddleware)

// Endpoints
app.post('/api/v1/validate', validateHandler)
app.post('/api/v1/rag/query', ragQueryHandler)
app.get('/api/v1/data/economy', economicDataHandler)
app.post('/api/v1/rag/ingest/text', ingestTextHandler)
app.post('/api/v1/rag/ingest/file', ingestFileHandler)
app.post('/api/v1/webhooks', createWebhookHandler)
app.get('/api/v1/webhooks', listWebhooksHandler)
app.delete('/api/v1/webhooks/:id', deleteWebhookHandler)

app.notFound((c) => c.json({ error: 'Endpoint not found', path: new URL(c.req.url).pathname }, 404))
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  // Supabase strips /functions/v1 but keeps the function name segment: /api-v1/api/v1/...
  // Remove that first segment so Hono sees /api/v1/...
  const url = new URL(req.url)
  const stripped = url.pathname.replace(/^\/[^/]+/, '') || '/'
  const rewritten = new Request(new URL(stripped + url.search, url.origin), req)
  return app.fetch(rewritten)
})
