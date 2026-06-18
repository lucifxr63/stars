// Contrato de persistencia (T3.3): prompt_type → columnas de validations.
// Un bug acá (columna equivocada / nombre que no matchea) corrompe datos en silencio.
import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { buildPersistUpdates } from './persist.ts';

Deno.test('summary mapea a las 4 columnas derivadas con type guards', () => {
  const parsed = { score: 80, feedback: 'ok', score_breakdown: { problem: 1 }, extra: 'x' };
  const u = buildPersistUpdates('summary', parsed);
  assertEquals(u.summary_json, parsed);
  assertEquals(u.validation_score, 80);
  assertEquals(u.ai_feedback, 'ok');
  assertEquals(u.score_breakdown, { problem: 1 });
});

Deno.test('summary: score no-numérico / feedback no-string → null', () => {
  const u = buildPersistUpdates('summary', { score: 'alto', feedback: 123 });
  assertEquals(u.validation_score, null);
  assertEquals(u.ai_feedback, null);
  assertEquals(u.score_breakdown, null); // ausente → null
});

Deno.test('pitch_deck va a pitch_deck_content (nombre distinto, no pitch_deck)', () => {
  const parsed = { slides: [] };
  const u = buildPersistUpdates('pitch_deck', parsed);
  assertEquals(u.pitch_deck_content, parsed);
  assertEquals(u.pitch_deck, undefined);
});

Deno.test('mapeos 1:1 persisten parsed en su columna homónima', () => {
  const p = { x: 1 };
  for (const t of [
    'competitive_analysis', 'market_sizing', 'risk_analysis', 'unit_economics',
    'founder_fit', 'market_signals', 'governance_assessment', 'fundraising_roadmap',
    'playbook_analysis', 'lean_roadmap', 'financial_projection', 'compliance_roadmap',
  ] as const) {
    const u = buildPersistUpdates(t, p);
    assertEquals(u[t], p, `${t} debe persistir en la columna ${t}`);
    assertEquals(Object.keys(u).length, 1, `${t} debe escribir 1 sola columna`);
  }
});

Deno.test('prompt_type sin persistencia (questions, value_prop…) → objeto vacío', () => {
  assertEquals(buildPersistUpdates('questions', { a: 1 }), {});
  assertEquals(buildPersistUpdates('value_prop', { a: 1 }), {});
  assertEquals(buildPersistUpdates('mvp_generation', { a: 1 }), {});
});
