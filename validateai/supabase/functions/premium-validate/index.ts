import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REDDIT_CLIENT_ID     = Deno.env.get('REDDIT_CLIENT_ID');
const REDDIT_CLIENT_SECRET = Deno.env.get('REDDIT_CLIENT_SECRET');
const SERPAPI_KEY          = Deno.env.get('SERPAPI_KEY');

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
  'http://localhost:5173',
  'http://localhost:3000',
];

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(body: unknown, status = 200, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  });
}

// ── Reddit API ────────────────────────────────────────────────────────────────

interface RedditPost {
  subreddit: string;
  title: string;
  upvotes: number;
  sentiment: string;
  snippet: string;
  url: string;
}

// Deno KV para cachear el token OAuth de Reddit.
// TTL = 55 min (60 min oficial -5 min de margen de seguridad).
const KV_REDDIT_TOKEN_KEY = ['reddit_oauth_token'];
const REDDIT_TOKEN_TTL_MS = 55 * 60 * 1000;

async function getRedditTokenCached(): Promise<string> {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error('Reddit credentials not configured — set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET');
  }
  try {
    const kv = await Deno.openKv();
    const cached = await kv.get<string>(KV_REDDIT_TOKEN_KEY);
    if (cached.value) return cached.value;

    // Token expirado o no existe — obtener uno nuevo
    const token = await fetchFreshRedditToken();
    await kv.set(KV_REDDIT_TOKEN_KEY, token, { expireIn: REDDIT_TOKEN_TTL_MS });
    return token;
  } catch (kvErr) {
    // Deno KV no disponible en este entorno → fetch directo sin caché
    console.warn('[premium-validate] Deno KV unavailable, fetching token without cache:', kvErr);
    return fetchFreshRedditToken();
  }
}

async function fetchFreshRedditToken(): Promise<string> {
  const credentials = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Validus/1.0',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status}`);
  const data = await res.json();
  return data.access_token as string;
}

function inferSentiment(title: string, score: number): string {
  const text = title.toLowerCase();
  if (text.includes('problem') || text.includes('frustrated') || text.includes('hate') || text.includes('fail') || text.includes('struggle')) return 'frustration';
  if (text.includes('how to') || text.includes('best way') || text.includes('help') || text.includes('advice')) return 'question';
  if (text.includes('love') || text.includes('amazing') || text.includes('great') || text.includes('success')) return 'positive';
  if (score > 200) return 'high_interest';
  return 'discussion';
}

