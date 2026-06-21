'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

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
            <div className="p-6">
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md animate-pulse flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
                <div className="px-3 py-2 flex items-center gap-2">
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 w-28 rounded" />
                </div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="px-3 py-2 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 mt-1.5 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
                        <div className="flex-1">
                            <div className="h-3 bg-slate-100 dark:bg-slate-800 w-full rounded mb-1" />
                            <div className="h-2 bg-slate-100 dark:bg-slate-800 w-24 rounded" />
                        </div>
                    </div>
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
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    // ── SIDEBAR MODE ────────────────────────────────────────────────────────
    if (mode === 'sidebar') {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-slate-900 transition-colors duration-500 overflow-hidden border border-slate-200 dark:border-slate-800 rounded-md">
                {/* Header */}
                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
                    <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400">Gaps to Teach</span>
                    <span className="text-[10px] font-mono text-slate-400">{total}</span>
                </div>

                {fixes.length === 0 ? (
                    <div className="flex-1 py-8 text-center flex flex-col items-center justify-center">
                        <p className="text-sm italic text-slate-400 dark:text-slate-500">No unanswered questions detected.</p>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/40">
                        {fixes.map((fix, idx) => {
                            const isUnanswered = fix.category === 'unanswered';
                            const isActive = activeQuery === fix.query;
                            return (
                                <div
                                    key={idx}
                                    onClick={() => onSelectQuery && onSelectQuery(fix.query)}
                                    className={`px-3 py-2 flex items-start gap-2 hover:bg-slate-50 dark:hover:bg-slate-900/40 cursor-pointer transition-colors border-l-2 ${isActive ? 'border-l-amber-400 bg-slate-50/50 dark:bg-slate-900/30' : 'border-l-transparent'}`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full block mt-1.5 shrink-0 ${isUnanswered ? 'bg-amber-400' : 'bg-orange-400'}`} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 break-words leading-snug">{fix.query}</p>
                                        <div className="flex items-center gap-2 mt-0.5 text-[9px] font-mono text-slate-400 dark:text-slate-500">
                                            <span>Asked {fix.ask_count}×</span>
                                            <span>·</span>
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

    // ── FULL MODE ───────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col bg-white dark:bg-slate-900 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800 transition-colors duration-500">
            {/* Header */}
            <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400">{total} Fix{total !== 1 ? 'es' : ''} Needed</span>
                    {total > 0 && (
                        <div className="flex items-center gap-3 text-[10px] font-mono">
                            <span className="flex items-center gap-1 text-amber-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />{unansweredCount} Unanswered
                            </span>
                            <span className="flex items-center gap-1 text-orange-500">
                                <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />{lowConfCount} Low conf.
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Empty State */}
            {fixes.length === 0 && (
                <div className="py-8 text-center">
                    <p className="text-sm italic text-slate-400 dark:text-slate-500">Your bot answered confidently across the last 30 days.</p>
                </div>
            )}

            {/* Fix List */}
            {fixes.length > 0 && (
                <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/50">
                    {fixes.map((fix, idx) => {
                        const isUnanswered = fix.category === 'unanswered';
                        return (
                            <div key={idx} className="px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                <span className={`w-1.5 h-1.5 rounded-full block mt-1.5 shrink-0 ${isUnanswered ? 'bg-amber-400' : 'bg-orange-400'}`} title={isUnanswered ? 'Unanswered' : 'Low confidence'} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium break-words leading-snug">{fix.query}</p>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                        <span className={`text-[9px] uppercase tracking-widest font-mono ${isUnanswered ? 'text-amber-500' : 'text-orange-500'}`}>
                                            {isUnanswered ? 'Unanswered' : 'Low confidence'}
                                        </span>
                                        <span className="text-[10px] font-mono text-slate-400">Asked {fix.ask_count}×</span>
                                        {!isUnanswered && fix.confidence !== null && (
                                            <span className="text-[10px] font-mono text-orange-500">{Math.round(fix.confidence * 100)}% grounded</span>
                                        )}
                                        <span className="text-[10px] font-mono text-slate-400">{fix.last_asked ? new Date(fix.last_asked).toLocaleDateString() : ''}</span>
                                    </div>
                                </div>
                                <Link
                                    href={`/dashboard/train?query=${encodeURIComponent(fix.query)}&bot=${encodeURIComponent(selectedBotId)}`}
                                    className="shrink-0 text-[10px] font-mono uppercase tracking-wider text-indigo-600 dark:text-indigo-400 hover:underline min-h-[28px] flex items-center"
                                >
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
