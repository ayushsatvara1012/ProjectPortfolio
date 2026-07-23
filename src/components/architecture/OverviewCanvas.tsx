'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import FeatureNode from './nodes/FeatureNode';
import { architectureRegistry } from '@/src/content/architecture/registry';
import type { FeatureGroup } from '@/src/content/architecture/types';

const nodeTypes = { feature: FeatureNode };

// One color per group, matching FeatureNode's accents, so an edge's color
// identifies which feature it originates from at a glance.
const EDGE_COLOR: Record<FeatureGroup, string> = {
  ingestion: '#10b981',
  core: '#6366f1',
  delivery: '#0ea5e9',
  platform: '#94a3b8',
};

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
        f.overview.connectsTo.map((target) => {
          const color = EDGE_COLOR[f.overview.group];
          return {
            id: `${f.id}->${target}`,
            source: f.id,
            target,
            type: 'smoothstep',
            pathOptions: { borderRadius: 16 },
            animated: !reducedMotion,
            style: { stroke: color, strokeWidth: 1.75 },
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
          };
        }),
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
        colorMode="system"
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.3}
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
