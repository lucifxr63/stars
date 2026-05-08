import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ANTHROPIC_API_KEY   = Deno.env.get('ANTHROPIC_API_KEY')!;
const SUPABASE_URL        = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_ORIGINS = [
  'https://validateai-mu.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  };
}

function json(data: unknown, status = 200, extra: HeadersInit = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  });
}

// ── Figma API types ────────────────────────────────────────────────────────────

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  interactions?: FigmaInteraction[];
  reactions?: FigmaInteraction[];
  transitionNodeID?: string;
}

interface FigmaInteraction {
  trigger: { type: string };
  action: {
    type: string;
    destinationId?: string;
    navigation?: string;
    transition?: { type: string; duration?: number };
    url?: string;
  };
}

interface ReactFlowNode {
  id: string;
  data: { label: string; figmaId: string; type?: string };
  position: { x: number; y: number };
  type: string;
}

interface ReactFlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: { triggerType: string; transitionType?: string; isExternal?: boolean };
}

// ── Graph processing ───────────────────────────────────────────────────────────

function extractFrames(
  node: FigmaNode,
  frames: Map<string, string> = new Map(),
  depth = 0
): Map<string, string> {
  if (node.type === 'FRAME' || node.type === 'COMPONENT') {
    frames.set(node.id, node.name);
  }
  if (depth < 3 && node.children) {
    for (const child of node.children) {
      extractFrames(child, frames, depth + 1);
    }
  }
  return frames;
}

function extractEdges(
  node: FigmaNode,
  knownFrameIds: Set<string>,
  edges: ReactFlowEdge[] = [],
  visited = new Set<string>()
): ReactFlowEdge[] {
  if (visited.has(node.id)) return edges;
  visited.add(node.id);

  const interactions = node.interactions ?? node.reactions ?? [];

  // Legacy transitionNodeID support
  if (node.transitionNodeID && knownFrameIds.has(node.transitionNodeID)) {
    edges.push({
      id: `e-${node.id}-${node.transitionNodeID}`,
      source: node.id,
      target: node.transitionNodeID,
      data: { triggerType: 'ON_CLICK' },
    });
  }

  for (const interaction of interactions) {
    const { trigger, action } = interaction;

    if (action.type === 'NODE' && action.destinationId) {
      if (knownFrameIds.has(action.destinationId)) {
        edges.push({
          id: `e-${node.id}-${action.destinationId}-${trigger.type}`,
          source: node.id,
          target: action.destinationId,
          label: trigger.type === 'ON_CLICK' ? undefined : trigger.type,
          data: {
            triggerType: trigger.type,
            transitionType: action.transition?.type,
          },
        });
      }
    }

    if (action.type === 'URL' && action.url) {
      edges.push({
        id: `e-ext-${node.id}-${btoa(action.url).slice(0, 8)}`,
        source: node.id,
        target: `external:${action.url}`,
        data: { triggerType: trigger.type, isExternal: true },
      });
    }
  }

  if (node.children) {
    for (const child of node.children) {
      extractEdges(child, knownFrameIds, edges, visited);
    }
  }

  return edges;
}

// Simple left-to-right hierarchical layout (Dagre-lite, no npm needed in Deno)
function applyLayout(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[]
): ReactFlowNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const inDegree = new Map(nodes.map((n) => [n.id, 0]));

  for (const edge of edges) {
    if (nodeMap.has(edge.target)) {
      inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
    }
  }

  // BFS ranking
  const ranks = new Map<string, number>();
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) { queue.push(id); ranks.set(id, 0); }
  }

  while (queue.length) {
    const curr = queue.shift()!;
    const rank = ranks.get(curr) ?? 0;
    for (const edge of edges) {
      if (edge.source === curr && nodeMap.has(edge.target) && !ranks.has(edge.target)) {
        ranks.set(edge.target, rank + 1);
        queue.push(edge.target);
      }
    }
  }

  // Assign positions grouped by rank
  const rankColumns = new Map<number, string[]>();
  for (const node of nodes) {
    const rank = ranks.get(node.id) ?? 0;
    const col = rankColumns.get(rank) ?? [];
    col.push(node.id);
    rankColumns.set(rank, col);
  }

  return nodes.map((node) => {
    const rank = ranks.get(node.id) ?? 0;
    const col = rankColumns.get(rank) ?? [];
    const rowIndex = col.indexOf(node.id);
    return {
      ...node,
      position: {
        x: rank * 280,
        y: rowIndex * 160,
      },
    };
  });
}

// ── AI analysis ────────────────────────────────────────────────────────────────

