import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

function Logo({ className = 'w-5 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 338 426" className={className} aria-label="Validus" role="img">
      <path d="M111 187 A78 78 0 0 1 168 123" fill="none" className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt"/>
      <path d="M213 123 A78 78 0 0 1 271 187" fill="none" className="stroke-[#001431] dark:stroke-white" strokeWidth="10" strokeLinecap="butt"/>
      <path d="M66 198 H118 L169 292 L220 198 H272 L169 358 Z" className="fill-[#001431] dark:fill-white"/>
      <path d="M134 252 L152 252 L169 286 L187 252 L205 252 L169 324 Z" className="fill-white dark:fill-[#0A0A0F]"/>
      <path d="M155 253 L169 279 L192 253 L200 263 L169 303 L148 263 Z" className="fill-[#001431] dark:fill-white"/>
      <path d="M169 68 L193 257 L169 237 L156 254 Z" className="fill-[#ff2b23] dark:fill-[#7C6FF7]"/>
    </svg>
  );
}
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
      <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#7C6FF7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] flex flex-col items-center justify-center gap-4 text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <p className="font-bold text-gray-700 dark:text-[#C4C4D4]">Esta validación no existe o ya no está disponible.</p>
        <Link to="/" className="text-sm text-[#7C6FF7] hover:underline font-medium">Ir a Validus →</Link>
      </div>
    );
  }

  const summary = data.summary_json;
  const isGood = (data.validation_score ?? 0) >= 70;
  const isMid = (data.validation_score ?? 0) >= 40;
  const scoreBg = isGood
    ? 'bg-[#34D399]/8 border-[#34D399]/20'
    : isMid
    ? 'bg-[#F7C56C]/8 border-[#F7C56C]/20'
    : 'bg-[#F87171]/8 border-[#F87171]/20';

  return (
    <div className="min-h-screen bg-[#F8F7FF] dark:bg-[#0A0A0F] flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-[#12121A] border-b border-gray-100 dark:border-white/[0.06] px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <Logo/>
            <span className="font-heading font-bold text-gray-900 dark:text-[#F0EFF8] text-sm">Validus</span>
          </Link>
          <span className="text-xs text-gray-500 dark:text-[#8B8AA0] bg-gray-100 dark:bg-white/[0.05] px-2.5 py-1 rounded-full">Reporte compartido</span>
        </div>
      </div>

      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-8 space-y-5">
        {/* Título */}
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-[#F0EFF8]">{data.idea_name ?? 'Sin nombre'}</h1>
          <div className="flex flex-wrap gap-2 mt-2">
            {data.idea_industry && <span className="text-xs px-2.5 py-1 bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-[#8B8AA0] rounded-full">{data.idea_industry}</span>}
            {data.target_country && <span className="text-xs px-2.5 py-1 bg-[#34D399]/10 text-[#34D399] rounded-full border border-[#34D399]/20">{data.target_country}</span>}
            {data.business_model && <span className="text-xs px-2.5 py-1 bg-[#7C6FF7]/10 text-[#7C6FF7] dark:text-[#A78BFA] rounded-full border border-[#7C6FF7]/20 uppercase">{data.business_model}</span>}
            {data.business_stage && <span className="text-xs px-2.5 py-1 bg-[#F7C56C]/10 text-[#F7C56C] rounded-full border border-[#F7C56C]/20">{data.business_stage}</span>}
          </div>
          {data.idea_description && (
            <p className="text-sm text-gray-500 dark:text-[#8B8AA0] mt-3 leading-relaxed">{data.idea_description}</p>
          )}
        </div>

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

        {/* Score breakdown */}
        {data.score_breakdown && <ScoreBreakdown data={data.score_breakdown} />}

        {/* Market sizing */}
        {data.market_sizing && <MarketFunnel data={data.market_sizing} />}

        {/* Competitive analysis */}
        {data.competitive_analysis && <CompetitiveAnalysis data={data.competitive_analysis} />}

        {/* Fortalezas y debilidades */}
        {summary && (summary.strengths?.length > 0 || summary.weaknesses?.length > 0) && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="bg-[#34D399]/8 border border-[#34D399]/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-[#34D399] flex items-center justify-center text-white text-xs font-black">✓</div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Fortalezas</h3>
              </div>
              <ul className="space-y-2">
                {summary.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-[#C4C4D4]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#34D399] mt-1.5 shrink-0" />
                    <span className="leading-snug">{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#F7C56C]/8 border border-[#F7C56C]/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full bg-[#F7C56C] flex items-center justify-center text-white text-xs font-black">!</div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Áreas de mejora</h3>
              </div>
              <ul className="space-y-2">
                {summary.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-[#C4C4D4]">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#F7C56C] mt-1.5 shrink-0" />
                    <span className="leading-snug">{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Próximos pasos */}
        {(summary?.next_steps?.length ?? 0) > 0 && summary && (
          <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-gray-700 dark:text-[#C4C4D4] mb-4">Próximos pasos recomendados</h3>
            <ol className="space-y-3">
              {summary.next_steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[#7C6FF7] text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <p className="text-sm text-gray-600 dark:text-[#8B8AA0] leading-relaxed">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Segmento y propuesta de valor */}
        <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 space-y-3">
          {data.customer_segment && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Cliente objetivo</p>
              <p className="text-sm text-gray-700 dark:text-[#C4C4D4]">{data.customer_segment}</p>
            </div>
          )}
          {data.value_proposition && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Propuesta de valor</p>
              <p className="text-sm text-gray-700 dark:text-[#C4C4D4]">{data.value_proposition}</p>
            </div>
          )}
          {data.differentiator && (
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Diferenciador</p>
              <p className="text-sm text-gray-700 dark:text-[#C4C4D4]">{data.differentiator}</p>
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
