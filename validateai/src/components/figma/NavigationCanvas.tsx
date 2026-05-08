import { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type NodeTypes,
  type Node,
  type Edge,
  BackgroundVariant,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { ReactFlowNodeData, ReactFlowEdgeData } from './FigmaPanel';

interface Props {
  nodes: ReactFlowNodeData[];
  edges: ReactFlowEdgeData[];
}

function ScreenNode({ data }: { data: { label: string } }) {
  return (
    <div className="px-3 py-2 rounded-xl border border-[#7C6FF7]/40 bg-[#13121F] shadow-lg shadow-black/30 min-w-[120px] max-w-[180px]">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className="w-1.5 h-1.5 rounded-full bg-[#7C6FF7] shrink-0" />
        <p className="text-xs font-semibold text-[#F0EFF8] truncate leading-tight">
          {data.label}
        </p>
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  screenNode: ScreenNode,
};

const EDGE_COLORS: Record<string, string> = {
  ON_CLICK:    '#7C6FF7',
  AFTER_DELAY: '#FBBF24',
  ON_HOVER:    '#34D399',
  default:     '#4B4A6A',
};

export function NavigationCanvas({ nodes: rawNodes, edges: rawEdges }: Props) {
  const nodes: Node[] = useMemo(() =>
    rawNodes.map((n) => ({
      id: n.id,
      type: n.type ?? 'screenNode',
      position: n.position,
      data: n.data,
    })),
    [rawNodes]
  );

  const edges: Edge[] = useMemo(() =>
    rawEdges
      .filter((e) => !e.data?.isExternal)
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.data?.triggerType === 'AFTER_DELAY',
        markerEnd: { type: MarkerType.ArrowClosed, color: EDGE_COLORS[e.data?.triggerType ?? 'default'] ?? EDGE_COLORS.default },
        style: {
          stroke: EDGE_COLORS[e.data?.triggerType ?? 'default'] ?? EDGE_COLORS.default,
          strokeWidth: 1.5,
        },
        labelStyle: { fontSize: 10, fill: '#8B8AA0' },
        labelBgStyle: { fill: '#13121F' },
      })),
    [rawEdges]
  );

  const onInit = useCallback((instance: { fitView: () => void }) => {
    instance.fitView();
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="rounded-2xl border border-[#2A2940] bg-[#13121F] h-64 flex items-center justify-center">
        <p className="text-sm text-[#8B8AA0]">No se detectaron pantallas en este archivo.</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden border border-[#2A2940]"
      style={{ height: 480 }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        proOptions={{ hideAttribution: true }}
        style={{ background: '#0D0C1A' }}
        defaultEdgeOptions={{ type: 'smoothstep' }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#2A2940"
        />
        <Controls
          style={{ background: '#13121F', border: '1px solid #2A2940', borderRadius: 8 }}
          showInteractive={false}
        />
        <MiniMap
          style={{ background: '#13121F', border: '1px solid #2A2940', borderRadius: 8 }}
          nodeColor="#7C6FF7"
          maskColor="rgba(13,12,26,0.7)"
        />
      </ReactFlow>
    </div>
  );
}
