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
    const { brand_name, validation_id } = await req.json();

    if (!brand_name || !validation_id) {
      return new Response(JSON.stringify({ error: 'brand_name y validation_id son requeridos' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Validación de usuario
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

    // Integración INAPI deshabilitada temporalmente (mandato Mesa Directiva P0).
    // Mostrar datos inventados a usuarios que toman decisiones de negocio es riesgo legal.
    // Pendiente: implementar integración real vía OData en próximo sprint.
    return new Response(JSON.stringify({
      available: false,
      reason: 'integration_pending',
      message: 'La consulta de marcas INAPI estará disponible próximamente.',
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('inapi-fetch error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } }
    );
  }
});
