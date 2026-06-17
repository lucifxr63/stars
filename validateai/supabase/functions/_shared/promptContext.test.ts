// Invariantes de los builders de contexto extraídos (#5 W1).
import { assert, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildUserContent, extractJSON } from './promptContext.ts';

Deno.test('extractJSON quita fences de markdown ```json', () => {
  const raw = '```json\n{"a":1}\n```';
  assert(extractJSON(raw).includes('{"a":1}'));
});

Deno.test('extractJSON deja JSON plano intacto', () => {
  assert(extractJSON('{"b":2}').includes('{"b":2}'));
});

Deno.test('buildUserContent devuelve string no vacío con el contexto', () => {
  const out = buildUserContent('summary', { idea_name: 'HidroCraft', idea_description: 'cerveza' });
  assert(typeof out === 'string' && out.length > 0);
  assertStringIncludes(out, 'HidroCraft');
});
