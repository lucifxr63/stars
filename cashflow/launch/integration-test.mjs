// Test de integración de backend — Cashflow producción.
// Crea 2 usuarios temporales (service_role), ejercita todo el sistema y los
// borra al final (ON DELETE CASCADE limpia todas sus filas). Auditable.
//
// Uso:  node launch/integration-test.mjs
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

function userClient() {
  return createClient(URL, ANON, { auth: { persistSession: false }, db: { schema: 'cashflow' } });
}

const INVOICE_LINES = ['FACTURA', 'Proveedor: Comercial Andes Ltda.', 'Fecha de emision: 2026-06-01', 'Fecha de vencimiento: 2026-07-01', 'Total a pagar: 150000 CLP'];
const QUOTE_LINES = ['COTIZACION / PRESUPUESTO', 'Proveedor: Comercial Andes Ltda.', 'Validez de la oferta: 15 dias', 'Este documento NO es una factura ni tiene valor tributario', 'Total estimado: 150000 CLP'];

function buildPdf(lines) {
  const content = `BT /F1 14 Tf 72 720 Td 16 TL ${lines.map((l) => `(${l}) Tj T*`).join(' ')} ET`;
  const objs = [
    '<</Type/Catalog/Pages 2 0 R>>',
    '<</Type/Pages/Kids[3 0 R]/Count 1>>',
    '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 4 0 R>>>>/Contents 5 0 R>>',
    '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offs.forEach((o) => { pdf += `${String(o).padStart(10, '0')} 00000 n \n`; });
  pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return new TextEncoder().encode(pdf);
}

const tag = Date.now();
const userA = { email: `cf-test-a-${tag}@scouttech.lat`, password: `Test-${tag}-aa` };
const userB = { email: `cf-test-b-${tag}@scouttech.lat`, password: `Test-${tag}-bb` };
let idA, idB;

async function run() {
  section('Setup — crear 2 usuarios temporales');
  const a = await admin.auth.admin.createUser({ email: userA.email, password: userA.password, email_confirm: true });
  const b = await admin.auth.admin.createUser({ email: userB.email, password: userB.password, email_confirm: true });
  idA = a.data.user?.id; idB = b.data.user?.id;
  assert(idA && idB, `Usuarios creados (A=${idA?.slice(0, 8)} B=${idB?.slice(0, 8)})`);

  const ca = userClient();
  const cb = userClient();
  const sa = await ca.auth.signInWithPassword(userA);
  const sb = await cb.auth.signInWithPassword(userB);
  assert(!sa.error && !sb.error, 'Login (password) de ambos usuarios');

  section('Trigger de identidad — profile + tenant por defecto');
  const tA = await ca.from('tenant').select('*').limit(1).maybeSingle();
  assert(!tA.error && tA.data, 'A tiene tenant por defecto (trigger)');
  const pA = await ca.from('profiles').select('id').eq('id', idA).maybeSingle();
  assert(!pA.error && pA.data, 'A tiene profile (trigger)');
  const tenantA = tA.data?.id;

  section('Settings de tenant — cashflow-tenant-settings (impuestos/alertas)');
  const setRes = await ca.functions.invoke('cashflow-tenant-settings', { method: 'PATCH', body: { tenant_id: tenantA, default_tax_rate: 19, weekly_alerts_enabled: false } });
  assert(!setRes.error && setRes.data?.data?.default_tax_rate == 19, `Tasa de impuesto guardada (${setRes.data?.data?.default_tax_rate}%)`);
  const tAfter = await ca.from('tenant').select('default_tax_rate, weekly_alerts_enabled').eq('id', tenantA).single();
  assert(Number(tAfter.data?.default_tax_rate) === 19 && tAfter.data?.weekly_alerts_enabled === false, 'Settings persistidos (tax=19, alerts=off)');

  section('Cuenta + transacciones (balance trigger)');
  const acc = await ca.from('bank_account').insert({ tenant_id: tenantA, owner_id: idA, name: 'Cuenta Test', current_balance: 0 }).select().single();
  assert(!acc.error && acc.data, 'A crea cuenta bancaria');
  const accId = acc.data?.id;
  await ca.from('transaction').insert({ account_id: accId, owner_id: idA, amount: 1000000, type: 'IN' });
  await ca.from('transaction').insert({ account_id: accId, owner_id: idA, amount: 300000, type: 'OUT' });
  const accAfter = await ca.from('bank_account').select('current_balance').eq('id', accId).single();
  assert(Number(accAfter.data?.current_balance) === 700000, `Balance trigger: 1.000.000 IN - 300.000 OUT = ${accAfter.data?.current_balance} (esperado 700000)`);

  section('Edge Function — cashflow-invoices (crear factura)');
  const inv = await ca.functions.invoke('cashflow-invoices', { body: { tenant_id: tenantA, type: 'AR', total_amount: 1500000, currency: 'CLP', issue_date: '2026-06-01', due_date: '2026-07-01', contact_name: 'Cliente Test', source_system: 'MANUAL', external_id: null } });
  assert(!inv.error && inv.data?.data?.id, 'A crea factura A/R vía Edge Function');
  const invList = await ca.from('invoice').select('id');
  assert(invList.data?.length === 1, `A ve 1 factura (${invList.data?.length})`);

  section('Edge Function — cashflow-recurring (Run Rate + Burn Rate)');
  const recOut = await ca.functions.invoke('cashflow-recurring', { body: { tenant_id: tenantA, type: 'OUT', name: 'Nómina Test', amount: 4500000, currency: 'CLP', frequency: 'MONTHLY', next_date: '2026-06-30' } });
  assert(!recOut.error && recOut.data?.data?.id, 'A crea GASTO fijo (OUT) vía Edge Function');
  const recIn = await ca.functions.invoke('cashflow-recurring', { body: { tenant_id: tenantA, type: 'IN', name: 'Iguala Cliente X', amount: 1000000, currency: 'CLP', frequency: 'MONTHLY', next_date: '2026-07-01' } });
  assert(!recIn.error && recIn.data?.data?.type === 'IN', `A crea INGRESO fijo (IN) vía Edge Function (type=${recIn.data?.data?.type})`);

  section('Aislamiento RLS — B no ve nada de A');
  const bTx = await cb.from('transaction').select('id');
  const bAcc = await cb.from('bank_account').select('id');
  const bInv = await cb.from('invoice').select('id');
  const bRec = await cb.from('recurring_transaction').select('id');
  assert((bTx.data?.length ?? -1) === 0, `B no ve transacciones de A (${bTx.data?.length})`);
  assert((bAcc.data?.length ?? -1) === 0, `B no ve cuentas de A (${bAcc.data?.length})`);
  assert((bInv.data?.length ?? -1) === 0, `B no ve facturas de A (${bInv.data?.length})`);
  assert((bRec.data?.length ?? -1) === 0, `B no ve gastos recurrentes de A (${bRec.data?.length})`);

  section('Cuota PDF — RPC atómica');
  const q1 = await ca.rpc('check_and_increment_pdf_usage', { p_limit: 10 });
  const q2 = await ca.rpc('check_and_increment_pdf_usage', { p_limit: 10 });
  assert(q1.data?.allowed === true && q1.data?.used === 1, `1ra lectura: allowed, used=${q1.data?.used}`);
  assert(q2.data?.used === 2, `2da lectura: used=${q2.data?.used} (incrementa)`);
  const qBlock = await ca.rpc('check_and_increment_pdf_usage', { p_limit: 2 });
  assert(qBlock.data?.allowed === false, `Con límite 2 y used=2 → bloqueado (allowed=${qBlock.data?.allowed})`);

  section('Ingesta PDF con IA — factura válida (acepta)');
  const pathInv = `${idA}/${crypto.randomUUID()}.pdf`;
  await ca.storage.from('cashflow_docs').upload(pathInv, buildPdf(INVOICE_LINES), { contentType: 'application/pdf' });
  const okParse = await ca.functions.invoke('cashflow-parse-pdf', { body: { tenant_id: tenantA, file_path: pathInv, expected_type: 'AR_OR_AP' } });
  const okData = okParse.data?.data;
  assert(!okParse.error && okData?.is_valid_invoice === true && okData?.extracted_fields?.total_amount != null,
    `Factura aceptada (is_valid=${okData?.is_valid_invoice}, total=${okData?.extracted_fields?.total_amount}, tipo=${okData?.extracted_fields?.type})`);

  section('Escudo anti-basura — cotización (bloquea)');
  const pathQuo = `${idA}/${crypto.randomUUID()}.pdf`;
  await ca.storage.from('cashflow_docs').upload(pathQuo, buildPdf(QUOTE_LINES), { contentType: 'application/pdf' });
  const quoParse = await ca.functions.invoke('cashflow-parse-pdf', { body: { tenant_id: tenantA, file_path: pathQuo, expected_type: 'AR_OR_AP' } });
  const quoData = quoParse.data?.data;
  assert(!quoParse.error && quoData?.is_valid_invoice === false && typeof quoData?.rejection_reason === 'string' && quoData.rejection_reason.length > 0,
    `Cotización RECHAZADA (is_valid=${quoData?.is_valid_invoice}, motivo="${(quoData?.rejection_reason ?? '').slice(0, 60)}…")`);
}

async function cleanup() {
  section('Cleanup — borrar usuarios temporales (cascade)');
  for (const id of [idA, idB]) {
    if (!id) continue;
    const r = await admin.auth.admin.deleteUser(id);
    assert(!r.error, `Usuario ${id.slice(0, 8)} borrado (cascade limpia sus filas)`);
  }
}

console.log('\x1b[1mTest de integración — Cashflow producción\x1b[0m');
try {
  await run();
} catch (e) {
  bad(`Excepción: ${e.message}`);
} finally {
  await cleanup().catch((e) => bad(`Cleanup falló: ${e.message}`));
}

console.log('\n' + '─'.repeat(50));
if (failures === 0) {
  console.log('\x1b[32m\x1b[1m✅ SISTEMA OK — todas las aserciones en verde.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\x1b[31m\x1b[1m❌ ${failures} aserción(es) fallaron.\x1b[0m`);
  process.exit(1);
}
