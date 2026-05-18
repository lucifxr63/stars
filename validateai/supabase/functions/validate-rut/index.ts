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

// Algoritmo Módulo 11 para RUT chileno
function isValidRUT(rut: string): boolean {
  if (!/^[0-9]+[-|‐]{1}[0-9kK]{1}$/.test(rut)) return false;
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
      return new Response(JSON.stringify({ error: 'RUT inválido' }), {
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

    // Actualizar kyc_status a 'verified' y guardar el RUT
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ kyc_status: 'verified', rut: rut })
      .eq('id', user.id);

    if (updateError) {
      throw new Error(`Error actualizando perfil: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ success: true, message: 'Identidad validada con éxito' }), {
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
