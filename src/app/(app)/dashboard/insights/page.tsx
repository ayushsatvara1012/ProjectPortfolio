'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch, useIsAuthReady } from '@/src/lib/hooks/useAuthenticatedFetch';
import UpgradePrompt from '@/src/components/features/UpgradePrompt';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
    Badge,
    Card,
    cx,
    EmptyState,
    fmtNum,
    MetricCard,
    SectionHeader,
    SkeletonBlock,
    TrendChart,
    TrendPoint,
} from '@/src/components/dashboard/insights/ui';

// Code-split panels — explicit loading fallbacks prevent React.lazy from
// suspending up to the layout's <Suspense fallback={null}> which would
// unmount the entire page (including the tab header) while chunks load.
const PanelSkeleton = () => (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => <div key={i} className="h-[110px] rounded-xl bg-slate-200/60 dark:bg-slate-800/60" />)}
    </div>
);
const SalesAndLeadsPanel = dynamic(() => import('@/src/components/dashboard/SalesAndLeadsPanel'), { loading: PanelSkeleton });
const QuoteRequestsPanel = dynamic(() => import('@/src/components/dashboard/QuoteRequestsPanel'), { loading: PanelSkeleton });
const AgentRequestsPanel = dynamic(() => import('@/src/components/dashboard/AgentRequestsPanel'), { loading: PanelSkeleton });
const ConversationsPanel = dynamic(() => import('@/src/components/dashboard/ConversationsPanel'), { loading: PanelSkeleton });
const FunnelPanel = dynamic(() => import('@/src/components/dashboard/FunnelPanel'), { loading: PanelSkeleton });
const PipelineKpisStrip = dynamic(() => import('@/src/components/dashboard/PipelineKpis'), { loading: PanelSkeleton });

/* ────────────────────────────────────────────────────────────────────────── */
/* Activity series helpers — everything below is derived from REAL daily data.  */
/* `peak_activity_blocks` is a sparse list of active days; we densify to a       */
/* continuous N-day axis (zero-filling gaps) so trends & deltas are honest.      */
/* ────────────────────────────────────────────────────────────────────────── */

interface DayDatum {
    date: string;
    total: number;
    answered: number;
    unanswered: number;
    users: number;
    raw: any;
}

function buildDailySeries(blocks: any[], days = 30): DayDatum[] {
    const map: Record<string, any> = {};
    (blocks || []).forEach((b) => { if (b?.date) map[b.date] = b; });
    const out: DayDatum[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const b = map[key] || {};
        out.push({
            date: key,
            total: b.total_questions || 0,
            answered: b.answered_questions || 0,
            unanswered: b.unanswered_questions || 0,
            users: b.interacted_users || 0,
            raw: b,
        });
    }
    return out;
}

/** Recent-half vs prior-half percentage change of a daily metric. */
function pctDelta(values: number[]): number {
    const half = Math.floor(values.length / 2);
    const prior = values.slice(0, half).reduce((a, b) => a + b, 0);
    const recent = values.slice(half).reduce((a, b) => a + b, 0);
    if (prior === 0) return recent > 0 ? 100 : 0;
    return ((recent - prior) / prior) * 100;
}

const fmtDay = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

// ── Activity heatmap (tap/keyboard accessible) — 10x3 grid with date labels ─
const HEAT_STEPS = [
    'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500',
    'bg-slate-300 dark:bg-slate-700 text-slate-600 dark:text-slate-300',
    'bg-slate-400 dark:bg-slate-600 text-slate-800 dark:text-slate-200',
    'bg-slate-600 dark:bg-slate-400 text-white dark:text-slate-950',
    'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900',
];

const monthOf = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString(undefined, { month: 'short' });

