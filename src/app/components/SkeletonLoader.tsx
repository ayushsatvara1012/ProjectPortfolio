'use client';

import { useState, useEffect } from 'react';

export const SkeletonBase = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-md ${className}`} />
);

export const StatsSkeleton = () => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
    {[1, 2, 3, 4, 5].map(i => (
      <div key={i} className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl flex flex-col justify-between h-[104px]">
        <div className="flex items-center gap-2 mb-3">
          <SkeletonBase className="w-3.5 h-3.5 rounded-md" />
          <SkeletonBase className="w-16 h-2.5" />
        </div>
        <SkeletonBase className="w-20 h-6 rounded-lg" />
      </div>
    ))}
  </div>
);

export const TableSkeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="w-full space-y-4">
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex items-center justify-between py-4 border-b border-slate-100 dark:border-slate-800/50">
        <div className="flex items-center gap-3 w-1/3">
          <SkeletonBase className="w-8 h-8 rounded-md" />
          <div className="space-y-1.5 grow">
            <SkeletonBase className="w-3/4 h-2.5" />
            <SkeletonBase className="w-1/2 h-2 opacity-50" />
          </div>
        </div>
        <SkeletonBase className="w-24 h-6 rounded-md" />
        <SkeletonBase className="w-8 h-8 rounded-md" />
      </div>
    ))}
  </div>
);

export const AppPageSkeleton = ({ pct: externalPct }: { pct?: number }) => {
  const [pct, setPct] = useState(0);
  const [done, setDone] = useState(false);
  const messages = ['Initializing page…', 'Authenticating identity…', 'Retrieving data…', 'Optimizing assets…'];

  useEffect(() => {
    if (externalPct !== undefined) {
      setPct(externalPct);
      if (externalPct >= 100) setTimeout(() => setDone(true), 300);
      return;
    }
    const interval = setInterval(() => {
      setPct(prev => {
        const next = Math.min(prev + Math.random() * 4 + 1, 100);
        if (next >= 100) {
          clearInterval(interval);
          setTimeout(() => setDone(true), 300);
        }
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [externalPct]);

  const msgIdx = Math.min(Math.floor(pct / 25), messages.length - 1);

  return (
    <div className="flex-1 flex items-center justify-center min-h-[50vh] p-8">
      <div className="flex flex-col items-center">
        <div className="w-72 h-3 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mb-6">
          <div
            className="h-full rounded-full transition-all duration-300 ease-out"
            style={{ width: `${pct.toFixed(1)}%`, background: 'linear-gradient(90deg, #0F2060 0%, #5730F5 100%)' }}
          />
        </div>
        {done ? (
          <span className="text-xl font-bold font-google text-slate-900 dark:text-slate-100 tracking-tight">Dashboard Ready</span>
        ) : (
          <span className="text-xl font-bold font-google text-slate-400 dark:text-slate-500 tracking-tight">
            {messages[msgIdx]} <span className="text-slate-900 dark:text-slate-100">{Math.round(pct)}%</span>
          </span>
        )}
      </div>
    </div>
  );
};

const SkeletonLoader = {
  Stats: StatsSkeleton,
  Table: TableSkeleton,
  Base: SkeletonBase,
  AppPage: AppPageSkeleton,
};

export default SkeletonLoader;
