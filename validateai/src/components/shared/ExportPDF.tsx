import { useState } from 'react';
import { toast } from 'sonner';
import { generateValidationPDF } from '@/lib/pdf';
import { useValidationStore } from '@/stores/validationStore';
import type { MarketSizing, CompetitiveAnalysis, ScoreBreakdown, RiskAnalysis, UnitEconomics, FounderFit, MarketSignals } from '@/types/validation';

export function ExportPDF() {
  const store = useValidationStore();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      // Datos extendidos guardados en el store durante el wizard
      const extended = store.stepMVP as Record<string, unknown>;
      const summaryRaw = store.summary as Record<string, unknown> | null;

      await generateValidationPDF({
        idea_name:             store.stepIdea.idea_name,
        idea_description:      store.stepIdea.idea_description,
        idea_industry:         store.stepIdea.idea_industry,
        target_country:        store.stepIdea.target_country,
        target_region:         store.stepIdea.target_region,
        business_model:        store.stepIdea.business_model,
        business_stage:        store.stepIdea.business_stage,
        pricing_range:         store.stepIdea.pricing_range,
        known_competitors:     store.stepIdea.known_competitors,
        questions_answers:     store.stepQuestions?.questions_answers ?? undefined,
        customer_segment:      store.stepCustomer.customer_segment,
        customer_pain_points:  store.stepCustomer.customer_pain_points,
        customer_context:      (store.stepCustomer as Record<string, unknown>).customer_context as string | undefined,
        value_proposition:     store.stepValueProp.value_proposition,
        differentiator:        store.stepValueProp.differentiator,
        mvp_type:              store.stepMVP.mvp_type,
        mvp_features:          store.stepMVP.mvp_features,
        mvp_user_flow:         store.stepMVP.mvp_user_flow,
        summary:               (summaryRaw ?? {}) as Record<string, unknown>,
        market_sizing:         (extended.market_sizing as MarketSizing) ?? null,
        competitive_analysis:  (extended.competitive_analysis as CompetitiveAnalysis) ?? null,
        score_breakdown:       (summaryRaw?.score_breakdown as ScoreBreakdown) ?? null,
        risk_analysis:         (store.riskAnalysis as RiskAnalysis) ?? null,
        unit_economics:        (store.unitEconomics as UnitEconomics) ?? null,
        founder_fit:           (store.founderFit as FounderFit) ?? null,
        market_signals:        (store.marketSignals as MarketSignals) ?? null,
        from_cache:            store.fromCache,
      });
      toast.success('PDF descargado correctamente');
    } catch {
      toast.error('No se pudo generar el PDF. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex-1 flex items-center justify-center gap-2 px-5 py-3.5
                 bg-gray-900 text-white font-semibold rounded-2xl
                 hover:bg-gray-800 active:scale-[0.98] transition-all
                 disabled:opacity-60 disabled:cursor-not-allowed text-sm"
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          Generando...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          </svg>
          Descargar PDF
        </>
      )}
    </button>
  );
}
