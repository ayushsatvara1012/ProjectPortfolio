'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

interface ConversationsPanelProps {
    selectedBotId: string;
    authFetch: any;
    isAuthorized: boolean;
}

const ConversationsPanel = ({ selectedBotId, authFetch, isAuthorized }: ConversationsPanelProps) => {
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState('all');
    const [expandedSession, setExpandedSession] = useState<string | null>(null);

    const { data, isLoading } = useQuery({
        queryKey: ['conversations', selectedBotId, page, filter],
        queryFn: () => authFetch(`/api/conversations/${selectedBotId}?page=${page}&limit=20&filter=${filter}`),
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
            <div className={`${cellCls} p-8 animate-pulse flex-1 flex flex-col gap-4`}>
                <div className="h-6 bg-slate-100 dark:bg-slate-800 w-48 mb-4" />
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 w-full rounded-sm" />
                ))}
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

    return (
        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1 transition-colors duration-500 overflow-hidden rounded-2xl">
            {/* Header */}
            <div className={`${cellCls} p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">forum</span>
                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                        {total} Conversation{total !== 1 ? 's' : ''}
                    </h2>
                </div>
                {/* Filter Toggle */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => { setFilter('all'); setPage(1); }}
                        className={`px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold font-google transition-colors rounded-sm ${filter === 'all' ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => { setFilter('unanswered'); setPage(1); }}
                        className={`px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold font-google transition-colors rounded-sm flex items-center gap-1.5 ${filter === 'unanswered' ? 'bg-amber-500 text-white' : 'border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
                    >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                        Unanswered
                    </button>
                </div>
            </div>

            {/* Empty State */}
            {sessions.length === 0 && (
                <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-12 text-center`}>
                    <div className="w-14 h-14 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5">
                        <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600">chat_bubble_outline</span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2">
                        {filter === 'unanswered' ? 'No unanswered conversations' : 'No conversations yet'}
                    </h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                        {filter === 'unanswered'
                            ? 'Great — your bot answered everything it was asked.'
                            : 'Chat transcripts will appear here once users start chatting with your bot.'}
                    </p>
                </div>
            )}

            {/* Session List */}
            {sessions.length > 0 && (
                <div className={`${cellCls} flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-slate-800/50`}>
                    {sessions.map((session: any) => {
                        const isExpanded = expandedSession === session.session_id;
                        const preview = session.messages[0]?.user_query || '';

                        return (
                            <div key={session.session_id} className="flex flex-col">
                                {/* Session Row */}
                                <button
                                    onClick={() => setExpandedSession(isExpanded ? null : session.session_id)}
                                    className="w-full text-left px-3 py-3 sm:px-6 sm:py-4 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors flex items-start gap-4"
                                >
                                    {/* Status dot */}
                                    <div className="mt-1 shrink-0">
                                        {session.has_unanswered ? (
                                            <span className="w-2 h-2 rounded-full bg-amber-400 block mt-1" title="Has unanswered questions" />
                                        ) : (
                                            <span className="w-2 h-2 rounded-full bg-emerald-400 block mt-1" title="All answered" />
                                        )}
                                    </div>

                                    {/* Preview + meta */}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-md font-google text-slate-700 dark:text-slate-300 truncate font-medium">
                                            {preview || 'No messages'}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-1">
                                            <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                                {formatTime(session.last_active)}
                                            </span>
                                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google">
                                                {session.message_count} msg{session.message_count !== 1 ? 's' : ''}
                                            </span>
                                            {session.has_unanswered && (
                                                <span className="text-[10px] uppercase tracking-widest font-bold text-amber-500 font-google">
                                                    Has gaps
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expand chevron */}
                                    <span className={`material-symbols-outlined text-[18px] text-slate-400 shrink-0 transition-transform mt-0.5 ${isExpanded ? 'rotate-180' : ''}`}>
                                        expand_more
                                    </span>
                                </button>

                                {/* Expanded Transcript */}
                                {isExpanded && (
                                    <div className="px-3 pb-4 sm:px-6 sm:pb-6 bg-slate-50 dark:bg-slate-900/40 border-t border-gray-100 dark:border-slate-800 flex flex-col gap-4 pt-4">
                                        {session.messages.map((msg: any, idx: number) => (
                                            <div key={idx} className="flex flex-col gap-2">
                                                {/* User message */}
                                                <div className="flex items-start gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                                                        <span className="material-symbols-outlined text-[12px] text-slate-500 dark:text-slate-400">person</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">User</span>
                                                        <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed mt-0.5">
                                                            {msg.user_query}
                                                        </p>
                                                    </div>
                                                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 shrink-0 mt-0.5">
                                                        {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                                    </span>
                                                </div>

                                                {/* Bot response */}
                                                <div className={`flex items-start gap-3 ml-4 pl-4 border-l-2 ${msg.is_unanswered ? 'border-amber-300 dark:border-amber-700' : 'border-blue-200 dark:border-blue-900'}`}>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">Bot</span>
                                                            {msg.is_unanswered && (
                                                                <span className="text-[9px] uppercase tracking-widest font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-sm">
                                                                    Unanswered
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed mt-0.5 line-clamp-4">
                                                            {msg.bot_response}
                                                        </p>
                                                        {msg.is_unanswered && (
                                                            <Link
                                                                href={`/dashboard/train?query=${encodeURIComponent(msg.user_query)}`}
                                                                className="inline-flex items-center gap-1 mt-2 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                                                            >
                                                                <span className="material-symbols-outlined text-[12px]">build</span>
                                                                Train this gap
                                                            </Link>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Pagination */}
            {pages > 1 && sessions.length > 0 && (
                <div className={`${cellCls} p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between`}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-xs font-bold font-google uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                        &larr; Prev
                    </button>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-500">
                        Page {page} of {pages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(pages, p + 1))}
                        disabled={page === pages}
                        className="px-4 py-2 text-xs font-bold font-google uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                        Next &rarr;
                    </button>
                </div>
            )}
        </div>
    );
};

export default ConversationsPanel;
