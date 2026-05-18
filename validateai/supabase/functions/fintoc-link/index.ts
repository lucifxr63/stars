import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    // Auth Validation (must be logged in)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // FINTOC Link Token Generation
    const FINTOC_SECRET_KEY = Deno.env.get('FINTOC_SECRET_KEY');
    if (!FINTOC_SECRET_KEY) {
      throw new Error('FINTOC_SECRET_KEY no configurado en los secretos de Supabase.');
    }

    // Solicitamos un link token temporal para el usuario (instituciones chilenas)
    const fintocRes = await fetch('https://api.fintoc.com/v1/link_tokens', {
      method: 'POST',
      headers: {
        'Authorization': FINTOC_SECRET_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        product: 'movements', // Para análisis de liquidez e ingresos
        country: 'cl',
        mode: 'live', // Puede cambiarse a test usando una key de test
        metadata: {
          user_id: user.id
        }
      })
    });

    if (!fintocRes.ok) {
      const err = await fintocRes.text();
      throw new Error(`Error Fintoc API: ${fintocRes.status} ${err}`);
    }

    const tokenData = await fintocRes.json();

    return new Response(JSON.stringify({ link_token: tokenData.link_token }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('fintoc-link error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
