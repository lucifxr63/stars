import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { MarketFunnel } from '@/components/shared/MarketFunnel';
import { CompetitiveAnalysis } from '@/components/shared/CompetitiveAnalysis';
import { ScoreBreakdown } from '@/components/shared/ScoreBreakdown';
import { RiskAnalysisCard } from '@/components/shared/RiskAnalysisCard';
import { UnitEconomicsKpis, UnitEconomicsChart } from '@/components/shared/UnitEconomicsCard';
import { FounderFitCard } from '@/components/shared/FounderFitCard';
import { FounderProfileTab } from '@/components/shared/FounderProfileTab';
import { MarketSignalsCard } from '@/components/shared/MarketSignalsCard';
import { VerdictProsCons, VerdictFounderFit, VerdictMarketTiming } from '@/components/shared/VerdictWidgets';
import { LockedSection } from '@/components/shared/LockedSection';
import { PivotModal } from '@/components/shared/PivotModal';
import { MentorRecommendations } from '@/components/shared/MentorRecommendations';
import { CorfoFunds } from '@/components/shared/CorfoFunds';
import { DeliverableTabs } from '@/components/shared/DeliverableTabs';
import { RegulatoryRoadmap } from '@/components/shared/RegulatoryRoadmap';
import { generateValidationPDF, generatePitchDeckPDF, PDF_THEMES } from '@/lib/pdf';
import type { PDFTheme } from '@/lib/pdf';
import { ReanalyzeModal } from '@/components/shared/ReanalyzeModal';
import { PDFExportModal } from '@/components/shared/PDFExportModal';
import { SwotMatrix } from '@/components/shared/SwotMatrix';
import { NextStepsTimeline } from '@/components/shared/NextStepsTimeline';
import { KanbanMVP } from '@/components/shared/KanbanMVP';
import { useAI } from '@/hooks/useAI';
import { useValidationStore } from '@/stores/validationStore';
import { useUserTier, getUserSections } from '@/hooks/useUserTier';
import { trackDeliverableDownloaded, trackTabView, trackValidationCompleted, trackDueDiligenceCompleted, trackEncuestasCTAClicked } from '@/hooks/useAnalytics';
import { trackTelemetryEvent } from '@/lib/telemetry';
import { useMentors } from '@/hooks/useMentors';
import { EvidenceWall } from '@/components/shared/EvidenceWall';
import { GovernanceCard } from '@/components/shared/GovernanceCard';
import { FundraisingRoadmapCard } from '@/components/shared/FundraisingRoadmapCard';
import { TractionTracker } from '@/components/shared/TractionTracker';
import { PlaybookAnalysisCard } from '@/components/shared/PlaybookAnalysisCard';
import { DueDiligenceScoreCard } from '@/components/shared/DueDiligenceScoreCard';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import type {
  MarketSizing,
  CompetitiveAnalysis as CompetitiveAnalysisType,
  ScoreBreakdown as ScoreBreakdownType,
  RiskAnalysis,
  UnitEconomics,
  FounderFit,
  MarketSignals,
  GovernanceAssessment,
  FundraisingRoadmap,
  PlaybookAnalysis,
  DueDiligenceScore,
  ExtractedProjectData,
  PitchDeckContent,
  LeanRoadmap,
  FinancialProjection,
  ComplianceRoadmap,
  StepIdea,
} from '@/types/validation';

interface ValidationFull {
  id: string;
  idea_name: string | null;
  idea_description: string | null;
  idea_industry: string | null;
  target_country: string | null;
  target_region: string | null;
  business_model: string | null;
  business_stage: string | null;
  pricing_range: string | null;
  known_competitors: string[] | null;
  questions_answers: { question: string; answer: string }[] | null;
  customer_segment: string | null;
  customer_pain_points: string[] | null;
  value_proposition: string | null;
  differentiator: string | null;
  mvp_type: string | null;
  mvp_features: { name: string; description: string; priority: string }[] | null;
  mvp_user_flow: string | null;
  summary_json: {
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
    next_steps: string[];
  } | null;
  validation_score: number | null;
  ai_feedback: string | null;
  market_sizing: MarketSizing | null;
  competitive_analysis: CompetitiveAnalysisType | null;
  score_breakdown: ScoreBreakdownType | null;
  risk_analysis: RiskAnalysis | null;
  unit_economics: UnitEconomics | null;
  founder_fit: FounderFit | null;
  market_signals: MarketSignals | null;
  governance_assessment: GovernanceAssessment | null;
  fundraising_roadmap: FundraisingRoadmap | null;
  playbook_analysis: PlaybookAnalysis | null;
  current_solution: string | null;
  acquisition_channel: string | null;
  tech_level: string | null;
  idea_problem: string | null;
  traction_status: string | null;
  team_composition: string | null;
  share_token: string | null;
  created_at: string;
  completed_at: string | null;
  version: number;
  due_diligence_score: DueDiligenceScore | null;
  due_diligence_extracted: ExtractedProjectData | null;
  pitch_deck_content: PitchDeckContent | null;
  lean_roadmap: LeanRoadmap | null;
  financial_projection: FinancialProjection | null;
  compliance_roadmap: ComplianceRoadmap | null;
  validation_mode: 'quick' | 'detailed' | 'premium' | null;
  quick_icp: string | null;
}


