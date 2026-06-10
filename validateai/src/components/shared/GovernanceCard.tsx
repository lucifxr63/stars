import type { GovernanceAssessment, GovernanceLegalItem, CapTableEntry } from '@/types/validation';

interface Props {
  data: GovernanceAssessment;
}

const PRIORITY_CONFIG = {
  critical: { label: 'Crítico', className: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400' },
  important: { label: 'Importante', className: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400' },
  nice_to_have: { label: 'Deseable', className: 'bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-[#8B8AA0]' },
} satisfies Record<GovernanceLegalItem['priority'], { label: string; className: string }>;

const RISK_CONFIG = {
  low: { label: 'Bajo', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  medium: { label: 'Medio', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
  high: { label: 'Alto', dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
};

const INAPI_LABEL = {
  marca: { label: 'Marca', icon: '™' },
  patente: { label: 'Patente', icon: '⚙' },
  modelo_utilidad: { label: 'Mod. Utilidad', icon: '🔧' },
};

// Paleta de colores para el cap table (asignada por posición)
const CAP_TABLE_COLORS = [
  { bar: 'bg-indigo-500', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300' },
  { bar: 'bg-violet-500', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300' },
  { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300' },
  { bar: 'bg-amber-500', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300' },
  { bar: 'bg-pink-500', badge: 'bg-pink-100 text-pink-700 dark:bg-pink-500/20 dark:text-pink-300' },
  { bar: 'bg-sky-500', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300' },
];

// ── Visual Cap Table ──────────────────────────────────────────────────────────

function CapTableVisualizer({ entries }: { entries: CapTableEntry[] }) {
  if (!entries || entries.length === 0) return null;

  // Normalizar si los porcentajes no suman exactamente 100
  const total = entries.reduce((s, e) => s + e.percentage, 0);
  const normalized = entries.map((e) => ({ ...e, pct: total > 0 ? (e.percentage / total) * 100 : 0 }));

  return (
    <div>
      <p className="text-xs font-bold text-gray-400 dark:text-[#afaebb] uppercase tracking-wide mb-3">
        Cap Table Inicial
      </p>

      {/* Barra apilada */}
      <div className="flex h-7 rounded-xl overflow-hidden mb-3 gap-0.5">
        {normalized.map((entry, i) => {
          const color = CAP_TABLE_COLORS[i % CAP_TABLE_COLORS.length];
          return (
            <div
              key={i}
              className={`${color.bar} flex items-center justify-center text-white text-[10px] font-bold transition-all`}
              style={{ width: `${entry.pct}%` }}
              title={`${entry.name}: ${entry.percentage}%`}
            >
              {entry.pct >= 12 && `${entry.percentage}%`}
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="space-y-2">
        {normalized.map((entry, i) => {
          const color = CAP_TABLE_COLORS[i % CAP_TABLE_COLORS.length];
          return (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <div className={`w-2.5 h-2.5 rounded-full ${color.bar} shrink-0`} />
                <div className="min-w-0">
                  <span className="text-sm font-semibold text-gray-800 dark:text-[#E0DFF5] truncate block">
                    {entry.name}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-[#afaebb]">{entry.role}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {entry.vesting && (
                  <span className="text-[10px] font-medium text-violet-500 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 px-1.5 py-0.5 rounded">
                    Vesting
                  </span>
                )}
                <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${color.badge}`}>
                  {entry.percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {total !== 100 && (
        <p className="text-[10px] text-amber-500 mt-2">
          ⚠ Los porcentajes suman {total}% — ajustar antes del due diligence.
        </p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export function GovernanceCard({ data }: Props) {
  const risk = RISK_CONFIG[data.regulatory_risk];
  const criticalCount = data.legal_checklist.filter((i) => i.priority === 'critical').length;
  const hasCapTable = data.cap_table_entries && data.cap_table_entries.length > 0;

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
            <p className="text-xs text-gray-400">Marco legal para ser investible · <span className="text-violet-500 dark:text-violet-400">💡 Análisis IA</span></p>
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

      {/* Cap Table Visual (si hay entries estructuradas) */}
      {hasCapTable ? (
        <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/5 rounded-xl p-4">
          <CapTableVisualizer entries={data.cap_table_entries!} />
        </div>
      ) : data.founding_team_split ? (
        // Fallback: texto plano si no hay entries estructuradas (análisis previos)
        <div className="bg-gray-50 dark:bg-[#0A0A0F] border border-gray-200 dark:border-white/5 rounded-xl p-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Distribución del Equity</p>
          <p className="text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed">{data.founding_team_split}</p>
        </div>
      ) : null}

      {/* Ley Karin */}
      {(data.ley_karin_required || data.ley_karin_notes) && (
        <div className={`rounded-xl p-4 border ${data.ley_karin_required
            ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'
            : 'bg-gray-50 dark:bg-white/[0.03] border-gray-200 dark:border-white/5'
          }`}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${data.ley_karin_required
                ? 'bg-red-500 text-white'
                : 'bg-gray-300 dark:bg-white/10 text-gray-600 dark:text-[#8B8AA0]'
              }`}>
              {data.ley_karin_required ? 'APLICA' : 'No aplica'}
            </span>
            <p className="text-xs font-bold text-gray-600 dark:text-[#C4C4D4]">Ley Karin (21.643) — Acoso Laboral</p>
          </div>
          {data.ley_karin_notes && (
            <p className="text-xs text-gray-600 dark:text-[#8B8AA0] leading-relaxed">{data.ley_karin_notes}</p>
          )}
        </div>
      )}

      {/* INAPI Checklist */}
      {data.inapi_checklist && data.inapi_checklist.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-400 dark:text-[#afaebb] uppercase tracking-wide mb-2">
            Propiedad Intelectual — INAPI
          </p>
          <div className="space-y-2">
            {data.inapi_checklist.map((check, i) => {
              const meta = INAPI_LABEL[check.type];
              const prio = PRIORITY_CONFIG[check.risk];
              return (
                <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-[#0A0A0F] rounded-xl border border-gray-100 dark:border-white/5">
                  <div className="shrink-0 flex flex-col items-center gap-1 mt-0.5">
                    <span className="text-base leading-none">{meta.icon}</span>
                    <span className="text-[9px] font-bold text-gray-400 dark:text-[#afaebb] uppercase">{meta.label}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-600 dark:text-[#C4C4D4] leading-snug">{check.recommendation}</p>
                  </div>
                  <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-black ${prio.className}`}>
                    {prio.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Checklist Legal */}
      {data.legal_checklist.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-400 dark:text-[#afaebb] uppercase tracking-wide">
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
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 dark:text-[#E0DFF5]">{item.item}</p>
                    <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-0.5 leading-snug">{item.description}</p>
                    {item.source && (
                      <p className="text-[10px] font-mono text-indigo-500 dark:text-indigo-400 mt-1 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded inline-block">
                        {item.source}
                      </p>
                    )}
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
      {data.cap_table_warnings && data.cap_table_warnings.length > 0 && (
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

      {/* Omission Warnings */}
      {data.omission_warnings && data.omission_warnings.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 rounded-xl p-4">
          <p className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wide mb-2">
            Datos faltantes para análisis completo
          </p>
          <ul className="space-y-1">
            {data.omission_warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-[#8B8AA0]">
                <span className="text-orange-400 shrink-0">→</span>
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
