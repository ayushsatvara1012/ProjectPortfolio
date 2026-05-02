'use client';

import React, { useState } from 'react';
import { Cell, Label } from './components';

export const CoreProjectsCell = ({ projects }: { projects: { title: string, tech: string, result: string, tag: string }[] }) => {
  const [activeProject, setActiveProject] = useState<number | null>(null);

  return (
    <Cell className="lg:col-span-2">
      <Label icon="folder_open">Core Projects</Label>
      <div className="flex flex-col gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800">
        {projects.map((p, i) => (
          <button
            key={i}
            onClick={() => setActiveProject(activeProject === i ? null : i)}
            className={`
              w-full text-left bg-white dark:bg-slate-950 p-5 flex items-start justify-between gap-4
              transition-colors duration-150 group/row
              ${activeProject === i ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-900'}
            `}
          >
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-google font-bold uppercase tracking-widest px-1.5 py-0.5 border ${p.tag === 'LIVE' || p.tag === 'DEPLOYED'
                    ? 'border-green-200 dark:border-green-800 text-green-600 dark:text-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  }`}>
                  {p.tag}
                </span>
                <span className="text-base font-display font-bold text-slate-900 dark:text-slate-100 group-hover/row:text-blue-600 dark:group-hover/row:text-blue-400 transition-colors">
                  {p.title}
                </span>
              </div>
              {activeProject === i && (
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">
                  {p.tech}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs font-display font-bold text-green-600 dark:text-green-500 whitespace-nowrap">
                {p.result}
              </span>
              <span className={`material-symbols-outlined text-[16px] text-slate-300 dark:text-slate-700 transition-transform duration-200 ${activeProject === i ? 'rotate-90 text-blue-500' : 'group-hover/row:text-blue-500'}`}>
                chevron_right
              </span>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-auto pt-8">
        <div className="border border-dashed border-slate-200 dark:border-slate-800 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-400 mb-1">Founding Status</p>
            <p className="text-4xl font-display font-black text-slate-900 dark:text-slate-100 tracking-tight leading-none">
              100% Bootstrapped
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs font-google font-bold uppercase tracking-widest text-green-600 dark:text-green-500">Solo-built · NYC</span>
          </div>
        </div>
      </div>
    </Cell>
  );
};
