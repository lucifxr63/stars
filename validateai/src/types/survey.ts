// Tipos del módulo de Encuestas de Customer Development
// Basado en arquitectura JSONB descrita en VALIDUS_CLIENTES.MD

export type FieldType = 'text' | 'textarea' | 'radio' | 'checkbox' | 'scale' | 'date' | 'select';

export interface FieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
}

export interface FieldConditional {
  showIf?: {
    fieldId: string;
    value: unknown;
  };
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  validation?: FieldValidation;
  conditional?: FieldConditional;
  // Puntuación de alineación con "The Mom Test" (0-1). Calculada por biasDetector.
  momTestScore?: number;
  // Sugerencia de reformulación si la pregunta tiene sesgo
  reformulationSuggestion?: string;
}

export interface FormSchema {
  version: string;
  fields: FormField[];
}

export interface UiSchema {
  order: string[];
  layout: 'single-page' | 'multi-page';
  pages?: Array<{ title: string; fieldIds: string[] }>;
}

export interface SurveyForm {
  id: string;
  client_id: string;
  title: string;
  description?: string;
  schema_json: FormSchema;
  ui_schema: UiSchema;
  is_published: boolean;
  unique_slug?: string;
  consent_text: string;
  created_at: string;
  updated_at: string;
}

export type AnonymizationStatus = 'raw' | 'pseudonymized' | 'anonymized';

export type Severity = 'tolerable' | 'critico' | 'paralizante';

export interface MomTestSignals {
  talks_about_past: boolean;
  mentions_money_spent: boolean;
  reveals_workarounds: boolean;
}

export interface AnalysisResult {
  central_problem: string;
  severity: Severity;
  current_solutions: string[];
  willingness_to_pay: boolean;
  friction_score: number;
  key_quotes: string[];
  mom_test_signals: MomTestSignals;
}

export interface SurveySubmission {
  id: string;
  form_id: string;
  response_data: Record<string, unknown>;
  metadata: {
    user_agent?: string;
    completed_at?: string;
    referrer?: string;
  };
  anonymization_status: AnonymizationStatus;
  analysis_result?: AnalysisResult;
  consent_given: boolean;
  consent_timestamp?: string;
  created_at: string;
}

// ── Agregados del dashboard de resultados ─────────────────
export interface SurveyAggregates {
  total_submissions: number;
  analyzed_count: number;
  severity_distribution: Record<Severity, number>;
  avg_friction_score: number;
  willingness_to_pay_pct: number;
  top_current_solutions: Array<{ solution: string; count: number }>;
  mom_test_scores: {
    talks_about_past_pct: number;
    mentions_money_spent_pct: number;
    reveals_workarounds_pct: number;
  };
}

// ── Tipos para el Form Builder UI ─────────────────────────
export interface BiasDetectionResult {
  hasBias: boolean;
  score: number; // 0 (sin sesgo) → 1 (máximo sesgo)
  patterns: string[];
  suggestion?: string;
}
