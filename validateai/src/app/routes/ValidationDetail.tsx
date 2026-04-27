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
import { generateValidationPDF, PDF_THEMES } from '@/lib/pdf';
import type { PDFTheme } from '@/lib/pdf';
import { ReanalyzeModal } from '@/components/shared/ReanalyzeModal';
import { SwotMatrix } from '@/components/shared/SwotMatrix';
import { NextStepsTimeline } from '@/components/shared/NextStepsTimeline';
import { KanbanMVP } from '@/components/shared/KanbanMVP';
import { useAI } from '@/hooks/useAI';
import { useUserTier, getUserSections } from '@/hooks/useUserTier';
import type {
  MarketSizing,
  CompetitiveAnalysis as CompetitiveAnalysisType,
  ScoreBreakdown as ScoreBreakdownType,
  RiskAnalysis,
  UnitEconomics,
  FounderFit,
  MarketSignals,
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
  share_token: string | null;
  created_at: string;
  completed_at: string | null;
  version: number;
}


const DASHBOARD_TABS = ['Resumen Ejecutivo', 'Mercado y Competencia', 'Finanzas y Riesgos', 'Producto y Entrega', 'Equipo y Mentoría'] as const;
type DashboardTab = typeof DASHBOARD_TABS[number];

export function ValidationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [data, setData] = useState<ValidationFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [updatePdfLoading, setUpdatePdfLoading] = useState(false);
  const [, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [showReanalyzeModal, setShowReanalyzeModal] = useState(false);
  const [showPivotModal, setShowPivotModal] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [generatingAdvanced, setGeneratingAdvanced] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('Resumen Ejecutivo');
  const [pdfTheme, setPdfTheme] = useState<PDFTheme>(() => {
    return (localStorage.getItem('validateai_pdf_theme') as PDFTheme) ?? 'clean';
  });
  const { callAI } = useAI();
  const { tier } = useUserTier();
  const sections = getUserSections(tier);

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
    };
    fetch();
  }, [id, navigate]);

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
    risk:    !data?.risk_analysis    && sections.includes('risks'),
    unit:    !data?.unit_economics   && sections.includes('unitEconomics'),
    founder: !data?.founder_fit      && sections.includes('founderFit'),
    signals: !data?.market_signals   && sections.includes('marketSizing'),
  };
  const hasAdvancedToGenerate = Object.values(missingAdvanced).some(Boolean);

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

      const updates: Record<string, unknown> = {
        target_country, target_region, business_model, business_stage,
        pricing_range, known_competitors,
      };
      if (competitiveResult) updates.competitive_analysis = competitiveResult;
      if (sizingResult) updates.market_sizing = sizingResult;
      if (summaryResult) {
        updates.score_breakdown = summaryResult.score_breakdown;
        updates.validation_score = summaryResult.score;
        updates.ai_feedback = summaryResult.feedback;
        updates.summary_json = summaryResult;
      }

      const { error: saveError } = await supabase
        .from('validations').update(updates).eq('id', data.id);
      if (saveError) throw saveError;

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
          summary_json: summaryResult,
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

      const [riskResult, unitResult, founderResult, signalsResult] = await Promise.all([
        missingAdvanced.risk    ? callAI<RiskAnalysis>(data.id, 6, 'risk_analysis', ctx)    : Promise.resolve(null),
        missingAdvanced.unit    ? callAI<UnitEconomics>(data.id, 6, 'unit_economics', ctx)   : Promise.resolve(null),
        missingAdvanced.founder ? callAI<FounderFit>(data.id, 6, 'founder_fit', ctx)         : Promise.resolve(null),
        missingAdvanced.signals ? callAI<MarketSignals>(data.id, 6, 'market_signals', ctx)   : Promise.resolve(null),
      ]);

      const updates: Record<string, unknown> = {};
      if (riskResult)    updates.risk_analysis  = riskResult;
      if (unitResult)    updates.unit_economics = unitResult;
      if (founderResult) updates.founder_fit    = founderResult;
      if (signalsResult) updates.market_signals = signalsResult;

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase.from('validations').update(updates).eq('id', data.id);
        if (error) throw error;
        setData((prev) => prev ? { ...prev, ...updates } : prev);
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
      }, pdfTheme);

      toast.success('Análisis actualizado y PDF descargado');
    } catch {
      toast.error('No se pudo actualizar el PDF. Intenta de nuevo.');
    } finally {
      setUpdatePdfLoading(false);
    }
  };

  const handleExportPDF = async () => {
    if (!data) return;
    setPdfLoading(true);
    try {
      await generateValidationPDF({
        idea_name:             data.idea_name ?? undefined,
        idea_description:      data.idea_description ?? undefined,
        idea_industry:         data.idea_industry ?? undefined,
        target_country:        data.target_country ?? undefined,
        target_region:         data.target_region ?? undefined,
        business_model:        data.business_model ?? undefined,
        business_stage:        data.business_stage ?? undefined,
        pricing_range:         data.pricing_range ?? undefined,
        known_competitors:     data.known_competitors ?? undefined,
        questions_answers:     data.questions_answers ?? undefined,
        customer_segment:      data.customer_segment ?? undefined,
        customer_pain_points:  data.customer_pain_points ?? undefined,
        value_proposition:     data.value_proposition ?? undefined,
        differentiator:        data.differentiator ?? undefined,
        mvp_type:              data.mvp_type ?? undefined,
        mvp_features:          data.mvp_features ?? undefined,
        mvp_user_flow:         data.mvp_user_flow ?? undefined,
        summary:               (data.summary_json ?? {}) as Record<string, unknown>,
        market_sizing:         data.market_sizing ?? null,
        competitive_analysis:  data.competitive_analysis ?? null,
        score_breakdown:       data.score_breakdown ?? null,
        risk_analysis:         data.risk_analysis ?? null,
        unit_economics:        data.unit_economics ?? null,
        founder_fit:           data.founder_fit ?? null,
        market_signals:        data.market_signals ?? null,
      }, pdfTheme);
      toast.success('PDF descargado correctamente');
    } catch {
      toast.error('No se pudo generar el PDF.');
    } finally {
      setPdfLoading(false);
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
            <div className="flex flex-wrap items-center gap-2 shrink-0 relative z-20">
              {/* Botón Principal: Descargar PDF */}
              <button
                onClick={handleExportPDF}
                disabled={pdfLoading}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 active:scale-[0.98] transition disabled:opacity-50"
                title="Descargar PDF con los datos actuales"
              >
                {pdfLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                )}
                Descargar PDF
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
        <div className="flex bg-white dark:bg-[#12121A] rounded-xl border border-gray-200 dark:border-white/10 p-1 mb-6 overflow-x-auto hide-scrollbar shadow-sm">
          {DASHBOARD_TABS.map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
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
          {activeTab === 'Resumen Ejecutivo' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Score */}
              {summary && data.validation_score != null && (
                <div className={`rounded-3xl border-2 p-6 ${scoreBg}`}>
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <ScoreGauge score={data.validation_score} />
                    <div className="flex-1 text-center sm:text-left">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Análisis general</p>
                      <p className="text-gray-700 dark:text-[#C4C4D4] leading-relaxed text-sm">{summary.feedback}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Data Summary */}
              <div className="bg-gray-50 dark:bg-[#0A0A0F] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">Datos de la validación</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {[
                    { label: 'Segmento', value: data.customer_segment },
                    { label: 'Propuesta de valor', value: data.value_proposition },
                    { label: 'Diferenciador', value: data.differentiator },
                  ].filter((i) => i.value).map((item) => (
                    <div key={item.label} className="bg-white dark:bg-[#12121A] rounded-xl p-3 border border-gray-100 dark:border-white/5 shadow-sm">
                      <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
                      <p className="text-sm font-semibold text-gray-700 dark:text-[#C4C4D4] leading-snug">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Idea description */}
              {data.idea_description && (
                <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Descripción de la idea</p>
                  <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.idea_description}</p>
                </div>
              )}

              {/* Score breakdown */}
              {data.score_breakdown && <ScoreBreakdown data={data.score_breakdown} />}

              {/* Fortalezas y debilidades */}
              <SwotMatrix 
                strengths={summary?.strengths || []} 
                weaknesses={summary?.weaknesses || []} 
              />
              
              {/* Próximos pasos */}
              <NextStepsTimeline 
                steps={summary?.next_steps || []} 
              />
            </div>
          )}

          {activeTab === 'Mercado y Competencia' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Market sizing */}
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

              {/* Competitive analysis */}
              {data.competitive_analysis && <CompetitiveAnalysis data={data.competitive_analysis} />}
            </div>
          )}

          {activeTab === 'Finanzas y Riesgos' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
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

              {/* Unit Economics */}
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

              {/* CORFO Instruments */}
              {data.target_country === 'Chile' && data.business_stage && data.idea_industry && (
                <div className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                  <CorfoFunds
                    stage={data.business_stage}
                    industry={data.idea_industry}
                    businessModel={data.business_model ?? 'b2c'}
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'Producto y Entrega' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* MVP */}
              {/* MVP */}
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

                  <KanbanMVP 
                    features={data.mvp_features || []} 
                    userFlow={data.mvp_user_flow} 
                  />
                </div>

              {/* Regulatory Roadmap */}
              {data.target_country === 'Chile' && data.idea_industry && (
                <div className="bg-white dark:bg-[#12121A] rounded-3xl border border-gray-100 dark:border-white/5 p-6 shadow-sm">
                  <RegulatoryRoadmap industry={data.idea_industry} />
                </div>
              )}

              {/* Deliverable Tabs */}
              <DeliverableTabs
                validationId={data.id}
                context={{
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
                  mvp_type: data.mvp_type,
                  mvp_user_flow: data.mvp_user_flow,
                  validation_score: data.validation_score,
                }}
              />
            </div>
          )}

          {activeTab === 'Equipo y Mentoría' && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
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

              {/* Mentor Recommendations */}
              <MentorRecommendations
                ideaDescription={data.idea_description}
                founderGaps={data.founder_fit?.gaps}
              />
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
              <p className="text-sm text-gray-400">Riesgos · Unit Economics · Founder Fit · Señales de mercado</p>
              <p className="text-xs text-gray-300 mt-1">Puede tomar 15–30 segundos...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
