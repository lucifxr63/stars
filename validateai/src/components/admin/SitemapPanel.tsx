import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  BackgroundVariant,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// ── Node types ─────────────────────────────────────────────────────────────────

type PageType = 'public' | 'auth' | 'protected' | 'admin' | 'system';

interface PageMeta {
  id: string;
  path: string;
  label: string;
  description: string;
  type: PageType;
  x: number;
  y: number;
}

const TYPE_STYLES: Record<PageType, { bg: string; border: string; badge: string; dot: string }> = {
  public:    { bg: '#0D1F1A', border: '#34D399', badge: 'bg-emerald-500/10 text-emerald-400', dot: '#34D399' },
  auth:      { bg: '#1A1A0D', border: '#FBBF24', badge: 'bg-amber-500/10 text-amber-400',    dot: '#FBBF24' },
  protected: { bg: '#0F0F1F', border: '#7C6FF7', badge: 'bg-[#7C6FF7]/10 text-[#7C6FF7]',   dot: '#7C6FF7' },
  admin:     { bg: '#1F0D0D', border: '#F87171', badge: 'bg-red-500/10 text-red-400',         dot: '#F87171' },
  system:    { bg: '#111118', border: '#4B4A6A', badge: 'bg-gray-700/30 text-gray-400',       dot: '#4B4A6A' },
};

const TYPE_LABELS: Record<PageType, string> = {
  public:    'Público',
  auth:      'Auth',
  protected: 'Autenticado',
  admin:     'Admin',
  system:    'Sistema',
};

