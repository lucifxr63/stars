import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Config ────────────────────────────────────────────────────────────────────
// FINTOC_WEBHOOK_SECRET: secreto HMAC compartido con Fintoc para verificar
// la autenticidad del webhook. Se configura en app.fintoc.com -> Webhooks.
// Sin este secreto, cualquier tercero podría inyectar eventos falsos.
const FINTOC_WEBHOOK_SECRET = Deno.env.get('FINTOC_WEBHOOK_SECRET');
const FINTOC_SECRET_KEY     = Deno.env.get('FINTOC_SECRET_KEY');
const FINTOC_API            = 'https://api.fintoc.com/v1';

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// ── HMAC-SHA256 verifier ──────────────────────────────────────────────────────
// Fintoc envía X-Fintoc-Signature: HMAC-SHA256(raw_body, webhook_secret)
// Si la firma no coincide, rechazamos la petición — previene prompt injection
// mediante eventos de webhook falsificados.
async function verifyFintocSignature(rawBody: string, signature: string): Promise<boolean> {
  if (!FINTOC_WEBHOOK_SECRET) return false;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(FINTOC_WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const signed = await crypto.subtle.sign('HMAC', keyMaterial, encoder.encode(rawBody));
  const computed = Array.from(new Uint8Array(signed))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  // Constant-time comparison para prevenir timing attacks
  if (computed.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

// ── Fintoc movement fetcher ───────────────────────────────────────────────────
interface FintocMovement {
  id: string;
  amount: number;
  post_date: string;
  description: string;
  currency: string;
  type: string;
  sender_account?: {
    holder_id: string;
    holder_name: string;
    institution: { id: string; name: string };
  };
}

async function fetchMovements(linkToken: string, accountId: string): Promise<FintocMovement[]> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const res = await fetch(
    `${FINTOC_API}/links/${linkToken}/accounts/${accountId}/movements?since=${since}`,
    {
      headers: {
        'Authorization': `Bearer ${FINTOC_SECRET_KEY}`,
        'Fintoc-Version': '2022-11-10',
      },
      signal: AbortSignal.timeout(15_000),
    }
  );
  if (!res.ok) throw new Error(`Fintoc movements HTTP ${res.status}`);
  return res.json();
}

// ── Main handler ──────────────────────────────────────────────────────────────
// Fintoc envía eventos a esta URL cuando hay nuevos movimientos disponibles.
// El endpoint recibe el webhook, verifica la firma HMAC-SHA256, obtiene los
// movimientos actualizados y los escribe en temp_context para el mega-prompt.
serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Credenciales no configuradas — loguear y responder 200 para no reencolar el webhook
  if (!FINTOC_WEBHOOK_SECRET || !FINTOC_SECRET_KEY) {
    console.warn('fintoc-webhook: secrets no configurados — FINTOC_WEBHOOK_SECRET y FINTOC_SECRET_KEY requeridos');
    return new Response(JSON.stringify({ received: true, warning: 'secrets_not_configured' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // 1. Leer el body RAW para verificación de firma (debe hacerse antes de parsear JSON)
    const rawBody = await req.text();
    const signature = req.headers.get('X-Fintoc-Signature') ?? '';

    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing X-Fintoc-Signature header' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. Verificar HMAC-SHA256 — rechazar cualquier evento no firmado por Fintoc
    const isValid = await verifyFintocSignature(rawBody, signature);
    if (!isValid) {
      console.error('fintoc-webhook: firma HMAC inválida — posible intento de inyección');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401, headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Parsear evento verificado
    const event = JSON.parse(rawBody);
    const eventType: string = event.type ?? '';

    // Solo procesar eventos de nuevos movimientos y refresh completado
    if (!['new_movements', 'refresh_intent.succeeded'].includes(eventType)) {
      return new Response(JSON.stringify({ received: true, skipped: true, event_type: eventType }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    }

    const linkToken: string = event.data?.link_token ?? event.link_token;
    const accountId: string = event.data?.account_id ?? event.account_id;
    // validation_id debe ser enviado como metadata en el webhook al configurarlo en Fintoc
    const validationId: string = event.data?.metadata?.validation_id ?? event.metadata?.validation_id;
    const userId: string = event.data?.metadata?.user_id ?? event.metadata?.user_id;

    if (!linkToken || !accountId || !validationId || !userId) {
      console.warn('fintoc-webhook: campos requeridos ausentes en el evento:', {
        linkToken: !!linkToken, accountId: !!accountId, validationId: !!validationId, userId: !!userId,
      });
      return new Response(JSON.stringify({
        received: true,
        warning: 'missing_metadata — configura validation_id y user_id en metadata del webhook Fintoc',
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }

    // 4. Obtener movimientos actualizados desde Fintoc API
    const movements = await fetchMovements(linkToken, accountId);

    const payload = {
      movements,
      fetched_at: new Date().toISOString(),
      event_type: eventType,
      account_id: accountId,
    };

    // 5. Upsert en temp_context (service role — bypasa RLS)
    const supabase = getSupabase();
    const { error: upsertError } = await supabase
      .from('temp_context')
      .upsert(
        {
          user_id: userId,
          validation_id: validationId,
          source: 'fintoc',
          payload,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'validation_id,source' }
      );

    if (upsertError) throw new Error(`temp_context upsert: ${upsertError.message}`);

    console.log(`fintoc-webhook: ${movements.length} movimientos escritos para validation_id=${validationId}`);

    // Siempre responder 200 a Fintoc para evitar reintentos
    return new Response(JSON.stringify({ received: true, movements_count: movements.length }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('fintoc-webhook error:', err);
    // Responder 200 de todas formas — un 500 causaría reintentos que podrían ser problemáticos
    return new Response(
      JSON.stringify({ received: true, error: String(err) }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
