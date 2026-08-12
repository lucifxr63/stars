import { getSupabase } from '../middleware/auth.ts'
import { sendOpsAlert } from '../../_shared/opsAlert.ts'
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
// El tipo de retorno va anotado a propósito. Sin él, TypeScript infiere el
// objeto literal exacto y RECHAZA los campos que varios handlers agregan al
// meta (`base`, `excluido`, `cobertura`…), así que `deno check` fallaba sobre
// este archivo desde antes de agosto: nadie podía chequearlo de tipos.
const buildAnimusMeta = (page = 1, pageSize = 20, total = 0, source = 'mercado_publico'): Record<string, unknown> => ({
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

// `buildBralidusMeta` vivía acá como alias y no lo usaba nadie: quedó del
// renombre a `buildAnimus*`. Se elimina en vez de mantenerlo "por las dudas".
const buildBralidusResponse = buildAnimusResponse

const withOfficialUrl = (item: any) => {
  if (!item) return item
  const code = item.external_code || item.codigo_externo || item.codigo || ''
  const isAgile = item.source_type === 'agile_purchase' || item.source_type === 'compra_agil' || String(code).toLowerCase().includes('cot')
  // Compra Ágil vive en su propio subdominio. La ruta anterior
  // (www.mercadopublico.cl/CompraAgil/Ficha/<code>) responde 200 con una página
  // vacía en vez de 404, así que el link parecía válido sin serlo: quien lo
  // seguía no llegaba a la cotización.
  const url = isAgile
    ? `https://compra-agil.mercadopublico.cl/resumen-cotizacion/${encodeURIComponent(code)}`
    : `https://www.mercadopublico.cl/Procurement/Modules/RFBA/Details.aspx?code=${encodeURIComponent(code)}`
  return {
    ...item,
    official_url: item.official_url || url
  }
}

/**
 * Umbral de plausibilidad de la tendencia de benchmarks.
 *
 * El histórico de Licitus está incompleto, así que el período anterior queda
 * casi vacío y el porcentaje se dispara: medido el 2026-08-03, este endpoint
 * devolvía `tendencia_vs_periodo_anterior_pct: 47208.5`. Un 47.208 % no es una
 * tendencia, es un artefacto de dividir por casi cero.
 *
 * BralidusPY YA descarta estos valores al armar el contexto del LLM
 * (`_benchmark_lines` en api/licitus.py, con test propio), con el mismo umbral
 * de ±300 %. Pero el endpoint crudo no aplicaba ese criterio y entregaba el
 * número tal cual a cualquier consumidor de la API — incluido el servidor MCP,
 * donde un modelo lo repetiría como dato duro.
 *
 * Se extiende la misma regla al borde de la API: si no es plausible, el campo
 * se anula y se explica por qué. Anular y decirlo es preferible a omitir en
 * silencio: quien lo consumía sigue encontrando la clave, con un motivo.
 */
const TENDENCIA_MAX_PLAUSIBLE = 300

const sanearTendencia = (payload: any): any => {
  const vol = payload?.data?.volumen ?? payload?.volumen
  if (!vol || typeof vol !== 'object') return payload

  const t = Number(vol.tendencia_vs_periodo_anterior_pct)
  if (Number.isFinite(t) && Math.abs(t) > TENDENCIA_MAX_PLAUSIBLE) {
    vol.tendencia_vs_periodo_anterior_pct = null
    vol.tendencia_omitida_motivo =
      `Valor descartado (${t}%): el histórico de la fuente está incompleto y el ` +
      `período anterior queda casi vacío, así que el porcentaje no es interpretable. ` +
      `Umbral de plausibilidad: ±${TENDENCIA_MAX_PLAUSIBLE}%.`
  }
  return payload
}

const benchmarksBase = licitusProxyHandler(() => '/mercado/benchmarks', 30)

export const licitusBenchmarksHandler = async (c: any) => {
  const res = await benchmarksBase(c)
  try {
    const payload = await res.clone().json()
    return c.json(sanearTendencia(payload), res.status)
  } catch {
    // Si no es JSON parseable, se devuelve tal cual: sanear no debe romper una
    // respuesta que ya venía mal.
    return res
  }
}
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
  } catch (err) {
    // Caer a Licitus ante un fallo de la canónica es deliberado, pero el `catch {}`
    // vacío que había acá se tragaba el error sin dejar rastro: una consulta rota
    // y una tabla legítimamente vacía producían exactamente la misma respuesta, y
    // no había forma de distinguirlas desde afuera ni desde los logs.
    console.error('licitusActivasHandler: la consulta canónica falló, se cae a Licitus:', err)
  }
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

// ── Respaldo en vivo: Licitus ────────────────────────────────────────────────
//
// Cuando la tabla canónica está vacía (la ingesta `mp-sync` todavía no existe
// en este proyecto), estos endpoints NO inventan registros: se consulta Licitus
// —que sí tiene Mercado Público en vivo— y se traduce su shape al vocabulario
// canónico de Animus.
//
// Por qué existe este comentario: antes había acá un dataset de 12 registros
// hardcodeados cuyo `published_at` se calculaba como `now - N horas` en CADA
// request. Dos llamadas seguidas devolvían fechas distintas para el mismo
// `external_code`, y los `official_url` apuntaban a fichas inexistentes. Un
// integrador lo detectó en minutos. No se repone: si Licitus tampoco responde,
// se devuelve 503 y se dice por qué.

const LICITUS_MAX_LIMIT = 100

// Licitus usa la nomenclatura de ChileCompra (COT = cotización de Compra Ágil;
// LE/LP/LR = licitaciones). El vocabulario canónico sólo distingue
// agile_purchase vs tender.
const licitusSourceType = (tipo: string) =>
  String(tipo ?? '').toUpperCase() === 'COT' ? 'agile_purchase' : 'tender'

const mapLicitusItem = (item: any) => {
  const codigo = item?.codigo ?? ''
  const tipo = String(item?.tipo ?? '').toUpperCase()
  const unspsc = Array.isArray(item?.unspsc) ? (item.unspsc[0] ?? null) : (item?.unspsc ?? null)
  return withOfficialUrl({
    id: codigo,
    external_code: codigo,
    source_type: licitusSourceType(tipo),
    process_type: tipo || null,
    title: item?.nombre ?? null,
    buyer_name: item?.organismo ?? null,
    // Licitus no expone el RUT del organismo ni la fecha de publicación en
    // /mercado/activas: su ventana es "lo que cierra pronto". Quedan en null en
    // vez de rellenarse — un null es un dato, un valor inventado no lo es.
    buyer_org_code: null,
    published_at: null,
    status_code: 'activa',
    closing_at: item?.fecha_cierre ?? null,
    hours_to_close: item?.horas_para_cierre ?? null,
    estimated_amount_clp: item?.monto_estimado_clp ?? null,
    currency: 'CLP',
    region: typeof item?.region === 'string' ? item.region.trim() : null,
    unspsc_code: unspsc,
    data_source: 'licitus_live',
  })
}

// Devuelve { items, sourceOk } o { items: [], sourceOk: false, error } — nunca
// lanza. `sourceOk` distingue dos situaciones que NO son lo mismo:
//   · sourceOk=false → Licitus no respondió (o no está configurado) ⇒ 503.
//   · sourceOk=true con items=[] → Licitus respondió bien y no hay filas para
//     ese filtro ⇒ 200 con lista vacía. Devolver 503 acá sería mentir sobre la
//     salud de la fuente.
async function fetchLicitusActivas(
  opts: { type?: string; q?: string } = {},
): Promise<{ items: any[]; sourceOk: boolean; error?: string }> {
  if (!BRALIDUS_URL) {
    return { items: [], sourceOk: false, error: 'BRALIDUS_URL no configurado en este entorno' }
  }
  try {
    const target = `${BRALIDUS_URL.replace(/\/$/, '')}/licitus/mercado/activas?limit=${LICITUS_MAX_LIMIT}`
    const res = await fetch(target, {
      headers: BRALIDUS_API_KEY ? { 'Authorization': `Bearer ${BRALIDUS_API_KEY}` } : {},
      signal: AbortSignal.timeout(12_000),
    })
    if (!res.ok) return { items: [], sourceOk: false, error: `Licitus respondió HTTP ${res.status}` }

    const body = await res.json().catch(() => null)
    const raw = body?.data?.items ?? body?.items ?? (Array.isArray(body?.data) ? body.data : [])
    let items = (Array.isArray(raw) ? raw : []).map(mapLicitusItem)

    const type = opts.type && opts.type !== 'all' ? opts.type : null
    if (type) {
      const wanted = type.split(',').map((t: string) => t.trim())
      items = items.filter((i) => wanted.includes(i.source_type))
    }
    if (opts.q) {
      const needle = opts.q.toLowerCase()
      items = items.filter((i) =>
        String(i.title ?? '').toLowerCase().includes(needle) ||
        String(i.buyer_name ?? '').toLowerCase().includes(needle) ||
        String(i.external_code ?? '').toLowerCase().includes(needle)
      )
    }
    return { items, sourceOk: true }
  } catch (err) {
    return { items: [], sourceOk: false, error: `Licitus inalcanzable: ${String(err)}` }
  }
}

// Pagina en memoria la ventana de Licitus: su endpoint acepta `limit` pero no
// offset, así que recibimos hasta 100 y recortamos acá para que `page` y
// `page_size` signifiquen algo. El fallback anterior ignoraba ambos y devolvía
// siempre el dataset entero, con un meta incoherente.
const paginate = <T>(items: T[], page: number, pageSize: number) =>
  items.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize)

