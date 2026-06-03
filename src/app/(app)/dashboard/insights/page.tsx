'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch, useIsAuthReady } from '@/src/lib/hooks/useAuthenticatedFetch';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import LeadsPanel from '@/src/app/components/LeadsPanel';
import ConversationsPanel from '@/src/app/components/ConversationsPanel';
import FixesNeededPanel from '@/src/app/components/FixesNeededPanel';
import ROIPanel from '@/src/app/components/ROIPanel';
import { motion } from 'framer-motion';
import Link from 'next/link';

// ── Style primitives matching AppTrainAI ────────────────────────────────────
const cellCls = 'bg-white dark:bg-slate-900 rounded-2xl transition-colors duration-500';

const ActivityCalendar = ({ data }: { data: any[] }) => {
    const [selectedCell, setSelectedCell] = useState<any>(null);

    // Build the grid mapping the last 30 days exactly
    const generateLast30Days = () => {
        const days = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            days.push(d.toISOString().split('T')[0]); // YYYY-MM-DD
        }
        return days;
    };

    const calendarDates = generateLast30Days();

    // Map existing data to dictionary for fast lookup
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

    // Default to today or most recent
    useEffect(() => {
        if (data && data.length > 0 && !selectedCell) {
            const todayStr = new Date().toISOString().split('T')[0];
            if (dataMap[todayStr]) {
                setSelectedCell(dataMap[todayStr]);
            } else {
                setSelectedCell(data[0]);
            }
        }
    }, [data, selectedCell]);

    const formatDateStr = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="flex flex-col lg:flex-row gap-8 w-full p-1">
            {/* Calendar Grid (50%) */}
            <div className="w-full lg:w-1/2 flex flex-col gap-4">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium font-google text-slate-500">Activity overview</span>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <div className="w-2 h-2 rounded-full border border-slate-200" /> Idle
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <div className="w-2 h-2 rounded-full bg-blue-500/50" /> Active
                        </div>
                    </div>
                </div>
                {/* Enforce 10 columns across all devices to minimize vertical height, allowing the inspector to sit directly below on mobile */}
                <div className="grid grid-cols-7 gap-1.5 md:gap-3 w-full max-w-full overflow-hidden p-2.5">
                    {calendarDates.map((dateStr, i) => {
                        const cellData = dataMap[dateStr];
                        const count = cellData?.total_questions || 0;
                        const opacity = maxCount > 0 ? (count / maxCount) : 0;
                        const isSelected = selectedCell?.date === dateStr;

                        return (
                            <div
                                key={dateStr}
                                onClick={() => setSelectedCell(cellData || { date: dateStr, count: 0 })}
                                onMouseEnter={() => setSelectedCell(cellData || { date: dateStr, count: 0 })}
                                className={`aspect-[3/4] sm:aspect-square w-full min-w-[24px] rounded-xl cursor-pointer transition-all duration-200 border relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 z-10 scale-105' : 'hover:scale-105 z-0'}`}
                                style={{
                                    backgroundColor: count > 0 ? `rgba(59, 130, 246, ${Math.max(0.15, opacity)})` : 'transparent',
                                    borderColor: count === 0 ? 'rgba(148, 163, 184, 0.15)' : 'rgba(59, 130, 246, 0.4)',
                                }}
                            >
                                <span className={`text-[12px] sm:text-[14px] leading-none font-mono font-semibold ${count > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {new Date(dateStr).getDate()}
                                </span>
                                <span className={`text-[8px] sm:text-[9px] font-google font-medium leading-none ${count > 0 ? 'text-blue-600/70 dark:text-blue-300/70' : 'text-slate-300 dark:text-slate-600'}`}>
                                    {new Date(dateStr).toLocaleDateString(undefined, { month: 'short' })}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Inspector Panel (50%) */}
            <div className="w-full lg:w-1/2 flex flex-col">
                {selectedCell ? (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        key={selectedCell.date}
                        className="flex flex-col bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl flex-1"
                    >
                        <div className="flex flex-col gap-1 mb-6 pb-4">
                            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-google">Daily inspector</span>
                            <span className="text-lg font-semibold text-slate-900 dark:text-slate-100 font-google">
                                {formatDateStr(selectedCell.date)}
                            </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-6">
                            <div className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-xl">
                                <span className="text-xs text-slate-400 font-google mb-1">Total activity</span>
                                <span className="text-2xl font-semibold font-google text-slate-900 dark:text-slate-100">{selectedCell.total_questions || 0}</span>
                            </div>
                            <div className="flex flex-col p-4 bg-white dark:bg-slate-800 rounded-xl">
                                <span className="text-xs text-slate-400 font-google mb-1">Unique users</span>
                                <span className="text-2xl font-semibold font-google text-slate-900 dark:text-slate-200">{selectedCell.interacted_users || 0}</span>
                            </div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 transition-colors">
                                <span className="text-sm font-google text-slate-500 dark:text-slate-400">Answered correctly</span>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{selectedCell.answered_questions || 0}</span>
                            </div>
                            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-white/60 dark:hover:bg-slate-800 transition-colors">
                                <span className="text-sm font-google text-slate-500 dark:text-slate-400">Failed response</span>
                                <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                                    {selectedCell.unanswered_questions || 0}
                                </span>
                            </div>
                        </div>

                        <div className="mt-6 flex-1 flex flex-col gap-5">
                            <div className="flex flex-col">
                                <span className="text-xs font-medium text-slate-400 font-google mb-3 flex items-center gap-2">
                                    <span className="w-1 h-3 bg-blue-500 rounded-full" />
                                    Top questions
                                </span>
                                {selectedCell.top_questions?.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedCell.top_questions.map((q: string, qIdx: number) => (
                                            <p key={qIdx} className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed italic bg-white dark:bg-slate-800 p-3 rounded-xl">
                                                "{q}"
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-sm font-google text-slate-400 italic">No activity recorded</span>
                                )}
                            </div>

                            {selectedCell.unanswered_questions > 0 && selectedCell.top_unanswered?.length > 0 && (
                                <div className="flex flex-col pt-4">
                                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-google mb-3 flex items-center gap-2">
                                        <span className="w-1 h-3 bg-slate-400/60 rounded-full" />
                                        Unanswered queries
                                    </span>
                                    <div className="space-y-2">
                                        {selectedCell.top_unanswered.map((q: string, qIdx: number) => (
                                            <p key={qIdx} className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed pl-3">
                                                "{q}"
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <div className="flex flex-col bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-2xl items-center justify-center h-full">
                        <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600 mb-2">radar</span>
                        <p className="text-sm font-google text-slate-400 text-center">Select a day<br />to inspect activity</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default function AppInsights() {
    const { userTier: rawUserTier, userRole: rawUserRole, entitlements, isLoading: ctxLoading } = useUserRole();
    const userTier = rawUserTier ?? '';
    const userRole = rawUserRole ?? '';
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

    // ── State ────────────────────────────────────────────────────────────────
    const [reportData, setReportData] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [isGhostTown, setIsGhostTown] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('analytics'); // 'analytics' or 'leads'

    // Silently try to load a cached report on mount
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
            console.error('Failed to generate report:', err);
            if (err?.message?.includes('404')) {
                setIsGhostTown(true);
            } else if (!silentLoad) {
                setError('Failed to generate report. Please try again or check your data.');
            }
        } finally {
            if (!silentLoad) setIsGenerating(false);
        }
    };

    // ── Rendering Helpers ────────────────────────────────────────────────────
    const renderHeader = () => (
        <div className="px-6 py-7 sm:px-8 sm:py-8 shrink-0 transition-colors duration-500 min-w-0 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
                <div className="min-w-0">
                    <div className="flex items-center gap-2.5 mb-2">
                        <span className="material-symbols-outlined text-[22px] text-slate-500 dark:text-slate-400 transition-colors shrink-0">
                            insights
                        </span>
                        <h1 className="text-2xl md:text-3xl font-google font-semibold tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors truncate">
                            Sapybase Insights
                        </h1>
                    </div>
                    <p className="text-sm md:text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        AI-synthesized business intelligence from your chat logs. Reports refresh every 24 hours.
                    </p>
                    {lastGeneratedAt && activeTab === 'analytics' && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-google mt-2 transition-colors">
                            Last generated: {lastGeneratedAt}
                        </p>
                    )}
                </div>
                {canAnalytics && activeTab === 'analytics' && (
                    <button
                        onClick={() => handleGenerate(false)}
                        disabled={isGenerating || !selectedBotId}
                        className="w-full sm:w-auto shrink-0 px-7 py-3 min-h-[44px] rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                                Synthesizing...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                                Generate report
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Persistent Bot Selector */}
            {canAnalytics && bots.length > 1 && (
                <div className="mt-5 pt-5 flex flex-wrap items-center gap-3 shrink-0 transition-colors duration-500">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 font-sans whitespace-nowrap">
                        Reporting for
                    </span>
                    <select
                        value={selectedBotId}
                        onChange={e => { setSelectedBotId(e.target.value); setReportData(null); }}
                        className="flex-1 min-w-0 max-w-xs px-3 py-2.5 bg-slate-100 dark:bg-slate-800 focus:bg-slate-200 dark:focus:bg-slate-700 focus:outline-none text-sm font-mono text-slate-900 dark:text-slate-200 rounded-xl transition-colors"
                    >
                        {bots.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.bot_name} — {b.company_name}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Tabs */}
            <div className="mt-7 overflow-x-auto scrollbar-hide">
                <div className="flex items-center gap-1 min-w-max sm:min-w-0 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                    {[
                        { id: 'analytics', label: 'Analytics' },
                        { id: 'leads', label: 'Leads CRM' },
                        { id: 'conversations', label: 'Conversations' },
                        { id: 'fixes', label: 'Fixes Needed' },
                        { id: 'roi', label: 'ROI' },
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-4 py-2 text-sm font-medium font-google rounded-lg whitespace-nowrap transition-all ${activeTab === tab.id
                                    ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );

    // ── Loading state ────────────────────────────────────────────────────────
    const isLoaded = !ctxLoading && !botsLoading;

    if (!isLoaded) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-slate-900 animate-pulse transition-colors duration-500">
                <div className="bg-white dark:bg-slate-950 px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-100 dark:border-slate-800">
                    <div className="h-7 bg-slate-200 dark:bg-slate-800 w-48 mb-2" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 w-72" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-slate-950 p-4 sm:p-8">
                            <div className="h-4 bg-slate-100 dark:bg-slate-800 w-24 mb-3" />
                            <div className="h-10 bg-slate-100 dark:bg-slate-800 w-16" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-white dark:bg-slate-800 flex-1">
                    <div className="lg:col-span-7 bg-white dark:bg-slate-950 p-4 sm:p-8" />
                    <div className="lg:col-span-5 bg-white dark:bg-slate-950 p-4 sm:p-8" />
                </div>
            </div>
        );
    }

    // ── Main Dashboard Return ────────────────────────────────────────────────
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-500"
        >
            {renderHeader()}

            {/* Content Area */}
            <div className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar flex flex-col px-6 pb-8 md:px-8 gap-6">

                {activeTab === 'leads' && (
                    <LeadsPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        isAuthorized={canLeadCapture}
                    />
                )}

                {activeTab === 'conversations' && (
                    <ConversationsPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        isAuthorized={canAnalytics}
                    />
                )}

                {activeTab === 'fixes' && (
                    <FixesNeededPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        isAuthorized={canAnalytics}
                    />
                )}

                {activeTab === 'roi' && (
                    <ROIPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        isAuthorized={canAnalytics}
                    />
                )}

                {activeTab === 'analytics' && (
                    <>
                        {/* ── Tier Gate ── */}
                        {!canAnalytics && (
                            <div className="p-8">
                                <UpgradePrompt code="DEFAULT" tier={userTier} mode="inline" />
                            </div>
                        )}

                        {canAnalytics && reportData && !isGenerating && !error && (
                            <div className="flex flex-col gap-4 flex-1 w-full overflow-hidden">

                                {/* ── ROI Scorecards (Top Row) ── */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 w-full min-w-0">
                                    {/* Support Hours Saved */}
                                    <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">timer</span>
                                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 font-google">Support hours saved</h3>
                                        </div>
                                        <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{Math.floor((Number((reportData?.roi_metrics?.support_savings || '$0').replace(/[^0-9.-]+/g, "")) || 0) / 25)}</span><span className="text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">hours</span></div>
                                        <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Based on estimated handled query resolution time.</p>
                                    </div>

                                    {/* Estimated Savings */}
                                    <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">savings</span>
                                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 font-google">Estimated savings</h3>
                                        </div>
                                        <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{reportData?.roi_metrics?.support_savings || '$0.00'}</span></div>
                                        <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Cost avoided against standard human agent hourly rates.</p>
                                    </div>

                                    {/* Leads Captured / Potential Revenue */}
                                    <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">leaderboard</span>
                                            <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-400 font-google">Potential revenue</h3>
                                        </div>
                                        <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{reportData?.roi_metrics?.potential_revenue || '$0.00'}</span><span className="text-sm uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">est. value</span></div>
                                        <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Calculated from the leads captured by the AI.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 overflow-hidden transition-colors duration-500 flex-1 w-full min-w-0">
                                    {/* Left Column: Top Trends & Temporal */}
                                    <div className={`lg:col-span-7 flex flex-col gap-4 transition-colors duration-500`}>
                                        <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                                            <div className="flex items-center gap-2 mb-6">
                                                <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">trending_up</span>
                                                <h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">
                                                    Top customer trends
                                                </h2>
                                            </div>
                                            <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                                                The most common subjects and questions your users are asking.
                                            </p>
                                            <div className="space-y-2">
                                                {reportData?.top_trends?.map((trend: string, idx: number) => (
                                                    <div key={idx} className={`${cellCls} flex items-start gap-4 p-5`}>
                                                        <div className="w-8 h-8 shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                                                            {String(idx + 1).padStart(2, '0')}
                                                        </div>
                                                        <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed pt-1.5">
                                                            {trend}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Knowledge Gaps + Advice */}
                                    <div className="lg:col-span-5 flex flex-col gap-4 transition-colors duration-500">
                                        <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">warning</span>
                                                <h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">
                                                    High value gaps
                                                </h2>
                                            </div>
                                            <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                                                Questions your bot failed to answer. Train these topics to secure leads.
                                            </p>
                                            <div className="space-y-2 mb-4 overflow-y-auto max-h-[240px] custom-scrollbar pr-1">
                                                {reportData?.high_value_gaps?.length > 0 ? reportData.high_value_gaps.map((gap: string, idx: number) => (
                                                    <div key={idx} className="flex items-start gap-3 p-4 bg-slate-100 dark:bg-slate-800">
                                                        <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">help_center</span>
                                                        <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed flex-1">"{gap}"</p>
                                                        <Link href={`/dashboard/train?query=${encodeURIComponent(gap)}`} className="shrink-0 text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 flex items-center transition-colors">Fix <span className="material-symbols-outlined text-[12px] ml-1">build</span></Link>
                                                    </div>
                                                )) : (
                                                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 italic">No critical knowledge gaps detected.</p>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mb-4">
                                                <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">lightbulb</span>
                                                <h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Actionable advice</h2>
                                            </div>
                                            <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">
                                                {reportData?.actionable_advice || 'Keep monitoring your analytics.'}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Peak Activity Full Row ── */}
                                <div className="flex flex-col gap-4 mb-4">
                                    <div className={`${cellCls} p-4 sm:p-8`}>
                                        <div className="flex items-center gap-2 mb-4">
                                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">calendar_month</span>
                                            <h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">30-day peak activity</h2>
                                        </div>
                                        <div className="w-full">
                                            <ActivityCalendar data={reportData?.peak_activity_blocks} />
                                        </div>
                                    </div>
                                </div>

                                {/* ── Recent Conversations Log ── */}
                                <div className="flex flex-col gap-4 mb-4 w-full overflow-hidden">
                                    <div className={`${cellCls} p-4 sm:p-8 overflow-x-auto overflow-y-hidden scrollbar-hide`}>
                                        <div className="flex items-center gap-2 mb-6">
                                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5 shrink-0">history</span>
                                            <h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Recent activity log</h2>
                                        </div>
                                        <div className="w-full min-w-0">
                                            <div className="hidden md:grid grid-cols-12 gap-4 pb-3 mb-3 px-4">
                                                <div className="col-span-8 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">User Query</div>
                                                <div className="col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google text-center">Status</div>
                                                <div className="col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google text-right">Time</div>
                                            </div>
                                            <div className="space-y-3 md:space-y-1">
                                                {reportData?.recent_conversations?.map((log: any, idx: number) => (
                                                    <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 py-4 md:py-3 px-3 sm:px-4 bg-[#f1f3f5]/50 md:bg-transparent dark:bg-slate-900/20 md:dark:bg-transparent rounded-sm hover:bg-[#f1f3f5]/75 dark:hover:bg-slate-900/30 transition-colors md:items-center min-w-0">
                                                        <div className="col-span-8 min-w-0 text-sm font-google font-medium text-slate-700 dark:text-slate-300 break-words md:truncate">
                                                            {log.query}
                                                        </div>
                                                        <div className="col-span-2 flex items-center md:justify-center gap-3 md:gap-0 mt-2 md:mt-0">
                                                            <span className="md:hidden text-[10px] uppercase font-bold text-slate-400 font-google tracking-widest">Status:</span>
                                                            {log.unanswered ? (
                                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400/60 dark:bg-slate-500/50"></span> Unanswered
                                                                </span>
                                                            ) : (
                                                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-200 dark:bg-slate-700 px-2.5 py-1 rounded-full">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-slate-800 dark:bg-slate-200 animate-pulse"></span> Handled
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="col-span-2 flex items-center md:justify-end gap-3 md:gap-0 mt-1 md:mt-0">
                                                            <span className="md:hidden text-[10px] uppercase font-bold text-slate-400 font-google tracking-widest">Time:</span>
                                                            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                                                {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!reportData?.recent_conversations || reportData.recent_conversations.length === 0) && (
                                                    <div className="text-center py-6 text-sm italic font-google text-slate-400">No recent activity found.</div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Error Banner ── */}
                        {canAnalytics && error && (
                            <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50 px-4 py-4 sm:px-8 flex items-start gap-3 shrink-0">
                                <span className="material-symbols-outlined text-[18px] text-red-500 dark:text-red-400 mt-0.5">error</span>
                                <p className="text-sm font-display text-red-700 dark:text-red-300 flex-1">{error}</p>
                                <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-[18px]">close</span></button>
                            </div>
                        )}

                        {/* ── Ghost Town ── */}
                        {canAnalytics && isGhostTown && !isGenerating && (
                            <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center`}>
                                <div className="w-14 h-14 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5">
                                    <span className="material-symbols-outlined text-[28px] text-slate-400 dark:text-slate-500">chat_bubble</span>
                                </div>
                                <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-3">No Conversations Yet</h2>
                                <p className="text-sm font-display text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                                    Your bot hasn't had any conversations yet. Check back once users start interacting!
                                </p>
                                <Link href="/dashboard/bots" className="px-7 py-3 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-700 transition-all active:scale-95">View my bots</Link>
                            </div>
                        )}

                        {/* ── Empty State ── */}
                        {canAnalytics && !reportData && !isGenerating && !error && !isGhostTown && (
                            <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center`}>
                                <div className="w-14 h-14 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5">
                                    <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600">auto_awesome</span>
                                </div>
                                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2">No Report Generated Yet</h2>
                                <p className="text-sm font-display text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">Click "Generate Report" above to synthesize your chat logs.</p>
                            </div>
                        )}

                        {/* ── Loading Spinner ── */}
                        {canAnalytics && isGenerating && (
                            <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center`}>
                                <div className="w-10 h-10 border-2 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-blue-500 animate-spin mb-5 rounded-full" />
                                <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2">Synthesizing...</h2>
                                <p className="text-sm font-display text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">AI is analyzing logs. This takes 5–10 seconds.</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </motion.div>
    );
}
