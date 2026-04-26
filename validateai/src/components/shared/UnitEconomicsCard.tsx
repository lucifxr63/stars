import type { UnitEconomics } from '@/types/validation';
import { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from 'recharts';

interface Props {
  data: UnitEconomics;
}

const fmtNum = (n: number, currency: 'CLP' | 'USD') =>
  currency === 'CLP'
    ? `$${n.toLocaleString('es-CL')}`
    : `USD ${n.toLocaleString('en-US')}`;

const fmtRange = (min: number, max: number, currency: 'CLP' | 'USD') =>
  `${fmtNum(min, currency)} – ${fmtNum(max, currency)}`;

export function UnitEconomicsCard({ data }: Props) {
  const [showAssumptions, setShowAssumptions] = useState(false);

  const ratioVal = data.ltvCacRatio.value;
  const ratioColor =
    ratioVal >= 5 ? { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', bar: '#22c55e' }
    : ratioVal >= 3 ? { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', bar: '#f59e0b' }
    :                 { text: 'text-red-600',   bg: 'bg-red-50',   border: 'border-red-200',   bar: '#ef4444'   };

  const ratioLabel =
    ratioVal >= 5 ? 'Saludable' : ratioVal >= 3 ? 'Viable' : 'Crítico';

  const metrics = [
    {
      label: 'CAC',
      sublabel: 'Costo de adquisición',
      value: fmtRange(data.cac.min, data.cac.max, data.cac.currency),
      color: 'text-blue-600',
      topColor: 'bg-blue-500',
      bg: 'bg-blue-50',
    },
    {
      label: 'LTV',
      sublabel: 'Lifetime value',
      value: fmtRange(data.ltv.min, data.ltv.max, data.ltv.currency),
      color: 'text-indigo-600',
      topColor: 'bg-indigo-500',
      bg: 'bg-indigo-50',
    },
    {
      label: `LTV/CAC  ${ratioVal.toFixed(1)}x`,
      sublabel: ratioLabel,
      value: ratioLabel,
      color: ratioColor.text,
      topColor: `bg-[${ratioColor.bar}] border-[${ratioColor.bar}]`,
      bg: ratioColor.bg,
      badge: true,
    },
    {
      label: 'Break-even',
      sublabel: 'Usuarios de pago',
      value: `${data.breakEvenUsers.toLocaleString('es-CL')} usuarios`,
      color: 'text-teal-600',
      topColor: 'bg-teal-500',
      bg: 'bg-teal-50',
    },
  ];

  const avgCac = (data.cac.min + data.cac.max) / 2;
  const avgLtv = (data.ltv.min + data.ltv.max) / 2;

  const chartData = [
    { name: 'CAC', value: avgCac, fill: '#3b82f6' }, // blue-500
    { name: 'LTV', value: avgLtv, fill: '#6366f1' }, // indigo-500
  ];

  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 bg-white border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <span className="text-lg">📊</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Unit Economics</h3>
            <p className="text-xs text-gray-400">Estimaciones según el mercado</p>
          </div>
        </div>
      </div>

      <div className="p-5">
        {/* Metric cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {metrics.map((m) => (
            <div key={m.label} className={`rounded-xl overflow-hidden border-2 ${
              m.badge ? `border-[1px] ${ratioColor.border}` : 'border-gray-100'
            }`}>
              <div className={`h-1.5 ${m.badge ? '' : m.topColor}`} style={m.badge ? { backgroundColor: ratioColor.bar } : undefined} />
              <div className={`p-3 ${m.bg} h-full`}>
                <p className="text-[10px] text-gray-500 mb-0.5">{m.sublabel}</p>
                <p className="text-[10px] font-bold text-gray-600 mb-1">{m.label}</p>
                <p className={`text-xs font-black ${m.color} leading-tight`}>{m.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Chart representation */}
        <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-6">
          <h4 className="text-xs font-bold text-gray-600 mb-4 text-center">Comparativa CAC vs LTV (Promedio)</h4>
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={(v) => fmtNum(v, data.cac.currency)} width={80} style={{ fontSize: '10px' }} />
                <YAxis dataKey="name" type="category" width={50} style={{ fontSize: '11px', fontWeight: 'bold', fill: '#4b5563' }} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  formatter={(value: number) => [fmtNum(value, data.cac.currency), 'Monto']}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={30}>
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payback + Churn */}
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 mb-4 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
          <span>
            <span className="font-bold text-gray-700">Recuperación (Payback): </span>
            {data.paybackMonths.min}–{data.paybackMonths.max} meses
          </span>
          <span>·</span>
          <span>
            <span className="font-bold text-gray-700">Churn mensual estimado: </span>
            <span className={data.monthlyChurnEstimate > 10 ? 'text-red-600 font-semibold' : data.monthlyChurnEstimate > 5 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>
              {data.monthlyChurnEstimate}%
            </span>
          </span>
        </div>

        {/* Supuestos colapsables */}
        {data.assumptions?.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowAssumptions((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 transition mb-2"
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${showAssumptions ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {showAssumptions ? 'Ocultar' : 'Ver'} supuestos del cálculo
            </button>

            {showAssumptions && (
              <ul className="space-y-1.5 bg-gray-50 rounded-xl p-3 border border-gray-100">
                {data.assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-500">
                    <div className="w-1 h-1 rounded-full bg-gray-400 mt-1.5 shrink-0" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
