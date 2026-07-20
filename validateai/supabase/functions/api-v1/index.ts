import { Hono } from 'npm:hono'
import { cors } from 'npm:hono/cors'
import { authMiddleware } from './middleware/auth.ts'
import { usageMiddleware } from './middleware/usage.ts'
import { rateLimitMiddleware } from './middleware/ratelimit.ts'
import { ragQueryHandler } from './routes/rag.ts'
import { economicDataHandler, macroDataHandler, chilecompraDataHandler, chilecompraMetricasHandler, licitusProveedorHandler, licitusBenchmarksHandler, licitusActivasHandler, spulseSearchHandler, spulseProfileHandler, spulseNetworkHandler } from './routes/data.ts'
import { intelQueryHandler, intelMoeQueryHandler } from './routes/intel.ts'
import { ingestTextHandler, ingestFileHandler, ingestVaultHandler } from './routes/ingest.ts'
import { createWebhookHandler, listWebhooksHandler, deleteWebhookHandler } from './routes/webhooks.ts'
import { validateHandler } from './routes/validate.ts'
import { servicesHealthHandler } from './routes/health.ts'

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
app.get('/health/services', servicesHealthHandler)

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
app.get('/api/v1/data/macro', macroDataHandler)
app.get('/api/v1/data/chilecompra', chilecompraDataHandler)
app.get('/api/v1/data/chilecompra/metricas', chilecompraMetricasHandler)
// Licitus (Mercado Público vía BralidusPY) — fuente paralela a chilecompra/metricas
app.get('/api/v1/data/licitus/proveedor/:rut', licitusProveedorHandler)
app.get('/api/v1/data/licitus/mercado/benchmarks', licitusBenchmarksHandler)
app.get('/api/v1/data/licitus/mercado/activas', licitusActivasHandler)
// S-Pulse (grafo societario vía BralidusPY) — superficie curada read-only
app.get('/api/v1/data/spulse/companies/search', spulseSearchHandler)
app.get('/api/v1/data/spulse/companies/:rut/profile', spulseProfileHandler)
app.get('/api/v1/data/spulse/companies/:rut/network', spulseNetworkHandler)
// Inteligencia unificada (BralidusPY GraphRAG) — macro + doctrina + S-Pulse + Licitus
app.post('/api/v1/intel/query', intelQueryHandler)
app.post('/api/v1/intel/query/moe', intelMoeQueryHandler)
app.post('/api/v1/rag/ingest/text', ingestTextHandler)
app.post('/api/v1/rag/ingest/file', ingestFileHandler)
// Vault ingest: called by GitHub Actions — bypasses RaaS auth, uses service role key
app.post('/vault/ingest', ingestVaultHandler)
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
