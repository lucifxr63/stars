// Mapeo prompt_type → columnas de validations (T3.3). Extraído del handler.
// Función PURA (sin supabase): el contrato de persistencia es testeable y un
// bug acá (columna equivocada) = corrupción silenciosa de datos.
import type { PromptType } from './prompts.ts';

export function buildPersistUpdates(
  prompt_type: PromptType,
  parsed: Record<string, unknown>,
): Record<string, unknown> {
  const persistUpdates: Record<string, unknown> = {};

      if (prompt_type === 'summary') {
        const scoreVal = typeof parsed.score === 'number' ? parsed.score : null;
        persistUpdates.summary_json     = parsed;
        persistUpdates.validation_score = scoreVal;
        persistUpdates.ai_feedback      = typeof parsed.feedback === 'string' ? parsed.feedback : null;
        persistUpdates.score_breakdown  = parsed.score_breakdown ?? null;
      } else if (prompt_type === 'competitive_analysis') {
        persistUpdates.competitive_analysis = parsed;
      } else if (prompt_type === 'market_sizing') {
        persistUpdates.market_sizing = parsed;
      } else if (prompt_type === 'risk_analysis') {
        persistUpdates.risk_analysis = parsed;
      } else if (prompt_type === 'unit_economics') {
        persistUpdates.unit_economics = parsed;
      } else if (prompt_type === 'founder_fit') {
        persistUpdates.founder_fit = parsed;
      } else if (prompt_type === 'market_signals') {
        persistUpdates.market_signals = parsed;
      } else if (prompt_type === 'governance_assessment') {
        persistUpdates.governance_assessment = parsed;
      } else if (prompt_type === 'fundraising_roadmap') {
        persistUpdates.fundraising_roadmap = parsed;
      } else if (prompt_type === 'playbook_analysis') {
        persistUpdates.playbook_analysis = parsed;
      } else if (prompt_type === 'pitch_deck') {
        persistUpdates.pitch_deck_content = parsed;
      } else if (prompt_type === 'lean_roadmap') {
        persistUpdates.lean_roadmap = parsed;
      } else if (prompt_type === 'financial_projection') {
        persistUpdates.financial_projection = parsed;
      } else if (prompt_type === 'compliance_roadmap') {
        persistUpdates.compliance_roadmap = parsed;
      }

  return persistUpdates;
}
