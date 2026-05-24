import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const LLAMAPARSE_API_KEY = Deno.env.get('LLAMAPARSE_API_KEY')

type ServiceStatus = 'ok' | 'degraded' | 'error' | 'unused'

interface ServiceInfo {
  id: string
  name: string
  category: string
  status: ServiceStatus
  latency_ms?: number
  message: string
}

export const servicesHealthHandler = async (c: any) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  const services: ServiceInfo[] = []

  // 1. Supabase DB — live ping
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

  // 2. Anthropic Claude — key + last interactions
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
      anthropicMsg = hoursAgo < 1
        ? 'Última llamada hace menos de 1h'
        : `Última llamada hace ${hoursAgo}h`
    }
  }

  services.push({
    id: 'anthropic',
    name: 'Anthropic Claude',
    category: 'ai',
    status: anthropicStatus,
    message: anthropicMsg,
  })

  // 3. OpenAI Embeddings — key + vector presence
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

  // 4. PostHog — reverse proxy via Supabase Edge Function (telemetry sprint)
  services.push({
    id: 'posthog',
    name: 'PostHog Analytics',
    category: 'analytics',
    status: 'ok',
    message: 'Reverse proxy activo',
  })

  // 5. LlamaParse — file parsing
  services.push({
    id: 'llamaparse',
    name: 'LlamaParse',
    category: 'parsing',
    status: LLAMAPARSE_API_KEY ? 'ok' : 'error',
    message: LLAMAPARSE_API_KEY ? 'API key configurada' : 'API key no configurada',
  })

  // 6. SerpApi — not integrated yet
  services.push({
    id: 'serpapi',
    name: 'SerpApi (Trends)',
    category: 'data',
    status: 'unused',
    message: 'Pendiente integración',
  })

  // 7. Reddit API — using mock data currently
  services.push({
    id: 'reddit',
    name: 'Reddit API',
    category: 'data',
    status: 'unused',
    message: 'Datos simulados actualmente',
  })

  return c.json({ checked_at: new Date().toISOString(), services })
}
