import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '../context/UserContext';
import { useAuthenticatedFetch } from '../hooks/useApiCall';
import UpgradePrompt from '../components/UpgradePrompt';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

// ── Style primitives matching AppTrainAI ────────────────────────────────────
const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

const AppInsights = () => {
    const { userTier, isLoading: ctxLoading } = useUserRole();
    const authFetch = useAuthenticatedFetch();

    const { data: botsData, isLoading: botsLoading } = useQuery({
        queryKey: ['bots'],
        queryFn: () => authFetch('/api/companies'),
        enabled: !ctxLoading,
    });

    const bots = botsData?.bots || [];
    const [selectedBotId, setSelectedBotId] = useState('');

    useEffect(() => {
        if (bots.length > 0 && !selectedBotId) setSelectedBotId(bots[0].id);
    }, [bots, selectedBotId]);

    // ── State ────────────────────────────────────────────────────────────────
    const [reportData, setReportData] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [isGhostTown, setIsGhostTown] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState(null);

    // Silently try to load a cached report on mount
    useEffect(() => {
        if (selectedBotId && userTier === 'PRO') handleGenerate(true);
    }, [selectedBotId, userTier]);

    const handleGenerate = async (silentLoad = false) => {
        if (!selectedBotId) return;
        if (!silentLoad) setIsGenerating(true);
        setError('');
        setIsGhostTown(false);

        try {
            const data = await authFetch(`/api/analytics/generate-report/${selectedBotId}`, {
                method: 'POST',
            });

            if (data.status === 'insufficient_data') {
                setIsGhostTown(true);
                setReportData(null);
            } else if (data.report) {
                setReportData(data.report);
                setLastGeneratedAt(new Date(data.generated_at).toLocaleString());
            } else {
                throw new Error('Invalid response from server');
            }
        } catch (err) {
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
        <div className="bg-white dark:bg-slate-950 px-8 py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">
                            insights
                        </span>
                        <h1 className="text-xl md:text-2xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">
                            SaPyBase Insights
                        </h1>
                    </div>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        AI-synthesized business intelligence from your chat logs. Reports refresh every 24 hours.
                    </p>
                    {lastGeneratedAt && (
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mt-1.5 transition-colors">
                            Last generated: {lastGeneratedAt}
                        </p>
                    )}
                </div>
                {userTier === 'PRO' && (
                    <button
                        onClick={() => handleGenerate(false)}
                        disabled={isGenerating || !selectedBotId}
                        className="shrink-0 px-8 py-3 min-h-[44px] bg-slate-900 dark:bg-indigo-600 text-white text-md uppercase tracking-widest font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" />
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

            {/* Persistent Bot Selector (Fixed issue: visible even in Ghost Town) */}
            {userTier === 'PRO' && bots.length > 1 && (
                <div className="mt-5 pt-5 border-t border-gray-50 dark:border-slate-800/50 flex items-center gap-4 shrink-0 transition-colors duration-500">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 font-sans whitespace-nowrap">
                        Reporting for
                    </span>
                    <select
                        value={selectedBotId}
                        onChange={e => { setSelectedBotId(e.target.value); setReportData(null); }}
                        className="flex-1 max-w-xs px-3 py-2 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-indigo-500/50 text-sm font-mono text-slate-900 dark:text-slate-200 transition-colors hover:border-slate-300 dark:hover:border-slate-700"
                    >
                        {bots.map(b => (
                            <option key={b.id} value={b.id}>{b.bot_name} — {b.company_name}</option>
                        ))}
                    </select>
                </div>
            )}
        </div>
    );

    // ── Loading state ────────────────────────────────────────────────────────
    const isLoaded = !ctxLoading && !botsLoading;

    if (!isLoaded) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-slate-900 animate-pulse transition-colors duration-500">
                <div className="bg-white dark:bg-slate-950 px-8 py-6 border-b border-gray-100 dark:border-slate-800">
                    <div className="h-7 bg-slate-200 dark:bg-slate-800 w-48 mb-2" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 w-72" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-white dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-slate-950 p-8">
                            <div className="h-4 bg-slate-100 dark:bg-slate-800 w-24 mb-3" />
                            <div className="h-10 bg-slate-100 dark:bg-slate-800 w-16" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-white dark:bg-slate-800 flex-1">
                    <div className="lg:col-span-7 bg-white dark:bg-slate-950 p-8" />
                    <div className="lg:col-span-5 bg-white dark:bg-slate-950 p-8" />
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
                
                {/* ── Tier Gate ── */}
                {userTier !== 'PRO' && (
                    <div className="p-8">
                        <UpgradePrompt code="DEFAULT" tier={userTier} mode="inline" />
                    </div>
                )}

                {/* ── Success/Data State ── */}
                {userTier === 'PRO' && reportData && !isGenerating && !error && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-white dark:bg-slate-800 overflow-visible transition-colors duration-500 flex-1">
                        {/* Left Column: Top Trends */}
                        <div className={`lg:col-span-7 ${cellCls} p-8`}>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">trending_up</span>
                                <h2 className="text-md font-display font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                                    Top Customer Trends
                                </h2>
                            </div>
                            <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
                                The most common subjects and questions your users are asking.
                            </p>
                            <div className="space-y-px bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-800">
                                {reportData?.top_trends?.map((trend, idx) => (
                                    <div key={idx} className={`${cellCls} flex items-start gap-4 p-5`}>
                                        <div className="w-8 h-8 shrink-0 bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-bold font-mono text-slate-500 dark:text-slate-400">
                                            {String(idx + 1).padStart(2, '0')}
                                        </div>
                                        <p className="text-sm font-display text-slate-700 dark:text-slate-300 leading-relaxed pt-1.5">
                                            {trend}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column: Knowledge Gaps + Advice */}
                        <div className="lg:col-span-5 flex flex-col gap-px bg-white dark:bg-slate-800 transition-colors duration-500">
                            <div className={`${cellCls} p-8 flex-1`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400">warning</span>
                                    <h2 className="text-md font-display font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                                        Knowledge Gaps
                                    </h2>
                                </div>
                                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                                    Questions your bot failed to answer. Train these topics.
                                </p>
                                <div className="space-y-3">
                                    {reportData?.missing_knowledge?.map((gap, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-4 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                                            <span className="material-symbols-outlined text-[16px] text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">help_outline</span>
                                            <p className="text-sm font-display text-slate-700 dark:text-slate-300 leading-relaxed flex-1">"{gap}"</p>
                                            <Link to="/app/train" className="shrink-0 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 transition-colors">Fix →</Link>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className={`${cellCls} p-8 shrink-0`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">lightbulb</span>
                                    <h2 className="text-md font-display font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Actionable Advice</h2>
                                </div>
                                <p className="text-sm font-display text-slate-600 dark:text-slate-400 leading-relaxed">
                                    {reportData?.actionable_advice || 'Keep monitoring your analytics.'}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Error Banner ── */}
                {userTier === 'PRO' && error && (
                    <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50 px-8 py-4 flex items-start gap-3 shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-red-500 dark:text-red-400 mt-0.5">error</span>
                        <p className="text-md font-display text-red-700 dark:text-red-300 flex-1">{error}</p>
                        <button onClick={() => setError('')} className="text-red-400 hover:text-red-600"><span className="material-symbols-outlined text-[18px]">close</span></button>
                    </div>
                )}

                {/* ── Ghost Town ── */}
                {userTier === 'PRO' && isGhostTown && !isGenerating && (
                    <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-12 text-center`}>
                        <div className="w-14 h-14 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5">
                            <span className="material-symbols-outlined text-[28px] text-slate-400 dark:text-slate-500">chat_bubble</span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-3">No Conversations Yet</h2>
                        <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
                            Your bot hasn't had any conversations yet. Check back once users start interacting!
                        </p>
                        <Link to="/app/bots" className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white text-md uppercase tracking-widest font-bold hover:bg-slate-800 transition-all active:scale-95">View My Bots</Link>
                    </div>
                )}

                {/* ── Empty State ── */}
                {userTier === 'PRO' && !reportData && !isGenerating && !error && !isGhostTown && (
                    <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-12 text-center`}>
                        <div className="w-14 h-14 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5">
                            <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600">auto_awesome</span>
                        </div>
                        <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2">No Report Generated Yet</h2>
                        <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">Click "Generate Report" above to synthesize your chat logs.</p>
                    </div>
                )}

                {/* ── Loading Spinner ── */}
                {userTier === 'PRO' && isGenerating && (
                    <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-12 text-center`}>
                        <div className="w-10 h-10 border-2 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-indigo-500 animate-spin mb-5" />
                        <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2">Synthesizing...</h2>
                        <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed">AI is analyzing logs. This takes 5–10 seconds.</p>
                    </div>
                )}
            </div>
        </motion.div>
    );
};

export default AppInsights;