// ── Paywall visual para el flujo rápido ───────────────────────────────────────
// Aplica blur + candado + CTA independientemente del tier (aprobado Mesa Directiva 01-Jun-2026).
// El CTA resetea el store (limpiando la validación quick completada) y pre-rellena
// la idea para que el usuario arranque el flujo detallado sin reescribir su idea.
function QuickDimensionPaywall({
  dimension,
  description,
  ideaData,
}: {
  dimension: string;
  description: string;
  ideaData?: { idea_name: string | null; idea_description: string | null; idea_industry: string | null };
}) {
  const navigate = useNavigate();
  const { reset, updateStepIdea, setValidationMode } = useValidationStore();

  const handleUpgrade = () => {
    reset();
    if (ideaData?.idea_name) {
      updateStepIdea({
        idea_name:        ideaData.idea_name        ?? '',
        idea_description: ideaData.idea_description ?? '',
        idea_industry:    (ideaData.idea_industry ?? '') as StepIdea['idea_industry'],
        current_solution: '',
      });
    }
    setValidationMode('detailed');
    navigate('/validate');
  };

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-[#12121A] h-full min-h-[180px]">
      {/* Contenido difuminado de fondo */}
      <div className="blur-sm pointer-events-none select-none p-5 space-y-3 opacity-40">
        <div className="h-4 bg-white/10 rounded-lg w-1/2" />
        <div className="h-3 bg-white/8 rounded w-full" />
        <div className="h-3 bg-white/8 rounded w-4/5" />
        <div className="h-3 bg-white/8 rounded w-3/5" />
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="h-16 bg-white/5 rounded-xl" />
          <div className="h-16 bg-white/5 rounded-xl" />
          <div className="h-16 bg-white/5 rounded-xl" />
        </div>
      </div>
      {/* Overlay con lock */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0A0A0F]/55 backdrop-blur-[3px] p-5 text-center">
        <div className="w-11 h-11 rounded-full bg-[#7C6FF7]/15 border border-[#7C6FF7]/30 flex items-center justify-center mb-3">
          <svg className="w-5 h-5 text-[#7C6FF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <p className="text-sm font-bold text-[#F0EFF8] mb-1">{dimension} — Sin datos suficientes</p>
        <p className="text-xs text-[#8B8AA0] mb-4 max-w-[220px] leading-relaxed">{description}</p>
        <button
          onClick={handleUpgrade}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7C6FF7] hover:bg-[#6B5EE6] text-white text-xs font-bold rounded-xl transition-colors"
        >
          Completa el análisis Detallado en 5 minutos
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

const DASHBOARD_TABS = ['Veredicto', 'Validación', 'Estrategia', 'Finanzas', 'Hoja de Ruta', 'Inversión', 'Due Diligence'] as const;
type DashboardTab = typeof DASHBOARD_TABS[number];

const TAB_REQUIRED_TIER: Partial<Record<DashboardTab, 'pro' | 'premium'>> = {
  'Estrategia':    'pro',
  'Finanzas':      'pro',
  'Hoja de Ruta':  'pro',
  'Inversión':     'pro',
  'Due Diligence': 'premium',
};

const LOCK_BADGE: Record<'pro' | 'premium', string> = {
  pro:     'bg-purple-500/15 text-purple-400 border border-purple-500/20',
  premium: 'bg-amber-500/15 text-amber-400 border border-amber-500/20',
};

export function ValidationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ValidationFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatePdfLoading, setUpdatePdfLoading] = useState(false);
  const [pitchDeckLoading, setPitchDeckLoading] = useState(false);
  const [showPDFModal, setShowPDFModal] = useState(false);
  const [, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [showPivotModal, setShowPivotModal] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [generatingAdvanced, setGeneratingAdvanced] = useState(false);
  const [advancedProgress, setAdvancedProgress] = useState<string>('');
  const [generatingVerdict, setGeneratingVerdict] = useState(false);
  // Persiste en sessionStorage por validationId para sobrevivir navegaciones dentro de la sesión
  const verdictSessionKey = `verdict_generated_${id}`;
  const [verdictGenerated, setVerdictGenerated] = useState(
    () => sessionStorage.getItem(verdictSessionKey) === 'true'
  );
  const [activeTab, setActiveTab] = useState<DashboardTab>('Veredicto');
  const [pdfTheme, setPdfTheme] = useState<PDFTheme>(() => {
    return (localStorage.getItem('validateai_pdf_theme') as PDFTheme) ?? 'clean';
  });
  const [agentLog, setAgentLog] = useState<{
    executive_summary: string | null;
    reddit_data: unknown;
    trends_data: unknown;
    reddit_status: 'success' | 'error' | 'pending';
    trends_status: 'success' | 'error' | 'pending';
  } | null>(null);
  const { callAI } = useAI();
  const { tier, isPro: isPremium } = useUserTier();
  const isProLocked = tier === 'free' || tier === 'basic';
  // Agnóstico al tier — depende solo del modo de análisis, no del plan de suscripción.
  const isQuickMode = data?.validation_mode === 'quick';
  const founderProfile = useValidationStore((s) => s.founderProfile);
  const [reportFeedback, setReportFeedback] = useState<string | null>(null);
  const sections = getUserSections(tier);
  const { mentors } = useMentors(data?.idea_description);

  const handleThemeChange = (t: PDFTheme) => {
    setPdfTheme(t);
    localStorage.setItem('validateai_pdf_theme', t);
  };

  useEffect(() => {
    const fetch = async () => {
      const { data: row, error } = await supabase
        .from('validations')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !row) {
        toast.error('No se encontró la validación.');
        navigate('/results');
        return;
      }
      setData(row as ValidationFull);
      setLoading(false);
      if (row.validation_score != null) {
        trackValidationCompleted(row.id, row.validation_score, row.idea_industry ?? '', tier);
      }

      // Hidratar audit trail desde la DB — sobrevive recargas y share links.
      // El audit trail se embebe dentro de due_diligence_score desde la Edge Function.
      const dd = row.due_diligence_score as Record<string, unknown> | null;
      if (dd?.sources_used) {
        setDdAuditTrail({
          dataWarnings:   (dd.data_warnings  as string[])                            ?? [],
          sourcesUsed:    (dd.sources_used   as string[])                            ?? [],
          sourcesSkipped: (dd.sources_skipped as { source: string; reason: string }[]) ?? [],
          fromCache:      false,
          verdictSummary: (dd.verdict_summary as string)                             ?? '',
        });
      }
      trackTelemetryEvent({
        event_name: 'deliverable_viewed',
        context: {
          tier: (tier ?? 'free') as 'free' | 'basic' | 'pro' | 'premium',
          action_taken: 'viewed_validation_report',
        },
      });

      // Cargar agent log si existe (flujo Premium)
      const { data: log } = await supabase
        .from('validation_agents_log')
        .select('executive_summary, reddit_data, trends_data, reddit_status, trends_status')
        .eq('validation_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (log) setAgentLog(log as typeof agentLog);
    };
    fetch();
  }, [id, navigate]);

  // Auto-genera el playbook la primera vez que el usuario ve Veredicto o Validación.
  // _fallo_elegante: true indica que el RAG no tuvo chunks suficientes (vault vacío /
  // OPENAI_API_KEY ausente) — se trata igual que null para permitir reintentos.
  const playbookReady = data?.playbook_analysis &&
    !(data.playbook_analysis as unknown as Record<string, unknown>)._fallo_elegante;

  useEffect(() => {
    if (
      (activeTab !== 'Veredicto' && activeTab !== 'Validación') ||
      !data ||
      playbookReady ||
      generatingVerdict ||
      verdictGenerated
    ) return;

    const generate = async () => {
      setGeneratingVerdict(true);
      // Marcar en sessionStorage ANTES de la llamada para evitar doble disparo
      sessionStorage.setItem(verdictSessionKey, 'true');
      setVerdictGenerated(true);
      try {
        const ctx: Record<string, unknown> = {
          idea_name:           data.idea_name,
          idea_description:    data.idea_description,
          idea_problem:        data.idea_problem,
          idea_industry:       data.idea_industry,
          target_country:      data.target_country,
          business_model:      data.business_model,
          business_stage:      data.business_stage,
          pricing_range:       data.pricing_range,
          // Para quick mode: quick_icp sustituye a customer_segment
          customer_segment:    data.customer_segment ?? data.quick_icp,
          quick_icp:           data.quick_icp,
          value_proposition:   data.value_proposition,
          differentiator:      data.differentiator,
          questions_answers:   data.questions_answers,
          current_solution:    data.current_solution,
          acquisition_channel: data.acquisition_channel,
          tech_level:          data.tech_level,
          traction_status:     data.traction_status,
          team_composition:    data.team_composition,
          validation_mode:     data.validation_mode,
        };
        const result = await callAI<PlaybookAnalysis>(data.id, 6, 'playbook_analysis', ctx);
        if (result) {
          setData((prev) => prev ? { ...prev, playbook_analysis: result } : prev);
          // Save explícito desde el cliente como fallback al save del edge function
          supabase
            .from('validations')
            .update({ playbook_analysis: result })
            .eq('id', data.id)
            .then(({ error }) => {
              if (error) console.warn('[veredicto] Fallback save error:', error.message);
            });
        }
      } catch {
        toast.error('No se pudo generar el veredicto. Intenta de nuevo.');
      } finally {
        setGeneratingVerdict(false);
      }
    };
    generate();
  }, [activeTab, data?.id, playbookReady]);

  // business_stage no se recolecta en ningún paso del wizard — excluido de la condición
  const needsContextModal = isQuickMode
    || !data?.target_country
    || !data?.business_model
    || !data?.pricing_range;

  const missingAnalyses = {
    competitive: !data?.competitive_analysis,
    sizing: !data?.market_sizing,
    breakdown: !data?.score_breakdown,
  };

  const hasAnythingToUpdate = needsContextModal
    || Object.values(missingAnalyses).some(Boolean);

  // Análisis avanzados — se generan on-demand con un botón dedicado
  const missingAdvanced = {
    risk:        !data?.risk_analysis        && sections.includes('risks'),
    unit:        !data?.unit_economics       && sections.includes('unitEconomics'),
    founder:     !data?.founder_fit          && sections.includes('founderFit'),
    signals:     !data?.market_signals       && sections.includes('marketSizing'),
    governance:  !data?.governance_assessment && sections.includes('governance'),
    fundraising: !data?.fundraising_roadmap  && sections.includes('fundraising'),
  };
  const hasAdvancedToGenerate = Object.values(missingAdvanced).some(Boolean);

  // Nuevos módulos PDF (lean_roadmap, financial_projection, compliance_roadmap)
  const missingNewModules = {
    lean_roadmap:         !data?.lean_roadmap,
    financial_projection: !data?.financial_projection,
    compliance_roadmap:   !data?.compliance_roadmap,
  };
  const hasNewModulesToGenerate = Object.values(missingNewModules).some(Boolean);
  const [generatingNewModules, setGeneratingNewModules] = useState(false);
  const [generatingDueDiligence, setGeneratingDueDiligence] = useState(false);

  // Sprint 6: audit trail del último análisis de Due Diligence
  const [ddAuditTrail, setDdAuditTrail] = useState<{
    dataWarnings: string[];
    sourcesUsed: string[];
    sourcesSkipped: { source: string; reason: string }[];
    fromCache: boolean;
    verdictSummary: string;
  } | null>(null);

  const handleGenerateDueDiligence = async () => {
    if (!data) return;
    setGeneratingDueDiligence(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No estás autenticado.');

      // Sprint 6: pasar rut_empresa, brand_name y current_step para filtrado adaptativo
      const response = await fetch('https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/assemble-mega-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          validation_id: data.id,
          brand_name: data.idea_name ?? null,
          current_step: data.business_stage === 'funding' ? 'stepFunding'
            : data.business_stage === 'growth' ? 'stepGrowth'
            : 'stepIdea',
        }),
      });

      if (!response.ok) throw new Error('Error al generar Due Diligence');

      const result = await response.json();
      const { due_diligence_score, data_warnings, sources_used, sources_skipped, from_cache } = result;

      setData((prev) => prev ? { ...prev, due_diligence_score } : prev);

      // Guardar audit trail para renderizado
      setDdAuditTrail({
        dataWarnings: data_warnings ?? [],
        sourcesUsed: sources_used ?? [],
        sourcesSkipped: sources_skipped ?? [],
        fromCache: from_cache ?? false,
        verdictSummary: (due_diligence_score as Record<string, unknown>)?.verdict_summary as string ?? '',
      });

      trackDueDiligenceCompleted({
        validationId:        data.id,
        total:               (due_diligence_score as Record<string, unknown>)?.total as number ?? 0,
        investorReadiness:   (due_diligence_score as Record<string, unknown>)?.investorReadiness as string ?? 'not_ready',
        fromCache:           from_cache ?? false,
        sourcesUsed:         sources_used ?? [],
        sourcesSkippedCount: (sources_skipped ?? []).length,
        dataWarningsCount:   (data_warnings ?? []).length,
        industry:            data.idea_industry ?? '',
        tier:                tier ?? 'free',
      });

      if (from_cache) {
        toast.success('Due Diligence cargado desde caché (0 tokens consumidos)');
      } else {
        toast.success('Análisis de Due Diligence completado');
      }
    } catch (err) {
      console.error(err);
      toast.error('Ocurrió un error al generar tu Due Diligence Score.');
    } finally {
      setGeneratingDueDiligence(false);
    }
  };

  const handleGenerateNewModules = async () => {
    if (!data) return;
    setGeneratingNewModules(true);
    try {
      const ctx: Record<string, unknown> = {
        idea_name: data.idea_name,
        idea_description: data.idea_description,
        idea_industry: data.idea_industry,
        target_country: data.target_country,
        target_region: data.target_region ?? null,
        business_model: data.business_model,
        business_stage: data.business_stage,
        pricing_range: data.pricing_range,
        known_competitors: data.known_competitors ?? [],
        customer_segment: data.customer_segment,
        customer_pain_points: data.customer_pain_points,
        value_proposition: data.value_proposition,
        differentiator: data.differentiator,
        mvp_type: data.mvp_type,
        mvp_features: data.mvp_features,
        questions_answers: data.questions_answers,
      };

      const [leanResult, financialResult, complianceResult] = await Promise.all([
        missingNewModules.lean_roadmap         ? callAI<LeanRoadmap>(data.id, 6, 'lean_roadmap', ctx)              : Promise.resolve(null),
        missingNewModules.financial_projection  ? callAI<FinancialProjection>(data.id, 6, 'financial_projection', ctx) : Promise.resolve(null),
        missingNewModules.compliance_roadmap    ? callAI<ComplianceRoadmap>(data.id, 6, 'compliance_roadmap', ctx)  : Promise.resolve(null),
      ]);

      const localUpdates: Record<string, unknown> = {};
      if (leanResult)       localUpdates.lean_roadmap         = leanResult;
      if (financialResult)  localUpdates.financial_projection = financialResult;
      if (complianceResult) localUpdates.compliance_roadmap   = complianceResult;

      if (Object.keys(localUpdates).length > 0) {
        setData((prev) => prev ? { ...prev, ...localUpdates } : prev);
        toast.success('Nuevos módulos generados correctamente');
      }
    } catch {
      toast.error('No se pudieron generar los nuevos módulos. Intenta de nuevo.');
    } finally {
      setGeneratingNewModules(false);
    }
  };

  const handleReanalyzeClick = () => {
    if (!data) return;
    if (needsContextModal) {
      setShowReanalyzeModal(true);
    } else {
      runReanalysis(data.target_country!, data.target_region, data.business_model!,
        data.business_stage!, data.pricing_range!, data.known_competitors ?? []);
    }
  };

  const runReanalysis = async (
    target_country: string,
    target_region: string | null | undefined,
    business_model: string,
    business_stage: string,
    pricing_range: string,
    known_competitors: string[],
    founderContext?: import('@/types/validation').FounderContext,
  ) => {
    if (!data) return;
    setShowReanalyzeModal(false);
    setReanalyzing(true);

    try {
      // Guardar contexto de mercado si faltaba
      if (needsContextModal) {
        const { error } = await supabase.from('validations').update({
          target_country, target_region, business_model, business_stage,
          pricing_range, known_competitors,
        }).eq('id', data.id);
        if (error) throw error;
      }

      const ctx: Record<string, unknown> = {
        idea_name: data.idea_name,
        idea_description: data.idea_description,
        idea_industry: data.idea_industry,
        target_country,
        target_region: target_region ?? null,
        business_model,
        business_stage,
        pricing_range,
        known_competitors,
        customer_segment: data.customer_segment,
        customer_pain_points: data.customer_pain_points,
        value_proposition: data.value_proposition,
        differentiator: data.differentiator,
        mvp_type: data.mvp_type,
        mvp_features: data.mvp_features,
        questions_answers: data.questions_answers,
        ...(founderContext ? { founder_context: founderContext } : {}),
      };

      const [competitiveResult, sizingResult, summaryResult] = await Promise.all([
        missingAnalyses.competitive
          ? callAI<CompetitiveAnalysisType>(data.id, 3, 'competitive_analysis', ctx)
          : Promise.resolve(null),
        missingAnalyses.sizing
          ? callAI<MarketSizing>(data.id, 5, 'market_sizing', ctx)
          : Promise.resolve(null),
        missingAnalyses.breakdown
          ? callAI<{ score: number; score_breakdown: ScoreBreakdownType; feedback: string; strengths: string[]; weaknesses: string[]; next_steps: string[] }>(data.id, 6, 'summary', ctx)
          : Promise.resolve(null),
      ]);

      // La edge function ya persistió los resultados de IA en la DB.
      setData((prev) => prev ? {
        ...prev,
        target_country, target_region: target_region ?? null,
        business_model, business_stage, pricing_range, known_competitors,
        ...(competitiveResult ? { competitive_analysis: competitiveResult } : {}),
        ...(sizingResult ? { market_sizing: sizingResult } : {}),
        ...(summaryResult ? {
          score_breakdown: summaryResult.score_breakdown,
          validation_score: summaryResult.score,
          ai_feedback: summaryResult.feedback,
          summary_json: summaryResult as unknown as typeof prev.summary_json,
        } : {}),
      } : prev);

      toast.success('Análisis actualizado correctamente');
    } catch {
      toast.error('No se pudo completar el análisis. Intenta de nuevo.');
    } finally {
      setReanalyzing(false);
    }
  };

  /** Genera los análisis avanzados (riesgo, unit economics, founder fit, señales) */
  const handleGenerateAdvanced = async () => {
    if (!data) return;
    setGeneratingAdvanced(true);
    try {
      const ctx: Record<string, unknown> = {
        idea_name: data.idea_name,
        idea_description: data.idea_description,
        idea_industry: data.idea_industry,
        target_country: data.target_country,
        target_region: data.target_region ?? null,
        business_model: data.business_model,
        business_stage: data.business_stage,
        pricing_range: data.pricing_range,
        known_competitors: data.known_competitors ?? [],
        customer_segment: data.customer_segment,
        customer_pain_points: data.customer_pain_points,
        value_proposition: data.value_proposition,
        differentiator: data.differentiator,
        mvp_type: data.mvp_type,
        mvp_features: data.mvp_features,
        questions_answers: data.questions_answers,
      };

      // TS-106: enriquecer contexto founder_fit con datos editados de founder_profiles
      const founderCtx: Record<string, unknown> = { ...ctx };
      if (founderProfile) {
        founderCtx.founder_linkedin_url        = founderProfile.linkedin_url;
        founderCtx.founder_full_name           = founderProfile.full_name;
        founderCtx.founder_headline            = founderProfile.headline;
        founderCtx.founder_summary_bio         = founderProfile.summary_bio;
        founderCtx.founder_industry_years      = founderProfile.industry_expertise_years;
        founderCtx.founder_skills              = founderProfile.skills;
        founderCtx.founder_work_experience     = founderProfile.work_experience;
        founderCtx.founder_competency_scores   = founderProfile.competency_scores;
      }

      const advancedTaskDefs: { flag: boolean; label: string; fn: () => Promise<unknown> }[] = [
        { flag: missingAdvanced.risk,        label: 'Análisis de Riesgos',   fn: () => callAI<RiskAnalysis>(data.id, 6, 'risk_analysis', ctx) },
        { flag: missingAdvanced.unit,        label: 'Unit Economics',         fn: () => callAI<UnitEconomics>(data.id, 6, 'unit_economics', ctx) },
        { flag: missingAdvanced.founder,     label: 'Founder Fit',            fn: () => callAI<FounderFit>(data.id, 6, 'founder_fit', founderCtx) },
        { flag: missingAdvanced.signals,     label: 'Señales de Mercado',     fn: () => callAI<MarketSignals>(data.id, 6, 'market_signals', ctx) },
        { flag: missingAdvanced.governance,  label: 'Gobernanza',             fn: () => callAI<GovernanceAssessment>(data.id, 6, 'governance_assessment', ctx) },
        { flag: missingAdvanced.fundraising, label: 'Fundraising',            fn: () => callAI<FundraisingRoadmap>(data.id, 6, 'fundraising_roadmap', ctx) },
      ].filter(t => t.flag);

      const total = advancedTaskDefs.length;
      // Ejecutar secuencialmente con progreso visible y 700ms entre llamadas para evitar 429
      const settled: PromiseSettledResult<unknown>[] = [];
      for (let i = 0; i < advancedTaskDefs.length; i++) {
        const def = advancedTaskDefs[i];
        setAdvancedProgress(`${def.label} (${i + 1}/${total})`);
        const result = await def.fn().then(v => ({ status: 'fulfilled' as const, value: v }))
          .catch(e => ({ status: 'rejected' as const, reason: e }));
        settled.push(result);
        if (i < advancedTaskDefs.length - 1) await new Promise(r => setTimeout(r, 700));
      }
      setAdvancedProgress('');

      // Mapear resultados al orden de advancedTaskDefs
      let si = 0;
      const pickFromSettled = <T,>(flag: boolean): T | null => {
        if (!flag) return null;
        const r = settled[si++];
        return r.status === 'fulfilled' ? (r.value as T) : null;
      };
      const riskResult       = pickFromSettled<RiskAnalysis>(missingAdvanced.risk);
      const unitResult       = pickFromSettled<UnitEconomics>(missingAdvanced.unit);
      const founderResult    = pickFromSettled<FounderFit>(missingAdvanced.founder);
      const signalsResult    = pickFromSettled<MarketSignals>(missingAdvanced.signals);
      const governanceResult = pickFromSettled<GovernanceAssessment>(missingAdvanced.governance);
      const fundraisingResult= pickFromSettled<FundraisingRoadmap>(missingAdvanced.fundraising);

      // La edge function ya persistió cada resultado en la DB.
      // Actualizamos solo el estado local para refrescar la UI sin reload.
      const localUpdates: Record<string, unknown> = {};
      if (riskResult)        localUpdates.risk_analysis         = riskResult;
      if (unitResult)        localUpdates.unit_economics        = unitResult;
      if (founderResult)     localUpdates.founder_fit           = founderResult;
      if (signalsResult)     localUpdates.market_signals        = signalsResult;
      if (governanceResult)  localUpdates.governance_assessment = governanceResult;
      if (fundraisingResult) localUpdates.fundraising_roadmap   = fundraisingResult;

      if (Object.keys(localUpdates).length > 0) {
        setData((prev) => prev ? { ...prev, ...localUpdates } : prev);
      }

      toast.success('Análisis avanzados generados');
    } catch {
      toast.error('No se pudieron generar los análisis avanzados.');
    } finally {
      setGeneratingAdvanced(false);
      setAdvancedProgress('');
    }
  };

  const handleUpgradeToDetailed = () => {
    if (!data) return;
    const store = useValidationStore.getState();
    store.reset();
    store.updateStepIdea({
      idea_name:        data.idea_name        ?? '',
      idea_description: data.idea_description ?? '',
      idea_industry:    (data.idea_industry ?? '') as StepIdea['idea_industry'],
      current_solution: '',
    });
    store.setValidationMode('detailed');
    navigate('/validate');
  };

  const handleShare = async () => {
    if (!data) return;
    if (data.share_token) {
      const url = `${window.location.origin}/shared/${data.share_token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado al portapapeles');
      return;
    }
    setSharing(true);
    try {
      const token = crypto.randomUUID();
      const { error } = await supabase.from('validations').update({ share_token: token }).eq('id', data.id);
      if (error) throw error;
      setData({ ...data, share_token: token });
      const url = `${window.location.origin}/shared/${token}`;
      setShareUrl(url);
      await navigator.clipboard.writeText(url);
      toast.success('Link copiado al portapapeles');
    } catch {
      toast.error('No se pudo generar el link de compartir.');
    } finally {
      setSharing(false);
    }
  };

  /** Actualiza el análisis de IA y luego descarga el PDF con los datos frescos */
  const handleUpdateAndExportPDF = async () => {
    if (!data) return;
    setUpdatePdfLoading(true);
    try {
      // 1 — Re-correr análisis (igual que runReanalysis pero inline, para capturar el estado actualizado)
      const ctx: Record<string, unknown> = {
        idea_name: data.idea_name,
        idea_description: data.idea_description,
        idea_industry: data.idea_industry,
        target_country: data.target_country,
        target_region: data.target_region ?? null,
        business_model: data.business_model,
        business_stage: data.business_stage,
        pricing_range: data.pricing_range,
        known_competitors: data.known_competitors ?? [],
        customer_segment: data.customer_segment,
        customer_pain_points: data.customer_pain_points,
        value_proposition: data.value_proposition,
        differentiator: data.differentiator,
        mvp_type: data.mvp_type,
        mvp_features: data.mvp_features,
        questions_answers: data.questions_answers,
      };

      const [competitiveResult, sizingResult, summaryResult] = await Promise.all([
        callAI<CompetitiveAnalysisType>(data.id, 3, 'competitive_analysis', ctx),
        callAI<MarketSizing>(data.id, 5, 'market_sizing', ctx),
        callAI<{ score: number; score_breakdown: ScoreBreakdownType; feedback: string; strengths: string[]; weaknesses: string[]; next_steps: string[] }>(data.id, 6, 'summary', ctx),
      ]);

      const updates: Record<string, unknown> = {};
      if (competitiveResult) updates.competitive_analysis = competitiveResult;
      if (sizingResult) updates.market_sizing = sizingResult;
      if (summaryResult) {
        updates.score_breakdown = summaryResult.score_breakdown;
        updates.validation_score = summaryResult.score;
        updates.ai_feedback = summaryResult.feedback;
        updates.summary_json = summaryResult;
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from('validations').update(updates).eq('id', data.id);
      }

      // Estado actualizado para el PDF
      const freshData: typeof data = {
        ...data,
        ...(competitiveResult ? { competitive_analysis: competitiveResult } : {}),
        ...(sizingResult ? { market_sizing: sizingResult } : {}),
        ...(summaryResult ? {
          score_breakdown: summaryResult.score_breakdown,
          validation_score: summaryResult.score,
          ai_feedback: summaryResult.feedback,
          summary_json: summaryResult,
        } : {}),
      };

      // Actualizar UI
      setData(freshData);

      // 2 — Descargar PDF con datos frescos
      await generateValidationPDF({
        idea_name:             freshData.idea_name ?? undefined,
        idea_description:      freshData.idea_description ?? undefined,
        idea_industry:         freshData.idea_industry ?? undefined,
        target_country:        freshData.target_country ?? undefined,
        target_region:         freshData.target_region ?? undefined,
        business_model:        freshData.business_model ?? undefined,
        business_stage:        freshData.business_stage ?? undefined,
        pricing_range:         freshData.pricing_range ?? undefined,
        known_competitors:     freshData.known_competitors ?? undefined,
        questions_answers:     freshData.questions_answers ?? undefined,
        customer_segment:      freshData.customer_segment ?? undefined,
        customer_pain_points:  freshData.customer_pain_points ?? undefined,
        value_proposition:     freshData.value_proposition ?? undefined,
        differentiator:        freshData.differentiator ?? undefined,
        mvp_type:              freshData.mvp_type ?? undefined,
        mvp_features:          freshData.mvp_features ?? undefined,
        mvp_user_flow:         freshData.mvp_user_flow ?? undefined,
        summary:               (freshData.summary_json ?? {}) as Record<string, unknown>,
        market_sizing:         freshData.market_sizing ?? null,
        competitive_analysis:  freshData.competitive_analysis ?? null,
        score_breakdown:       freshData.score_breakdown ?? null,
        risk_analysis:         freshData.risk_analysis ?? null,
        unit_economics:        freshData.unit_economics ?? null,
        founder_fit:           freshData.founder_fit ?? null,
        market_signals:        freshData.market_signals ?? null,
        governance_assessment: freshData.governance_assessment ?? null,
        fundraising_roadmap:   freshData.fundraising_roadmap ?? null,
        playbook_analysis:     freshData.playbook_analysis ?? null,
        mentors:               mentors.length ? mentors : undefined,
        validation_score:      freshData.validation_score ?? null,
        due_diligence:         freshData.due_diligence_score ?? null,
      }, pdfTheme);

      trackDeliverableDownloaded('pdf_fresh', pdfTheme);
      toast.success('Análisis actualizado y PDF descargado');
    } catch {
      toast.error('No se pudo actualizar el PDF. Intenta de nuevo.');
    } finally {
      setUpdatePdfLoading(false);
    }
  };


  const handleExportPitchDeck = async () => {
    if (!data) return;
    setPitchDeckLoading(true);
    try {
      const ctx: Record<string, unknown> = {
        idea_name: data.idea_name,
        idea_description: data.idea_description,
        idea_industry: data.idea_industry,
        target_country: data.target_country,
        business_model: data.business_model,
        business_stage: data.business_stage,
        pricing_range: data.pricing_range,
        customer_segment: data.customer_segment,
        customer_pain_points: data.customer_pain_points,
        value_proposition: data.value_proposition,
        differentiator: data.differentiator,
        questions_answers: data.questions_answers,
      };

      let pitchContent = data.pitch_deck_content;
      if (!pitchContent) {
        toast.info('Generando narrativa del Pitch Deck…');
        pitchContent = await callAI<PitchDeckContent>(data.id, 6, 'pitch_deck', ctx);
        if (pitchContent) {
          setData((prev) => prev ? { ...prev, pitch_deck_content: pitchContent } : prev);
          supabase.from('validations').update({ pitch_deck_content: pitchContent }).eq('id', data.id)
            .then(({ error }) => { if (error) console.warn('[pitch-deck] save error:', error.message); });
        }
      }

      await generatePitchDeckPDF({
        idea_name:            data.idea_name ?? undefined,
        idea_description:     data.idea_description ?? undefined,
        idea_industry:        data.idea_industry ?? undefined,
        target_country:       data.target_country ?? undefined,
        business_model:       data.business_model ?? undefined,
        business_stage:       data.business_stage ?? undefined,
        pricing_range:        data.pricing_range ?? undefined,
        customer_pain_points: data.customer_pain_points ?? undefined,
        value_proposition:    data.value_proposition ?? undefined,
        differentiator:       data.differentiator ?? undefined,
        mvp_features:         data.mvp_features ?? undefined,
        market_sizing:        data.market_sizing ?? null,
        unit_economics:       data.unit_economics ?? null,
        competitive_analysis: data.competitive_analysis ?? null,
        fundraising_roadmap:  data.fundraising_roadmap ?? null,
        validation_score:     data.validation_score ?? null,
        pitch_deck_content:   pitchContent ?? null,
      });

      trackDeliverableDownloaded('pitch_deck', pdfTheme);
      toast.success('Pitch Deck descargado');
    } catch (err) {
      console.error('[Pitch Deck] Error:', err);
      toast.error('No se pudo generar el Pitch Deck.');
    } finally {
      setPitchDeckLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
        <div className="flex-1 max-w-6xl mx-auto w-full px-4 py-10 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-[#12121A] rounded-2xl border border-white/[0.06] p-6 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-1/3 mb-3" />
              <div className="h-3 bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary_json;
  // Premium validations don't have summary_json/validation_score; use playbook viability_score as fallback
  const displayScore = data.validation_score ?? data.playbook_analysis?.viability_score ?? null;
  const isGood = (displayScore ?? 0) >= 70;
  const isMid = (displayScore ?? 0) >= 40;
  const scoreBg = displayScore == null
    ? 'bg-white/5 border-white/10'
    : isGood
    ? 'bg-[#34D399]/10 border-[#34D399]/30 shadow-sm shadow-[#34D399]/10'
    : isMid
    ? 'bg-[#F7C56C]/10 border-[#F7C56C]/30 shadow-sm shadow-[#F7C56C]/10'
    : 'bg-[#F87171]/10 border-[#F87171]/30 shadow-sm shadow-[#F87171]/10';


  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col">
      <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link to="/results" className="hover:text-[#7C6FF7] transition">Mis validaciones</Link>
          <span>›</span>
          <span className="text-gray-700 dark:text-[#C4C4D4] font-medium truncate">{data.idea_name ?? 'Sin nombre'}</span>
        </div>

        {/* Banner: Nuevos módulos disponibles */}
        {hasNewModulesToGenerate && !generatingNewModules && (
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-[#7C6FF7]/10 border border-[#7C6FF7]/25">
            <div className="flex items-start gap-3">
              <svg className="w-4 h-4 text-[#A78BFA] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <div>
                <p className="text-sm font-bold text-[#A78BFA]">Nuevos módulos disponibles</p>
                <p className="text-xs text-[#8B8AA0] mt-0.5">
                  Haz clic en <strong>Re-analizar Idea</strong> para generar tu Roadmap Legal, Financiero y de MVP con la versión más reciente de la IA.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateNewModules}
              className="shrink-0 px-4 py-2 bg-[#7C6FF7] hover:bg-[#6B5EE6] text-white text-xs font-bold rounded-xl transition"
            >
              Re-analizar Idea
            </button>
          </div>
        )}
        {generatingNewModules && (
          <div className="mb-4 flex items-center gap-3 p-4 rounded-2xl bg-[#7C6FF7]/10 border border-[#7C6FF7]/25">
            <div className="w-4 h-4 border-2 border-[#7C6FF7]/40 border-t-[#7C6FF7] rounded-full animate-spin shrink-0" />
            <p className="text-sm font-bold text-[#A78BFA]">Generando nuevos módulos con la IA más reciente...</p>
          </div>
        )}

        {/* Header */}
        <div className="mb-6 space-y-4">
          {/* Título */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-[#F0EFF8] break-words">{data.idea_name ?? 'Sin nombre'}</h1>
                <span className="px-2 py-0.5 rounded-full bg-gray-200 text-gray-600 dark:text-[#8B8AA0] text-[10px] font-black shrink-0">
                  v{data.version || 1}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-1 capitalize">
                {data.idea_industry ?? ''} · {data.completed_at
                  ? new Date(data.completed_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
                  : new Date(data.created_at).toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
                }
              </p>
              
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {data.target_country && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-xs font-bold text-blue-400">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                    </svg>
                    {data.target_country}
                  </span>
                )}
                {data.business_model && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 text-xs font-bold text-[#A78BFA] capitalize">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7H4a2 2 0 00-2 2v6a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
                    </svg>
                    {data.business_model.replace(/_/g, ' ')}
                  </span>
                )}
                {data.pricing_range && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#34D399]/10 border border-[#34D399]/20 text-xs font-bold text-[#34D399]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {data.pricing_range}
                  </span>
                )}
              </div>
            </div>
            
            {/* Acciones y Menú Dropdown */}
            <div className="flex flex-wrap items-center gap-2 shrink-0 relative z-20 w-full sm:w-auto">
              {/* Botón Principal: Exportar PDFs */}
              <button
                onClick={() => setShowPDFModal(true)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 active:scale-[0.98] transition"
                title="Exportar documentos PDF"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                <span className="hidden xs:inline">Descargar </span>Dossier
              </button>

              {/* Compartir Rápido */}
              <button
                onClick={handleShare}
                disabled={sharing}
                className="flex items-center justify-center gap-1.5 px-3 py-2 border border-[#7C6FF7]/30 text-[#A78BFA] bg-[#7C6FF7]/5 text-xs font-bold rounded-xl hover:bg-[#7C6FF7]/10 active:scale-[0.98] transition disabled:opacity-50"
              >
                {sharing ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#7C6FF7]/40 border-t-[#7C6FF7] rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                )}
                Compartir
              </button>

              {/* Dropdown de Más Opciones */}
              <details 
                className="group relative"
                onBlur={(e) => {
                  // Cierra el details automáticamente si el foco sale del elemento
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    e.currentTarget.removeAttribute('open');
                  }
                }}
              >
                <summary className="flex items-center justify-center gap-1.5 h-9 px-3 border border-white/[0.06] text-[#8B8AA0] bg-[#12121A] rounded-xl text-xs font-bold hover:bg-white/5 hover:text-[#F0EFF8] transition cursor-pointer list-none [&::-webkit-details-marker]:hidden outline-none focus:ring-2 focus:ring-[#7C6FF7]/50">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  Opciones <span className="group-open:rotate-180 transition-transform opacity-50">▾</span>
                </summary>
                
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1A1A24] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-white/10 p-2 flex flex-col gap-1 z-50">
                  
                  {/* Tema del PDF */}
                  <div className="px-3 py-2.5 border-b border-white/5 mb-1 bg-[#0A0A0F]/50 rounded-lg">
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#8B8AA0] mb-2">Tema del PDF</p>
                    <div className="flex gap-1.5">
                      {PDF_THEMES.map((t) => {
                        const isActive = pdfTheme === t.id;
                        const swatches: Record<string, string> = {
                          dark:     'bg-[#0A0A0F]',
                          clean:    'bg-white border border-white/20',
                          gradient: 'bg-gradient-to-r from-[#7C6FF7] to-[#34D399]',
                        };
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleThemeChange(t.id)}
                            title={t.label}
                            className={`flex-1 flex justify-center py-1.5 rounded-lg border transition-all ${
                              isActive
                                ? 'border-[#7C6FF7] bg-[#7C6FF7]/10'
                                : 'border-white/10 hover:border-[#7C6FF7]/50'
                            }`}
                          >
                            <span className={`w-3.5 h-3.5 rounded-full ${swatches[t.id]}`} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Acciones de IA */}
                  {hasAnythingToUpdate && (
                    <button onClick={handleReanalyzeClick} disabled={reanalyzing} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-xl text-xs font-bold text-[#F0EFF8] text-left transition disabled:opacity-50">
                      {reanalyzing ? (
                        <div className="w-4 h-4 border-2 border-[#7C6FF7]/40 border-t-[#7C6FF7] rounded-full animate-spin shrink-0" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0 text-[#8B8AA0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                      )}
                      {reanalyzing ? 'Analizando...' : 'Actualizar Datos IA'}
                    </button>
                  )}

                  {hasAdvancedToGenerate && (
                    <button onClick={handleGenerateAdvanced} disabled={generatingAdvanced} className="flex items-center gap-2 px-3 py-2 hover:bg-[#7C6FF7]/10 rounded-xl text-xs font-bold text-[#A78BFA] text-left transition disabled:opacity-50">
                      {generatingAdvanced ? (
                        <div className="w-4 h-4 border-2 border-[#7C6FF7]/40 border-t-[#7C6FF7] rounded-full animate-spin shrink-0" />
                      ) : (
                        <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      {generatingAdvanced ? 'Generando...' : 'Generar Análisis Pro'}
                    </button>
                  )}

                  <button onClick={handleUpdateAndExportPDF} disabled={updatePdfLoading} className="flex items-center gap-2 px-3 py-2 hover:bg-[#7C6FF7]/10 rounded-xl text-xs font-bold text-[#A78BFA] text-left transition disabled:opacity-50">
                    {updatePdfLoading ? (
                      <div className="w-4 h-4 border-2 border-[#7C6FF7]/40 border-t-[#7C6FF7] rounded-full animate-spin shrink-0" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                    )}
                    {updatePdfLoading ? 'Actualizando PDF...' : 'PDF Fresco (Act. + PDF)'}
                  </button>

                  <div className="h-px bg-white/5 my-1" />

                  {/* Acciones de Versión */}
                  <button onClick={() => { setShowPivotModal(true); document.querySelector('details[open]')?.removeAttribute('open'); }} className="flex items-center gap-2 px-3 py-2 hover:bg-[#F7C56C]/10 rounded-xl text-xs font-bold text-[#F7C56C] text-left transition">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                    </svg>
                    Pivotar Idea
                  </button>

                  <Link to={`/results/${id}/history`} className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-xl text-xs font-bold text-[#8B8AA0] transition">
                    <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m-10.5-1A9 9 0 1012 21a9 9 0 00-9.5-3.5" />
                    </svg>
                    Historial de Versiones
                  </Link>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* ── SNAPSHOT HERO ── */}
        {data.validation_score != null && (
          <div className="mb-6 bg-[#12121A] rounded-2xl border border-white/[0.06] p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
            <div className={`shrink-0 w-16 h-16 rounded-2xl border-2 flex flex-col items-center justify-center font-heading
              ${isGood ? 'bg-[#34D399]/10 border-[#34D399]/30' : isMid ? 'bg-[#F7C56C]/10 border-[#F7C56C]/30' : 'bg-[#F87171]/10 border-[#F87171]/30'}`}>
              <span className={`font-black text-2xl ${isGood ? 'text-[#34D399]' : isMid ? 'text-[#F7C56C]' : 'text-[#F87171]'}`}>
                {data.validation_score}
              </span>
              <span className="text-[10px] font-bold text-[#8B8AA0]">/100</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-bold uppercase tracking-wide mb-1
                ${isGood ? 'text-[#34D399]' : isMid ? 'text-[#F7C56C]' : 'text-[#F87171]'}`}>
                {isGood ? 'Idea con buen potencial' : isMid ? 'Requiere ajustes clave' : 'Necesita revisión profunda'}
              </p>
              {data.ai_feedback && (
                <p className="text-sm text-[#8B8AA0] leading-relaxed line-clamp-2">{data.ai_feedback}</p>
              )}
              {data.score_breakdown && (
                <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                  {(Object.entries(data.score_breakdown) as [string, number][]).slice(0, 5).map(([key, val]) => (
                    <span key={key} className="text-xs text-[#8B8AA0] capitalize">
                      <span className="font-semibold text-[#F0EFF8] tabular-nums">{val}</span> {key}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="shrink-0 w-full sm:w-auto">
              {isGood ? (
                <button
                  onClick={handleExportPitchDeck}
                  disabled={pitchDeckLoading}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#7C6FF7] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition-all shadow-lg shadow-[#7C6FF7]/25 cursor-pointer disabled:opacity-60"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  {pitchDeckLoading ? 'Generando…' : 'Generar Pitch Deck'}
                </button>
              ) : isMid ? (
                <button
                  onClick={() => setActiveTab('Veredicto')}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F7C56C]/10 text-[#F7C56C] border border-[#F7C56C]/30 text-sm font-bold rounded-xl hover:bg-[#F7C56C]/20 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Ver análisis completo
                </button>
              ) : (
                <button
                  onClick={() => setShowPivotModal(true)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#F87171]/10 text-[#F87171] border border-[#F87171]/30 text-sm font-bold rounded-xl hover:bg-[#F87171]/20 transition-all cursor-pointer"
                >
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  Pivotar Idea
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── TABS ── */}
        <div className="flex overflow-x-auto gap-2 mb-6 pb-2 scrollbar-hide snap-x">
          {DASHBOARD_TABS.map((t) => {
            const isActive = activeTab === t;
            let hasData = false;
            let tabIcon: React.ReactNode = null;

            switch (t) {
              case 'Veredicto':
                hasData = !!playbookReady;
                tabIcon = (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                );
                break;
              case 'Validación':
                hasData = data.summary_json != null;
                tabIcon = (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                );
                break;
              case 'Estrategia':
                hasData = data.market_sizing != null;
                tabIcon = (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
                  </svg>
                );
                break;
              case 'Finanzas':
                hasData = data.unit_economics != null;
                tabIcon = (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                );
                break;
              case 'Hoja de Ruta':
                hasData = data.lean_roadmap != null;
                tabIcon = (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                  </svg>
                );
                break;
              case 'Inversión':
                hasData = data.fundraising_roadmap != null;
                tabIcon = (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                  </svg>
                );
                break;
              case 'Due Diligence':
                hasData = data.due_diligence_score != null;
                tabIcon = (
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                );
                break;
            }

            const requiredTier = TAB_REQUIRED_TIER[t];
            const isLocked = requiredTier === 'premium'
              ? tier !== 'premium'
              : requiredTier === 'pro'
                ? tier === 'free' || tier === 'basic'
                : false;

            return (
              <button
                key={t}
                onClick={() => { setActiveTab(t); trackTabView(t); }}
                className={`relative flex items-center gap-2 px-4 py-3 text-sm font-bold rounded-xl transition-all duration-150 border shrink-0 snap-start cursor-pointer ${
                  isActive
                    ? 'bg-[#7C6FF7]/10 text-[#A78BFA] border-[#7C6FF7]/30 shadow-sm shadow-[#7C6FF7]/10'
                    : 'bg-[#12121A] text-[#8B8AA0] border-white/[0.06] hover:bg-white/5 hover:text-[#F0EFF8]'
                }`}
              >
                <span className={isActive ? 'text-[#A78BFA]' : 'text-[#8B8AA0]'}>{tabIcon}</span>
                <span className="whitespace-nowrap">{t}</span>
                {isLocked && requiredTier ? (
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${LOCK_BADGE[requiredTier]}`}>
                    {requiredTier}
                  </span>
                ) : hasData ? (
                  <span className={`absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full ${isActive ? 'bg-[#7C6FF7]' : 'bg-[#7C6FF7]/50'}`} title="Datos disponibles" />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="space-y-5">

          {/* ── VEREDICTO ──────────────────────────────────────────────────── */}
          {activeTab === 'Veredicto' && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {generatingVerdict && (
                <div className="md:col-span-12 rounded-2xl border border-white/10 bg-white/5 p-10 flex flex-col items-center gap-4 text-center">
                  <div className="w-10 h-10 border-4 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
                  <div>
                    <p className="font-bold text-[#F0EFF8] mb-1">Analizando tu idea con el Playbook VC…</p>
                    <p className="text-sm text-[#8B8AA0]">Mom Test · JTBD · Unit Economics · Legal Chile</p>
                  </div>
                </div>
              )}

              {!generatingVerdict && data.playbook_analysis && (
                <>
                  <div className="md:col-span-12 rounded-xl border border-[#7C6FF7]/30 bg-[#7C6FF7]/10 px-4 py-3 flex items-center gap-3">
                    <svg className="w-4 h-4 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <p className="text-xs text-[#A78BFA] leading-relaxed">
                      <strong className="text-[#C4BCFC]">Veredicto VC</strong> — Análisis generado con los Playbooks de Validación, Economics, Legal Chile y Tech Stack. Sin filtros de cortesía.
                    </p>
                  </div>

                  {/* Left Column: Score & Breakdown */}
                  <div className="md:col-span-7 flex flex-col gap-4">
                    {/* Score — visible for both detailed (summary_json) and premium (playbook viability_score) */}
                    {displayScore != null && (
                      <div className={`rounded-3xl border-2 p-6 flex items-center ${scoreBg}`}>
                        <div className="flex flex-col sm:flex-row items-center gap-6 w-full">
                          <ScoreGauge score={displayScore} />
                          <div className="flex-1 text-center sm:text-left">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Score de Viabilidad VC</p>
                            <p className="text-gray-700 dark:text-[#C4C4D4] leading-relaxed text-sm">
                              {summary?.feedback ??
                                data.playbook_analysis?.funding_verdict ??
                                'Análisis Premium completado.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {data.score_breakdown && (
                      <div className="space-y-3">
                        <ScoreBreakdown data={data.score_breakdown} />
                        {isQuickMode && (
                          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-[#7C6FF7]/8 border border-[#7C6FF7]/20">
                            <svg className="w-4 h-4 text-[#A78BFA] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-[#A78BFA] leading-relaxed">
                                <strong className="text-[#C4BCFC]">Score parcial ({data.validation_score}/100).</strong>{' '}
                                Mercado, Competencia y Ejecución requieren más datos.{' '}
                                <button onClick={handleUpgradeToDetailed} className="underline font-semibold hover:text-[#C4BCFC] transition-colors">
                                  Completa el análisis Detallado para desbloquear tu score real →
                                </button>
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Widgets adicionales para rellenar y complementar la columna */}
                    <div className="flex flex-col gap-4 mt-2">
                      {summary && summary.strengths && <VerdictProsCons summary={summary} />}
                      {isQuickMode ? (
                        <QuickDimensionPaywall
                          dimension="Ejecución (15%)"
                          description="El Founder Fit y el análisis de equipo requieren los datos de tracción y composición del equipo fundador."
                          ideaData={data}
                        />
                      ) : (
                        <>
                          <VerdictFounderFit
                            data={data.founder_fit}
                            onGenerate={handleGenerateAdvanced}
                            generating={generatingAdvanced}
                          />
                          <VerdictMarketTiming
                            data={data.market_signals}
                            onGenerate={handleGenerateAdvanced}
                            generating={generatingAdvanced}
                          />
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Playbook Analysis / Alertas */}
                  <div className="md:col-span-5 flex flex-col gap-4">
                    <div className="h-full">
                      <PlaybookAnalysisCard data={data.playbook_analysis} />
                    </div>

                    <div className="flex justify-end mt-auto">
                      <button
                        onClick={() => {
                          setData((prev) => prev ? { ...prev, playbook_analysis: null } : prev);
                          setVerdictGenerated(false);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 transition"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Regenerar veredicto
                      </button>
                    </div>
                  </div>
                </>
              )}

              {!generatingVerdict && !data.playbook_analysis && verdictGenerated && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 flex flex-col items-center gap-4 text-center">
                  <p className="text-sm text-gray-400">No se pudo generar el veredicto.</p>
                  <button
                    onClick={() => setVerdictGenerated(false)}
                    className="px-4 py-2 bg-[#7C6FF7] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition"
                  >
                    Reintentar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── VALIDACIÓN ─────────────────────────────────────────────────── */}
          {activeTab === 'Validación' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">

              {/* Loading state */}
              {generatingVerdict && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-10 flex flex-col items-center gap-4 text-center">
                  <div className="w-10 h-10 border-4 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
                  <div>
                    <p className="font-bold text-[#F0EFF8] mb-1">Preparando tu guía de validación…</p>
                    <p className="text-sm text-[#8B8AA0]">Mom Test · Jobs-to-be-Done · Stack Legal Chile</p>
                  </div>
                </div>
              )}

              {!generatingVerdict && (
                <>
                  {/* 1 — Premisa de Validación: datos reales del Wizard */}
                  {(data.customer_segment || (data.customer_pain_points?.length ?? 0) > 0 || data.value_proposition || data.differentiator) && (
                    <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5">
                      <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wider mb-4 flex items-center gap-2">
                        <svg className="w-3.5 h-3.5 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Tu Premisa de Validación
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {data.customer_segment && (
                          <div>
                            <p className="text-[10px] font-bold text-[#8B8AA0] uppercase tracking-wider mb-1.5">Segmento Objetivo</p>
                            <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.customer_segment}</p>
                          </div>
                        )}
                        {data.value_proposition && (
                          <div>
                            <p className="text-[10px] font-bold text-[#8B8AA0] uppercase tracking-wider mb-1.5">Propuesta de Valor</p>
                            <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.value_proposition}</p>
                          </div>
                        )}
                        {(data.customer_pain_points?.length ?? 0) > 0 && (
                          <div className="sm:col-span-2">
                            <p className="text-[10px] font-bold text-[#8B8AA0] uppercase tracking-wider mb-2">Pain Points a Validar</p>
                            <ul className="space-y-1.5">
                              {data.customer_pain_points!.map((p, i) => (
                                <li key={i} className="flex items-start gap-2 text-sm text-[#C4C4D4]">
                                  <span className="text-[#F87171] shrink-0 mt-0.5">•</span>
                                  {p}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        {data.differentiator && (
                          <div className="sm:col-span-2">
                            <p className="text-[10px] font-bold text-[#8B8AA0] uppercase tracking-wider mb-1.5">Diferenciador Clave</p>
                            <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.differentiator}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 2 — JTBD Analysis */}
                  {data.playbook_analysis?.jtbd_analysis && (
                    <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wider">Jobs-to-be-Done real</p>
                      </div>
                      <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.jtbd_analysis}</p>
                    </div>
                  )}

                  {/* 3 — Mom Test Playbook */}
                  {(data.playbook_analysis?.validation_playbook?.length ?? 0) > 0 && (
                    <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-4">
                        <svg className="w-4 h-4 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wider">Mom Test — 3 Pasos de Validación</p>
                      </div>
                      <ol className="space-y-3">
                        {data.playbook_analysis!.validation_playbook.map((step, i) => (
                          <li key={i} className="flex gap-3">
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#7C6FF7] text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                            <p className="text-sm text-[#C4C4D4] leading-relaxed">{step}</p>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {/* 4 — Stack No-Code & Legal Chile */}
                  {data.playbook_analysis?.tech_and_legal_stack && (
                    <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wider">Stack No-Code &amp; Legal Chile</p>
                      </div>
                      <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.tech_and_legal_stack}</p>
                    </div>
                  )}

                  {/* 5 — Encuestas Mom Test */}
                  <div className="bg-[#12121A] border border-[#7C6FF7]/20 rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-[#A78BFA] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        <div>
                          <p className="text-sm font-bold text-[#F0EFF8] mb-1">Encuestas de Validación de Mercado</p>
                          <p className="text-xs text-[#8B8AA0] leading-relaxed">
                            Crea encuestas basadas en Mom Test para recopilar evidencia real de clientes. Los datos se anonimizan automáticamente con K-anonimato, L-diversidad y T-closeness antes de ingresar al data lake.
                          </p>
                        </div>
                      </div>
                      <Link
                        to="/surveys"
                        onClick={() => trackEncuestasCTAClicked({
                          tier: tier ?? 'free',
                          hasMomTest: (data.playbook_analysis?.validation_playbook?.length ?? 0) > 0,
                          hasJtbd: !!data.playbook_analysis?.jtbd_analysis,
                          validationId: data.id,
                        })}
                        className="flex-shrink-0 inline-flex items-center gap-2 bg-[#7C6FF7] hover:bg-[#6B5EE6] text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        Ver Encuestas
                      </Link>
                    </div>
                  </div>

                  {/* 6 — Evidencia de Mercado Externa */}
                  <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wide">Evidencia de Mercado</p>
                      {isPremium ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#7C6FF7]/10 text-[#A78BFA] border border-[#7C6FF7]/20">
                          En Desarrollo — Beta
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-[#8B8AA0] border border-white/10">
                          Premium
                        </span>
                      )}
                    </div>
                    {isPremium && agentLog ? (
                      <EvidenceWall agentLog={agentLog as any} />
                    ) : (
                      <div className="flex flex-col gap-3">
                        {[
                          { label: 'Señal Social — Reddit', desc: 'Discusiones reales de comunidades relacionadas con tu mercado.' },
                          { label: 'Tendencias de Búsqueda — Google Trends', desc: 'Volumen e interés histórico de búsquedas para tu keyword.' },
                        ].map((item) => (
                          <div key={item.label} className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-white/8 bg-white/[0.02]">
                            <div className="w-8 h-8 rounded-lg bg-[#7C6FF7]/10 flex items-center justify-center shrink-0">
                              <svg className="w-4 h-4 text-[#A78BFA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-[#C4C4D4]">{item.label}</p>
                              <p className="text-xs text-[#8B8AA0] mt-0.5">{item.desc}</p>
                            </div>
                            <span className="shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-full bg-[#7C6FF7]/10 text-[#A78BFA]">Premium</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── ESTRATEGIA ─────────────────────────────────────────────────── */}
          {activeTab === 'Estrategia' && (
            isProLocked ? (
              <LockedSection
                title="Estrategia"
                description="Plan GTM, análisis de mercado (TAM/SAM/SOM), SWOT y análisis competitivo."
                requiredTier="pro"
                hint="¿Cómo llegarás a tus primeros clientes y superarás a la competencia?"
              />
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* GTM & Growth Plan */}
              {data.playbook_analysis?.gtm_and_growth_plan && (
                <div className="md:col-span-6 bg-[#12121A] border border-white/[0.06] rounded-2xl p-5 h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                    </svg>
                    <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wider">Plan GTM y Crecimiento</p>
                    <span className="ml-auto text-[10px] font-semibold text-violet-400/70 bg-violet-500/10 border border-violet-500/15 rounded-md px-2 py-0.5 tracking-wide shrink-0">Insight IA</span>
                  </div>
                  <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.gtm_and_growth_plan}</p>
                </div>
              )}

              {/* Product & AI Strategy */}
              {data.playbook_analysis?.product_ai_strategy && (
                <div className="md:col-span-6 bg-[#12121A] border border-white/[0.06] rounded-2xl p-5 h-full">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wider">Estrategia de Producto e IA</p>
                    <span className="ml-auto text-[10px] font-semibold text-violet-400/70 bg-violet-500/10 border border-violet-500/15 rounded-md px-2 py-0.5 tracking-wide shrink-0">Insight IA</span>
                  </div>
                  <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.product_ai_strategy}</p>
                </div>
              )}

              {/* Market Sizing */}
              {isQuickMode ? (
                <div className="md:col-span-6 h-full">
                  <QuickDimensionPaywall
                    dimension="Mercado (20%)"
                    description="El tamaño de mercado (TAM/SAM/SOM) requiere datos de país, precio y segmento detallado."
                    ideaData={data}
                  />
                </div>
              ) : data.market_sizing ? (
                <div className="md:col-span-6 h-full">
                  <MarketFunnel data={data.market_sizing} />
                </div>
              ) : null}

              {/* SWOT */}
              {(summary?.strengths?.length || summary?.weaknesses?.length) ? (
                <div className="md:col-span-6 h-full flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-1">
                    <svg className="w-4 h-4 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h8m-8 6h16" />
                    </svg>
                    <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wider">Análisis SWOT</p>
                    <span className="ml-auto text-[10px] font-semibold text-violet-400/70 bg-violet-500/10 border border-violet-500/15 rounded-md px-2 py-0.5 tracking-wide shrink-0">Insight IA</span>
                  </div>
                  <SwotMatrix
                    strengths={summary?.strengths || []}
                    weaknesses={summary?.weaknesses || []}
                  />
                </div>
              ) : null}

              {/* Competitive Analysis */}
              {isQuickMode ? (
                <div className="md:col-span-12">
                  <QuickDimensionPaywall
                    dimension="Competencia (15%)"
                    description="El mapeo de competidores requiere la solución actual de incumbentes y el canal de adquisición."
                    ideaData={data}
                  />
                </div>
              ) : data.competitive_analysis ? (
                <div className="md:col-span-12 h-full">
                  <CompetitiveAnalysis data={data.competitive_analysis} />
                </div>
              ) : null}

              {/* Señales de Mercado */}
              <div className="md:col-span-12">
                {data.market_signals ? (
                  <MarketSignalsCard data={data.market_signals} />
                ) : !sections.includes('marketSizing') ? (
                  <LockedSection
                    title="Señales de Mercado"
                    description="Tendencias, rondas de inversión recientes y análisis de timing."
                    requiredTier="premium"
                    hint="¿Es el momento correcto para lanzar?"
                  />
                ) : null}
              </div>
            </div>
            )
          )}

          {/* ── FINANZAS ───────────────────────────────────────────────────── */}
          {activeTab === 'Finanzas' && (
            isProLocked ? (
              <LockedSection
                title="Finanzas"
                description="Unit Economics (CAC, LTV, break-even), proyecciones financieras y análisis de riesgos."
                requiredTier="pro"
                hint="¿Tiene sentido financiero tu modelo de negocio?"
              />
            ) : (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Unit Economics Check (RAG) */}
              {data.playbook_analysis?.unit_economics_check && (
                <div className="md:col-span-12 bg-[#12121A] border border-[#F7C56C]/20 rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[#F7C56C] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs font-bold text-[#F7C56C] uppercase tracking-wider">Diagnóstico de Unit Economics</p>
                  </div>
                  <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.unit_economics_check}</p>
                </div>
              )}

              {/* KPIs Finanzas (Grid 2x2 on mobile, 4 cols on desktop) */}
              {data.unit_economics ? (
                <div className="md:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-3">
                  <UnitEconomicsKpis data={data.unit_economics} />
                </div>
              ) : isQuickMode ? (
                <div className="md:col-span-12">
                  <QuickDimensionPaywall
                    dimension="Unit Economics"
                    description="CAC, LTV y break-even requieren datos de precio, segmento y canal de adquisición del análisis Detallado."
                    ideaData={data}
                  />
                </div>
              ) : !sections.includes('unitEconomics') ? (
                <div className="md:col-span-12">
                  <LockedSection
                    title="Unit Economics"
                    description="CAC, LTV, ratio LTV/CAC, break-even y churn estimado."
                    requiredTier="pro"
                    hint="Estimaciones financieras basadas en tu modelo de negocio"
                  />
                </div>
              ) : (
                <div className="md:col-span-12 flex flex-col items-center justify-center gap-4 py-10 bg-[#12121A] border border-white/[0.06] rounded-2xl text-center px-6">
                  <div className="w-10 h-10 rounded-full bg-[#F7C56C]/10 border border-[#F7C56C]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#F7C56C]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#F0EFF8] mb-1">Unit Economics no generados aún</p>
                    <p className="text-xs text-[#8B8AA0] max-w-xs mx-auto leading-relaxed">
                      CAC, LTV, break-even y proyección de crecimiento. Se genera con tus datos del análisis Detallado.
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateAdvanced}
                    disabled={generatingAdvanced}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#F7C56C] text-gray-900 text-xs font-bold rounded-xl hover:bg-[#F7C56C]/90 transition disabled:opacity-50"
                  >
                    {generatingAdvanced ? (
                      <span className="w-3.5 h-3.5 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    )}
                    {generatingAdvanced ? 'Generando…' : 'Generar Análisis Pro'}
                  </button>
                </div>
              )}

              {/* Chart & Risks */}
              {data.unit_economics && (
                <div className="md:col-span-6 h-full">
                  <UnitEconomicsChart data={data.unit_economics} />
                </div>
              )}

              <div className={data.unit_economics ? "md:col-span-6 h-full" : "md:col-span-12"}>
                {data.risk_analysis ? (
                  <div className="h-full">
                    <RiskAnalysisCard data={data.risk_analysis} />
                  </div>
                ) : isQuickMode ? (
                  <QuickDimensionPaywall
                    dimension="Análisis de Riesgos"
                    description="El análisis en 4 dimensiones (mercado, técnico, regulatorio y timing) requiere los datos del análisis Detallado."
                    ideaData={data}
                  />
                ) : !sections.includes('risks') ? (
                  <LockedSection
                    title="Análisis de Riesgos"
                    description="Score compuesto de riesgo en 4 dimensiones con mitigaciones concretas."
                    requiredTier="basic"
                    hint="Riesgo de mercado, técnico, regulatorio y timing"
                  />
                ) : null}
              </div>
            </div>
            )
          )}
          {/* ── HOJA DE RUTA ───────────────────────────────────────────────── */}
          {activeTab === 'Hoja de Ruta' && (
            isProLocked ? (
              <LockedSection
                title="Hoja de Ruta"
                description="MVP Kanban, roadmap de producto, stack técnico y próximos pasos priorizados."
                requiredTier="pro"
                hint="¿Cuáles son los 3 pasos exactos para lanzar tu MVP esta semana?"
              />
            ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Tech & Legal Stack (RAG) */}
              {data.playbook_analysis?.tech_and_legal_stack && (
                <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-4 h-4 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-xs font-bold text-[#8B8AA0] uppercase tracking-wider">Stack Técnico y Legal</p>
                    <span className="ml-auto text-[10px] font-semibold text-violet-400/70 bg-violet-500/10 border border-violet-500/15 rounded-md px-2 py-0.5 tracking-wide shrink-0">Insight IA</span>
                  </div>
                  <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.tech_and_legal_stack}</p>
                </div>
              )}

              {/* MVP Kanban */}
              <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5">
                <h3 className="text-sm font-bold text-[#C4C4D4] mb-4">Plan de MVP</h3>
                <div className="flex items-center gap-3 bg-[#7C6FF7]/10 border border-[#7C6FF7]/20 rounded-xl p-3 mb-4">
                  <svg className="w-5 h-5 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <div>
                    <p className="text-xs text-[#A78BFA] font-bold uppercase">Tipo</p>
                    <p className={`font-bold text-[#F0EFF8] capitalize ${!data.mvp_type ? 'italic opacity-70' : ''}`}>
                      {data.mvp_type ? data.mvp_type.replace(/_/g, ' ') : '(Ejemplo) Concierge MVP'}
                    </p>
                  </div>
                </div>
                <ErrorBoundary label="Plan de MVP">
                  <KanbanMVP features={data.mvp_features || []} userFlow={data.mvp_user_flow} />
                </ErrorBoundary>
              </div>

              {/* Próximos pasos */}
              {(summary?.next_steps?.length ?? 0) > 0 && (
                <NextStepsTimeline steps={summary!.next_steps} />
              )}

              {/* Regulatory Roadmap */}
              {data.target_country === 'Chile' && data.idea_industry && (
                <div className="bg-[#12121A] rounded-3xl border border-white/[0.06] p-6">
                  <RegulatoryRoadmap industry={data.idea_industry} />
                </div>
              )}

              {/* Deliverables */}
              <ErrorBoundary label="Entregables PDF">
                <DeliverableTabs
                  validationId={data.id}
                  unitEconomics={data.unit_economics}
                  context={{
                    idea_name: data.idea_name,
                    idea_description: data.idea_description,
                    idea_industry: data.idea_industry,
                    target_country: data.target_country,
                    target_region: data.target_region,
                    business_model: data.business_model,
                    business_stage: data.business_stage,
                    pricing_range: data.pricing_range,
                    customer_segment: data.customer_segment,
                    customer_pain_points: data.customer_pain_points,
                    value_proposition: data.value_proposition,
                    differentiator: data.differentiator,
                    mvp_type: data.mvp_type,
                    mvp_features: data.mvp_features,
                    mvp_user_flow: data.mvp_user_flow,
                    known_competitors: data.known_competitors,
                    questions_answers: data.questions_answers,
                    tech_level: data.tech_level,
                    validation_score: data.validation_score,
                  }}
                />
              </ErrorBoundary>
            </div>
            )
          )}

          {/* ── INVERSIÓN ──────────────────────────────────────────────────── */}
          {activeTab === 'Inversión' && (
            isProLocked ? (
              <LockedSection
                title="Inversión"
                description="Founder-Market Fit, gobernanza, fundraising roadmap, CORFO y Pitch Deck."
                requiredTier="pro"
                hint="¿Estás listo para buscar inversión? ¿Qué fondos deberías contactar?"
              />
            ) : (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Funding Verdict (RAG) */}
              {data.playbook_analysis?.funding_verdict && (
                <div className="bg-[#12121A] border border-[#34D399]/20 rounded-2xl p-5">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#34D399] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3" />
                      </svg>
                      <p className="text-xs font-bold text-[#34D399] uppercase tracking-wider">Veredicto de Inversión</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-violet-500/15 text-violet-400 rounded-full shrink-0">💡 Análisis IA</span>
                  </div>
                  <p className="text-sm text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.funding_verdict}</p>
                </div>
              )}

              {/* Perfil del Fundador (Sprint 1.5) */}
              {sections.includes('founderFit') && (
                <div className="bg-[#12121A] rounded-3xl border border-white/[0.06] p-6">
                  <h3 className="text-base font-bold text-[#F0EFF8] mb-4">
                    Perfil del Fundador
                  </h3>
                  <FounderProfileTab />
                </div>
              )}

              {/* Founder-Market Fit */}
              {data.founder_fit ? (
                <FounderFitCard data={data.founder_fit} />
              ) : !sections.includes('founderFit') ? (
                <LockedSection
                  title="Founder-Market Fit"
                  description="Qué tan bien posicionado estás para ejecutar esta idea."
                  requiredTier="pro"
                  hint="Score en 5 dimensiones: problema, industria, técnica, red, track record"
                />
              ) : null}

              {/* CORFO */}
              {data.target_country === 'Chile' && data.business_stage && data.idea_industry && (
                <div className="bg-[#12121A] rounded-3xl border border-white/[0.06] p-6">
                  <CorfoFunds
                    stage={data.business_stage}
                    industry={data.idea_industry}
                    businessModel={data.business_model ?? 'b2c'}
                    corfoProgram={data.fundraising_roadmap?.corfo_eligibility?.program}
                  />
                </div>
              )}

              {/* Gobernanza */}
              {data.governance_assessment ? (
                <GovernanceCard data={data.governance_assessment} />
              ) : !sections.includes('governance') ? (
                <LockedSection
                  title="Gobernanza y Estructura Legal"
                  description="Estructura societaria recomendada, vesting, cap table y checklist legal."
                  requiredTier="pro"
                  hint="Necesario para ser investible: SpA, vesting 4 años, cumplimiento Ley 21.719"
                />
              ) : (
                <div className="bg-[#0A0A0F] border-2 border-dashed border-white/10 rounded-2xl p-8 text-center">
                  <p className="text-sm text-[#8B8AA0] mb-3">Análisis de gobernanza no generado aún</p>
                  <button
                    onClick={handleGenerateAdvanced}
                    disabled={generatingAdvanced}
                    className="px-4 py-2 bg-[#7C6FF7] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition disabled:opacity-50"
                  >
                    {generatingAdvanced ? 'Generando...' : 'Generar Análisis Pro'}
                  </button>
                </div>
              )}

              {/* Fundraising Roadmap */}
              {data.fundraising_roadmap ? (
                <FundraisingRoadmapCard data={data.fundraising_roadmap} />
              ) : !sections.includes('fundraising') ? (
                <LockedSection
                  title="Estrategia de Fundraising"
                  description="Instrumento recomendado, ticket size, fondos LatAm y narrative del pitch."
                  requiredTier="premium"
                  hint="SAFE, Notas Convertibles o Ronda Valorizada según tu etapa"
                />
              ) : (
                <div className="bg-[#0A0A0F] border-2 border-dashed border-white/10 rounded-2xl p-8 text-center">
                  <p className="text-sm text-[#8B8AA0] mb-3">Hoja de ruta de fundraising no generada aún</p>
                  <button
                    onClick={handleGenerateAdvanced}
                    disabled={generatingAdvanced}
                    className="px-4 py-2 bg-[#34D399] text-[#0A0A0F] text-sm font-bold rounded-xl hover:bg-[#2BBD87] transition disabled:opacity-50"
                  >
                    {generatingAdvanced ? 'Generando...' : 'Generar Análisis Premium'}
                  </button>
                </div>
              )}

              {/* Pitch Deck Export */}
              <div className="bg-[#12121A] border border-white/[0.06] rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <svg className="w-4 h-4 text-[#A78BFA] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                      <p className="text-sm font-bold text-[#F0EFF8]">Investor Pitch Deck</p>
                      <span className="px-2 py-0.5 rounded-full bg-[#7C6FF7]/20 text-[#A78BFA] text-[10px] font-bold">8 slides</span>
                    </div>
                    <p className="text-xs text-[#8B8AA0]">
                      {data.pitch_deck_content ? 'Narrativa generada · listo para descargar' : 'Genera la narrativa de las 8 slides con IA y descarga el PDF'}
                    </p>
                  </div>
                  <button
                    onClick={handleExportPitchDeck}
                    disabled={pitchDeckLoading}
                    className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold rounded-xl transition disabled:opacity-50 shrink-0"
                  >
                    {pitchDeckLoading ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                    )}
                    {pitchDeckLoading ? 'Generando…' : 'Descargar Pitch Deck'}
                  </button>
                </div>
              </div>

              {/* Traction Tracker */}
              {sections.includes('governance') ? (
                <TractionTracker validationId={data.id} />
              ) : (
                <LockedSection
                  title="Traction Tracker"
                  description="Registra pre-orders, entrevistas, LOIs y señales de tracción real para mostrar a inversores."
                  requiredTier="pro"
                  hint="Los inversores piden tracción. Documenta cada señal."
                />
              )}

              {/* Mentor Recommendations */}
              <MentorRecommendations
                ideaDescription={data.idea_description}
                founderGaps={data.founder_fit?.gaps}
              />
            </div>
            )
          )}
          {/* ── DUE DILIGENCE ──────────────────────────────────────────────── */}
          {activeTab === 'Due Diligence' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {tier !== 'premium' ? (
                <LockedSection
                  title="Due Diligence Score"
                  description="Evaluación completa como si pasaras por el filtro de Paul Graham y fondos de Venture Capital."
                  requiredTier="premium"
                  hint="Consulta PJUD, Inapi y Fintoc. Análisis RAG con benchmarks de mercado."
                />
              ) : generatingDueDiligence ? (
                <div className="flex flex-col items-center gap-4 py-14 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#7C6FF7]/10 border-2 border-[#7C6FF7]/20 flex items-center justify-center animate-pulse">
                    <div className="w-7 h-7 border-4 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-[#F0EFF8] mb-1">
                      Ensamblando Mega-Prompt y Evaluando Due Diligence
                    </h3>
                    <p className="text-sm text-gray-400 dark:text-[#8B8AA0] max-w-sm leading-relaxed">
                      Consultando antecedentes en PJUD, Inapi y Fintoc, y analizando con el modelo RAG de Paul Graham. Esto tomará unos segundos...
                    </p>
                  </div>
                  {/* Skeletons de espera activa */}
                  <div className="w-full max-w-2xl mt-6 space-y-3">
                    <div className="h-16 bg-[#12121A] rounded-2xl animate-pulse" />
                    <div className="h-24 bg-[#12121A] rounded-2xl animate-pulse" />
                    <div className="h-16 bg-[#12121A] rounded-2xl animate-pulse" />
                  </div>
                </div>
              ) : data.due_diligence_score ? (
                <ErrorBoundary label="Due Diligence Score">
                  <DueDiligenceScoreCard
                    score={data.due_diligence_score}
                    extractedData={data.due_diligence_extracted}
                    dataWarnings={ddAuditTrail?.dataWarnings}
                    sourcesUsed={ddAuditTrail?.sourcesUsed}
                    sourcesSkipped={ddAuditTrail?.sourcesSkipped}
                    fromCache={ddAuditTrail?.fromCache}
                    verdictSummary={ddAuditTrail?.verdictSummary}
                  />
                </ErrorBoundary>
              ) : (
                <div className="flex flex-col items-center gap-4 py-14 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#7C6FF7]/10 border-2 border-[#7C6FF7]/20 flex items-center justify-center">
                    <svg className="w-7 h-7 text-[#7C6FF7]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-800 dark:text-[#F0EFF8] mb-1">
                      Due Diligence Score no generado
                    </h3>
                    <p className="text-sm text-gray-400 dark:text-[#8B8AA0] max-w-sm leading-relaxed mb-4">
                      Obtén tu evaluación completa como si pasaras por el filtro riguroso de Paul Graham y fondos de Venture Capital.
                    </p>
                    <button
                      onClick={handleGenerateDueDiligence}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7C6FF7] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition-colors shadow-lg shadow-[#7C6FF7]/25"
                    >
                      Generar Due Diligence (AI RAG)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Inline report feedback — Mom Test */}
      {data && (
        <div className="max-w-5xl mx-auto w-full px-4 sm:px-6 pb-6">
          {!reportFeedback ? (
            <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 shadow-sm">
              <p className="text-xs text-gray-500 dark:text-[#8B8AA0] flex-1 leading-snug">
                Para refinar nuestro RAG: ¿Tuviste que corregir algún dato de este reporte?
              </p>
              <div className="flex gap-2 flex-wrap shrink-0">
                {([
                  { label: 'Sí, la TAM', value: 'corrigió TAM' },
                  { label: 'Sí, los competidores', value: 'corrigió competidores' },
                  { label: 'Estaba listo para usar', value: 'listo para usar' },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setReportFeedback(opt.value);
                      trackTelemetryEvent({
                        event_name: 'micro_feedback',
                        context: {
                          tier: (tier ?? 'free') as 'free' | 'basic' | 'pro' | 'premium',
                          action_taken: opt.value,
                        },
                      });
                    }}
                    className="px-3 py-1.5 text-xs font-semibold bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#C4C4D4] rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-center text-gray-400 dark:text-[#4A495E]">
              ¡Gracias! Tu feedback mejora nuestros datos.
            </p>
          )}
        </div>
      )}

      {/* Modal contexto de mercado */}
      {showReanalyzeModal && data && (
        <ReanalyzeModal
          existing={{
            target_country: data.target_country ?? undefined,
            target_region: data.target_region ?? undefined,
            business_model: data.business_model as never ?? undefined,
            business_stage: data.business_stage as never ?? undefined,
            pricing_range: data.pricing_range ?? undefined,
            known_competitors: data.known_competitors ?? [],
          }}
          onSubmit={(ctx) => runReanalysis(
            ctx.target_country,
            ctx.target_region,
            ctx.business_model,
            ctx.business_stage,
            ctx.pricing_range,
            ctx.known_competitors ?? [],
            ctx.founderContext,
          )}
          onCancel={() => setShowReanalyzeModal(false)}
        />
      )}

      {/* Modal exportar PDFs */}
      {showPDFModal && data && (
        <PDFExportModal
          data={data}
          onClose={() => setShowPDFModal(false)}
          onDataUpdate={(updates) => setData(prev => prev ? { ...prev, ...updates } as ValidationFull : prev)}
          mentors={mentors}
        />
      )}

      {/* Modal Pivote */}
      {showPivotModal && data && (
        <PivotModal
          validationId={data.id}
          ideaName={data.idea_name}
          currentVersion={data.version || 1}
          onClose={() => setShowPivotModal(false)}
        />
      )}

      {/* Overlay análisis base */}
      {reanalyzing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#12121A] border border-white/[0.06] rounded-3xl px-8 py-7 shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center">
            <div className="w-12 h-12 border-4 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="font-bold text-[#F0EFF8] mb-1">Analizando mercado y competencia</p>
              <p className="text-sm text-[#8B8AA0]">Esto puede tomar unos segundos...</p>
            </div>
          </div>
        </div>
      )}

      {/* Overlay análisis avanzados */}
      {generatingAdvanced && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#12121A] border border-white/[0.06] rounded-3xl px-8 py-7 shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 border-4 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="font-bold text-[#F0EFF8] mb-1">Generando análisis avanzados</p>
              {advancedProgress ? (
                <p className="text-sm text-[#7C6FF7] font-semibold">{advancedProgress}</p>
              ) : (
                <p className="text-sm text-[#8B8AA0]">Iniciando...</p>
              )}
              <p className="text-xs text-[#4A495E] mt-2">No cierres ni recargues esta página.<br/>Puede tomar hasta 90 segundos en total.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