async function fetchRedditReal(idea: string): Promise<unknown> {
  const token = await getRedditTokenCached();
  const query = encodeURIComponent(idea.slice(0, 120));
  const subreddits = 'entrepreneur+startups+SaaS+smallbusiness+business';

  const res = await fetch(
    `https://oauth.reddit.com/search.json?q=${query}&sort=top&t=year&limit=8&type=link&restrict_sr=false&subreddit=${subreddits}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'Validus/1.0 by Luciano',
      },
    },
  );
  if (!res.ok) throw new Error(`Reddit search failed: ${res.status}`);

  const data = await res.json();
  const posts: RedditPost[] = (data.data?.children ?? [])
    .filter((c: { data: { score: number } }) => c.data?.score > 5)
    .slice(0, 5)
    .map((c: { data: { subreddit: string; title: string; score: number; selftext: string; url: string } }) => ({
      subreddit: `r/${c.data.subreddit}`,
      title: c.data.title,
      upvotes: c.data.score,
      sentiment: inferSentiment(c.data.title, c.data.score),
      snippet: c.data.selftext?.slice(0, 200).replace(/\n/g, ' ') || '(sin texto)',
      url: c.data.url,
    }));

  return {
    status: 'success',
    source: 'Reddit API (real)',
    query: idea.slice(0, 120),
    top_discussions: posts,
  };
}

// Mocks eliminados por directiva de Mesa Directiva (01-Jun-2026).
// Si las credenciales no están configuradas, la función lanza un error
// que Promise.allSettled captura como null — el reporte se genera con
// un aviso de “datos no disponibles” en lugar de datos ficticios.
async function fetchReddit(idea: string): Promise<unknown> {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error('Reddit credentials not configured — set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in Supabase secrets');
  }
  return fetchRedditReal(idea);
}

// â”€â”€ Google Trends (SerpApi) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchTrendsReal(idea: string): Promise<unknown> {
  const keyword = encodeURIComponent(idea.slice(0, 100));
  const url = `https://serpapi.com/search.json?engine=google_trends&q=${keyword}&date=today+12-m&api_key=${SERPAPI_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`SerpApi error: ${res.status}`);

  const data = await res.json();
  const timeline: { date: string; values: { query: string; value: number }[] }[] = data.interest_over_time?.timeline_data ?? [];

  const values = timeline.flatMap((t) => t.values.map((v) => v.value)).filter((v) => v > 0);
  const avg = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0;

  const first6 = values.slice(0, Math.floor(values.length / 2));
  const last6 = values.slice(Math.floor(values.length / 2));
  const firstAvg = first6.length ? first6.reduce((a, b) => a + b, 0) / first6.length : 0;
  const lastAvg = last6.length ? last6.reduce((a, b) => a + b, 0) / last6.length : 0;
  const trajectory = lastAvg > firstAvg * 1.1 ? 'upward' : lastAvg < firstAvg * 0.9 ? 'downward' : 'stable';

  const related = (data.related_queries?.rising ?? []).slice(0, 4).map(
    (q: { query: string }) => q.query,
  );

  return {
    status: 'success',
    source: 'Google Trends (SerpApi)',
    keyword: idea.slice(0, 100),
    average_interest_last_12_months: avg,
    trend_trajectory: trajectory,
    related_breakout_queries: related,
    data_points: timeline.length,
  };
}

async function fetchTrends(idea: string): Promise<unknown> {
  if (!SERPAPI_KEY) {
    throw new Error('SERPAPI_KEY not configured — set SERPAPI_KEY in Supabase secrets');
  }
  return fetchTrendsReal(idea);
}

// ── AI Synthesizer — Claude Sonnet (Sprint P-C) ────────────────────────────────

interface ValidationContext {
  idea_name?:          string | null;
  idea_description?:   string | null;
  idea_problem?:       string | null;
  current_solution?:   string | null;
  customer_segment?:   string | null;
  target_country?:     string | null;
  business_model?:     string | null;
  traction_status?:    string | null;
  team_composition?:   string | null;
}

const SYNTHESIS_SYSTEM_PROMPT = `Eres un analista senior de Venture Capital con acceso a señales de mercado en tiempo real. Tu misión es redactar el “Executive Summary Investor-Ready” más preciso y accionable posible sobre la viabilidad de este negocio.

DIRECTRICES:
- Integra activamente las señales de Reddit y Google Trends con el contexto del negocio.
- Conecta el sentimiento de la comunidad con el dolor del cliente declarado.
- Cruza la tracción actual del equipo con la complejidad del mercado objetivo.
- Si los datos de mercado no están disponibles, indícalo con precisión y ajusta tu nivel de confianza.
- Sé directo, sin adulaciones. Señala fortalezas reales Y debilidades concretas.
- Máximo 1200 caracteres. Responde SOLO con el texto del resumen, sin títulos ni markdown.`;

async function synthesize(
  ctx: ValidationContext,
  redditData: unknown | null,
  trendsData: unknown | null,
): Promise<string> {
  const userPrompt = `# CONTEXTO DEL NEGOCIO

IDEA: ${ctx.idea_name ?? 'Sin nombre'} — ${ctx.idea_description ?? 'Sin descripción'}
PROBLEMA DECLARADO: ${ctx.idea_problem ?? 'No especificado'}
SOLUCIÓN ACTUAL INCUMBENTES: ${ctx.current_solution ?? 'No especificado'}
SEGMENTO OBJETIVO (ICP): ${ctx.customer_segment ?? 'No especificado'}
PAÍS OBJETIVO: ${ctx.target_country ?? 'No especificado'}
MODELO DE NEGOCIO: ${ctx.business_model?.toUpperCase() ?? 'No especificado'}
TRACCIÓN ACTUAL: ${ctx.traction_status ?? 'No especificada'}
COMPOSICIÓN DEL EQUIPO: ${ctx.team_composition ?? 'No especificada'}

# SEÑALES DE MERCADO EN TIEMPO REAL

## Reddit Signal (sentimiento de comunidad emprendedora)
${redditData ? JSON.stringify(redditData, null, 2) : '(No disponible — credenciales de API no configuradas)'}

## Google Trends Signal (demanda de búsqueda, últimos 12 meses)
${trendsData ? JSON.stringify(trendsData, null, 2) : '(No disponible — SERPAPI_KEY no configurada)'}

Basándote en TODO el contexto anterior, redacta el Executive Summary investor-ready.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 800,
      system: SYNTHESIS_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`);
  }

  const result = await response.json();
  const text: string = result.content?.[0]?.text ?? '';
  return text.slice(0, 1200);
}

