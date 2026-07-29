import { getSupabase } from '../middleware/auth.ts'
import { isValidRut, formatRutCanonical } from '../utils/validation.ts'
import { notImplemented } from './_honest.ts'

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
      .select('provider, indicator, data_json, updated_at')
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) {
      console.error('Macro data fetch error:', error)
      return c.json({ error: 'Failed to retrieve macro data' }, 500)
    }

    if (!rows || rows.length === 0) {
      return c.json({
        error: 'No macro data available',
        hint: 'No economic indicators found in economic_knowledge',
      }, 503)
    }

    const indicators: Record<string, unknown> = {}
    for (const row of rows) {
      const key = `${row.provider}_${row.indicator}`
      indicators[key] = {
        provider: row.provider,
        indicator: row.indicator,
        ...(row.data_json as Record<string, unknown>),
        _updated_at: row.updated_at,
      }
    }

    c.set('tokens_used', 30)
    return c.json({
      source: 'Animus Macroeconomic Intelligence (Multi-Provider)',
      indicators,
      count: rows.length,
    })

  } catch (err) {
    console.error('Macro data handler error:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

// GET /api/v1/data/chilecompra/metricas?rut={rut}
//
// Leía las métricas M1-M10 desde `chilecompra_metricas`, tabla que NO existe en
// este proyecto (verificado contra el esquema): la consulta lanzaba y el
// handler devolvía 500 en todos los casos.
//
// Para actividad real de compras públicas por proveedor está
// /api/v1/data/licitus/proveedor/:rut, que proxea a Licitus y sí tiene el dato.
export const chilecompraMetricasHandler = (c: any) =>
  notImplemented(
    c,
    'Métricas M1-M10 no disponibles: la tabla chilecompra_metricas no existe en este proyecto. Usar /api/v1/data/licitus/proveedor/:rut para actividad real del proveedor.',
    'chilecompra',
  )

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
// ── Bralidus REST Standard Response Helper ────────────────────────────────────
const buildAnimusMeta = (page = 1, pageSize = 20, total = 0, source = 'mercado_publico') => ({
  engine: 'Animus Engine v2.0',
  version: '2.0.0',
  source,
  timestamp: new Date().toISOString(),
  page,
  pageSize,
  total,
  totalPages: Math.ceil(total / Math.max(pageSize, 1))
})

const buildAnimusResponse = (data: any, page = 1, pageSize = 20, total = 0, source = 'mercado_publico', errors: any[] = []) => ({
  data,
  meta: buildAnimusMeta(page, pageSize, total, source),
  ...(errors.length > 0 ? { errors } : {})
})

const buildBralidusMeta = buildAnimusMeta
const buildBralidusResponse = buildAnimusResponse

const withOfficialUrl = (item: any) => {
  if (!item) return item
  const code = item.external_code || item.codigo_externo || item.codigo || ''
  const isAgile = item.source_type === 'agile_purchase' || item.source_type === 'compra_agil' || String(code).toLowerCase().includes('cot')
  const url = isAgile
    ? `https://www.mercadopublico.cl/CompraAgil/Ficha/${encodeURIComponent(code)}`
    : `https://www.mercadopublico.cl/Procurement/Modules/RFBA/Details.aspx?code=${encodeURIComponent(code)}`
  return {
    ...item,
    official_url: item.official_url || url
  }
}

export const licitusBenchmarksHandler = licitusProxyHandler(() => '/mercado/benchmarks', 30)
// GET /api/v1/data/licitus/mercado/activas?unspsc&region&monto_min&cierre_desde_horas&limit
export const licitusActivasHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const limit = Math.min(Number(c.req.query('limit') ?? 20), 100)
    const type = c.req.query('type')

    let query = supabase.from('licitaciones_mercado_publico').select('*', { count: 'exact' }).order('published_at', { ascending: false }).limit(limit)
    if (type) query = query.eq('source_type', type)

    const { data, count, error } = await query
    if (!error && data && data.length > 0) {
      c.set('tokens_used', 30)
      return c.json(buildBralidusResponse(data.map(withOfficialUrl), 1, limit, count ?? data.length))
    }
  } catch {}
  return licitusProxyHandler(() => '/mercado/activas', 30)(c)
}

// ── Mercado Público (API Prima Bralidus v1) ──────────────────────────────────

