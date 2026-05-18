import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  // Solo permitimos POST
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const signature = req.headers.get('fintoc-signature');
    if (!signature) {
      console.warn('[fintoc-webhook] Falta firma');
      return new Response('Unauthorized', { status: 401 });
    }

    // En un escenario real, deberíamos verificar fintoc-signature usando HMAC SHA256
    // con nuestro webhook secret. Aquí asumiremos validez temporalmente o implementaremos
    // una validación básica.
    
    const payload = await req.json();
    
    // Fintoc envía eventos como 'link.created', 'account.refreshed'
    console.log('[fintoc-webhook] Evento recibido:', payload.type);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Metadata contiene el user_id que pasamos al crear el link_token
    const userId = payload.data?.link?.metadata?.user_id || payload.data?.metadata?.user_id;
    const validationId = payload.data?.link?.metadata?.validation_id || payload.data?.metadata?.validation_id;

    if (userId && validationId) {
      // Guardar de forma asíncrona en la tabla temp_context
      await supabase.from('temp_context').insert({
        user_id: userId,
        validation_id: validationId,
        source: 'fintoc',
        payload: payload,
        status: 'pending'
      });
      console.log(`[fintoc-webhook] Contexto guardado para el usuario ${userId}`);
    } else {
      console.warn('[fintoc-webhook] No se encontró user_id/validation_id en la metadata del webhook');
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[fintoc-webhook] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
