import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  StepIdea, StepMarket, StepFounder,
  RiskAnalysis, UnitEconomics, FounderFit, MarketSignals,
  ExtractedProjectData, PendingQuestion, DueDiligenceScore, UploadStatus,
} from '@/types/validation';

interface ValidationState {
  validationId: string | null;
  currentStep: number;
  isLoading: boolean;
  aiThinking: boolean;

  stepIdea: Partial<StepIdea>;
  stepMarket: Partial<StepMarket>;
  stepFounder: Partial<StepFounder>;

  summary: unknown | null;
  validationScore: number | null;
  aiFeedback: string | null;
  riskAnalysis: RiskAnalysis | null;
  unitEconomics: UnitEconomics | null;
  founderFit: FounderFit | null;
  marketSignals: MarketSignals | null;
  fromCache: boolean;
  validationMode: 'quick' | 'detailed' | 'premium';

  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateStepIdea: (data: Partial<StepIdea>) => void;
  updateStepMarket: (data: Partial<StepMarket>) => void;
  updateStepFounder: (data: Partial<StepFounder>) => void;
  
  setSummary: (summary: unknown, score: number, feedback: string) => void;
  setRiskAnalysis: (data: RiskAnalysis) => void;
  setUnitEconomics: (data: UnitEconomics) => void;
  setFounderFit: (data: FounderFit) => void;
  setMarketSignals: (data: MarketSignals) => void;
  setFromCache: (val: boolean) => void;
  agentLogId: string | null;
  premiumResult: {
    executive_summary: string | null;
    reddit_status: 'pending' | 'success' | 'error';
    trends_status: 'pending' | 'success' | 'error';
    agents: { reddit: unknown; trends: unknown };
    errors: Record<string, string> | null;
  } | null;

  setValidationMode: (mode: 'quick' | 'detailed' | 'premium') => void;
  setAIThinking: (val: boolean) => void;
  setValidationId: (id: string) => void;
  setAgentLogId: (id: string) => void;
  setPremiumResult: (result: ValidationState['premiumResult']) => void;
  reset: () => void;

  // ── Due Diligence ──────────────────────────────────────────────────────────
  extractedData: ExtractedProjectData | null;
  pendingQuestions: PendingQuestion[];
  dueDiligenceScore: DueDiligenceScore | null;
  uploadStatus: UploadStatus;
  activeTaskCard: string | null;

  setExtractedData: (data: ExtractedProjectData) => void;
  setPendingQuestions: (questions: PendingQuestion[]) => void;
  setDueDiligenceScore: (score: DueDiligenceScore) => void;
  setUploadStatus: (status: UploadStatus) => void;
  setActiveTaskCard: (card: string | null) => void;
}

const initialState = {
  validationId: null,
  currentStep: 1,
  isLoading: false,
  aiThinking: false,
  stepIdea: {},
  stepMarket: {},
  stepFounder: {},
  summary: null,
  validationScore: null,
  aiFeedback: null,
  riskAnalysis: null,
  unitEconomics: null,
  founderFit: null,
  marketSignals: null,
  fromCache: false,
  validationMode: 'detailed' as const,
  agentLogId: null,
  premiumResult: null,
  extractedData: null,
  pendingQuestions: [],
  dueDiligenceScore: null,
  uploadStatus: 'idle' as UploadStatus,
  activeTaskCard: null,
};

export const useValidationStore = create<ValidationState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,
        setStep: (step) => set({ currentStep: step }),
        nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 4) })),
        prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) })),
        updateStepIdea: (data) => set((s) => ({ stepIdea: { ...s.stepIdea, ...data } })),
        updateStepMarket: (data) => set((s) => ({ stepMarket: { ...s.stepMarket, ...data } })),
        updateStepFounder: (data) => set((s) => ({ stepFounder: { ...s.stepFounder, ...data } })),
        setSummary: (summary, score, feedback) => set({ summary, validationScore: score, aiFeedback: feedback }),
        setRiskAnalysis: (data) => set({ riskAnalysis: data }),
        setUnitEconomics: (data) => set({ unitEconomics: data }),
        setFounderFit: (data) => set({ founderFit: data }),
        setMarketSignals: (data) => set({ marketSignals: data }),
        setFromCache: (val) => set({ fromCache: val }),
        setValidationMode: (mode) => set({ validationMode: mode }),
        setAIThinking: (val) => set({ aiThinking: val }),
        setValidationId: (id) => set({ validationId: id }),
        setAgentLogId: (id) => set({ agentLogId: id }),
        setPremiumResult: (result) => set({ premiumResult: result }),
        reset: () => set(initialState),
        setExtractedData: (data) => set({ extractedData: data }),
        setPendingQuestions: (questions) => set({ pendingQuestions: questions }),
        setDueDiligenceScore: (score) => set({ dueDiligenceScore: score }),
        setUploadStatus: (status) => set({ uploadStatus: status }),
        setActiveTaskCard: (card) => set({ activeTaskCard: card }),
      }),
      { name: 'validateai-session' }
    )
  )
);
