'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useBotSwitcher } from '@/src/lib/context/BotSwitcherContext';
import { useAuthenticatedFetch } from '@/src/lib/hooks/useAuthenticatedFetch';
import UpgradePrompt from '@/src/components/features/UpgradePrompt';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
    Card,
    cx,
    EmptyState,
    SectionHeader,
} from '@/src/components/dashboard/insights/ui';
import { ActivityInsights } from '@/src/components/dashboard/insights/ActivityInsights';

// Code-split panels — explicit loading fallbacks prevent React.lazy from
// suspending up to the layout's <Suspense fallback={null}> which would
// unmount the entire page (including the tab header) while chunks load.
const PanelSkeleton = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-[110px] rounded-xl bg-slate-200/60 dark:bg-slate-800/60" />)}
    </div>
);
const SalesAndLeadsPanel = dynamic(() => import('@/src/components/dashboard/SalesAndLeadsPanel'), { loading: PanelSkeleton });
const RequestsInboxPanel = dynamic(() => import('@/src/components/dashboard/RequestsInboxPanel'), { loading: PanelSkeleton });
const ConversationsPanel = dynamic(() => import('@/src/components/dashboard/ConversationsPanel'), { loading: PanelSkeleton });
const FunnelPanel = dynamic(() => import('@/src/components/dashboard/FunnelPanel'), { loading: PanelSkeleton });
const PipelineKpisStrip = dynamic(() => import('@/src/components/dashboard/PipelineKpis'), { loading: PanelSkeleton });
const SessionBiPanel = dynamic(() => import('@/src/components/dashboard/SessionBiPanel'), { loading: PanelSkeleton });

