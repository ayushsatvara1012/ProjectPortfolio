'use client';

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

const SkeletonLoader = {
  Stats: StatsSkeleton,
  Table: TableSkeleton,
  Base: SkeletonBase,
};

export default SkeletonLoader;
