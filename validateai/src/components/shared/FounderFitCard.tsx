import type { FounderFit } from '@/types/validation';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

interface Props {
  data: FounderFit;
}

const scoreColor = (v: number) =>
  v >= 70 ? { text: 'text-green-600', bg: 'bg-green-500', track: 'bg-green-100', hex: '#22c55e' }
  : v >= 40 ? { text: 'text-amber-600', bg: 'bg-amber-500', track: 'bg-amber-100', hex: '#f59e0b' }
  :           { text: 'text-red-600',   bg: 'bg-red-500',   track: 'bg-red-100',   hex: '#ef4444' };

const fitLabel = (v: number) =>
  v >= 70 ? 'Alto' : v >= 40 ? 'Medio' : 'Bajo';

export function FounderFitCard({ data }: Props) {
  const sc = scoreColor(data.score);
  const label = fitLabel(data.score);

  const chartData = [
    { subject: 'Conocimiento del problema', value: data.dimensions.problemKnowledge },
    { subject: 'Exp. en industria', value: data.dimensions.industryExperience },
    { subject: 'Capacidad técnica', value: data.dimensions.technicalCapability },
    { subject: 'Red de contactos', value: data.dimensions.networkStrength },
    { subject: 'Track record', value: data.dimensions.trackRecord },
  ];

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden p-5">
      {/* Header + score circular */}
      <div className="flex items-center gap-4 mb-6">
        <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center shrink-0 ${sc.track} border-2`}
          style={{ borderColor: 'transparent' }}>
          <span className={`text-2xl font-black ${sc.text}`}>{data.score}</span>
          <span className={`text-[9px] font-bold ${sc.text} uppercase tracking-wide`}>Fit {label}</span>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-gray-900">Founder-Market Fit</h3>
          {data.assessment && (
            <p className="text-xs text-gray-500 leading-snug mt-1 line-clamp-2">{data.assessment}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-6">
        <div className="w-full sm:w-2/3 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis 
                dataKey="subject" 
                tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }}
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
                contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', fontSize: 12 }}
                formatter={(value: number) => [`${value}/100`, 'Fit']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full sm:w-1/3 grid grid-cols-2 sm:grid-cols-1 gap-3">
          {chartData.map((d) => (
             <div key={d.subject} className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 flex flex-col justify-center">
                 <span className="text-[10px] text-gray-400 font-bold leading-tight">{d.subject}</span>
                 <span className={`text-sm font-black ${scoreColor(d.value).text}`}>{d.value}</span>
             </div>
          ))}
        </div>
      </div>

      {/* Gaps */}
      {data.gaps?.length > 0 && (
        <div className="mb-4">
          <h4 className="text-xs font-bold text-amber-700 mb-2 flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
              <span className="text-white text-[8px] font-black">!</span>
            </div>
            Gaps identificados
          </h4>
          <ul className="space-y-1.5">
            {data.gaps.map((g, i) => (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                <div className="w-1 h-1 rounded-full bg-amber-400 mt-1.5 shrink-0" />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recomendaciones */}
      {data.recommendations?.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-purple-700 mb-2 flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
              <span className="text-white text-[8px] font-black">→</span>
            </div>
            Recomendaciones para cerrar gaps
          </h4>
          <ol className="space-y-2">
            {data.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-purple-500 text-white flex items-center justify-center text-xs font-black shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <p className="text-sm text-gray-600 leading-relaxed">{r}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