function ActivityHeatmap({ series, selected, onSelect }: { series: DayDatum[]; selected: string | null; onSelect: (d: DayDatum) => void }) {
    const max = series.reduce((m, d) => Math.max(m, d.total), 0) || 1;
    const stepFor = (n: number) => {
        if (n === 0) return 0;
        const r = n / max;
        if (r <= 0.25) return 1;
        if (r <= 0.5) return 2;
        if (r <= 0.75) return 3;
        return 4;
    };
    let prevMonth = '';
    return (
        <div className="flex flex-col items-center gap-3 w-full">
            <div className="flex flex-wrap gap-x-1.5 gap-y-2 justify-center w-full">
                {series.map((d) => {
                    const isSel = selected === d.date;
                    const dateObj = new Date(d.date + 'T00:00:00');
                    const dayNum = dateObj.getDate();
                    const month = dateObj.toLocaleDateString(undefined, { month: 'short' });
                    const showMonth = month !== prevMonth;
                    prevMonth = month;
                    return (
                        <div key={d.date} className="flex flex-col items-center gap-1">
                            <span className="h-3 text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 whitespace-nowrap leading-none select-none">
                                {showMonth ? month : '\u00A0'}
                            </span>
                            <button
                                key={d.date}
                                type="button"
                                onClick={() => onSelect(d)}
                                onMouseEnter={() => onSelect(d)}
                                aria-label={`${fmtDay(d.date)}: ${d.total} queries`}
                                title={`${fmtDay(d.date)} · ${d.total} queries`}
                                className={cx(
                                    'h-8 w-8 sm:h-9 sm:w-9 rounded-md relative flex items-center justify-center text-[11px] sm:text-[12px] font-extrabold transition-all duration-150 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 focus-visible:ring-slate-400',
                                    HEAT_STEPS[stepFor(d.total)],
                                    isSel
                                        ? 'ring-2 ring-offset-1 ring-offset-white dark:ring-offset-slate-900 ring-slate-900 dark:ring-white z-10 scale-105'
                                        : 'hover:scale-105 hover:z-10 hover:ring-1 hover:ring-slate-400/70 dark:hover:ring-slate-500/70',
                                )}
                            >
                                {dayNum}
                            </button>
                        </div>
                    );
                })}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                <span>Less</span>
                {HEAT_STEPS.map((c, i) => (
                    <span
                        key={i}
                        className={cx(
                            'h-3.5 w-3.5 rounded-[3px]',
                            c.split(' ')[0] + ' ' + (c.includes('dark:') ? c.split(' ').find(x => x.startsWith('dark:bg-')) : '')
                        )}
                    />
                ))}
                <span>More</span>
            </div>
        </div>
    );
}