// Meta con procedencia explícita, para que el consumidor sepa si está leyendo
// la tabla canónica o la ventana en vivo de Licitus.
const licitusMeta = (page: number, pageSize: number, total: number, extraNote?: string) => ({
  ...buildAnimusMeta(page, pageSize, total, 'licitus_live'),
  note:
    `Ventana en vivo de Licitus (hasta ${LICITUS_MAX_LIMIT} procesos abiertos, ordenados por cierre próximo). ` +
    'La ingesta canónica mp-sync todavía no puebla licitaciones_mercado_publico, por lo que published_at no está disponible en esta fuente.' +
    (extraNote ? ` ${extraNote}` : ''),
})

// La fuente respondió bien pero no hay filas para este filtro. Es un 200 con
// lista vacía, NO un 503: el consumidor necesita poder distinguir "no hay nada
// que mostrar" de "la fuente está caída", y un error de servidor para el primer
// caso rompe reintentos y alertas aguas abajo.
const emptyButHealthy = (c: any, page: number, pageSize: number, coverage: string) =>
  c.json({ data: [], meta: licitusMeta(page, pageSize, 0, coverage) })

// Cobertura real de la fuente viva, verificada el 2026-07-29: Licitus
// /mercado/activas devuelve exclusivamente cotizaciones de Compra Ágil (COT) —
// 100 de 100 en ventanas de 7, 30 y 90 días sobre 778 resultados totales. Las
// licitaciones LE/LP/LR no tienen fuente conectada hasta que exista mp-sync.
const COVERAGE_TENDERS =
  'Cobertura actual: la fuente viva (Licitus) sólo publica Compra Ágil (COT); las licitaciones LE/LP/LR no tienen origen conectado hasta que se implemente la ingesta mp-sync. Para procesos abiertos hoy, usar /mercado-publico/compra-agil.'