// GET /api/v1/mercado-publico/health
// Antes hardcodeaba `status: 'ok'` con ambas fuentes en `operational`: un
// endpoint de salud que era incapaz de reportar un problema. Ahora mide lo
// único que este gateway puede medir de verdad — si la tabla canónica responde
// y qué tan fresco es su dato — y degrada cuando corresponde.
export const mercadoPublicoHealthHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const { count, error } = await supabase
      .from('licitaciones_mercado_publico')
      .select('external_code', { count: 'exact', head: true })

    if (error) {
      return c.json(
        buildBralidusResponse(
          { status: 'error', detail: error.message },
          1, 1, 0, 'mercado_publico',
          [{ code: 'SOURCE_UNAVAILABLE', message: 'La tabla canónica no responde.' }],
        ),
        503,
      )
    }

    const { data: ultima } = await supabase
      .from('licitaciones_mercado_publico')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const horas = ultima?.updated_at
      ? (Date.now() - new Date(ultima.updated_at).getTime()) / 3_600_000
      : null

    // Sin filas o con dato de más de 48 h, la ingesta no está al día.
    const degradado = (count ?? 0) === 0 || horas === null || horas > 48

    return c.json(
      buildBralidusResponse(
        {
          status: degradado ? 'degraded' : 'ok',
          registros: count ?? 0,
          ultima_actualizacion: ultima?.updated_at ?? null,
          antiguedad_horas: horas === null ? null : Math.round(horas),
          detalle: degradado
            ? 'Sin datos o desactualizados: el servicio de ingesta mp-sync no ha escrito recientemente.'
            : null,
        },
        1, 1, count ?? 0,
      ),
      degradado ? 503 : 200,
    )
  } catch (err) {
    return c.json(
      buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [
        { code: 'SOURCE_UNAVAILABLE', message: String(err) },
      ]),
      503,
    )
  }
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

    let query = supabase.from('licitaciones_mercado_publico').select('*', { count: 'exact' }).order('published_at', { ascending: false })

    if (typeParam) {
      const types = typeParam.split(',').map((t: string) => t.trim())
      query = query.in('source_type', types)
    }
    if (statusParam) query = query.eq('status_code', statusParam)
    if (q) query = query.ilike('title', `%${q}%`)

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)
    // Acá había un fallback a la tabla `opportunities`, que no existe en este
    // proyecto (vive en el de Licitus): era código muerto que además habría
    // lanzado su propio error. Se elimina; si la consulta canónica falla, se
    // reporta el fallo real.
    if (error) throw error

    const mappedData = (data ?? []).map(withOfficialUrl)

    c.set('tokens_used', 25)
    return c.json(buildBralidusResponse(mappedData, page, pageSize, count ?? 0))
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
    const query = supabase.from('licitaciones_mercado_publico').select('*')
    const { data, error } = await (isUuid ? query.eq('id', id) : query.eq('external_code', id)).maybeSingle()

    if (error) throw error
    if (!data) return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'NOT_FOUND', message: `Oportunidad ${id} no encontrada` }]), 404)

    c.set('tokens_used', 15)
    return c.json(buildBralidusResponse(withOfficialUrl(data), 1, 1, 1))
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

    // Repuntado a la tabla canónica: `opportunities` vive en el proyecto de
    // Licitus, no en este, así que esta consulta siempre daba 500.
    // El equivalente de 'compra_agil' en el vocabulario canónico es
    // 'agile_purchase' (ver canonical.mapper.ts del servicio mp-sync).
    let query = supabase.from('licitaciones_mercado_publico').select('*', { count: 'exact' }).neq('source_type', 'agile_purchase').order('published_at', { ascending: false })

    if (q) query = query.ilike('title', `%${q}%`)
    if (codigoOrganismo) query = query.eq('buyer_org_code', codigoOrganismo)
    if (estado) query = query.eq('status_code', estado)
    if (fechaInicio) query = query.gte('published_at', fechaInicio)
    if (fechaFin) query = query.lte('published_at', fechaFin)

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error

    const mappedData = (data ?? []).map(withOfficialUrl)

    c.set('tokens_used', 25)
    return c.json(buildBralidusResponse(mappedData, page, pageSize, count ?? 0))
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
    // Repuntado a la tabla canónica (ver nota en el handler de listado).
    const query = supabase.from('licitaciones_mercado_publico').select('*')
    const { data, error } = await (isUuid ? query.eq('id', codigo) : query.eq('external_code', codigo)).maybeSingle()

    if (error) throw error
    if (!data) return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'NOT_FOUND', message: `Licitación ${codigo} no encontrada` }]), 404)

    c.set('tokens_used', 15)
    return c.json(buildBralidusResponse(withOfficialUrl(data), 1, 1, 1))
  } catch (err) {
    return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

// GET /api/v1/mercado-publico/ordenes-compra
// GET /api/v1/mercado-publico/ordenes-compra/:codigo_oc
//
// Las órdenes de compra NO están en este proyecto: viven en la base de Licitus
// (`purchase_orders`, proyecto szzibobuwgcopewmnkkl). Estos handlers las
// consultaban acá y por eso devolvían 500 siempre.
//
// Tampoco se pueden proxyar todavía: la superficie /licitus de BralidusPY
// expone proveedor, benchmarks y licitaciones activas, pero no un listado ni
// un detalle de OC. Hasta que exista ese endpoint, se responde 501 explícito.
//
// Nota: el servicio de ingesta mp-sync escribe las OC solo en la base de
// Licitus a propósito — la tabla canónica modela mecanismos de contratación,
// no órdenes post-adjudicación (ver plan del traspaso).
const OC_FUERA_DE_ALCANCE =
  'Órdenes de compra no disponibles en este gateway: se almacenan en la base de Licitus y aún no hay endpoint que las exponga. Para actividad de compras usar /api/v1/data/licitus/proveedor/:rut.'

export const mercadoPublicoOrdenesHandler = (c: any) =>
  notImplemented(c, OC_FUERA_DE_ALCANCE, 'mercado_publico')

export const mercadoPublicoOrdenDetailHandler = (c: any) =>
  notImplemented(c, OC_FUERA_DE_ALCANCE, 'mercado_publico')

// GET /api/v1/mercado-publico/organismos
export const mercadoPublicoOrganismosHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const page = Math.max(Number(c.req.query('page') ?? 1), 1)
    const pageSize = Math.min(Number(c.req.query('page_size') ?? 20), 100)
    const offset = (page - 1) * pageSize
    
    const nombre = c.req.query('nombre') || c.req.query('q')
    const rut = c.req.query('rut')

    // Repuntado a la tabla canónica: antes leía `purchase_orders`, que vive en
    // el proyecto de Licitus. Los organismos compradores también figuran acá,
    // y así este listado queda consistente con /organismos/:id.
    let query = supabase.from('licitaciones_mercado_publico').select('buyer_org_code, buyer_name', { count: 'exact' })

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

// ── FASE 2 COMERCIAL — ENDPOINTS DE ANALÍTICA, STREAMING Y GESTIÓN ─────────────

// 1. Analítica de Precios UNSPSC
export const mercadoPublicoAnaliticaPreciosHandler = (c: any) =>
  notImplemented(
    c,
    'Funcionalidad de analítica B2G no implementada. Los datos de Mercado Público disponibles se sirven en /api/v1/mercado-publico/opportunities, /compra-agil y /organismos/:id.',
  )

// 2. Historial de Compradores
export const mercadoPublicoCompradorHistorialHandler = (c: any) =>
  notImplemented(
    c,
    'Funcionalidad de analítica B2G no implementada. Los datos de Mercado Público disponibles se sirven en /api/v1/mercado-publico/opportunities, /compra-agil y /organismos/:id.',
  )

// 3. Perfil Competitivo de Proveedores
export const mercadoPublicoProveedorPerfilCompetitivoHandler = (c: any) =>
  notImplemented(
    c,
    'Funcionalidad de analítica B2G no implementada. Los datos de Mercado Público disponibles se sirven en /api/v1/mercado-publico/opportunities, /compra-agil y /organismos/:id.',
  )

// 4. Búsquedas Guardadas
export const mercadoPublicoBusquedasGuardadasHandler = (c: any) =>
  notImplemented(
    c,
    'Gestión de suscripciones (búsquedas guardadas, alertas, webhooks, exportaciones) no implementada: no hay persistencia detrás de estos endpoints.',
  )

// 5. Alertas Inteligentes
export const mercadoPublicoAlertasHandler = (c: any) =>
  notImplemented(
    c,
    'Gestión de suscripciones (búsquedas guardadas, alertas, webhooks, exportaciones) no implementada: no hay persistencia detrás de estos endpoints.',
  )

// 6. Webhooks Push Stream
export const mercadoPublicoWebhooksHandler = (c: any) =>
  notImplemented(
    c,
    'Gestión de suscripciones (búsquedas guardadas, alertas, webhooks, exportaciones) no implementada: no hay persistencia detrás de estos endpoints.',
  )

// 7. Exportaciones Masivas Enterprise
export const mercadoPublicoExportacionesHandler = (c: any) =>
  notImplemented(
    c,
    'Gestión de suscripciones (búsquedas guardadas, alertas, webhooks, exportaciones) no implementada: no hay persistencia detrás de estos endpoints.',
  )

// ── FASE 3 IA PREDICTIVA & MODALIDADES ESPECIALES — HANDLERS ──────────────────

// 1. Convenios Marco
export const mercadoPublicoConveniosMarcoHandler = (c: any) =>
  notImplemented(
    c,
    'Funcionalidad de analítica B2G no implementada. Los datos de Mercado Público disponibles se sirven en /api/v1/mercado-publico/opportunities, /compra-agil y /organismos/:id.',
  )

// 2. Grandes Compras
export const mercadoPublicoGrandesComprasHandler = (c: any) =>
  notImplemented(
    c,
    'Funcionalidad de analítica B2G no implementada. Los datos de Mercado Público disponibles se sirven en /api/v1/mercado-publico/opportunities, /compra-agil y /organismos/:id.',
  )

// 3. Consultas al Mercado (RFI)
export const mercadoPublicoConsultasMercadoHandler = (c: any) =>
  notImplemented(
    c,
    'Funcionalidad de analítica B2G no implementada. Los datos de Mercado Público disponibles se sirven en /api/v1/mercado-publico/opportunities, /compra-agil y /organismos/:id.',
  )

// 4. Tratos Directos
export const mercadoPublicoTratosDirectosHandler = (c: any) =>
  notImplemented(
    c,
    'Funcionalidad de analítica B2G no implementada. Los datos de Mercado Público disponibles se sirven en /api/v1/mercado-publico/opportunities, /compra-agil y /organismos/:id.',
  )

// 5. Scoring de Oportunidades AI
export const mercadoPublicoAiScoringHandler = (c: any) =>
  notImplemented(
    c,
    'Scoring/predicción por IA no implementado: no hay modelo detrás. Las versiones anteriores devolvían resultados fijos con apariencia de inferencia.',
  )

// 6. Predicción de Adjudicación AI
export const mercadoPublicoAiPrediccionHandler = (c: any) =>
  notImplemented(
    c,
    'Scoring/predicción por IA no implementado: no hay modelo detrás. Las versiones anteriores devolvían resultados fijos con apariencia de inferencia.',
  )

// ── SECCIÓN 2: DATOS ECONÓMICOS, MACRO & DOMINIOS ESTRUCTURADOS ──────────────────

// 1. Snapshot Económico Consolidado Chile
export const economyChileSnapshotHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 2. UF Actual e Histórica
export const economyChileUfHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 3. IPC Inflación
export const economyChileIpcHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 4. TPM Tasa de Política Monetaria
export const economyChileTpmHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 5. Imacec
export const economyChileImacecHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 6. Tipo de Cambio Dólar
export const economyChileExchangeRatesHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 7. Serie de Tiempo Normalizada
export const economySeriesHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 8. Cobre Spot & Futuros
export const commoditiesCopperHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 9. Estado de Insolvencia Empresa por RUT
export const companiesInsolvencyStatusHandler = (c: any) =>
  notImplemented(
    c,
    'Dato societario no disponible: proviene de S-Pulse y no está integrado en este gateway.',
  )

// 10. Simulación de Escenario IA Insights
export const insightsScenarioAnalysisHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 11. Catálogo de Indicadores Disponibles
export const economyIndicatorsHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 12. Publicaciones Económicas Reclamadas (Releases)
export const economyReleasesHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 13. Calendario Macroeconómico
export const economyCalendarHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 14. PIB Chile
export const economyChileGdpHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 15. Balanza Comercial
export const economyChileTradeBalanceHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 16. Informes IPoM
export const economyChileIpomHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 17. Global Snapshot
export const economyGlobalSnapshotHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 18. Commodities Snapshot
export const commoditiesSnapshotHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 19. IPSA Bolsa de Santiago
export const marketsChileIpsaHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 20. Entidades Fiscalizadas CMF
export const financialSystemEntitiesHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 21. Quiebras e Insolvencias
export const companiesInsolvenciesHandler = (c: any) =>
  notImplemented(
    c,
    'Dato societario no disponible: proviene de S-Pulse y no está integrado en este gateway.',
  )

// 22. Desempleo INE
export const laborUnemploymentHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 23. Remuneraciones INE
export const laborWagesHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 24. Proyectos de Inversión SEIA
export const investmentProjectsHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 25. Eventos Societarios Diario Oficial
export const companyEventsConstitutionsHandler = (c: any) =>
  notImplemented(
    c,
    'Dato societario no disponible: proviene de S-Pulse y no está integrado en este gateway.',
  )

// 26. Perfil Económico Unificado Empresa
export const companiesEconomicProfileHandler = (c: any) =>
  notImplemented(
    c,
    'Dato societario no disponible: proviene de S-Pulse y no está integrado en este gateway.',
  )

// 27. Métricas Públicas ChileCompra por RUT (Alias Canónico)
export const companiesPublicProcurementMetricsHandler = (c: any) =>
  notImplemented(
    c,
    'Funcionalidad de analítica B2G no implementada. Los datos de Mercado Público disponibles se sirven en /api/v1/mercado-publico/opportunities, /compra-agil y /organismos/:id.',
  )

// 28. Correlaciones Macroeconómicas
export const analyticsCorrelationsHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 29. Reporte IA Macro Brief
export const insightsMacroBriefHandler = (c: any) =>
  notImplemented(
    c,
    'Indicador macroeconómico no disponible: este gateway no tiene integración con la fuente oficial. Para datos macro reales usar GET /api/v1/data/economy o /api/v1/data/macro.',
  )

// 30. Generador de Exportaciones
export const exportsHandler = async (c: any) => {
  const body = await c.req.json().catch(() => ({}))
  const format = body.format || 'json'
  const data = {
    export_id: 'exp_' + Math.random().toString(36).substring(2, 9),
    format,
    download_url: `https://downloads.bralidus.com/exports/macro_data_${format}.gz`,
    status: 'READY'
  }

  c.set('tokens_used', 10)
  return c.json({ data })
}

// ── 31-36. S-Pulse: datos societarios ────────────────────────────────────────
//
// Estos seis endpoints devolvían datos INVENTADOS presentados como reales.
// Consultaban `company_profiles` / `company_ownership_meshes` —tablas que no
// existen en este proyecto Supabase— y, al fallar dentro de un `catch {}` mudo,
// respondían literales con la misma forma que una respuesta legítima y sin
// ningún `errors[]` que lo delatara.
//
// Lo devuelto era grave, no genérico:
//  - El perfil societario retornaba SIEMPRE "Electromedicina Chile SpA", con
//    capital social e inscripción de Registro de Comercio inventados, para
//    cualquier RUT consultado.
//  - La malla societaria atribuía a una PERSONA REAL, con nombre y RUT, el 60%
//    de propiedad de cualquier empresa que se consultara.
//  - El detector de conflictos B2G respondía siempre `conflict_detected: false`:
//    un control de conflicto de interés incapaz de detectar uno.
//
// Estos datos viven de verdad en S-Pulse (grafo societario en Neo4j), no en
// Supabase. Ahora se proxean allá con `spulseProxyHandler`, que ya se usa para
// el resto de `/data/spulse/*` y responde 503 honesto cuando el servicio no
// está disponible — que es justamente el estado actual de S-Pulse.
export const companyProfileHandler = spulseProxyHandler(
  (c) => `/companies/${formatRutCanonical(c.req.param('rut') ?? '')}/profile`,
  15,
  true,
)

export const companyOwnershipMeshHandler = spulseProxyHandler(
  (c) => `/companies/${formatRutCanonical(c.req.param('rut') ?? '')}/network`,
  25,
  true,
)

export const companyLegalRepsHandler = spulseProxyHandler(
  (c) => `/entities/${formatRutCanonical(c.req.param('rut') ?? '')}`,
  15,
  true,
)

export const companyRelatedPartiesHandler = spulseProxyHandler(
  (c) => `/companies/${formatRutCanonical(c.req.param('rut') ?? '')}/network`,
  20,
  true,
)

// Sin equivalente en S-Pulse: la detección de conflictos B2G requiere cruzar el
// grafo societario con los compradores de Mercado Público, y ese cruce no está
// construido. Antes respondía "sin conflictos" siempre, que es la peor
// respuesta posible para un control de este tipo.
export const companyB2GConflictsHandler = (c: any) =>
  notImplemented(
    c,
    'Detección de conflictos B2G no implementada: requiere cruzar el grafo societario de S-Pulse con los compradores de Mercado Público. La versión anterior respondía "sin conflictos" sin comprobar nada.',
    's_pulse',
  )

export const companySearchHandler = spulseProxyHandler(() => '/companies/search', 10)



// ─────────────────────────────────────────────────────────────────────────────
// Handlers que index.ts importaba pero data.ts nunca exportó.
//
// El commit 8931f8e ("Bralidus v2.0 domain-driven routes") registró estas tres
// rutas e importó sus handlers, pero no llegó a escribirlos. Deno resuelve los
// imports al arrancar, así que la función entera moría con BOOT_ERROR y el
// gateway completo respondía 503 — no solo estas rutas.
//
// Se implementan contra `licitaciones_mercado_publico`, que es la tabla que
// existe en ESTE proyecto (fcdhcntyvsydnvjwopfe) y la que puebla el servicio
// de ingesta mp-sync. Ojo: varios handlers vecinos consultan `purchase_orders`
// / `opportunities`, que viven en el proyecto de Licitus y NO existen acá —
// por eso responden 500. Es deuda aparte, anterior a este arreglo.
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/v1/mercado-publico/compra-agil
// Procesos de Compra Ágil (COT, ≤100 UTM). En la tabla canónica son las filas
// con source_type = 'agile_purchase'.
export const mercadoPublicoCompraAgilHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const page = Math.max(Number(c.req.query('page') ?? 1), 1)
    const pageSize = Math.min(Number(c.req.query('page_size') ?? 20), 100)
    const offset = (page - 1) * pageSize
    const q = c.req.query('q')
    const estado = c.req.query('estado') || c.req.query('status')

    let query = supabase
      .from('licitaciones_mercado_publico')
      .select('*', { count: 'exact' })
      .eq('source_type', 'agile_purchase')
      .order('published_at', { ascending: false })

    if (q) query = query.ilike('title', `%${q}%`)
    if (estado) query = query.eq('status_code', estado)

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error

    c.set('tokens_used', 20)
    return c.json(buildBralidusResponse((data ?? []).map(withOfficialUrl), page, pageSize, count ?? 0))
  } catch (err) {
    return c.json(
      buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]),
      500,
    )
  }
}

