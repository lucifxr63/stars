// Invariantes de la capa RAG extraída (#5 W2). Cubre la lógica pura
// (extractVaultEntities + RAG_TAGS_BY_PROMPT); las funciones con red/DB se
// validan byte-identical (golden hash) + smoke del endpoint desplegado.
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { extractVaultEntities, RAG_TAGS_BY_PROMPT } from './rag.ts';

Deno.test('extractVaultEntities matchea entidades fintech', () => {
  const out = extractVaultEntities('una idea fintech con wallet de pagos digitales');
  assert(out.some((e) => e.includes('Fintech')), `esperaba entidad Fintech, got ${JSON.stringify(out)}`);
});

Deno.test('extractVaultEntities matchea financiamiento estatal (corfo/sii)', () => {
  const out = extractVaultEntities('postular a CORFO y revisar el SII');
  assert(out.some((e) => e.includes('Financiamiento')), `got ${JSON.stringify(out)}`);
});

Deno.test('extractVaultEntities sin match devuelve array vacío', () => {
  assertEquals(extractVaultEntities('zzz texto sin ninguna palabra clave'), []);
});

Deno.test('RAG_TAGS_BY_PROMPT mapea prompts a tags no vacíos', () => {
  for (const [pt, tags] of Object.entries(RAG_TAGS_BY_PROMPT)) {
    assert(Array.isArray(tags) && tags.length > 0, `tags vacíos para ${pt}`);
  }
});
