import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '../context/UserContext';
import { useAuthenticatedFetch } from '../hooks/useApiCall';
import UpgradePrompt from '../components/UpgradePrompt';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, ChevronRight, RefreshCw, MessageSquareOff } from 'lucide-react';
import { Link } from 'react-router-dom';

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
        if (bots.length > 0 && !selectedBotId) {
            setSelectedBotId(bots[0].id);
        }
    }, [bots, selectedBotId]);

    // ── Phase 2: State Management ───────────────────────────────────────────
    const [reportData, setReportData] = useState(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [isGhostTown, setIsGhostTown] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState(null);

    // Initial fetch to see if there's a cached report within the last 24h
    useEffect(() => {
        if (selectedBotId && userTier === 'PRO') {
            handleGenerate(true);
        }
    }, [selectedBotId, userTier]);

    const handleGenerate = async (silentLoad = false) => {
        if (!selectedBotId) return;
        if (!silentLoad) setIsGenerating(true);
        setError('');
        setIsGhostTown(false);

        try {
            const data = await authFetch(`/api/analytics/generate-report/${selectedBotId}`, {
                method: 'POST'
            });

            if (data.status === 'insufficient_data') {
                setIsGhostTown(true);
                setReportData(null);
            } else if (data.report) {
                setReportData(data.report);
                setLastGeneratedAt(new Date(data.generated_at).toLocaleString());
            } else {
                throw new Error("Invalid response from server");
            }
        } catch (err) {
            console.error("Failed to generate report:", err);
            // Ignore 404s if it simply means the bot hasn't run yet, but API throws 404 for auth mismatch
            if (err?.message?.includes('404')) {
                 setIsGhostTown(true);
            } else if (!silentLoad) {
                 setError('Failed to generate report. Please try again or check your data.');
            }
        } finally {
            if (!silentLoad) setIsGenerating(false);
        }
    };

    // ── Phase 1: Auth Flash / Loading State Protection ───────────────────────
    const isLoaded = !ctxLoading && !botsLoading;
    
    if (!isLoaded) {
        return (
            <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 animate-pulse">
                <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded w-1/3 mb-4"></div>
                <div className="h-32 bg-slate-100 dark:bg-slate-900 rounded-xl mb-6"></div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="h-64 bg-slate-100 dark:bg-slate-900 rounded-xl"></div>
                    <div className="h-64 bg-slate-100 dark:bg-slate-900 rounded-xl"></div>
                </div>
            </div>
        );
    }

    if (userTier !== 'PRO') { 
        return (
             <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8">
                 <UpgradePrompt 
                    code="DEFAULT" 
                    tier={userTier} 
                    mode="inline" 
                 />
             </div>
        );
    }

    // ── UI Components ────────────────────────────────────────────────────────
    
    // Ghost Town Render
    if (isGhostTown) {
        return (
            <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 text-center pt-24">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <MessageSquareOff className="w-8 h-8 text-slate-400 dark:text-slate-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2 font-display">No Conversations Yet</h2>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto mb-8">
                    Your bot hasn't had any conversations yet. Check back once you have some website traffic and users start interacting!
                </p>
                <Link to="/app/bots" className="inline-flex items-center justify-center px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-bold transition-colors rounded-lg tracking-wide uppercase text-xs">
                    View My Bots
                </Link>
            </div>
        );
    }

    return (
        <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8"
        >
            {/* Header Area */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2 flex items-center gap-2">
                        <Sparkles className="w-6 h-6 text-indigo-500" />
                        SaPyBase Insights
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 max-w-xl">
                        AI synthesizes your raw chat logs into actionable business intelligence.
                        Reports are generated at most once every 24 hours to track broad changes.
                    </p>
                    {lastGeneratedAt && (
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                            Last generated: {lastGeneratedAt}
                        </p>
                    )}
                </div>
                
                <button
                    onClick={() => handleGenerate(false)}
                    disabled={isGenerating || !selectedBotId}
                    className="shrink-0 min-w-[200px] flex items-center justify-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm border border-transparent shadow-indigo-600/20 active:scale-[0.98]"
                >
                    {isGenerating ? (
                        <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span className="text-xs tracking-widest uppercase">Synthesizing...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" />
                            <span className="text-xs tracking-widest uppercase">Generate Report</span>
                        </>
                    )}
                </button>
            </div>

            {/* Error Banner */}
            <AnimatePresence>
                {error && (
                    <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mb-6 overflow-hidden"
                    >
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 p-4 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-800 dark:text-red-300 font-medium">
                                {error}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Skeleton / Initial Blank State */}
            {!reportData && !isGenerating && !error && (
                <div className="flex flex-col items-center justify-center p-12 lg:p-24 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20">
                    <Sparkles className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-4" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-center">
                        Click "Generate Report" to analyze your latest customer conversations.
                    </p>
                </div>
            )}

            {/* ── Phase 3: The 3-Card Layout ──────────────────────────────────── */}
            {reportData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Card 1 (🔥 Top Customer Trends) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 flex flex-col h-full transition-colors">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
                                <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-display">Top Customer Trends</h2>
                                <p className="text-xs text-slate-500 max-w-sm">The most common subjects and questions your users are asking.</p>
                            </div>
                        </div>
                        
                        <div className="flex-1 space-y-3">
                            {reportData?.top_trends && reportData.top_trends.length > 0 ? (
                                reportData.top_trends.map((trend, idx) => (
                                    <div key={idx} className="flex gap-3 group">
                                        <div className="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-xs font-bold font-mono flex items-center justify-center shrink-0 mt-0.5">
                                            {idx + 1}
                                        </div>
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-sans mt-1">
                                            {trend}
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500 italic">No clear trends detected yet.</p>
                            )}
                        </div>
                    </div>

                    {/* Card 2 (⚠️ Knowledge Gaps) */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-6 flex flex-col h-full transition-colors">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 font-display">Knowledge Gaps</h2>
                                <p className="text-xs text-slate-500 max-w-sm">Specific questions your bot failed to answer. Action required.</p>
                            </div>
                        </div>

                        <div className="flex-1 space-y-4">
                            {reportData?.missing_knowledge && reportData.missing_knowledge.length > 0 ? (
                                reportData.missing_knowledge.map((gap, idx) => (
                                    <div key={idx} className="flex justify-between items-start gap-4 pb-4 border-b border-slate-100 dark:border-slate-800/60 last:border-0 last:pb-0">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed max-w-[85%] font-medium">
                                            "{gap}"
                                        </p>
                                        <Link 
                                            to="/app/train"
                                            className="shrink-0 flex items-center gap-1 text-[11px] uppercase tracking-wider font-bold text-amber-600 dark:text-amber-500 hover:text-amber-700 dark:hover:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 rounded-md transition-colors"
                                        >
                                            Fix This <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    </div>
                                ))
                            ) : (
                                <div className="h-full flex flex-col items-center justify-center text-center py-6">
                                    <div className="w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
                                        <Sparkles className="w-6 h-6 text-green-600 dark:text-green-500" />
                                    </div>
                                    <p className="text-sm font-bold text-green-700 dark:text-green-400">Your bot knows everything!</p>
                                    <p className="text-xs text-slate-500 mt-1 max-w-[200px]">No unanswered questions were found in recent logs.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card 3 (📈 Growth Strategy - Full Width) */}
                    <div className="lg:col-span-2 relative overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm p-8 transition-colors group">
                        {/* Subtle Gradient Backdrop */}
                        <div className="absolute top-0 left-0 w-full h-full bg-linear-to-br from-indigo-50/50 to-transparent dark:from-indigo-900/10 dark:to-transparent pointer-events-none" />
                        
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                                    <Lightbulb className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 font-display">Actionable Advice</h2>
                            </div>
                            
                            <p className="text-slate-700 dark:text-slate-300 text-[15px] leading-relaxed max-w-4xl pl-13">
                                {reportData?.actionable_advice || "Keep monitoring your analytics."}
                            </p>
                        </div>
                    </div>

                </div>
            )}
        </motion.div>
    );
};

export default AppInsights;
