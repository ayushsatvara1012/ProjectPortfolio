'use client';

import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { FeatureGroup } from '@/src/content/architecture/types';

// One accent per group so the map reads as a designed system. Theme-aware.
const GROUP_ACCENT: Record<FeatureGroup, { icon: string; text: string; ring: string; glow: string }> = {
  ingestion: {
    icon: 'text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    ring: 'border-emerald-200 dark:border-emerald-800/70',
    glow: 'hover:shadow-emerald-200/50 dark:hover:shadow-emerald-900/40',
  },
  core: {
    icon: 'text-indigo-600 dark:text-indigo-400',
    text: 'text-indigo-700 dark:text-indigo-300',
    ring: 'border-indigo-200 dark:border-indigo-800/70',
    glow: 'hover:shadow-indigo-200/50 dark:hover:shadow-indigo-900/40',
  },
  delivery: {
    icon: 'text-sky-600 dark:text-sky-400',
    text: 'text-sky-700 dark:text-sky-300',
    ring: 'border-sky-200 dark:border-sky-800/70',
    glow: 'hover:shadow-sky-200/50 dark:hover:shadow-sky-900/40',
  },
  platform: {
    icon: 'text-slate-500 dark:text-slate-400',
    text: 'text-slate-600 dark:text-slate-300',
    ring: 'border-slate-200 dark:border-slate-700',
    glow: 'hover:shadow-slate-200/50 dark:hover:shadow-slate-800/40',
  },
};

export interface FeatureNodeData {
  name: string;
  tagline: string;
  icon: string;
  group: FeatureGroup;
  hasDetail: boolean;
  [key: string]: unknown;
}

export default function FeatureNode({ data }: NodeProps) {
  const d = data as FeatureNodeData;
  const accent = GROUP_ACCENT[d.group];

  return (
    <div
      className={`group relative w-56 cursor-pointer rounded-2xl border bg-white/95 px-4 py-3 shadow-sm backdrop-blur transition-shadow hover:shadow-lg dark:bg-slate-900/95 ${accent.ring} ${accent.glow}`}
    >
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-slate-300 dark:!bg-slate-600" />

      <div className="flex items-start gap-3">
        <span className={`material-symbols-outlined text-[22px] leading-none ${accent.icon}`} aria-hidden>
          {d.icon}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-slate-900 dark:text-white">{d.name}</p>
          <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">{d.tagline}</p>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className={`text-[10px] font-semibold uppercase tracking-wide ${accent.text}`}>{d.group}</span>
        <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-slate-400 transition-colors group-hover:text-slate-700 dark:group-hover:text-slate-200">
          {d.hasDetail ? 'Explore' : 'Coming soon'}
          <span className="material-symbols-outlined text-[14px] transition-transform group-hover:translate-x-0.5" aria-hidden>
            arrow_forward
          </span>
        </span>
      </div>

      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-slate-300 dark:!bg-slate-600" />
    </div>
  );
}
