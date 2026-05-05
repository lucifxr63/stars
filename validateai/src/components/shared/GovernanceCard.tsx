import type { GovernanceAssessment, GovernanceLegalItem } from '@/types/validation';

interface Props {
  data: GovernanceAssessment;
}

const PRIORITY_CONFIG = {
  critical:      { label: 'Crítico',    className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  important:     { label: 'Importante', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  nice_to_have:  { label: 'Deseable',   className: 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-[#8B8AA0]' },
} satisfies Record<GovernanceLegalItem['priority'], { label: string; className: string }>;

const RISK_CONFIG = {
  low:    { label: 'Bajo',   dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  medium: { label: 'Medio',  dot: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400' },
  high:   { label: 'Alto',   dot: 'bg-red-500',     text: 'text-red-600 dark:text-red-400' },
};

export function GovernanceCard({ data }: Props) {
  const risk = RISK_CONFIG[data.regulatory_risk];
  const criticalCount = data.legal_checklist.filter((i) => i.priority === 'critical').length;

  return (
    <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-2xl p-5 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Gobernanza y Estructura Legal</h3>
            <p className="text-xs text-gray-400">Marco legal para ser investible</p>
          </div>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-bold ${risk.text}`}>
          <span className={`w-2 h-2 rounded-full ${risk.dot}`} />
          Riesgo Reg. {risk.label}
        </div>
      </div>

      {/* Estructura y Vesting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-xl p-4">
          <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide mb-1">Estructura Recomendada</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-[#E0DFF5]">{data.recommended_structure}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 rounded-xl p-4">
          <p className="text-xs font-bold text-purple-500 uppercase tracking-wide mb-1">Vesting</p>
          <p className="text-sm font-semibold text-gray-800 dark:text-[#E0DFF5]">{data.vesting_recommendation}</p>
        </div>
      </div>

      {/* Distribución del Equity */}
      {data.founding_team_split && (
        <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/5 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Distribución del Equity</p>
          <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.founding_team_split}</p>
        </div>
      )}

      {/* Checklist Legal */}
      {data.legal_checklist.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">
              Checklist Legal ({data.legal_checklist.length} ítems)
            </p>
            {criticalCount > 0 && (
              <span className="text-xs font-bold text-red-600 dark:text-red-400">
                {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {data.legal_checklist.map((item, i) => {
              const p = PRIORITY_CONFIG[item.priority];
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#0A0A0F] rounded-xl border border-gray-100 dark:border-white/5">
                  <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-black ${p.className}`}>
                    {p.label}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800 dark:text-[#E0DFF5]">{item.item}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-0.5 leading-snug">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Notas regulatorias */}
      {data.regulatory_notes && (
        <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wide mb-1">Marco Regulatorio</p>
          <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.regulatory_notes}</p>
        </div>
      )}

      {/* Cap Table Warnings */}
      {data.cap_table_warnings.length > 0 && (
        <div>
          <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">Advertencias Cap Table</p>
          <ul className="space-y-1.5">
            {data.cap_table_warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-[#C4C4D4]">
                <span className="text-red-400 shrink-0 mt-0.5">⚠</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
