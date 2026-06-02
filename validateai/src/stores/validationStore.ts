import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  StepIdea, StepMarket, StepFounder, StepIdeaQuick,
  RiskAnalysis, UnitEconomics, FounderFit, MarketSignals,
  ExtractedProjectData, PendingQuestion, DueDiligenceScore, UploadStatus,
  FounderProfileData,
} from '@/types/validation';
import { BUSINESS_MODELS } from '@/types/validation';

// Incrementar este número cada vez que el schema de validationState cambie de forma
// incompatible hacia atrás. El middleware de persist forzará un reset si detecta
// una versión más antigua en localStorage, evitando crasheos de Zod mid-flow.
const STORE_VERSION = 2;

interface ValidationState {
  validationId: string | null;
  currentStep: number;
  isLoading: boolean;
  aiThinking: boolean;

  stepIdea: Partial<StepIdea>;
  stepMarket: Partial<StepMarket>;
  stepFounder: Partial<StepFounder>;
  stepIdeaQuick: Partial<StepIdeaQuick>;

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
  updateStepIdeaQuick: (data: Partial<StepIdeaQuick>) => void;
  // Sprint P-A: puente entre ExtractedProjectData y el store del wizard.
  // Pre-llena stepIdea, stepMarket y stepFounder para el flujo Human-in-the-Loop.
  applyExtractedData: (data: ExtractedProjectData) => void;
  
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

  // ── Founder Profile (Sprint 1.5) ───────────────────────────────────────────
  founderProfile: FounderProfileData | null;
  setFounderProfile: (data: FounderProfileData) => void;
  updateFounderField: <K extends keyof FounderProfileData>(field: K, value: FounderProfileData[K]) => void;
}

const initialState = {
  validationId: null,
  currentStep: 1,
  isLoading: false,
  aiThinking: false,
  stepIdea: {},
  stepMarket: {},
  stepFounder: {},
  stepIdeaQuick: {},
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
  founderProfile: null,
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
        updateStepIdeaQuick: (data) => set((s) => ({ stepIdeaQuick: { ...s.stepIdeaQuick, ...data } })),
        applyExtractedData: (extracted) => set((s) => {
          // ── StepIdea pre-filling ─────────────────────────────────────────────
          const ideaUpdates: Partial<StepIdea> = {};
          if (extracted.projectName) ideaUpdates.idea_name = extracted.projectName;
          // problem → idea_problem (el dolor del cliente, separado de la solución)
          if (extracted.problem) ideaUpdates.idea_problem = extracted.problem;
          // solution → idea_description (la descripción de la solución)
          if (extracted.solution) ideaUpdates.idea_description = extracted.solution;
          // idea_industry: no se puede inferir de forma confiable de un PDF → el usuario selecciona

          // ── StepMarket pre-filling ───────────────────────────────────────────
          const marketUpdates: Partial<StepMarket> = {};
          if (extracted.targetMarket) marketUpdates.customer_segment = extracted.targetMarket;
          if (extracted.target_country) marketUpdates.target_country = extracted.target_country;
          if (extracted.target_region) marketUpdates.target_region = extracted.target_region;
          // Inferir business_model desde revenueModel (heurística de texto)
          if (extracted.revenueModel) {
            const rm = extracted.revenueModel.toLowerCase();
            const inferred = BUSINESS_MODELS.find((m) =>
              rm.includes(m) || (m === 'b2b' && rm.includes('empresa')) || (m === 'b2c' && rm.includes('consumer'))
            );
            if (inferred) marketUpdates.business_model = inferred as StepMarket['business_model'];
          }

          // ── StepFounder pre-filling ──────────────────────────────────────────
          const founderUpdates: Partial<StepFounder> = {};
          if (extracted.team_composition) founderUpdates.team_composition = extracted.team_composition;
          if (extracted.traction_status) founderUpdates.traction_status = extracted.traction_status;
          // personallyFacedProblem: no inferible de PDF de forma fiable
          // yearsInIndustry: no inferible de forma fiable

          return {
            stepIdea:    { ...s.stepIdea, ...ideaUpdates },
            stepMarket:  { ...s.stepMarket, ...marketUpdates },
            stepFounder: { ...s.stepFounder, ...founderUpdates },
          };
        }),
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
        setFounderProfile: (data) => set({ founderProfile: data }),
        updateFounderField: (field, value) =>
          set((s) => ({
            founderProfile: s.founderProfile
              ? { ...s.founderProfile, [field]: value }
              : { [field]: value } as FounderProfileData,
          })),
      }),
      {
        name: 'validateai-session',
        version: STORE_VERSION,
        migrate: (_persistedState: unknown, version: number) => {
          if (version < STORE_VERSION) {
            // Schema incompatible: wizard v2 añadió campos requeridos.
            // Reset forzoso aprobado por Mesa Directiva (01-Jun-2026).
            return { ...initialState };
          }
          return _persistedState as typeof initialState;
        },
      }
    )
  )
);

// ── Sincronización cross-tab via BroadcastChannel ─────────────────────────────
// Propaga cambios de store a otras pestañas abiertas del mismo origen.
// tabId único por pestaña evita que el origen del mensaje re-aplique su propio estado.
// isApplyingRemoteState previene el loop: tab A → tab B → tab A → ...
if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
  const tabId   = crypto.randomUUID();
  const channel = new BroadcastChannel('validateai_store');
  let   isApplyingRemoteState = false;

  channel.onmessage = (event: MessageEvent<{ sender: string; state: unknown }>) => {
    if (event.data.sender === tabId) return;
    isApplyingRemoteState = true;
    useValidationStore.setState(event.data.state as ReturnType<typeof useValidationStore.getState>);
    isApplyingRemoteState = false;
  };

  useValidationStore.subscribe((state) => {
    if (isApplyingRemoteState) return;
    channel.postMessage({ sender: tabId, state });
  });
}
