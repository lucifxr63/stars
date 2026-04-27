import { useState } from 'react';
import { Swords, ExternalLink, ChevronDown, CheckCircle2, XCircle, Target, Zap } from 'lucide-react';
import type { CompetitiveAnalysis as CompetitiveAnalysisType } from '@/types/validation';

const CONFIDENCE_STYLES = {
  high: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20',
  medium: 'bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/20',
  low: 'bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/20',
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

  const AVATAR_GRADIENTS = [
    'from-violet-500 to-fuchsia-600',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-600',
    'from-orange-500 to-red-500',
    'from-pink-500 to-rose-500'
  ];

  return (
    <div className="border-2 border-gray-100 dark:border-white/5 rounded-3xl overflow-hidden bg-white dark:bg-[#12121A] shadow-sm">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-gray-50 dark:hover:bg-[#1A1A24] transition group"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center shrink-0 border border-violet-100 dark:border-violet-500/20 group-hover:scale-105 transition-transform">
            <Swords className="w-6 h-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div className="text-left">
            <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Análisis de Competencia</h2>
            <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-0.5">{data.competitors.length} competidores · {data.market_gaps.length} oportunidades clave</p>
          </div>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-[#8B8AA0] transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}>
          <ChevronDown className="w-5 h-5" />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-[#0A0A0F]/20 divide-y divide-gray-100 dark:divide-white/5 animate-in slide-in-from-top-4 duration-300">

          <div className="px-6 py-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-violet-500 fill-violet-500" />
              <p className="text-xs font-black text-violet-600 dark:text-violet-400 uppercase tracking-wider">Tu Ventaja Competitiva Sugerida</p>
            </div>
            <div className="bg-gradient-to-br from-violet-50 to-fuchsia-50 dark:from-violet-500/10 dark:to-fuchsia-500/10 border border-violet-100 dark:border-violet-500/20 rounded-2xl p-5 shadow-sm">
              <p className="text-sm text-gray-800 dark:text-[#F0EFF8] leading-relaxed font-medium">{data.competitive_advantage_suggestion}</p>
            </div>
          </div>

          <div className="px-6 py-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-gray-400" />
              <p className="text-xs font-black text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider">Mapeo de Competidores</p>
            </div>
            <div className="grid gap-3">
              {data.competitors.map((c, i) => {
                const initials = c.name.substring(0, 2).toUpperCase();
                const gradient = AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length];
                const isActive = activeCompetitor === i;

                return (
                  <div key={i} className={`bg-white dark:bg-[#1A1A24] rounded-2xl border-2 transition-all duration-300 overflow-hidden ${isActive ? 'border-violet-300 dark:border-violet-500/40 shadow-md' : 'border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 shadow-sm'}`}>
                    <button
                      type="button"
                      onClick={() => setActiveCompetitor(isActive ? null : i)}
                      className="w-full flex items-center justify-between px-5 py-4"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-black text-sm shadow-sm shrink-0`}>
                          {initials}
                        </div>
                        <div className="text-left">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] truncate">{c.name}</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border shrink-0 ${
                              c.source === 'user_provided'
                                ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-500/20'
                                : 'bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-[#8B8AA0] border-gray-200 dark:border-white/10'
                            }`}>
                              {c.source === 'user_provided' ? 'Directo' : 'Detectado por IA'}
                            </span>
                          </div>
                          {c.pricing && (
                            <p className="text-xs text-gray-500 dark:text-[#8B8AA0] mt-0.5 font-medium">{c.pricing}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {c.url && (
                          <a
                            href={c.url.startsWith('http') ? c.url : `https://${c.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-50 dark:bg-[#0A0A0F] text-gray-400 hover:text-teal-500 hover:bg-teal-50 dark:hover:bg-teal-500/10 transition-colors shrink-0"
                            title="Visitar sitio"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isActive ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isActive && (
                      <div className="px-5 pb-5 pt-2 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-gray-50 dark:bg-[#0A0A0F]/50 rounded-xl p-4 mb-4 border border-gray-100 dark:border-white/5">
                          <p className="text-sm text-gray-600 dark:text-[#C4C4D4] leading-relaxed">{c.description}</p>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="bg-emerald-50/50 dark:bg-emerald-500/5 border border-emerald-100 dark:border-emerald-500/10 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              <p className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Fortalezas</p>
                            </div>
                            <ul className="space-y-2">
                              {c.strengths.map((s, j) => (
                                <li key={j} className="text-sm text-gray-700 dark:text-[#C4C4D4] flex items-start gap-2">
                                  <span className="text-emerald-500 shrink-0 mt-0.5">•</span>
                                  <span className="leading-snug">{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div className="bg-red-50/50 dark:bg-red-500/5 border border-red-100 dark:border-red-500/10 rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <XCircle className="w-4 h-4 text-red-500" />
                              <p className="text-xs font-black text-red-700 dark:text-red-400 uppercase tracking-wider">Debilidades (Gaps)</p>
                            </div>
                            <ul className="space-y-2">
                              {c.weaknesses.map((w, j) => (
                                <li key={j} className="text-sm text-gray-700 dark:text-[#C4C4D4] flex items-start gap-2">
                                  <span className="text-red-500 shrink-0 mt-0.5">•</span>
                                  <span className="leading-snug">{w}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="px-6 py-6">
            <p className="text-xs font-black text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider mb-4">Gaps de mercado identificados</p>
            <div className="grid sm:grid-cols-2 gap-4">
              {data.market_gaps.map((g, i) => (
                <div key={i} className="bg-white dark:bg-[#1A1A24] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8] leading-snug">{g.gap}</h3>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1.5 ${CONFIDENCE_STYLES[g.confidence]}`}>
                      <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${CONFIDENCE_DOTS[g.confidence]}`} />
                      {CONFIDENCE_LABELS[g.confidence]}
                    </span>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-500/5 rounded-lg p-3 border border-blue-100/50 dark:border-blue-500/10">
                    <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium"><span className="font-bold opacity-70">Oportunidad:</span> {g.opportunity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.unmet_pains.length > 0 && (
            <div className="px-6 py-6">
              <p className="text-xs font-black text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wider mb-4">Dolores no resueltos por la competencia</p>
              <div className="bg-orange-50 dark:bg-orange-500/5 border border-orange-100 dark:border-orange-500/10 rounded-2xl p-5">
                <ul className="space-y-3">
                  {data.unmet_pains.map((p, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm text-orange-900 dark:text-orange-200">
                      <span className="w-6 h-6 rounded-full bg-orange-200 dark:bg-orange-500/20 text-orange-700 dark:text-orange-400 flex items-center justify-center text-xs font-black shrink-0 mt-0.5 shadow-sm">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed pt-0.5 font-medium">{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
