'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import InlineTrainingWidget from './InlineTrainingWidget';
import FixesNeededPanel from './FixesNeededPanel';
import { Badge, Card, cx, EmptyState, fmtNum } from '@/src/app/components/insights/ui';

interface ConversationsPanelProps {
    selectedBotId: string;
    authFetch: any;
    isAuthorized: boolean;
}

const ConversationsPanel = ({ selectedBotId, authFetch, isAuthorized }: ConversationsPanelProps) => {
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('all');
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [trainingQuery, setTrainingQuery] = useState<string | null>(null);
    const [selectedQueryFilter, setSelectedQueryFilter] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['conversations', selectedBotId, page, filter],
        queryFn: () => authFetch(`/api/conversations/${selectedBotId}?page=${page}&limit=20&filter=${filter}`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 60_000,
    });

    if (!isAuthorized) {
        return <Card className="p-6"><UpgradePrompt code="DEFAULT" tier="" mode="inline" /></Card>;
    }

    const sessions = (data as any)?.sessions || [];
    const total = (data as any)?.total || 0;
    const pages = (data as any)?.pages || 1;

    const formatTime = (iso: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const filteredSessions = selectedQueryFilter
        ? sessions.filter((s: any) => s.messages.some((m: any) => m.user_query.toLowerCase().includes(selectedQueryFilter.toLowerCase())))
        : sessions;

    const FilterBtn = ({ id, children, dot }: { id: string; children: React.ReactNode; dot?: string }) => {
        const active = filter === id && !selectedQueryFilter;
        return (
            <button
                onClick={() => { setFilter(id); setSelectedQueryFilter(null); setPage(1); }}
                aria-pressed={active}
                className={cx(
                    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
                    active ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
                )}
            >
                {dot && <span className={cx('h-1.5 w-1.5 rounded-full', dot)} />}
                {children}
            </button>
        );
    };

    const list = (
        <Card className="flex-1 min-w-0 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">forum</span>
                    <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{fmtNum(total)} conversation{total !== 1 ? 's' : ''}</h3>
                </div>
                <div className="flex items-center gap-1.5">
                    <FilterBtn id="all">All</FilterBtn>
                    <FilterBtn id="unanswered" dot="bg-amber-500">Has gaps</FilterBtn>
                </div>
            </div>

            {/* Active query filter bar */}
            {selectedQueryFilter && (
                <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between gap-2 text-[12px] text-amber-700 dark:text-amber-300">
                    <span className="truncate">Showing matches for <span className="font-semibold">“{selectedQueryFilter}”</span></span>
                    <button onClick={() => setSelectedQueryFilter(null)} className="shrink-0 inline-flex items-center gap-0.5 font-semibold hover:underline">
                        Clear <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                </div>
            )}

            {filteredSessions.length === 0 ? (
                <EmptyState
                    icon={filter === 'unanswered' ? 'task_alt' : 'chat'}
                    title={filter === 'unanswered' ? 'No gaps here' : 'No conversations yet'}
                    hint={filter === 'unanswered' ? 'Your assistant answered everything it was asked.' : 'Transcripts appear here once people start chatting.'}
                />
            ) : (
                <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/60">
                    {filteredSessions.map((session: any) => {
                        const isExpanded = expandedSession === session.session_id;
                        const preview = session.messages[0]?.user_query || '';
                        return (
                            <div key={session.session_id} className="flex flex-col">
                                <button
                                    onClick={() => setExpandedSession(isExpanded ? null : session.session_id)}
                                    aria-expanded={isExpanded}
                                    className={cx(
                                        'w-full text-left px-4 py-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors flex items-start gap-3 border-l-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/40',
                                        session.has_unanswered ? 'border-l-amber-500' : 'border-l-transparent',
                                    )}
                                >
                                    <div className="flex-1 min-w-0">
                                        <p className="text-[13.5px] font-medium text-slate-800 dark:text-slate-200 truncate">{preview || 'No messages'}</p>
                                        <div className="flex flex-wrap items-center gap-2 mt-1 text-[11.5px] text-slate-500 dark:text-slate-400">
                                            <span className="tabular-nums">{formatTime(session.last_active)}</span>
                                            <span aria-hidden>·</span>
                                            <span className="tabular-nums">{session.message_count} msg{session.message_count !== 1 ? 's' : ''}</span>
                                            {session.has_unanswered && <Badge tone="alert">Has gaps</Badge>}
                                        </div>
                                    </div>
                                    <span className={cx('material-symbols-outlined text-[18px] text-slate-400 shrink-0 transition-transform mt-0.5', isExpanded && 'rotate-180')}>expand_more</span>
                                </button>

                                {isExpanded && (
                                    <div className="px-4 py-3 bg-slate-50/60 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800/50 flex flex-col gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                                        {session.messages.map((msg: any, idx: number) => {
                                            const isTrainingThis = trainingQuery === msg.user_query;
                                            return (
                                                <div key={idx} className="flex flex-col gap-1.5">
                                                    <div className="flex items-start gap-2">
                                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 mt-0.5">
                                                            <span className="material-symbols-outlined text-[11px] text-slate-500 dark:text-slate-300">person</span>
                                                        </span>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">User</span>
                                                            <p className="text-[13.5px] text-slate-800 dark:text-slate-200 leading-snug mt-0.5 break-words whitespace-pre-wrap">{msg.user_query}</p>
                                                        </div>
                                                        <span className="text-[11.5px] tabular-nums text-slate-400 shrink-0 mt-0.5">
                                                            {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                        </span>
                                                    </div>
                                                    <div className={cx('ml-2.5 pl-3 border-l-2', msg.is_unanswered ? 'border-l-amber-400' : 'border-l-slate-200 dark:border-l-slate-700')}>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Assistant</span>
                                                            {msg.is_unanswered && <Badge tone="alert">Unanswered</Badge>}
                                                        </div>
                                                        <p className="text-[13.5px] text-slate-600 dark:text-slate-400 leading-snug mt-0.5 break-words whitespace-pre-wrap">{msg.bot_response}</p>
                                                        {msg.is_unanswered && !isTrainingThis && (
                                                            <button
                                                                onClick={() => setTrainingQuery(msg.user_query)}
                                                                className="inline-flex items-center gap-1 mt-1.5 text-[12px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                                                            >
                                                                <span className="material-symbols-outlined text-[14px]">school</span>Teach the assistant
                                                            </button>
                                                        )}
                                                        {isTrainingThis && (
                                                            <div className="mt-2 w-full max-w-lg">
                                                                <InlineTrainingWidget
                                                                    selectedBotId={selectedBotId}
                                                                    query={msg.user_query}
                                                                    authFetch={authFetch}
                                                                    onCancel={() => setTrainingQuery(null)}
                                                                    onSuccess={() => setTrainingQuery(null)}
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {pages > 1 && filteredSessions.length > 0 && (
                <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30 transition-colors">← Prev</button>
                    <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">Page {page} of {pages}</span>
                    <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30 transition-colors">Next →</button>
                </div>
            )}
        </Card>
    );

    return (
        <div className="flex flex-col gap-4 w-full min-w-0">
            {/* Desktop: list + gaps sidebar */}
            <div className="flex flex-col lg:flex-row gap-4 w-full flex-1 min-w-0">
                {list}
                <div className="hidden lg:block lg:w-[34%] min-w-0 shrink-0">
                    <FixesNeededPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        isAuthorized={isAuthorized}
                        mode="sidebar"
                        onSelectQuery={(q) => { setFilter('unanswered'); setSelectedQueryFilter(q); setPage(1); }}
                        activeQuery={selectedQueryFilter}
                    />
                </div>
            </div>
            {/* Mobile/tablet: gaps shown below so they're never hidden */}
            <div className="lg:hidden">
                <FixesNeededPanel
                    selectedBotId={selectedBotId}
                    authFetch={authFetch}
                    isAuthorized={isAuthorized}
                    mode="sidebar"
                    onSelectQuery={(q) => { setFilter('unanswered'); setSelectedQueryFilter(q); setPage(1); }}
                    activeQuery={selectedQueryFilter}
                />
            </div>
        </div>
    );
};

export default ConversationsPanel;
