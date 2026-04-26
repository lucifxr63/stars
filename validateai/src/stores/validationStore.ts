import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { StepIdea, StepMarket, StepFounder, RiskAnalysis, UnitEconomics, FounderFit, MarketSignals } from '@/types/validation';

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
  setAIThinking: (val: boolean) => void;
  setValidationId: (id: string) => void;
  reset: () => void;
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
        setAIThinking: (val) => set({ aiThinking: val }),
        setValidationId: (id) => set({ validationId: id }),
        reset: () => set(initialState),
      }),
      { name: 'validateai-session' }
    )
  )
);