async function analyzeWithAI(
  nodes: ReactFlowNode[],
  edges: ReactFlowEdge[],
  fileName: string,
  appCategory?: string
): Promise<Record<string, unknown>> {
  const graphSummary = {
    total_screens: nodes.length,
    total_connections: edges.filter((e) => !e.data?.isExternal).length,
    external_links: edges.filter((e) => e.data?.isExternal).length,
    screens: nodes.map((n) => ({
      id: n.id,
      name: n.data.label,
      out_connections: edges.filter((e) => e.source === n.id && !e.data?.isExternal).length,
      in_connections: edges.filter((e) => e.target === n.id).length,
    })),
  };

  const prompt = `Eres un experto en UX y arquitectura de información. Analiza este mapa de navegación de una aplicación llamada "${fileName}"${appCategory ? ` (categoría: ${appCategory})` : ''}.

DATOS DEL GRAFO:
${JSON.stringify(graphSummary, null, 2)}

Proporciona un análisis estructurado en JSON con exactamente estas claves:
{
  "summary": "Resumen en 2 oraciones del estado general de la navegación",
  "health_score": número entre 0-100 que representa la calidad de la arquitectura de navegación,
  "critical_screens": ["lista de pantallas que son cuellos de botella (más de 3 conexiones entrantes)"],
  "orphan_screens": ["pantallas sin ninguna conexión de salida ni entrada — completamente aisladas"],
  "dead_ends": ["pantallas sin conexiones de salida (dead ends para el usuario)"],
  "insights": [
    {
      "type": "warning|info|error",
      "title": "título corto",
      "description": "descripción accionable"
    }
  ],
  "breadth_depth_ratio": "flat|balanced|deep — descripción del tipo de arquitectura",
  "recommendation": "Recomendación principal en 1-2 oraciones para mejorar el flujo"
}

Responde SOLO con el JSON, sin texto adicional.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Anthropic error: ${res.status}`);

  const data = await res.json() as { content: Array<{ text: string }> };
  const text = data.content[0]?.text ?? '{}';

  try {
    return JSON.parse(text);
  } catch {
    return { summary: text, health_score: null };
  }
}

