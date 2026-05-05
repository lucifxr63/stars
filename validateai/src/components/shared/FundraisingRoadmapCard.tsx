import type { FundraisingRoadmap } from '@/types/validation';

interface Props {
  data: FundraisingRoadmap;
}

const INSTRUMENT_LABELS: Record<FundraisingRoadmap['recommended_instrument'], { label: string; color: string }> = {
  SAFE:             { label: 'SAFE Note',         color: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-400' },
  convertible_note: { label: 'Nota Convertible',  color: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-400' },
  priced_round:     { label: 'Ronda Valorizada',  color: 'bg-purple-100 text-purple-700 dark:bg-purple-500/15 dark:text-purple-400' },
  grant:            { label: 'Subsidio / Grant',  color: 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400' },
  bootstrapping:    { label: 'Bootstrapping',     color: 'bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-[#8B8AA0]' },
};

function formatUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n}`;
}

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500';
  const label = score >= 70 ? 'Listo para levantar' : score >= 40 ? 'En preparación' : 'No listo aún';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Investor Readiness</p>
        <span className="text-xs font-black text-gray-700 dark:text-[#F0EFF8]">{score}/100 — {label}</span>
      </div>
      <div className="h-2.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${score}%` }} />
      </div>
    </div>
  );
}

export function FundraisingRoadmapCard({ data }: Props) {
  const instrument = INSTRUMENT_LABELS[data.recommended_instrument];

  return (
    <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-500/15 flex items-center justify-center shrink-0">
          <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Estrategia de Fundraising</h3>
          <p className="text-xs text-gray-400">Hoja de ruta para levantar capital</p>
        </div>
      </div>

      {/* Readiness */}
      <ReadinessBar score={data.readiness_score} />

      {/* Instrumento + Ticket */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-100 dark:border-white/5 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Instrumento</p>
          <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-black ${instrument.color}`}>
            {instrument.label}
          </span>
          <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-2 leading-snug">{data.instrument_rationale}</p>
        </div>
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl p-4">
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1">Ticket Sugerido</p>
          <p className="text-lg font-black text-gray-900 dark:text-[#F0EFF8]">
            {formatUSD(data.suggested_ticket_size.min)} – {formatUSD(data.suggested_ticket_size.max)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Valorización: {formatUSD(data.pre_money_valuation_range.min)} – {formatUSD(data.pre_money_valuation_range.max)} pre-money
          </p>
        </div>
      </div>

      {/* Pitch Narrative */}
      {data.pitch_narrative && (
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-4">
          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-2">Narrative del Pitch</p>
          <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed italic">"{data.pitch_narrative}"</p>
        </div>
      )}

      {/* Fondos Recomendados */}
      {data.recommended_funds.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3">
            Fondos Recomendados ({data.recommended_funds.length})
          </p>
          <div className="space-y-2">
            {data.recommended_funds.map((fund, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-[#0A0A0F] rounded-xl border border-gray-100 dark:border-white/5">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-800 dark:text-[#E0DFF5] truncate">{fund.name}</p>
                  <p className="text-xs text-gray-500 dark:text-[#8B8AA0]">{fund.focus} · {fund.stage}</p>
                </div>
                {fund.url && (
                  <a
                    href={fund.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 ml-3 px-2.5 py-1 rounded-lg bg-white dark:bg-[#12121A] border border-gray-200 dark:border-white/10 text-xs font-bold text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition"
                  >
                    Ver →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bloqueadores */}
      {data.blockers.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">Bloqueadores Actuales</p>
          <ul className="space-y-1.5">
            {data.blockers.map((b, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-[#C4C4D4]">
                <span className="text-red-400 shrink-0 mt-0.5">✕</span>
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Próximos hitos */}
      {data.next_milestones.length > 0 && (
        <div>
          <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-2">
            Hitos Antes de la Ronda
          </p>
          <ul className="space-y-1.5">
            {data.next_milestones.map((m, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-[#C4C4D4]">
                <span className="text-emerald-500 shrink-0 mt-0.5 font-bold">{i + 1}.</span>
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
