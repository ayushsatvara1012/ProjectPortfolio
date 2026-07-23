'use client';

import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, MarkerType, type Node, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import KindNode from './nodes/KindNode';
import type { FeatureArchitecture, NodeKind } from '@/src/content/architecture/types';

const nodeTypes = { kind: KindNode };

// One color per kind, matching KindNode's own accents, so an edge's color
// identifies which component it originates from.
const KIND_COLOR: Record<NodeKind, string> = {
  client: '#0ea5e9',
  service: '#6366f1',
  datastore: '#10b981',
  llm: '#8b5cf6',
  queue: '#f59e0b',
  external: '#94a3b8',
};

const COL_GAP = 300;
const ROW_GAP = 140;

type DataFlow = NonNullable<FeatureArchitecture['dataFlow']>;

// Layered (Sugiyama-style) auto-layout: nodes are authored in logical flow
// order (a request/response pair like "api -> widget" after "widget -> api"
// is a deliberate back-edge, not a layout hint), so an edge counts as
// "forward" only when its target comes later in that authored order. Forward
// edges alone form a DAG by construction (author order is a strict total
// order), so a single left-to-right relaxation pass gives every node a
// layer with no cycle handling needed.
function computeLayout(nodes: DataFlow['nodes'], edges: DataFlow['edges']) {
  const indexOf = new Map(nodes.map((n, i) => [n.id, i]));
  const layer = new Map(nodes.map((n) => [n.id, 0]));

  for (const n of nodes) {
    const srcLayer = layer.get(n.id) ?? 0;
    for (const e of edges) {
      if (e.source !== n.id) continue;
      const si = indexOf.get(e.source);
      const ti = indexOf.get(e.target);
      if (si == null || ti == null || ti <= si) continue; // back-edge, skip for layering
      layer.set(e.target, Math.max(layer.get(e.target) ?? 0, srcLayer + 1));
    }
  }

  const byLayer = new Map<number, string[]>();
  for (const n of nodes) {
    const l = layer.get(n.id) ?? 0;
    byLayer.set(l, [...(byLayer.get(l) ?? []), n.id]);
  }

  const position = new Map<string, { x: number; y: number }>();
  for (const [l, ids] of byLayer) {
    // Stagger alternating layers by half a row so single-node layers never
    // sit perfectly collinear with their neighbors - every forward edge gets
    // a small vertical offset to bend around instead of running dead straight.
    const stagger = (l % 2) * (ROW_GAP / 2);
    ids.forEach((id, i) => {
      const centeredY = (i - (ids.length - 1) / 2) * ROW_GAP;
      position.set(id, { x: l * COL_GAP, y: centeredY + stagger });
    });
  }
  return { layer, position };
}

// Detail data-flow map (structure). Client-only by nature; loaded via the
// ssr:false wrapper so React Flow never enters the server shell or shared bundle.
export default function DataFlowCanvas({ dataFlow }: { dataFlow: DataFlow }) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  const kindById = useMemo(
    () => new Map(dataFlow.nodes.map((n) => [n.id, n.kind])),
    [dataFlow.nodes],
  );

  const layout = useMemo(
    () => computeLayout(dataFlow.nodes, dataFlow.edges),
    [dataFlow.nodes, dataFlow.edges],
  );

  const nodes = useMemo<Node[]>(
    () =>
      dataFlow.nodes.map((n) => ({
        id: n.id,
        type: 'kind',
        position: layout.position.get(n.id) ?? { x: 0, y: 0 },
        data: { kind: n.kind, label: n.label, sub: n.sub },
      })),
    [dataFlow.nodes, layout],
  );

  const edges = useMemo<Edge[]>(
    () =>
      dataFlow.edges.map((e, i) => {
        const color = KIND_COLOR[kindById.get(e.source) ?? 'external'];
        const srcLayer = layout.layer.get(e.source) ?? 0;
        const tgtLayer = layout.layer.get(e.target) ?? 0;

        // Forward edges (later layer) ride the main left-to-right flow via
        // left/right handles. Everything else - a response, a loop-back, a
        // sibling in the same layer - is a "return" edge: it routes via the
        // top or bottom handle pair instead, so it loops above or below the
        // row rather than doubling back through the forward path's anchors.
        let sourceHandle: string;
        let targetHandle: string;
        if (tgtLayer > srcLayer) {
          sourceHandle = 'right';
          targetHandle = 'left';
        } else {
          const srcY = layout.position.get(e.source)?.y ?? 0;
          const tgtY = layout.position.get(e.target)?.y ?? 0;
          if (tgtY <= srcY) {
            sourceHandle = 'top-out';
            targetHandle = 'top';
          } else {
            sourceHandle = 'bottom-out';
            targetHandle = 'bottom';
          }
        }

        return {
          id: `e-${i}`,
          source: e.source,
          target: e.target,
          sourceHandle,
          targetHandle,
          label: e.label,
          type: 'smoothstep',
          pathOptions: { borderRadius: 14 },
          animated: Boolean(e.animated) && !reducedMotion,
          style: { stroke: color, strokeWidth: 1.75 },
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
        };
      }),
    [dataFlow.edges, kindById, layout, reducedMotion],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        colorMode="system"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
      >
        <Background gap={20} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
