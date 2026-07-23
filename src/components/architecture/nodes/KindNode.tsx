'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { NodeKind } from '@/src/content/architecture/types';

// One branded style + icon per node kind, so the data-flow map reads as a
// designed system rather than default gray boxes. Theme-aware in both modes.
const KIND_STYLE: Record<NodeKind, { icon: string; ring: string; chip: string }> = {
  client: { icon: 'devices', ring: 'border-sky-300 dark:border-sky-700', chip: 'text-sky-600 dark:text-sky-400' },
  service: { icon: 'bolt', ring: 'border-indigo-300 dark:border-indigo-700', chip: 'text-indigo-600 dark:text-indigo-400' },
  datastore: { icon: 'database', ring: 'border-emerald-300 dark:border-emerald-700', chip: 'text-emerald-600 dark:text-emerald-400' },
  llm: { icon: 'neurology', ring: 'border-violet-300 dark:border-violet-700', chip: 'text-violet-600 dark:text-violet-400' },
  queue: { icon: 'linear_scale', ring: 'border-amber-300 dark:border-amber-700', chip: 'text-amber-600 dark:text-amber-400' },
  external: { icon: 'cloud', ring: 'border-slate-300 dark:border-slate-700', chip: 'text-slate-600 dark:text-slate-400' },
};

export interface KindNodeData {
  kind: NodeKind;
  label: string;
  sub?: string;
  [key: string]: unknown;
}

export default function KindNode({ data }: NodeProps) {
  const d = data as KindNodeData;
  const style = KIND_STYLE[d.kind];
  return (
    <div className={`min-w-40 rounded-xl border bg-white px-3 py-2 shadow-sm dark:bg-slate-900 ${style.ring}`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-400" />
      <div className="flex items-center gap-2">
        <span className={`material-symbols-outlined text-[20px] ${style.chip}`} aria-hidden>
          {style.icon}
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{d.label}</p>
          {d.sub ? <p className="text-xs text-slate-500 dark:text-slate-400">{d.sub}</p> : null}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!bg-slate-400" />
    </div>
  );
}
