import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAI } from '@/hooks/useAI';
import {
  generatePremiumPDF,
  generatePitchDeckPDF,
  generateLeanRoadmapPDF,
  generateUnitEconomicsPDF,
  generateCompliancePDF,
} from '@/lib/pdf';
import type {
  MarketSizing,
  CompetitiveAnalysis,
  ScoreBreakdown,
  RiskAnalysis,
  UnitEconomics,
  FounderFit,
  MarketSignals,
  GovernanceAssessment,
  FundraisingRoadmap,
  PlaybookAnalysis,
  DueDiligenceScore,
  PitchDeckContent,
  LeanRoadmap,
  FinancialProjection,
  ComplianceRoadmap,
} from '@/types/validation';

interface ValidationData {
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
  summary_json: Record<string, unknown> | null;
  validation_score: number | null;
  market_sizing: MarketSizing | null;
  competitive_analysis: CompetitiveAnalysis | null;
  score_breakdown: ScoreBreakdown | null;
  risk_analysis: RiskAnalysis | null;
  unit_economics: UnitEconomics | null;
  founder_fit: FounderFit | null;
  market_signals: MarketSignals | null;
  governance_assessment: GovernanceAssessment | null;
  fundraising_roadmap: FundraisingRoadmap | null;
  playbook_analysis: PlaybookAnalysis | null;
  due_diligence_score: DueDiligenceScore | null;
  pitch_deck_content: PitchDeckContent | null;
  lean_roadmap: LeanRoadmap | null;
  financial_projection: FinancialProjection | null;
  compliance_roadmap: ComplianceRoadmap | null;
  tech_level: string | null;
}

interface Props {
  data: ValidationData;
  onClose: () => void;
  onDataUpdate: (updates: Partial<ValidationData>) => void;
  mentors?: { name: string; bio: string | null; expertise: string[]; session_price_clp: number | null }[];
}

type DocId = 'dossier' | 'pitch_deck' | 'lean_roadmap' | 'financial_projection' | 'compliance_roadmap';

interface DocConfig {
  id: DocId;
  icon: string;
  label: string;
  sublabel: string;
  description: string;
  accent: string;
  accentBg: string;
  promptType?: string;
  dataKey?: keyof ValidationData;
}

const DOCS: DocConfig[] = [
  {
    id: 'dossier',
    icon: '📋',
    label: 'Investment Dossier',
    sublabel: '6 páginas · Oscuro',
    description: 'Reporte completo de validación con score, mercado, competencia, financials y due diligence.',
    accent: 'text-teal-600 dark:text-teal-400',
    accentBg: 'bg-teal-50 dark:bg-teal-500/10 border-teal-200 dark:border-teal-500/30',
  },
  {
    id: 'pitch_deck',
    icon: '🎯',
    label: 'Investor Pitch Deck',
    sublabel: '8 slides · Landscape',
    description: 'Estructura estilo Silicon Valley/Antler con hook, problema, solución, mercado y the ask.',
    accent: 'text-violet-600 dark:text-violet-400',
    accentBg: 'bg-violet-50 dark:bg-violet-500/10 border-violet-200 dark:border-violet-500/30',
    promptType: 'pitch_deck',
    dataKey: 'pitch_deck_content',
  },
  {
    id: 'lean_roadmap',
    icon: '🗺️',
    label: 'Lean Roadmap MVP',
    sublabel: '2 páginas · Sprints',
    description: 'Plan táctico de 3 sprints con stack recomendado (No-Code / Full Code) y costos estimados.',
    accent: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30',
    promptType: 'lean_roadmap',
    dataKey: 'lean_roadmap',
  },
  {
    id: 'financial_projection',
    icon: '📊',
    label: 'Unit Economics & Growth',
    sublabel: '2 páginas · 12 meses',
    description: 'Proyección MRR, cashflow mensual, CAC/LTV y veredicto sobre la viabilidad del modelo.',
    accent: 'text-blue-600 dark:text-blue-400',
    accentBg: 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/30',
    promptType: 'financial_projection',
    dataKey: 'financial_projection',
  },
  {
    id: 'compliance_roadmap',
    icon: '⚖️',
    label: 'Compliance Chile',
    sublabel: '3 páginas · Legal',
    description: 'Constitución SpA, normativas aplicables (Ley Fintech, Datos), pacto de accionistas y vesting.',
    accent: 'text-amber-600 dark:text-amber-400',
    accentBg: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30',
    promptType: 'compliance_roadmap',
    dataKey: 'compliance_roadmap',
  },
];

