// Validación de la salida del LLM (T3.1). Schemas LENIENTES por prompt_type:
// solo afirman los campos load-bearing (los que el frontend realmente consume)
// con su tipo; `.passthrough()` deja pasar el resto. Objetivo: detectar
// alucinaciones de estructura (tipo equivocado / campo crítico ausente), NO
// imponer cada campo.
//
// Modo OBSERVE-ONLY: el handler loguea + telemetría en fallo pero persiste igual
// (cero riesgo de romper al usuario por un falso positivo). Con los datos que
// junte, se puede endurecer (rechazar/reintentar) más adelante.
import { z } from 'npm:zod';
import type { PromptType } from './prompts.ts';

const num = z.number();
const str = z.string();

// Cada schema afirma lo mínimo que rompe el frontend si falta/está mal tipado.
const SCHEMAS: Partial<Record<PromptType, z.ZodTypeAny>> = {
  summary: z.object({
    score: num,
  }).passthrough(),

  playbook_analysis: z.object({
    funding_verdict: str,
    viability_score: num,
    validation_playbook: z.array(str),
  }).passthrough(),

  competitive_analysis: z.object({
    competitors: z.array(z.unknown()),
    market_gaps: z.array(z.unknown()),
  }).passthrough(),

  market_sizing: z.object({
    tam: z.object({}).passthrough(),
    sam: z.object({}).passthrough(),
    som: z.object({}).passthrough(),
  }).passthrough(),

  unit_economics: z.object({
    cac: z.object({ min: num, max: num }).passthrough(),
    ltv: z.object({ min: num, max: num }).passthrough(),
  }).passthrough(),

  founder_fit: z.object({
    score: num,
    dimensions: z.object({}).passthrough(),
  }).passthrough(),
};

export interface OutputValidation {
  /** true si no hay schema para el tipo (no validamos) o el parse pasó. */
  ok: boolean;
  /** Mensaje compacto del primer issue, para telemetría/log. Solo si !ok. */
  error?: string;
}

/** Valida `parsed` contra el schema del prompt_type (si existe). Nunca lanza. */
export function validateOutput(promptType: PromptType, parsed: unknown): OutputValidation {
  const schema = SCHEMAS[promptType];
  if (!schema) return { ok: true };
  const res = schema.safeParse(parsed);
  if (res.success) return { ok: true };
  const first = res.error.issues[0];
  const path = first?.path?.join('.') || '(root)';
  return { ok: false, error: `${path}: ${first?.message ?? 'invalid'}` };
}

/** Solo para tests: expone qué prompt_types tienen schema. */
export const SCHEMA_KEYS = Object.keys(SCHEMAS) as PromptType[];
