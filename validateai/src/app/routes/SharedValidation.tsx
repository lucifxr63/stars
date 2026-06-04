import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';

function Logo({ className = 'w-5 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={className} aria-label="Validum" role="img">
      <path d="M191.932 459.258L30 200.26H78.2826L206.788 404.341L422.946 60H469L220.159 459.258H191.932Z" className="fill-[#041440] dark:fill-white"/>
      <path d="M245.415 91.1688L144.393 268.534L167.42 308.609L245.415 175.028L287.755 241.818L311.525 203.97L245.415 91.1688Z" fill="#0EB5C6"/>
      <path d="M330.838 318.998L354.607 282.635L460.829 460H413.289L330.838 318.998Z" fill="#0EB5C6"/>
    </svg>
  );
}
import { supabase } from '@/lib/supabase';
import { ScoreGauge } from '@/components/shared/ScoreGauge';
import { MarketFunnel } from '@/components/shared/MarketFunnel';
import { CompetitiveAnalysis } from '@/components/shared/CompetitiveAnalysis';
import { ScoreBreakdown } from '@/components/shared/ScoreBreakdown';
import type { MarketSizing, CompetitiveAnalysis as CompetitiveAnalysisType, ScoreBreakdown as ScoreBreakdownType, UnitEconomics, FundraisingRoadmap } from '@/types/validation';

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
  unit_economics: UnitEconomics | null;
  fundraising_roadmap: FundraisingRoadmap | null;
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
        <div className="w-8 h-8 border-2 border-[#0EB5C6] border-t-transparent rounded-full animate-spin" />
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
        <Link to="/" className="text-sm text-[#0EB5C6] hover:underline font-medium">Ir a Validum →</Link>
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
            <span className="font-heading font-bold text-gray-900 dark:text-[#F0EFF8] text-sm">Validum</span>
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
            {data.business_model && <span className="text-xs px-2.5 py-1 bg-[#0EB5C6]/10 text-[#0EB5C6] dark:text-[#38D5E3] rounded-full border border-[#0EB5C6]/20 uppercase">{data.business_model}</span>}
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

        {/* Unit Economics — KPIs clave para inversores */}
        {data.unit_economics && (() => {
          const ue = data.unit_economics!;
          const fmtCurrency = (n: number, c: 'CLP' | 'USD') =>
            c === 'CLP' ? `$${n.toLocaleString('es-CL')}` : `USD ${n.toLocaleString('en-US')}`;
          const ratioVal = ue.ltvCacRatio.value;
          const ratioColor = ratioVal >= 5 ? '#34D399' : ratioVal >= 3 ? '#F7C56C' : '#F87171';
          const kpis = [
            { label: 'CAC', value: `${fmtCurrency(ue.cac.min, ue.cac.currency)}–${fmtCurrency(ue.cac.max, ue.cac.currency)}` },
            { label: 'LTV', value: `${fmtCurrency(ue.ltv.min, ue.ltv.currency)}–${fmtCurrency(ue.ltv.max, ue.ltv.currency)}` },
            { label: 'LTV/CAC', value: `${ratioVal.toFixed(1)}x`, color: ratioColor },
            { label: 'Payback', value: `${ue.paybackMonths.min}–${ue.paybackMonths.max} meses` },
          ];
          return (
            <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-xs font-bold text-gray-400 dark:text-[#8B8AA0] uppercase tracking-widest mb-4">Unit Economics</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {kpis.map((kpi) => (
                  <div key={kpi.label} className="text-center bg-gray-50 dark:bg-white/[0.03] rounded-xl py-3 px-2">
                    <p className="text-[10px] text-gray-400 dark:text-[#4A495E] mb-1">{kpi.label}</p>
                    <p className={`text-sm font-black leading-tight ${!kpi.color ? 'text-gray-800 dark:text-[#E0DFF5]' : ''}`} style={{ color: kpi.color ?? undefined }}>
                      {kpi.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* Fundraising Readiness */}
        {data.fundraising_roadmap && (() => {
          const fr = data.fundraising_roadmap!;
          const readinessColor = fr.readiness_score >= 70 ? '#34D399' : fr.readiness_score >= 40 ? '#F7C56C' : '#F87171';
          const instrLabels: Record<string, string> = {
            SAFE: 'SAFE Note', convertible_note: 'Nota Convertible',
            priced_round: 'Ronda Valorizada', grant: 'Subsidio / Grant',
            bootstrapping: 'Bootstrapping', non_dilutive_debt: 'Deuda No Dilutiva',
          };
          return (
            <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5">
              <p className="text-xs font-bold text-gray-400 dark:text-[#8B8AA0] uppercase tracking-widest mb-4">Fundraising Readiness</p>
              <div className="flex items-center gap-4">
                <div className="text-center shrink-0">
                  <p className="text-3xl font-black" style={{ color: readinessColor }}>{fr.readiness_score}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">/ 100</p>
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="w-full bg-gray-100 dark:bg-white/5 rounded-full h-2 overflow-hidden">
                    <div className="h-2 rounded-full transition-all" style={{ width: `${fr.readiness_score}%`, backgroundColor: readinessColor }} />
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">
                      Instrumento sugerido: <span className="font-bold text-gray-700 dark:text-[#C4C4D4]">{instrLabels[fr.recommended_instrument] ?? fr.recommended_instrument}</span>
                    </p>
                    {fr.suggested_ticket_size && (
                      <p className="text-xs font-bold text-[#0EB5C6]">
                        USD {fr.suggested_ticket_size.min.toLocaleString('en-US')} – {fr.suggested_ticket_size.max.toLocaleString('en-US')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
                  <span className="w-6 h-6 rounded-full bg-[#0EB5C6] text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
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
        <div className="flex flex-col items-center gap-3 py-4">
          {/* Share en LinkedIn desde la vista pública */}
          <button
            onClick={() => {
              const score = data.validation_score ?? 0;
              const name  = data.idea_name ?? 'una startup';
              const text  = `Vi el análisis de "${name}" validado con IA — Score ${score}/100. Impresionante nivel de detalle.`;
              window.open(
                `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}&summary=${encodeURIComponent(text)}`,
                '_blank', 'noopener,noreferrer',
              );
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#0A66C2] hover:bg-[#0856A0] text-white text-xs font-bold rounded-xl transition-all active:scale-[0.97]"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            Compartir en LinkedIn
          </button>
          <p className="text-xs text-gray-400">¿Quieres validar tu propia idea de negocio?</p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0EB5C6] text-white font-semibold rounded-2xl hover:bg-[#6B5EE6] transition text-sm shadow-md shadow-[#0EB5C6]/20"
          >
            Probar Validum gratis →
          </Link>
        </div>
      </div>
    </div>
  );
}
