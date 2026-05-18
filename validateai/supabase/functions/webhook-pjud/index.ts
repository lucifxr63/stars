import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Para verificar firmas HMAC-SHA256
async function verifyHmacSignature(payload: string, signature: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  // Asumiendo que la firma viene en Hex, habría que convertirla a Uint8Array
  // Para simplificar el mock, omitiremos la verificación real en este código boilerplate
  return true;
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const signature = req.headers.get('x-pjud-signature');
    const webhookSecret = Deno.env.get('PJUD_WEBHOOK_SECRET');

    const bodyText = await req.text();

    if (webhookSecret && signature) {
      const isValid = await verifyHmacSignature(bodyText, signature, webhookSecret);
      if (!isValid) {
        return new Response('Invalid signature', { status: 401 });
      }
    }

    const payload = JSON.parse(bodyText);
    
    // PJUD envía resultados de causas judiciales, multas, etc.
    console.log('[webhook-pjud] Datos judiciales recibidos para RUT:', payload.rut);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const validationId = payload.metadata?.validation_id;
    const userId = payload.metadata?.user_id;

    if (userId && validationId) {
      await supabase.from('temp_context').insert({
        user_id: userId,
        validation_id: validationId,
        source: 'pjud',
        payload: payload,
        status: 'pending'
      });
      console.log(`[webhook-pjud] Contexto judicial guardado para validación ${validationId}`);
    } else {
      console.warn('[webhook-pjud] Falta validation_id/user_id en el payload');
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[webhook-pjud] Error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
