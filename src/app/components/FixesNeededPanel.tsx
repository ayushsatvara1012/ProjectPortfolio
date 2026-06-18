'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

interface FixesNeededPanelProps {
    selectedBotId: string;
    authFetch: any;
    isAuthorized: boolean;
    mode?: 'full' | 'sidebar';
    onSelectQuery?: (query: string) => void;
    activeQuery?: string | null;
}

interface FixItem {
    query: string;
    ask_count: number;
    last_asked: string | null;
    confidence: number | null;
    category: 'unanswered' | 'low_confidence';
}

const FixesNeededPanel = ({
    selectedBotId,
    authFetch,
    isAuthorized,
    mode = 'full',
    onSelectQuery,
    activeQuery
}: FixesNeededPanelProps) => {
    const { data, isLoading } = useQuery({
        queryKey: ['fixes-needed', selectedBotId],
        queryFn: () => authFetch(`/api/fixes-needed/${selectedBotId}?window_days=30&limit=50`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 60_000,
    });

    if (!isAuthorized) {
        return (
            <div className="p-8">
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={`${cellCls} p-4 sm:p-6 animate-pulse flex flex-col gap-3`}>
                <div className="h-5 bg-slate-100 dark:bg-slate-800 w-32 mb-2" />
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 w-full rounded-sm" />
                ))}
            </div>
        );
    }

    const fixes: FixItem[] = (data as any)?.fixes || [];
    const total = (data as any)?.total || 0;
    const unansweredCount = (data as any)?.unanswered_count || 0;
    const lowConfCount = (data as any)?.low_confidence_count || 0;

    const formatTime = (iso: string | null) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    if (mode === 'sidebar') {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-slate-950 transition-colors duration-500 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-2xl">
                {/* Compact Sidebar Header */}
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/10 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px] text-amber-500">build</span>
                        <span className="text-xs font-bold font-google text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                            Gaps to Teach ({total})
                        </span>
                    </div>
                </div>

                {/* Empty Gaps list */}
                {fixes.length === 0 ? (
                    <div className="p-6 text-center flex-1 flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-[20px] text-emerald-400 mb-1">task_alt</span>
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">All Good</p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">No unanswered questions detected.</p>
                    </div>
                ) : (
                    /* Dense gaps scroll list */
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/40">
                        {fixes.map((fix, idx) => {
                            const isUnanswered = fix.category === 'unanswered';
                            const isActive = activeQuery === fix.query;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => onSelectQuery && onSelectQuery(fix.query)}
                                    className={`px-3 py-2.5 flex items-start gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition-colors ${isActive ? 'bg-amber-50/50 dark:bg-amber-950/10 border-l-2 border-l-amber-500' : ''}`}
                                >
                                    <span
                                        className={`w-1.5 h-1.5 rounded-full block mt-1.5 shrink-0 ${isUnanswered ? 'bg-amber-400' : 'bg-orange-400'}`}
                                    />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 dark:text-slate-350 break-words leading-tight">
                                            {fix.query}
                                        </p>
                                        <div className="flex items-center gap-2 mt-1 text-[9px] text-slate-400 dark:text-slate-500">
                                            <span>Asked {fix.ask_count}×</span>
                                            <span>&middot;</span>
                                            <span>{formatTime(fix.last_asked)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1 transition-colors duration-500 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className={`${cellCls} p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400">build</span>
                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                        {total} Fix{total !== 1 ? 'es' : ''} Needed
                    </h2>
                </div>
                {total > 0 && (
                    <div className="flex items-center gap-3 text-[11px] uppercase tracking-widest font-bold font-google">
                        <span className="flex items-center gap-1.5 text-amber-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {unansweredCount} Unanswered
                        </span>
                        <span className="flex items-center gap-1.5 text-orange-500">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            {lowConfCount} Low confidence
                        </span>
                    </div>
                )}
            </div>

            {/* Empty State */}
            {fixes.length === 0 && (
                <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-12 text-center`}>
                    <div className="w-14 h-14 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5">
                        <span className="material-symbols-outlined text-[28px] text-emerald-400 dark:text-emerald-500">task_alt</span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2">
                        Nothing needs fixing
                    </h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                        Your bot answered confidently across the last 30 days. New gaps will appear here as they happen.
                    </p>
                </div>
            )}

            {/* Fix List */}
            {fixes.length > 0 && (
                <div className={`${cellCls} flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-slate-800/50`}>
                    {fixes.map((fix, idx) => {
                        const isUnanswered = fix.category === 'unanswered';
                        return (
                            <div
                                key={idx}
                                className="px-3 py-3 sm:px-6 sm:py-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
                            >
                                {/* Status dot */}
                                <span
                                    className={`w-2 h-2 rounded-full block mt-2 shrink-0 ${isUnanswered ? 'bg-amber-400' : 'bg-orange-400'}`}
                                    title={isUnanswered ? 'Unanswered' : 'Low confidence'}
                                />

                                {/* Query + meta */}
                                <div className="flex-1 min-w-0">
                                    <p className="text-md font-google text-slate-700 dark:text-slate-300 font-medium break-words">
                                        {fix.query}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1.5">
                                        <span
                                            className={`text-[9px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded-sm ${isUnanswered
                                                ? 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
                                                : 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20'}`}
                                        >
                                            {isUnanswered ? 'Unanswered' : 'Low confidence'}
                                        </span>
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google">
                                            Asked {fix.ask_count}×
                                        </span>
                                        {!isUnanswered && fix.confidence !== null && (
                                            <span className="text-[10px] uppercase tracking-widest font-bold text-orange-500 font-google">
                                                {Math.round(fix.confidence * 100)}% grounded
                                            </span>
                                        )}
                                        <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                            {fix.last_asked ? new Date(fix.last_asked).toLocaleString() : ''}
                                        </span>
                                    </div>
                                </div>

                                {/* Train action — closes the loop */}
                                <Link
                                    href={`/dashboard/train?query=${encodeURIComponent(fix.query)}&bot=${encodeURIComponent(selectedBotId)}`}
                                    className="shrink-0 inline-flex items-center gap-1 mt-0.5 px-3 py-1.5 text-[10px] uppercase tracking-widest font-bold font-google rounded-sm bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-700 dark:hover:bg-blue-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[12px]">build</span>
                                    Train
                                </Link>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default FixesNeededPanel;