// GET /api/v1/mercado-publico/organismos/:id
// Ficha de un organismo comprador: sus datos + actividad licitatoria agregada.
export const mercadoPublicoCompradorHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const id = c.req.param('id')
    const pageSize = Math.min(Number(c.req.query('page_size') ?? 20), 100)

    const { data, error } = await supabase
      .from('licitaciones_mercado_publico')
      .select('*', { count: 'exact' })
      .eq('buyer_org_code', id)
      .order('published_at', { ascending: false })
      .limit(pageSize)

    if (error) throw error

    if (!data || data.length === 0) {
      return c.json(
        buildBralidusResponse(null, 1, pageSize, 0, 'mercado_publico', [
          { code: 'NOT_FOUND', message: `Organismo '${id}' sin registros` },
        ]),
        404,
      )
    }

    const montos = data.map((r: any) => Number(r.amount_estimated) || 0)
    const perfil = {
      buyer_org_code: id,
      buyer_name: data[0].buyer_name,
      buyer_rut: data[0].buyer_rut,
      total_procesos: data.length,
      monto_total: montos.reduce((a: number, b: number) => a + b, 0),
      monto_promedio: montos.length ? montos.reduce((a: number, b: number) => a + b, 0) / montos.length : 0,
      ultima_publicacion: data[0].published_at,
      procesos_recientes: data.map(withOfficialUrl),
    }

    c.set('tokens_used', 20)
    return c.json(buildBralidusResponse(perfil, 1, pageSize, data.length))
  } catch (err) {
    return c.json(
      buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]),
      500,
    )
  }
}

// GET /api/v1/mercado-publico/ai/recomendaciones/:rut
// Sin implementar: requiere el motor de matching, que vive en Licitus y no está
// expuesto acá. Se responde 501 explícito en vez de devolver recomendaciones
// inventadas, que es lo peor que puede hacer un endpoint de este tipo.
export const mercadoPublicoAiRecomendacionesHandler = async (c: any) => {
  return c.json(
    buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [
      {
        code: 'NOT_IMPLEMENTED',
        message:
          'Recomendaciones por RUT aún no disponibles: dependen del motor de matching de Licitus.',
      },
    ]),
    501,
  )
}
