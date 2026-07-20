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

const BRALIDUS_URL = Deno.env.get('BRALIDUS_URL') ?? ''
const BRALIDUS_API_KEY = Deno.env.get('BRALIDUS_API_KEY') ?? ''

const intelProxy = (path: string, tokens: number) => async (c: any) => {
  if (!BRALIDUS_URL) {
    return c.json({ error: 'BRALIDUS_URL no configurado', hint: 'Configurar secret en Supabase' }, 503)
  }

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Body JSON inválido' }, 400)
  }
  if (typeof body.query !== 'string' || body.query.trim().length < 3) {
    return c.json({ error: 'Campo "query" requerido (mínimo 3 caracteres)' }, 400)
  }
  if (body.query.length > 2000) {
    return c.json({ error: 'Campo "query" excede 2000 caracteres' }, 400)
  }
  // Cotas defensivas: el consumer no controla el costo de BralidusPY.
  if (typeof body.top_k === 'number') body.top_k = Math.min(Math.max(1, body.top_k), 25)

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
    c.set('tokens_used', tokens)
    return c.json(payload, res.status)
  } catch (err) {
    console.error('Intel proxy error:', err)
    return c.json({ error: 'Motor de inteligencia no disponible', detail: String(err) }, 502)
  }
}

// POST /api/v1/intel/query — GraphRAG dinámico unificado.
// Body: { query, startup_context?: { industry, stage, geography, company_rut?, ... },
//         top_k?, match_threshold?, entity_override?, tenant_id? }
// Con company_rut se anexan S-Pulse (societario) y Licitus (compras públicas).
export const intelQueryHandler = intelProxy('/query', 150)

// POST /api/v1/intel/query/moe — variante Mixture-of-Experts: el GatingNetwork
// activa expertos por dominio (unit economics, legal, macro...) y reporta cuáles.
export const intelMoeQueryHandler = intelProxy('/query/moe', 180)