// ── Main handler ───────────────────────────────────────────────────────────────

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const url = new URL(req.url);
  const path = url.pathname.split('/').pop();

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401, cors);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) return json({ error: 'Unauthorized' }, 401, cors);

    // POST /ai-figma-bridge/resolve-url
    // Extracts file key from a Figma URL and fetches basic file metadata
    if (req.method === 'POST' && path === 'resolve-url') {
      const { figma_url } = await req.json() as { figma_url: string };
      if (!figma_url) return json({ error: 'figma_url is required' }, 400, cors);

      // Extract key from URLs like:
      // https://www.figma.com/file/KEY/Name
      // https://www.figma.com/design/KEY/Name
      // https://www.figma.com/proto/KEY/Name
      const match = figma_url.match(/figma\.com\/(?:file|design|proto)\/([a-zA-Z0-9]+)/);
      if (!match) return json({ error: 'URL de Figma inválida. Usa el enlace del archivo desde Figma.' }, 400, cors);

      const fileKey = match[1];

      const { data: conn } = await supabase
        .from('figma_connections')
        .select('access_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!conn) return json({ error: 'No Figma connection found' }, 404, cors);

      // Fetch just the file name using depth=1 (minimal payload)
      const metaRes = await fetch(`https://api.figma.com/v1/files/${fileKey}?depth=1`, {
        headers: { Authorization: `Bearer ${conn.access_token}` },
      });

      if (!metaRes.ok) {
        if (metaRes.status === 403) return json({ error: 'Sin acceso a ese archivo. Asegúrate de ser colaborador en Figma.' }, 403, cors);
        if (metaRes.status === 404) return json({ error: 'Archivo no encontrado. Verifica la URL.' }, 404, cors);
        throw new Error(`Figma API error: ${metaRes.status}`);
      }

      const meta = await metaRes.json() as { name: string; version: string; document: { children: Array<{ id: string; name: string }> } };

      return json({
        file_key: fileKey,
        file_name: meta.name,
        pages: meta.document.children.map((p) => ({ id: p.id, name: p.name })),
      }, 200, cors);
    }

    // POST /ai-figma-bridge/scan
    // Crawls a Figma file and saves the navigation map
    if (req.method === 'POST' && path === 'scan') {
      const { file_key, page_id, validation_id, app_category } = await req.json() as {
        file_key: string;
        page_id?: string;
        validation_id?: string;
        app_category?: string;
      };

      if (!file_key) {
        return json({ error: 'file_key is required' }, 400, cors);
      }

      const { data: conn } = await supabase
        .from('figma_connections')
        .select('access_token')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!conn) return json({ error: 'No Figma connection found' }, 404, cors);

      const startTime = Date.now();

      // Fetch file structure (depth=2 to avoid massive payloads)
      const figmaUrl = `https://api.figma.com/v1/files/${file_key}?depth=2`;
      const figmaRes = await fetch(figmaUrl, {
        headers: { Authorization: `Bearer ${conn.access_token}` },
      });

      if (!figmaRes.ok) {
        const err = await figmaRes.text();
        throw new Error(`Figma file API error ${figmaRes.status}: ${err}`);
      }

      const figmaData = await figmaRes.json() as {
        name: string;
        version: string;
        document: FigmaNode;
      };

      // Find target page
      const pages = figmaData.document.children ?? [];
      const targetPage = page_id
        ? pages.find((p) => p.id === page_id)
        : pages[0];

      if (!targetPage) return json({ error: 'Page not found' }, 404, cors);

      // Extract frames (screens) from this page
      const framesMap = extractFrames(targetPage);
      const frameIds = new Set(framesMap.keys());

      // For frames with interactions, we need depth>2 — fetch their details
      const frameIdList = [...frameIds].join(',');
      let detailedNodes: FigmaNode[] = targetPage.children ?? [];

      if (frameIdList) {
        const detailRes = await fetch(
          `https://api.figma.com/v1/files/${file_key}/nodes?ids=${frameIdList}`,
          { headers: { Authorization: `Bearer ${conn.access_token}` } }
        );
        if (detailRes.ok) {
          const detailData = await detailRes.json() as {
            nodes: Record<string, { document: FigmaNode }>;
          };
          detailedNodes = Object.values(detailData.nodes).map((n) => n.document);
        }
      }

      // Build React Flow nodes
      const rfNodes: ReactFlowNode[] = [...framesMap.entries()].map(([id, name]) => ({
        id,
        type: 'screenNode',
        data: { label: name, figmaId: id },
        position: { x: 0, y: 0 },
      }));

      // Extract edges from all detailed nodes
      const rfEdges: ReactFlowEdge[] = [];
      for (const node of detailedNodes) {
        extractEdges(node, frameIds, rfEdges);
      }

      // Apply layout
      const positionedNodes = applyLayout(rfNodes, rfEdges);

      // AI analysis
      const aiInsights = await analyzeWithAI(
        positionedNodes,
        rfEdges,
        figmaData.name,
        app_category
      );

      // Persist or update map
      const { data: existingMap } = await supabase
        .from('figma_navigation_maps')
        .select('id')
        .eq('validation_id', validation_id)
        .eq('file_key', file_key)
        .maybeSingle();

      let mapId: string;

      if (existingMap) {
        await supabase
          .from('figma_navigation_maps')
          .update({
            page_id: targetPage.id,
            page_name: targetPage.name,
            version_id: figmaData.version,
            file_name: figmaData.name,
            nodes: positionedNodes,
            edges: rfEdges,
            ai_insights: aiInsights,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingMap.id);
        mapId = existingMap.id;
      } else {
        const { data: newMap, error: insertError } = await supabase
          .from('figma_navigation_maps')
          .insert({
            validation_id,
            user_id: user.id,
            file_key,
            file_name: figmaData.name,
            page_id: targetPage.id,
            page_name: targetPage.name,
            version_id: figmaData.version,
            nodes: positionedNodes,
            edges: rfEdges,
            ai_insights: aiInsights,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        mapId = newMap.id;
      }

      // Log the sync
      await supabase.from('figma_sync_logs').insert({
        map_id: mapId,
        user_id: user.id,
        status: 'success',
        nodes_count: positionedNodes.length,
        edges_count: rfEdges.length,
        duration_ms: Date.now() - startTime,
      });

      return json({
        map_id: mapId,
        file_name: figmaData.name,
        page_name: targetPage.name,
        nodes: positionedNodes,
        edges: rfEdges,
        ai_insights: aiInsights,
      }, 200, cors);
    }

    // GET /ai-figma-bridge/map?validation_id=xxx
    // Returns the stored map for a validation
    if (req.method === 'GET' && path === 'map') {
      const validationId = url.searchParams.get('validation_id');
      if (!validationId) return json({ error: 'validation_id required' }, 400, cors);

      const { data: map, error } = await supabase
        .from('figma_navigation_maps')
        .select('*')
        .eq('validation_id', validationId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!map) return json({ map: null }, 200, cors);

      return json({ map }, 200, cors);
    }

    return json({ error: 'Not found' }, 404, cors);

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[ai-figma-bridge]', msg);
    return json({ error: msg }, 500, cors);
  }
});
