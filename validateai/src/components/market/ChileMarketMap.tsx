import { Suspense, useState, useMemo, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Globe, Users, Target, RotateCcw, Layers } from 'lucide-react';
import type { MarketSizing } from '@/types/validation';
import type { MapMetric } from './marketRegionConfig';
import { METRIC_COLORS } from './marketRegionConfig';
import { useChileGeo } from './useChileGeo';
import { useMarketDistribution } from './useMarketDistribution';
import { RegionMesh } from './RegionMesh';
import { MarketMapLegend } from './MarketMapLegend';

// ─── Escena 3D ────────────────────────────────────────────────────────────────
function MapScene({
  marketSizing,
  industry,
  metric,
}: {
  marketSizing: MarketSizing | null;
  industry: string | null;
  metric: MapMetric;
}) {
  const { shapes } = useChileGeo();
  const distribution = useMarketDistribution(marketSizing, industry, metric);

  const valueByCode = useMemo(() => {
    const map = new Map<string, (typeof distribution)[0]>();
    distribution.forEach(v => map.set(v.code, v));
    return map;
  }, [distribution]);

  return (
    <>
      {/* Iluminación cenital — más potente desde arriba para resaltar alturas */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[0, 0, 20]} intensity={1.4} />
      <directionalLight position={[3, 3, 10]} intensity={0.5} color="#c4b5fd" />
      <pointLight position={[0, 0, 15]} intensity={0.6} color="#ffffff" />

      {/* Mapa */}
      <group position={[0, 0, 0]}>
        {shapes.map(shape => (
          <RegionMesh
            key={shape.code || shape.name}
            regionShape={shape}
            marketValue={valueByCode.get(shape.code)}
            metric={metric}
          />
        ))}
      </group>
    </>
  );
}

// ─── Loading skeleton 3D ──────────────────────────────────────────────────────
function MapLoading() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: '#64748b',
        fontSize: '13px',
      }}
    >
      <div
        style={{
          width: '40px',
          height: '40px',
          border: '2px solid #334155',
          borderTopColor: '#3b82f6',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      <span>Cargando mapa de Chile…</span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── Selector de métrica ──────────────────────────────────────────────────────
const METRIC_OPTIONS: { key: MapMetric; icon: typeof Globe; label: string; sublabel: string }[] = [
  { key: 'TAM', icon: Globe,  label: 'TAM', sublabel: 'Total' },
  { key: 'SAM', icon: Users,  label: 'SAM', sublabel: 'Serviceable' },
  { key: 'SOM', icon: Target, label: 'SOM', sublabel: 'Obtenible' },
];

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  marketSizing: MarketSizing | null;
  industry: string | null;
}

export function ChileMarketMap({ marketSizing, industry }: Props) {
  const [metric, setMetric] = useState<MapMetric>('SAM');
  const [resetKey, setResetKey] = useState(0);
  const colors = METRIC_COLORS[metric];
  const distribution = useMarketDistribution(marketSizing, industry, metric);

  const handleReset = useCallback(() => setResetKey(k => k + 1), []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: '420px',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'radial-gradient(ellipse at 50% 20%, #0f172a 0%, #030712 100%)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {/* Header con selector de métrica */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          display: 'flex',
          gap: '6px',
          background: 'rgba(10,10,20,0.85)',
          backdropFilter: 'blur(12px)',
          borderRadius: '12px',
          padding: '4px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        {METRIC_OPTIONS.map(opt => {
          const Icon = opt.icon;
          const active = metric === opt.key;
          const c = METRIC_COLORS[opt.key];
          return (
            <button
              key={opt.key}
              onClick={() => setMetric(opt.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                background: active ? c.high : 'transparent',
                color: active ? 'white' : '#64748b',
                fontWeight: active ? 700 : 500,
                fontSize: '12px',
                boxShadow: active ? `0 2px 12px ${c.accent}40` : 'none',
              }}
            >
              <Icon size={13} />
              {opt.label}
              <span style={{ opacity: 0.7, fontSize: '10px' }}>{opt.sublabel}</span>
            </button>
          );
        })}
      </div>

      {/* Botón reset cámara */}
      <button
        onClick={handleReset}
        title="Restablecer cámara"
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 10,
          background: 'rgba(10,10,20,0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          padding: '7px',
          color: '#64748b',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'color 0.2s',
        }}
        onMouseOver={e => (e.currentTarget.style.color = colors.accent)}
        onMouseOut={e => (e.currentTarget.style.color = '#64748b')}
      >
        <RotateCcw size={14} />
      </button>

      {/* Hint de interacción */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          right: '16px',
          zIndex: 10,
          background: 'rgba(10,10,20,0.75)',
          backdropFilter: 'blur(8px)',
          borderRadius: '8px',
          padding: '6px 10px',
          color: '#475569',
          fontSize: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '5px',
          pointerEvents: 'none',
        }}
      >
        <Layers size={10} />
        Arrastra · Zoom · Hover
      </div>

      {/* Canvas 3D */}
      <Canvas
        key={resetKey}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        {/* Vista cenital: cámara casi perpendicular al plano del mapa.
            La extrusión sigue siendo visible como alturas relativas. */}
        <PerspectiveCamera makeDefault position={[0, -1.5, 18]} fov={42} />
        <OrbitControls
          enableDamping
          dampingFactor={0.06}
          minDistance={5}
          maxDistance={26}
          minPolarAngle={Math.PI / 10}
          maxPolarAngle={Math.PI / 2.2}
          target={[0, 0.5, 0]}
        />
        <Suspense fallback={null}>
          <MapScene marketSizing={marketSizing} industry={industry} metric={metric} />
        </Suspense>
      </Canvas>

      {/* Leyenda */}
      {distribution.length > 0 && (
        <MarketMapLegend metric={metric} data={distribution} />
      )}

      {/* Overlay si no hay datos */}
      {!marketSizing && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            color: '#475569',
            pointerEvents: 'none',
            zIndex: 5,
          }}
        >
          <Globe size={40} strokeWidth={1} />
          <span style={{ fontSize: '13px' }}>Sin datos de mercado disponibles</span>
        </div>
      )}
    </div>
  );
}
