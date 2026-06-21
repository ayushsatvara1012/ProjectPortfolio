'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch, useIsAuthReady } from '@/src/lib/hooks/useAuthenticatedFetch';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import dynamic from 'next/dynamic';

// Code-split panels — each renders its own loading state
const SalesAndLeadsPanel = dynamic(() => import('@/src/app/components/SalesAndLeadsPanel'));
const ConversationsPanel = dynamic(() => import('@/src/app/components/ConversationsPanel'));
const FunnelPanel = dynamic(() => import('@/src/app/components/FunnelPanel'));
import Link from 'next/link';

// ── Design tokens ──────────────────────────────────────────────────────────────
const cellCls = 'bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 transition-colors duration-500 overflow-hidden';

// ── Activity Calendar ─────────────────────────────────────────────────────────
const ActivityCalendar = ({ data }: { data: any[] }) => {
    const [selectedCell, setSelectedCell] = useState<any>(null);

    const generateLast30Days = () => {
        const days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            days.push(d.toISOString().split('T')[0]);
        }
        return days;
    };

    const calendarDates = generateLast30Days();
    const dataMap: Record<string, any> = {};
    let maxCount = 0;

    if (data && data.length > 0) {
        data.forEach(d => {
            if (d.date) {
                dataMap[d.date] = d;
                if (d.total_questions > maxCount) maxCount = d.total_questions;
            }
        });
    }
    const safeMax = maxCount || 1;

    useEffect(() => {
        if (data && data.length > 0 && !selectedCell) {
            const todayStr = new Date().toISOString().split('T')[0];
            setSelectedCell(dataMap[todayStr] || data[0]);
        }
    }, [data, selectedCell]); // eslint-disable-line react-hooks/exhaustive-deps

    // 5-step solid monochrome scale
    const getCellColor = (count: number) => {
        if (count === 0) return 'bg-slate-100 dark:bg-slate-800/60';
        const ratio = count / safeMax;
        if (ratio <= 0.25) return 'bg-slate-300 dark:bg-slate-600';
        if (ratio <= 0.50) return 'bg-slate-500 dark:bg-slate-500';
        if (ratio <= 0.75) return 'bg-slate-700 dark:bg-slate-400';
        return 'bg-slate-900 dark:bg-slate-200';
    };

    // Month axis labels
    const monthLabels: { label: string; idx: number }[] = [];
    let lastMonth = '';
    calendarDates.forEach((dateStr, i) => {
        const m = new Date(dateStr).toLocaleDateString(undefined, { month: 'short' });
        if (m !== lastMonth) {
            monthLabels.push({ label: m, idx: i });
            lastMonth = m;
        }
    });

    const formatDateStr = (dateStr: string) => {
        if (!dateStr) return '';
        return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="flex flex-col gap-6">
            {/* Calendar Grid */}
            <div className="w-full min-w-0 flex flex-col gap-2 overflow-x-auto custom-scrollbar pb-3">
                <div className="min-w-max flex flex-col gap-1">
                    {/* Month axis */}
                    <div className="flex gap-[3px] pl-0">
                        {calendarDates.map((dateStr, i) => {
                            const found = monthLabels.find(m => m.idx === i);
                            return (
                                <div key={dateStr} className="w-[18px] shrink-0 text-[10px] font-sans uppercase tracking-widest text-slate-400 dark:text-slate-500 text-center">
                                    {found ? found.label : ''}
                                </div>
                            );
                        })}
                    </div>
                    {/* Grid */}
                    <div className="flex gap-[3px]">
                        {calendarDates.map((dateStr) => {
                        const cellData = dataMap[dateStr];
                        const count = cellData?.total_questions || 0;
                        const isSelected = selectedCell?.date === dateStr;
                        return (
                            <div
                                key={dateStr}
                                onClick={() => setSelectedCell(cellData || { date: dateStr, total_questions: 0 })}
                                onMouseEnter={() => setSelectedCell(cellData || { date: dateStr, total_questions: 0 })}
                                className={`w-[18px] h-[18px] rounded-[2px] cursor-pointer transition-opacity duration-100 ${getCellColor(count)} ${isSelected ? 'ring-1 ring-slate-500 dark:ring-slate-400 ring-offset-1 dark:ring-offset-slate-950' : ''}`}
                                title={`${dateStr}: ${count} queries`}
                            />
                        );
                    })}
                </div>
            </div>
            <div className="flex items-center gap-3 mt-2">
                <span className="text-[10px] font-sans uppercase tracking-widest text-slate-400">Less</span>
                {['bg-slate-100 dark:bg-slate-800/60', 'bg-slate-300 dark:bg-slate-600', 'bg-slate-500 dark:bg-slate-500', 'bg-slate-700 dark:bg-slate-400', 'bg-slate-900 dark:bg-slate-200'].map((cls, i) => (
                    <div key={i} className={`w-[12px] h-[12px] rounded-[2px] ${cls}`} />
                ))}
                <span className="text-[10px] font-sans uppercase tracking-widest text-slate-400">More</span>
            </div>
        </div>

            {/* Inspector */}
            <div className="w-full">
                {selectedCell ? (
                    <div
                        className="flex flex-col gap-3 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm px-4 py-3"
                    >
                        <div>
                            <span className="text-xs tracking-normal font-semibold text-slate-700 dark:text-slate-300 font-sans">Daily inspector</span>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{formatDateStr(selectedCell.date)}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                            <div>
                                <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Total activity</span>
                                <p className="text-lg font-sans tabular-nums font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{selectedCell.total_questions || 0}</p>
                            </div>
                            <div>
                                <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400">Unique users</span>
                                <p className="text-lg font-sans tabular-nums font-semibold text-slate-900 dark:text-slate-200 mt-0.5">{selectedCell.interacted_users || 0}</p>
                            </div>
                        </div>
                        <div className="space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-3">
                            <div className="flex items-center justify-between py-1.5">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Answered correctly</span>
                                <span className="text-xs font-sans tabular-nums text-slate-700 dark:text-slate-300">{selectedCell.answered_questions || 0}</span>
                            </div>
                            <div className="flex items-center justify-between py-1.5">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Failed response</span>
                                <span className="text-xs font-sans tabular-nums text-rose-400">{selectedCell.unanswered_questions || 0}</span>
                            </div>
                        </div>
                        {selectedCell.top_questions?.length > 0 && (
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                                <span className="text-xs tracking-normal font-semibold text-slate-700 dark:text-slate-300 font-sans block mb-2">Top questions</span>
                                <div className="space-y-1.5">
                                    {selectedCell.top_questions.map((q: string, qIdx: number) => (
                                        <p key={qIdx} className="text-xs text-slate-600 dark:text-slate-400 leading-snug italic">"{q}"</p>
                                    ))}
                                </div>
                            </div>
                        )}
                        {selectedCell.unanswered_questions > 0 && selectedCell.top_unanswered?.length > 0 && (
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                                <span className="text-xs tracking-normal font-semibold text-slate-700 dark:text-slate-300 font-sans block mb-2">Unanswered queries</span>
                                <div className="space-y-1.5">
                                    {selectedCell.top_unanswered.map((q: string, qIdx: number) => (
                                        <p key={qIdx} className="text-xs text-slate-500 dark:text-slate-400 leading-snug">"{q}"</p>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center justify-center py-8 text-sm italic text-slate-400 dark:text-slate-500">
                        Hover a day to inspect activity
                    </div>
                )}
            </div>
        </div>
    );
};

export default function AppInsights() {
    const { userTier: rawUserTier, userRole: rawUserRole, entitlements, isLoading: ctxLoading } = useUserRole();
    const userTier = rawUserTier ?? '';
    const canAnalytics = entitlements.canUseAnalytics;
    const canLeadCapture = entitlements.canUseLeadCapture;
    const authFetch = useAuthenticatedFetch();
    const isAuthReady = useIsAuthReady();

    const { data: botsData, isLoading: botsLoading } = useQuery({
        queryKey: ['bots'],
        queryFn: () => authFetch('/api/companies'),
        enabled: isAuthReady && !ctxLoading,
    });

    const bots = (botsData as any)?.bots || [];
    const [selectedBotId, setSelectedBotId] = useState('');

    useEffect(() => {
        if (bots.length > 0 && !selectedBotId) setSelectedBotId(bots[0].id);
    }, [bots, selectedBotId]);

    const [reportData, setReportData] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [isGhostTown, setIsGhostTown] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('sales');

    useEffect(() => {
        if (selectedBotId && canAnalytics) handleGenerate(true);
    }, [selectedBotId, userTier]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerate = async (silentLoad = false) => {
        if (!selectedBotId) return;
        if (!silentLoad) setIsGenerating(true);
        setError('');
        setIsGhostTown(false);

        try {
            const data = await authFetch(`/api/analytics/generate-report/${selectedBotId}`, {
                method: 'POST',
            }) as any;

            if (data.status === 'insufficient_data') {
                setIsGhostTown(true);
                setReportData(null);
            } else if (data.report) {
                setReportData(data.report);
                setLastGeneratedAt(new Date(data.generated_at).toLocaleString());
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (err: any) {
            if (err?.message?.includes('404')) {
                setIsGhostTown(true);
            } else if (!silentLoad) {
                setError('Failed to generate report. Please try again.');
            }
        } finally {
            if (!silentLoad) setIsGenerating(false);
        }
    };

    const TABS = [
        { id: 'sales', label: 'Sales & Leads', shortLabel: 'Sales' },
        { id: 'conversations', label: 'Conversations', shortLabel: 'Convos' },
        { id: 'funnel', label: 'Funnel & Traffic', shortLabel: 'Funnel' },
    ];

    const isLoaded = !ctxLoading && !botsLoading;

    // ── Loading skeleton ──────────────────────────────────────────────────────
    if (!isLoaded) {
        return (
            <div className="flex flex-col h-full animate-pulse">
                {/* Tab bar skeleton */}
                <div className="px-4 md:px-6 border-b border-slate-200 dark:border-slate-800 flex items-center gap-6 h-10 shrink-0">
                    {[120, 96, 112].map(w => (
                        <div key={w} className="h-4 bg-slate-100 dark:bg-slate-800 rounded" style={{ width: w }} />
                    ))}
                </div>
                {/* Stat cards skeleton */}
                <div className="px-4 md:px-6 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-0 border border-slate-100 dark:border-slate-800 rounded-md mx-4 md:mx-6 mt-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="px-4 py-3 border-r last:border-r-0 border-slate-100 dark:border-slate-800">
                            <div className="h-3 bg-slate-100 dark:bg-slate-800 w-20 mb-2 rounded" />
                            <div className="h-5 bg-slate-100 dark:bg-slate-800 w-16 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // ── Header row: tabs + bot selector + generate btn ────────────────────────
    const renderHeader = () => (
        <div className="relative shrink-0 z-40 bg-[#f8f9fa]/90 dark:bg-slate-950/90 backdrop-blur-xl transition-colors duration-500 pt-3 pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
            {/* Fade shadow to blend scrolling content */}
            <div className="absolute top-full left-0 w-full h-8 bg-gradient-to-b from-[#f8f9fa] dark:from-slate-950 to-transparent pointer-events-none opacity-100" />
            {/* Row 1 on mobile: bot selector + generate */}
            <div className="flex items-center gap-2 px-4 md:px-6 py-2 sm:hidden">
                {canAnalytics && bots.length > 1 && (
                    <select
                        value={selectedBotId}
                        onChange={e => { setSelectedBotId(e.target.value); setReportData(null); }}
                        className="flex-1 min-w-0 px-2 py-1 text-xs font-sans bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm text-slate-900 dark:text-slate-200 focus:outline-none"
                    >
                        {bots.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.bot_name}</option>
                        ))}
                    </select>
                )}
                {activeTab === 'funnel' && canAnalytics && (
                    <button
                        onClick={() => handleGenerate(false)}
                        disabled={isGenerating || !selectedBotId}
                        className="shrink-0 px-3 py-1 text-[11px] font-sans uppercase tracking-wider bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-sm disabled:opacity-40 flex items-center gap-1.5 transition-colors"
                    >
                        {isGenerating ? <><div className="w-2.5 h-2.5 border-2 border-slate-300 dark:border-slate-700 border-t-white dark:border-t-slate-900 animate-spin rounded-full" />Synth...</> : 'Generate'}
                    </button>
                )}
            </div>

            {/* Tab bar + desktop controls */}
            <div className="flex items-center gap-0 min-w-0 overflow-x-auto scrollbar-hide">
                <div className="flex items-center px-4 md:px-6 lg:pl-0 flex-1 min-w-0 py-0">
                    <div className="flex items-center gap-6">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`py-3 text-xs font-sans uppercase tracking-wider whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id
                                    ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 font-bold'
                                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 font-medium'
                                    }`}
                            >
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.shortLabel}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Desktop: bot selector + generate inline */}
                <div className="hidden sm:flex items-center gap-2 px-4 md:px-6 shrink-0">
                    {canAnalytics && bots.length > 1 && (
                        <select
                            value={selectedBotId}
                            onChange={e => { setSelectedBotId(e.target.value); setReportData(null); }}
                            className="px-2 py-1 text-[11px] font-sans bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm text-slate-900 dark:text-slate-200 focus:outline-none"
                        >
                            {bots.map((b: any) => (
                                <option key={b.id} value={b.id}>{b.bot_name} — {b.company_name}</option>
                            ))}
                        </select>
                    )}
                    {activeTab === 'funnel' && canAnalytics && (
                        <button
                            onClick={() => handleGenerate(false)}
                            disabled={isGenerating || !selectedBotId}
                            className="px-3 py-1 text-[11px] font-sans uppercase tracking-wider bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-sm disabled:opacity-40 flex items-center gap-1.5 transition-colors"
                        >
                            {isGenerating
                                ? <><div className="w-2.5 h-2.5 border-2 border-slate-400 border-t-white animate-spin rounded-full" />Synthesizing</>
                                : <><span className="material-symbols-outlined text-[12px]">auto_awesome</span>Generate</>
                            }
                        </button>
                    )}
                    {activeTab === 'funnel' && lastGeneratedAt && (
                        <span className="text-[10px] font-sans text-slate-400 dark:text-slate-500 whitespace-nowrap">Last: {lastGeneratedAt}</span>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-500"
        >
            {renderHeader()}

            <div 
                data-lenis-prevent 
                className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar flex flex-col p-4 md:p-6 lg:p-8"
            >
                {activeTab === 'sales' && (
                    <SalesAndLeadsPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        entitlements={{ canUseAnalytics: canAnalytics, canUseLeadCapture: canLeadCapture }}
                        selectedBot={bots.find((b: any) => b.id === selectedBotId)}
                    />
                )}

                {activeTab === 'conversations' && (
                    <ConversationsPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        isAuthorized={canAnalytics}
                    />
                )}

                {activeTab === 'funnel' && (
                    <div className="flex flex-col gap-4 w-full min-w-0">
                        <FunnelPanel
                            selectedBotId={selectedBotId}
                            authFetch={authFetch}
                            isAuthorized={canAnalytics}
                        />

                        {/* Tier Gate */}
                        {!canAnalytics && (
                            <div className="p-6 bg-white dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                                <UpgradePrompt code="DEFAULT" tier={userTier} mode="inline" />
                            </div>
                        )}

                        {/* AI Report */}
                        {canAnalytics && reportData && !isGenerating && !error && (
                            <div className="flex flex-col gap-4 w-full">
                                {/* Trends + Advice */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 w-full min-w-0">
                                    {/* Top Trends */}
                                    <div className="lg:col-span-7">
                                        <div className={`${cellCls}`}>
                                            <div className="bg-slate-50 dark:bg-slate-800/40 px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                                                <span className="text-sm tracking-normal font-semibold text-slate-800 dark:text-slate-200 font-sans">Top customer trends</span>
                                            </div>
                                            <div>
                                                {reportData?.top_trends?.map((trend: string, idx: number) => (
                                                    <div key={idx} className={`flex items-start gap-3 px-4 py-3 ${idx % 2 === 0 ? 'bg-slate-50/50 dark:bg-slate-900/50' : ''}`}>
                                                        <span className="text-xs font-sans font-medium text-slate-500 w-5 shrink-0 pt-0.5 tabular-nums">{String(idx + 1).padStart(2, '0')}</span>
                                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-snug break-words">{trend}</p>
                                                    </div>
                                                ))}
                                                {(!reportData?.top_trends || reportData.top_trends.length === 0) && (
                                                    <p className="py-6 text-center text-sm italic text-slate-500 dark:text-slate-400">No trends available.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Actionable Advice */}
                                    <div className="lg:col-span-5">
                                        <div className={`${cellCls} px-5 py-5 bg-gradient-to-br from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/10 dark:to-purple-900/10`}>
                                            <span className="text-sm tracking-normal font-semibold text-slate-800 dark:text-slate-200 font-sans block mb-3">Actionable advice</span>
                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                                {reportData?.actionable_advice || 'Keep monitoring your analytics.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 30-Day Activity Calendar */}
                                <div className={`${cellCls}`}>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                                        <span className="text-sm tracking-normal font-semibold text-slate-800 dark:text-slate-200 font-sans">30-day peak activity</span>
                                    </div>
                                    <div className="px-5 py-5">
                                        <ActivityCalendar data={reportData?.peak_activity_blocks} />
                                    </div>
                                </div>

                                {/* Recent Activity Log */}
                                <div className={`${cellCls}`}>
                                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
                                        <div className="col-span-8 text-sm tracking-normal font-semibold text-slate-800 dark:text-slate-200 font-sans">User Query</div>
                                        <div className="col-span-2 text-sm tracking-normal font-semibold text-slate-800 dark:text-slate-200 font-sans text-center">Status</div>
                                        <div className="col-span-2 text-sm tracking-normal font-semibold text-slate-800 dark:text-slate-200 font-sans text-right">Time</div>
                                    </div>
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                        {reportData?.recent_conversations?.map((log: any, idx: number) => (
                                            <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-1 md:gap-4 px-4 py-3 md:items-center hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                                <div className="col-span-8 text-sm text-slate-700 dark:text-slate-300 md:truncate break-words">{log.query}</div>
                                                <div className="col-span-2 flex items-center md:justify-center gap-2">
                                                    {log.unanswered ? (
                                                        <span className="text-xs tracking-normal font-semibold text-slate-700 dark:text-slate-300 font-sans bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Unanswered</span>
                                                    ) : (
                                                        <span className="text-xs uppercase tracking-widest text-slate-500 dark:text-slate-400 font-sans bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">Handled</span>
                                                    )}
                                                </div>
                                                <div className="col-span-2 flex items-center md:justify-end">
                                                    <span className="text-xs font-sans text-slate-500 dark:text-slate-400 tabular-nums">
                                                        {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                        {(!reportData?.recent_conversations || reportData.recent_conversations.length === 0) && (
                                            <p className="py-6 text-center text-sm italic text-slate-500 dark:text-slate-400">No recent activity found.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Error */}
                        {canAnalytics && error && (
                            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-md">
                                <span className="material-symbols-outlined text-[16px] text-red-400">error</span>
                                <p className="text-sm text-red-700 dark:text-red-300 flex-1">{error}</p>
                                <button onClick={() => setError('')}><span className="material-symbols-outlined text-[16px] text-red-400">close</span></button>
                            </div>
                        )}

                        {/* Ghost Town */}
                        {canAnalytics && isGhostTown && !isGenerating && (
                            <div className="py-8 text-center">
                                <p className="text-sm text-slate-500 dark:text-slate-400">No conversations yet.</p>
                                <Link href="/dashboard/bots" className="text-[11px] font-sans uppercase tracking-wider text-slate-600 dark:text-slate-400 hover:underline mt-2 inline-block">View my bots</Link>
                            </div>
                        )}

                        {/* Empty — not generated */}
                        {canAnalytics && !reportData && !isGenerating && !error && !isGhostTown && (
                            <div className="py-8 text-center">
                                <p className="text-sm italic text-slate-400 dark:text-slate-500">Click "Generate" in the toolbar to synthesize your chat logs.</p>
                            </div>
                        )}

                        {/* Loading */}
                        {canAnalytics && isGenerating && (
                            <div className="py-8 flex flex-col items-center gap-3">
                                <div className="w-6 h-6 border-2 border-slate-200 dark:border-slate-700 border-t-slate-700 dark:border-t-slate-300 animate-spin rounded-full" />
                                <p className="text-sm text-slate-500 dark:text-slate-400">AI is analyzing logs. This takes 5–10 seconds.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
