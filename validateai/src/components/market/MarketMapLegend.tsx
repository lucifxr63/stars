import type { MapMetric } from './marketRegionConfig';
import { METRIC_COLORS } from './marketRegionConfig';
import type { RegionMarketValue } from './useMarketDistribution';
import { formatMarketValue } from './useMarketDistribution';

interface Props {
  metric: MapMetric;
  data: RegionMarketValue[];
}

export function MarketMapLegend({ metric, data }: Props) {
  const colors = METRIC_COLORS[metric];

  // Top 5 regiones por valor
  const top5 = [...data]
    .sort((a, b) => b.rawValue - a.rawValue)
    .slice(0, 5);

  const metricLabels: Record<MapMetric, { label: string; desc: string }> = {
    TAM: { label: 'TAM', desc: 'Mercado Total Accesible' },
    SAM: { label: 'SAM', desc: 'Mercado Serviceable' },
    SOM: { label: 'SOM', desc: 'Mercado Obtenible' },
  };

  const info = metricLabels[metric];

  return (
    <div
      style={{
        position: 'absolute',
        bottom: '16px',
        left: '16px',
        background: 'rgba(10,10,20,0.85)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${colors.accent}30`,
        borderRadius: '14px',
        padding: '14px 16px',
        color: 'white',
        minWidth: '180px',
        pointerEvents: 'none',
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '10px' }}>
        <div
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: colors.accent,
          }}
        >
          {info.label}
        </div>
        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>{info.desc}</div>
      </div>

      {/* Gradiente de color */}
      <div style={{ marginBottom: '8px' }}>
        <div
          style={{
            height: '8px',
            borderRadius: '4px',
            background: `linear-gradient(to right, ${colors.low}, ${colors.high})`,
            marginBottom: '3px',
          }}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#64748b' }}>
          <span>Menor</span>
          <span>Mayor</span>
        </div>
      </div>

      {/* Top 5 regiones */}
      <div style={{ fontSize: '10px', color: '#64748b', marginBottom: '6px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        Top regiones
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {top5.map((r, i) => (
          <div key={r.code} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                color: '#1e293b',
                background: colors.accent,
                borderRadius: '4px',
                width: '16px',
                height: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i + 1}
            </span>
            <span style={{ fontSize: '10px', color: '#cbd5e1', flex: 1 }}>{r.shortName}</span>
            <span style={{ fontSize: '10px', fontWeight: 600, color: colors.accent }}>
              {formatMarketValue(r.rawValue)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
