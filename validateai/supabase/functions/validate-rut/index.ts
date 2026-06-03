import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
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

// Algoritmo MÃ³dulo 11 para RUT chileno
function isValidRUT(rut: string): boolean {
  if (!/^[0-9]+[-|â€]{1}[0-9kK]{1}$/.test(rut)) return false;
  const [rutBody, dv] = rut.split('-');
  let rutNum = parseInt(rutBody, 10);
  let m = 0;
  let s = 1;
  while (rutNum !== 0) {
    s = (s + (rutNum % 10) * (9 - (m++ % 6))) % 11;
    rutNum = Math.floor(rutNum / 10);
  }
  const v = s > 0 ? '' + (s - 1) : 'K';
  return v === dv.toUpperCase();
}

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { rut } = await req.json();

    if (!rut || !isValidRUT(rut)) {
      return new Response(JSON.stringify({ error: 'RUT invÃ¡lido' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Hashear RUT antes de persistir — nunca almacenar plaintext
    const { data: rutHash } = await supabase
      .rpc('fn_hash_rut_value', { plain_rut: rut });

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ kyc_status: 'verified', rut_hash: rutHash ?? null })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(`Error actualizando perfil: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'Identidad validada con Ã©xito' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('validate-rut error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
