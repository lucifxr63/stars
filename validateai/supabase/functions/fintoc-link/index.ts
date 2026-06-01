import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// â”€â”€ Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FINTOC_SECRET_KEY: clave secreta de Fintoc â€” nunca expuesta al frontend.
// Disponible en https://app.fintoc.com -> ConfiguraciÃ³n -> API Keys
const FINTOC_SECRET_KEY = Deno.env.get('FINTOC_SECRET_KEY');
const FINTOC_API = 'https://api.fintoc.com/v1';

const ALLOWED_ORIGINS = [
  'https://validus.scouttech.lat',
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

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
}

// â”€â”€ Fintoc API helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface FintocMovement {
  id: string;
  object: string;
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

interface FintocAccount {
  id: string;
  name: string;
  currency: string;
  balance: { available: number; current: number };
  institution: { id: string; name: string };
  holder_id: string;
  holder_name: string;
}

async function fintocGet<T>(path: string): Promise<T> {
  const res = await fetch(`${FINTOC_API}${path}`, {
    headers: {
      'Authorization': `Bearer ${FINTOC_SECRET_KEY}`,
      'Fintoc-Version': '2022-11-10',
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Fintoc ${path} HTTP ${res.status}: ${err}`);
  }
  return res.json();
}

// â”€â”€ Main handler â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Contrato: el frontend envÃ­a el link_token recibido despuÃ©s de que el usuario
// completÃ³ el widget de Fintoc. Esta funciÃ³n usa el token para buscar las cuentas
// y movimientos del banco, y los almacena en temp_context para el mega-prompt.
serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  // Credenciales no configuradas â€” modo degradado sin crash
  if (!FINTOC_SECRET_KEY) {
    return new Response(JSON.stringify({
      available: false,
      reason: 'fintoc_not_configured',
      message: 'IntegraciÃ³n Fintoc pendiente de configuraciÃ³n. Agrega FINTOC_SECRET_KEY a Supabase Secrets.',
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  try {
    const { link_token, validation_id } = await req.json();

    if (!link_token || !validation_id) {
      return new Response(JSON.stringify({ error: 'link_token y validation_id son requeridos' }), {
        status: 400, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // Verificar usuario autenticado
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const supabase = getSupabase();
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    // 1. Obtener lista de cuentas vinculadas con el link_token
    const accounts = await fintocGet<FintocAccount[]>(`/links/${link_token}/accounts`);
    if (!accounts.length) throw new Error('No se encontraron cuentas bancarias para este link_token');

    // Priorizar cuenta corriente sobre otras (mejor seÃ±al de flujo operacional)
    const account = accounts.find(a => a.name.toLowerCase().includes('corriente')) ?? accounts[0];

    // 2. Obtener movimientos de los Ãºltimos 90 dÃ­as
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const movements = await fintocGet<FintocMovement[]>(
      `/links/${link_token}/accounts/${account.id}/movements?since=${since}`
    );

    // 3. Ensamblar payload para temp_context
    // El holder_rut se usa para KYC: cruzar con RUT en escrituras de la empresa
    const payload = {
      holder_rut: account.holder_id,
      holder_name: account.holder_name,
      institution: account.institution.name,
      balance_available: account.balance.available,
      balance_current: account.balance.current,
      currency: account.currency,
      movements,
      fetched_at: new Date().toISOString(),
      account_count: accounts.length,
    };

    // 4. Upsert en temp_context (RLS: service role tiene acceso total)
    const { error: upsertError } = await supabase
      .from('temp_context')
      .upsert(
        {
          user_id: user.id,
          validation_id,
          source: 'fintoc',
          payload,
          status: 'pending',
          created_at: new Date().toISOString(),
        },
        { onConflict: 'validation_id,source' }
      );

    if (upsertError) throw new Error(`temp_context upsert: ${upsertError.message}`);

    return new Response(JSON.stringify({
      success: true,
      movements_count: movements.length,
      institution: account.institution.name,
      holder_rut: account.holder_id,
      balance_available: account.balance.available,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('fintoc-link error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: String(err) }),
      { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } },
    );
  }
});
