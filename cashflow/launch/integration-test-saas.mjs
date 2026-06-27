// Smoke Test E2E — lente SaaS de Cashflow (aportes / gastos / ingresos + analítica).
// Protocolo CERO HUELLA: crea usuarios temporales (service_role), ejercita el
// pipeline completo a través de RLS y los borra (ON DELETE CASCADE purga todo).
//
// Uso:  node launch/integration-test-saas.mjs
// Lee credenciales de cashflow/.env.local (SERVICE_ROLE + URL + ANON).

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(join(here, '..', '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
);

const URL = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !ANON || !SERVICE) {
  console.error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

let failures = 0;
const ok = (m) => console.log(`  \x1b[32m✅\x1b[0m ${m}`);
const bad = (m) => { console.log(`  \x1b[31m❌ ${m}\x1b[0m`); failures++; };
const assert = (cond, m) => (cond ? ok(m) : bad(m));
const section = (t) => console.log(`\n\x1b[1m── ${t} ──\x1b[0m`);

const admin = createClient(URL, SERVICE, { auth: { persistSession: false }, db: { schema: 'cashflow' } });
const userClient = () => createClient(URL, ANON, { auth: { persistSession: false }, db: { schema: 'cashflow' } });

// Período actual y fecha de registro dentro de ese mes.
const now = new Date();
const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
const recordDate = `${period}-15`;

// Montos esperados (ver aserciones del contrato).
const REVENUE = { gross_amount_usd: 100, exchange_rate: 950, gross_amount_clp: 95000, gateway_commission: 5000, net_income_clp: 90000, vat_status: 'EXENTO', vat_amount: 0, plan_name: 'Plan Basic', client_name: 'Cliente Test' };
const EXPENSE = { net_amount: 10000, vat_status: 'AFECTO', vat_amount: 1900, total_amount: 11900, funded_by: 'COMPANY', category: 'COGS_Servidores', provider: 'AWS' };
const CONTRIB = { amount_clp: 100000, partner_name: 'Socio Test', transaction_reference: 'TRX-TEST', financial_item: 'Capital operativo' };

const EXPECT = {
  total_revenues: 90000,
  total_expenses: 11900,
  partner_contributions: 100000,
  net_monthly_flow: 78100,        // 90000 - 11900
  initial_balance: 0,             // usuario nuevo, sin histórico previo
  final_accumulated_balance: 178100, // 0 + 78100 + 100000
};

const tag = Date.now();
const userA = { email: `cf-saas-a-${tag}@scouttech.lat`, password: `Test-${tag}-aa` };
const userB = { email: `cf-saas-b-${tag}@scouttech.lat`, password: `Test-${tag}-bb` };
let idA, idB;

async function run() {
  section('Setup — 2 usuarios temporales + login');
  const a = await admin.auth.admin.createUser({ email: userA.email, password: userA.password, email_confirm: true });
  const b = await admin.auth.admin.createUser({ email: userB.email, password: userB.password, email_confirm: true });
  idA = a.data.user?.id; idB = b.data.user?.id;
  assert(idA && idB, `Usuarios creados (A=${idA?.slice(0, 8)} B=${idB?.slice(0, 8)})`);

  const ca = userClient();
  const cb = userClient();
  const sa = await ca.auth.signInWithPassword(userA);
  const sb = await cb.auth.signInWithPassword(userB);
  assert(!sa.error && !sb.error, 'Login (password) de ambos usuarios');

  const tA = await ca.from('tenant').select('id').limit(1).maybeSingle();
  const tenantA = tA.data?.id;
  assert(!!tenantA, 'A tiene tenant por defecto (trigger)');

  section('INSERT vía RLS — aporte, gasto e ingreso');
  const rIns = await ca.from('revenue').insert({ tenant_id: tenantA, owner_id: idA, record_date: recordDate, ...REVENUE }).select().single();
  assert(!rIns.error && rIns.data?.id, `Ingreso insertado (net=${rIns.data?.net_income_clp})`);
  const eIns = await ca.from('expense').insert({ tenant_id: tenantA, owner_id: idA, record_date: recordDate, ...EXPENSE }).select().single();
  assert(!eIns.error && eIns.data?.id, `Gasto insertado (total=${eIns.data?.total_amount}, IVA=${eIns.data?.vat_amount})`);
  const cIns = await ca.from('partner_contributions').insert({ tenant_id: tenantA, owner_id: idA, record_date: recordDate, ...CONTRIB }).select().single();
  assert(!cIns.error && cIns.data?.id, `Aporte insertado (monto=${cIns.data?.amount_clp})`);

  section('RLS WITH CHECK — rechazar owner_id ajeno');
  const spoof = await ca.from('expense').insert({ tenant_id: tenantA, owner_id: idB, record_date: recordDate, ...EXPENSE });
  assert(!!spoof.error, `INSERT con owner_id de B → rechazado por RLS (${spoof.error?.code ?? 'sin error?!'})`);

  section('Edge Function — cashflow-analytics (contrato JSON)');
  const res = await ca.functions.invoke(`cashflow-analytics?tenant_id=${tenantA}&period=${period}`, { method: 'GET' });
  assert(!res.error && res.data, `200 OK del endpoint (period=${period})`);
  const m = res.data?.metrics;
  if (m) {
    assert(m.total_revenues === EXPECT.total_revenues, `total_revenues = ${m.total_revenues} (esperado ${EXPECT.total_revenues})`);
    assert(m.total_expenses === EXPECT.total_expenses, `total_expenses = ${m.total_expenses} (esperado ${EXPECT.total_expenses})`);
    assert(m.partner_contributions === EXPECT.partner_contributions, `partner_contributions = ${m.partner_contributions} (esperado ${EXPECT.partner_contributions})`);
    assert(m.net_monthly_flow === EXPECT.net_monthly_flow, `net_monthly_flow = ${m.net_monthly_flow} (esperado ${EXPECT.net_monthly_flow})`);
    assert(m.initial_balance === EXPECT.initial_balance, `initial_balance = ${m.initial_balance} (esperado ${EXPECT.initial_balance})`);
    assert(m.final_accumulated_balance === EXPECT.final_accumulated_balance, `final_accumulated_balance = ${m.final_accumulated_balance} (esperado ${EXPECT.final_accumulated_balance})`);
  } else {
    bad('metrics ausente en el payload');
  }
  const revBd = res.data?.breakdown?.revenues?.find((x) => x.category === 'Plan Basic');
  const expBd = res.data?.breakdown?.expenses?.find((x) => x.category === 'COGS_Servidores');
  assert(revBd?.amount === 90000, `breakdown ingresos "Plan Basic" = ${revBd?.amount} (esperado 90000)`);
  assert(expBd?.amount === 11900, `breakdown gastos "COGS_Servidores" = ${expBd?.amount} (esperado 11900)`);

  section('Aislamiento RLS — B no ve nada de A');
  const bRev = await cb.from('revenue').select('id');
  const bExp = await cb.from('expense').select('id');
  const bCon = await cb.from('partner_contributions').select('id');
  assert((bRev.data?.length ?? -1) === 0, `B no ve ingresos de A (${bRev.data?.length})`);
  assert((bExp.data?.length ?? -1) === 0, `B no ve gastos de A (${bExp.data?.length})`);
  assert((bCon.data?.length ?? -1) === 0, `B no ve aportes de A (${bCon.data?.length})`);
}

async function cleanup() {
  section('Teardown — borrar usuarios (cascade = cero huella)');
  for (const id of [idA, idB]) {
    if (!id) continue;
    const r = await admin.auth.admin.deleteUser(id);
    assert(!r.error, `Usuario ${id.slice(0, 8)} borrado (cascade purga sus filas)`);
  }
}

console.log('\x1b[1mSmoke Test E2E — lente SaaS (cero huella)\x1b[0m');
try {
  await run();
} catch (e) {
  bad(`Excepción: ${e.message}`);
} finally {
  await cleanup().catch((e) => bad(`Cleanup falló: ${e.message}`));
}

console.log('\n' + '─'.repeat(50));
if (failures === 0) {
  console.log('\x1b[32m\x1b[1m✅ CONTRATO CERTIFICADO — todas las aserciones en verde. Cero huella.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\x1b[31m\x1b[1m❌ ${failures} aserción(es) fallaron.\x1b[0m`);
  process.exit(1);
}
