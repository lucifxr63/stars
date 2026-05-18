// Edge Function: register-consent
// Registra el consentimiento explícito del usuario bajo Ley N° 21.719 (Chile)
// Usa SERVICE_ROLE_KEY para bypasear RLS e insertar en consent_logs.
// El cliente NO tiene permiso de INSERT directo sobre esa tabla.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://validateai.cl',
  'https://www.validateai.cl',
  'http://localhost:5173',
  'http://localhost:4173',
];

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  const corsHeaders = {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verificar que el request viene de un usuario autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cliente con SERVICE_ROLE (bypass de RLS para insertar en consent_logs)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Verificar sesión del usuario
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parsear body
    const body = await req.json();
    const { ip_address, rut, consent_type = 'data_processing' } = body;

    // Verificar si ya existe un registro válido (evitar duplicados)
    const { data: existing } = await supabaseAdmin
      .from('consent_logs')
      .select('id')
      .eq('user_id', user.id)
      .eq('flagged', true)
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Ya tiene consentimiento — retornar OK sin duplicar
      return new Response(JSON.stringify({ ok: true, already_registered: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insertar el consentimiento
    const { error: insertError } = await supabaseAdmin
      .from('consent_logs')
      .insert({
        user_id: user.id,
        ip_address: ip_address ?? null,
        rut: rut ?? null,
        consent_type,
        flagged: true,
        consented_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('[register-consent] Insert error:', insertError);
      return new Response(JSON.stringify({ error: 'Failed to register consent' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[register-consent] Consentimiento registrado: user=${user.id} ip=${ip_address} rut=${rut ? '***' : 'none'}`);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[register-consent] Unexpected error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
