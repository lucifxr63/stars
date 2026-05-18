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

    // Búsqueda en INAPI OpenData (Placeholder o llamada real si el endpoint es estable)
    // En la realidad, INAPI Open Data ofrece un OData endpoint o descargas en bloque.
    // Para la MVP, mockearemos la respuesta después de un delay simulando el scraper.
    
    // Simular un tiempo de respuesta de INAPI
    await new Promise(resolve => setTimeout(resolve, 1500));

    const mockInapiResponse = {
      brand_searched: brand_name,
      matches_found: Math.floor(Math.random() * 3),
      similar_trademarks: [
        { name: `${brand_name} Tech`, status: 'Registrada', class: 9 },
        { name: `${brand_name} App`, status: 'En trámite', class: 42 }
      ],
      risk_level: 'medium',
      observation: 'Existen marcas fonéticamente similares en la clase 9 y 42.'
    };

    // Almacenamos el resultado en temp_context para el motor RAG
    await supabase.from('temp_context').insert({
      user_id: user.id,
      validation_id: validation_id,
      source: 'inapi',
      payload: mockInapiResponse,
      status: 'processed'
    });

    return new Response(JSON.stringify({ success: true, data: mockInapiResponse }), {
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
