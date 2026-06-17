// Tipos compartidos entre módulos de ai-validate (#5 W2).
// StructuredIdea es el contrato entre el pre-pass (preprocessIdea, capa AI) y la
// recuperación RAG (retrieveRelevantCompetitors) — por eso vive en un módulo neutral.

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
