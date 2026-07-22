// ─────────────────────────────────────────────────────────────────────────────
// routes/intel.ts — Inteligencia unificada (BralidusPY GraphRAG) para terceros.
//
// EL endpoint de unificación del ecosistema: una sola llamada fusiona en un
// contexto citable todas las fuentes que Bralidus orquesta:
//   - Macro/financiero fechado (FRED, yfinance) + doctrina normativa (Familia A)
//   - Relaciones societarias con trazabilidad legal (S-Pulse), si company_rut
//   - Actividad en compras públicas + benchmarks B2G (Licitus), si company_rut
//
// Auth/medición: el consumer usa su developer API key (authMiddleware) y este
// gateway agrega el Bearer de BralidusPY server-side — el secreto nunca sale.
// Mismo patrón de hop que /data/licitus/* y /data/spulse/*.
// ─────────────────────────────────────────────────────────────────────────────

import { sanitizeQuery } from '../utils/validation.ts'

const BRALIDUS_URL = Deno.env.get('BRALIDUS_URL') ?? ''
const BRALIDUS_API_KEY = Deno.env.get('BRALIDUS_API_KEY') ?? ''

// Circuit Breaker en memoria local de la Edge Function
let consecutiveFailures = 0
let lastFailureTime = 0
const CIRCUIT_BREAKER_THRESHOLD = 3
const CIRCUIT_RESET_MS = 60_000

const intelProxy = (path: string, tokens: number) => async (c: any) => {
  if (!BRALIDUS_URL) {
    return c.json({ error: 'BRALIDUS_URL no configurado', hint: 'Configurar secret en Supabase' }, 503)
  }

  // Circuit Breaker check
  const now = Date.now()
  if (consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
    if (now - lastFailureTime < CIRCUIT_RESET_MS) {
      return c.json({
        error: 'Servicio de inteligencia temporalmente degradado (Circuit Breaker activo)',
        retry_after_seconds: Math.ceil((CIRCUIT_RESET_MS - (now - lastFailureTime)) / 1000),
      }, 503)
    } else {
      // Intentar resetear para probar conexión (Half-Open state)
      consecutiveFailures = 0
    }
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Body JSON inválido' }, 400)
  }

  const rawQuery = typeof body.query === 'string' ? body.query : ''
  const cleanQuery = sanitizeQuery(rawQuery)

  if (cleanQuery.length < 3) {
    return c.json({ error: 'Campo "query" requerido (mínimo 3 caracteres válidos)' }, 400)
  }
  body.query = cleanQuery

  // Cotas defensivas: el consumer no controla el costo de BralidusPY.
  if (typeof body.top_k === 'number') body.top_k = Math.min(Math.max(1, body.top_k), 25)

  const startTime = Date.now()
  try {
    const res = await fetch(`${BRALIDUS_URL.replace(/\/$/, '')}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BRALIDUS_API_KEY ? { 'Authorization': `Bearer ${BRALIDUS_API_KEY}` } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    
    const payload = await res.json().catch(() => ({ error: `BralidusPY HTTP ${res.status}` }))
    
    if (res.ok) {
      consecutiveFailures = 0
      const totalLatency = Date.now() - startTime
      if (typeof payload === 'object' && payload !== null && !Array.isArray(payload)) {
        payload._latency_breakdown = {
          total_ms: totalLatency,
          service: 'BralidusPY MoE Engine',
        }
      }
    } else {
      consecutiveFailures++
      lastFailureTime = Date.now()
    }

    c.set('tokens_used', tokens)
    return c.json(payload, res.status)
  } catch (err) {
    consecutiveFailures++
    lastFailureTime = Date.now()
    console.error('Intel proxy error:', err)
    return c.json({ error: 'Motor de inteligencia no disponible', detail: String(err) }, 502)
  }
}

// POST /api/v1/intel/query — GraphRAG dinámico unificado.
export const intelQueryHandler = intelProxy('/query', 150)

// POST /api/v1/intel/query/moe — variante Mixture-of-Experts
export const intelMoeQueryHandler = intelProxy('/query/moe', 180)
