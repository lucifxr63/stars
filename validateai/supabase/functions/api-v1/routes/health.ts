import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const LLAMAPARSE_API_KEY = Deno.env.get('LLAMAPARSE_API_KEY')
const CMF_BEST_KEY = Deno.env.get('CMF_BEST_KEY')
const FINTOC_SECRET_KEY = Deno.env.get('FINTOC_SECRET_KEY')
const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
const FRED_API_KEY = Deno.env.get('FRED_API_KEY')
const BDE_USER = Deno.env.get('BDE_USER')
const BRALIDUS_API_KEY = Deno.env.get('BRALIDUS_API_KEY')
const BRALIDUS_URL = Deno.env.get('BRALIDUS_URL') ?? 'https://braliduspy-production.up.railway.app'

type ServiceStatus = 'ok' | 'degraded' | 'error' | 'unused'

interface ServiceInfo {
  id: string
  name: string
  category: string
  status: ServiceStatus
  latency_ms?: number
  message: string
}

/** Check if a Supabase table has at least one row. Returns null on error. */
async function hasRows(supabase: ReturnType<typeof createClient>, table: string): Promise<boolean | null> {
  const { data, error } = await supabase.from(table).select('id').limit(1)
  if (error) return null
  return Array.isArray(data) && data.length > 0
}

