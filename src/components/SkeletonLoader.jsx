import React from 'react';

/**
 * Skeleton UI Components
 * ──────────────────────
 * High-precision placeholders for Bento-grid layouts.
 * Optimized for mobile-first responsiveness.
 */

export const SkeletonBase = ({ className = "" }) => (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-800/50 rounded-4xl ${className}`} />
);

export const StatsSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-6 rounded-4xl shadow-sm">
                <SkeletonBase className="w-10 h-10 mb-4" />
                <SkeletonBase className="w-20 h-3 mb-2" />
                <SkeletonBase className="w-16 h-8" />
            </div>
        ))}
    </div>
);

export const FormSkeleton = () => (
    <div className="space-y-6">
        <div className="space-y-4">
            <SkeletonBase className="w-1/3 h-4" />
            <SkeletonBase className="w-full h-12" />
        </div>
        <div className="space-y-4">
            <SkeletonBase className="w-1/4 h-4" />
            <SkeletonBase className="w-full h-32" />
        </div>
        <SkeletonBase className="w-full h-14 rounded-2xl" />
    </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
    <div className="w-full space-y-4">
        {/* Header */}
        <div className="flex justify-between px-6 py-4">
            <SkeletonBase className="w-1/4 h-4" />
            <SkeletonBase className="w-1/6 h-4" />
            <SkeletonBase className="w-1/6 h-4" />
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-6 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl">
                <div className="flex items-center gap-4 w-1/3">
                    <SkeletonBase className="w-10 h-10 rounded-xl" />
                    <div className="space-y-2 grow">
                        <SkeletonBase className="w-full h-4" />
                        <SkeletonBase className="w-2/3 h-3" />
                    </div>
                </div>
                <SkeletonBase className="w-1/6 h-6 rounded-full" />
                <SkeletonBase className="w-1/6 h-6 rounded-full" />
            </div>
        ))}
    </div>
);

export const BentoCardSkeleton = ({ className = "" }) => (
    <div className={`bg-white/60 dark:bg-slate-900/40 backdrop-blur-xl border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm ${className}`}>
        <div className="flex justify-between items-start mb-6">
            <SkeletonBase className="w-12 h-12" />
            <SkeletonBase className="w-24 h-6 rounded-full" />
        </div>
        <SkeletonBase className="w-3/4 h-8 mb-4" />
        <SkeletonBase className="w-full h-20 mb-6" />
        <div className="flex gap-2">
            <SkeletonBase className="w-16 h-4" />
            <SkeletonBase className="w-16 h-4" />
        </div>
    </div>
);

const SkeletonLoader = {
    Stats: StatsSkeleton,
    Form: FormSkeleton,
    Table: TableSkeleton,
    Bento: BentoCardSkeleton,
    Base: SkeletonBase
};

export default SkeletonLoader;
