// Agente Reddit (OAuth app-only + KV token cache + sentiment), extraído de
// premium-validate (#T3.5 W2). Bodies byte-identical; env relocadas verbatim.
const REDDIT_CLIENT_ID     = Deno.env.get('REDDIT_CLIENT_ID');
const REDDIT_CLIENT_SECRET = Deno.env.get('REDDIT_CLIENT_SECRET');

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

export function inferSentiment(title: string, score: number): string {
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
export async function fetchReddit(idea: string): Promise<unknown> {
  if (!REDDIT_CLIENT_ID || !REDDIT_CLIENT_SECRET) {
    throw new Error('Reddit credentials not configured — set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in Supabase secrets');
  }
  return fetchRedditReal(idea);
}