export const servicesHealthHandler = async (c: any) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const services: ServiceInfo[] = []

  // ── Infrastructure ─────────────────────────────────────────────────────────

  // Supabase DB — live ping
  const t0 = Date.now()
  const { error: dbErr } = await supabase.from('knowledge_nodes').select('id').limit(1)
  const dbMs = Date.now() - t0
  services.push({
    id: 'supabase_db',
    name: 'Supabase (PostgreSQL)',
    category: 'database',
    status: dbErr ? 'error' : 'ok',
    latency_ms: dbMs,
    message: dbErr ? `Error: ${dbErr.message}` : `Latencia ${dbMs}ms`,
  })

  // ── AI / LLM ───────────────────────────────────────────────────────────────

  // Anthropic Claude — key + last interactions
  let anthropicStatus: ServiceStatus = ANTHROPIC_API_KEY ? 'ok' : 'error'
  let anthropicMsg = ANTHROPIC_API_KEY ? 'API key configurada' : 'API key no configurada'
  if (ANTHROPIC_API_KEY) {
    const { data: rows } = await supabase
      .from('ai_interactions')
      .select('created_at, error_type')
      .order('created_at', { ascending: false })
      .limit(5)
    if (rows && rows.length > 0) {
      const errCount = rows.filter((r: any) => r.error_type).length
      if (errCount === rows.length) anthropicStatus = 'error'
      else if (errCount > 0) anthropicStatus = 'degraded'
      const hoursAgo = Math.round((Date.now() - new Date(rows[0].created_at).getTime()) / 3_600_000)
      anthropicMsg = hoursAgo < 1 ? 'Última llamada < 1h' : `Última llamada hace ${hoursAgo}h`
    }
  }
  services.push({ id: 'anthropic', name: 'Anthropic Claude', category: 'ai', status: anthropicStatus, message: anthropicMsg })

  // OpenAI Embeddings — key + vector presence
  const { data: nodes } = await supabase.from('knowledge_nodes').select('id').limit(1)
  services.push({
    id: 'openai',
    name: 'OpenAI Embeddings',
    category: 'ai',
    status: OPENAI_API_KEY ? 'ok' : 'error',
    message: OPENAI_API_KEY
      ? nodes && nodes.length > 0 ? 'Vectores activos en BD' : 'API key configurada'
      : 'API key no configurada',
  })

  // ── Parsing / Files ────────────────────────────────────────────────────────

  services.push({
    id: 'llamaparse',
    name: 'LlamaParse',
    category: 'parsing',
    status: LLAMAPARSE_API_KEY ? 'ok' : 'error',
    message: LLAMAPARSE_API_KEY ? 'API key configurada' : 'API key no configurada',
  })

  // ── Chilean Government APIs ────────────────────────────────────────────────

  // SII — check if it has been called (data in temp_context with source='sii')
  const siiRows = await hasRows(supabase, 'temp_context')
  const { data: siiData } = await supabase
    .from('temp_context')
    .select('created_at')
    .eq('source', 'sii')
    .order('created_at', { ascending: false })
    .limit(1)
  const siiHasData = siiData && siiData.length > 0
  services.push({
    id: 'sii',
    name: 'SII (apigateway.cl)',
    category: 'gov',
    status: siiRows === null ? 'degraded' : 'ok',
    message: siiHasData
      ? `Última consulta ${new Date(siiData![0].created_at).toLocaleDateString('es-CL')}`
      : 'Proxy activo — sin consultas recientes',
  })

  // BCE / Banco Central — check cache table
  const bdeHasData = await hasRows(supabase, 'market_bde_data')
  services.push({
    id: 'bce',
    name: 'Banco Central (BDE)',
    category: 'gov',
    status: bdeHasData === null ? 'error' : bdeHasData ? 'ok' : 'degraded',
    message: bdeHasData ? 'Datos IPC/UF en caché' : bdeHasData === null ? 'Error de acceso a tabla' : 'Sin datos en caché',
  })

  // INE — check classification cache
  const ineHasData = await hasRows(supabase, 'market_ine_classifications')
  services.push({
    id: 'ine',
    name: 'INE (CAENES Classifier)',
    category: 'gov',
    status: ineHasData === null ? 'error' : ineHasData ? 'ok' : 'degraded',
    message: ineHasData ? 'Clasificaciones en caché' : ineHasData === null ? 'Error de acceso a tabla' : 'Sin datos en caché',
  })

  // CMF — check economic_knowledge for CMF provider rows
  const { data: cmfData } = await supabase
    .from('economic_knowledge')
    .select('updated_at')
    .eq('provider', 'CMF')
    .order('updated_at', { ascending: false })
    .limit(1)
  services.push({
    id: 'cmf',
    name: 'CMF (UF / Indicadores)',
    category: 'gov',
    status: cmfData && cmfData.length > 0 ? 'ok' : 'degraded',
    message: cmfData && cmfData.length > 0
      ? `Última sync ${new Date(cmfData[0].updated_at).toLocaleDateString('es-CL')}`
      : 'Sin datos en caché',
  })

  // FRED via BralidusPY — knowledge_nodes con category='Macroeconomia'
  const fredT0 = Date.now()
  const { data: fredNodes, error: fredErr } = await supabase
    .from('knowledge_nodes')
    .select('id, metadata')
    .eq('category', 'Macroeconomia')
    .limit(5)
  const fredMs = Date.now() - fredT0
  const fredCount = fredNodes?.length ?? 0
  services.push({
    id: 'fred',
    name: 'FRED (Federal Reserve)',
    category: 'macro',
    status: fredErr ? 'error' : fredCount >= 3 ? 'ok' : fredCount > 0 ? 'degraded' : 'unused',
    latency_ms: fredErr ? undefined : fredMs,
    message: fredErr
      ? `Error: ${fredErr.message}`
      : fredCount >= 3
        ? `${fredCount} series macro en GraphRAG`
        : fredCount > 0 ? `${fredCount}/3 series — worker incompleto`
        : 'Sin datos — ejecutar: py main.py',
  })

  // BralidusPY — ping directo a Railway + KG stats
  const bralidusT0 = Date.now()
  let bralidusStatus: ServiceStatus = 'error'
  let bralidusMsg = 'No responde'
  let bralidusLatency: number | undefined
  try {
    // Try /ping first (fast, no DB); fall back to /health if 404 (old deployment)
    let br = await fetch(`${BRALIDUS_URL}/ping`, { signal: AbortSignal.timeout(6000) })
    if (br.status === 404) {
      br = await fetch(`${BRALIDUS_URL}/health`, { signal: AbortSignal.timeout(10000) })
    }
    bralidusLatency = Date.now() - bralidusT0
    if (br.ok) {
      const bj = await br.json() as Record<string, unknown>
      const uptime = typeof bj.uptime_seconds === 'number' ? Math.round(bj.uptime_seconds / 3600) : null
      const nodesCount = typeof bj.knowledge_nodes_count === 'number' ? bj.knowledge_nodes_count : null
      const schedulerOk = bj.scheduler_running !== false && !(bj.status === 'error')
      bralidusStatus = schedulerOk ? 'ok' : 'degraded'
      const parts: string[] = ['Online · Railway']
      if (nodesCount) parts.push(`${nodesCount} nodos KG`)
      if (uptime !== null) parts.push(`uptime ${uptime}h`)
      bralidusMsg = parts.join(' · ')
    } else {
      bralidusStatus = 'degraded'
      bralidusMsg = `HTTP ${br.status} · Railway`
    }
  } catch (e) {
    bralidusLatency = Date.now() - bralidusT0
    bralidusMsg = `Timeout / offline · ${BRALIDUS_URL}`
  }
  const [{ count: kgTotal }, { data: embNodes }] = await Promise.all([
    supabase.from('knowledge_nodes').select('id', { count: 'exact', head: true }),
    supabase.from('knowledge_nodes').select('id').not('embedding', 'is', null).limit(10),
  ])
  const embCount = embNodes?.length ?? 0
  const totalNodes = kgTotal ?? 0
  if (bralidusStatus === 'ok') bralidusMsg += ` · ${totalNodes} nodos KG`
  services.push({
    id: 'braliduspy',
    name: 'BralidusPY (Railway)',
    category: 'macro',
    status: bralidusStatus,
    latency_ms: bralidusLatency,
    message: bralidusMsg,
  })

  // yfinance — knowledge_nodes con categorías de tickers (Mercados, Commodities, Forex Chile, etc.)
  const { data: yfNodes } = await supabase
    .from('knowledge_nodes')
    .select('id')
    .in('category', ['Mercados', 'Mercados Chile', 'Mercados LATAM', 'Commodities', 'Forex Chile', 'Riesgo', 'Tasas USA'])
    .limit(15)
  const yfCount = yfNodes?.length ?? 0
  services.push({
    id: 'yfinance',
    name: 'yfinance (Tickers)',
    category: 'macro',
    status: yfCount >= 5 ? 'ok' : yfCount > 0 ? 'degraded' : 'error',
    message: yfCount >= 5 ? `${yfCount} tickers en GraphRAG` : yfCount > 0 ? `Solo ${yfCount} tickers` : 'Sin datos — cron día 1 de cada mes',
  })

  // FRED API key
  services.push({
    id: 'fred_key',
    name: 'FRED API Key',
    category: 'macro',
    status: FRED_API_KEY ? 'ok' : 'error',
    message: FRED_API_KEY ? 'API key configurada' : 'FRED_API_KEY no configurada',
  })

  // Bralidus API Auth
  services.push({
    id: 'bralidus_auth',
    name: 'Bralidus API Auth',
    category: 'macro',
    status: BRALIDUS_API_KEY ? 'ok' : 'error',
    message: BRALIDUS_API_KEY ? 'Bearer auth activo (Beta)' : 'BRALIDUS_API_KEY no configurada',
  })

  // ── Scrapers Bralidus ──────────────────────────────────────────────────────

  // CMF Hechos Esenciales — radar_signals con source LIKE 'cmf%'
  const { data: cmfScraperData } = await supabase
    .from('radar_signals')
    .select('created_at, source')
    .like('source', 'cmf%')
    .order('created_at', { ascending: false })
    .limit(1)
  const cmfScraperLast = cmfScraperData?.[0]
  services.push({
    id: 'scraper_cmf',
    name: 'CMF Hechos Esenciales',
    category: 'scraper',
    status: cmfScraperLast ? 'ok' : 'degraded',
    message: cmfScraperLast
      ? `Última señal ${new Date(cmfScraperLast.created_at).toLocaleDateString('es-CL')} · 3×/día`
      : 'Sin señales aún · cron 09:15, 13:15, 17:15',
  })

  // BCCH Minutas — radar_signals con source LIKE 'bcch%'
  const { data: bcchData } = await supabase
    .from('radar_signals').select('created_at').like('source', 'bcch%')
    .order('created_at', { ascending: false }).limit(1)
  services.push({
    id: 'scraper_bcch',
    name: 'BCCH Minutas y Comunicados',
    category: 'scraper',
    status: bcchData?.[0] ? 'ok' : 'degraded',
    message: bcchData?.[0]
      ? `Última señal ${new Date(bcchData[0].created_at).toLocaleDateString('es-CL')} · Lunes 07:00`
      : 'Sin señales aún · cron lunes 07:00',
  })

  // SEIA — radar_signals con source LIKE 'seia%'
  const { data: seiaData } = await supabase
    .from('radar_signals').select('created_at').like('source', 'seia%')
    .order('created_at', { ascending: false }).limit(1)
  services.push({
    id: 'scraper_seia',
    name: 'SEIA Proyectos Ambientales',
    category: 'scraper',
    status: seiaData?.[0] ? 'ok' : 'degraded',
    message: seiaData?.[0]
      ? `Última señal ${new Date(seiaData[0].created_at).toLocaleDateString('es-CL')} · c/3 días`
      : 'Sin señales aún · cron cada 3 días 08:00',
  })

  // Boletín Concursal — radar_signals con source LIKE 'concursal%'
  const { data: concursalData } = await supabase
    .from('radar_signals').select('created_at').like('source', 'concursal%')
    .order('created_at', { ascending: false }).limit(1)
  services.push({
    id: 'scraper_concursal',
    name: 'Boletín Concursal (Diario Oficial)',
    category: 'scraper',
    status: concursalData?.[0] ? 'ok' : 'degraded',
    message: concursalData?.[0]
      ? `Última señal ${new Date(concursalData[0].created_at).toLocaleDateString('es-CL')} · días hábiles`
      : 'Sin señales aún · cron hábiles 07:30',
  })

  // INE Empleo — radar_signals con source LIKE 'empleo%'
  const { data: empleoData } = await supabase
    .from('radar_signals').select('created_at').like('source', 'empleo%')
    .order('created_at', { ascending: false }).limit(1)
  services.push({
    id: 'scraper_empleo',
    name: 'INE Señal Empleo Sectorial',
    category: 'scraper',
    status: empleoData?.[0] ? 'ok' : 'degraded',
    message: empleoData?.[0]
      ? `Última señal ${new Date(empleoData[0].created_at).toLocaleDateString('es-CL')} · Sáb 09:00`
      : 'Sin señales aún · cron sábados 09:00',
  })

  // Mercado Público extractor — knowledge_nodes con category='Compras Públicas B2G'
  // (el job MP escribe nodos permanentes, no señales radar)
  const { data: mpData } = await supabase
    .from('knowledge_nodes')
    .select('updated_at')
    .eq('category', 'Compras Públicas B2G')
    .order('updated_at', { ascending: false })
    .limit(1)
  services.push({
    id: 'scraper_mp',
    name: 'Mercado Público (Licitaciones)',
    category: 'scraper',
    status: mpData?.[0] ? 'ok' : 'degraded',
    message: mpData?.[0]
      ? `Última sync ${new Date(mpData[0].updated_at).toLocaleDateString('es-CL')} · cron diario`
      : 'Sin datos aún · cron 06:00 diario',
  })

  // Radar Refresh (main scheduler job) — total signals last 24h
  const since24h = new Date(Date.now() - 86_400_000).toISOString()
  const { count: radarCount } = await supabase
    .from('radar_signals').select('id', { count: 'exact', head: true })
    .gte('created_at', since24h)
  services.push({
    id: 'radar_refresh',
    name: 'Radar Forense (Refresh)',
    category: 'scraper',
    status: (radarCount ?? 0) > 0 ? 'ok' : 'degraded',
    message: (radarCount ?? 0) > 0
      ? `${radarCount} señales últimas 24h · c/30 min`
      : 'Sin señales en 24h · cron cada 30 min',
  })

  // ChileCompra — Mercado Público procurement intelligence
  const { data: chilecompraData } = await supabase
    .from('economic_knowledge')
    .select('updated_at')
    .eq('provider', 'CHILECOMPRA')
    .order('updated_at', { ascending: false })
    .limit(1)
  const chilecompraHasData = chilecompraData && chilecompraData.length > 0
  services.push({
    id: 'chilecompra',
    name: 'ChileCompra (Mercado Público)',
    category: 'gov',
    status: chilecompraHasData ? 'ok' : 'degraded',
    message: chilecompraHasData
      ? `Última consulta ${new Date(chilecompraData[0].updated_at).toLocaleDateString('es-CL')}`
      : 'Sin datos — consultar con ?rut=...',
  })

  // INAPI — OData live (Sprint 4)
  const { data: inapiData } = await supabase
    .from('temp_context')
    .select('created_at')
    .eq('source', 'inapi')
    .order('created_at', { ascending: false })
    .limit(1)
  const inapiHasData = inapiData && inapiData.length > 0
  services.push({
    id: 'inapi',
    name: 'INAPI (Marcas — OData)',
    category: 'gov',
    status: 'ok',
    message: inapiHasData
      ? `Última consulta ${new Date(inapiData![0].created_at).toLocaleDateString('es-CL')}`
      : 'OData activo — sin consultas recientes',
  })

  // CMF BEST — financial market indicators (Sprint 7)
  const cmfBestKeyPresent = !!CMF_BEST_KEY
  const { data: cmfBestData } = await supabase
    .from('temp_context')
    .select('created_at')
    .eq('source', 'cmf_best')
    .order('created_at', { ascending: false })
    .limit(1)
  const cmfBestHasData = cmfBestData && cmfBestData.length > 0
  services.push({
    id: 'cmf_best',
    name: 'CMF BEST (Indicadores Financieros)',
    category: 'gov',
    status: cmfBestKeyPresent ? 'ok' : 'error',
    message: !cmfBestKeyPresent
      ? 'CMF_BEST_KEY no configurada'
      : cmfBestHasData
        ? `Última consulta ${new Date(cmfBestData![0].created_at).toLocaleDateString('es-CL')}`
        : 'API key activa — sin consultas recientes',
  })

  // Fintoc — Open Banking (Sprint 4)
  services.push({
    id: 'fintoc',
    name: 'Fintoc (Open Banking)',
    category: 'gov',
    status: FINTOC_SECRET_KEY ? 'ok' : 'degraded',
    message: FINTOC_SECRET_KEY
      ? 'Webhook activo — validación HMAC configurada'
      : 'Pendiente configuración de secretos en producción',
  })

  // PJUD — webhook async (not a direct API call)
  services.push({
    id: 'pjud',
    name: 'PJUD (Judicial)',
    category: 'gov',
    status: 'degraded',
    message: 'Webhook async — pendiente contrato con proveedor de datos',
  })

  // ── Analytics / Growth ─────────────────────────────────────────────────────

  services.push({
    id: 'posthog',
    name: 'PostHog Analytics',
    category: 'analytics',
    status: 'ok',
    message: 'Reverse proxy activo',
  })

  // ── Pending integrations ───────────────────────────────────────────────────

  services.push({
    id: 'serpapi',
    name: 'SerpApi (Trends)',
    category: 'data',
    status: SERPAPI_KEY ? 'ok' : 'error',
    message: SERPAPI_KEY ? 'API key configurada' : 'SERPAPI_KEY no configurada',
  })

  services.push({
    id: 'reddit',
    name: 'Reddit API',
    category: 'data',
    status: 'unused',
    message: 'Datos simulados actualmente',
  })

  return c.json({ checked_at: new Date().toISOString(), services })
}
