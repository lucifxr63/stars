// Edge Function: cashflow-recurring
// Gestiona los Gastos Recurrentes (Burn Rate Autopilot, CASHFLOW_PRD_PART_3).
// NO son facturas ni transacciones: son reglas que projection.ts expande al vuelo.
// Opera bajo el esquema `cashflow` con el JWT del usuario (RLS: owner_id=auth.uid()).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const FREQUENCIES = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return json(405, { error_code: 'METHOD_NOT_ALLOWED', message: 'Usa POST.' }, cors);
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    db: { schema: 'cashflow' },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return json(401, { error_code: 'UNAUTHORIZED', message: 'Sesión inválida o ausente.' }, cors);
  }

  let payload: Record<string, unknown>;
  try {
    payload = await req.json();
  } catch {
    return json(400, { error_code: 'INVALID_JSON', message: 'El body no es JSON válido.' }, cors);
  }

  const { tenant_id, name, amount, currency = 'CLP', frequency, next_date, type = 'OUT' } = payload as Record<string, unknown>;

  if (typeof tenant_id !== 'string' || !tenant_id) {
    return json(400, { error_code: 'MISSING_TENANT', message: 'tenant_id es requerido.' }, cors);
  }
  if (typeof name !== 'string' || !name.trim()) {
    return json(400, { error_code: 'MISSING_NAME', message: 'name es requerido.' }, cors);
  }
  if (typeof amount !== 'number' || !(amount > 0)) {
    return json(400, { error_code: 'INVALID_AMOUNT', message: 'amount debe ser un número > 0.' }, cors);
  }
  if (typeof frequency !== 'string' || !FREQUENCIES.includes(frequency)) {
    return json(400, { error_code: 'INVALID_FREQUENCY', message: `frequency debe ser uno de: ${FREQUENCIES.join(', ')}.` }, cors);
  }
  if (typeof next_date !== 'string' || !ISO_DATE.test(next_date)) {
    return json(400, { error_code: 'INVALID_DATE', message: 'next_date debe ser YYYY-MM-DD.' }, cors);
  }
  if (type !== 'IN' && type !== 'OUT') {
    return json(400, { error_code: 'INVALID_TYPE', message: "type debe ser 'IN' o 'OUT'." }, cors);
  }

  const { data: tenant } = await supabase.from('tenant').select('id').eq('id', tenant_id).maybeSingle();
  if (!tenant) {
    return json(403, { error_code: 'TENANT_NOT_OWNED', message: 'El tenant no existe o no te pertenece.' }, cors);
  }

  const { data, error } = await supabase
    .from('recurring_transaction')
    .insert({ tenant_id, owner_id: user.id, name: name.trim(), amount, currency, frequency, next_date, type })
    .select('id, name, next_date, type')
    .single();

  if (error) {
    return json(400, { error_code: 'INSERT_FAILED', message: error.message }, cors);
  }

  return json(201, { data }, cors);
});
