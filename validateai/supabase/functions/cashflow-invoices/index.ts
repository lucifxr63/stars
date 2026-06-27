// Edge Function: cashflow-invoices
// Crea una factura manual (Cuentas por Cobrar/Pagar) del producto Cashflow.
// Contrato estricto del CASHFLOW_PRD.md. En Fase 1 la ingesta es solo MANUAL;
// los flags source_system SII/ODOO existen en el esquema para escalabilidad
// futura pero esta función los RECHAZA (400 INVALID_SOURCE_SYSTEM).
//
// Opera bajo el esquema aislado `cashflow`. Usa el JWT del usuario (cliente
// scoped por Authorization) para que RLS aplique: owner_id = auth.uid().

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') {
    return json(405, { error_code: 'METHOD_NOT_ALLOWED', message: 'Usa POST.' }, cors);
  }

  // Cliente scoped al usuario → RLS activa (owner_id = auth.uid()).
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

  const {
    tenant_id,
    type,
    total_amount,
    currency = 'CLP',
    issue_date,
    due_date,
    contact_name = null,
    source_system = 'MANUAL',
    external_id = null,
  } = payload as Record<string, unknown>;

  // ── Regla de negocio Fase 1 ──
  // Ingesta manual ('MANUAL') o asistida por IA desde PDF ('PDF_AI').
  // Las integraciones SII/ODOO siguen bloqueadas hasta fases posteriores.
  if (source_system !== 'MANUAL' && source_system !== 'PDF_AI') {
    return json(400, {
      error_code: 'INVALID_SOURCE_SYSTEM',
      message: "source_system solo puede ser 'MANUAL' o 'PDF_AI' en esta fase.",
    }, cors);
  }

  // ── Validaciones de payload ──
  if (typeof tenant_id !== 'string' || !tenant_id) {
    return json(400, { error_code: 'MISSING_TENANT', message: 'tenant_id es requerido.' }, cors);
  }
  if (type !== 'AR' && type !== 'AP') {
    return json(400, { error_code: 'INVALID_TYPE', message: "type debe ser 'AR' o 'AP'." }, cors);
  }
  if (typeof total_amount !== 'number' || !(total_amount > 0)) {
    return json(400, { error_code: 'INVALID_AMOUNT', message: 'total_amount debe ser un número > 0.' }, cors);
  }
  if (typeof issue_date !== 'string' || !ISO_DATE.test(issue_date) ||
      typeof due_date !== 'string' || !ISO_DATE.test(due_date)) {
    return json(400, { error_code: 'INVALID_DATES', message: 'issue_date y due_date deben ser YYYY-MM-DD.' }, cors);
  }

  // El tenant debe pertenecer al usuario (RLS lo limita; damos error explícito).
  const { data: tenant } = await supabase.from('tenant').select('id').eq('id', tenant_id).maybeSingle();
  if (!tenant) {
    return json(403, { error_code: 'TENANT_NOT_OWNED', message: 'El tenant no existe o no te pertenece.' }, cors);
  }

  const { data, error } = await supabase
    .from('invoice')
    .insert({
      tenant_id,
      owner_id: user.id,
      type,
      total_amount,
      currency,
      contact_name,
      issue_date,
      due_date,
      status: 'PENDING',
      source_system,
      external_id,
    })
    .select('id, tenant_id, type, total_amount, status, source_system')
    .single();

  if (error) {
    return json(400, { error_code: 'INSERT_FAILED', message: error.message }, cors);
  }

  return json(201, { data }, cors);
});