function PageNode({ data }: { data: PageMeta }) {
  const s = TYPE_STYLES[data.type];
  return (
    <div
      className="rounded-xl px-3 py-2.5 min-w-[160px] max-w-[200px] shadow-lg"
      style={{ background: s.bg, border: `1.5px solid ${s.border}` }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs font-bold text-[#F0EFF8] truncate">{data.label}</span>
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md shrink-0 ${s.badge}`}>
          {TYPE_LABELS[data.type]}
        </span>
      </div>
      <p className="text-[10px] text-[#8B8AA0] font-mono truncate">{data.path}</p>
      <p className="text-[10px] text-[#8B8AA0] mt-0.5 leading-snug">{data.description}</p>
    </div>
  );
}

const nodeTypes = { page: PageNode };

// ── Static navigation map ──────────────────────────────────────────────────────
// Layout: columns by user journey phase
// Col 0 (x=0):   Entry points (public)
// Col 1 (x=280): Auth flow
// Col 2 (x=560): Core app (protected)
// Col 3 (x=840): Detail views
// Col 4 (x=1120): Deep / admin

const PAGES: PageMeta[] = [
  // ── Public ─────────────────────────────────
  { id: 'landing',    path: '/',                  label: 'Landing',           description: 'Página principal y pitch',          type: 'public',    x: 0,    y: 0   },
  { id: 'pricing',    path: '/pricing',            label: 'Pricing',           description: 'Planes y precios',                  type: 'public',    x: 0,    y: 160 },
  { id: 'demo',       path: '/demo',               label: 'Demo',              description: 'Preview sin cuenta',                type: 'public',    x: 0,    y: 320 },
  { id: 'shared',     path: '/shared/:token',      label: 'Validación Pública',description: 'Resultado compartido (link único)', type: 'public',    x: 0,    y: 480 },

  // ── Auth ────────────────────────────────────
  { id: 'login',      path: '/login',              label: 'Login / Sign up',   description: 'Acceso con Google / email',         type: 'auth',      x: 300,  y: 0   },
  { id: 'callback',   path: '/auth/callback',      label: 'Auth Callback',     description: 'Intercambio PKCE + redirect',       type: 'system',    x: 300,  y: 160 },
  { id: 'figmacb',    path: '/figma/callback',     label: 'Figma Callback',    description: 'OAuth2 Figma → token exchange',     type: 'system',    x: 300,  y: 320 },

  // ── Core app ────────────────────────────────
  { id: 'validate',   path: '/validate',           label: 'Wizard Validación', description: 'Formulario multi-paso (6 steps)',   type: 'protected', x: 620,  y: 0   },
  { id: 'results',    path: '/results',            label: 'Mis Validaciones',  description: 'Historial de validaciones',         type: 'protected', x: 620,  y: 200 },

  // ── Detail views ────────────────────────────
  { id: 'detail',     path: '/results/:id',        label: 'Detalle Validación',description: '8 tabs: Veredicto → Due Diligence', type: 'protected', x: 940,  y: 100 },
  { id: 'history',    path: '/results/:id/history',label: 'Historial de Pivots',description: 'Versiones e iteraciones',          type: 'protected', x: 1260, y: 0   },
  { id: 'market',     path: '/market/:id',         label: 'Estudio de Mercado',description: 'Análisis TAM/SAM/SOM + mapa geo',   type: 'protected', x: 1260, y: 180 },

  // ── Admin ───────────────────────────────────
  { id: 'admin',      path: '/admin',              label: 'Admin Panel',       description: 'Métricas, usuarios, IA, Figma',     type: 'admin',     x: 620,  y: 400 },
];

const EDGES_DEF: Array<{
  source: string; target: string;
  label?: string;
  color?: string;
  dashed?: boolean;
}> = [
  // Landing → outbound
  { source: 'landing',  target: 'login',    label: 'CTA' },
  { source: 'landing',  target: 'pricing' },
  { source: 'landing',  target: 'demo' },

  // Pricing → Login
  { source: 'pricing',  target: 'login',    label: 'Upgrade' },

  // Demo → Login
  { source: 'demo',     target: 'login',    label: 'Registro' },

  // Auth flow
  { source: 'login',    target: 'callback', label: 'OAuth' },
  { source: 'callback', target: 'validate', label: 'SIGNED_IN' },

  // Figma OAuth
  { source: 'admin',    target: 'figmacb',  label: 'Conectar Figma', dashed: true },
  { source: 'figmacb',  target: 'admin',    label: 'token stored',   dashed: true },

  // Core flow
  { source: 'validate', target: 'results',  label: 'Completado' },
  { source: 'results',  target: 'detail' },
  { source: 'results',  target: 'validate', label: 'Nueva idea', dashed: true },

  // Detail → sub-views
  { source: 'detail',   target: 'history',  label: 'Ver historial' },
  { source: 'detail',   target: 'market',   label: 'Estudio mercado' },
  { source: 'detail',   target: 'shared',   label: 'Compartir', dashed: true },

  // Admin
  { source: 'login',    target: 'admin',    label: 'Admin only', dashed: true },
];

// ── Main component ─────────────────────────────────────────────────────────────

export function SitemapPanel() {
  const nodes: Node[] = useMemo(() =>
    PAGES.map((p) => ({
      id: p.id,
      type: 'page',
      position: { x: p.x, y: p.y },
      data: p,
    })),
    []
  );

  const edges: Edge[] = useMemo(() =>
    EDGES_DEF.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.dashed,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed, color: e.color ?? '#7C6FF7' },
      style: {
        stroke: e.color ?? '#7C6FF7',
        strokeWidth: 1.5,
        strokeDasharray: e.dashed ? '5 4' : undefined,
      },
      labelStyle: { fontSize: 10, fill: '#8B8AA0' },
      labelBgStyle: { fill: '#0D0C1A', fillOpacity: 0.9 },
      labelBgPadding: [4, 3] as [number, number],
    })),
    []
  );

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-[#F0EFF8]">
            Árbol de Navegación — ValidateAI
          </h2>
          <p className="text-xs text-gray-400 dark:text-[#8B8AA0] mt-0.5">
            {PAGES.length} rutas · {EDGES_DEF.length} transiciones · validateai-mu.vercel.app
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3">
          {(Object.entries(TYPE_STYLES) as [PageType, typeof TYPE_STYLES[PageType]][]).map(([type, s]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
              <span className="text-xs text-[#8B8AA0]">{TYPE_LABELS[type]}</span>
            </div>
          ))}
          <div className="flex items-center gap-1.5">
            <span className="w-6 border-t border-dashed border-[#7C6FF7]" />
            <span className="text-xs text-[#8B8AA0]">Flujo opcional</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Rutas públicas',      count: PAGES.filter(p => p.type === 'public').length,    color: '#34D399' },
          { label: 'Rutas protegidas',    count: PAGES.filter(p => p.type === 'protected').length, color: '#7C6FF7' },
          { label: 'Flujos de auth',      count: PAGES.filter(p => p.type === 'auth' || p.type === 'system').length, color: '#FBBF24' },
          { label: 'Transiciones totales', count: EDGES_DEF.length,                                color: '#F0EFF8' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-[#2A2940] bg-[#13121F] px-4 py-3">
            <p className="text-xl font-black" style={{ color: stat.color }}>{stat.count}</p>
            <p className="text-xs text-[#8B8AA0] mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="rounded-2xl overflow-hidden border border-[#2A2940]" style={{ height: 560 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          style={{ background: '#0D0C1A' }}
          minZoom={0.3}
          maxZoom={2}
        >
          <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#1E1D2E" />
          <Controls
            style={{ background: '#13121F', border: '1px solid #2A2940', borderRadius: 8 }}
            showInteractive={false}
          />
          <MiniMap
            style={{ background: '#13121F', border: '1px solid #2A2940', borderRadius: 8 }}
            nodeColor={(n) => TYPE_STYLES[(n.data as PageMeta).type]?.dot ?? '#4B4A6A'}
            maskColor="rgba(13,12,26,0.75)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
