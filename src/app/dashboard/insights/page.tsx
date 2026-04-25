'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch, useIsAuthReady } from '@/src/lib/hooks/useAuthenticatedFetch';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import LeadsPanel from '@/src/app/components/LeadsPanel';
import ConversationsPanel from '@/src/app/components/ConversationsPanel';
import ROIPanel from '@/src/app/components/ROIPanel';
import { motion } from 'framer-motion';
import Link from 'next/link';

// ── Style primitives matching AppTrainAI ────────────────────────────────────
const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

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
                    <span className="text-[10px] font-google uppercase tracking-widest font-bold text-slate-500">Activity Overview</span>
                    <div className="flex items-center gap-4">
                         <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                            <div className="w-2 h-2 rounded-full border border-slate-200" /> IDLE
                         </div>
                         <div className="flex items-center gap-1.5 text-[9px] font-bold text-slate-400">
                            <div className="w-2 h-2 rounded-full bg-blue-500/50" /> ACTIVE
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
                                className={`aspect-[3/4] sm:aspect-square w-full min-w-[24px] rounded-md cursor-pointer transition-all duration-200 border relative flex flex-col items-center justify-center gap-0.5 sm:gap-1 ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-slate-900 z-10 scale-105' : 'hover:scale-105 z-0'}`}
                                style={{ 
                                    backgroundColor: count > 0 ? `rgba(59, 130, 246, ${Math.max(0.15, opacity)})` : 'transparent',
                                    borderColor: count === 0 ? 'rgba(148, 163, 184, 0.15)' : 'rgba(59, 130, 246, 0.4)',
                                }}
                            >
                                <span className={`text-[11px] sm:text-[14px] leading-none font-mono font-bold ${count > 0 ? 'text-blue-700 dark:text-blue-300' : 'text-slate-400 dark:text-slate-500'}`}>
                                    {new Date(dateStr).getDate()}
                                </span>
                                <span className={`text-[7px] sm:text-[9px] uppercase tracking-widest font-google font-bold leading-none ${count > 0 ? 'text-blue-600/70 dark:text-blue-300/70' : 'text-slate-300 dark:text-slate-600'}`}>
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
                        className="flex flex-col bg-slate-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-900/40 p-6 rounded-lg shadow-sm flex-1 ring-1 ring-blue-500/5"
                    >
                        <div className="flex flex-col gap-1 mb-6 border-b border-slate-200 dark:border-slate-800 pb-4">
                            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-blue-500 dark:text-blue-400 font-google">Daily Inspector</span>
                            <span className="text-lg font-bold text-slate-900 dark:text-slate-100 font-google">
                                {formatDateStr(selectedCell.date)}
                            </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-6">
                            <div className="flex flex-col p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-sm">
                                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold font-google">Total Activity</span>
                                <span className="text-2xl font-bold font-google text-slate-900 dark:text-slate-100 mt-1">{selectedCell.total_questions || 0}</span>
                            </div>
                            <div className="flex flex-col p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-sm">
                                <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold font-google">Unique Users</span>
                                <span className="text-2xl font-bold font-google text-blue-600 dark:text-blue-400 mt-1">{selectedCell.interacted_users || 0}</span>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-2">
                                <span className="text-xs font-google text-slate-500 dark:text-slate-400">Answered Correct</span>
                                <span className="text-sm font-bold text-green-600 dark:text-green-500">{selectedCell.answered_questions || 0}</span>
                            </div>
                            <div className="flex items-center justify-between p-2">
                                <span className="text-xs font-google text-slate-500 dark:text-slate-400">Failed Response</span>
                                <span className={`text-sm font-bold ${selectedCell.unanswered_questions > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                    {selectedCell.unanswered_questions || 0}
                                </span>
                            </div>
                        </div>

                        <div className="mt-8 flex-1 flex flex-col gap-5">
                            <div className="flex flex-col">
                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-google mb-3 flex items-center gap-2">
                                    <span className="w-1 h-3 bg-blue-500 rounded-full" />
                                    Top Questions
                                </span>
                                {selectedCell.top_questions?.length > 0 ? (
                                    <div className="space-y-2">
                                        {selectedCell.top_questions.map((q: string, qIdx: number) => (
                                            <p key={qIdx} className="text-xs font-google text-slate-600 dark:text-slate-400 leading-relaxed italic bg-white dark:bg-slate-800/50 p-2 rounded-sm border border-slate-100 dark:border-slate-800">
                                                "{q}"
                                            </p>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-xs font-google text-slate-400 italic">No activity recorded</span>
                                )}
                            </div>

                            {selectedCell.unanswered_questions > 0 && selectedCell.top_unanswered?.length > 0 && (
                                <div className="flex flex-col border-t border-red-500/10 pt-5">
                                    <span className="text-[10px] uppercase tracking-widest text-red-400 font-bold font-google mb-3 flex items-center gap-2">
                                        <span className="w-1 h-3 bg-red-500 rounded-full" />
                                        Unanswered Queries
                                    </span>
                                    <div className="space-y-2">
                                        {selectedCell.top_unanswered.map((q: string, qIdx: number) => (
                                            <p key={qIdx} className="text-xs font-google text-red-500/80 leading-relaxed border-l-2 border-red-500/30 pl-3">
                                                "{q}"
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <div className="flex flex-col bg-slate-50/50 dark:bg-slate-900/30 border border-dashed border-slate-200 dark:border-slate-800 p-8 rounded-lg items-center justify-center h-full">
                        <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600 mb-2">radar</span>
                        <p className="text-xs font-google text-slate-400 uppercase tracking-widest font-bold text-center">Select a day<br/>to inspect activity</p>
                    </div>
                )}
            </div>
        </div>
    );
};

const AUTHORIZED_TIERS = new Set(['PRO', 'ENTERPRISE']);

export default function AppInsights() {
    const { userTier: rawUserTier, userRole: rawUserRole, isLoading: ctxLoading } = useUserRole();
    const userTier = rawUserTier ?? '';
    const userRole = rawUserRole ?? '';
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
        if (selectedBotId && AUTHORIZED_TIERS.has(userTier)) handleGenerate(true);
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
        <div className="bg-white dark:bg-slate-950 px-4 py-4 sm:px-8 sm:py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">
                            insights
                        </span>
                        <h1 className="text-xl md:text-2xl font-google font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">
                            SaPyBase Insights
                        </h1>
                    </div>
                    <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        AI-synthesized business intelligence from your chat logs. Reports refresh every 24 hours.
                    </p>
                    {lastGeneratedAt && activeTab === 'analytics' && (
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mt-1.5 transition-colors">
                            Last generated: {lastGeneratedAt}
                        </p>
                    )}
                </div>
                {AUTHORIZED_TIERS.has(userTier) && activeTab === 'analytics' && (
                    <button
                        onClick={() => handleGenerate(false)}
                        disabled={isGenerating || !selectedBotId}
                        className="w-full sm:w-auto shrink-0 px-8 py-3 min-h-[44px] bg-slate-900 dark:bg-blue-600 text-white text-md uppercase tracking-widest font-bold hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                                Synthesizing...
                            </>
                        ) : (
                            <>
                                <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
                                Generate Report
                            </>
                        )}
                    </button>
                )}
            </div>

            {/* Persistent Bot Selector */}
            {AUTHORIZED_TIERS.has(userTier) && bots.length > 1 && (
                <div className="mt-5 pt-5 border-t border-gray-50 dark:border-slate-800/50 flex flex-wrap items-center gap-3 shrink-0 transition-colors duration-500">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 font-sans whitespace-nowrap">
                        Reporting for
                    </span>
                    <select
                        value={selectedBotId}
                        onChange={e => { setSelectedBotId(e.target.value); setReportData(null); }}
                        className="flex-1 max-w-xs px-3 py-2 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 text-sm font-mono text-slate-900 dark:text-slate-200 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                    >
                        {bots.map((b: any) => (
                            <option key={b.id} value={b.id}>{b.bot_name} — {b.company_name}</option>
                        ))}
                    </select>
                </div>
            )}
            
            {/* Tabs */}
            <div className="mt-6 -mx-4 sm:mx-0 overflow-x-auto">
            <div className="flex items-center gap-4 sm:gap-6 border-b border-gray-100 dark:border-slate-800 px-4 sm:px-0 min-w-max sm:min-w-0">
                <button
                    onClick={() => setActiveTab('analytics')}
                    className={`pb-3 text-sm font-google tracking-widest uppercase font-bold transition-all border-b-2 ${
                        activeTab === 'analytics' 
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400' 
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    Analytics Report
                </button>
                <button
                    onClick={() => setActiveTab('leads')}
                    className={`pb-3 text-sm font-google tracking-widest uppercase font-bold transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'leads'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    Leads CRM
                </button>
                <button
                    onClick={() => setActiveTab('conversations')}
                    className={`pb-3 text-sm font-google tracking-widest uppercase font-bold transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'conversations'
                            ? 'border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    Conversations
                </button>
                <button
                    onClick={() => setActiveTab('roi')}
                    className={`pb-3 text-sm font-google tracking-widest uppercase font-bold transition-all border-b-2 flex items-center gap-2 ${
                        activeTab === 'roi'
                            ? 'border-green-600 text-green-600 dark:text-green-400 dark:border-green-400'
                            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    <span className="material-symbols-outlined text-[14px]">savings</span>
                    ROI
                </button>
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
            className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-hidden transition-colors duration-500"
        >
            {renderHeader()}

            {/* Content Area */}
            <div className="flex-1 overflow-auto custom-scrollbar flex flex-col">
                
                {activeTab === 'leads' && (
                    <LeadsPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        userTier={userTier}
                        userRole={userRole}
                    />
                )}

                {activeTab === 'conversations' && (
                    <ConversationsPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        userTier={userTier}
                        userRole={userRole}
                    />
                )}

                {activeTab === 'roi' && (
                    <ROIPanel
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        userTier={userTier}
                        userRole={userRole}
                    />
                )}

                {activeTab === 'analytics' && (
                    <>
                        {/* ── Tier Gate ── */}
                        {!AUTHORIZED_TIERS.has(userTier) && (
                            <div className="p-8">
                                <UpgradePrompt code="DEFAULT" tier={userTier} mode="inline" />
                            </div>
                        )}

                        {AUTHORIZED_TIERS.has(userTier) && reportData && !isGenerating && !error && (
                            <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1">
                                
                                {/* ── ROI Scorecards (Top Row) ── */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white dark:bg-slate-800">
                            {/* Support Hours Saved */}
                            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">timer</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Support Hours Saved</h3>
                                </div>
                                <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{Math.floor((Number((reportData?.roi_metrics?.support_savings || '$0').replace(/[^0-9.-]+/g,"")) || 0) / 25)}</span><span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">hours</span></div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Based on estimated handled query resolution time.</p>
                            </div>

                            {/* Estimated Savings */}
                            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-green-600 dark:text-green-500 pt-0.5">savings</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Estimated Savings</h3>
                                </div>
                                <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{reportData?.roi_metrics?.support_savings || '$0.00'}</span></div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Cost avoided against standard human agent hourly rates.</p>
                            </div>

                            {/* Leads Captured / Potential Revenue */}
                            <div className={`${cellCls} p-4 sm:p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-500 pt-0.5">leaderboard</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Potential Revenue</h3>
                                </div>
                                <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{reportData?.roi_metrics?.potential_revenue || '$0.00'}</span><span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">est. value</span></div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Calculated from the leads captured by the AI.</p>
                            </div>
                        </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-white dark:bg-slate-800 overflow-visible transition-colors duration-500 flex-1">
                        {/* Left Column: Top Trends & Temporal */}
                        <div className={`lg:col-span-7 flex flex-col gap-px bg-white dark:bg-slate-800 transition-colors duration-500`}>
                            <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                                <div className="flex items-center gap-2 mb-6">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">trending_up</span>
                                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                                        Top Customer Trends
                                    </h2>
                                </div>
                                <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                                    The most common subjects and questions your users are asking.
                                </p>
                                <div className="space-y-px bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800">
                                    {reportData?.top_trends?.map((trend: string, idx: number) => (
                                        <div key={idx} className={`${cellCls} flex items-start gap-4 p-5`}>
                                            <div className="w-8 h-8 shrink-0 bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
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
                        <div className="lg:col-span-5 flex flex-col gap-px bg-white dark:bg-slate-800 transition-colors duration-500">
                            <div className={`${cellCls} p-4 sm:p-8 flex-1`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400">warning</span>
                                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                                        High Value Gaps
                                    </h2>
                                </div>
                                <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                                    Questions your bot failed to answer. Train these topics to secure leads.
                                </p>
                                <div className="space-y-2 mb-4 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
                                    {reportData?.high_value_gaps?.length > 0 ? reportData.high_value_gaps.map((gap: string, idx: number) => (
                                        <div key={idx} className="flex items-start gap-3 p-4 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                                            <span className="material-symbols-outlined text-[16px] text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">help_center</span>
                                            <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed flex-1">"{gap}"</p>
                                            <Link href={`/dashboard/train?query=${encodeURIComponent(gap)}`} className="shrink-0 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center transition-colors">Fix <span className="material-symbols-outlined text-[12px] ml-1">build</span></Link>
                                        </div>
                                    )) : (
                                        <p className="text-sm font-google text-slate-500 dark:text-slate-400 italic">No critical knowledge gaps detected.</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">lightbulb</span>
                                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Actionable Advice</h2>
                                </div>
                                <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {reportData?.actionable_advice || 'Keep monitoring your analytics.'}
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* ── Peak Activity Full Row ── */}
                    <div className="flex flex-col gap-px bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-800">
                        <div className={`${cellCls} p-4 sm:p-8`}>
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">calendar_month</span>
                                <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">30-Day Peak Activity</h2>
                            </div>
                            <div className="w-full">
                                <ActivityCalendar data={reportData?.peak_activity_blocks} />
                            </div>
                        </div>
                    </div>

                    {/* ── Recent Conversations Log ── */}
                    <div className="flex flex-col gap-px bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-800">
                        <div className={`${cellCls} p-4 sm:p-8 overflow-x-auto`}>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">history</span>
                                <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Recent Activity Log</h2>
                            </div>
                            <div className="w-full">
                                <div className="hidden md:grid grid-cols-12 gap-4 pb-3 border-b border-gray-100 dark:border-slate-800 mb-3 px-4">
                                    <div className="col-span-8 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google">User Query</div>
                                    <div className="col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google text-center">Status</div>
                                    <div className="col-span-2 text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google text-right">Time</div>
                                </div>
                                <div className="space-y-3 md:space-y-1">
                                    {reportData?.recent_conversations?.map((log: any, idx: number) => (
                                        <div key={idx} className="flex flex-col md:grid md:grid-cols-12 gap-2 md:gap-4 py-4 md:py-3 px-4 bg-slate-50 md:bg-transparent dark:bg-slate-900/50 md:dark:bg-transparent rounded-sm hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors md:items-center">
                                            <div className="col-span-8 text-sm font-google font-medium text-slate-700 dark:text-slate-300 md:truncate">
                                                {log.query}
                                            </div>
                                            <div className="col-span-2 flex items-center md:justify-center gap-3 md:gap-0 mt-2 md:mt-0">
                                                <span className="md:hidden text-[10px] uppercase font-bold text-slate-400 font-google tracking-widest">Status:</span>
                                                {log.unanswered ? (
                                                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 border border-amber-100 dark:border-amber-900/50 px-2 py-0.5 rounded-sm">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-[-1px]"></span> Unanswered
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-100 dark:border-emerald-900/50 px-2 py-0.5 rounded-sm">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-[-1px]"></span> Handled
                                                    </span>
                                                )}
                                            </div>
                                            <div className="col-span-2 flex items-center md:justify-end gap-3 md:gap-0 mt-1 md:mt-0">
                                                <span className="md:hidden text-[10px] uppercase font-bold text-slate-400 font-google tracking-widest">Time:</span>
                                                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                                    {log.timestamp ? new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}
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
                {AUTHORIZED_TIERS.has(userTier) && error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50 px-4 py-4 sm:px-8 flex items-start gap-3 shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-red-500 dark:text-red-400 mt-0.5">error</span>
                        <p className="text-md font-display text-red-700 dark:text-red-300 flex-1">{error}</p>
                        <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-[18px]">close</span></button>
                    </div>
                )}

                {/* ── Ghost Town ── */}
                {AUTHORIZED_TIERS.has(userTier) && isGhostTown && !isGenerating && (
                    <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center`}>
                        <div className="w-14 h-14 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5">
                            <span className="material-symbols-outlined text-[28px] text-slate-400 dark:text-slate-500">chat_bubble</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-3">No Conversations Yet</h2>
                        <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                            Your bot hasn't had any conversations yet. Check back once users start interacting!
                        </p>
                        <Link href="/dashboard/bots" className="px-8 py-3 bg-slate-900 dark:bg-blue-600 text-white text-md uppercase tracking-widest font-bold hover:bg-slate-800 transition-all active:scale-95">View My Bots</Link>
                    </div>
                )}

                {/* ── Empty State ── */}
                {AUTHORIZED_TIERS.has(userTier) && !reportData && !isGenerating && !error && !isGhostTown && (
                    <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center`}>
                        <div className="w-14 h-14 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5">
                            <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600">auto_awesome</span>
                        </div>
                        <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2">No Report Generated Yet</h2>
                        <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">Click "Generate Report" above to synthesize your chat logs.</p>
                    </div>
                )}

                {/* ── Loading Spinner ── */}
                {AUTHORIZED_TIERS.has(userTier) && isGenerating && (
                    <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-6 sm:p-12 text-center`}>
                        <div className="w-10 h-10 border-2 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-blue-500 animate-spin mb-5 rounded-full" />
                        <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2">Synthesizing...</h2>
                        <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">AI is analyzing logs. This takes 5–10 seconds.</p>
                    </div>
                )}
                </>
                )}
            </div>
        </motion.div>
    );
}
