import type { FounderFit } from '@/types/validation';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { UserCheck, ShieldAlert, ArrowRight } from 'lucide-react';

interface Props {
  data: FounderFit;
}

const scoreColor = (v: number) =>
  v >= 70 ? { text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500', track: 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20', hex: '#10b981', glow: 'bg-emerald-400/20' }
  : v >= 40 ? { text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500', track: 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20', hex: '#f59e0b', glow: 'bg-amber-400/20' }
  :           { text: 'text-red-600 dark:text-red-400',   bg: 'bg-red-500',   track: 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',   hex: '#ef4444', glow: 'bg-red-400/20' };

const fitLabel = (v: number) =>
  v >= 70 ? 'Alto' : v >= 40 ? 'Medio' : 'Bajo';

export function FounderFitCard({ data }: Props) {
  const sc = scoreColor(data.score);
  const label = fitLabel(data.score);

  const chartData = [
    { subject: 'Conocimiento Problema', value: data.dimensions.problemKnowledge },
    { subject: 'Exp. Industria', value: data.dimensions.industryExperience },
    { subject: 'Capacidad Técnica', value: data.dimensions.technicalCapability },
    { subject: 'Red de Contactos', value: data.dimensions.networkStrength },
    { subject: 'Track Record', value: data.dimensions.trackRecord },
  ];

  return (
    <div className="bg-white dark:bg-[#12121A] border-2 border-gray-100 dark:border-white/5 rounded-3xl overflow-hidden p-6 relative shadow-sm">
      {/* Background Glow */}
      <div className={`absolute -right-12 -top-12 w-48 h-48 ${sc.glow} rounded-full blur-[60px] opacity-60 pointer-events-none`}></div>

      {/* Header + score circular */}
      <div className="relative flex items-center gap-4 mb-6">
        <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 border shadow-inner ${sc.track}`}>
          <span className={`text-2xl font-black ${sc.text}`}>{data.score}</span>
          <span className={`text-[9px] font-black ${sc.text} uppercase tracking-wider`}>Fit {label}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-5 h-5 text-gray-400" />
            <h3 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">Founder-Market Fit</h3>
          </div>
          {data.assessment && (
            <p className="text-xs text-gray-500 dark:text-[#8B8AA0] leading-relaxed line-clamp-2">{data.assessment}</p>
          )}
        </div>
      </div>

      <div className="relative flex flex-col sm:flex-row items-center justify-center gap-6 mb-8">
        <div className="w-full sm:w-3/5 h-64 bg-gray-50/50 dark:bg-transparent rounded-3xl">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 30 }}>
              <PolarGrid stroke="#e5e7eb" strokeOpacity={0.5} />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fontSize: 10, fill: '#8B8AA0', fontWeight: 700 }}
              />
              <Radar
                name="Founder Fit"
                dataKey="value"
                stroke={sc.hex}
                fill={sc.hex}
                fillOpacity={0.25}
                strokeWidth={2}
              />
              <Tooltip
                contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontSize: 12, backgroundColor: '#1A1A24', color: '#F0EFF8' }}
                itemStyle={{ color: sc.hex, fontWeight: 'bold' }}
                formatter={(value) => [`${value as number}/100`, 'Fit']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full sm:w-2/5 grid grid-cols-2 sm:grid-cols-1 gap-3">
          {chartData.map((d) => {
            const valColor = scoreColor(d.value);
            return (
              <div key={d.subject} className="bg-gray-50 dark:bg-[#0A0A0F]/60 p-3 rounded-2xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                <span className="text-[10px] text-gray-500 dark:text-[#8B8AA0] font-bold uppercase tracking-wider w-2/3">{d.subject}</span>
                <span className={`text-sm font-black ${valColor.text} bg-white dark:bg-[#1A1A24] px-2 py-0.5 rounded-lg border border-gray-100 dark:border-white/5 shadow-sm`}>{d.value}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative grid md:grid-cols-2 gap-4">
        {/* Gaps */}
        {data.gaps?.length > 0 && (
          <div className="bg-amber-50/50 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/10 rounded-2xl p-5">
            <h4 className="text-xs font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Gaps identificados
            </h4>
            <ul className="space-y-3">
              {data.gaps.map((g, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-gray-700 dark:text-[#C4C4D4] leading-relaxed">
                  <span className="text-amber-500 shrink-0 mt-0.5">•</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recomendaciones */}
        {data.recommendations?.length > 0 && (
          <div className="bg-purple-50/50 dark:bg-purple-500/5 border border-purple-100 dark:border-purple-500/10 rounded-2xl p-5">
            <h4 className="text-xs font-black text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <ArrowRight className="w-4 h-4" />
              Ruta sugerida
            </h4>
            <ol className="space-y-4">
              {data.recommendations.map((r, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5 shadow-sm">
                    {i + 1}
                  </span>
                  <p className="text-xs text-gray-700 dark:text-[#C4C4D4] leading-relaxed font-medium">{r}</p>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
