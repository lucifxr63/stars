import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const LS_API_KEY        = Deno.env.get('LEMONSQUEEZY_API_KEY')!;
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Variant IDs de Lemon Squeezy (Products → Variants en el dashboard)
const VARIANT_IDS: Record<string, string> = {
  basic:   Deno.env.get('LS_VARIANT_BASIC')!,
  pro:     Deno.env.get('LS_VARIANT_PRO')!,
  premium: Deno.env.get('LS_VARIANT_PREMIUM')!,
};

const LS_STORE_ID = Deno.env.get('LS_STORE_ID')!;

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors });
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { tier, success_url, cancel_url } = await req.json() as {
      tier: 'basic' | 'pro' | 'premium';
      success_url: string;
      cancel_url: string;
    };

    const variantId = VARIANT_IDS[tier];
    if (!variantId) {
      return new Response(JSON.stringify({ error: `Tier inválido: ${tier}` }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Crear Checkout en Lemon Squeezy
    const lsRes = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LS_API_KEY}`,
        'Content-Type': 'application/vnd.api+json',
        'Accept': 'application/vnd.api+json',
      },
      body: JSON.stringify({
        data: {
          type: 'checkouts',
          attributes: {
            checkout_data: {
              email: user.email,
              custom: {
                user_id: user.id,
                tier,
              },
            },
            product_options: {
              redirect_url: success_url,
              receipt_button_text: 'Ir al dashboard',
              receipt_thank_you_note: '¡Gracias por confiar en ValidateAI! Tu plan ya está activo.',
            },
            checkout_options: {
              button_color: '#7C6FF7',
            },
          },
          relationships: {
            store: {
              data: { type: 'stores', id: LS_STORE_ID },
            },
            variant: {
              data: { type: 'variants', id: variantId },
            },
          },
        },
      }),
    });

    if (!lsRes.ok) {
      const errText = await lsRes.text();
      throw new Error(`Lemon Squeezy error ${lsRes.status}: ${errText}`);
    }

    const lsData = await lsRes.json() as {
      data: { attributes: { url: string } };
    };

    const checkoutUrl = lsData.data.attributes.url;

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      status: 200, headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
