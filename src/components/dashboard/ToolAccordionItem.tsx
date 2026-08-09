'use client';

import React from 'react';

// One row on the Customise "Tools" tab (spec-finder-plan follow-up: tools moved
// out of a single long scroll into a selection list). Each row is collapsed by
// default and expands to reveal that tool's own config — new tools join by
// adding another item here, never by growing an existing one.

export type ToolStatusTone = 'active' | 'configured' | 'needs-setup';

const STATUS_STYLES: Record<ToolStatusTone, string> = {
  active: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20',
  configured: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  'needs-setup': 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
};

export function ToolStatusBadge({ label, tone }: { label: string; tone: ToolStatusTone }) {
  return (
    <span className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold font-google whitespace-nowrap ${STATUS_STYLES[tone]}`}>
      {label}
    </span>
  );
}

export default function ToolAccordionItem({
  icon,
  iconColor,
  title,
  description,
  status,
  open,
  onToggle,
  children,
}: {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  status: { label: string; tone: ToolStatusTone };
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden transition-colors">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
      >
        <span
          className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${iconColor}1A`, color: iconColor }}
        >
          <span className="material-symbols-outlined text-[17px]">{icon}</span>
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-semibold font-google text-slate-900 dark:text-slate-100">{title}</p>
          <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed truncate">{description}</p>
        </div>
        <ToolStatusBadge label={status.label} tone={status.tone} />
        <span className={`material-symbols-outlined text-[18px] text-slate-400 dark:text-slate-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          expand_more
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800">
          {children}
        </div>
      )}
    </div>
  );
}
