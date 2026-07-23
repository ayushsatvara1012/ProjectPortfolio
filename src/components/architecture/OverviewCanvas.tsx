'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import FeatureNode from './nodes/FeatureNode';
import { architectureRegistry } from '@/src/content/architecture/registry';

const nodeTypes = { feature: FeatureNode };

// No minimap: the 8-feature map fits entirely in view, so a minimap is
// redundant here and only adds visual noise. Revisit in Phase 4 if the map grows.

// Fallback auto-layout for any entry without a curated position: a simple grid,
// so the map is never broken even before positions are hand-tuned.
function autoPosition(index: number) {
  return { x: (index % 3) * 300, y: Math.floor(index / 3) * 200 };
}

export default function OverviewCanvas() {
  const router = useRouter();
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const nodes = useMemo<Node[]>(
    () =>
      architectureRegistry.map((f, i) => ({
        id: f.id,
        type: 'feature',
        position: f.overview.position ?? autoPosition(i),
        data: {
          name: f.name,
          tagline: f.tagline,
          icon: f.overview.icon,
          group: f.overview.group,
          hasDetail: f.hasDetail,
        },
      })),
    [],
  );

  const edges = useMemo<Edge[]>(
    () =>
      architectureRegistry.flatMap((f) =>
        f.overview.connectsTo.map((target) => ({
          id: `${f.id}->${target}`,
          source: f.id,
          target,
          animated: !reducedMotion,
          style: { stroke: 'var(--color-slate-400, #94a3b8)', strokeWidth: 1.5 },
        })),
      ),
    [reducedMotion],
  );

  const onNodeClick = useCallback<NodeMouseHandler>(
    (_event, node) => {
      router.push(`/architecture/${node.id}`);
    },
    [router],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.4}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesFocusable={false}
        proOptions={{ hideAttribution: false }}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