export default function AppInsights() {
    const { userTier: rawUserTier, entitlements, isLoading: ctxLoading } = useUserRole();
    const userTier = rawUserTier ?? '';
    const canAnalytics = entitlements.canUseAnalytics;
    const canLeadCapture = entitlements.canUseLeadCapture;
    const authFetch = useAuthenticatedFetch();

    // Bot list + selection are global (AppLayout fetches once; every dashboard
    // page — Pipeline, Customize, ... — shares the same selectedBotId via the
    // breadcrumb switcher, persisted across visits).
    const { bots, selectedBotId } = useBotSwitcher();
    const botsLoading = bots.length === 0;
    const selectedBot = bots.find((b) => b.id === selectedBotId);
    // Phase 5a — the pack vertical drives this page. A chemical bot relabels the
    // tabs (Pipeline / Operations) and leads its Pipeline with a quote+sample KPI
    // strip. A generic (vertical=NULL) bot is byte-for-byte unchanged.
    const isChemical = selectedBot?.vertical === 'chemical';

    const [reportData, setReportData] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');
    const [isGhostTown, setIsGhostTown] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('sales');
    // Phase 3.2: "View chat" on a request jumps to the Conversations tab focused
    // on the originating session (best-effort — expands it if on the loaded page).
    const [focusSessionId, setFocusSessionId] = useState<string | null>(null);
    const viewSession = (sessionId: string) => { setFocusSessionId(sessionId); setActiveTab('conversations'); };

    useEffect(() => {
        // The bot can now change from the global breadcrumb switcher (not just a
        // control on this page), so clear the stale report the moment it does.
        setReportData(null);
        if (selectedBotId && canAnalytics) handleGenerate(true);
    }, [selectedBotId, userTier]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerate = async (silentLoad = false) => {
        if (!selectedBotId) return;
        if (!silentLoad) setIsGenerating(true);
        setError('');
        setIsGhostTown(false);
        try {
            const data = await authFetch(`/api/analytics/generate-report/${selectedBotId}`, { method: 'POST' }) as any;
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
            if (err?.message?.includes('404')) setIsGhostTown(true);
            else if (!silentLoad) setError('Failed to generate report. Please try again.');
        } finally {
            if (!silentLoad) setIsGenerating(false);
        }
    };

    // Same tab IDs in both verticals (so all branch logic / the Generate button
    // keep working) — only the labels + icons swap for the chemical pack.
    const TABS = isChemical
        ? [
            { id: 'sales', label: 'Pipeline', shortLabel: 'Pipeline', icon: 'receipt_long' },
            { id: 'conversations', label: 'Conversations', shortLabel: 'Chats', icon: 'forum' },
            { id: 'funnel', label: 'Operations', shortLabel: 'Ops', icon: 'monitoring' },
        ]
        : [
            { id: 'sales', label: 'Sales & Leads', shortLabel: 'Sales', icon: 'sell' },
            { id: 'conversations', label: 'Conversations', shortLabel: 'Chats', icon: 'forum' },
            { id: 'funnel', label: 'Funnel & Insights', shortLabel: 'Funnel', icon: 'insights' },
        ];

    const isLoaded = !ctxLoading && !botsLoading;

    const generateBtn = activeTab === 'funnel' && canAnalytics && (
        <button
            onClick={() => handleGenerate(false)}
            disabled={isGenerating || !selectedBotId}
            className="inline-flex items-center justify-center gap-1.5 px-2.5 text-[12.5px] font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 disabled:opacity-40 transition-colors focus-visible:outline-none"
            title="Generate insights"
            aria-label="Generate insights"
        >
            <span className={cx("material-symbols-outlined text-[16px]", isGenerating && "animate-spin")}>
                autorenew
            </span>
            <span className="hidden sm:inline">
                {isGenerating ? 'Synthesizing…' : 'Generate insights'}
            </span>
        </button>
    );

    const renderHeader = () => (
        <div className="relative shrink-0 z-30 bg-[#f8f9fa]/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 md:px-6 lg:px-8 py-1.5 sm:py-0">
                <div role="tablist" aria-label="Insights sections" className="flex items-center gap-1 min-w-0">
                    {TABS.map((tab) => {
                        const active = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                role="tab"
                                aria-selected={active}
                                onClick={() => setActiveTab(tab.id)}
                                className={cx(
                                    'relative inline-flex items-center gap-1.5 py-3 px-2 text-[13px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-none',
                                    active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                                )}
                            >
                                <span className="material-symbols-outlined text-[17px]">{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.shortLabel}</span>
                                {active && <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-blue-600 dark:bg-blue-400" />}
                            </button>
                        );
                    })}
                </div>
                <div className="flex flex-wrap items-center gap-2 py-1.5 sm:py-2">
                    {generateBtn}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            {renderHeader()}

            <div data-lenis-prevent className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar flex flex-col p-4 md:p-6 lg:p-8">
                {!isLoaded ? (
                    <PanelSkeleton />
                ) : (<>
                {activeTab === 'funnel' && lastGeneratedAt && (
                    <div className="flex justify-center w-full pb-4 -mt-2">
                        <span className="text-[11.5px] font-medium text-slate-400 dark:text-slate-500">Insights last generated {lastGeneratedAt}</span>
                    </div>
                )}
                <Suspense fallback={<PanelSkeleton />}>
                <AnimatePresence mode="wait" initial={false}>
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="flex flex-col flex-1"
                >
                {activeTab === 'sales' && (
                    <div className="flex flex-col gap-6 w-full min-w-0">
                        {/* Chemical Pipeline leads with its order pipeline (quotes +
                            samples) — that IS the business here — then the generic
                            lead/ROI panels sit below. A generic bot skips the strip
                            and the quote/sample panels self-hide as before. */}
                        {isChemical && canAnalytics && (
                            <PipelineKpisStrip selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} />
                        )}
                        {isChemical && (
                            <RequestsInboxPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} onViewSession={viewSession} />
                        )}
                        <SalesAndLeadsPanel
                            selectedBotId={selectedBotId}
                            authFetch={authFetch}
                            entitlements={{ canUseAnalytics: canAnalytics, canUseLeadCapture: canLeadCapture }}
                            selectedBot={selectedBot}
                        />
                        {/* Generic bots: panel self-hides unless quote/sample records exist. */}
                        {!isChemical && (
                            <RequestsInboxPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} onViewSession={viewSession} />
                        )}
                    </div>
                )}

                {activeTab === 'conversations' && (
                    <ConversationsPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} focusSessionId={focusSessionId} onFocusHandled={() => setFocusSessionId(null)} />
                )}

                {activeTab === 'funnel' && (
                    <div className="flex flex-col gap-6 w-full min-w-0">
                        {/* Phase 3 — session-level BI (demand, funnel, lost sales, lead quality).
                            Chemical bots only: generic bots lack agent_sessions.state data. */}
                        {isChemical && (
                            <SessionBiPanel
                                selectedBotId={selectedBotId}
                                authFetch={authFetch}
                                isAuthorized={canAnalytics}
                                userTier={userTier}
                            />
                        )}
                        <FunnelPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} />

                        {!canAnalytics && (
                            <Card className="p-6"><UpgradePrompt code="DEFAULT" tier={userTier} mode="inline" /></Card>
                        )}

                        {/* AI insights report */}
                        {canAnalytics && reportData && !isGenerating && !error && (
                            <div className="flex flex-col gap-6 w-full">
                                <div className="border-t border-slate-200/70 dark:border-slate-800/70 pt-2" />

                                <ActivityInsights blocks={reportData?.peak_activity_blocks} />

                                {/* Trends + advice */}
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                    <Card className="lg:col-span-7 p-4 sm:p-5">
                                        <SectionHeader title="Top customer trends" subtitle="What people ask about most" icon="trending_up" className="mb-3" />
                                        {reportData?.top_trends?.length > 0 ? (
                                            <ol className="flex flex-col">
                                                {reportData.top_trends.map((trend: string, idx: number) => (
                                                    <li key={idx} className="flex items-start gap-3 py-2.5 border-b border-slate-100 dark:border-slate-800/60 last:border-0">
                                                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50 text-[11px] font-bold tabular-nums text-blue-600 dark:text-blue-400">{idx + 1}</span>
                                                        <p className="text-[13.5px] text-slate-700 dark:text-slate-300 leading-snug">{trend}</p>
                                                    </li>
                                                ))}
                                            </ol>
                                        ) : (
                                            <EmptyState icon="lightbulb" title="No trends available yet" />
                                        )}
                                    </Card>

                                    <Card className="lg:col-span-5 p-5 bg-gradient-to-br from-blue-50/70 to-blue-50/50 dark:from-blue-950/30 dark:to-blue-950/20 border-blue-100 dark:border-blue-900/40">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="material-symbols-outlined text-[18px] text-blue-500">auto_awesome</span>
                                            <h3 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">Recommended action</h3>
                                        </div>
                                        <p className="text-[13.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
                                            {reportData?.actionable_advice || 'Keep monitoring your analytics.'}
                                        </p>
                                    </Card>
                                </div>

                                {/* Phase 5a — "Recent activity" table removed: it
                                    duplicated the Conversations tab (which shows the
                                    same logs with full transcripts + training). */}
                            </div>
                        )}

                        {canAnalytics && error && (
                            <div className="flex items-center gap-3 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/30 px-4 py-3">
                                <span className="material-symbols-outlined text-[18px] text-rose-500">error</span>
                                <p className="text-[13.5px] text-rose-700 dark:text-rose-300 flex-1">{error}</p>
                                <button onClick={() => setError('')} aria-label="Dismiss error" className="p-2 -m-2 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30 transition-colors"><span className="material-symbols-outlined text-[18px] text-rose-400">close</span></button>
                            </div>
                        )}

                        {canAnalytics && isGhostTown && !isGenerating && (
                            <Card>
                                <EmptyState
                                    icon="sentiment_satisfied"
                                    title="No conversations yet"
                                    hint={<>Once people start chatting, insights will appear here. <Link href="/dashboard/bots" className="text-blue-600 dark:text-blue-400 font-semibold hover:underline">View my bots</Link></>}
                                />
                            </Card>
                        )}

                        {canAnalytics && !reportData && !isGenerating && !error && !isGhostTown && (
                            <Card>
                                <EmptyState icon="auto_awesome" title="Generate your AI insights" hint='Click "Generate insights" above to synthesize trends, gaps and recommendations from your chat logs.' />
                            </Card>
                        )}

                        {canAnalytics && isGenerating && (
                            <Card>
                                <div className="flex flex-col items-center gap-3 py-10">
                                    <span className="h-7 w-7 border-2 border-slate-200 dark:border-slate-700 border-t-blue-500 animate-spin rounded-full motion-reduce:animate-none" />
                                    <p className="text-[13.5px] text-slate-500 dark:text-slate-400">Analyzing your chat logs — this takes 5–10 seconds.</p>
                                </div>
                            </Card>
                        )}
                    </div>
                )}
                </motion.div>
                </AnimatePresence>
                </Suspense>
                </>)}
            </div>
        </div>
    );
}
