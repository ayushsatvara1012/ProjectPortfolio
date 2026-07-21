'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createMockAuthFetch } from '@/src/lib/demo/mockBackend';
import { getBotConfig } from '@/src/lib/demo/demoStorage';
import dynamic from 'next/dynamic';
import { cx, Card, EmptyState, SectionHeader } from '@/src/components/dashboard/insights/ui';
import { ActivityInsights } from '@/src/components/dashboard/insights/ActivityInsights';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();

// Code-split panels
const PanelSkeleton = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-[110px] rounded-xl bg-slate-200/60 dark:bg-slate-800/60" />)}
    </div>
);

const SalesAndLeadsPanel = dynamic(() => import('@/src/components/dashboard/SalesAndLeadsPanel'), { loading: PanelSkeleton });
const ConversationsPanel = dynamic(() => import('@/src/components/dashboard/ConversationsPanel'), { loading: PanelSkeleton });
const FunnelPanel = dynamic(() => import('@/src/components/dashboard/FunnelPanel'), { loading: PanelSkeleton });

export default function DemoInsightsPage() {
    const [reportData, setReportData] = useState<any>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('sales');
    const [focusSessionId, setFocusSessionId] = useState<string | null>(null);

    // We get the custom demo bot name
    const botConfig = getBotConfig();
    const botName = botConfig.name || 'Demo Bot';

    const authFetch = useMemo(() => createMockAuthFetch(botName), [botName]);

    useEffect(() => {
        handleGenerate(true);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleGenerate = async (silentLoad = false) => {
        if (!silentLoad) setIsGenerating(true);
        try {
            const data = await authFetch(`/api/analytics/generate-report/demo`, { method: 'POST' }) as any;
            if (data.report) {
                setReportData(data.report);
                setLastGeneratedAt(new Date(data.generated_at).toLocaleString());
            }
        } catch (err: any) {
            console.error(err);
        } finally {
            if (!silentLoad) setIsGenerating(false);
        }
    };

    const TABS = [
        { id: 'sales', label: 'Sales & Leads', shortLabel: 'Sales', icon: 'sell' },
        { id: 'conversations', label: 'Conversations', shortLabel: 'Chats', icon: 'forum' },
        { id: 'funnel', label: 'Funnel & Insights', shortLabel: 'Funnel', icon: 'insights' },
    ];

    const generateBtn = activeTab === 'funnel' && (
        <button
            onClick={() => handleGenerate(false)}
            disabled={isGenerating}
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
                                <span className={cx("material-symbols-outlined text-[16px] sm:text-[18px]", active ? "font-semibold" : "")}>{tab.icon}</span>
                                <span className="hidden sm:inline">{tab.label}</span>
                                <span className="sm:hidden">{tab.shortLabel}</span>
                                {active && (
                                    <motion.div
                                        layoutId="demo-insights-active-tab"
                                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 rounded-t-full"
                                        initial={false}
                                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>
                <div className="flex items-center py-2 sm:py-0">
                    {generateBtn}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 text-slate-900 dark:text-slate-50 overflow-hidden transition-colors">
            {renderHeader()}

            <div className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar flex flex-col p-4 md:p-6 lg:p-8">
                {activeTab === 'funnel' && lastGeneratedAt && (
                    <div className="flex justify-center w-full pb-4 -mt-2">
                        <span className="text-[11.5px] font-medium text-slate-400 dark:text-slate-500">Insights last generated {lastGeneratedAt}</span>
                    </div>
                )}

                <QueryClientProvider client={queryClient}>
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
                                        <SalesAndLeadsPanel
                                            selectedBotId="demo"
                                            authFetch={authFetch}
                                            entitlements={{ canUseAnalytics: true, canUseLeadCapture: true }}
                                            selectedBot={{ bot_name: botName }}
                                        />
                                    </div>
                                )}

                                {activeTab === 'conversations' && (
                                    <ConversationsPanel
                                        selectedBotId="demo"
                                        authFetch={authFetch}
                                        isAuthorized={true}
                                        focusSessionId={focusSessionId}
                                        onFocusHandled={() => setFocusSessionId(null)}
                                    />
                                )}

                                {activeTab === 'funnel' && (
                                    <div className="flex flex-col gap-6 w-full min-w-0">
                                        <FunnelPanel
                                            selectedBotId="demo"
                                            authFetch={authFetch}
                                            isAuthorized={true}
                                        />

                                        {/* AI insights report — heatmap, trends, recommended action */}
                                        {reportData && !isGenerating && (
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
                                            </div>
                                        )}

                                        {!reportData && !isGenerating && (
                                            <Card>
                                                <EmptyState icon="auto_awesome" title="Generate your AI insights" hint='Click "Generate insights" above to synthesize trends, gaps and recommendations from your chat logs.' />
                                            </Card>
                                        )}

                                        {isGenerating && (
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
                </QueryClientProvider>
            </div>
        </div>
    );
}
