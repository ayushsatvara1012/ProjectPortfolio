'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import UpgradePrompt from '@/src/components/features/UpgradePrompt';
import { Badge, Card, cx, EmptyState, fmtNum, SectionHeader } from '@/src/components/dashboard/insights/ui';

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

const FixesNeededPanel = ({ selectedBotId, authFetch, isAuthorized, mode = 'full', onSelectQuery, activeQuery }: FixesNeededPanelProps) => {
    const { data, isLoading } = useQuery({
        queryKey: ['fixes-needed', selectedBotId],
        queryFn: () => authFetch(`/api/fixes-needed/${selectedBotId}?window_days=30&limit=50`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 60_000,
    });

    if (!isAuthorized) {
        return <div className="p-6"><UpgradePrompt code="DEFAULT" tier="" mode="inline" /></div>;
    }

    const fixes: FixItem[] = (data as any)?.fixes || [];
    const total = (data as any)?.total || 0;
    const unansweredCount = (data as any)?.unanswered_count || 0;
    const lowConfCount = (data as any)?.low_confidence_count || 0;

    const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '');

    if (isLoading) {
        return (
            <Card className="flex flex-col overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="h-4 w-28 rounded bg-slate-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" />
                </div>
                {[1, 2, 3].map((i) => (
                    <div key={i} className="px-4 py-3 flex items-start gap-2">
                        <div className="h-2 w-2 mt-1.5 rounded-full bg-slate-100 dark:bg-slate-800" />
                        <div className="flex-1 space-y-1.5">
                            <div className="h-3 w-full rounded bg-slate-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" />
                            <div className="h-2 w-20 rounded bg-slate-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" />
                        </div>
                    </div>
                ))}
            </Card>
        );
    }

    const isSidebar = mode === 'sidebar';

    return (
        <Card className={cx('flex flex-col overflow-hidden', isSidebar && 'h-full')}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0">build</span>
                    <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {isSidebar ? 'Gaps to teach' : `${total} gap${total !== 1 ? 's' : ''} to teach`}
                    </h3>
                </div>
                {total > 0 && (
                    <div className="flex items-center gap-1.5 shrink-0">
                        {unansweredCount > 0 && <Badge tone="alert" title="Unanswered questions">{unansweredCount}</Badge>}
                        {lowConfCount > 0 && <Badge tone="warm" title="Low-confidence answers">{lowConfCount}</Badge>}
                    </div>
                )}
            </div>

            {fixes.length === 0 ? (
                <EmptyState icon="task_alt" title="No gaps detected" hint="Your assistant answered confidently across the last 30 days." />
            ) : (
                <ul className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/60">
                    {fixes.map((fix, idx) => {
                        const isUnanswered = fix.category === 'unanswered';
                        const isActive = activeQuery === fix.query;
                        const Wrapper: any = isSidebar ? 'button' : 'div';
                        return (
                            <li key={idx}>
                                <Wrapper
                                    {...(isSidebar
                                        ? {
                                              type: 'button',
                                              onClick: () => onSelectQuery?.(fix.query),
                                              'aria-pressed': isActive,
                                          }
                                        : {})}
                                    className={cx(
                                        'w-full text-left px-4 py-3 flex items-start gap-2.5 transition-colors',
                                        isSidebar && 'hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40',
                                        isSidebar && (isActive ? 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20' : 'border-l-transparent'),
                                    )}
                                >
                                    <span className={cx('h-2 w-2 rounded-full mt-1.5 shrink-0', isUnanswered ? 'bg-amber-500' : 'bg-orange-400')} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13px] font-medium text-slate-800 dark:text-slate-200 leading-snug break-words">{fix.query}</p>
                                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                                            <span className={cx('font-semibold', isUnanswered ? 'text-amber-600 dark:text-amber-400' : 'text-orange-600 dark:text-orange-400')}>
                                                {isUnanswered ? 'Unanswered' : 'Low confidence'}
                                            </span>
                                            <span className="tabular-nums">Asked {fmtNum(fix.ask_count)}×</span>
                                            {!isUnanswered && fix.confidence !== null && <span className="tabular-nums">{Math.round(fix.confidence * 100)}% grounded</span>}
                                            {fix.last_asked && <span className="tabular-nums">{fmtDate(fix.last_asked)}</span>}
                                        </div>
                                    </div>
                                    {!isSidebar && (
                                        <Link
                                            href={`/dashboard/train?query=${encodeURIComponent(fix.query)}&bot=${encodeURIComponent(selectedBotId)}`}
                                            className="shrink-0 inline-flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-950/50 px-2.5 py-1 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[14px]">school</span>Teach
                                        </Link>
                                    )}
                                </Wrapper>
                            </li>
                        );
                    })}
                </ul>
            )}
        </Card>
    );
};

export default FixesNeededPanel;
