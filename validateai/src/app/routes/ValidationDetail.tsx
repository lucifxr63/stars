import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { MarketFunnel } from '@/components/shared/MarketFunnel';
import { CompetitiveAnalysis } from '@/components/shared/CompetitiveAnalysis';
import { ScoreBreakdown } from '@/components/shared/ScoreBreakdown';
import { RiskAnalysisCard } from '@/components/shared/RiskAnalysisCard';
import { UnitEconomicsCard } from '@/components/shared/UnitEconomicsCard';
import { FounderFitCard } from '@/components/shared/FounderFitCard';
import { MarketSignalsCard } from '@/components/shared/MarketSignalsCard';
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
import { useUserTier, getUserSections } from '@/hooks/useUserTier';
import { trackDeliverableDownloaded, trackTabView, trackValidationCompleted } from '@/hooks/useAnalytics';
import { useMentors } from '@/hooks/useMentors';
import { EvidenceWall } from '@/components/shared/EvidenceWall';
import { GovernanceCard } from '@/components/shared/GovernanceCard';
import { FundraisingRoadmapCard } from '@/components/shared/FundraisingRoadmapCard';
import { TractionTracker } from '@/components/shared/TractionTracker';
import { PlaybookAnalysisCard } from '@/components/shared/PlaybookAnalysisCard';
import { DueDiligenceScoreCard } from '@/components/shared/DueDiligenceScoreCard';
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
}


