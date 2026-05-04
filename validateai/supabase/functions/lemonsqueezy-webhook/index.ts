import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LS_WEBHOOK_SECRET = Deno.env.get('LS_WEBHOOK_SECRET')!;
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Mapeo Variant ID → tier interno
const VARIANT_TO_TIER: Record<string, string> = {
  [Deno.env.get('LS_VARIANT_BASIC')   ?? '']: 'basic',
  [Deno.env.get('LS_VARIANT_PRO')     ?? '']: 'pro',
  [Deno.env.get('LS_VARIANT_PREMIUM') ?? '']: 'premium',
};

async function verifySignature(req: Request, body: string): Promise<boolean> {
  const signature = req.headers.get('X-Signature');
  if (!signature) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(LS_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  const expected = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return signature === expected;
}

serve(async (req) => {
  const rawBody = await req.text();

  const valid = await verifySignature(req, rawBody);
  if (!valid) {
    return new Response('Invalid signature', { status: 401 });
  }

  const event = JSON.parse(rawBody) as {
    meta: {
      event_name: string;
      custom_data?: { user_id?: string; tier?: string };
    };
    data: {
      id: string;
      attributes: {
        status: string;
        variant_id: number;
        ends_at: string | null;
        renews_at: string | null;
        user_email?: string;
      };
    };
  };

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const eventName = event.meta.event_name;
  const userId    = event.meta.custom_data?.user_id;
  const attrs     = event.data.attributes;

  try {
    switch (eventName) {

      // Suscripción creada tras pago exitoso → activar tier
      case 'subscription_created': {
        if (!userId) break;

        const variantId = String(attrs.variant_id);
        const tier = event.meta.custom_data?.tier ?? VARIANT_TO_TIER[variantId] ?? 'basic';
        const expiresAt = attrs.renews_at ?? attrs.ends_at;

        await supabase
          .from('profiles')
          .update({
            tier,
            ls_subscription_id: event.data.id,
            tier_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          })
          .eq('id', userId);
        break;
      }

      // Renovación o cambio de plan
      case 'subscription_updated': {
        if (!userId) break;

        const variantId = String(attrs.variant_id);
        const tier = VARIANT_TO_TIER[variantId] ?? 'free';
        const isActive = attrs.status === 'active' || attrs.status === 'on_trial';
        const expiresAt = attrs.renews_at ?? attrs.ends_at;

        await supabase
          .from('profiles')
          .update({
            tier: isActive ? tier : 'free',
            tier_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          })
          .eq('id', userId);
        break;
      }

      // Usuario cancela (sigue activo hasta fin de período)
      case 'subscription_cancelled': {
        if (!userId) break;
        const expiresAt = attrs.ends_at;

        await supabase
          .from('profiles')
          .update({
            tier_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
          })
          .eq('id', userId);
        break;
      }

      // Período finalizado → degradar a free
      case 'subscription_expired': {
        if (!userId) break;

        await supabase
          .from('profiles')
          .update({ tier: 'free', ls_subscription_id: null, tier_expires_at: null })
          .eq('id', userId);
        break;
      }

      // Pago fallido — log sin degradar (LS reintenta automáticamente)
      case 'subscription_payment_failed': {
        console.warn(`Payment failed — subscription ${event.data.id}, user ${userId ?? 'unknown'}`);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Handler error';
    console.error('Webhook handler error:', msg);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
