import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const FIGMA_CLIENT_ID     = Deno.env.get('FIGMA_CLIENT_ID')!;
const FIGMA_CLIENT_SECRET = Deno.env.get('FIGMA_CLIENT_SECRET')!;
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const FRONTEND_URL        = Deno.env.get('FRONTEND_URL') ?? 'https://validateai-mu.vercel.app';

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

async function getAuthenticatedUser(req: Request, supabase: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return null;
  const { data: { user }, error } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  );
  if (error || !user) return null;
  return user;
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    // POST /figma-oauth-handler/connect
    // Returns the Figma OAuth2 authorization URL
    if (req.method === 'POST' && path === 'connect') {
      const user = await getAuthenticatedUser(req, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401, cors);

      const { redirect_uri } = await req.json() as { redirect_uri?: string };
      const redirectUri = redirect_uri ?? `${FRONTEND_URL}/figma/callback`;

      const state = btoa(JSON.stringify({ user_id: user.id, ts: Date.now() }));
      const params = new URLSearchParams({
        client_id: FIGMA_CLIENT_ID,
        redirect_uri: redirectUri,
        scope: 'file_read',
        state,
        response_type: 'code',
      });

      return json({ url: `https://www.figma.com/oauth?${params}` }, 200, cors);
    }

    // POST /figma-oauth-handler/callback
    // Exchanges authorization code for access token and stores it
    if (req.method === 'POST' && path === 'callback') {
      const user = await getAuthenticatedUser(req, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401, cors);

      const { code, redirect_uri } = await req.json() as {
        code: string;
        redirect_uri?: string;
      };

      if (!code) return json({ error: 'Missing code' }, 400, cors);

      const redirectUri = redirect_uri ?? `${FRONTEND_URL}/figma/callback`;

      // Exchange code for token
      const tokenRes = await fetch('https://api.figma.com/v1/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: FIGMA_CLIENT_ID,
          client_secret: FIGMA_CLIENT_SECRET,
          redirect_uri: redirectUri,
          code,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        const err = await tokenRes.text();
        throw new Error(`Figma token exchange failed: ${err}`);
      }

      const tokenData = await tokenRes.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
        user_id?: string;
      };

      // Fetch Figma user info to store handle
      const meRes = await fetch('https://api.figma.com/v1/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const meData = meRes.ok
        ? (await meRes.json() as { id: string; handle: string })
        : { id: undefined, handle: undefined };

      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

      const { error: upsertError } = await supabase
        .from('figma_connections')
        .upsert({
          user_id: user.id,
          figma_user_id: meData.id ?? tokenData.user_id ?? null,
          figma_handle: meData.handle ?? null,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token ?? null,
          expires_at: expiresAt,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (upsertError) throw upsertError;

      return json({
        connected: true,
        figma_handle: meData.handle ?? null,
      }, 200, cors);
    }

    // GET /figma-oauth-handler/status
    // Returns current connection status for the authenticated user
    if (req.method === 'GET' && path === 'status') {
      const user = await getAuthenticatedUser(req, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401, cors);

      const { data } = await supabase
        .from('figma_connections')
        .select('figma_handle, expires_at, created_at')
        .eq('user_id', user.id)
        .maybeSingle();

      return json({ connected: !!data, ...data }, 200, cors);
    }

    // DELETE /figma-oauth-handler/disconnect
    // Removes the Figma connection for the authenticated user
    if (req.method === 'DELETE' && path === 'disconnect') {
      const user = await getAuthenticatedUser(req, supabase);
      if (!user) return json({ error: 'Unauthorized' }, 401, cors);

      await supabase
        .from('figma_connections')
        .delete()
        .eq('user_id', user.id);

      return json({ disconnected: true }, 200, cors);
    }

    return json({ error: 'Not found' }, 404, cors);

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return json({ error: msg }, 500, cors);
  }
});
