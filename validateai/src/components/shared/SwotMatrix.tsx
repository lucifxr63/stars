import { TrendingUp, AlertTriangle, Lightbulb, ShieldAlert } from 'lucide-react';

interface SwotMatrixProps {
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  threats?: string[];
}

export function SwotMatrix({ strengths, weaknesses, opportunities, threats }: SwotMatrixProps) {
  // Mock data for UI/UX testing when real data is empty
  const displayStrengths = strengths?.length ? strengths : ["(Ejemplo) Problema claramente identificado", "(Ejemplo) Equipo con experiencia técnica"];
  const displayWeaknesses = weaknesses?.length ? weaknesses : ["(Ejemplo) Presupuesto inicial muy limitado", "(Ejemplo) Falta de red de contactos en la industria"];
  const displayOpportunities = opportunities?.length ? opportunities : ["(Ejemplo) Crecimiento sostenido del mercado objetivo", "(Ejemplo) Competidores actuales tienen UI anticuada"];
  const displayThreats = threats?.length ? threats : ["(Ejemplo) Entrada de competidores globales", "(Ejemplo) Cambios regulatorios inminentes"];

  return (
    <div className="grid sm:grid-cols-2 gap-4">
      {/* Fortalezas */}
      <div className="bg-green-50 dark:bg-green-500/5 border-2 border-green-100 dark:border-green-500/10 rounded-2xl p-5 relative overflow-hidden group hover:border-green-200 dark:hover:border-green-500/20 transition-all">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-green-400/20 dark:bg-green-500/10 rounded-full blur-2xl group-hover:bg-green-400/30 transition-all"></div>
        <div className="relative flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center text-white shrink-0 shadow-sm shadow-green-500/20">
            <TrendingUp className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-green-800 dark:text-green-400 uppercase tracking-wide">Fortalezas</h3>
        </div>
        <ul className="space-y-3 relative z-10">
          {displayStrengths.map((s, i) => (
            <li key={i} className={`flex items-start gap-2.5 text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed ${!strengths?.length ? 'opacity-60 italic' : ''}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1.5 shrink-0" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Debilidades */}
      <div className="bg-amber-50 dark:bg-amber-500/5 border-2 border-amber-100 dark:border-amber-500/10 rounded-2xl p-5 relative overflow-hidden group hover:border-amber-200 dark:hover:border-amber-500/20 transition-all">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-amber-400/20 dark:bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-400/30 transition-all"></div>
        <div className="relative flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-sm shadow-amber-500/20">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-amber-800 dark:text-amber-400 uppercase tracking-wide">Áreas de mejora</h3>
        </div>
        <ul className="space-y-3 relative z-10">
          {displayWeaknesses.map((w, i) => (
            <li key={i} className={`flex items-start gap-2.5 text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed ${!weaknesses?.length ? 'opacity-60 italic' : ''}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
              <span>{w}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Oportunidades */}
      <div className="bg-blue-50 dark:bg-blue-500/5 border-2 border-blue-100 dark:border-blue-500/10 rounded-2xl p-5 relative overflow-hidden group hover:border-blue-200 dark:hover:border-blue-500/20 transition-all">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-blue-400/20 dark:bg-blue-500/10 rounded-full blur-2xl group-hover:bg-blue-400/30 transition-all"></div>
        <div className="relative flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-blue-500 flex items-center justify-center text-white shrink-0 shadow-sm shadow-blue-500/20">
            <Lightbulb className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-blue-800 dark:text-blue-400 uppercase tracking-wide">Oportunidades</h3>
        </div>
        <ul className="space-y-3 relative z-10">
          {displayOpportunities.map((o, i) => (
            <li key={i} className={`flex items-start gap-2.5 text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed ${!opportunities?.length ? 'opacity-60 italic' : ''}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
              <span>{o}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Amenazas */}
      <div className="bg-rose-50 dark:bg-rose-500/5 border-2 border-rose-100 dark:border-rose-500/10 rounded-2xl p-5 relative overflow-hidden group hover:border-rose-200 dark:hover:border-rose-500/20 transition-all">
        <div className="absolute -right-8 -top-8 w-32 h-32 bg-rose-400/20 dark:bg-rose-500/10 rounded-full blur-2xl group-hover:bg-rose-400/30 transition-all"></div>
        <div className="relative flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-xl bg-rose-500 flex items-center justify-center text-white shrink-0 shadow-sm shadow-rose-500/20">
            <ShieldAlert className="w-4 h-4" />
          </div>
          <h3 className="text-sm font-black text-rose-800 dark:text-rose-400 uppercase tracking-wide">Amenazas</h3>
        </div>
        <ul className="space-y-3 relative z-10">
          {displayThreats.map((t, i) => (
            <li key={i} className={`flex items-start gap-2.5 text-sm text-gray-700 dark:text-[#C4C4D4] leading-relaxed ${!threats?.length ? 'opacity-60 italic' : ''}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mt-1.5 shrink-0" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
