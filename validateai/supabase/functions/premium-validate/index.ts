import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY    = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const REDDIT_CLIENT_ID     = Deno.env.get('REDDIT_CLIENT_ID');
const REDDIT_CLIENT_SECRET = Deno.env.get('REDDIT_CLIENT_SECRET');
const SERPAPI_KEY          = Deno.env.get('SERPAPI_KEY');

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
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

async function getRedditToken(): Promise<string> {
  const credentials = btoa(`${REDDIT_CLIENT_ID}:${REDDIT_CLIENT_SECRET}`);
  const res = await fetch('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'ValidateAI/1.0 by Luciano',
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
  const token = await getRedditToken();
  const query = encodeURIComponent(idea.slice(0, 120));
  const subreddits = 'entrepreneur+startups+SaaS+smallbusiness+business';

  const res = await fetch(
    `https://oauth.reddit.com/search.json?q=${query}&sort=top&t=year&limit=8&type=link&restrict_sr=false&subreddit=${subreddits}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': 'ValidateAI/1.0 by Luciano',
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

async function fetchRedditMockFallback(_idea: string): Promise<unknown> {
  return {
    status: 'mock',
    source: 'Reddit (mock — agrega REDDIT_CLIENT_ID y REDDIT_CLIENT_SECRET para datos reales)',
    top_discussions: [
      {
        subreddit: 'r/entrepreneur',
        title: "I can't find a good tool to validate my startup ideas quickly.",
        upvotes: 342,
        sentiment: 'frustration',
        snippet: '...I spend weeks doing market research. I wish there was an AI that just pulled Reddit and Trends data for me in 10 seconds...',
        url: 'https://reddit.com/r/entrepreneur/example-post',
      },
      {
        subreddit: 'r/SaaS',
        title: 'How much do you pay for market research?',
        upvotes: 128,
        sentiment: 'curiosity',
        snippet: '...agencies charge $5k+ for a basic market report. Has anyone tried automated solutions?',
        url: 'https://reddit.com/r/SaaS/example-post-2',
      },
    ],
  };
}

async function fetchReddit(idea: string): Promise<unknown> {
  if (REDDIT_CLIENT_ID && REDDIT_CLIENT_SECRET) {
    return fetchRedditReal(idea);
  }
  console.warn('[premium-validate] Sin credenciales Reddit — usando mock. Agrega REDDIT_CLIENT_ID y REDDIT_CLIENT_SECRET.');
  return fetchRedditMockFallback(idea);
}

// ── Google Trends (SerpApi) ───────────────────────────────────────────────────

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

async function fetchTrendsMockFallback(_idea: string): Promise<unknown> {
  return {
    status: 'mock',
    source: 'Google Trends (mock — agrega SERPAPI_KEY para datos reales)',
    keyword: _idea.slice(0, 100),
    average_interest_last_12_months: 78,
    trend_trajectory: 'upward',
    related_breakout_queries: ['automated startup validation', 'ai business plan generator'],
  };
}

async function fetchTrends(idea: string): Promise<unknown> {
  if (SERPAPI_KEY) {
    return fetchTrendsReal(idea);
  }
  console.warn('[premium-validate] Sin SERPAPI_KEY — usando mock.');
  return fetchTrendsMockFallback(idea);
}

// ── AI Synthesizer ────────────────────────────────────────────────────────────

async function synthesize(
  idea: string,
  redditData: unknown | null,
  trendsData: unknown | null,
): Promise<string> {
  const redditSection = redditData
    ? `## Reddit Signal\n${JSON.stringify(redditData, null, 2)}`
    : '## Reddit Signal\n(datos no disponibles)';

  const trendsSection = trendsData
    ? `## Google Trends Signal\n${JSON.stringify(trendsData, null, 2)}`
    : '## Google Trends Signal\n(datos no disponibles)';

  const prompt = `Eres un analista de startups experto. Basándote en los datos de mercado a continuación,
redacta un "Executive Summary" de máximo 1000 caracteres evaluando la viabilidad de la siguiente idea:

IDEA: ${idea}

${redditSection}

${trendsSection}

El resumen debe mencionar: demanda detectada, sentimiento de la comunidad, tendencia de búsqueda
y una recomendación concisa. Responde SOLO con el texto del resumen, sin títulos ni markdown adicional.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic error: ${response.status}`);
  }

  const result = await response.json();
  const text: string = result.content?.[0]?.text ?? '';
  return text.slice(0, 1000);
}

// ── Main handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req) });
  }

  // Auth — verifica JWT del usuario
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

  // Verificar que la validación pertenece al usuario
  const { data: validation } = await supabase
    .from('validations')
    .select('id, user_id')
    .eq('id', validation_id)
    .eq('user_id', user.id)
    .single();

  if (!validation) return json({ error: 'Validation not found' }, 404, req);

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

  // ── Fan-Out: dispara ambos agentes en paralelo ────────────────────────────
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

  // ── Sintetizador IA ───────────────────────────────────────────────────────
  let executiveSummary: string | null = null;
  try {
    executiveSummary = await synthesize(idea_description, redditData, trendsData);
  } catch (err) {
    // El reporte se genera igualmente, sin resumen
    errorDetails.synthesis = String(err);
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

  await supabase
    .from('validations')
    .update({ status: 'completed', validation_mode: 'quick' })
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
