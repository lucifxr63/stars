import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { MarketFunnel } from '@/components/shared/MarketFunnel';
import { CompetitiveAnalysis } from '@/components/shared/CompetitiveAnalysis';
import { ScoreBreakdown } from '@/components/shared/ScoreBreakdown';
import type { MarketSizing, CompetitiveAnalysis as CompetitiveAnalysisType, ScoreBreakdown as ScoreBreakdownType } from '@/types/validation';

interface SharedValidation {
  id: string;
  idea_name: string | null;
  idea_description: string | null;
  idea_industry: string | null;
  target_country: string | null;
  business_stage: string | null;
  business_model: string | null;
  customer_segment: string | null;
  value_proposition: string | null;
  differentiator: string | null;
  mvp_type: string | null;
  mvp_user_flow: string | null;
  validation_score: number | null;
  ai_feedback: string | null;
  summary_json: { score: number; feedback: string; strengths: string[]; weaknesses: string[]; next_steps: string[] } | null;
  market_sizing: MarketSizing | null;
  competitive_analysis: CompetitiveAnalysisType | null;
  score_breakdown: ScoreBreakdownType | null;
  completed_at: string | null;
}


export function SharedValidation() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedValidation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) { setNotFound(true); setLoading(false); return; }
    supabase
      .from('validations')
      .select('*')
      .eq('share_token', token)
      .single()
      .then(({ data: row, error }) => {
        if (error || !row) { setNotFound(true); } else { setData(row as SharedValidation); }
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-bold text-gray-700">Esta validación no existe o ya no está disponible.</p>
        <Link to="/" className="text-sm text-teal-600 hover:underline">Ir a ValidateAI →</Link>
      </div>
    );
  }

  const summary = data.summary_json;
  const isGood = (data.validation_score ?? 0) >= 70;
  const isMid = (data.validation_score ?? 0) >= 40;
  const scoreBg = isGood ? 'bg-green-50 border-green-200' : isMid ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-teal-500 flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="font-bold text-gray-900 text-sm">ValidateAI</span>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Reporte compartido</span>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-5">
        {/* Título */}
        <div>
          <h1 className="text-2xl font-black text-gray-900">{data.idea_name ?? 'Sin nombre'}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.idea_industry && <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full">{data.idea_industry}</span>}
            {data.target_country && <span className="text-xs px-2.5 py-1 bg-teal-50 text-teal-600 rounded-full">{data.target_country}</span>}
            {data.business_model && <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-600 rounded-full uppercase">{data.business_model}</span>}
            {data.business_stage && <span className="text-xs px-2.5 py-1 bg-violet-50 text-violet-600 rounded-full">{data.business_stage}</span>}
          </div>
          {data.idea_description && (
            <p className="text-sm text-gray-500 mt-3 leading-relaxed">{data.idea_description}</p>
          )}
        </div>

        {/* Score */}
        {summary && data.validation_score != null && (
          <div className={`rounded-3xl border-2 p-6 ${scoreBg}`}>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <ScoreGauge score={data.validation_score} />
              <div className="flex-1 text-center sm:text-left">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Análisis general</p>
                <p className="text-gray-700 leading-relaxed text-sm">{summary.feedback}</p>
              </div>
            </div>
          </div>
        )}

        {/* Score breakdown */}
        {data.score_breakdown && <ScoreBreakdown data={data.score_breakdown} />}

        {/* Market sizing */}
        {data.market_sizing && <MarketFunnel data={data.market_sizing} />}

        {/* Competitive analysis */}
        {data.competitive_analysis && <CompetitiveAnalysis data={data.competitive_analysis} />}

        {/* Fortalezas y debilidades */}
        {summary && (summary.strengths?.length > 0 || summary.weaknesses?.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-green-50 border-2 border-green-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-black">✓</div>
                <h3 className="text-sm font-bold text-green-800">Fortalezas</h3>
              </div>
              <ul className="space-y-2">
                {summary.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
                    <span className="leading-snug">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-amber-50 border-2 border-amber-100 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center text-white text-xs font-black">!</div>
                <h3 className="text-sm font-bold text-amber-800">Áreas de mejora</h3>
              </div>
              <ul className="space-y-2">
                {summary.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                    <span className="leading-snug">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Próximos pasos */}
        {(summary?.next_steps?.length ?? 0) > 0 && summary && (
          <div className="bg-white border-2 border-gray-100 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-700 mb-4">Próximos pasos recomendados</h3>
            <ol className="space-y-3">
              {summary.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-teal-500 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-600 leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Segmento y propuesta de valor */}
        <div className="bg-white border-2 border-gray-100 rounded-2xl p-5 space-y-3">
          {data.customer_segment && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Cliente objetivo</p>
              <p className="text-sm text-gray-700">{data.customer_segment}</p>
            </div>
          )}
          {data.value_proposition && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Propuesta de valor</p>
              <p className="text-sm text-gray-700">{data.value_proposition}</p>
            </div>
          )}
          {data.differentiator && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Diferenciador</p>
              <p className="text-sm text-gray-700">{data.differentiator}</p>
            </div>
          )}
        </div>

        {/* Footer CTA */}
        <div className="text-center py-4">
          <p className="text-xs text-gray-400 mb-3">¿Quieres validar tu propia idea de negocio?</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-500 text-white font-semibold rounded-2xl hover:bg-teal-600 transition text-sm"
          >
            Probar ValidateAI gratis →
          </Link>
        </div>
      </div>
    </div>
  );
}
