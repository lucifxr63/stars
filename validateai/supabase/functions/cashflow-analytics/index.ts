// Edge Function: cashflow-analytics (reconciliación de nextstep.md §3)
// ⚠️ BORRADOR — NO DESPLEGADO. Revisar antes de `supabase functions deploy
//    cashflow-analytics --project-ref fcdhcntyvsydnvjwopfe`.
//
// Agrega ingresos / gastos / aportes de un tenant para un período YYYY-MM y
// devuelve JSON PURO listo para Recharts. Reemplaza el cálculo on-the-fly de la
// pestaña "Flujo de Caja" del Excel legado.
//
// Decisión (Friction Check vs nextstep.md): el doc proponía snapshots vía
// pg_cron para evitar recalcular saldos históricos. Para el MVP ese costo es
// prematuro: con índices (owner_id, record_date) la agregación de un tenant es
// trivial. Snapshots → Fase 2 cuando el volumen lo justifique. Aquí se calcula
// el saldo acumulado inicial sumando todo lo anterior al período (una sola
// pasada por tabla, acotada por RLS al tenant del usuario).
//
// GET /functions/v1/cashflow-analytics?tenant_id=<uuid>&period=YYYY-MM
// RLS: el token del usuario acota cada SELECT a sus propias filas (owner_id).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

function json(status: number, body: unknown, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// Primer día del mes siguiente al período (límite superior exclusivo).
function periodBounds(period: string): { start: string; nextStart: string } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(period);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const start = `${m[1]}-${m[2]}-01`;
  const ny = month === 12 ? year + 1 : year;
  const nm = month === 12 ? 1 : month + 1;
  const nextStart = `${ny}-${String(nm).padStart(2, '0')}-01`;
  return { start, nextStart };
}

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'GET') {
    return json(405, { error_code: 'METHOD_NOT_ALLOWED', message: 'Usa GET.' }, cors);
  }

  const url = new URL(req.url);
  const tenantId = url.searchParams.get('tenant_id') ?? '';
  const period = url.searchParams.get('period') ?? '';

  if (!tenantId) return json(400, { error_code: 'MISSING_TENANT', message: 'tenant_id es requerido.' }, cors);
  const bounds = periodBounds(period);
  if (!bounds) return json(400, { error_code: 'INVALID_PERIOD', message: 'period debe ser YYYY-MM.' }, cors);

  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    db: { schema: 'cashflow' },
    auth: { persistSession: false },
  });

  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return json(401, { error_code: 'UNAUTHORIZED', message: 'Sesión inválida.' }, cors);

  // Verificación de pertenencia del tenant (RLS también lo garantiza en cada query).
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenant').select('id').eq('id', tenantId).maybeSingle();
  if (tenantErr) return json(400, { error_code: 'QUERY_FAILED', message: tenantErr.message }, cors);
  if (!tenant) return json(403, { error_code: 'TENANT_NOT_OWNED', message: 'El tenant no existe o no te pertenece.' }, cors);

  // --- Fetch del período + acumulado previo (RLS acota a owner_id del usuario) ---
  const [revIn, expIn, conIn, revPrev, expPrev, conPrev] = await Promise.all([
    supabase.from('revenue').select('plan_name, net_income_clp')
      .eq('tenant_id', tenantId).gte('record_date', bounds.start).lt('record_date', bounds.nextStart),
    supabase.from('expense').select('category, total_amount')
      .eq('tenant_id', tenantId).gte('record_date', bounds.start).lt('record_date', bounds.nextStart),
    supabase.from('partner_contributions').select('amount_clp')
      .eq('tenant_id', tenantId).gte('record_date', bounds.start).lt('record_date', bounds.nextStart),
    supabase.from('revenue').select('net_income_clp').eq('tenant_id', tenantId).lt('record_date', bounds.start),
    supabase.from('expense').select('total_amount').eq('tenant_id', tenantId).lt('record_date', bounds.start),
    supabase.from('partner_contributions').select('amount_clp').eq('tenant_id', tenantId).lt('record_date', bounds.start),
  ]);

  for (const r of [revIn, expIn, conIn, revPrev, expPrev, conPrev]) {
    if (r.error) return json(400, { error_code: 'QUERY_FAILED', message: r.error.message }, cors);
  }

  const sum = (rows: Array<Record<string, unknown>> | null, key: string) =>
    (rows ?? []).reduce((acc, row) => acc + Number(row[key] ?? 0), 0);

  const totalRevenues = sum(revIn.data, 'net_income_clp');
  const totalExpenses = sum(expIn.data, 'total_amount');
  const partnerContributions = sum(conIn.data, 'amount_clp');
  const netMonthlyFlow = totalRevenues - totalExpenses;

  // Saldo inicial = acumulado de (flujo neto + aportes) de TODO lo anterior al período.
  const initialBalance =
    sum(revPrev.data, 'net_income_clp') - sum(expPrev.data, 'total_amount') + sum(conPrev.data, 'amount_clp');
  const finalAccumulated = initialBalance + netMonthlyFlow + partnerContributions;

  // Desglose por agrupación (plan / categoría), con etiqueta de "Sin clasificar".
  const groupBy = (rows: Array<Record<string, unknown>> | null, keyField: string, valField: string) => {
    const map = new Map<string, number>();
    for (const row of rows ?? []) {
      const cat = (row[keyField] as string) || 'Sin clasificar';
      map.set(cat, (map.get(cat) ?? 0) + Number(row[valField] ?? 0));
    }
    return [...map.entries()].map(([category, amount]) => ({ category, amount: round2(amount) }));
  };

  return json(200, {
    tenant_id: tenantId,
    period,
    currency: 'CLP',
    metrics: {
      initial_balance: round2(initialBalance),
      total_revenues: round2(totalRevenues),
      total_expenses: round2(totalExpenses),
      net_monthly_flow: round2(netMonthlyFlow),
      partner_contributions: round2(partnerContributions),
      final_accumulated_balance: round2(finalAccumulated),
    },
    breakdown: {
      revenues: groupBy(revIn.data, 'plan_name', 'net_income_clp'),
      expenses: groupBy(expIn.data, 'category', 'total_amount'),
    },
  }, cors);
});
