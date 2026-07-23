'use client';

import { useEffect, useState } from 'react';
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
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

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
    animated: Boolean(e.animated) && !reducedMotion,
  }));

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
        <MiniMap pannable zoomable className="!hidden sm:!block" />
      </ReactFlow>
    </div>
  );
}
