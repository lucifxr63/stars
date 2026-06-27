// Smoke Test de producción — Cashflow Go-Live (CASHFLOW_PRD_PART_5)
// Valida la cadena crítica de infraestructura SIN navegador ni usuario autenticado.
// Sale con exit(1) si CUALQUIER aserción falla → bloquea el envío del correo Beta.
//
// Uso:  node launch/smoke-test.mjs
// Opcional: APP_URL, SUPABASE_URL por entorno para apuntar a otro destino.

const APP_URL = (process.env.APP_URL ?? 'https://cashflow.scouttech.lat').replace(/\/$/, '');
const SUPABASE_URL = (process.env.SUPABASE_URL ?? 'https://fcdhcntyvsydnvjwopfe.supabase.co').replace(/\/$/, '');
const ORIGIN = APP_URL;
const FUNCTIONS = ['cashflow-invoices', 'cashflow-recurring', 'cashflow-parse-pdf'];
const TIMEOUT_MS = 10_000;

let failures = 0;
const pass = (msg) => console.log(`  \x1b[32m✅ PASS\x1b[0m ${msg}`);
const fail = (msg) => { console.log(`  \x1b[31m❌ FAIL\x1b[0m ${msg}`); failures++; };
const phase = (n, t) => console.log(`\n\x1b[1m── Fase ${n}: ${t} ──\x1b[0m`);

async function req(url, opts = {}) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// ── Fase 1: Disponibilidad SPA (rewrite de Vercel) ──────────
async function phase1() {
  phase(1, 'Disponibilidad SPA');
  const url = `${APP_URL}/auth/callback`;
  try {
    const res = await req(url);
    const body = await res.text();
    if (res.status !== 200) fail(`GET ${url} → HTTP ${res.status} (esperado 200; ¿rewrite SPA o dominio?)`);
    else pass(`GET ${url} → 200`);
    if (/<div id="root"/.test(body)) pass('El HTML contiene <div id="root"> (rewrite SPA OK)');
    else fail('El HTML NO contiene <div id="root"> (Vercel no está sirviendo index.html)');
  } catch (e) {
    fail(`GET ${url} no respondió: ${e.cause?.code ?? e.name} (¿DNS sin propagar o sin deploy?)`);
  }
}

// ── Fase 2: CORS & Preflight de las Edge Functions ──────────
async function phase2() {
  phase(2, 'CORS & Preflight');
  for (const fn of FUNCTIONS) {
    const url = `${SUPABASE_URL}/functions/v1/${fn}`;
    try {
      const res = await req(url, {
        method: 'OPTIONS',
        headers: { Origin: ORIGIN, 'Access-Control-Request-Method': 'POST' },
      });
      const allow = res.headers.get('access-control-allow-origin');
      if (res.status !== 200 && res.status !== 204) fail(`OPTIONS ${fn} → HTTP ${res.status} (esperado 200/204)`);
      else if (allow !== ORIGIN) fail(`OPTIONS ${fn} → Allow-Origin "${allow}" (esperado "${ORIGIN}")`);
      else pass(`OPTIONS ${fn} → ${res.status}, Allow-Origin correcto`);
    } catch (e) {
      fail(`OPTIONS ${fn} no respondió: ${e.cause?.code ?? e.name}`);
    }
  }
}

// ── Fase 3: Barrera RLS / JWT (sin Authorization → 401) ─────
async function phase3() {
  phase(3, 'Barrera RLS / JWT');
  for (const fn of ['cashflow-invoices', 'cashflow-parse-pdf']) {
    const url = `${SUPABASE_URL}/functions/v1/${fn}`;
    try {
      const res = await req(url, {
        method: 'POST',
        headers: { Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (res.status === 401) pass(`POST ${fn} sin JWT → 401 (protegido)`);
      else fail(`POST ${fn} sin JWT → HTTP ${res.status} (esperado 401: riesgo de cURL públicos gastando tokens)`);
    } catch (e) {
      fail(`POST ${fn} no respondió: ${e.cause?.code ?? e.name}`);
    }
  }
}

console.log(`\x1b[1mSmoke Test — Cashflow producción\x1b[0m`);
console.log(`APP_URL=${APP_URL}`);
console.log(`SUPABASE_URL=${SUPABASE_URL}`);

await phase1();
await phase2();
await phase3();

console.log('\n' + '─'.repeat(48));
if (failures === 0) {
  console.log('\x1b[32m\x1b[1m✅ GO-LIVE AUTORIZADO — todas las aserciones en verde.\x1b[0m');
  process.exit(0);
} else {
  console.log(`\x1b[31m\x1b[1m❌ BLOQUEADO — ${failures} aserción(es) fallaron. NO enviar el correo.\x1b[0m`);
  process.exit(1);
}
