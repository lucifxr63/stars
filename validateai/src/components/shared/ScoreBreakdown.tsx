import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import type { ScoreBreakdown as ScoreBreakdownType } from '@/types/validation';

const LABELS: Record<keyof ScoreBreakdownType, string> = {
  problem: 'Problema',
  market: 'Mercado',
  competition: 'Competencia',
  solution: 'Solución',
  execution: 'Ejecución',
};

export function ScoreBreakdown({ data }: { data: ScoreBreakdownType }) {
  const chartData = (Object.keys(LABELS) as (keyof ScoreBreakdownType)[]).map((key) => ({
    subject: LABELS[key],
    value: data[key],
    fullMark: 100,
  }));

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </div>
          <p className="text-sm font-bold text-gray-800">Desglose del score</p>
        </div>
      </div>

      <div className="bg-gray-50/40 px-5 py-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-full">
            <ResponsiveContainer width="100%" height={200}>
              <RadarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
                <PolarGrid stroke="#e5e7eb" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fontSize: 10, fill: '#6b7280', fontWeight: 600 }}
                />
                <Radar
                  name="Score"
                  dataKey="value"
                  stroke="#14b8a6"
                  fill="#14b8a6"
                  fillOpacity={0.2}
                  strokeWidth={2}
                />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', fontSize: 12 }}
                  formatter={(value) => [`${value}/100`, 'Score']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>

          <div className="w-full sm:w-40 shrink-0">
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-x-4 gap-y-2.5">
              {(Object.keys(LABELS) as (keyof ScoreBreakdownType)[]).map((key) => {
                const val = data[key];
                const color = val >= 70 ? '#10b981' : val >= 40 ? '#f59e0b' : '#ef4444';
                return (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-500">{LABELS[key]}</span>
                      <span className="text-xs font-black" style={{ color }}>{val}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${val}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
