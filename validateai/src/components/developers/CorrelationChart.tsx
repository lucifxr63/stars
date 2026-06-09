import { useEffect, useState } from 'react';
import {
  ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { supabase } from '@/lib/supabase';

type ObsPoint = { date: string; value: number };

type ChartPoint = {
  month: string;
  macro: number | null;
  pyme: number | null;
};

export type PymeMetric =
  | 'net_cash_flow_clp'
  | 'avg_ticket_clp'
  | 'monthly_volume_clp'
  | 'cogs_clp';

interface Props {
  hypothesis: 'H1' | 'H2' | 'H3';
  macroTitle: string;
  macroLabel: string;
  macroUnit: string;
  pymeMetric: PymeMetric;
  pymeLabel: string;
  pymeUnit: string;
  companyRut?: string;
  monthsToShow?: number;
}

const tooltipStyle = {
  backgroundColor: '#12121A',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '10px',
  color: '#F0EFF8',
  fontSize: '12px',
};

const MACRO_COLOR = '#0EB5C6';
const PYME_COLOR  = '#F59E0B';

function minmax(points: ObsPoint[]): ObsPoint[] {
  const vals = points.map(p => p.value).filter(v => v != null) as number[];
  if (!vals.length) return points;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  return points.map(p => ({ ...p, value: +((p.value - min) / span * 100).toFixed(3) }));
}

export default function CorrelationChart({
  hypothesis,
  macroTitle,
  macroLabel,
  macroUnit,
  pymeMetric,
  pymeLabel,
  pymeUnit,
  companyRut,
  monthsToShow = 24,
}: Props) {
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasPyme, setHasPyme] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const { data: node } = await supabase
        .from('knowledge_nodes')
        .select('metadata')
        .eq('category', 'Macroeconomia')
        .eq('document_title', macroTitle)
        .maybeSingle();

      const rawObs: ObsPoint[] = (node?.metadata?.observaciones ?? [])
        .filter((o: { date: string; value: number | null }) => o.value != null)
        .sort((a: ObsPoint, b: ObsPoint) => a.date.localeCompare(b.date))
        .slice(-monthsToShow);

      const macroNorm = minmax(rawObs);
      const macroIndex: Record<string, number> = {};
      macroNorm.forEach(o => { macroIndex[o.date.slice(0, 7)] = o.value; });

      let pymeIndex: Record<string, number> = {};
      let foundPyme = false;

      if (companyRut) {
        const { data: pymeRows } = await supabase
          .from('pyme_financials')
          .select(`period, ${pymeMetric}`)
          .eq('company_rut', companyRut)
          .order('period', { ascending: true })
          .limit(monthsToShow);

        if (pymeRows?.length) {
          foundPyme = true;
          const pymeObs: ObsPoint[] = pymeRows
            .filter((r: Record<string, unknown>) => r[pymeMetric] != null)
            .map((r: Record<string, unknown>) => ({
              date: (r.period as string).slice(0, 7),
              value: r[pymeMetric] as number,
            }));

          const pymeNorm = minmax(pymeObs);
          pymeNorm.forEach(o => { pymeIndex[o.date] = o.value; });
        }
      }

      if (cancelled) return;

      const allMonths = Array.from(
        new Set([...Object.keys(macroIndex), ...Object.keys(pymeIndex)])
      ).sort();

      const combined: ChartPoint[] = allMonths.map(month => ({
        month,
        macro: macroIndex[month] ?? null,
        pyme:  pymeIndex[month]  ?? null,
      }));

      setData(combined);
      setHasPyme(foundPyme);
      setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [macroTitle, pymeMetric, companyRut, monthsToShow]);

  const hypothesisLabels = {
    H1: 'Sensibilidad al costo del dinero',
    H2: 'Traslado de precios (CPI vs. ticket)',
    H3: 'Elasticidad de demanda (PIB vs. volumen)',
  };

  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
      <div className="flex items-start justify-between mb-1">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#0EB5C6]">
            {hypothesis}
          </span>
          <p className="text-sm font-semibold text-gray-800 dark:text-[#F0EFF8] mt-0.5">
            {hypothesisLabels[hypothesis]}
          </p>
        </div>
        {!hasPyme && (
          <span className="text-[10px] text-amber-400 border border-amber-400/30 rounded-full px-2 py-0.5">
            Solo macro
          </span>
        )}
      </div>

      <p className="text-[11px] text-gray-400 dark:text-[#8B8AA0] mb-4">
        Escala normalizada 0–100 · últimos {monthsToShow} meses ·{' '}
        <span style={{ color: MACRO_COLOR }}>{macroLabel} ({macroUnit})</span>
        {hasPyme && <> vs <span style={{ color: PYME_COLOR }}>{pymeLabel} ({pymeUnit})</span></>}
      </p>

      {loading ? (
        <div className="h-52 flex items-center justify-center text-sm text-gray-400 animate-pulse">
          Cargando datos...
        </div>
      ) : data.length === 0 ? (
        <div className="h-52 flex items-center justify-center text-sm text-gray-400">
          Sin datos disponibles
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={data} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#8B8AA0' }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => (v as string).slice(0, 7)}
              interval="preserveStartEnd"
            />
            <YAxis
              yAxisId="normalized"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: '#8B8AA0' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              itemStyle={{ color: '#F0EFF8' }}
              labelStyle={{ color: '#8B8AA0', marginBottom: 4 }}
              formatter={(value, name) => [
                `${(value as number).toFixed(1)} (norm.)`,
                name === 'macro' ? macroLabel : pymeLabel,
              ]}
            />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: '11px', color: '#8B8AA0', paddingTop: '8px' }}
              formatter={(value) => value === 'macro' ? macroLabel : pymeLabel}
            />
            <Line
              yAxisId="normalized"
              type="monotone"
              dataKey="macro"
              stroke={MACRO_COLOR}
              strokeWidth={2}
              dot={false}
              connectNulls
              name="macro"
            />
            {hasPyme && (
              <Line
                yAxisId="normalized"
                type="monotone"
                dataKey="pyme"
                stroke={PYME_COLOR}
                strokeWidth={2}
                strokeDasharray="5 3"
                dot={false}
                connectNulls
                name="pyme"
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
