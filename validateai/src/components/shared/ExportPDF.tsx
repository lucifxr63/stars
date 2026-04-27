import { useState } from 'react';
import { toast } from 'sonner';
import { generateValidationPDF } from '@/lib/pdf';
import { useValidationStore } from '@/stores/validationStore';

export function ExportPDF() {
  const store = useValidationStore();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const summaryRaw = store.summary as Record<string, unknown> | null;

      await generateValidationPDF({
        idea_name:            store.stepIdea.idea_name,
        idea_description:     store.stepIdea.idea_description,
        idea_industry:        store.stepIdea.idea_industry,
        target_country:       store.stepMarket.target_country ?? undefined,
        target_region:        store.stepMarket.target_region ?? undefined,
        business_model:       store.stepMarket.business_model ?? undefined,
        business_stage:       undefined,
        pricing_range:        store.stepMarket.pricing_range ?? undefined,
        known_competitors:    undefined,
        questions_answers:    undefined,
        customer_segment:     store.stepMarket.customer_segment,
        customer_pain_points: undefined,
        customer_context:     undefined,
        value_proposition:    undefined,
        differentiator:       undefined,
        mvp_type:             undefined,
        mvp_features:         undefined,
        mvp_user_flow:        undefined,
        summary:              (summaryRaw ?? {}) as Record<string, unknown>,
        market_sizing:        null,
        competitive_analysis: null,
        score_breakdown:      (summaryRaw?.score_breakdown as never) ?? null,
        risk_analysis:        null,
        unit_economics:       null,
        founder_fit:          null,
        market_signals:       null,
        from_cache:           store.fromCache,
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
