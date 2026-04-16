import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '../context/UserContext';
import { useAuthenticatedFetch } from '../hooks/useApiCall';
import UpgradePrompt from '../components/UpgradePrompt';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

// ── Style primitives matching AppTrainAI ────────────────────────────────────
const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

const ActivityHeatmap = ({ data }) => {
    const [hoveredCell, setHoveredCell] = useState(null);

    if (!data || data.length === 0) return (
        <p className="text-sm font-google text-slate-500 dark:text-slate-400 italic">No activity data for this period.</p>
    );

    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    // Pre-fill matrix 7 days x 24 hrs with empty objects
    const matrix = Array(7).fill(null).map(() => Array(24).fill({count: 0}));
    let maxCount = 0;
    
    data.forEach(d => {
        const dayIdx = d.day - 1; // ISODOW 1-7 mapped to 0-6
        const hour = d.hour;
        if(dayIdx >= 0 && dayIdx < 7 && hour >= 0 && hour < 24) {
             matrix[dayIdx][hour] = d;
             if (d.count > maxCount) maxCount = d.count;
        }
    });

    const formatHour = (h) => {
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        return `${h12}:00 ${ampm}`;
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="w-full overflow-x-auto pb-2 custom-scrollbar">
                <div className="min-w-[600px] flex flex-col gap-1">
                    {/* Header (Hours) */}
                    <div className="flex text-[10px] font-mono text-slate-400 mb-1 ml-10">
                        {[...Array(24)].map((_, h) => (
                            <div key={h} className="flex-1 text-center opacity-70">
                                {h % 4 === 0 ? `${h}h` : ''}
                            </div>
                        ))}
                    </div>
                    {/* Days */}
                    {days.map((day, dIdx) => (
                        <div key={day} className="flex items-center gap-2">
                            <div className="w-8 shrink-0 text-[10px] font-google uppercase tracking-widest font-bold text-slate-500">
                                {day}
                            </div>
                            <div className="flex flex-1 gap-px">
                                {matrix[dIdx].map((cell, hIdx) => {
                                    const opacity = maxCount > 0 ? (cell.count / maxCount) : 0;
                                    return (
                                        <div 
                                            key={hIdx} 
                                            onMouseEnter={() => setHoveredCell({day, hour: formatHour(hIdx), ...cell})}
                                            onMouseLeave={() => setHoveredCell(null)}
                                            className="h-6 flex-1 rounded-sm cursor-pointer hover:border-blue-500 hover:scale-110 relative z-10 transition-all duration-75"
                                            style={{ 
                                                backgroundColor: cell.count > 0 ? `rgba(59, 130, 246, ${Math.max(0.15, opacity)})` : 'transparent',
                                                border: cell.count === 0 ? '1px solid rgba(148, 163, 184, 0.1)' : 'none',
                                                zIndex: hoveredCell?.day === day && hoveredCell?.hour === formatHour(hIdx) ? 20 : 10
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Hover Details Block */}
            <div className={`transition-all duration-300 transform ${hoveredCell && hoveredCell.count > 0 ? 'opacity-100 translate-y-0' : 'opacity-50 translate-y-2'}`}>
                {hoveredCell && hoveredCell.count > 0 ? (
                    <div className="flex flex-col bg-slate-50 dark:bg-slate-900 border border-blue-200 dark:border-blue-900/50 p-5 rounded-sm shadow-sm ring-1 ring-blue-500/10">
                        <div className="flex items-center justify-between mb-4">
                            <span className="text-xs uppercase font-bold tracking-widest text-slate-800 dark:text-slate-200 font-google">
                                {hoveredCell.day} @ {hoveredCell.hour}
                            </span>
                            <div className="flex items-center gap-1.5 opacity-80 bg-blue-500/15 px-2 py-0.5 rounded-sm border border-blue-500/30">
                                <span className="material-symbols-outlined text-[14px] text-blue-500">group</span>
                                <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{hoveredCell.interacted_users || 0} unique users</span>
                            </div>
                        </div>
                        
                        <div className="flex items-center justify-between mb-4 border-b border-slate-200 dark:border-slate-800 pb-4">
                            <div className="flex flex-col">
                                <span className="text-3xl font-bold font-google text-slate-800 dark:text-slate-200">{hoveredCell.total_questions || 0}</span>
                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-google mt-1">Total Asked</span>
                            </div>
                            <div className="flex flex-col text-right">
                                <span className="text-3xl font-bold font-google text-green-600 dark:text-green-500">{hoveredCell.answered_questions || 0}</span>
                                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-google mt-1">Successfully Answered</span>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col justify-end min-h-[60px]">
                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold font-google mb-2 border-l-2 border-blue-500 pl-2">Top Queries During This Block</span>
                            {hoveredCell.top_questions && hoveredCell.top_questions.length > 0 ? (
                                <ul className="space-y-1.5">
                                    {hoveredCell.top_questions.map((q, qIdx) => (
                                        <li key={qIdx} className="text-xs font-google text-slate-600 dark:text-slate-400 truncate w-full" title={q}>- "{q}"</li>
                                    ))}
                                </ul>
                            ) : (
                                <span className="text-xs font-google text-slate-400 italic mt-1">No specific queries logged</span>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col bg-slate-50 border-dashed dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 p-5 rounded-sm items-center justify-center min-h-[220px]">
                        <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600 mb-2">touch_app</span>
                        <p className="text-xs font-google text-slate-400 uppercase tracking-widest font-bold">Hover over a blue calendar block to view activity details</p>
                    </div>
                )}
            </div>
        </div>
    );
};

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
                        <h1 className="text-xl md:text-2xl font-google font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">
                            SaPyBase Insights
                        </h1>
                    </div>
                    <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">
                        AI-synthesized business intelligence from your chat logs. Reports refresh every 24 hours.
                    </p>
                    {lastGeneratedAt && (
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mt-1.5 transition-colors">
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

                {userTier === 'PRO' && reportData && !isGenerating && !error && (
                    <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1">
                        
                        {/* ── ROI Scorecards (Top Row) ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white dark:bg-slate-800">
                            {/* Support Hours Saved */}
                            <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 pt-0.5">timer</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Support Hours Saved</h3>
                                </div>
                                <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{Math.floor((Number((reportData?.roi_metrics?.support_savings || '$0').replace(/[^0-9.-]+/g,"")) || 0) / 25)}</span><span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">hours</span></div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Based on estimated handled query resolution time.</p>
                            </div>

                            {/* Estimated Savings */}
                            <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="material-symbols-outlined text-[18px] text-green-600 dark:text-green-500 pt-0.5">savings</span>
                                    <h3 className="text-md uppercase font-bold tracking-widest text-slate-600 dark:text-slate-400 font-google">Estimated Savings</h3>
                                </div>
                                <div className="flex items-end gap-1"><span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{reportData?.roi_metrics?.support_savings || '$0.00'}</span></div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">Cost avoided against standard human agent hourly rates.</p>
                            </div>

                            {/* Leads Captured / Potential Revenue */}
                            <div className={`${cellCls} p-8 flex flex-col justify-center`}>
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
                            <div className={`${cellCls} p-8 flex-1`}>
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
                                    {reportData?.top_trends?.map((trend, idx) => (
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
                            {/* Peak Activity Heatmap */}
                            <div className={`${cellCls} p-8 shrink-0`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">calendar_month</span>
                                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">30-Day Peak Activity</h2>
                                </div>
                                <div className="space-y-3">
                                    <ActivityHeatmap data={reportData?.peak_activity_heatmap} />
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Knowledge Gaps + Advice */}
                        <div className="lg:col-span-5 flex flex-col gap-px bg-white dark:bg-slate-800 transition-colors duration-500">
                            <div className={`${cellCls} p-8 flex-1`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400">warning</span>
                                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                                        High Value Gaps
                                    </h2>
                                </div>
                                <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-5">
                                    Questions your bot failed to answer. Train these topics to secure leads.
                                </p>
                                <div className="space-y-3">
                                    {reportData?.high_value_gaps?.length > 0 ? reportData.high_value_gaps.map((gap, idx) => (
                                        <div key={idx} className="flex items-start gap-3 p-4 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30">
                                            <span className="material-symbols-outlined text-[16px] text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">help_center</span>
                                            <p className="text-sm font-google text-slate-700 dark:text-slate-300 leading-relaxed flex-1">"{gap}"</p>
                                            <Link to={`/app/train?query=${encodeURIComponent(gap)}`} className="shrink-0 text-[10px] uppercase tracking-widest font-bold text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center transition-colors">Fix <span className="material-symbols-outlined text-[12px] ml-1">build</span></Link>
                                        </div>
                                    )) : (
                                        <p className="text-sm font-google text-slate-500 dark:text-slate-400 italic">No critical knowledge gaps detected.</p>
                                    )}
                                </div>
                            </div>
                            <div className={`${cellCls} p-8 shrink-0`}>
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

                    {/* ── Recent Conversations Log ── */}
                    <div className="flex flex-col gap-px bg-white dark:bg-slate-800 border-t border-gray-100 dark:border-slate-800">
                        <div className={`${cellCls} p-8 overflow-x-auto`}>
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
                                    {reportData?.recent_conversations?.map((log, idx) => (
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
