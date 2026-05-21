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

const app = new Hono()

// CORS Middleware
app.use('*', cors({
  origin: '*', // Customize this if you want to restrict to specific origins for the public API
  allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
}))

// Respond to all CORS preflight requests before any auth middleware runs
app.options('*', (c) => c.text('', 204))

// Health check (no auth required)
app.get('/', (c) => c.json({ status: 'ok', service: 'RaaS API Gateway v1' }))

// Protected routes group
const v1 = app.group('/api/v1')

// Apply middlewares in order: Auth → Rate Limit → Usage logging
v1.use('*', authMiddleware)
v1.use('*', rateLimitMiddleware)
v1.use('*', usageMiddleware)

// Endpoints
v1.post('/validate', validateHandler)
v1.post('/rag/query', ragQueryHandler)
v1.get('/data/economy', economicDataHandler)
v1.post('/rag/ingest/text', ingestTextHandler)
v1.post('/rag/ingest/file', ingestFileHandler)

v1.post('/webhooks', createWebhookHandler)
v1.get('/webhooks', listWebhooksHandler)
v1.delete('/webhooks/:id', deleteWebhookHandler)

// Handle 404
app.notFound((c) => c.json({ error: 'Endpoint not found' }, 404))

// Handle errors
app.onError((err, c) => {
  console.error('Unhandled error:', err)
  return c.json({ error: 'Internal Server Error' }, 500)
})

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  return app.fetch(req)
})
