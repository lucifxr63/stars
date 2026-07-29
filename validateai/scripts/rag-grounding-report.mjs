/**
 * rag-grounding-report.mjs — ¿cuántos análisis competitivos corren SIN corpus?
 *
 * POR QUÉ EXISTE
 * --------------
 * `competitive_analysis` dice apoyarse en RAG sobre la tabla `competitors`.
 * Esa tabla está vacía en producción, así que `search_competitors` (umbral de
 * similitud 0.75) no devuelve nada y el prompt sale igual — sin un solo
 * competidor real delante. Degradaba en silencio: ni la respuesta ni el log
 * decían que el grounding no ocurrió.
 *
 * `ai-validate` ahora escribe `input_data._rag` en cada interacción. Este
 * script lo lee y responde tres preguntas antes de decidir de dónde sacar el
 * corpus:
 *
 *   1. ¿Qué fracción de los análisis corre sin grounding?
 *   2. ¿Por qué — no hay corpus, o la idea no se pudo estructurar?
 *   3. ¿De qué rubros son? (define qué corpus vale la pena construir)
 *
 * Sin este dato, armar un corpus es adivinar.
 *
 * USO
 *   node scripts/rag-grounding-report.mjs
 *   node scripts/rag-grounding-report.mjs --days 30
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(here, '..', '.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => /^\s*[A-Z_]+[A-Z_0-9]*=/.test(l))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_BASE = env.VITE_SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !KEY) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.local');
  process.exit(1);
}

const dIdx = process.argv.indexOf('--days');
const DAYS = dIdx >= 0 ? Number(process.argv[dIdx + 1]) || 30 : 30;
const desde = new Date(Date.now() - DAYS * 86400_000).toISOString();

const res = await fetch(
  `${URL_BASE}/rest/v1/ai_interactions` +
    `?prompt_type=eq.competitive_analysis` +
    `&created_at=gte.${desde}` +
    `&select=created_at,input_data,model` +
    `&order=created_at.desc&limit=2000`,
  { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
);
if (!res.ok) {
  console.error(`Supabase respondió HTTP ${res.status}: ${await res.text()}`);
  process.exit(1);
}
const filas = await res.json();

console.log(`\nANÁLISIS COMPETITIVOS — últimos ${DAYS} días`);
console.log('─'.repeat(66));

if (filas.length === 0) {
  console.log('Sin interacciones de competitive_analysis en el período.');
  console.log('\nOjo: la instrumentación es nueva. Las interacciones anteriores');
  console.log('no traen `_rag` y no se pueden clasificar retroactivamente.');
  process.exit(0);
}

let conRag = 0, sinRag = 0, sinInstrumentar = 0;
const razones = new Map();
const rubrosSinGrounding = new Map();
const fuentes = new Map();
let competidoresTotal = 0;

for (const f of filas) {
  const rag = f.input_data?._rag;
  if (!rag) { sinInstrumentar++; continue; }
  if (rag.grounded) {
    conRag++;
    competidoresTotal += rag.competitors ?? 0;
    const src = rag.source ?? 'desconocida';
    fuentes.set(src, (fuentes.get(src) ?? 0) + 1);
  } else {
    sinRag++;
    const r = rag.reason ?? 'desconocida';
    razones.set(r, (razones.get(r) ?? 0) + 1);
    const rubro = f.input_data?.idea_industry ?? f.input_data?.industry ?? '(sin rubro)';
    rubrosSinGrounding.set(rubro, (rubrosSinGrounding.get(rubro) ?? 0) + 1);
  }
}

const clasificados = conRag + sinRag;
const pct = (n) => (clasificados > 0 ? ((n / clasificados) * 100).toFixed(1) : '0.0');

console.log(`  Interacciones totales      ${filas.length}`);
if (sinInstrumentar) {
  console.log(`  Sin instrumentar           ${sinInstrumentar}   (anteriores al cambio)`);
}
console.log(`  Clasificadas               ${clasificados}`);
console.log('');
console.log(`  CON grounding              ${conRag}  (${pct(conRag)}%)` +
  (conRag ? `   promedio ${(competidoresTotal / conRag).toFixed(1)} competidores` : ''));
console.log(`  SIN grounding              ${sinRag}  (${pct(sinRag)}%)`);

if (fuentes.size) {
  // corpus = pegó en `competitors` (gratis). serpapi = hubo que buscar en vivo.
  // Que la proporción de 'corpus' suba con el tiempo es la señal de que el
  // corpus se está construyendo solo a partir del uso real.
  console.log('\n  De dónde salieron los competidores:');
  for (const [s, n] of [...fuentes].sort((a, b) => b[1] - a[1])) {
    const etiqueta = s === 'corpus' ? 'corpus (ya poblado)' : s === 'serpapi' ? 'SerpApi (búsqueda en vivo)' : s;
    console.log(`    ${etiqueta.padEnd(34)} ${n}`);
  }
}

if (razones.size) {
  console.log('\n  Por qué falla el grounding:');
  for (const [r, n] of [...razones].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${r.padEnd(34)} ${n}`);
  }
}

if (rubrosSinGrounding.size) {
  console.log('\n  Rubros que corren sin competidores (candidatos a corpus):');
  for (const [r, n] of [...rubrosSinGrounding].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    console.log(`    ${String(r).slice(0, 34).padEnd(34)} ${n}`);
  }
}

console.log('');
if (sinRag > 0 && conRag === 0) {
  console.log('  → NINGÚN análisis tuvo grounding. El "RAG competitivo" hoy es');
  console.log('    puro conocimiento del modelo. Decidir corpus o dejar de');
  console.log('    llamarlo RAG.');
} else if (sinRag > conRag) {
  console.log('  → La mayoría corre sin grounding. El corpus actual no cubre');
  console.log('    los rubros que la gente valida.');
}
console.log('');
