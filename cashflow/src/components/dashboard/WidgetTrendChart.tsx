import { useId } from 'react';
import { AreaChart, Area, Tooltip, ResponsiveContainer, YAxis } from 'recharts';
import { formatCLPShort } from '@/lib/utils';
import { useTheme } from '@/store/theme';
import type { MetricTone } from '@/hooks/useDashboardMetricsPayload';

// Gráfico de tendencia compacto para los widgets del DashboardCanvas. Reemplaza
// el sparkline de barras CSS por recharts real (mismas convenciones que
// CashflowChart: theme-aware, formatCLPShort, sin Tailwind dentro del SVG).
// Stateless: recibe la serie cruda (`metric.trend`) y el tono; no hace fetch.

// recharts no consume utilidades de Tailwind → hex por tema, alineado a index.css.
const TONE_HEX: Record<'dark' | 'light', Record<MetricTone, string>> = {
  dark: { positive: '#10b981', negative: '#f43f5e', warning: '#fbbf24', neutral: '#8b5cf6' },
  light: { positive: '#059669', negative: '#e11d48', warning: '#d97706', neutral: '#7c3aed' },
};

interface Props {
  series: number[];
  tone?: MetricTone;
}

export function WidgetTrendChart({ series, tone = 'neutral' }: Props) {
  const dark = useTheme((s) => s.resolved === 'dark');
  // id único por instancia: evita colisión de <linearGradient> entre SVGs.
  const gradId = `wtc-${useId().replace(/:/g, '')}`;

  const color = TONE_HEX[dark ? 'dark' : 'light'][tone];
  const surface = dark ? '#0f172a' : '#ffffff';
  const grid = dark ? '#1e293b' : '#e2e8f0';
  const data = series.map((v, i) => ({ i, v }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <YAxis hide domain={['dataMin', 'dataMax']} />
        <Tooltip
          contentStyle={{ background: surface, border: `1px solid ${grid}`, borderRadius: 8, fontSize: 12, padding: '4px 8px' }}
          labelStyle={{ display: 'none' }}
          cursor={{ stroke: grid }}
          formatter={(v) => [formatCLPShort(Number(v)), ''] as [string, string]}
        />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={`url(#${gradId})`} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
