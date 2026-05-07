import { z } from 'zod';

export const IndustryEnum = z.enum([
  'fintech', 'edtech', 'healthtech', 'ecommerce', 'saas',
  'marketplace', 'social', 'logistics', 'foodtech', 'proptech', 'other'
]);

export const MVPTypeEnum = z.enum([
  'web_app', 'mobile_app', 'service', 'marketplace', 'saas', 'api'
]);

export const ValidationStatusEnum = z.enum([
  'in_progress', 'completed', 'archived'
]);

export const PRICING_RANGES = ['free', '1-10 USD', '10-50 USD', '50-100 USD', '100+ USD'] as const;
export const BUSINESS_STAGES = ['idea', 'pre-product', 'early', 'growth'] as const;
export const BUSINESS_MODELS = ['b2b', 'b2c', 'b2b2c', 'marketplace'] as const;
export const TARGET_COUNTRIES = [
  'Chile', 'México', 'Argentina', 'Colombia', 'Perú', 'Brasil',
  'Ecuador', 'Uruguay', 'Paraguay', 'Bolivia', 'Venezuela',
  'Costa Rica', 'Panamá', 'Guatemala', 'Rep. Dominicana',
  'España', 'Estados Unidos', 'Otro'
] as const;

export const StepIdeaSchema = z.object({
  idea_name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  idea_description: z.string().min(20, 'Describe tu problema y solución de manera detallada').max(2000),
  idea_industry: IndustryEnum,
  current_solution: z.string().max(300).optional(),
});

export const StepMarketSchema = z.object({
  customer_segment: z.string().min(5, 'Describe tu público objetivo detalladamente').max(500),
  target_country: z.string().min(1, 'Selecciona un país'),
  target_region: z.string().optional(),
  business_model: z.enum(BUSINESS_MODELS),
  pricing_range: z.string().min(1, 'Selecciona un rango de precio'),
  acquisition_channel: z.string().max(200).optional(),
});

export const TechLevelEnum = z.enum(['non_technical', 'some_code', 'developers']);

export const StepFounderSchema = z.object({
  yearsInIndustry: z.number().min(0).max(50),
  hasTechnicalCofounder: z.boolean(),
  personallyFacedProblem: z.boolean(),
  tech_level: TechLevelEnum.optional(),
});

export const ValidationSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  status: ValidationStatusEnum,
  current_step: z.number().min(1).max(4),
  ...StepIdeaSchema.shape,
  ...StepMarketSchema.shape,
  founderContext: StepFounderSchema.nullable().optional(),
  
  // Existing AI fields not strictly asked in the 3-step form but saved later
  business_stage: z.string().optional().nullable(),
  known_competitors: z.array(z.string()).optional().nullable(),
  questions_answers: z.any().nullable().optional(),
  customer_pain_points: z.any().nullable().optional(),
  value_proposition: z.string().nullable().optional(),
  differentiator: z.string().nullable().optional(),
  mvp_type: z.string().nullable().optional(),
  mvp_features: z.any().nullable().optional(),
  mvp_user_flow: z.string().nullable().optional(),

  summary_json: z.any().nullable(),
  ai_feedback: z.string().nullable(),
  validation_score: z.number().min(0).max(100).nullable(),
});

export interface ScoreBreakdown {
  problem: number;
  market: number;
  competition: number;
  solution: number;
  execution: number;
}

export interface MarketSizingTier {
  value_low: number;
  value_high: number;
  currency: string;
  description: string;
  source_notes: string;
  confidence: 'high' | 'medium' | 'low';
  assumptions?: string[];
}

export interface MarketSizing {
  tam: MarketSizingTier;
  sam: MarketSizingTier;
  som: MarketSizingTier;
  methodology: string;
  data_freshness: string;
}

export interface CompetitorEntry {
  name: string;
  url: string | null;
  description: string;
  target_market: string;
  strengths: string[];
  weaknesses: string[];
  pricing: string | null;
  source: 'user_provided' | 'ai_identified';
}

