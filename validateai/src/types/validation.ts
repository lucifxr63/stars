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
});

export const StepMarketSchema = z.object({
  customer_segment: z.string().min(5, 'Describe tu público objetivo detalladamente').max(500),
  target_country: z.string().min(1, 'Selecciona un país'),
  target_region: z.string().optional(),
  business_model: z.enum(BUSINESS_MODELS),
  pricing_range: z.string().min(1, 'Selecciona un rango de precio'),
});

export const StepFounderSchema = z.object({
  yearsInIndustry: z.number().min(0).max(50),
  hasTechnicalCofounder: z.boolean(),
  personallyFacedProblem: z.boolean(),
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
  hasBuiltBefore: boolean;
  hasTechnicalCofounder: boolean;
  personallyFacedProblem: boolean;
  networkInTargetMarket: 'none' | 'some' | 'strong';
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

// ─────────────────────────────────────────────────────────────────────────────

export type StepIdea = z.infer<typeof StepIdeaSchema>;
export type StepMarket = z.infer<typeof StepMarketSchema>;
export type StepFounder = z.infer<typeof StepFounderSchema>;
export type Validation = z.infer<typeof ValidationSchema>;
