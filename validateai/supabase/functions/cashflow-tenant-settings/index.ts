// Edge Function: cashflow-tenant-settings (CASHFLOW_PRD_PHASE_2)
// Actualiza la configuración fiscal (reserva de impuestos) y de alertas del tenant.
// PATCH /functions/v1/cashflow-tenant-settings. RLS: owner_id = auth.uid().

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'PATCH' && req.method !== 'POST') {
    return json(405, { error_code: 'METHOD_NOT_ALLOWED', message: 'Usa PATCH.' }, cors);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    db: { schema: 'cashflow' },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json(401, { error_code: 'UNAUTHORIZED', message: 'Sesión inválida.' }, cors);

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error_code: 'INVALID_JSON', message: 'Body inválido.' }, cors);
  }

  const { tenant_id, default_tax_rate, weekly_alerts_enabled } = payload as Record<string, unknown>;

  if (typeof tenant_id !== 'string' || !tenant_id) {
    return json(400, { error_code: 'MISSING_TENANT', message: 'tenant_id es requerido.' }, cors);
  }
  if (typeof default_tax_rate !== 'number' || default_tax_rate < 0 || default_tax_rate > 100) {
    return json(400, { error_code: 'INVALID_TAX_RATE', message: 'default_tax_rate debe ser un número entre 0 y 100.' }, cors);
  }
  if (typeof weekly_alerts_enabled !== 'boolean') {
    return json(400, { error_code: 'INVALID_ALERTS', message: 'weekly_alerts_enabled debe ser booleano.' }, cors);
  }

  // RLS garantiza que solo el dueño actualiza su propio tenant.
  const { data, error } = await supabase
    .from('tenant')
    .update({ default_tax_rate, weekly_alerts_enabled })
    .eq('id', tenant_id)
    .select('id, default_tax_rate, weekly_alerts_enabled')
    .maybeSingle();

  if (error) return json(400, { error_code: 'UPDATE_FAILED', message: error.message }, cors);
  if (!data) return json(403, { error_code: 'TENANT_NOT_OWNED', message: 'El tenant no existe o no te pertenece.' }, cors);

  return json(200, { data: { tenant_id: data.id, default_tax_rate: data.default_tax_rate, weekly_alerts_enabled: data.weekly_alerts_enabled } }, cors);
});
