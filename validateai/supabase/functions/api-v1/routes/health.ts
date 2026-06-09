import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const LLAMAPARSE_API_KEY = Deno.env.get('LLAMAPARSE_API_KEY')
const CMF_BEST_KEY = Deno.env.get('CMF_BEST_KEY')
const FINTOC_SECRET_KEY = Deno.env.get('FINTOC_SECRET_KEY')
const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')

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

  // FRED — macroeconomic series (USD/CLP, cobre, fed funds, CPI, petróleo)
  const { data: fredData } = await supabase
    .from('economic_knowledge')
    .select('updated_at')
    .eq('provider', 'FRED')
    .order('updated_at', { ascending: false })
    .limit(1)
  const fredHasData = fredData && fredData.length > 0
  services.push({
    id: 'fred',
    name: 'FRED (Macro EEUU)',
    category: 'data',
    status: fredHasData ? 'ok' : 'degraded',
    message: fredHasData
      ? `Última sync ${new Date(fredData[0].updated_at).toLocaleDateString('es-CL')}`
      : 'Sin datos — ejecutar cron fred-sync',
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
