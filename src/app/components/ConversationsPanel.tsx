'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import InlineTrainingWidget from './InlineTrainingWidget';
import FixesNeededPanel from './FixesNeededPanel';

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
        return (
            <div className="p-6 bg-white dark:bg-slate-900 rounded-md">
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col lg:flex-row gap-4 w-full animate-pulse">
                <div className="flex-1 border border-slate-100 dark:border-slate-800 rounded-md">
                    <div className="px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 flex gap-4">
                        <div className="h-3 bg-slate-100 dark:bg-slate-800 w-24 rounded" />
                    </div>
                    {[1, 2, 3].map(i => <div key={i} className="h-10 border-b border-slate-50 dark:border-slate-800/50" />)}
                </div>
                <div className="hidden lg:block lg:w-[35%] border border-slate-100 dark:border-slate-800 rounded-md h-40" />
            </div>
        );
    }

    const sessions = (data as any)?.sessions || [];
    const total = (data as any)?.total || 0;
    const pages = (data as any)?.pages || 1;

    const formatTime = (iso: string) => {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
            ' · ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const filteredSessions = selectedQueryFilter
        ? sessions.filter((session: any) =>
            session.messages.some((msg: any) =>
                msg.user_query.toLowerCase().includes(selectedQueryFilter.toLowerCase())
            )
          )
        : sessions;

    return (
        <div className="flex flex-col lg:flex-row gap-4 w-full flex-1 min-w-0 transition-colors duration-500">
            {/* Main Column: Transcripts */}
            <div className="flex-1 min-w-0 flex flex-col bg-white dark:bg-slate-900 transition-colors duration-500 overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/60">
                    <div className="flex items-center gap-3">
                        <span className="text-xs tracking-normal font-semibold text-slate-700 dark:text-slate-300 font-sans">{total} Conversation{total !== 1 ? 's' : ''}</span>
                    </div>
                    {/* Filter Toggle */}
                    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
                        <button
                            onClick={() => { setFilter('all'); setSelectedQueryFilter(null); setPage(1); }}
                            className={`px-2.5 py-1 text-[10px] uppercase tracking-widest font-sans rounded-sm transition-colors min-h-[28px] whitespace-nowrap ${filter === 'all' && !selectedQueryFilter ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >All</button>
                        <button
                            onClick={() => { setFilter('unanswered'); setSelectedQueryFilter(null); setPage(1); }}
                            className={`px-2.5 py-1 text-[10px] uppercase tracking-widest font-sans rounded-sm transition-colors min-h-[28px] flex items-center gap-1 whitespace-nowrap ${filter === 'unanswered' && !selectedQueryFilter ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900' : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />Unanswered
                        </button>
                    </div>
                </div>

                {/* Filter info bar */}
                {selectedQueryFilter && (
                    <div className="px-4 py-1.5 bg-amber-50 dark:bg-amber-950/20 border-b border-amber-100 dark:border-amber-900/30 flex items-center justify-between text-[10px] text-amber-700 dark:text-amber-400 shrink-0">
                        <span className="truncate">Matching: <span className="font-sans font-semibold">"{selectedQueryFilter}"</span></span>
                        <button onClick={() => setSelectedQueryFilter(null)} className="shrink-0 flex items-center gap-0.5 hover:text-amber-800 transition-colors">
                            Clear <span className="material-symbols-outlined text-[11px]">close</span>
                        </button>
                    </div>
                )}

                {/* Empty State */}
                {filteredSessions.length === 0 && (
                    <div className="flex-1 py-8 text-center">
                        <p className="text-sm italic text-slate-400 dark:text-slate-500">
                            {filter === 'unanswered' ? 'Great — your bot answered everything it was asked.' : 'Chat transcripts will appear here once users start chatting.'}
                        </p>
                    </div>
                )}

                {/* Session List */}
                {filteredSessions.length > 0 && (
                    <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/50">
                        {filteredSessions.map((session: any) => {
                            const isExpanded = expandedSession === session.session_id;
                            const preview = session.messages[0]?.user_query || '';

                            return (
                                <div key={session.session_id} className="flex flex-col">
                                    {/* Session Row */}
                                    <button
                                        onClick={() => setExpandedSession(isExpanded ? null : session.session_id)}
                                        className={`w-full text-left px-4 py-2 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors flex items-start gap-3 border-l-2 ${session.has_unanswered ? 'border-l-amber-400' : 'border-l-transparent'}`}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-slate-700 dark:text-slate-300 truncate font-medium">{preview || 'No messages'}</p>
                                            <div className="flex flex-wrap items-center gap-2 mt-0.5">
                                                <span className="text-[10px] font-sans text-slate-400 dark:text-slate-500">{formatTime(session.last_active)}</span>
                                                <span className="text-[10px] font-sans text-slate-400 dark:text-slate-500">{session.message_count} msg{session.message_count !== 1 ? 's' : ''}</span>
                                                {session.has_unanswered && <span className="text-[10px] font-sans uppercase tracking-wider text-amber-500">Has gaps</span>}
                                            </div>
                                        </div>
                                        <span className={`material-symbols-outlined text-[16px] text-slate-400 shrink-0 transition-transform mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                                    </button>

                                    {/* Expanded Transcript */}
                                    {isExpanded && (
                                        <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-800/40 flex flex-col gap-3 max-h-[50vh] overflow-y-auto custom-scrollbar">
                                            {session.messages.map((msg: any, idx: number) => {
                                                const isTrainingThis = trainingQuery === msg.user_query;
                                                return (
                                                    <div key={idx} className="flex flex-col gap-1.5">
                                                        {/* User message */}
                                                        <div className="flex items-start gap-2">
                                                            <div className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                                                                <span className="material-symbols-outlined text-[10px] text-slate-500 dark:text-slate-400">person</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <span className="text-[9px] uppercase tracking-widest font-sans text-slate-400">User</span>
                                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug mt-0.5 break-words whitespace-pre-wrap">{msg.user_query}</p>
                                                            </div>
                                                            <span className="text-[10px] font-sans text-slate-400 shrink-0 mt-0.5">
                                                                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                            </span>
                                                        </div>

                                                        {/* Bot response */}
                                                        <div className={`flex flex-col gap-1.5 ml-3 pl-3 border-l ${msg.is_unanswered ? 'border-l-amber-400' : 'border-l-slate-200 dark:border-l-slate-700'}`}>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-[9px] uppercase tracking-widest font-sans text-slate-400">Bot</span>
                                                                    {msg.is_unanswered && <span className="text-[9px] font-sans uppercase tracking-wider text-amber-500">Unanswered</span>}
                                                                </div>
                                                                <p className="text-sm text-slate-600 dark:text-slate-400 leading-snug mt-0.5 break-words whitespace-pre-wrap">{msg.bot_response}</p>
                                                                {msg.is_unanswered && !isTrainingThis && (
                                                                    <button
                                                                        onClick={() => setTrainingQuery(msg.user_query)}
                                                                        className="inline-flex items-center gap-1 mt-1 text-[10px] font-sans text-indigo-600 dark:text-indigo-400 hover:underline min-h-[28px]"
                                                                    >
                                                                        <span className="material-symbols-outlined text-[11px]">build</span>Teach Bot inline
                                                                    </button>
                                                                )}
                                                            </div>
                                                            {isTrainingThis && (
                                                                <div className="mt-1 w-full max-w-lg">
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

                {/* Pagination */}
                {pages > 1 && filteredSessions.length > 0 && (
                    <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="text-[10px] uppercase tracking-widest font-sans text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-30 transition-colors min-h-[28px]"
                        >← Prev</button>
                        <span className="text-[10px] font-sans text-slate-400">Page {page} of {pages}</span>
                        <button
                            onClick={() => setPage(p => Math.min(pages, p + 1))}
                            disabled={page === pages}
                            className="text-[10px] uppercase tracking-widest font-sans text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-30 transition-colors min-h-[28px]"
                        >Next →</button>
                    </div>
                )}
            </div>

            {/* Right Column: Fixes Sidebar */}
            <div className="hidden lg:block lg:w-[35%] min-w-0 h-full shrink-0">
                <FixesNeededPanel
                    selectedBotId={selectedBotId}
                    authFetch={authFetch}
                    isAuthorized={isAuthorized}
                    mode="sidebar"
                    onSelectQuery={q => { setFilter('unanswered'); setSelectedQueryFilter(q); setPage(1); }}
                    activeQuery={selectedQueryFilter}
                />
            </div>
        </div>
    );
};

export default ConversationsPanel;
