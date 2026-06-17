// Tipos compartidos entre módulos de ai-validate.
// Contratos neutrales: StructuredIdea (pre-pass ↔ RAG), AIResult (capa AI),
// AIRequest (body del handler).
import type { PromptType } from './prompts.ts';

export interface AIRequest {
  validation_id: string;
  step: number;
  prompt_type: PromptType;
  context: Record<string, unknown>;
}

export interface StructuredIdea {
  problem: string;
  solution: string;
  targetAudience: string;
  market: string;
  revenueModel: string;
  stage: string;
  geography: string;
}

export interface AIResult {
  parsed: Record<string, unknown>;
  inputTokens: number;
  outputTokens: number;
  model: string;
}
