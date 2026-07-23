'use client';

import { ReactFlow, Background, Controls, MiniMap, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import KindNode from './nodes/KindNode';
import type { FeatureArchitecture } from '@/src/content/architecture/types';

const nodeTypes = { kind: KindNode };

// Detail data-flow map (structure). Client-only by nature; loaded via the
// ssr:false wrapper so React Flow never enters the server shell or shared bundle.
export default function DataFlowCanvas({
  dataFlow,
}: {
  dataFlow: NonNullable<FeatureArchitecture['dataFlow']>;
}) {
  const nodes: Node[] = dataFlow.nodes.map((n, i) => ({
    id: n.id,
    type: 'kind',
    position: { x: (i % 3) * 240, y: Math.floor(i / 3) * 150 },
    data: { kind: n.kind, label: n.label, sub: n.sub },
  }));

  const edges: Edge[] = dataFlow.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.source,
    target: e.target,
    label: e.label,
    animated: e.animated,
  }));

  return (
    <div className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>
    </div>
  );
}
