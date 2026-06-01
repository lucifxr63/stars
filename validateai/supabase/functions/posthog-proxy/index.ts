/**
 * posthog-proxy â€” Supabase Edge Function (Deno 2)
 *
 * Routes all PostHog traffic through a first-party subdomain so ad-blockers
 * (EasyPrivacy, uBlock) cannot intercept analytics events.
 *
 * Upstream paths forwarded transparently:
 *   /posthog-proxy/capture/  â†’ https://app.posthog.com/capture/
 *   /posthog-proxy/static/*  â†’ https://app.posthog.com/static/*   (SDK assets)
 *   /posthog-proxy/array/*   â†’ https://app.posthog.com/array/*    (feature flags / remote config)
 *
 * Frontend config: VITE_POSTHOG_HOST = <SUPABASE_URL>/functions/v1/posthog-proxy
 */

const POSTHOG_UPSTREAM = 'https://app.posthog.com';
const FUNCTION_SLUG    = 'posthog-proxy';

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
];

function corsHeaders(origin: string): Record<string, string> {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin':  allowed,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('Origin') ?? '';
  const cors   = corsHeaders(origin);

  // Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    const url = new URL(req.url);

    // Extract sub-path after /posthog-proxy (e.g. /capture/, /static/array.js)
    const parts    = url.pathname.split(`/${FUNCTION_SLUG}`);
    const subPath  = parts[1] || '/';
    const upstream = `${POSTHOG_UPSTREAM}${subPath}${url.search}`;

    // Build forwarded headers â€” preserve Content-Type and GeoIP chain
    const fwdHeaders: Record<string, string> = {
      'Content-Type': req.headers.get('Content-Type') ?? 'application/json',
    };
    const clientIp =
      req.headers.get('CF-Connecting-IP') ??
      req.headers.get('X-Forwarded-For') ?? '';
    if (clientIp) fwdHeaders['X-Forwarded-For'] = clientIp;

    const phRes = await fetch(upstream, {
      method:  req.method,
      headers: fwdHeaders,
      body:    req.method !== 'GET' && req.method !== 'HEAD' ? req.body : null,
    });

    // Build response headers: CORS + Content-Type + cache hints for static assets
    const resHeaders = new Headers(cors);
    const ct = phRes.headers.get('Content-Type');
    if (ct) resHeaders.set('Content-Type', ct);
    const cc = phRes.headers.get('Cache-Control');
    if (cc) resHeaders.set('Cache-Control', cc);

    return new Response(phRes.body, {
      status:  phRes.status,
      headers: resHeaders,
    });

  } catch (err) {
    console.error('[posthog-proxy]', err);
    return new Response(JSON.stringify({ error: 'proxy_error' }), {
      status:  502,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
