import React from 'react';

/**
 * Skeleton UI Components
 * ──────────────────────
 * High-precision placeholders for Bento-grid layouts.
 * Optimized for mobile-first responsiveness.
 */

export const SkeletonBase = ({ className = "" }) => (
    <div className={`animate-pulse bg-slate-100 dark:bg-[#1A1A1A] rounded-md ${className}`} />
);

export const StatsSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 p-6 rounded-xl">
                <SkeletonBase className="w-8 h-8 mb-4 rounded-md" />
                <SkeletonBase className="w-24 h-3 mb-2" />
                <SkeletonBase className="w-16 h-6" />
            </div>
        ))}
    </div>
);

export const FormSkeleton = () => (
    <div className="space-y-6">
        <div className="space-y-2">
            <SkeletonBase className="w-24 h-3" />
            <SkeletonBase className="w-full h-10 rounded-md" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <SkeletonBase className="w-20 h-3" />
                <SkeletonBase className="w-full h-10 rounded-md" />
            </div>
            <div className="space-y-2">
                <SkeletonBase className="w-20 h-3" />
                <SkeletonBase className="w-full h-10 rounded-md" />
            </div>
        </div>
        <SkeletonBase className="w-full h-11 rounded-md" />
    </div>
);

export const TableSkeleton = ({ rows = 5 }) => (
    <div className="w-full space-y-4">
        {/* Rows */}
        {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center justify-between p-4 bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="flex items-center gap-3 w-1/3">
                    <SkeletonBase className="w-8 h-8 rounded-md" />
                    <div className="space-y-1.5 grow">
                        <SkeletonBase className="w-full h-3" />
                        <SkeletonBase className="w-2/3 h-2 opacity-50" />
                    </div>
                </div>
                <SkeletonBase className="w-16 h-5 rounded-md" />
                <SkeletonBase className="w-16 h-5 rounded-md" />
            </div>
        ))}
    </div>
);

export const BentoCardSkeleton = ({ className = "" }) => (
    <div className={`bg-white dark:bg-[#111111] border border-slate-200 dark:border-slate-800 p-6 rounded-xl ${className}`}>
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

const SkeletonLoader = {
    Stats: StatsSkeleton,
    Form: FormSkeleton,
    Table: TableSkeleton,
    Bento: BentoCardSkeleton,
    Base: SkeletonBase
};

export default SkeletonLoader;