// 503 sólo cuando la fuente realmente falló: sin BRALIDUS_URL, HTTP no-2xx o
// timeout. Nunca por ausencia de filas.
const sourceUnavailable = (c: any, detail?: string) => {
  // Un 503 acá lo ve el INTEGRADOR: es el gateway público quedándose sin nada
  // que servir. Es de las pocas cosas de api-v1 que justifican despertar a
  // alguien, así que va a incidentes. El dedupe por código evita que una caída
  // sostenida inunde el canal request por request.
  void sendOpsAlert({
    level: 'error',
    channel: 'incidentes',
    title: 'Gateway sin fuente de Mercado Público',
    detail: 'La tabla canónica está vacía y Licitus no respondió. Los endpoints B2G devuelven 503.',
    fields: [
      { name: 'Endpoint', value: new URL(c.req.url).pathname },
      ...(detail ? [{ name: 'Detalle', value: detail.slice(0, 300), inline: false }] : []),
    ],
    footer: 'api-v1',
    dedupeKey: 'api-v1-source-unavailable',
  })

  return c.json(
    buildAnimusResponse(null, 1, 20, 0, 'mercado_publico', [{
      code: 'SOURCE_UNAVAILABLE',
      message: 'Sin datos de Mercado Público: la tabla canónica está vacía y Licitus no respondió.',
      ...(detail ? { detail } : {}),
    }]),
    503,
  )
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

    // ── Filtros de servidor ────────────────────────────────────────────────────
    //
    // Antes sólo había q/type/status. Un integrador reportó que al buscar sobre
    // el universo (4.659 resultados) tenía que DESACTIVAR sus filtros de monto,
    // cierre y organismo, porque aplicarlos sobre la página ya traída producía
    // "4.659 resultados" mostrando 3. Filtrar en el cliente sobre una página no
    // es filtrar: es mentir sobre el total.
    //
    // Van sobre la consulta, así que `count: 'exact'` los refleja en meta.total.
    // `buyer_region` y `buyer_rut` tienen índice desde la migración
    // 20260811000001; el resto son columnas ya indexadas o de baja cardinalidad.
    const region = c.req.query('region')
    const buyerRut = c.req.query('buyer_rut') || c.req.query('buyer_id')
    const buyerName = c.req.query('buyer_name')
    const amountMin = c.req.query('amount_min')
    const amountMax = c.req.query('amount_max')
    const closingFrom = c.req.query('closing_from')
    const closingTo = c.req.query('closing_to')

    // Orden configurable. El defecto sigue siendo `published_at desc` — se
    // documenta en vez de dejarlo implícito, que era la queja real: no que
    // estuviera mal, sino que no estuviera declarado.
    const ORDENES: Record<string, string> = {
      closing_at: 'closing_at',
      published_at: 'published_at',
      amount_estimated: 'amount_estimated',
    }
    const sortParam = (c.req.query('sort') ?? 'published_at').trim()
    const desc = (c.req.query('order') ?? 'desc').toLowerCase() !== 'asc'
    const sortCol = ORDENES[sortParam]
    if (!sortCol) {
      return c.json(
        buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [{
          code: 'INVALID_PARAM',
          message: `sort debe ser uno de: ${Object.keys(ORDENES).join(', ')}`,
        }]),
        400,
      )
    }

    let query = supabase
      .from('licitaciones_mercado_publico')
      .select('*', { count: 'exact' })
      // nullsFirst:false para que las filas sin el dato no acaparen la primera
      // página al ordenar por monto o por cierre, que es justo donde más faltan.
      .order(sortCol, { ascending: !desc, nullsFirst: false })

    if (typeParam) {
      const types = typeParam.split(',').map((t: string) => t.trim())
      query = query.in('source_type', types)
    }
    if (statusParam) query = query.eq('status_code', statusParam)
    if (q) query = query.ilike('title', `%${q}%`)
    if (region) query = query.ilike('buyer_region', `%${region}%`)
    if (buyerRut) query = query.eq('buyer_rut', buyerRut)
    if (buyerName) query = query.ilike('buyer_name', `%${buyerName}%`)
    if (closingFrom) query = query.gte('closing_at', closingFrom)
    if (closingTo) query = query.lte('closing_at', closingTo)
    // El monto se filtra sólo cuando es comparable: `amount_estimated = 0` con
    // `amount_is_public = false` significa "el organismo lo ocultó", no cero. Un
    // amount_min los descartaría como si fueran baratos, y amount_max los
    // incluiría como si fueran gratis. En ambos casos se excluyen los ocultos.
    if (amountMin) query = query.gte('amount_estimated', amountMin).not('amount_is_public', 'is', false)
    if (amountMax) query = query.lte('amount_estimated', amountMax).not('amount_is_public', 'is', false)

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)
    // Acá había un fallback a la tabla `opportunities`, que no existe en este
    // proyecto (vive en el de Licitus): era código muerto que además habría
    // lanzado su propio error. Se elimina; si la consulta canónica falla, se
    // reporta el fallo real.
    if (error) throw error

    const mappedData = (data ?? []).map(withOfficialUrl)

    // El fallback a Licitus sólo sabe filtrar por `type` y `q`. Con cualquier
    // filtro nuevo aplicado, caer ahí devolvería resultados que NO cumplen lo
    // que se pidió —una búsqueda por región del Biobío contestada con procesos
    // de todo Chile— y sin forma de notarlo desde afuera. Es la misma clase de
    // engaño que estos filtros vinieron a eliminar. Si la consulta canónica no
    // trae nada bajo filtros, la respuesta honesta es "cero".
    const usaFiltrosNuevos = Boolean(
      region || buyerRut || buyerName || amountMin || amountMax || closingFrom || closingTo,
    )

    if (mappedData.length === 0 && !usaFiltrosNuevos) {
      const { items, sourceOk, error: licitusError } = await fetchLicitusActivas({ type: typeParam, q })
      if (!sourceOk) return sourceUnavailable(c, licitusError)
      if (items.length === 0) return emptyButHealthy(c, page, pageSize, COVERAGE_TENDERS)
      c.set('tokens_used', 25)
      return c.json({ data: paginate(items, page, pageSize), meta: licitusMeta(page, pageSize, items.length) })
    }

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
    if (!data) {
      // Sin fila canónica, se busca el proceso en la ventana viva de Licitus
      // antes de declarar 404: puede estar abierto y simplemente no ingestado.
      const { items } = await fetchLicitusActivas()
      const live = items.find((i) => i.id === id || i.external_code === id)
      if (live) {
        c.set('tokens_used', 15)
        return c.json({ data: live, meta: licitusMeta(1, 1, 1) })
      }
      return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{ code: 'NOT_FOUND', message: `Oportunidad ${id} no encontrada` }]), 404)
    }

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

    if (mappedData.length === 0) {
      const { items, sourceOk, error: licitusError } = await fetchLicitusActivas({ type: 'tender', q })
      if (!sourceOk) return sourceUnavailable(c, licitusError)
      if (items.length === 0) return emptyButHealthy(c, page, pageSize, COVERAGE_TENDERS)
      c.set('tokens_used', 25)
      return c.json({ data: paginate(items, page, pageSize), meta: licitusMeta(page, pageSize, items.length) })
    }

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
// Las órdenes de compra viven en el OTRO proyecto de Animus
// (`purchase_orders`, szzibobuwgcopewmnkkl). Durante meses esto respondió 501
// porque el gateway no lo consultaba; desde la migración 20260805000005 ese
// proyecto está montado acá por `postgres_fdw` y se lee en vivo a través de las
// vistas `public.mp_ordenes_compra` / `…_items` (20260805000007).
//
// Sigue siendo cierto que la tabla canónica NO debe absorberlas: modela
// mecanismos de contratación, no órdenes post-adjudicación. Por eso se leen de
// donde están y no se copian.
//
// ⚠️ EL 58 % DE LAS ÓRDENES SON CÁSCARAS, y por eso este handler no devuelve
// todo lo que hay. `sync-ordenes` inserta el identificador y `enrich-ordenes`
// lo completa después. Al 2026-08-05 el segundo figura como «NUNCA TERMINA
// (huérfanas)»: de 125.273 órdenes sólo 52.188 tienen contenido, y **todo lo
// creado después del 16-jul está sin completar** — cero organismo, cero
// proveedor, cero monto, cero ítems.
//
// Devolver esas filas sería servir un identificador con forma de dato: el
// mismo defecto que se pasó agosto cerrando en el RAG. Se filtran, y el
// tamaño del hueco viaja en `meta.enriquecimiento_pendiente` para que el
// consumidor sepa que existe en vez de descubrirlo por un total que no cuadra.