// ── Activity insights block: KPI strip + trend chart + heatmap + inspector ──
function ActivityInsights({ blocks }: { blocks: any[] }) {
    const series = useMemo(() => buildDailySeries(blocks, 30), [blocks]);
    const [selected, setSelected] = useState<DayDatum | null>(null);

    useEffect(() => {
        if (series.length) {
            const withData = [...series].reverse().find((d) => d.total > 0);
            setSelected(withData || series[series.length - 1]);
        }
    }, [series]);

    const totals = series.map((d) => d.total);
    const unans = series.map((d) => d.unanswered);
    const users = series.map((d) => d.users);
    const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

    const totalQ = sum(totals);
    const totalUn = sum(unans);
    const totalUsers = sum(users);
    const answeredRate = totalQ > 0 ? Math.round(((totalQ - totalUn) / totalQ) * 100) : 0;

    // Answer-rate delta in percentage points (recent half vs prior half).
    const half = Math.floor(series.length / 2);
    const priorQ = sum(totals.slice(0, half));
    const priorUn = sum(unans.slice(0, half));
    const recentQ = sum(totals.slice(half));
    const recentUn = sum(unans.slice(half));
    const priorRate = priorQ > 0 ? ((priorQ - priorUn) / priorQ) * 100 : 0;
    const recentRate = recentQ > 0 ? ((recentQ - recentUn) / recentQ) * 100 : 0;
    const rateDelta = Math.round((recentRate - priorRate) * 10) / 10;

    const trendPoints: TrendPoint[] = series.map((d) => ({
        label: fmtDay(d.date),
        values: { total: d.total, unanswered: d.unanswered },
    }));

    return (
        <div className="flex flex-col gap-4">
            {/* KPI strip — honest period-over-period deltas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard label="Questions" value={fmtNum(totalQ)} hint="last 30 days" delta={pctDelta(totals)} spark={totals} tone="accent" />
                <MetricCard label="Answer rate" value={`${answeredRate}%`} hint="answered confidently" delta={rateDelta} tone="positive" />
                <MetricCard label="Chat sessions" value={fmtNum(totalUsers)} hint="engaged conversations" delta={pctDelta(users)} spark={users} tone="info" />
                <MetricCard label="Gaps" value={fmtNum(totalUn)} hint="unanswered questions" delta={pctDelta(unans)} deltaInvert spark={unans} tone="warn" />
            </div>

            {/* Trend chart */}
            <Card className="p-4 sm:p-5">
                <SectionHeader title="Activity trend" subtitle="Daily question volume and gaps over the last 30 days" icon="show_chart" className="mb-4" />
                <TrendChart
                    points={trendPoints}
                    series={[
                        { key: 'total', name: 'Questions', color: '#3b82f6', fill: true },
                        { key: 'unanswered', name: 'Unanswered', color: '#f43f5e', fill: false },
                    ]}
                />
            </Card>

            {/* Activity map + daily inspector — one seamless card, two zones */}
            <Card className="overflow-hidden">
                {/* Zone 1: the calendar */}
                <div className="p-4 sm:p-5">
                    <SectionHeader title="30-day activity map" subtitle="Tap a day to inspect what customers asked" icon="calendar_view_month" className="mb-4" />
                    <ActivityHeatmap series={series} selected={selected?.date || null} onSelect={setSelected} />
                </div>

                {/* Zone 2: the daily inspector — continues seamlessly below a hairline */}
                <div className="border-t border-slate-200/70 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-4 sm:p-5">
                    {selected ? (
                        <div className="flex flex-col gap-4">
                            {/* Header: date + answered / unanswered at a glance */}
                            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                                <div>
                                    <p className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 leading-tight">
                                        {new Date(selected.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Badge tone="ok">{fmtNum(selected.answered)} answered</Badge>
                                    <Badge tone={selected.unanswered > 0 ? 'alert' : 'neutral'}>{fmtNum(selected.unanswered)} unanswered</Badge>
                                </div>
                            </div>

                            {/* Headline stats */}
                            <div className="grid grid-cols-2 gap-3">
                                {[
                                    { label: 'Total activity', value: selected.total },
                                    { label: 'Chat sessions', value: selected.users },
                                ].map((s) => (
                                    <div key={s.label} className="rounded-xl bg-white dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 px-3.5 py-2.5">
                                        <span className="text-[12px] text-slate-500 dark:text-slate-400">{s.label}</span>
                                        <p className="text-[22px] font-bold tabular-nums text-slate-900 dark:text-slate-100 leading-none mt-1">{fmtNum(s.value)}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Detail lists */}
                            {(selected.raw?.top_questions?.length > 0 || (selected.unanswered > 0 && selected.raw?.top_unanswered?.length > 0)) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-3 pt-1">
                                    {selected.raw?.top_questions?.length > 0 && (
                                        <div>
                                            <span className="text-[12px] font-semibold text-slate-700 dark:text-slate-300 block mb-1.5">Top questions</span>
                                            <ul className="space-y-1">
                                                {selected.raw.top_questions.map((q: string, i: number) => (
                                                    <li key={i} className="text-[12.5px] text-slate-600 dark:text-slate-400 leading-snug font-medium">“{q}”</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {selected.unanswered > 0 && selected.raw?.top_unanswered?.length > 0 && (
                                        <div>
                                            <span className="text-[12px] font-semibold text-amber-600 dark:text-amber-400 block mb-1.5">Unanswered queries</span>
                                            <ul className="space-y-1">
                                                {selected.raw.top_unanswered.map((q: string, i: number) => (
                                                    <li key={i} className="text-[12.5px] text-slate-600 dark:text-slate-400 leading-snug font-medium">“{q}”</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <EmptyState icon="touch_app" title="Select a day" hint="Tap a square above to inspect that day's activity." />
                    )}
                </div>
            </Card>
        </div>
    );
}

export default function AppInsights() {
    const { userTier: rawUserTier, entitlements, isLoading: ctxLoading } = useUserRole();
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
    const selectedBot = bots.find((b: any) => b.id === selectedBotId);
    // Phase 5a — the pack vertical drives this page. A chemical bot relabels the
    // tabs (Pipeline / Operations) and leads its Pipeline with a quote+sample KPI
    // strip. A generic (vertical=NULL) bot is byte-for-byte unchanged.
    const isChemical = selectedBot?.vertical === 'chemical';

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

    const botSelector = canAnalytics && bots.length > 1 && (
        <div className="relative">
            <select
                value={selectedBotId}
                onChange={(e) => { setSelectedBotId(e.target.value); setReportData(null); }}
                aria-label="Select bot"
                className="appearance-none cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-8 py-1.5 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
                {bots.map((b: any) => <option key={b.id} value={b.id}>{b.bot_name}</option>)}
            </select>
            <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 pointer-events-none">expand_more</span>
        </div>
    );

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
                    {botSelector}
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
                            <>
                                <QuoteRequestsPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} />
                                <AgentRequestsPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} />
                            </>
                        )}
                        <SalesAndLeadsPanel
                            selectedBotId={selectedBotId}
                            authFetch={authFetch}
                            entitlements={{ canUseAnalytics: canAnalytics, canUseLeadCapture: canLeadCapture }}
                            selectedBot={selectedBot}
                        />
                        {/* Generic bots: panels self-hide unless quote/sample records exist. */}
                        {!isChemical && (
                            <>
                                <QuoteRequestsPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} />
                                <AgentRequestsPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} />
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'conversations' && (
                    <ConversationsPanel selectedBotId={selectedBotId} authFetch={authFetch} isAuthorized={canAnalytics} />
                )}

                {activeTab === 'funnel' && (
                    <div className="flex flex-col gap-6 w-full min-w-0">
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