export function PDFExportModal({ data, onClose, onDataUpdate, mentors = [] }: Props) {
  const [loadingId, setLoadingId] = useState<DocId | null>(null);
  const { callAI } = useAI();

  const buildBasePayload = () => ({
    idea_name:            data.idea_name ?? undefined,
    idea_description:     data.idea_description ?? undefined,
    idea_industry:        data.idea_industry ?? undefined,
    target_country:       data.target_country ?? undefined,
    target_region:        data.target_region ?? undefined,
    business_model:       data.business_model ?? undefined,
    business_stage:       data.business_stage ?? undefined,
    pricing_range:        data.pricing_range ?? undefined,
    known_competitors:    data.known_competitors ?? undefined,
    questions_answers:    data.questions_answers ?? undefined,
    customer_segment:     data.customer_segment ?? undefined,
    customer_pain_points: data.customer_pain_points ?? undefined,
    value_proposition:    data.value_proposition ?? undefined,
    differentiator:       data.differentiator ?? undefined,
    mvp_type:             data.mvp_type ?? undefined,
    mvp_features:         data.mvp_features ?? undefined,
    mvp_user_flow:        data.mvp_user_flow ?? undefined,
    summary:              (data.summary_json ?? {}) as Record<string, unknown>,
    market_sizing:        data.market_sizing ?? null,
    competitive_analysis: data.competitive_analysis ?? null,
    score_breakdown:      data.score_breakdown ?? null,
    risk_analysis:        data.risk_analysis ?? null,
    unit_economics:       data.unit_economics ?? null,
    founder_fit:          data.founder_fit ?? null,
    market_signals:       data.market_signals ?? null,
    governance_assessment: data.governance_assessment ?? null,
    fundraising_roadmap:  data.fundraising_roadmap ?? null,
    playbook_analysis:    data.playbook_analysis ?? null,
    validation_score:     data.validation_score ?? null,
    due_diligence:        data.due_diligence_score ?? null,
    mentors:              mentors.length ? mentors : undefined,
    pitch_deck_content:   data.pitch_deck_content ?? null,
    lean_roadmap:         data.lean_roadmap ?? null,
    financial_projection: data.financial_projection ?? null,
    compliance_roadmap:   data.compliance_roadmap ?? null,
  });

  const buildAICtx = () => ({
    idea_name:            data.idea_name,
    idea_description:     data.idea_description,
    idea_industry:        data.idea_industry,
    target_country:       data.target_country,
    target_region:        data.target_region,
    business_model:       data.business_model,
    business_stage:       data.business_stage,
    pricing_range:        data.pricing_range,
    known_competitors:    data.known_competitors ?? [],
    customer_segment:     data.customer_segment,
    customer_pain_points: data.customer_pain_points,
    value_proposition:    data.value_proposition,
    differentiator:       data.differentiator,
    questions_answers:    data.questions_answers,
    mvp_type:             data.mvp_type,
    mvp_features:         data.mvp_features,
    tech_level:           data.tech_level,
  });

  const handleDownload = async (doc: DocConfig) => {
    if (loadingId) return;
    setLoadingId(doc.id);

    try {
      const base = buildBasePayload();

      if (doc.id === 'dossier') {
        await generatePremiumPDF(base);
        toast.success('Investment Dossier descargado');
        return;
      }

      // For AI-generated docs, check cache first then generate
      let cachedData = doc.dataKey ? data[doc.dataKey] : null;

      if (!cachedData && doc.promptType && doc.dataKey) {
        toast.info(`Generando ${doc.label} con IA…`);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        cachedData = await callAI<any>(data.id, 6, doc.promptType as never, buildAICtx());
        if (cachedData) {
          const updates = { [doc.dataKey]: cachedData } as Partial<ValidationData>;
          onDataUpdate(updates);
          supabase.from('validations').update(updates).eq('id', data.id)
            .then(({ error }) => { if (error) console.warn(`[${doc.id}] save error:`, error.message); });
        }
      }

      const payload = { ...base, [doc.dataKey!]: cachedData };

      if (doc.id === 'pitch_deck')          await generatePitchDeckPDF(payload);
      else if (doc.id === 'lean_roadmap')   await generateLeanRoadmapPDF(payload);
      else if (doc.id === 'financial_projection') await generateUnitEconomicsPDF(payload);
      else if (doc.id === 'compliance_roadmap')   await generateCompliancePDF(payload);

      toast.success(`${doc.label} descargado`);
    } catch (err) {
      console.error(`[${doc.id}] error:`, err);
      toast.error(`No se pudo generar ${doc.label}.`);
    } finally {
      setLoadingId(null);
    }
  };

  const isCached = (doc: DocConfig): boolean => {
    if (doc.id === 'dossier') return true;
    if (!doc.dataKey) return false;
    return !!data[doc.dataKey];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#12121A] rounded-3xl shadow-2xl border border-gray-100 dark:border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-white/5">
          <div>
            <h2 className="text-base font-black text-gray-900 dark:text-[#F0EFF8]">Exportar Documentos PDF</h2>
            <p className="text-xs text-gray-400 mt-0.5">{data.idea_name ?? 'Mi Startup'} · Selecciona el formato</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-[#F0EFF8] hover:bg-gray-100 dark:hover:bg-white/5 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Doc list */}
        <div className="p-4 space-y-2 max-h-[70vh] overflow-y-auto">
          {DOCS.map((doc) => {
            const isLoading  = loadingId === doc.id;
            const isDisabled = !!loadingId && loadingId !== doc.id;
            const cached     = isCached(doc);

            return (
              <div
                key={doc.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${doc.accentBg}`}
              >
                {/* Icon */}
                <div className="text-2xl shrink-0 w-10 h-10 flex items-center justify-center bg-white dark:bg-white/5 rounded-xl shadow-sm">
                  {doc.icon}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">{doc.label}</p>
                    <span className="text-[10px] text-gray-400 dark:text-[#8B8AA0]">{doc.sublabel}</span>
                    {cached && doc.id !== 'dossier' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 text-[9px] font-bold">
                        Listo
                      </span>
                    )}
                    {!cached && doc.id !== 'dossier' && (
                      <span className="px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-[#8B8AA0] text-[9px] font-bold">
                        Generará con IA
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed mt-0.5 truncate">{doc.description}</p>
                </div>

                {/* Download button */}
                <button
                  onClick={() => handleDownload(doc)}
                  disabled={isLoading || isDisabled}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all
                    ${isDisabled
                      ? 'opacity-30 cursor-not-allowed bg-gray-100 dark:bg-white/5 text-gray-400'
                      : 'bg-gray-900 hover:bg-gray-800 dark:bg-white/10 dark:hover:bg-white/20 text-white active:scale-95 shadow-sm'
                    }`}
                >
                  {isLoading ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="hidden sm:inline">Generando…</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                      </svg>
                      <span className="hidden sm:inline">Descargar</span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/2">
          <p className="text-[10px] text-gray-400 text-center">
            Los documentos marcados como <strong>"Generará con IA"</strong> llaman al LLM la primera vez (~5–10s). Las siguientes descargas son instantáneas.
          </p>
        </div>
      </div>
    </div>
  );
}
