import { getSupabase } from '../middleware/auth.ts'
import { isValidRut, formatRutCanonical } from '../utils/validation.ts'

const MP_BASE = 'https://api.mercadopublico.cl/servicios/v1/publico'
const CHILECOMPRA_CACHE_TTL_HOURS = 24

// BralidusPY (proxy de Licitus). Mismos secrets que usa _shared/bralidus.ts —
// el secreto NUNCA llega al navegador; el browser se autentica con su Validus
// API key contra api-v1 y este gateway agrega el Bearer server-side.
const BRALIDUS_URL = Deno.env.get('BRALIDUS_URL') ?? ''
const BRALIDUS_API_KEY = Deno.env.get('BRALIDUS_API_KEY') ?? ''

// GET /api/v1/data/economy
// Retorna todos los indicadores económicos disponibles (CMF, SII, FRED, etc.)
// organizados por proveedor para facilitar el consumo.
export const economicDataHandler = async (c: any) => {
  try {
    const supabase = getSupabase()

    const { data: rows, error } = await supabase
      .from('economic_knowledge')
      .select('provider, indicator, data_json, context_text, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Economic data fetch error:', error)
      return c.json({ error: 'Failed to retrieve economic data' }, 500)
    }

    // Agrupa por proveedor para respuesta estructurada
    const byProvider: Record<string, Record<string, unknown>> = {}
    for (const row of (rows ?? [])) {
      if (!byProvider[row.provider]) byProvider[row.provider] = {}
      byProvider[row.provider][row.indicator] = {
        ...((row.data_json as Record<string, unknown>) ?? {}),
        _context: row.context_text,
        _updated_at: row.updated_at,
      }
    }

    c.set('tokens_used', 50)
    return c.json({ data: byProvider, rows_count: rows?.length ?? 0 })

  } catch (err) {
    console.error('Economic data handler error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

// GET /api/v1/data/macro
// Retorna indicadores macroeconómicos de FRED (Fed, cobre, petróleo, IPC USA, USD/CLP).
// Estos datos son sincronizados por el cron fred-sync (diario, días hábiles).
export const macroDataHandler = async (c: any) => {
  try {
    const supabase = getSupabase()

    const { data: rows, error } = await supabase
      .from('economic_knowledge')
      .select('indicator, data_json, updated_at')
      .eq('provider', 'FRED')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('Macro data fetch error:', error)
      return c.json({ error: 'Failed to retrieve macro data' }, 500)
    }

    if (!rows || rows.length === 0) {
      return c.json({
        error: 'No macro data available',
        hint: 'Run fred-sync to populate FRED indicators',
      }, 503)
    }

    const indicators: Record<string, unknown> = {}
    for (const row of rows) {
      indicators[row.indicator] = {
        ...(row.data_json as Record<string, unknown>),
        _updated_at: row.updated_at,
      }
    }

    c.set('tokens_used', 30)
    return c.json({
      source: 'FRED — Federal Reserve Bank of St. Louis',
      indicators,
      count: rows.length,
    })

  } catch (err) {
    console.error('Macro data handler error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

// GET /api/v1/data/chilecompra/metricas?rut={rut}
// Lee las métricas M1-M10 pre-calculadas desde chilecompra_metricas.
// Para recalcular, llamar directamente a la Edge Function chilecompra-calcular.
export const chilecompraMetricasHandler = async (c: any) => {
  const rut: string | undefined = c.req.query('rut')
  if (!rut) return c.json({ error: 'Parámetro rut requerido' }, 400)
  const rutNorm = rut.replace(/[^0-9Kk]/g, '').toUpperCase()
  if (rutNorm.length < 7) return c.json({ error: 'RUT inválido' }, 400)

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('chilecompra_metricas')
      .select('*')
      .eq('rut', rutNorm)
      .order('calculado_al', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return c.json({
        error: 'Sin métricas calculadas para este RUT',
        hint: `Llamar a POST /functions/v1/chilecompra-calcular con { "rut": "${rut}" } para calcularlas`,
      }, 404)
    }

    c.set('tokens_used', 20)
    return c.json(data)
  } catch (err) {
    console.error('chilecompraMetricasHandler error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

// ── Licitus (vía BralidusPY) ─────────────────────────────────────────────────
// Browser → api-v1 (Validus API key) → BralidusPY /licitus/* (Bearer secreto)
// → Licitus /v1/*. Fuente PARALELA a chilecompra/metricas: Licitus sirve OCs
// reales de purchase_orders + buyer intelligence; metricas M1-M10 son cálculo
// propio de Validus. No fusionar (decisión de canonicidad pendiente — plan §7).
//
// BralidusPY responde { data: <json plano de Licitus> } o 503 si Licitus degrada.
const licitusProxyHandler = (subpath: (c: any) => string, tokens: number, requiresRut = false) => async (c: any) => {
  if (!BRALIDUS_URL) {
    return c.json({ error: 'BRALIDUS_URL no configurado', hint: 'Configurar secret en Supabase' }, 503)
  }

  if (requiresRut) {
    const rut = c.req.param('rut') ?? ''
    if (!isValidRut(rut)) {
      return c.json({ error: 'RUT chileno inválido (formato esperado: 12.345.678-K o 12345678K)' }, 400)
    }
  }

  try {
    const url = new URL(c.req.url)
    const target = `${BRALIDUS_URL.replace(/\/$/, '')}/licitus${subpath(c)}${url.search}`
    const res = await fetch(target, {
      headers: BRALIDUS_API_KEY ? { 'Authorization': `Bearer ${BRALIDUS_API_KEY}` } : {},
      signal: AbortSignal.timeout(12_000),
    })
    const body = await res.json().catch(() => ({ error: `BralidusPY HTTP ${res.status}` }))
    if (res.status === 429) {
      return c.json({ error: 'Rate limit de Licitus alcanzado — reintenta en unos segundos', ...body }, 429)
    }
    c.set('tokens_used', tokens)
    
    // Normalización de payload de respuesta Licitus
    const normalizedBody = res.ok && typeof body === 'object' && body !== null
      ? { source: 'licitus', normalized: true, ...body }
      : body

    return c.json(normalizedBody, res.status)
  } catch (err) {
    console.error('Licitus proxy error:', err)
    return c.json({ error: 'Licitus no disponible', detail: String(err) }, 502)
  }
}

// GET /api/v1/data/licitus/proveedor/:rut?periodo_meses=12
export const licitusProveedorHandler = licitusProxyHandler(
  (c) => `/proveedor/${encodeURIComponent(formatRutCanonical(c.req.param('rut') ?? ''))}`, 40, true
)
// GET /api/v1/data/licitus/proveedor/:rut/vs-mercado?periodo_meses=12
export const licitusProveedorVsMercadoHandler = licitusProxyHandler(
  (c) => `/proveedor/${encodeURIComponent(formatRutCanonical(c.req.param('rut') ?? ''))}/vs-mercado`, 45, true
)
// GET /api/v1/data/licitus/proveedor/:rut/oportunidades?limit=10
export const licitusProveedorOportunidadesHandler = licitusProxyHandler(
  (c) => `/proveedor/${encodeURIComponent(formatRutCanonical(c.req.param('rut') ?? ''))}/oportunidades`, 45, true
)
// GET /api/v1/data/licitus/mercado/benchmarks?unspsc&region&periodo_meses
export const licitusBenchmarksHandler = licitusProxyHandler(() => '/mercado/benchmarks', 30)
// GET /api/v1/data/licitus/mercado/activas?unspsc&region&monto_min&cierre_desde_horas&limit
export const licitusActivasHandler = licitusProxyHandler(() => '/mercado/activas', 30)

// ── Bralidus REST Standard Response Helper ────────────────────────────────────
const buildBralidusMeta = (page = 1, pageSize = 20, total = 0, source = 'mercado_publico') => ({
  request_id: `req_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
  page,
  page_size: pageSize,
  total,
  source,
  synced_at: new Date().toISOString(),
})

const buildBralidusResponse = (data: any, page = 1, pageSize = 20, total = 0, source = 'mercado_publico', errors: any[] = []) => ({
  data,
  meta: buildBralidusMeta(page, pageSize, total, source),
  errors,
})

// ── Mercado Público (API Prima Bralidus v1) ──────────────────────────────────

// GET /api/v1/mercado-publico/health
export const mercadoPublicoHealthHandler = async (c: any) => {
  return c.json(buildBralidusResponse({
    status: 'ok',
    sources: {
      mercado_publico_v1: 'operational',
      compra_agil_v2: 'operational',
    },
    version: '1.0.0',
  }, 1, 1, 1))
}

// GET /api/v1/mercado-publico/opportunities (Buscador Unificado: tender + agile_purchase)
export const mercadoPublicoOpportunitiesHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const page = Math.max(Number(c.req.query('page') ?? 1), 1)
    const pageSize = Math.min(Number(c.req.query('page_size') ?? c.req.query('limit') ?? 20), 100)
    const offset = (page - 1) * pageSize
    const typeParam = c.req.query('type') // 'tender', 'agile_purchase', or comma-separated
    const statusParam = c.req.query('status')
    const q = c.req.query('q')

    let query = supabase.from('opportunities').select('*', { count: 'exact' }).order('published_at', { ascending: false })

    if (typeParam) {
      const types = typeParam.split(',').map((t: string) => t.trim())
      query = query.in('source_type', types)
    }
    if (statusParam) query = query.eq('status_code', statusParam)
    if (q) query = query.ilike('title', `%${q}%`)

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error

    c.set('tokens_used', 25)
    return c.json(buildBralidusResponse(data ?? [], page, pageSize, count ?? 0))
  } catch (err) {
    console.error('mercadoPublicoOpportunitiesHandler error:', err)
    return c.json(buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

// GET /api/v1/mercado-publico/opportunities/:id
export const mercadoPublicoOpportunityDetailHandler = async (c: any) => {
  const id = c.req.param('id')
  try {
    const supabase = getSupabase()
    const isUuid = id.includes('-') && id.length > 20
    const query = supabase.from('opportunities').select('*')
    const { data, error } = await (isUuid ? query.eq('id', id) : query.eq('external_code', id)).maybeSingle()

    if (error) throw error
    if (!data) return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'NOT_FOUND', message: `Oportunidad ${id} no encontrada` }]), 404)

    c.set('tokens_used', 15)
    return c.json(buildBralidusResponse(data, 1, 1, 1))
  } catch (err) {
    return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

// GET /api/v1/mercado-publico/licitaciones
export const mercadoPublicoLicitacionesHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const page = Math.max(Number(c.req.query('page') ?? 1), 1)
    const pageSize = Math.min(Number(c.req.query('page_size') ?? 20), 100)
    const offset = (page - 1) * pageSize
    
    const fechaInicio = c.req.query('fecha_inicio')
    const fechaFin = c.req.query('fecha_fin')
    const estado = c.req.query('estado') || c.req.query('status')
    const codigoOrganismo = c.req.query('codigo_organismo') || c.req.query('buyer_rut')
    const q = c.req.query('q')

    let query = supabase.from('opportunities').select('*', { count: 'exact' }).neq('source_type', 'compra_agil').order('published_at', { ascending: false })
    
    if (q) query = query.ilike('title', `%${q}%`)
    if (codigoOrganismo) query = query.eq('buyer_org_code', codigoOrganismo)
    if (estado) query = query.eq('status_code', estado)
    if (fechaInicio) query = query.gte('published_at', fechaInicio)
    if (fechaFin) query = query.lte('published_at', fechaFin)

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error

    c.set('tokens_used', 25)
    return c.json(buildBralidusResponse(data ?? [], page, pageSize, count ?? 0))
  } catch (err) {
    return c.json(buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

// GET /api/v1/mercado-publico/licitaciones/:codigo_externo
export const mercadoPublicoLicitacionDetailHandler = async (c: any) => {
  const codigo = c.req.param('codigo_externo') || c.req.param('id') || c.req.param('code')
  try {
    const supabase = getSupabase()
    const isUuid = codigo && codigo.includes('-') && codigo.length > 20
    const query = supabase.from('opportunities').select('*')
    const { data, error } = await (isUuid ? query.eq('id', codigo) : query.eq('external_code', codigo)).maybeSingle()

    if (error) throw error
    if (!data) return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'NOT_FOUND', message: `Licitación ${codigo} no encontrada` }]), 404)

    c.set('tokens_used', 15)
    return c.json(buildBralidusResponse(data, 1, 1, 1))
  } catch (err) {
    return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

// GET /api/v1/mercado-publico/ordenes-compra
export const mercadoPublicoOrdenesHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const page = Math.max(Number(c.req.query('page') ?? 1), 1)
    const pageSize = Math.min(Number(c.req.query('page_size') ?? 20), 100)
    const offset = (page - 1) * pageSize
    
    const fecha = c.req.query('fecha')
    const rutProveedor = c.req.query('rut_proveedor') || c.req.query('supplier_rut')
    const estado = c.req.query('estado') || c.req.query('status')
    const codigoOrganismo = c.req.query('codigo_organismo') || c.req.query('buyer_rut')

    let query = supabase.from('purchase_orders').select('*', { count: 'exact' }).order('issued_at', { ascending: false })
    
    if (rutProveedor) query = query.eq('supplier_code', rutProveedor)
    if (codigoOrganismo) query = query.eq('buyer_org_code', codigoOrganismo)
    if (estado) query = query.eq('status', estado)
    if (fecha) query = query.gte('issued_at', `${fecha}T00:00:00Z`).lte('issued_at', `${fecha}T23:59:59Z`)

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error

    c.set('tokens_used', 25)
    return c.json(buildBralidusResponse(data ?? [], page, pageSize, count ?? 0))
  } catch (err) {
    return c.json(buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

// GET /api/v1/mercado-publico/ordenes-compra/:codigo_oc
export const mercadoPublicoOrdenDetailHandler = async (c: any) => {
  const codigo = c.req.param('codigo_oc') || c.req.param('id') || c.req.param('code')
  try {
    const supabase = getSupabase()
    const isUuid = codigo && codigo.includes('-') && codigo.length > 20
    const query = supabase.from('purchase_orders').select('*')
    const { data, error } = await (isUuid ? query.eq('id', codigo) : query.eq('external_code', codigo)).maybeSingle()

    if (error) throw error
    if (!data) return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'NOT_FOUND', message: `Orden de Compra ${codigo} no encontrada` }]), 404)

    c.set('tokens_used', 15)
    return c.json(buildBralidusResponse(data, 1, 1, 1))
  } catch (err) {
    return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

// GET /api/v1/mercado-publico/organismos
export const mercadoPublicoOrganismosHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const page = Math.max(Number(c.req.query('page') ?? 1), 1)
    const pageSize = Math.min(Number(c.req.query('page_size') ?? 20), 100)
    const offset = (page - 1) * pageSize
    
    const nombre = c.req.query('nombre') || c.req.query('q')
    const rut = c.req.query('rut')

    let query = supabase.from('purchase_orders').select('buyer_org_code, buyer_name', { count: 'exact' })
    
    if (nombre) query = query.ilike('buyer_name', `%${nombre}%`)
    if (rut) query = query.eq('buyer_org_code', rut)

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error

    // Elimina duplicados de compradores
    const uniqueBuyers = Array.from(
      new Map((data ?? []).map((item: any) => [item.buyer_org_code, item])).values()
    )

    c.set('tokens_used', 20)
    return c.json(buildBralidusResponse(uniqueBuyers, page, pageSize, count ?? 0))
  } catch (err) {
    return c.json(buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

// Aliases para proveedores
export const mercadoPublicoProveedorHandler = licitusProveedorHandler
export const mercadoPublicoProveedorVsMercadoHandler = licitusProveedorVsMercadoHandler
export const mercadoPublicoBenchmarksHandler = licitusBenchmarksHandler

// ── S-Pulse (vía BralidusPY) ─────────────────────────────────────────────────
// Grafo societario chileno con trazabilidad legal. Mismo hop que Licitus:
// Browser/API consumer → api-v1 (developer key) → BralidusPY /spulse/* (Bearer
// secreto) → S-Pulse. Superficie curada: search / profile / network (lo
// tenant-scoped como /opportunities NO se expone públicamente).
const spulseProxyHandler = (subpath: (c: any) => string, tokens: number, requiresRut = false) => async (c: any) => {
  if (!BRALIDUS_URL) {
    return c.json({ error: 'BRALIDUS_URL no configurado', hint: 'Configurar secret en Supabase' }, 503)
  }

  if (requiresRut) {
    const rut = c.req.param('rut') ?? ''
    if (!isValidRut(rut)) {
      return c.json({ error: 'RUT chileno inválido (formato esperado: 12.345.678-K o 12345678K)' }, 400)
    }
  }

  try {
    const url = new URL(c.req.url)
    const target = `${BRALIDUS_URL.replace(/\/$/, '')}/spulse${subpath(c)}${url.search}`
    const res = await fetch(target, {
      headers: BRALIDUS_API_KEY ? { 'Authorization': `Bearer ${BRALIDUS_API_KEY}` } : {},
      signal: AbortSignal.timeout(12_000),
    })
    const body = await res.json().catch(() => ({ error: `BralidusPY HTTP ${res.status}` }))
    c.set('tokens_used', tokens)
    return c.json(body, res.status)
  } catch (err) {
    console.error('S-Pulse proxy error:', err)
    return c.json({ error: 'S-Pulse no disponible', detail: String(err) }, 502)
  }
}

// GET /api/v1/data/spulse/companies/search?q=
export const spulseSearchHandler = spulseProxyHandler(() => '/companies/search', 30)
// GET /api/v1/data/spulse/companies/:rut/profile
export const spulseProfileHandler = spulseProxyHandler(
  (c) => `/companies/${encodeURIComponent(formatRutCanonical(c.req.param('rut') ?? ''))}/profile`, 40, true
)
// GET /api/v1/data/spulse/companies/:rut/network
export const spulseNetworkHandler = spulseProxyHandler(
  (c) => `/companies/${encodeURIComponent(formatRutCanonical(c.req.param('rut') ?? ''))}/network`, 40, true
)

// GET /api/v1/data/chilecompra?rut={rut}&refresh=true
// Retorna datos de contratos públicos de un proveedor desde Mercado Público.
// Sin ?rut retorna licitaciones publicadas hoy.
// Los resultados por RUT se cachean 24h en economic_knowledge.
// Requiere env: MERCADOPUBLICO_TICKET
export const chilecompraDataHandler = async (c: any) => {
  const ticket = Deno.env.get('MERCADOPUBLICO_TICKET')
  if (!ticket) {
    return c.json({
      error: 'MERCADOPUBLICO_TICKET no configurado',
      hint: 'Registrarse en mercadopublico.cl y obtener ticket de API en Mi Cuenta → Datos de la cuenta',
    }, 503)
  }

  const rut: string | undefined = c.req.query('rut')
  const forceRefresh = c.req.query('refresh') === 'true'

  // ── Por RUT ────────────────────────────────────────────────────────────────
  if (rut) {
    const rutNorm = rut.replace(/[^0-9Kk]/g, '').toUpperCase()
    if (rutNorm.length < 7) return c.json({ error: 'RUT inválido' }, 400)

    const supabase = getSupabase()
    const cacheIndicator = `proveedor_${rutNorm}`

    if (!forceRefresh) {
      const { data: cached } = await supabase
        .from('economic_knowledge')
        .select('data_json, updated_at')
        .eq('provider', 'CHILECOMPRA')
        .eq('indicator', cacheIndicator)
        .maybeSingle()

      if (cached) {
        const ageHours = (Date.now() - new Date(cached.updated_at as string).getTime()) / 3_600_000
        if (ageHours < CHILECOMPRA_CACHE_TTL_HOURS) {
          c.set('tokens_used', 10)
          return c.json({
            ...(cached.data_json as object),
            _cached: true,
            _age_hours: Math.round(ageHours),
          })
        }
      }
    }

    try {
      const mpUrl = `${MP_BASE}/proveedores/${rutNorm}.json?ticket=${ticket}`
      const res = await fetch(mpUrl, { signal: AbortSignal.timeout(12_000) })
      if (res.status === 404) return c.json({ error: `RUT ${rut} no encontrado en ChileCompra` }, 404)
      if (!res.ok) throw new Error(`Mercado Público error ${res.status}`)

      const data = await res.json() as Record<string, unknown>

      await getSupabase().from('economic_knowledge').upsert(
        {
          provider: 'CHILECOMPRA',
          indicator: cacheIndicator,
          data_json: data,
          context_text: `ChileCompra RUT ${rut}: ${JSON.stringify(data).slice(0, 300)}`,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'provider,indicator' },
      )

      c.set('tokens_used', 40)
      return c.json({ ...data, _cached: false })
    } catch (err) {
      console.error('ChileCompra proveedor error:', err)
      return c.json({ error: 'Error al consultar Mercado Público', detail: String(err) }, 502)
    }
  }

  // ── Sin RUT: licitaciones de hoy ───────────────────────────────────────────
  try {
    const today = new Date()
    const dateStr = [
      String(today.getDate()).padStart(2, '0'),
      String(today.getMonth() + 1).padStart(2, '0'),
      today.getFullYear(),
    ].join('%2F')

    const licitUrl = `${MP_BASE}/licitaciones.json?estado=publicada&fecha=${dateStr}&ticket=${ticket}`
    const res = await fetch(licitUrl, { signal: AbortSignal.timeout(12_000) })
    if (!res.ok) throw new Error(`Licitaciones error ${res.status}`)

    const data = await res.json()
    c.set('tokens_used', 40)
    return c.json(data)
  } catch (err) {
    console.error('ChileCompra licitaciones error:', err)
    return c.json({ error: 'Error al consultar licitaciones', detail: String(err) }, 502)
  }
}
