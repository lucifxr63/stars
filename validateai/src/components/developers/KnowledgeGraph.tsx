import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Network, Loader2, Upload, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────
interface RawKnNode { document_title: string; category: string }
interface RawKnEdge { source_title: string; target_title: string }
interface VaultNode { document_title: string; header_path: string; content: string; category: string; tags: string[]; source_file: string }
interface VaultEdge { source_title: string; target_title: string; relation_type: string }
interface PlacedNode { id: string; x: number; y: number; r: number; color: string; label: string; degree: number; isHub: boolean; category: string }
interface PlacedEdge { id: string; x1: number; y1: number; x2: number; y2: number; opacity: number }

const CAT: Record<string, { color: string; label: string }> = {
  normativa:   { color: '#3B82F6', label: 'Normativa' },
  metodologia: { color: '#10B981', label: 'Metodología' },
  mercado:     { color: '#F59E0B', label: 'Mercado' },
};

const CLUSTER_ORIGIN: Record<string, [number, number]> = {
  normativa:   [-1100, 0],
  metodologia: [   80, 0],
  mercado:     [ 1500, 0],
};

// Generous radii — enough space so 42 nodes don't overlap
const RINGS = [
  { r: 130, max: 6  },
  { r: 260, max: 12 },
  { r: 410, max: 20 },
  { r: 580, max: 28 },
  { r: 770, max: 38 },
  { r: 980, max: 50 },
];

