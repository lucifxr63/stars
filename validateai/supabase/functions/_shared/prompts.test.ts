// Test de invariantes del módulo de prompts extraído (#5, slice 2).
// Corre con: deno test supabase/functions/_shared/prompts.test.ts
import { assert, assertEquals, assertStringIncludes } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { SYSTEM_PROMPTS, PLAYBOOK_MASTER_PROMPT, type PromptType } from './prompts.ts';

// Todos los prompt types que el handler espera deben tener system prompt.
const EXPECTED_TYPES: PromptType[] = [
  'questions', 'customer_analysis', 'value_prop', 'mvp_generation', 'summary',
  'summary_quick', 'competitive_analysis', 'market_sizing', 'risk_analysis',
  'unit_economics', 'founder_fit', 'market_signals', 'validation_kit',
  'landing_generator', 'interview_script', 'tech_viability', 'first_100_customers',
  'revenue_models', 'risk_checklist', 'pitch_letter', 'governance_assessment',
  'fundraising_roadmap', 'playbook_analysis', 'pitch_deck', 'lean_roadmap',
  'financial_projection', 'compliance_roadmap',
];

Deno.test('SYSTEM_PROMPTS cubre todos los prompt types esperados', () => {
  for (const t of EXPECTED_TYPES) {
    assert(t in SYSTEM_PROMPTS, `falta system prompt para "${t}"`);
    assert(SYSTEM_PROMPTS[t].length > 0, `system prompt vacío para "${t}"`);
  }
});

Deno.test('SYSTEM_PROMPTS no tiene keys de más', () => {
  assertEquals(Object.keys(SYSTEM_PROMPTS).sort(), [...EXPECTED_TYPES].sort());
});

Deno.test('playbook_analysis usa el placeholder dinámico', () => {
  // El handler reemplaza este prompt por PLAYBOOK_MASTER_PROMPT(ragChunks) en runtime.
  assertEquals(SYSTEM_PROMPTS.playbook_analysis, '__PLAYBOOK_DYNAMIC__');
});

Deno.test('PLAYBOOK_MASTER_PROMPT interpola los RAG chunks', () => {
  const out = PLAYBOOK_MASTER_PROMPT('CHUNK_DE_PRUEBA_123');
  assertStringIncludes(out, 'CHUNK_DE_PRUEBA_123');
  assertStringIncludes(out, 'SYSTEM ROLE');
});
