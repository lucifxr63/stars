import { useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { RegionShape } from './useChileGeo';
import type { RegionMarketValue } from './useMarketDistribution';
import { formatMarketValue } from './useMarketDistribution';
import type { MapMetric } from './marketRegionConfig';
import { METRIC_COLORS } from './marketRegionConfig';

interface Props {
  regionShape: RegionShape;
  marketValue: RegionMarketValue | undefined;
  metric: MapMetric;
  minHeight?: number;
  maxHeight?: number;
}

function lerpColor(colorA: string, colorB: string, t: number): string {
  const parse = (hex: string) => {
    const n = parseInt(hex.replace('#', ''), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  };
  const [r1, g1, b1] = parse(colorA);
  const [r2, g2, b2] = parse(colorB);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export function RegionMesh({ regionShape, marketValue, metric, minHeight = 0.04, maxHeight = 1.6 }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const normalized = marketValue?.normalized ?? 0.1;
  const height = minHeight + normalized * (maxHeight - minHeight);
  const colors = METRIC_COLORS[metric];

  const color = useMemo(() => lerpColor(colors.low, colors.high, normalized), [colors, normalized]);
  const emissiveColor = useMemo(() => lerpColor('#000000', colors.accent, normalized * 0.4), [colors, normalized]);

  const extrudeSettings = useMemo(
    () => ({ depth: height, bevelEnabled: false }),
    [height]
  );

  const geometry = useMemo(
    () => new THREE.ExtrudeGeometry(regionShape.shape, extrudeSettings),
    [regionShape.shape, extrudeSettings]
  );

  const [cx, cy] = regionShape.centroid;

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <meshStandardMaterial
          color={hovered ? colors.accent : color}
          emissive={hovered ? colors.accent : emissiveColor}
          emissiveIntensity={hovered ? 0.5 : 0.15}
          roughness={0.6}
          metalness={0.1}
        />
      </mesh>

      {/* Tooltip en hover */}
      {hovered && (
        <Html
          position={[cx, cy, height + 0.15]}
          center
          distanceFactor={10}
          style={{ pointerEvents: 'none' }}
        >
          <div
            style={{
              background: 'rgba(10,10,20,0.92)',
              backdropFilter: 'blur(8px)',
              border: `1px solid ${colors.accent}40`,
              borderRadius: '10px',
              padding: '8px 12px',
              color: 'white',
              whiteSpace: 'nowrap',
              boxShadow: `0 4px 24px ${colors.accent}30`,
              fontSize: '11px',
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '12px', marginBottom: '2px', color: colors.accent }}>
              {regionShape.name}
            </div>
            <div style={{ color: '#e2e8f0' }}>
              <span style={{ opacity: 0.7 }}>{metric}: </span>
              <span style={{ fontWeight: 600 }}>{marketValue ? formatMarketValue(marketValue.rawValue) : 'N/D'}</span>
            </div>
            <div style={{ opacity: 0.5, fontSize: '10px', marginTop: '2px' }}>
              {marketValue ? `${(normalized * 100).toFixed(0)}% del máximo` : ''}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