export interface MarketGap {
  gap: string;
  opportunity: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface CompetitiveAnalysis {
  competitors: CompetitorEntry[];
  market_gaps: MarketGap[];
  unmet_pains: string[];
  competitive_advantage_suggestion: string;
  data_sources: string[];
}

export interface MarketSignals {
  trendDirection: 'growing' | 'stable' | 'declining';
  trendDescription: string;
  recentFunding: { company: string; amount: string; date: string }[];
  timingAssessment: 'too_early' | 'optimal' | 'late' | 'uncertain';
  timingRationale: string;
  relevantNews: { title: string; impact: 'positive' | 'negative' | 'neutral' }[];
}

export interface UnitEconomics {
  cac: { min: number; max: number; currency: 'CLP' | 'USD' };
  ltv: { min: number; max: number; currency: 'CLP' | 'USD' };
  ltvCacRatio: { value: number; assessment: 'viable' | 'warning' | 'critical' };
  paybackMonths: { min: number; max: number };
  breakEvenUsers: number;
  monthlyChurnEstimate: number;
  assumptions: string[];
}

export interface FounderContext {
  yearsInIndustry: number;
  hasTechnicalCofounder: boolean;
  personallyFacedProblem: boolean;
  hasBuiltBefore?: boolean;
  networkInTargetMarket?: 'none' | 'some' | 'strong';
}

export interface FounderFit {
  score: number;
  dimensions: {
    problemKnowledge: number;
    industryExperience: number;
    technicalCapability: number;
    networkStrength: number;
    trackRecord: number;
  };
  assessment: string;
  gaps: string[];
  recommendations: string[];
}

export interface RiskDimension {
  score: number;
  label: string;
  description: string;
  keyFactors: string[];
}

export interface RiskAnalysis {
  overallRiskScore: number;
  dimensions: {
    market: RiskDimension;
    technical: RiskDimension;
    regulatory: RiskDimension;
    timing: RiskDimension;
  };
  mitigations: string[];
}

// ─── FASE 4 ───────────────────────────────────────────────────────────────────

export interface Mentor {
  id: string;
  name: string;
  bio: string | null;
  expertise: string[];
  linkedin_url: string | null;
  calendly_url: string | null;
  availability: 'available' | 'waitlist' | 'unavailable';
  session_price_clp: number | null;
  languages: string[];
  photo_url: string | null;
}

export interface MentorMatch extends Mentor {
  similarity: number; // 0-1
}

export interface PivotInfo {
  parent_id: string | null;
  version: number;
  pivot_reason: string | null;
}

export interface ValidationVersion {
  id: string;
  idea_name: string | null;
  validation_score: number | null;
  version: number;
  pivot_reason: string | null;
  parent_id: string | null;
  created_at: string;
  completed_at: string | null;
  status: string;
  depth: number;
}

// ─── SPRINT B: Inversión ─────────────────────────────────────────────────────

export interface GovernanceLegalItem {
  item: string;
  priority: 'critical' | 'important' | 'nice_to_have';
  description: string;
}

export interface GovernanceAssessment {
  recommended_structure: string;
  founding_team_split: string;
  vesting_recommendation: string;
  legal_checklist: GovernanceLegalItem[];
  regulatory_risk: 'low' | 'medium' | 'high';
  regulatory_notes: string;
  cap_table_warnings: string[];
}

export interface FundraisingFund {
  name: string;
  focus: string;
  stage: string;
  url: string | null;
}

export interface FundraisingRoadmap {
  recommended_instrument: 'SAFE' | 'convertible_note' | 'priced_round' | 'grant' | 'bootstrapping';
  instrument_rationale: string;
  suggested_ticket_size: { min: number; max: number; currency: 'USD' };
  pre_money_valuation_range: { min: number; max: number; currency: 'USD' };
  recommended_funds: FundraisingFund[];
  pitch_narrative: string;
  readiness_score: number;
  blockers: string[];
  next_milestones: string[];
}

export interface PlaybookAnalysis {
  harsh_truth: string;
  jtbd_analysis: string;
  validation_playbook: string[];
  unit_economics_check: string;
  tech_and_legal_stack: string;
  gtm_and_growth_plan: string;
  funding_verdict: string;
  product_ai_strategy: string;
  founder_bias_warning: string;
  viability_score: number;
}

// ─── DUE DILIGENCE ───────────────────────────────────────────────────────────

export type DDDimension = 'financiero' | 'legal' | 'mercado' | 'equipo' | 'traccion';

export type ExtractionConfidence = Record<string, number>; // 0–1 por campo

export interface ExtractedProjectData {
  projectName?: string;
  problem?: string;
  solution?: string;
  revenueModel?: string;
  // Unit economics
  ltv?: number;
  cac?: number;
  paybackPeriod?: number; // months
  mrr?: number;
  arr?: number;
  // Traction
  hasPaidCustomers?: boolean;
  customerCount?: number;
  // Team
  teamSize?: number;
  founderBackground?: string;
  // Legal Chile/LATAM
  legalCompliance?: {
    ley21719?: boolean; // Ley de Datos Personales Chile
    ley21521?: boolean; // Ley Fintech Chile
  };
  // Market
  tam?: string;
  targetMarket?: string;
  // Meta
  extractionConfidence: ExtractionConfidence;
  sourceFileName?: string;
  sourceMimeType?: 'application/pdf' | 'application/json';
}

export interface PendingQuestion {
  field: keyof Omit<ExtractedProjectData, 'extractionConfidence' | 'sourceFileName' | 'sourceMimeType'>;
  question: string;
  dimension: DDDimension;
  priority: 'critical' | 'important' | 'nice_to_have';
}

export interface DueDiligenceScoreDimension {
  score: number; // 0–100
  label: string;
  gaps: string[];
}

export interface DueDiligenceScore {
  total: number; // 0–100
  dimensions: {
    financiero: DueDiligenceScoreDimension;
    legal: DueDiligenceScoreDimension;
    mercado: DueDiligenceScoreDimension;
    equipo: DueDiligenceScoreDimension;
    traccion: DueDiligenceScoreDimension;
  };
  investorReadiness: 'not_ready' | 'early' | 'developing' | 'ready';
  topGaps: string[]; // máx 5, ordenados por impacto
}

export type UploadStatus = 'idle' | 'uploading' | 'parsing' | 'gap-analysis' | 'done' | 'error';

export const DD_TASK_CARDS: string[] = [
  'Extrayendo modelo de ingresos...',
  'Verificando unit economics (LTV, CAC, Payback)...',
  'Mapeando estructura del equipo fundador...',
  'Analizando tracción y evidencia de clientes...',
  'Revisando cumplimiento Ley 21.719 (Datos)...',
  'Revisando cumplimiento Ley 21.521 (Fintech)...',
  'Calculando gaps de due diligence...',
];

// ─────────────────────────────────────────────────────────────────────────────

// ─── LEAN ROADMAP ────────────────────────────────────────────────────────────

export interface LeanSprint {
  name: string;
  duration_weeks: number;
  stack: string;
  must_haves: string[];
  nice_to_haves: string[];
  goal: string;
}

export interface LeanRoadmap {
  architecture_approach: 'no_code' | 'low_code' | 'full_code';
  rationale: string;
  sprints: LeanSprint[];
  total_weeks: number;
  recommended_tools: string[];
  mvp_cost_usd: { min: number; max: number };
}

// ─── FINANCIAL PROJECTION ────────────────────────────────────────────────────

export interface MonthlyProjection {
  month: number;
  mrr_usd: number;
  users: number;
  cac_spend_usd: number;
}

export interface FinancialProjection {
  growth_strategy: 'plg' | 'sales_led' | 'hybrid';
  strategy_rationale: string;
  monthly_projection: MonthlyProjection[];
  break_even_month: number;
  year1_revenue_usd: number;
  key_assumptions: string[];
  model_verdict: 'strong' | 'moderate' | 'weak';
  model_verdict_reason: string;
}

// ─── COMPLIANCE ROADMAP ───────────────────────────────────────────────────────

export interface ComplianceLaw {
  law: string;
  description: string;
  risk_level: 'high' | 'medium' | 'low';
  action_required: string;
}

export interface ComplianceRoadmap {
  constitution: {
    recommended_entity: string;
    steps: string[];
    estimated_cost_clp: number;
    notes: string;
  };
  regulatory: {
    applicable_laws: ComplianceLaw[];
    checklist: { item: string; priority: 'critical' | 'important' | 'nice_to_have'; description: string }[];
  };
  shareholders: {
    vesting_recommendation: string;
    cliff_months: number;
    drag_along: boolean;
    tag_along: boolean;
    notes: string;
  };
  overall_risk_level: 'high' | 'medium' | 'low';
  risk_rationale: string;
}

// ─── PITCH DECK ──────────────────────────────────────────────────────────────

export interface PitchDeckContent {
  hook: string;
  problem_statement: string;
  solution_statement: string;
  market_size_narrative: string;
  business_model_narrative: string;
  unfair_advantage: string;
  traction_milestones: string[];
  the_ask: string;
}

export type StepIdea = z.infer<typeof StepIdeaSchema>;
export type StepMarket = z.infer<typeof StepMarketSchema>;
export type StepFounder = z.infer<typeof StepFounderSchema>;
export type Validation = z.infer<typeof ValidationSchema>;
