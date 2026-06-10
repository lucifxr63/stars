import type { UnitEconomics, UnitEconomicsBenchmark } from '@/types/validation';
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

export function UnitEconomicsKpis({ data }: Props) {
  const ratioVal = data.ltvCacRatio.value;
  const ratioColor =
    ratioVal >= 5 ? { text: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', bar: '#22c55e' }
      : ratioVal >= 3 ? { text: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', bar: '#f59e0b' }
        : { text: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', bar: '#ef4444' };

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

  return (
    <>
      {metrics.map((m) => (
        <div key={m.label} className={`bg-white dark:bg-slate-800 rounded-2xl overflow-hidden border-2 ${m.badge ? `border-[1px] ${ratioColor.border}` : 'border-gray-100 dark:border-white/5'
          }`}>
          <div className={`h-1.5 ${m.badge ? '' : m.topColor}`} style={m.badge ? { backgroundColor: ratioColor.bar } : undefined} />
          <div className={`p-4 ${m.bg.includes('50') ? 'bg-white dark:bg-slate-800' : m.bg} h-full flex flex-col justify-center`}>
            <p className="text-[10px] text-gray-500 dark:text-[#8B8AA0] mb-0.5">{m.sublabel}</p>
            <p className="text-xs font-bold text-gray-600 dark:text-[#8B8AA0] mb-1">{m.label}</p>
            <p className={`text-base sm:text-lg font-black ${m.color} leading-tight`}>{m.value}</p>
          </div>
        </div>
      ))}
    </>
  );
}

export function UnitEconomicsChart({ data }: Props) {
  const [showAssumptions, setShowAssumptions] = useState(false);

  const avgCac = (data.cac.min + data.cac.max) / 2;
  const avgLtv = (data.ltv.min + data.ltv.max) / 2;

  const chartData = [
    { name: 'CAC', value: avgCac, fill: '#3b82f6' }, // blue-500
    { name: 'LTV', value: avgLtv, fill: '#6366f1' }, // indigo-500
  ];

  return (
    <div className="bg-white dark:bg-slate-800 border-2 border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center shrink-0">
            <span className="text-lg">📊</span>
          </div>
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-[#F0EFF8]">Gráfico de Economics</h3>
            <p className="text-xs text-gray-400">CAC vs LTV Promedio</p>
          </div>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-1">
        {/* Chart representation */}
        <div className="bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-white/5 p-4 mb-6">
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                <XAxis type="number" tickFormatter={(v) => fmtNum(v, data.cac.currency)} width={80} style={{ fontSize: '10px' }} />
                <YAxis dataKey="name" type="category" width={50} style={{ fontSize: '11px', fontWeight: 'bold', fill: '#4b5563' }} />
                <Tooltip
                  cursor={{ fill: '#f3f4f6' }}
                  formatter={(value) => [fmtNum(value as number, data.cac.currency), 'Monto']}
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
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-[#8B8AA0] mb-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl px-4 py-3 border border-amber-100 dark:border-amber-500/20">
          <span>
            <span className="font-bold text-gray-700 dark:text-[#C4C4D4]">Recuperación (Payback): </span>
            {data.paybackMonths.min}–{data.paybackMonths.max} meses
          </span>
          <span>·</span>
          <span>
            <span className="font-bold text-gray-700 dark:text-[#C4C4D4]">Churn mensual estimado: </span>
            <span className={data.monthlyChurnEstimate > 10 ? 'text-red-600 font-semibold' : data.monthlyChurnEstimate > 5 ? 'text-amber-600 font-semibold' : 'text-green-600 font-semibold'}>
              {data.monthlyChurnEstimate}%
            </span>
          </span>
        </div>

        {/* Supuestos colapsables */}
        {data.assumptions?.length > 0 && (
          <div className="mt-auto">
            <button
              type="button"
              onClick={() => setShowAssumptions((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-gray-600 dark:text-[#8B8AA0] transition mb-2"
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
              <ul className="space-y-1.5 bg-gray-50 dark:bg-slate-900 rounded-xl p-3 border border-gray-100 dark:border-white/5">
                {data.assumptions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-500 dark:text-[#8B8AA0]">
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

// ── Benchmark comparison panel ────────────────────────────────────────────────
const BENCHMARK_LABELS: Record<string, string> = {
  saas: 'SaaS', fintech: 'Fintech', edtech: 'EdTech', healthtech: 'HealthTech',
  ecommerce: 'E-commerce', marketplace: 'Marketplace', logistics: 'Logística',
  foodtech: 'FoodTech', proptech: 'PropTech', social: 'Social', other: 'General',
};
const MODEL_LABELS: Record<string, string> = {
  b2b: 'B2B', b2c: 'B2C', b2b2c: 'B2B2C', marketplace: 'Marketplace', default: 'General',
};

function benchmarkBadge(
  position: 'below' | 'in_range' | 'above',
  metric: 'cac' | 'ltv',
): { label: string; className: string } {
  // CAC: below = bueno, above = malo / LTV: below = malo, above = bueno
  const good = metric === 'cac' ? position === 'below' : position === 'above';
  const bad = metric === 'cac' ? position === 'above' : position === 'below';
  const label = position === 'below' ? 'Por debajo' : position === 'above' ? 'Por encima' : 'En rango';
  const className = good
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
    : bad
      ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
      : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
  return { label, className };
}

function BenchmarkPanel({ b }: { b: UnitEconomicsBenchmark }) {
  const sectorLabel = BENCHMARK_LABELS[b.sector] ?? b.sector;
  const modelLabel = MODEL_LABELS[b.model] ?? b.model;
  const cacBadge = benchmarkBadge(b.your_cac_vs_benchmark, 'cac');
  const ltvBadge = benchmarkBadge(b.your_ltv_vs_benchmark, 'ltv');

  return (
    <div className="rounded-xl border border-dashed border-indigo-200 dark:border-indigo-500/25 bg-indigo-50/40 dark:bg-indigo-500/5 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-[11px] font-bold text-indigo-700 dark:text-indigo-400 uppercase tracking-wide">
          Benchmark sectorial · {sectorLabel} / {modelLabel}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* CAC */}
        <div className="flex items-center justify-between gap-2 bg-white/70 dark:bg-white/5 rounded-lg px-3 py-2">
          <div>
            <p className="text-[10px] text-gray-400 dark:text-[#8B8AA0]">CAC sectorial</p>
            <p className="text-xs font-bold text-gray-700 dark:text-[#C4C4D4]">
              USD {b.sector_cac_usd.min.toLocaleString()}–{b.sector_cac_usd.max.toLocaleString()}
            </p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cacBadge.className}`}>
            {cacBadge.label}
          </span>
        </div>
        {/* LTV */}
        <div className="flex items-center justify-between gap-2 bg-white/70 dark:bg-white/5 rounded-lg px-3 py-2">
          <div>
            <p className="text-[10px] text-gray-400 dark:text-[#8B8AA0]">LTV sectorial</p>
            <p className="text-xs font-bold text-gray-700 dark:text-[#C4C4D4]">
              USD {b.sector_ltv_usd.min.toLocaleString()}–{b.sector_ltv_usd.max.toLocaleString()}
            </p>
          </div>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${ltvBadge.className}`}>
            {ltvBadge.label}
          </span>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 dark:text-[#afaebb] leading-relaxed">
        Churn sectorial: {b.sector_churn_pct.min}–{b.sector_churn_pct.max}% mensual ·{' '}
        <span className="italic">{b.benchmark_note}</span>
      </p>
    </div>
  );
}

export function UnitEconomicsCard({ data }: Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <UnitEconomicsKpis data={data} />
      </div>
      <UnitEconomicsChart data={data} />
      {data.benchmarkComparison && (
        <BenchmarkPanel b={data.benchmarkComparison} />
      )}
    </div>
  );
}