const DASHBOARD_TABS = ['Veredicto', 'Validación', 'Estrategia', 'Finanzas', 'Hoja de Ruta', 'Inversión', 'Due Diligence'] as const;
type DashboardTab = typeof DASHBOARD_TABS[number];

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

  // Auto-genera el veredicto la primera vez que el usuario ve la pestaña
  useEffect(() => {
    if (
      activeTab !== 'Veredicto' ||
      !data ||
      data.playbook_analysis ||
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
          idea_name: data.idea_name,
          idea_description: data.idea_description,
          idea_industry: data.idea_industry,
          target_country: data.target_country,
          business_model: data.business_model,
          business_stage: data.business_stage,
          pricing_range: data.pricing_range,
          customer_segment: data.customer_segment,
          value_proposition: data.value_proposition,
          differentiator: data.differentiator,
          questions_answers: data.questions_answers,
          current_solution: data.current_solution,
          acquisition_channel: data.acquisition_channel,
          tech_level: data.tech_level,
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
  }, [activeTab, data?.id, data?.playbook_analysis]);

  const needsContextModal = !data?.target_country || !data?.business_model
    || !data?.business_stage || !data?.pricing_range;

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

      const [riskResult, unitResult, founderResult, signalsResult, governanceResult, fundraisingResult] = await Promise.all([
        missingAdvanced.risk        ? callAI<RiskAnalysis>(data.id, 6, 'risk_analysis', ctx)              : Promise.resolve(null),
        missingAdvanced.unit        ? callAI<UnitEconomics>(data.id, 6, 'unit_economics', ctx)             : Promise.resolve(null),
        missingAdvanced.founder     ? callAI<FounderFit>(data.id, 6, 'founder_fit', ctx)                   : Promise.resolve(null),
        missingAdvanced.signals     ? callAI<MarketSignals>(data.id, 6, 'market_signals', ctx)             : Promise.resolve(null),
        missingAdvanced.governance  ? callAI<GovernanceAssessment>(data.id, 6, 'governance_assessment', ctx) : Promise.resolve(null),
        missingAdvanced.fundraising ? callAI<FundraisingRoadmap>(data.id, 6, 'fundraising_roadmap', ctx)   : Promise.resolve(null),
      ]);

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
    }
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
      <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">
        <Header />
        <div className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-6 animate-pulse">
              <div className="h-4 bg-gray-100 dark:bg-white/5 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-100 dark:bg-white/5 rounded w-2/3" />
            </div>
          ))}
        </div>
        <Footer />
      </div>
    );
  }

  if (!data) return null;

  const summary = data.summary_json;
  const isGood = (data.validation_score ?? 0) >= 70;
  const isMid = (data.validation_score ?? 0) >= 40;
  const scoreBg = isGood
    ? 'bg-green-50 border-green-200 dark:bg-green-500/10 dark:border-green-500/20 shadow-sm shadow-green-500/10'
    : isMid
    ? 'bg-amber-50 border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 shadow-sm shadow-amber-500/10'
    : 'bg-red-50 border-red-200 dark:bg-red-500/10 dark:border-red-500/20 shadow-sm shadow-red-500/10';


  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A0A0F] flex flex-col">
      <Header />

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 md:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
          <Link to="/results" className="hover:text-teal-600 transition">Mis validaciones</Link>
          <span>›</span>
          <span className="text-gray-700 dark:text-[#C4C4D4] font-medium truncate">{data.idea_name ?? 'Sin nombre'}</span>
        </div>

        {/* Banner: Nuevos módulos disponibles */}
        {hasNewModulesToGenerate && !generatingNewModules && (
          <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/25">
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">✦</span>
              <div>
                <p className="text-sm font-bold text-teal-800 dark:text-teal-300">Nuevos módulos disponibles</p>
                <p className="text-xs text-teal-700/80 dark:text-teal-400/80 mt-0.5">
                  Haz clic en <strong>Re-analizar Idea</strong> para generar tu Roadmap Legal, Financiero y de MVP con la versión más reciente de la IA.
                </p>
              </div>
            </div>
            <button
              onClick={handleGenerateNewModules}
              className="shrink-0 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition"
            >
              Re-analizar Idea
            </button>
          </div>
        )}
        {generatingNewModules && (
          <div className="mb-4 flex items-center gap-3 p-4 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/25">
            <span className="animate-spin text-teal-600">⏳</span>
            <p className="text-sm font-bold text-teal-700 dark:text-teal-300">Generando nuevos módulos con la IA más reciente...</p>
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
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 text-xs font-bold text-blue-700 dark:text-blue-400">
                    <span className="text-[10px]">🌍</span> {data.target_country}
                  </span>
                )}
                {data.business_model && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-xs font-bold text-purple-700 dark:text-purple-400 capitalize">
                    <span className="text-[10px]">💼</span> {data.business_model.replace(/_/g, ' ')}
                  </span>
                )}
                {data.pricing_range && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                    <span className="text-[10px]">💰</span> {data.pricing_range}
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
                className="flex items-center justify-center gap-1.5 px-3 py-2 border-2 border-teal-200 dark:border-teal-500/30 text-teal-600 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-500/5 text-xs font-bold rounded-xl hover:bg-teal-50 dark:hover:bg-teal-500/10 active:scale-[0.98] transition disabled:opacity-50"
              >
                {sharing ? (
                  <div className="w-3.5 h-3.5 border-2 border-teal-400/40 border-t-teal-500 rounded-full animate-spin" />
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
                <summary className="flex items-center justify-center gap-1.5 h-9 px-3 border-2 border-gray-200 dark:border-white/10 text-gray-700 dark:text-[#F0EFF8] bg-white dark:bg-[#1A1A24] rounded-xl text-xs font-bold hover:bg-gray-50 dark:hover:bg-white/5 transition cursor-pointer list-none [&::-webkit-details-marker]:hidden outline-none focus:ring-2 focus:ring-teal-500/50">
                  ⚙️ Opciones <span className="group-open:rotate-180 transition-transform opacity-50">▾</span>
                </summary>
                
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1A1A24] rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 dark:border-white/10 p-2 flex flex-col gap-1 z-50">
                  
                  {/* Tema del PDF */}
                  <div className="px-3 py-2.5 border-b border-gray-100 dark:border-white/5 mb-1 bg-gray-50/50 dark:bg-[#0A0A0F]/50 rounded-lg">
                    <p className="text-[10px] font-black uppercase tracking-wider text-gray-500 dark:text-[#8B8AA0] mb-2">Tema del PDF</p>
                    <div className="flex gap-1.5">
                      {PDF_THEMES.map((t) => {
                        const isActive = pdfTheme === t.id;
                        const swatches: Record<string, string> = {
                          dark:     'bg-slate-900',
                          clean:    'bg-white border border-gray-200',
                          gradient: 'bg-gradient-to-r from-teal-400 to-blue-700',
                        };
                        return (
                          <button
                            key={t.id}
                            onClick={() => handleThemeChange(t.id)}
                            title={t.label}
                            className={`flex-1 flex justify-center py-1.5 rounded-lg border transition-all ${
                              isActive
                                ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10'
                                : 'border-gray-200 dark:border-white/10 hover:border-teal-300'
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
                    <button onClick={handleReanalyzeClick} disabled={reanalyzing} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-xs font-bold text-gray-700 dark:text-[#F0EFF8] text-left transition disabled:opacity-50">
                      <span className="w-4 h-4 text-center">{reanalyzing ? '⏳' : '🔄'}</span>
                      {reanalyzing ? 'Analizando...' : 'Actualizar Datos IA'}
                    </button>
                  )}
                  
                  {hasAdvancedToGenerate && (
                    <button onClick={handleGenerateAdvanced} disabled={generatingAdvanced} className="flex items-center gap-2 px-3 py-2 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-xl text-xs font-bold text-purple-700 dark:text-purple-400 text-left transition disabled:opacity-50">
                      <span className="w-4 h-4 text-center">{generatingAdvanced ? '⏳' : '✦'}</span>
                      {generatingAdvanced ? 'Generando...' : 'Generar Análisis Pro'}
                    </button>
                  )}

                  <button onClick={handleUpdateAndExportPDF} disabled={updatePdfLoading} className="flex items-center gap-2 px-3 py-2 hover:bg-teal-50 dark:hover:bg-teal-500/10 rounded-xl text-xs font-bold text-teal-700 dark:text-teal-400 text-left transition disabled:opacity-50">
                    <span className="w-4 h-4 text-center">{updatePdfLoading ? '⏳' : '📥'}</span>
                    {updatePdfLoading ? 'Actualizando PDF...' : 'PDF Fresco (Act. + PDF)'}
                  </button>

                  <div className="h-px bg-gray-100 dark:bg-white/5 my-1" />

                  {/* Acciones de Versión */}
                  <button onClick={() => { setShowPivotModal(true); document.querySelector('details[open]')?.removeAttribute('open'); }} className="flex items-center gap-2 px-3 py-2 hover:bg-amber-50 dark:hover:bg-amber-500/10 rounded-xl text-xs font-bold text-amber-700 dark:text-amber-400 text-left transition">
                    <span className="w-4 h-4 text-center">🔀</span>
                    Pivotar Idea
                  </button>
                  
                  <Link to={`/results/${id}/history`} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl text-xs font-bold text-gray-600 dark:text-[#8B8AA0] transition">
                    <span className="w-4 h-4 text-center">🕒</span>
                    Historial de Versiones
                  </Link>
                </div>
              </details>
            </div>
          </div>
        </div>

        {/* TABS NAVIGATION */}
        {/* Mobile: select dropdown */}
        <div className="sm:hidden mb-6">
          <select
            value={activeTab}
            onChange={(e) => { setActiveTab(e.target.value as DashboardTab); trackTabView(e.target.value); }}
            className="w-full px-4 py-2.5 bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-semibold text-gray-800 dark:text-[#F0EFF8] shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/40"
          >
            {DASHBOARD_TABS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        {/* Desktop: tab buttons */}
        <div className="hidden sm:flex bg-white dark:bg-[#12121A] rounded-xl border border-gray-200 dark:border-white/10 p-1 mb-6 overflow-x-auto hide-scrollbar shadow-sm">
          {DASHBOARD_TABS.map((t) => (
            <button
              key={t}
              onClick={() => { setActiveTab(t); trackTabView(t); }}
              className={`flex-1 min-w-[max-content] px-4 py-2 text-sm font-bold rounded-lg transition-all duration-200 ${
                activeTab === t
                  ? 'bg-teal-50 text-teal-700 shadow-sm border border-teal-100'
                  : 'text-gray-500 hover:text-gray-800 dark:text-[#F0EFF8] hover:bg-gray-50 dark:bg-[#0A0A0F] border border-transparent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="space-y-5">

          {/* ── VEREDICTO ──────────────────────────────────────────────────── */}
          {activeTab === 'Veredicto' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {generatingVerdict && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-10 flex flex-col items-center gap-4 text-center">
                  <div className="w-10 h-10 border-4 border-violet-500 border-t-transparent rounded-full animate-spin" />
                  <div>
                    <p className="font-bold text-white mb-1">Analizando tu idea con el Playbook VC…</p>
                    <p className="text-sm text-gray-400">Mom Test · JTBD · Unit Economics · Legal Chile</p>
                  </div>
                </div>
              )}

              {!generatingVerdict && data.playbook_analysis && (
                <>
                  <div className="rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-3 flex items-center gap-3">
                    <span className="text-violet-400 text-lg shrink-0">⚡</span>
                    <p className="text-xs text-violet-300 leading-relaxed">
                      <strong className="text-violet-200">Veredicto VC</strong> — Análisis generado con los Playbooks de Validación, Economics, Legal Chile y Tech Stack. Sin filtros de cortesía.
                    </p>
                  </div>

                  {/* Score */}
                  {summary && data.validation_score != null && (
                    <div className={`rounded-3xl border-2 p-6 ${scoreBg}`}>
                      <div className="flex flex-col sm:flex-row items-center gap-6">
                        <ScoreGauge score={data.playbook_analysis.viability_score ?? data.validation_score} />
                        <div className="flex-1 text-center sm:text-left">
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Score de Viabilidad VC</p>
                          <p className="text-gray-700 dark:text-[#C4C4D4] leading-relaxed text-sm">{summary.feedback}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {data.score_breakdown && <ScoreBreakdown data={data.score_breakdown} />}

                  <PlaybookAnalysisCard data={data.playbook_analysis} />

                  <div className="flex justify-end">
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
                </>
              )}

              {!generatingVerdict && !data.playbook_analysis && verdictGenerated && (
                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 flex flex-col items-center gap-4 text-center">
                  <p className="text-sm text-gray-400">No se pudo generar el veredicto.</p>
                  <button
                    onClick={() => setVerdictGenerated(false)}
                    className="px-4 py-2 bg-violet-600 text-white text-sm font-bold rounded-xl hover:bg-violet-700 transition"
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
              {/* JTBD Analysis */}
              {data.playbook_analysis?.jtbd_analysis && (
                <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🎯</span>
                    <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider">Jobs-to-be-Done</p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.jtbd_analysis}</p>
                </div>
              )}

              {/* Mom Test Playbook */}
              {(data.playbook_analysis?.validation_playbook?.length ?? 0) > 0 && (
                <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">📋</span>
                    <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider">Mom Test — Pasos de Validación</p>
                  </div>
                  <ol className="space-y-3">
                    {data.playbook_analysis!.validation_playbook.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-teal-500 text-white text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Evidence Wall — Premium */}
              {isPremium && agentLog && (
                <>
                  {agentLog.executive_summary && (
                    <div className="rounded-2xl border-2 border-[#7C6FF7]/30 bg-[#7C6FF7]/5 p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-6 h-6 rounded-full bg-[#7C6FF7] flex items-center justify-center shrink-0">
                          <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <p className="text-xs font-bold text-[#7C6FF7] uppercase tracking-widest">Resumen Ejecutivo Premium</p>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{agentLog.executive_summary}</p>
                    </div>
                  )}
                  <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">Evidencia de Mercado</p>
                    <EvidenceWall agentLog={agentLog as any} />
                  </div>
                </>
              )}

              {!data.playbook_analysis && !generatingVerdict && (
                <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#0A0A0F] p-8 text-center">
                  <p className="text-sm text-gray-400 mb-2">El análisis de validación se genera en la pestaña <strong>Veredicto</strong>.</p>
                </div>
              )}
            </div>
          )}

          {/* ── ESTRATEGIA ─────────────────────────────────────────────────── */}
          {activeTab === 'Estrategia' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* GTM & Growth Plan */}
              {data.playbook_analysis?.gtm_and_growth_plan && (
                <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🚀</span>
                    <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider">Plan GTM y Crecimiento</p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.gtm_and_growth_plan}</p>
                </div>
              )}

              {/* Product & AI Strategy */}
              {data.playbook_analysis?.product_ai_strategy && (
                <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🤖</span>
                    <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider">Estrategia de Producto e IA</p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.product_ai_strategy}</p>
                </div>
              )}

              {/* Market Sizing */}
              {data.market_sizing && <MarketFunnel data={data.market_sizing} />}

              {/* Señales de Mercado */}
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

              {/* SWOT */}
              {(summary?.strengths?.length || summary?.weaknesses?.length) && (
                <SwotMatrix
                  strengths={summary?.strengths || []}
                  weaknesses={summary?.weaknesses || []}
                />
              )}

              {/* Competitive Analysis */}
              {data.competitive_analysis && <CompetitiveAnalysis data={data.competitive_analysis} />}
            </div>
          )}

          {/* ── FINANZAS ───────────────────────────────────────────────────── */}
          {activeTab === 'Finanzas' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Unit Economics Check (RAG) */}
              {data.playbook_analysis?.unit_economics_check && (
                <div className="bg-white dark:bg-[#12121A] border-2 border-amber-100 dark:border-amber-500/20 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">💰</span>
                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Diagnóstico de Unit Economics</p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.unit_economics_check}</p>
                </div>
              )}

              {/* Unit Economics detallado */}
              {data.unit_economics ? (
                <UnitEconomicsCard data={data.unit_economics} />
              ) : !sections.includes('unitEconomics') ? (
                <LockedSection
                  title="Unit Economics"
                  description="CAC, LTV, ratio LTV/CAC, break-even y churn estimado."
                  requiredTier="pro"
                  hint="Estimaciones financieras basadas en tu modelo de negocio"
                />
              ) : null}

              {/* Análisis de Riesgos */}
              {data.risk_analysis ? (
                <RiskAnalysisCard data={data.risk_analysis} />
              ) : !sections.includes('risks') ? (
                <LockedSection
                  title="Análisis de Riesgos"
                  description="Score compuesto de riesgo en 4 dimensiones con mitigaciones concretas."
                  requiredTier="basic"
                  hint="Riesgo de mercado, técnico, regulatorio y timing"
                />
              ) : null}
            </div>
          )}

          {/* ── HOJA DE RUTA ───────────────────────────────────────────────── */}
          {activeTab === 'Hoja de Ruta' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Tech & Legal Stack (RAG) */}
              {data.playbook_analysis?.tech_and_legal_stack && (
                <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">⚙️</span>
                    <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider">Stack Técnico y Legal</p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.tech_and_legal_stack}</p>
                </div>
              )}

              {/* MVP Kanban */}
              <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                <h3 className="text-sm font-bold text-gray-700 dark:text-[#C4C4D4] mb-4">Plan de MVP</h3>
                <div className="flex items-center gap-3 bg-teal-50 border border-teal-200 dark:bg-teal-500/10 dark:border-teal-500/20 rounded-xl p-3 mb-4">
                  <span className="text-xl">🚀</span>
                  <div>
                    <p className="text-xs text-teal-600 dark:text-teal-400 font-bold uppercase">Tipo</p>
                    <p className={`font-bold text-gray-900 dark:text-[#F0EFF8] capitalize ${!data.mvp_type ? 'italic opacity-70' : ''}`}>
                      {data.mvp_type ? data.mvp_type.replace(/_/g, ' ') : '(Ejemplo) Concierge MVP'}
                    </p>
                  </div>
                </div>
                <KanbanMVP features={data.mvp_features || []} userFlow={data.mvp_user_flow} />
              </div>

              {/* Próximos pasos */}
              {(summary?.next_steps?.length ?? 0) > 0 && (
                <NextStepsTimeline steps={summary!.next_steps} />
              )}

              {/* Regulatory Roadmap */}
              {data.target_country === 'Chile' && data.idea_industry && (
                <div className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                  <RegulatoryRoadmap industry={data.idea_industry} />
                </div>
              )}

              {/* Deliverables */}
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
            </div>
          )}

          {/* ── INVERSIÓN ──────────────────────────────────────────────────── */}
          {activeTab === 'Inversión' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Funding Verdict (RAG) */}
              {data.playbook_analysis?.funding_verdict && (
                <div className="bg-white dark:bg-[#12121A] border-2 border-emerald-100 dark:border-emerald-500/20 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">🏦</span>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Veredicto de Inversión</p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.playbook_analysis.funding_verdict}</p>
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
                <div className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                  <CorfoFunds
                    stage={data.business_stage}
                    industry={data.idea_industry}
                    businessModel={data.business_model ?? 'b2c'}
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
                <div className="bg-gray-50 dark:bg-[#0A0A0F] border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-8 text-center">
                  <p className="text-sm text-gray-400 mb-3">Análisis de gobernanza no generado aún</p>
                  <button
                    onClick={handleGenerateAdvanced}
                    disabled={generatingAdvanced}
                    className="px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
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
                <div className="bg-gray-50 dark:bg-[#0A0A0F] border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl p-8 text-center">
                  <p className="text-sm text-gray-400 mb-3">Hoja de ruta de fundraising no generada aún</p>
                  <button
                    onClick={handleGenerateAdvanced}
                    disabled={generatingAdvanced}
                    className="px-4 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {generatingAdvanced ? 'Generando...' : 'Generar Análisis Premium'}
                  </button>
                </div>
              )}

              {/* Pitch Deck Export */}
              <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">🎯</span>
                      <p className="text-sm font-bold text-gray-800 dark:text-[#F0EFF8]">Investor Pitch Deck</p>
                      <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400 text-[10px] font-bold">8 slides</span>
                    </div>
                    <p className="text-xs text-gray-400 dark:text-[#8B8AA0]">
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
          )}
          {/* ── DUE DILIGENCE ──────────────────────────────────────────────── */}
          {activeTab === 'Due Diligence' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {data.due_diligence_score ? (
                <DueDiligenceScoreCard
                  score={data.due_diligence_score}
                  extractedData={data.due_diligence_extracted}
                />
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
                    <p className="text-sm text-gray-400 dark:text-[#8B8AA0] max-w-sm leading-relaxed">
                      Sube tu Pitch Deck o Business Plan en el flujo de validación para obtener tu score automatizado de preparación para ronda.
                    </p>
                  </div>
                  <a
                    href="/validate"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#7C6FF7] text-white text-sm font-bold rounded-xl hover:bg-[#6B5EE6] transition-colors shadow-lg shadow-[#7C6FF7]/25"
                  >
                    Subir documento →
                  </a>
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      <Footer />

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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#12121A] rounded-3xl px-8 py-7 shadow-2xl flex flex-col items-center gap-4 max-w-xs text-center">
            <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">Analizando mercado y competencia</p>
              <p className="text-sm text-gray-400">Esto puede tomar unos segundos...</p>
            </div>
          </div>
        </div>
      )}

      {/* Overlay análisis avanzados */}
      {generatingAdvanced && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#12121A] rounded-3xl px-8 py-7 shadow-2xl flex flex-col items-center gap-4 max-w-sm text-center">
            <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="font-bold text-gray-900 dark:text-[#F0EFF8] mb-1">Generando análisis avanzados</p>
              <p className="text-sm text-gray-400">Riesgos · Unit Economics · Founder Fit · Señales · Gobernanza · Fundraising</p>
              <p className="text-xs text-gray-300 mt-1">Puede tomar 15–30 segundos...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
