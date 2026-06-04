import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  BackgroundVariant,
  MarkerType,
  type Node,
  type Edge,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { supabase } from '@/lib/supabase';
import { Network, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

// ── Types ─────────────────────────────────────────────────────────────────────

interface RawKnNode {
  document_title: string;
  category: string;
}

interface RawKnEdge {
  source_title: string;
  target_title: string;
}

interface DocNodeData extends Record<string, unknown> {
  label: string;
  category: string;
  degree: number;
  color: string;
}

interface VaultNode {
  document_title: string;
  header_path: string;
  content: string;
  category: string;
  tags: string[];
  source_file: string;
}

interface VaultEdge {
  source_title: string;
  target_title: string;
  relation_type: string;
}

// ── Category palette ──────────────────────────────────────────────────────────

const CAT: Record<string, { color: string; label: string }> = {
  normativa:   { color: '#3B82F6', label: 'Normativa' },
  metodologia: { color: '#10B981', label: 'Metodología' },
  mercado:     { color: '#F59E0B', label: 'Mercado' },
};

// ── Custom node ───────────────────────────────────────────────────────────────

function DocNode({ data }: { data: DocNodeData }) {
  const r = Math.max(8, Math.min(22, 8 + data.degree * 2.5));
  const glow = data.degree > 3 ? `0 0 ${r + 4}px ${data.color}55` : 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0, width: 1, height: 1 }} />
      <div
        style={{
          width: r * 2, height: r * 2, borderRadius: '50%',
          background: data.color + '22', border: `2px solid ${data.color}`,
          boxShadow: glow, flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: 9, color: '#9CA3AF', textAlign: 'center',
          maxWidth: 76, lineHeight: 1.3, display: 'block', wordBreak: 'break-word',
        }}
      >
        {data.label.length > 24 ? data.label.slice(0, 22) + '…' : data.label}
      </span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0, width: 1, height: 1 }} />
    </div>
  );
}

const NODE_TYPES: NodeTypes = { doc: DocNode };

// ── Radial-cluster layout ─────────────────────────────────────────────────────

const CLUSTERS: Record<string, { cx: number; cy: number; r: number }> = {
  normativa:   { cx: -480, cy: 0,  r: 270 },
  metodologia: { cx: 130,  cy: 0,  r: 420 },
  mercado:     { cx: 720,  cy: 0,  r: 140 },
};

function buildGraph(rawNodes: RawKnNode[], rawEdges: RawKnEdge[]) {
  const seen = new Set<string>();
  const unique: RawKnNode[] = [];
  rawNodes.forEach(n => {
    if (!seen.has(n.document_title)) { seen.add(n.document_title); unique.push(n); }
  });

  const degree = new Map<string, number>();
  unique.forEach(n => degree.set(n.document_title, 0));
  rawEdges.forEach(e => {
    degree.set(e.source_title, (degree.get(e.source_title) ?? 0) + 1);
    degree.set(e.target_title, (degree.get(e.target_title) ?? 0) + 1);
  });

  const byCategory = new Map<string, RawKnNode[]>();
  unique.forEach(n => {
    const cat = n.category || 'metodologia';
    const g = byCategory.get(cat) ?? [];
    g.push(n);
    byCategory.set(cat, g);
  });

  const nodes: Node[] = [];
  byCategory.forEach((group, cat) => {
    const cluster = CLUSTERS[cat] ?? { cx: 0, cy: 0, r: 200 };
    const color = CAT[cat]?.color ?? '#0EB5C6';
    group.forEach((n, i) => {
      const angle = (i / group.length) * 2 * Math.PI - Math.PI / 2;
      const deg = degree.get(n.document_title) ?? 0;
      const nodeR = Math.max(8, Math.min(22, 8 + deg * 2.5));
      nodes.push({
        id: n.document_title, type: 'doc',
        position: {
          x: cluster.cx + Math.cos(angle) * cluster.r - 40,
          y: cluster.cy + Math.sin(angle) * cluster.r - nodeR,
        },
        data: { label: n.document_title, category: cat, degree: deg, color } satisfies DocNodeData,
        style: { background: 'transparent', border: 'none', boxShadow: 'none', padding: 0, width: 80 },
      });
    });
  });

  const validIds = new Set(unique.map(n => n.document_title));
  const edges: Edge[] = rawEdges
    .filter(e => validIds.has(e.source_title) && validIds.has(e.target_title))
    .map((e, i) => ({
      id: `ke${i}`, source: e.source_title, target: e.target_title,
      style: { stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 },
      markerEnd: { type: MarkerType.ArrowClosed, width: 6, height: 6, color: 'rgba(255,255,255,0.18)' },
    }));

  return { nodes, edges };
}