const OC_COBERTURA =
  'Sólo se listan órdenes con contenido. Las pendientes de enriquecimiento traen ' +
  'el identificador pero ningún dato, y se omiten a propósito.'

/**
 * Enlaces de una orden de compra. Las licitaciones pasaban por `withOfficialUrl`
 * desde siempre; las OC eran los ÚNICOS handlers que no, así que salían sin
 * ningún enlace: el consumidor recibía un `external_code` y ninguna forma de
 * llegar al documento.
 *
 * FORMATO VERIFICADO CONTRA UN CONTROL (2026-08-12). Acá no basta con un 200:
 * mercadopublico.cl devuelve 200 con una página vacía para códigos inexistentes
 * —ya pasó con Compra Ágil y un integrador lo reportó—. Se comprobó pidiendo
 * 4968-1045-SE26 y un código inventado: la real muestra "TIC SERVICES",
 * "QUILPUE" y "1.639.225"; la inventada no muestra ninguno de los tres.
 *
 * `licitacion_url` sólo se arma cuando hay código de origen. MP manda cadena
 * VACÍA —no null— en las órdenes que no vienen de una licitación (trato directo,
 * convenio marco), y un enlace con `?code=` en blanco lleva a un buscador vacío
 * que parece un error del producto.
 */
const withOrdenUrls = (oc: any) => {
  if (!oc) return oc
  const codigo = oc.external_code ?? oc.codigo ?? ''
  const licitacion = String(oc.licitation_code ?? '').trim()

  return {
    ...oc,
    official_url:
      oc.official_url ||
      `https://www.mercadopublico.cl/PurchaseOrder/Modules/PO/DetailsPurchaseOrder.aspx?codigoOC=${encodeURIComponent(codigo)}`,
    licitacion_url: licitacion
      ? `https://www.mercadopublico.cl/Procurement/Modules/RFBA/Details.aspx?code=${encodeURIComponent(licitacion)}`
      : null,
  }
}

