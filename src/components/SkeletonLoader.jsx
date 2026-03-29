import React from 'react';

/**
 * Skeleton UI Components
 * ──────────────────────
 * High-precision placeholders for Bento-grid layouts.
 * Optimized for mobile-first responsiveness.
 */

export const SkeletonBase = ({ className = "" }) => (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-800 rounded-md ${className}`} />
);

export const StatsSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 p-4 sm:p-5 rounded-xl flex flex-col justify-between h-[104px]">
                <div className="flex items-center gap-2 mb-3">
                    <SkeletonBase className="w-3.5 h-3.5 rounded-md" />
                    <SkeletonBase className="w-16 h-2.5" />
                </div>
                <SkeletonBase className="w-20 h-6 rounded-lg" />
            </div>
        ))}
    </div>
);

export const FormSkeleton = () => (
    <div className="space-y-6 h-[352px] pt-4">
        <div className="space-y-2">
            <SkeletonBase className="w-32 h-2.5" />
            <SkeletonBase className="w-full h-10 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <SkeletonBase className="w-24 h-2.5" />
                <SkeletonBase className="w-full h-10 rounded-md" />
            </div>
            <div className="space-y-2">
                <SkeletonBase className="w-24 h-2.5" />
                <SkeletonBase className="w-full h-10 rounded-md" />
            </div>
        </div>
        <SkeletonBase className="w-full h-11 rounded-md mt-4" />
    </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
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

export const BentoCardSkeleton = ({ className = "" }) => (
    <div className={`bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 p-5 rounded-xl ${className}`}>
        <div className="flex justify-between items-start mb-6">
            <SkeletonBase className="w-8 h-8 rounded-md" />
            <SkeletonBase className="w-20 h-5 rounded-md" />
        </div>
        <SkeletonBase className="w-3/4 h-6 mb-4" />
        <SkeletonBase className="w-full h-16 mb-6" />
        <div className="flex gap-2">
            <SkeletonBase className="w-12 h-3" />
            <SkeletonBase className="w-12 h-3" />
        </div>
    </div>
);

export const CardSkeleton = ({ className = "" }) => (
    <div className={`bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 p-4 rounded-xl h-[160px] ${className}`}>
        <div className="flex items-center gap-2 mb-6">
            <SkeletonBase className="w-3.5 h-3.5 rounded-md" />
            <SkeletonBase className="w-20 h-2.5" />
        </div>
        <div className="flex items-end gap-2 mb-5">
            <SkeletonBase className="w-24 h-8 rounded-md" />
            <SkeletonBase className="w-10 h-2.5 mb-1.5" />
        </div>
        <SkeletonBase className="w-full h-1.5 rounded-full mb-3" />
        <div className="flex justify-between">
            <SkeletonBase className="w-14 h-2" />
            <SkeletonBase className="w-16 h-2" />
        </div>
    </div>
);

export const AppPageSkeleton = () => (
    <div className="space-y-6 animate-pulse">
        {/* Page heading */}
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <SkeletonBase className="w-5 h-5 rounded-md" />
                <SkeletonBase className="w-40 h-5 rounded-md" />
            </div>
            <SkeletonBase className="w-72 h-3.5 rounded" />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
                <div key={i} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2">
                        <SkeletonBase className="w-3.5 h-3.5 rounded" />
                        <SkeletonBase className="w-20 h-2.5 rounded" />
                    </div>
                    <SkeletonBase className="w-24 h-7 rounded-md" />
                </div>
            ))}
        </div>

        {/* Main content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left card — form skeleton */}
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5">
                <SkeletonBase className="w-36 h-3.5 rounded" />
                {/* Tab bar */}
                <div className="flex gap-2">
                    {[60, 80, 80].map((w, i) => (
                        <SkeletonBase key={i} className={`h-8 w-${w > 70 ? '20' : '16'} rounded-md`} />
                    ))}
                </div>
                {/* Field */}
                <div className="space-y-2">
                    <SkeletonBase className="w-24 h-2.5 rounded" />
                    <SkeletonBase className="w-full h-10 rounded-lg" />
                </div>
                <div className="space-y-2">
                    <SkeletonBase className="w-20 h-2.5 rounded" />
                    <SkeletonBase className="w-full h-10 rounded-lg" />
                </div>
                <SkeletonBase className="w-full h-11 rounded-lg mt-2" />
            </div>

            {/* Right column */}
            <div className="lg:col-span-5 space-y-4">
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-2">
                        <SkeletonBase className="w-3.5 h-3.5 rounded" />
                        <SkeletonBase className="w-20 h-2.5 rounded" />
                    </div>
                    <SkeletonBase className="w-16 h-8 rounded-md" />
                    <SkeletonBase className="w-full h-2 rounded-full" />
                    <div className="flex justify-between">
                        <SkeletonBase className="w-12 h-2 rounded" />
                        <SkeletonBase className="w-16 h-2 rounded" />
                    </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                    {[1,2,3].map(i => (
                        <div key={i} className="flex items-center gap-3">
                            <SkeletonBase className="w-5 h-5 rounded-full shrink-0" />
                            <SkeletonBase className="flex-1 h-3 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    </div>
);

const SkeletonLoader = {
    Stats: StatsSkeleton,
    Form: FormSkeleton,
    Table: TableSkeleton,
    Bento: BentoCardSkeleton,
    Card: CardSkeleton,
    Base: SkeletonBase,
    AppPage: AppPageSkeleton,
};

export default SkeletonLoader;