// ── MD parser (client-side) ───────────────────────────────────────────────────

function parseMdFile(filename: string, raw: string, category: string): { nodes: VaultNode[]; edges: VaultEdge[] } {
  const sourceFile = filename.replace(/\.md$/i, '');

  // Extract frontmatter
  let titulo = sourceFile;
  let tags: string[] = [];
  let body = raw;
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fmMatch) {
    const fm = fmMatch[1];
    const tMatch = fm.match(/titulo:\s*(.+)/);
    if (tMatch) titulo = tMatch[1].trim();
    const tagsMatch = fm.match(/tags:\s*\[([^\]]*)\]/);
    if (tagsMatch) tags = tagsMatch[1].split(',').map(t => t.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean);
    body = raw.slice(fmMatch[0].length);
  }

  const nodes: VaultNode[] = [];
  const edges: VaultEdge[] = [];
  const seenEdges = new Set<string>();

  // Split by H2+ headings
  const sections = body.split(/\n(?=#{2,}\s)/);
  let isFirst = true;

  for (const section of sections) {
    const headerMatch = section.match(/^#{2,}\s+(.+)/);
    const header = headerMatch ? headerMatch[1].trim() : (isFirst ? 'Introduccion' : 'Contenido');
    const sectionRaw = headerMatch ? section.slice(headerMatch[0].length) : section;

    // Extract WikiLinks as edges
    const wikilinkRe = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    let m;
    while ((m = wikilinkRe.exec(sectionRaw)) !== null) {
      const target = m[1].trim();
      const key = `${titulo}::${target}`;
      if (target && target !== titulo && !seenEdges.has(key)) {
        seenEdges.add(key);
        edges.push({ source_title: titulo, target_title: target, relation_type: 'MENTIONS' });
      }
    }

    // Clean content
    const content = sectionRaw
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
      .replace(/\[\[([^\]]+)\]\]/g, '$1')
      .replace(/[#*_`]/g, '')
      .replace(/\n+/g, ' ')
      .trim();

    if (content.length > 20) {
      nodes.push({ document_title: titulo, header_path: header, content, category, tags, source_file: sourceFile });
    }
    isFirst = false;
  }

  return { nodes, edges };
}

// ── Component ─────────────────────────────────────────────────────────────────

export function KnowledgeGraph() {
  const [rawNodes, setRawNodes] = useState<RawKnNode[]>([]);
  const [rawEdges, setRawEdges] = useState<RawKnEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadCat, setUploadCat] = useState<'normativa' | 'metodologia' | 'mercado'>('metodologia');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [nodesRes, edgesRes] = await Promise.all([
      supabase.from('knowledge_nodes').select('document_title, category'),
      supabase.from('knowledge_edges').select('source_title, target_title'),
    ]);
    if (nodesRes.data) setRawNodes(nodesRes.data as RawKnNode[]);
    if (edgesRes.data) setRawEdges(edgesRes.data as RawKnEdge[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setUploading(true);
    try {
      const allNodes: VaultNode[] = [];
      const allEdges: VaultEdge[] = [];

      for (const file of files) {
        const text = await file.text();
        const { nodes, edges } = parseMdFile(file.name, text, uploadCat);
        allNodes.push(...nodes);
        allEdges.push(...edges);
      }

      if (allNodes.length === 0) {
        toast.error('No se encontró contenido válido en los archivos');
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const res = await fetch(`${supabaseUrl}/functions/v1/api-v1/vault/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ nodes: allNodes, edges: allEdges }),
      });

      const text2 = await res.text();
      let result: any;
      try { result = JSON.parse(text2); } catch { result = { raw: text2 }; }

      if (!res.ok) throw new Error(result.error ?? 'Error desconocido');

      toast.success(`${result.nodes_upserted} nodos sincronizados desde ${files.length} archivo${files.length > 1 ? 's' : ''}`);
      await load();
    } catch (err: any) {
      toast.error(`Error al subir: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [uploadCat, load]);

  const { nodes, edges } = useMemo(
    () => rawNodes.length ? buildGraph(rawNodes, rawEdges) : { nodes: [], edges: [] },
    [rawNodes, rawEdges],
  );

  const stats = useMemo(() => {
    const seenTitles = new Set<string>();
    const catCount: Record<string, number> = {};
    rawNodes.forEach(n => {
      if (!seenTitles.has(n.document_title)) {
        seenTitles.add(n.document_title);
        const cat = n.category || 'metodologia';
        catCount[cat] = (catCount[cat] ?? 0) + 1;
      }
    });
    return { totalDocs: seenTitles.size, catCount };
  }, [rawNodes]);

  return (
    <div className="bg-white dark:bg-[#12121A] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-gray-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-teal-400" />
          <span className="text-sm font-bold text-gray-900 dark:text-white">Knowledge Graph</span>
          {!loading && (
            <span className="text-xs bg-teal-500/10 text-teal-400 px-2 py-0.5 rounded-full font-medium">
              {stats.totalDocs} docs · {rawEdges.length} links
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-gray-400 mr-2">
            {Object.entries(CAT).map(([key, val]) => (
              <span key={key} className="flex items-center gap-1.5">
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: val.color, display: 'inline-block', flexShrink: 0 }} />
                {val.label}
                {!loading && <span className="text-gray-500">({stats.catCount[key] ?? 0})</span>}
              </span>
            ))}
          </div>

          {/* Upload control */}
          <select
            value={uploadCat}
            onChange={e => setUploadCat(e.target.value as typeof uploadCat)}
            disabled={uploading}
            className="text-xs bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-gray-600 dark:text-gray-300 focus:outline-none focus:ring-1 focus:ring-teal-500 disabled:opacity-50"
          >
            <option value="normativa">Normativa</option>
            <option value="metodologia">Metodología</option>
            <option value="mercado">Mercado</option>
          </select>

          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || loading}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? 'Subiendo…' : 'Subir .md'}
          </button>
        </div>
      </div>

      {/* Canvas */}
      {loading ? (
        <div className="h-[540px] flex items-center justify-center gap-2 text-sm text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando grafo…
        </div>
      ) : nodes.length === 0 ? (
        <div className="h-[540px] flex flex-col items-center justify-center gap-2 text-gray-400">
          <Network className="w-10 h-10 text-gray-300" />
          <p className="text-sm">Knowledge base vacío — sube archivos .md o sincroniza el vault</p>
          <code className="text-xs bg-gray-100 dark:bg-white/5 px-3 py-1 rounded-lg font-mono mt-1">
            npm run sync
          </code>
        </div>
      ) : (
        <div style={{ height: 540 }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            fitView
            fitViewOptions={{ padding: 0.1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnScroll
            minZoom={0.25}
            maxZoom={3}
            style={{ background: '#07070D' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={30} size={1} color="rgba(255,255,255,0.03)" />
            <Controls
              showInteractive={false}
              style={{ background: '#12121A', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
            />
            <MiniMap
              nodeColor={(n) => (n.data as DocNodeData).color ?? '#0EB5C6'}
              style={{ background: '#07070D', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
              maskColor="rgba(7,7,13,0.75)"
            />
          </ReactFlow>
        </div>
      )}
    </div>
  );
}
