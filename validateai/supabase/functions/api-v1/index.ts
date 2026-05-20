import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { Hono } from 'https://deno.land/x/hono@v3.12.11/mod.ts' // using stable v3 for standard Deno edge functions or v4 if preferred. v3.12.11 is very stable.
import { cors } from 'https://deno.land/x/hono@v3.12.11/middleware.ts'
import { authMiddleware } from './middleware/auth.ts'
import { usageMiddleware } from './middleware/usage.ts'
import { ragQueryHandler } from './routes/rag.ts'
import { economicDataHandler } from './routes/data.ts'
import { ingestTextHandler, ingestFileHandler } from './routes/ingest.ts'
import { createWebhookHandler, listWebhooksHandler, deleteWebhookHandler } from './routes/webhooks.ts'

const app = new Hono()

// CORS Middleware
app.use('*', cors({
  origin: '*', // Customize this if you want to restrict to specific origins for the public API
  allowHeaders: ['authorization', 'x-client-info', 'apikey', 'content-type'],
}))

// Health check (no auth required)
app.get('/', (c) => c.json({ status: 'ok', service: 'RaaS API Gateway v1' }))

// Protected routes group
const v1 = app.group('/api/v1')

// Apply Auth and Usage middlewares to all routes in /api/v1
v1.use('*', authMiddleware)
v1.use('*', usageMiddleware)

// Endpoints
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

serve(app.fetch)
