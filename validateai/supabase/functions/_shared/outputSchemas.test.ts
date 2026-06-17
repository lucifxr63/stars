// Tests de los schemas lenientes de salida del LLM (T3.1).
import { assert } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { validateOutput } from './outputSchemas.ts';

Deno.test('summary: score numérico pasa; string falla', () => {
  assert(validateOutput('summary', { score: 80, feedback: 'ok' }).ok);
  assert(!validateOutput('summary', { score: 'alto' }).ok);
  assert(!validateOutput('summary', {}).ok); // falta score
});

Deno.test('playbook_analysis: shape válido pasa; falta viability_score falla', () => {
  const valid = { funding_verdict: 'GO', viability_score: 65, validation_playbook: ['paso'] };
  assert(validateOutput('playbook_analysis', valid).ok);
  assert(!validateOutput('playbook_analysis', { funding_verdict: 'GO', validation_playbook: [] }).ok);
  assert(!validateOutput('playbook_analysis', { ...valid, viability_score: 'alto' }).ok);
});

Deno.test('competitive_analysis: arrays requeridos', () => {
  assert(validateOutput('competitive_analysis', { competitors: [], market_gaps: [] }).ok);
  assert(!validateOutput('competitive_analysis', { competitors: 'x', market_gaps: [] }).ok);
});

Deno.test('unit_economics: cac/ltv con min/max numéricos', () => {
  assert(validateOutput('unit_economics', { cac: { min: 1, max: 2 }, ltv: { min: 3, max: 4 } }).ok);
  assert(!validateOutput('unit_economics', { cac: { min: '1', max: 2 }, ltv: { min: 3, max: 4 } }).ok);
});

Deno.test('founder_fit / market_sizing: shape mínimo', () => {
  assert(validateOutput('founder_fit', { score: 70, dimensions: {} }).ok);
  assert(!validateOutput('founder_fit', { score: 70 }).ok); // falta dimensions
  assert(validateOutput('market_sizing', { tam: {}, sam: {}, som: {} }).ok);
});

Deno.test('prompt_type sin schema → ok (no validamos)', () => {
  assert(validateOutput('questions', { cualquier: 'cosa' }).ok);
  assert(validateOutput('value_prop', null).ok);
});

Deno.test('el campo error reporta el path del problema', () => {
  const r = validateOutput('summary', { score: 'x' });
  assert(!r.ok && typeof r.error === 'string' && r.error.includes('score'));
});
