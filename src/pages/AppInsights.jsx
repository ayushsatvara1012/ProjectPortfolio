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

    // ── Guards ───────────────────────────────────────────────────────────────
    const isLoaded = !ctxLoading && !botsLoading;

    if (!isLoaded) {
        return (
            <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 animate-pulse transition-colors duration-500">
                <div className="bg-white dark:bg-slate-950 px-8 py-6 border-b border-gray-100 dark:border-slate-800">
                    <div className="h-7 bg-slate-200 dark:bg-slate-800 w-48 mb-2" />
                    <div className="h-4 bg-slate-100 dark:bg-slate-800 w-72" />
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-px bg-[#E8EBF0] dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white dark:bg-slate-950 p-8">
                            <div className="h-4 bg-slate-100 dark:bg-slate-800 w-24 mb-3" />
                            <div className="h-10 bg-slate-100 dark:bg-slate-800 w-16" />
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[#E8EBF0] dark:bg-slate-800 flex-1">
                    <div className="lg:col-span-7 bg-white dark:bg-slate-950 p-8" />
                    <div className="lg:col-span-5 bg-white dark:bg-slate-950 p-8" />
                </div>
            </div>
        );
    }

    if (userTier !== 'PRO') {
        return (
            <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 transition-colors duration-500">
                {/* Header */}
                <div className="bg-white dark:bg-slate-950 px-8 py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">
                            insights
                        </span>
                        <h1 className="text-xl md:text-2xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">
                            SaPyBase Insights
                        </h1>
                    </div>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        AI-synthesized business intelligence from your chat logs.
                    </p>
                </div>
                <div className="p-8">
                    <UpgradePrompt code="DEFAULT" tier={userTier} mode="inline" />
                </div>
            </div>
        );
    }

    // ── Ghost Town ───────────────────────────────────────────────────────────
    if (isGhostTown) {
        return (
            <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 transition-colors duration-500">
                <div className="bg-white dark:bg-slate-950 px-8 py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">
                            insights
                        </span>
                        <h1 className="text-xl md:text-2xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">
                            SaPyBase Insights
                        </h1>
                    </div>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        AI-synthesized business intelligence from your chat logs.
                    </p>
                </div>
                <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-12 text-center`}>
                    <div className="w-14 h-14 border-2 border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5 transition-colors">
                        <span className="material-symbols-outlined text-[28px] text-slate-400 dark:text-slate-500 transition-colors">
                            chat_bubble
                        </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-3 transition-colors">
                        No Conversations Yet
                    </h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mb-6 transition-colors">
                        Your bot hasn't had any conversations yet. Check back once you have some website traffic and users start interacting!
                    </p>
                    <Link
                        to="/app/bots"
                        className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white text-md uppercase tracking-widest font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all flex items-center active:scale-95"
                    >
                        View My Bots
                    </Link>
                </div>
            </div>
        );
    }

    // ── Main Dashboard ───────────────────────────────────────────────────────
    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500"
        >
            {/* ── Page Header ── */}
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
                </div>
            </div>

            {/* ── Error Banner ── */}
            {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800/50 px-8 py-4 flex items-start gap-3 transition-colors shrink-0">
                    <span className="material-symbols-outlined text-[18px] text-red-500 dark:text-red-400 shrink-0 mt-0.5 transition-colors">
                        error
                    </span>
                    <p className="text-md font-display text-red-700 dark:text-red-300 leading-relaxed transition-colors">
                        {error}
                    </p>
                    <button
                        onClick={() => setError('')}
                        className="ml-auto text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                    </button>
                </div>
            )}

            {/* ── Empty / Pre-generate State ── */}
            {!reportData && !isGenerating && !error && (
                <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-12 text-center border-t border-gray-100 dark:border-slate-800`}>
                    <div className="w-14 h-14 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5 transition-colors">
                        <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600 transition-colors">
                            auto_awesome
                        </span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2 transition-colors">
                        No Report Generated Yet
                    </h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed transition-colors">
                        Click "Generate Report" above to synthesize your chat logs into business intelligence.
                    </p>
                </div>
            )}

            {/* ── Synthesizing Spinner ── */}
            {isGenerating && (
                <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-12 text-center border-t border-gray-100 dark:border-slate-800`}>
                    <div className="w-10 h-10 border-2 border-slate-200 dark:border-slate-700 border-t-slate-900 dark:border-t-indigo-500 animate-spin mb-5 transition-colors" />
                    <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2 transition-colors">
                        Synthesizing Customer Data...
                    </h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-xs leading-relaxed transition-colors">
                        The AI is analyzing your chat logs. This typically takes 5–10 seconds.
                    </p>
                </div>
            )}

            {/* ── Report Layout ── */}
            {reportData && !isGenerating && (
                <>
                    {/* ── Multi-bot selector (if applicable) ── */}
                    {bots.length > 1 && (
                        <div className={`${cellCls} px-8 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center gap-4 shrink-0`}>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 font-sans whitespace-nowrap transition-colors">
                                Reporting for
                            </span>
                            <select
                                value={selectedBotId}
                                onChange={e => { setSelectedBotId(e.target.value); setReportData(null); }}
                                className="flex-1 max-w-xs px-3 py-2 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-indigo-500/50 text-sm font-mono text-slate-900 dark:text-slate-200 transition-colors"
                            >
                                {bots.map(b => (
                                    <option key={b.id} value={b.id}>{b.bot_name} — {b.company_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* ── Main Grid ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[#E8EBF0] dark:bg-slate-800 overflow-auto custom-scrollbar transition-colors duration-500 flex-1">

                        {/* ── Left Column: Top Trends ── */}
                        <div className={`lg:col-span-7 ${cellCls} p-8 overflow-y-auto custom-scrollbar`}>
                            <div className="flex items-center gap-2 mb-6">
                                <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">
                                    trending_up
                                </span>
                                <h2 className="text-md font-display font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest transition-colors">
                                    Top Customer Trends
                                </h2>
                            </div>
                            <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mb-6 transition-colors">
                                The most common subjects and questions your users are asking. Use these to improve your bot's knowledge.
                            </p>

                            <div className="space-y-px bg-[#E8EBF0] dark:bg-slate-800 border border-gray-100 dark:border-slate-800 transition-colors duration-500">
                                {reportData?.top_trends && reportData.top_trends.length > 0 ? (
                                    reportData.top_trends.map((trend, idx) => (
                                        <div key={idx} className={`${cellCls} flex items-start gap-4 p-5`}>
                                            <div className="w-8 h-8 shrink-0 bg-[#E8EBF0] dark:bg-slate-800 flex items-center justify-center text-xs font-bold font-mono text-slate-500 dark:text-slate-400 transition-colors">
                                                {String(idx + 1).padStart(2, '0')}
                                            </div>
                                            <p className="text-sm font-display text-slate-700 dark:text-slate-300 leading-relaxed pt-1.5 transition-colors">
                                                {trend}
                                            </p>
                                        </div>
                                    ))
                                ) : (
                                    <div className={`${cellCls} p-8 text-center`}>
                                        <p className="text-md font-display text-slate-500 dark:text-slate-400 italic transition-colors">
                                            No clear trends detected yet.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ── Right Column: Knowledge Gaps + Advice ── */}
                        <div className="lg:col-span-5 flex flex-col gap-px bg-[#E8EBF0] dark:bg-slate-800 transition-colors duration-500">

                            {/* Knowledge Gaps */}
                            <div className={`${cellCls} p-8 overflow-y-auto custom-scrollbar flex-1`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400 transition-colors">
                                        warning
                                    </span>
                                    <h2 className="text-md font-display font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest transition-colors">
                                        Knowledge Gaps
                                    </h2>
                                </div>
                                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mb-5 transition-colors">
                                    Specific questions your bot failed to answer. Train on these topics immediately.
                                </p>

                                <div className="space-y-3">
                                    {reportData?.missing_knowledge && reportData.missing_knowledge.length > 0 ? (
                                        reportData.missing_knowledge.map((gap, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-start gap-3 p-4 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 transition-colors"
                                            >
                                                <span className="material-symbols-outlined text-[16px] text-amber-500 dark:text-amber-400 shrink-0 mt-0.5 transition-colors">
                                                    help_outline
                                                </span>
                                                <p className="text-sm font-display text-slate-700 dark:text-slate-300 leading-relaxed flex-1 transition-colors">
                                                    "{gap}"
                                                </p>
                                                <Link
                                                    to="/app/train"
                                                    className="shrink-0 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 whitespace-nowrap transition-colors"
                                                >
                                                    Fix →
                                                </Link>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex items-start gap-3 p-4 bg-green-50/60 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 transition-colors">
                                            <span className="material-symbols-outlined text-[16px] text-green-500 dark:text-green-400 shrink-0 mt-0.5 transition-colors">
                                                check_circle
                                            </span>
                                            <div>
                                                <p className="text-md font-display font-bold text-green-700 dark:text-green-400 transition-colors">
                                                    Your bot knows everything!
                                                </p>
                                                <p className="text-md font-display text-slate-500 dark:text-slate-400 transition-colors">
                                                    No unanswered questions found in recent logs.
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Actionable Advice */}
                            <div className={`${cellCls} p-8 shrink-0`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">
                                        lightbulb
                                    </span>
                                    <h2 className="text-md font-display font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest transition-colors">
                                        Actionable Advice
                                    </h2>
                                </div>
                                <p className="text-sm font-display text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">
                                    {reportData?.actionable_advice || 'Keep monitoring your analytics.'}
                                </p>
                            </div>

                        </div>
                    </div>
                </>
            )}
        </motion.div>
    );
};

export default AppInsights;