// GET /api/v1/mercado-publico/ordenes-compra
export const mercadoPublicoOrdenesHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const page = Math.max(Number(c.req.query('page') ?? 1), 1)
    const pageSize = Math.min(Number(c.req.query('page_size') ?? 20), 100)
    const offset = (page - 1) * pageSize

    const rutProveedor = c.req.query('rut_proveedor') || c.req.query('supplier_code')
    const codigoOrganismo = c.req.query('codigo_organismo') || c.req.query('buyer_org_code')
    const estado = c.req.query('estado') || c.req.query('state_code')
    const fecha = c.req.query('fecha') || c.req.query('fecha_inicio')
    const fechaFin = c.req.query('fecha_fin')

    let query = supabase
      .from('mp_ordenes_compra')
      .select('*', { count: 'exact' })
      .eq('enriquecida', true)
      .order('issued_at', { ascending: false })

    if (rutProveedor) query = query.eq('supplier_code', rutProveedor)
    if (codigoOrganismo) query = query.eq('buyer_org_code', codigoOrganismo)
    if (estado) query = query.eq('state_code', estado)
    if (fecha) query = query.gte('issued_at', fecha)
    if (fechaFin) query = query.lte('issued_at', fechaFin)

    const { data, count, error } = await query.range(offset, offset + pageSize - 1)
    if (error) throw error

    // El conteo de pendientes se pide aparte y sin traer filas: es una señal de
    // salud de la ingesta, no parte del resultado.
    const { count: pendientes } = await supabase
      .from('mp_ordenes_compra')
      .select('external_code', { count: 'exact', head: true })
      .eq('enriquecida', false)

    // Sin `emptyButHealthy`: ese helper marca la fuente como Licitus, y estas
    // órdenes no vienen de su API sino de nuestra propia base. Un cero acá es
    // un cero legítimo del filtro, no una fuente caída.
    c.set('tokens_used', 25)
    const res = buildBralidusResponse((data ?? []).map(withOrdenUrls), page, pageSize, count ?? 0)
    res.meta.cobertura = OC_COBERTURA
    res.meta.enriquecimiento_pendiente = pendientes ?? 0
    return c.json(res)
  } catch (err) {
    return c.json(buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

// GET /api/v1/mercado-publico/ordenes-compra/:codigo_oc
export const mercadoPublicoOrdenDetailHandler = async (c: any) => {
  const codigo = c.req.param('codigo_oc') || c.req.param('id') || c.req.param('code')
  try {
    const supabase = getSupabase()

    const { data: orden, error } = await supabase
      .from('mp_ordenes_compra')
      .select('*')
      .eq('external_code', codigo)
      .maybeSingle()
    if (error) throw error

    if (!orden) {
      return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico',
        [{ code: 'NOT_FOUND', message: `Orden de compra ${codigo} no encontrada` }]), 404)
    }

    // Una orden sin enriquecer existe pero no dice nada. Decirlo es más honesto
    // que devolver un objeto con todos los campos en null, que el consumidor
    // leería como «no tiene proveedor» en vez de «no lo sabemos todavía».
    if (!orden.enriquecida) {
      return c.json(buildBralidusResponse(null, 1, 1, 0, 'mercado_publico', [{
        code: 'PENDING_ENRICHMENT',
        message: `La orden ${codigo} está registrada pero su detalle todavía no se descargó de ChileCompra. No se conocen su organismo, proveedor, monto ni ítems.`,
      }]), 409)
    }

    const { data: items, error: errItems } = await supabase
      .from('mp_ordenes_compra_items')
      .select('*')
      .eq('orden_external_code', codigo)
      .order('line_number', { ascending: true })
    if (errItems) throw errItems

    c.set('tokens_used', 15)
    return c.json(buildBralidusResponse({ ...withOrdenUrls(orden), items: items ?? [] }, 1, 1, 1))
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

/**
 * GET /api/v1/mercado-publico/ofertas
 *
 * La competencia real de las compras ágiles: quién cotizó, cuánto, quién ganó y
 * por qué se descartó al resto. Sale de `mp_ofertas`, extraída del payload donde
 * estaba enterrada (ver migración 20260804000005).
 *
 * Dos usos con el mismo endpoint, porque son la misma pregunta desde dos lados:
 *   ?codigo=1233619-464-COT26  -> quiénes compitieron por esta compra
 *   ?rut=89752800-2            -> cómo le va a este proveedor
 *
 * Con `rut` se agrega un `resumen` con su tasa de adjudicación, que es lo que
 * de verdad se quiere saber y que obligaría a paginar todo para calcularlo.
 *
 * LÍMITES QUE HAY QUE DECIR: sólo hay datos de COMPRA ÁGIL —licitaciones,
 * convenios marco y tratos directos no publican oferentes en esta fuente— y las
 * ofertas aparecen recién cuando el proceso concluye. De 24.043 compras ágiles,
 * 1.308 tienen ofertas: las 16.920 'publicada' y 5.400 'cerrada' todavía no.
 */
export const mercadoPublicoOfertasHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const page = Math.max(Number(c.req.query('page') ?? 1), 1)
    const pageSize = Math.min(Number(c.req.query('page_size') ?? 20), 100)
    const offset = (page - 1) * pageSize

    const codigo = c.req.query('codigo')
    const rutCrudo = c.req.query('rut')
    const soloAdjudicadas = c.req.query('solo_adjudicadas') === 'true'

    if (!codigo && !rutCrudo) {
      return c.json(
        buildBralidusResponse(null, page, pageSize, 0, 'mercado_publico', [{
          code: 'PARAM_REQUIRED',
          message: 'Se requiere `codigo` (external_code de una compra ágil) o `rut` (proveedor). Sin filtro serían 7.111 ofertas.',
        }]),
        400,
      )
    }

    // Mismo criterio que la extracción: sin puntos y con K en mayúscula. Si no
    // se normaliza acá, un RUT con puntos —que es como lo escribe cualquiera—
    // no encuentra nada y parece que el proveedor no existe.
    const rut = rutCrudo ? rutCrudo.replace(/[.\s]/g, '').toUpperCase() : null

    let query = supabase
      .from('mp_ofertas')
      .select('external_code, proveedor_rut, proveedor_razon_social, monto_neto, monto_total, adjudicada, admisible, motivo_inadmisibilidad, fecha_cotizacion', { count: 'exact' })

    if (codigo) query = query.eq('external_code', codigo)
    if (rut) query = query.eq('proveedor_rut', rut)
    if (soloAdjudicadas) query = query.eq('adjudicada', true)

    const { data, count, error } = await query
      .order('adjudicada', { ascending: false })
      .order('monto_total', { ascending: true, nullsFirst: false })
      .range(offset, offset + pageSize - 1)
    if (error) throw error

    const meta: Record<string, unknown> = {
      fuente: 'compras ágiles concluidas. Licitaciones, convenios marco y tratos directos no publican oferentes en esta fuente.',
    }

    // El resumen del proveedor no se puede calcular desde la página actual, y es
    // justamente el número por el que se consulta.
    if (rut) {
      const { data: todas } = await supabase
        .from('mp_ofertas')
        .select('adjudicada, monto_total')
        .eq('proveedor_rut', rut)
      const filas = todas ?? []
      const ganadas = filas.filter((o: any) => o.adjudicada)
      meta.resumen = {
        rut,
        ofertas_presentadas: filas.length,
        adjudicadas: ganadas.length,
        tasa_adjudicacion_pct: filas.length ? Number(((ganadas.length / filas.length) * 100).toFixed(1)) : 0,
        monto_adjudicado: ganadas.reduce((a: number, o: any) => a + Number(o.monto_total ?? 0), 0),
      }
    }

    c.set('tokens_used', 15)
    const respuesta = buildBralidusResponse(data ?? [], page, pageSize, count ?? 0)
    respuesta.meta = { ...respuesta.meta, ...meta }
    return c.json(respuesta)
  } catch (err) {
    return c.json(buildBralidusResponse(null, 1, 20, 0, 'mercado_publico', [{ code: 'SERVER_ERROR', message: String(err) }]), 500)
  }
}

