import { useState } from 'react';
import type { CompetitiveAnalysis as CompetitiveAnalysisType } from '@/types/validation';

const CONFIDENCE_STYLES = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-red-50 text-red-600 border-red-200',
};

const CONFIDENCE_LABELS = {
  high: 'Alta',
  medium: 'Media',
  low: 'Baja',
};

const CONFIDENCE_DOTS = {
  high: 'bg-emerald-500',
  medium: 'bg-amber-400',
  low: 'bg-red-400',
};

export function CompetitiveAnalysis({ data }: { data: CompetitiveAnalysisType }) {
  const [expanded, setExpanded] = useState(false);
  const [activeCompetitor, setActiveCompetitor] = useState<number | null>(null);

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      {/* Header colapsable */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-gray-50/60 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-violet-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-gray-800">Análisis de competencia</p>
            <p className="text-xs text-gray-400">{data.competitors.length} competidores · {data.market_gaps.length} gaps identificados</p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/40 divide-y divide-gray-100">

          {/* Ventaja competitiva sugerida */}
          <div className="px-5 py-4">
            <p className="text-xs font-bold text-violet-600 uppercase tracking-wider mb-2">Ventaja competitiva sugerida</p>
            <p className="text-sm text-gray-700 leading-relaxed">{data.competitive_advantage_suggestion}</p>
          </div>

          {/* Competidores */}
          <div className="px-5 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Competidores</p>
            <div className="space-y-2">
              {data.competitors.map((c, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setActiveCompetitor(activeCompetitor === i ? null : i)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-sm font-semibold text-gray-800 truncate">{c.name}</span>
                      {c.url && (
                        <a
                          href={c.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs text-teal-500 hover:underline shrink-0"
                        >
                          ↗
                        </a>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                        c.source === 'user_provided'
                          ? 'bg-blue-50 text-blue-600 border-blue-200'
                          : 'bg-gray-50 text-gray-500 border-gray-200'
                      }`}>
                        {c.source === 'user_provided' ? 'Mencionado' : 'IA'}
                      </span>
                    </div>
                    <svg className={`w-4 h-4 text-gray-300 shrink-0 ml-2 transition-transform ${activeCompetitor === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {activeCompetitor === i && (
                    <div className="px-4 pb-4 border-t border-gray-50 space-y-3 pt-3">
                      <p className="text-xs text-gray-500 leading-relaxed">{c.description}</p>
                      {c.pricing && (
                        <p className="text-xs text-gray-400"><span className="font-semibold text-gray-600">Precio:</span> {c.pricing}</p>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <p className="text-xs font-semibold text-emerald-600 mb-1.5">Fortalezas</p>
                          <ul className="space-y-1">
                            {c.strengths.map((s, j) => (
                              <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                                <span className="text-emerald-400 mt-0.5 shrink-0">+</span>{s}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-red-500 mb-1.5">Debilidades</p>
                          <ul className="space-y-1">
                            {c.weaknesses.map((w, j) => (
                              <li key={j} className="text-xs text-gray-600 flex items-start gap-1.5">
                                <span className="text-red-400 mt-0.5 shrink-0">−</span>{w}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Gaps de mercado */}
          <div className="px-5 py-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Gaps de mercado</p>
            <div className="space-y-2.5">
              {data.market_gaps.map((g, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="flex items-start justify-between gap-3 mb-1.5">
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{g.gap}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1.5 ${CONFIDENCE_STYLES[g.confidence]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_DOTS[g.confidence]}`} />
                      {CONFIDENCE_LABELS[g.confidence]}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{g.opportunity}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Dolores no resueltos */}
          {data.unmet_pains.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Dolores no resueltos en el mercado</p>
              <ul className="space-y-2">
                {data.unmet_pains.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <span className="w-5 h-5 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">{i + 1}</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