// ── Layout ────────────────────────────────────────────────────────────────────
function placeInRings(nodes: Array<{ title: string; degree: number }>, cx: number, cy: number) {
  const sorted = [...nodes].sort((a, b) => b.degree - a.degree);
  const pos: Record<string, [number, number]> = {};
  let idx = 0;
  RINGS.forEach(({ r, max }, ringIdx) => {
    if (idx >= sorted.length) return;
    const count = Math.min(max, sorted.length - idx);
    // Stagger odd rings by half-step to break vertical alignment of hubs
    const baseAngle = -Math.PI / 2 + (ringIdx % 2 === 1 ? Math.PI / count : Math.PI / 8);
    for (let i = 0; i < count; i++) {
      const a = baseAngle + (i / count) * 2 * Math.PI;
      pos[sorted[idx++].title] = [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    }
  });
  for (; idx < sorted.length; idx++) {
    pos[sorted[idx].title] = [cx - 400 + (idx % 10) * 95, cy + 1050 + Math.floor(idx / 10) * 90];
  }
  return pos;
}

function buildGraph(rawNodes: RawKnNode[], rawEdges: RawKnEdge[], filterCat: string | null) {
  const seen = new Set<string>();
  const unique: RawKnNode[] = [];
  rawNodes.forEach(n => { if (!seen.has(n.document_title)) { seen.add(n.document_title); unique.push(n); } });

  const deg = new Map<string, number>();
  unique.forEach(n => deg.set(n.document_title, 0));
  rawEdges.forEach(e => {
    deg.set(e.source_title, (deg.get(e.source_title) ?? 0) + 1);
    deg.set(e.target_title, (deg.get(e.target_title) ?? 0) + 1);
  });

  const visible = filterCat ? unique.filter(n => n.category === filterCat) : unique;
  const visIds  = new Set(visible.map(n => n.document_title));

  const bycat = new Map<string, RawKnNode[]>();
  visible.forEach(n => { const c = n.category || 'metodologia'; bycat.set(c, [...(bycat.get(c) ?? []), n]); });

  const pos: Record<string, [number, number]> = {};
  bycat.forEach((grp, cat) => {
    const [cx, cy] = filterCat ? [0, 0] : (CLUSTER_ORIGIN[cat] ?? [0, 0]);
    Object.assign(pos, placeInRings(grp.map(n => ({ title: n.document_title, degree: deg.get(n.document_title) ?? 0 })), cx, cy));
  });

  const maxDeg = Math.max(1, ...Array.from(deg.values()));

  const nodes: PlacedNode[] = visible.map(n => {
    const d = deg.get(n.document_title) ?? 0;
    const cat = n.category || 'metodologia';
    const color = CAT[cat]?.color ?? '#0EB5C6';
    const r = Math.max(9, Math.min(20, 9 + (d / maxDeg) * 11));
    const [x, y] = pos[n.document_title] ?? [0, 0];
    return { id: n.document_title, x, y, r, color, label: n.document_title, degree: d, isHub: d >= 4, category: cat };
  });

  const posMap = new Map(nodes.map(n => [n.id, n]));
  const edges: PlacedEdge[] = [...rawEdges]
    .filter(e => visIds.has(e.source_title) && visIds.has(e.target_title))
    .sort((a, b) => ((deg.get(b.source_title) ?? 0) + (deg.get(b.target_title) ?? 0)) - ((deg.get(a.source_title) ?? 0) + (deg.get(a.target_title) ?? 0)))
    .slice(0, 180)
    .flatMap((e, i) => {
      const s = posMap.get(e.source_title), t = posMap.get(e.target_title);
      if (!s || !t) return [];
      const op = 0.04 + ((deg.get(e.source_title) ?? 0) / maxDeg) * 0.13;
      return [{ id: `e${i}`, x1: s.x, y1: s.y, x2: t.x, y2: t.y, opacity: op }];
    });

  return { nodes, edges };
}

// ── SVG renderer (no ReactFlow — eliminates handle-convergence artifacts) ─────
function GraphSVG({ nodes, edges }: { nodes: PlacedNode[]; edges: PlacedEdge[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [vp, setVp] = useState({ x: 0, y: 0, scale: 1 });
  const drag = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const fitView = useCallback(() => {
    if (!nodes.length || !svgRef.current) return;
    const W = svgRef.current.clientWidth || 960;
    const H = svgRef.current.clientHeight || 580;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs) - 80, maxX = Math.max(...xs) + 80;
    const minY = Math.min(...ys) - 80, maxY = Math.max(...ys) + 80;
    const scale = Math.min(W / (maxX - minX), H / (maxY - minY)) * 0.9;
    setVp({ scale, x: W / 2 - ((minX + maxX) / 2) * scale, y: H / 2 - ((minY + maxY) / 2) * scale });
  }, [nodes]);

  useEffect(() => { fitView(); }, [fitView]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const f = e.deltaY < 0 ? 1.12 : 0.89;
    setVp(v => {
      const ns = Math.max(0.05, Math.min(8, v.scale * f));
      const rect = svgRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      return { scale: ns, x: mx - (mx - v.x) * (ns / v.scale), y: my - (my - v.y) * (ns / v.scale) };
    });
  }, []);

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    drag.current = { sx: e.clientX, sy: e.clientY, ox: vp.x, oy: vp.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!drag.current) return;
    setVp(v => ({ ...v, x: drag.current!.ox + e.clientX - drag.current!.sx, y: drag.current!.oy + e.clientY - drag.current!.sy }));
  };
  const onMouseUp = () => { drag.current = null; };
  const zoom = (f: number) => setVp(v => ({ ...v, scale: Math.max(0.05, Math.min(8, v.scale * f)) }));

  const hovNode = hovered ? nodes.find(n => n.id === hovered) : null;

  return (
    <div style={{ position: 'relative', height: 580, background: '#07070D', userSelect: 'none' }}>
      <svg ref={svgRef} width="100%" height="100%"
        style={{ cursor: drag.current ? 'grabbing' : 'grab', display: 'block' }}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
        <defs>
          <pattern id="kgdots" width="30" height="30" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="rgba(255,255,255,0.022)" />
          </pattern>
          {Object.keys(CAT).map(k => (
            <filter key={k} id={`kgg-${k}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          ))}
        </defs>

        <rect width="100%" height="100%" fill="url(#kgdots)" />

        <g transform={`translate(${vp.x},${vp.y}) scale(${vp.scale})`}>
          {/* Edges — plain <line>, no ReactFlow handle artifacts */}
          {edges.map(e => (
            <line key={e.id} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
              stroke={`rgba(255,255,255,${e.opacity.toFixed(3)})`}
              strokeWidth={Math.max(0.5, 1 / vp.scale)} />
          ))}

          {/* Nodes */}
          {nodes.map(n => (
            <g key={n.id} transform={`translate(${n.x},${n.y})`}
              onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}>
              {n.isHub && <circle r={n.r + 6} fill={n.color + '15'} />}
              <circle r={n.r}
                fill={n.color + (n.isHub ? '28' : '12')}
                stroke={n.color + (n.isHub ? 'BB' : '66')}
                strokeWidth={n.isHub ? 1.8 : 1.2}
                filter={n.isHub ? `url(#kgg-${n.category})` : undefined} />
              <text y={n.r + 11} textAnchor="middle" fontSize={8.5}
                fill={n.isHub ? '#BFC4CF' : '#4E535E'}
                fontWeight={n.isHub ? 600 : 400}
                fontFamily="'DM Sans',system-ui,sans-serif"
                style={{ pointerEvents: 'none' }}>
                {n.label.length > 22 ? n.label.slice(0, 20) + '…' : n.label}
              </text>
            </g>
          ))}
        </g>
      </svg>

      {/* Zoom buttons */}
      <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[{ el: <ZoomIn className="w-3.5 h-3.5" />, fn: () => zoom(1.25) },
          { el: <ZoomOut className="w-3.5 h-3.5" />, fn: () => zoom(0.8) },
          { el: <Maximize2 className="w-3.5 h-3.5" />, fn: fitView }].map((b, i) => (
          <button key={i} onClick={b.fn}
            style={{ width: 28, height: 28, background: '#1A1A24', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 6, color: '#9CA3AF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {b.el}
          </button>
        ))}
      </div>

      {/* Hover card */}
      {hovNode && (
        <div style={{ position: 'absolute', bottom: 14, left: 14, maxWidth: 240, background: '#13131D', border: `1px solid ${hovNode.color}44`, borderRadius: 8, padding: '8px 12px', pointerEvents: 'none' }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: hovNode.color, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {CAT[hovNode.category]?.label}
          </div>
          <div style={{ fontSize: 12, color: '#E5E7EB', lineHeight: 1.4 }}>{hovNode.label}</div>
          <div style={{ fontSize: 10, color: '#4B5563', marginTop: 3 }}>{hovNode.degree} conexiones</div>
        </div>
      )}
    </div>
  );
}

// ── MD parser ─────────────────────────────────────────────────────────────────
function parseMdFile(filename: string, raw: string, category: string): { nodes: VaultNode[]; edges: VaultEdge[] } {
  const sourceFile = filename.replace(/\.md$/i, '');
  let titulo = sourceFile, tags: string[] = [], body = raw;
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const tM = fm.match(/titulo:\s*(.+)/); if (tM) titulo = tM[1].trim();
    const taM = fm.match(/tags:\s*\[([^\]]*)\]/);
    if (taM) tags = taM[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    body = raw.slice(fmMatch[0].length);
  }
  const nodes: VaultNode[] = [], edges: VaultEdge[] = [], seenE = new Set<string>();
  let isFirst = true;
  for (const section of body.split(/\n(?=#{2,}\s)/)) {
    const hM = section.match(/^#{2,}\s+(.+)/);
    const header = hM ? hM[1].trim() : (isFirst ? 'Introduccion' : 'Contenido');
    const sRaw = hM ? section.slice(hM[0].length) : section;
    const re = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g; let m;
    while ((m = re.exec(sRaw)) !== null) {
      const t = m[1].trim(), k = `${titulo}::${t}`;
      if (t && t !== titulo && !seenE.has(k)) { seenE.add(k); edges.push({ source_title: titulo, target_title: t, relation_type: 'MENTIONS' }); }
    }
    const content = sRaw.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/[#*_`]/g, '').replace(/\n+/g, ' ').trim();
    if (content.length > 20) nodes.push({ document_title: titulo, header_path: header, content, category, tags, source_file: sourceFile });
    isFirst = false;
  }
  return { nodes, edges };
}

// ── Component ─────────────────────────────────────────────────────────────────
export function KnowledgeGraph() {
  const [rawNodes,  setRawNodes]  = useState<RawKnNode[]>([]);
  const [rawEdges,  setRawEdges]  = useState<RawKnEdge[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCat, setUploadCat] = useState<'normativa' | 'metodologia' | 'mercado'>('metodologia');
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [nR, eR] = await Promise.all([
      supabase.from('knowledge_nodes').select('document_title, category'),
      supabase.from('knowledge_edges').select('source_title, target_title'),
    ]);
    if (nR.data) setRawNodes(nR.data as RawKnNode[]);
    if (eR.data) setRawEdges(eR.data as RawKnEdge[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    try {
      const allN: VaultNode[] = [], allE: VaultEdge[] = [];
      for (const f of files) { const { nodes, edges } = parseMdFile(f.name, await f.text(), uploadCat); allN.push(...nodes); allE.push(...edges); }
      if (!allN.length) { toast.error('Sin contenido válido'); return; }
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/api-v1/vault/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
        body: JSON.stringify({ nodes: allN, edges: allE }),
      });
      const txt = await res.text();
      let r: any; try { r = JSON.parse(txt); } catch { r = { raw: txt }; }
      if (!res.ok) throw new Error(r.error ?? 'Error');
      toast.success(`${r.nodes_upserted} nodos sincronizados`);
      await load();
    } catch (err: any) { toast.error(`Error: ${err.message}`); }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = ''; }
  }, [uploadCat, load]);

  const { nodes, edges } = useMemo(
    () => rawNodes.length ? buildGraph(rawNodes, rawEdges, filterCat) : { nodes: [], edges: [] },
    [rawNodes, rawEdges, filterCat],
  );

  const stats = useMemo(() => {
    const s = new Set<string>(); const cc: Record<string, number> = {};
    rawNodes.forEach(n => { if (!s.has(n.document_title)) { s.add(n.document_title); cc[n.category || 'metodologia'] = (cc[n.category || 'metodologia'] ?? 0) + 1; } });
    return { totalDocs: s.size, catCount: cc };
  }, [rawNodes]);

  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2 flex-wrap">
          <Network className="w-4 h-4 text-teal-400 shrink-0" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">Knowledge Graph</span>
          {!loading && (
            <span className="text-xs bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full font-medium">
              {stats.totalDocs} docs · {rawEdges.length} links
            </span>
          )}
          {/* Category filter pills */}
          <div className="flex items-center gap-1 ml-1">
            {(['all', 'normativa', 'metodologia', 'mercado'] as const).map(k => {
              const isAll = k === 'all', active = isAll ? !filterCat : filterCat === k;
              const color = isAll ? '#6B7280' : CAT[k].color;
              const label = isAll ? 'Todos' : CAT[k].label;
              const count = isAll ? stats.totalDocs : (stats.catCount[k] ?? 0);
              return (
                <button key={k} onClick={() => setFilterCat(isAll ? null : (filterCat === k ? null : k))}
                  className="text-xs px-2.5 py-0.5 rounded-full transition-all flex items-center gap-1 cursor-pointer"
                  style={{ background: active ? color + '22' : 'transparent', border: `1px solid ${active ? color + '55' : 'transparent'}`, color: active ? '#E5E7EB' : '#6B7280', fontWeight: active ? 600 : 400 }}>
                  {!isAll && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />}
                  {label} {!loading && <span style={{ opacity: 0.5 }}>({count})</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select value={uploadCat} onChange={e => setUploadCat(e.target.value as typeof uploadCat)} disabled={uploading}
            className="text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-gray-600 dark:text-gray-300 focus:outline-none disabled:opacity-50">
            <option value="normativa">Normativa</option>
            <option value="metodologia">Metodología</option>
            <option value="mercado">Mercado</option>
          </select>
          <input ref={fileInputRef} type="file" accept=".md" multiple className="hidden" onChange={handleUpload} />
          <button onClick={() => fileInputRef.current?.click()} disabled={uploading || loading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors disabled:opacity-50">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Subiendo…' : 'Subir .md'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-[580px] flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando grafo…
        </div>
      ) : nodes.length === 0 ? (
        <div className="h-[580px] flex flex-col items-center justify-center gap-2 text-gray-400">
          <Network className="w-10 h-10 text-gray-300" />
          <p className="text-sm">Knowledge base vacío</p>
        </div>
      ) : (
        <GraphSVG nodes={nodes} edges={edges} />
      )}
    </div>
  );
}