/**
 * GET /api/v1/mercado-publico/precios
 *
 * Cuánto se paga en el Estado por un producto, según lo que cotizaron los
 * proveedores. Se apoya en `mp_precios_producto`, que hace el trabajo sucio:
 * descarta las líneas donde el proveedor metió la canasta entera como si fuera
 * un precio unitario, y devuelve cuartiles en vez de un número solo.
 *
 * Se devuelven p25/mediana/p75 y NO un "precio de mercado", porque un mismo
 * código UNSPSC agrupa productos heterogéneos: en 44103103 el rango
 * intercuartil es 1,5x —eso es un precio— y en otros llega a 6x, donde la
 * mediana es el promedio de cosas distintas. Cada fila trae su `fiabilidad`
 * para que quien la lea pueda distinguir un caso del otro.
 */
export const mercadoPublicoPreciosHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const codigo = c.req.query('codigo_producto') ?? null
    const q = c.req.query('q') ?? null
    const minN = Math.max(Number(c.req.query('min_muestras') ?? 5), 1)

    const { data, error } = await supabase.rpc('mp_precios_producto', {
      p_codigo: codigo,
      p_q: q,
      p_min_n: minN,
    })
    if (error) throw error

    const filas = data ?? []
    c.set('tokens_used', 20)
    const respuesta = buildBralidusResponse(filas, 1, filas.length, filas.length)
    respuesta.meta = {
      ...respuesta.meta,
      base: 'ofertas de compras ágiles concluidas',
      excluido: 'líneas con precio <= 1 (marcadores), cantidad = 1, y descripciones que remiten a un adjunto: son la canasta completa puesta como precio unitario',
      como_leer: 'Usa la mediana con el rango p25-p75. `ratio_p75_p25` alto significa que ese código agrupa productos distintos y la mediana NO representa un precio.',
    }
    return c.json(respuesta)
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
/**
 * POST /api/v1/data/exports — 501. No existe.
 *
 * ANTES FABRICABA. Devolvía, con HTTP 200:
 *
 *     export_id:    'exp_' + Math.random().toString(36)   ← inventado por llamada
 *     download_url: https://downloads.bralidus.com/...    ← dominio que NO resuelve
 *     status:       'READY'                               ← siempre
 *
 * O sea que le entregaba al consumidor un enlace de descarga que no podía
 * funcionar, afirmando que estaba listo. Comprobado el 2026-08-03: el dominio no
 * resuelve en DNS y dos llamadas seguidas devuelven ids distintos.
 *
 * Es el mismo patrón que ya se corrigió en las licitaciones inventadas (commit
 * e01c47e): una respuesta exitosa e indistinguible de una real, que miente.
 * Iba a ser peor acá, porque el servidor MCP lo habría expuesto a un modelo que
 * le diría al usuario "tu exportación está lista, descargala en este enlace".
 *
 * Implementar exportaciones de verdad es un proyecto —almacenamiento,
 * expiración, URLs firmadas— y no se justifica hasta que alguien lo pida. Un 501
 * es información honesta y se puede reemplazar el día que exista.
 */
export const exportsHandler = (c: any) =>
  notImplemented(
    c,
    'La exportación de datos no está implementada. La versión anterior devolvía un ' +
      'enlace de descarga inventado hacia un dominio inexistente; se retiró en vez de ' +
      'seguir prometiendo un archivo que nunca se generaba.',
  )

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

    const mappedData = (data ?? []).map(withOfficialUrl)

    if (mappedData.length === 0) {
      const { items, sourceOk, error: licitusError } = await fetchLicitusActivas({ type: 'agile_purchase', q })
      if (!sourceOk) return sourceUnavailable(c, licitusError)
      if (items.length === 0) {
        return emptyButHealthy(c, page, pageSize, 'Sin cotizaciones de Compra Ágil abiertas que coincidan con el filtro.')
      }
      c.set('tokens_used', 20)
      return c.json({ data: paginate(items, page, pageSize), meta: licitusMeta(page, pageSize, items.length) })
    }

    c.set('tokens_used', 20)
    return c.json(buildBralidusResponse(mappedData, page, pageSize, count ?? 0))
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
export const mercadoPublicoAiRecomendacionesHandler = (c: any) => {
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