// â”€â”€ Main handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  // Auth â€” verifica JWT del usuario
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Missing authorization' }, 401, req);

  const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
  if (authError || !user) return json({ error: 'Unauthorized' }, 401, req);

  // Verificar que el usuario sea premium
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: profile } = await supabase
    .from('profiles')
    .select('tier')
    .eq('id', user.id)
    .single();

  if (!profile || !['pro', 'premium'].includes(profile.tier)) {
    return json({ error: 'Pro tier required' }, 403, req);
  }

  // Body
  let body: { validation_id: string; idea_description: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req);
  }

  const { validation_id, idea_description } = body;
  if (!validation_id || !idea_description) {
    return json({ error: 'validation_id and idea_description are required' }, 400, req);
  }

  // Obtener el contexto completo de la validación para la síntesis enriquecida
  const { data: validation } = await supabase
    .from('validations')
    .select('id, user_id, idea_name, idea_description, idea_problem, current_solution, customer_segment, target_country, business_model, traction_status, team_composition')
    .eq('id', validation_id)
    .eq('user_id', user.id)
    .single();

  if (!validation) return json({ error: 'Validation not found' }, 404, req);

  const validationCtx: ValidationContext = {
    idea_name:        validation.idea_name,
    idea_description: validation.idea_description ?? idea_description,
    idea_problem:     validation.idea_problem,
    current_solution: validation.current_solution,
    customer_segment: validation.customer_segment,
    target_country:   validation.target_country,
    business_model:   validation.business_model,
    traction_status:  validation.traction_status,
    team_composition: validation.team_composition,
  };

  // Crear log inicial en estado 'pending'
  const { data: logRow, error: logInsertError } = await supabase
    .from('validation_agents_log')
    .insert({
      validation_id,
      user_id: user.id,
      reddit_status: 'pending',
      trends_status: 'pending',
    })
    .select('id')
    .single();

  if (logInsertError || !logRow) {
    return json({ error: 'Failed to create agent log' }, 500, req);
  }

  const logId = logRow.id;

  // â”€â”€ Fan-Out: dispara ambos agentes en paralelo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [redditResult, trendsResult] = await Promise.allSettled([
    fetchReddit(idea_description),
    fetchTrends(idea_description),
  ]);

  const redditData   = redditResult.status  === 'fulfilled' ? redditResult.value  : null;
  const trendsData   = trendsResult.status  === 'fulfilled' ? trendsResult.value  : null;
  const redditStatus = redditResult.status  === 'fulfilled' ? 'success' : 'error';
  const trendsStatus = trendsResult.status  === 'fulfilled' ? 'success' : 'error';

  const errorDetails: Record<string, string> = {};
  if (redditResult.status === 'rejected') errorDetails.reddit = String(redditResult.reason);
  if (trendsResult.status === 'rejected') errorDetails.trends = String(trendsResult.reason);

  // Actualizar log con resultados crudos de agentes
  await supabase
    .from('validation_agents_log')
    .update({
      reddit_data: redditData,
      trends_data: trendsData,
      reddit_status: redditStatus,
      trends_status: trendsStatus,
      agents_completed_at: new Date().toISOString(),
      error_details: Object.keys(errorDetails).length ? errorDetails : null,
    })
    .eq('id', logId);

  // â”€â”€ Sintetizador IA â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  let executiveSummary: string | null = null;
  try {
    executiveSummary = await synthesize(validationCtx, redditData, trendsData);
  } catch (err) {
    // El reporte se genera igualmente, sin resumen ejecutivo
    errorDetails.synthesis = String(err);
    console.error('[premium-validate] Synthesis failed:', err);
  }

  // Guardar resumen y marcar validación como completada
  await supabase
    .from('validation_agents_log')
    .update({
      executive_summary: executiveSummary,
      synthesis_completed_at: executiveSummary ? new Date().toISOString() : null,
      error_details: Object.keys(errorDetails).length ? errorDetails : null,
    })
    .eq('id', logId);

  // Fix: validation_mode permanece 'premium' — no sobreescribir con 'quick'
  await supabase
    .from('validations')
    .update({ status: 'completed' })
    .eq('id', validation_id);

  return json({
    log_id: logId,
    reddit_status: redditStatus,
    trends_status: trendsStatus,
    executive_summary: executiveSummary,
    agents: {
      reddit: redditData,
      trends: trendsData,
    },
    errors: Object.keys(errorDetails).length ? errorDetails : null,
  }, 200, req);
});
