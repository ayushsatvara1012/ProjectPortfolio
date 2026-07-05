'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import UpgradePrompt from '@/src/components/features/UpgradePrompt';
import {
    BarDatum,
    Card,
    cx,
    DonutChart,
    DonutDatum,
    EmptyState,
    fmtNum,
    FunnelChart,
    FunnelStageDatum,
    HorizontalBars,
    MetricCard,
    SectionHeader,
    Segmented,
    SkeletonBlock,
} from '@/src/components/dashboard/insights/ui';

const WINDOWS: { value: number; label: string }[] = [
    { value: 7, label: '7d' },
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 0, label: 'All' },
];

const QUALITY_COLORS: Record<string, string> = {
    hot: '#f43f5e',
    warm: '#f59e0b',
    cold: '#0ea5e9',
};

interface DemandItem {
    product: string;
    grade: string | null;
    sessions: number;
}

interface StageItem {
    stage: string;
    label: string;
    count: number;
    pct_of_top: number;
}

interface LostSales {
    total: number;
    por_escalations: number;
    quoted_not_captured: number;
}

interface QualityBand {
    band: string;
    count: number;
    pct: number;
}

interface LeadQuality {
    total_scored: number;
    bands: QualityBand[];
}

// Phase 6 — token cost metering (the "measure before you optimize" readout).
interface TokenMetrics {
    turns: number;
    metered_turns: number;
    cache_hits: number;
    cache_hit_rate: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    avg_tokens_per_turn: number;
    conversations: number;
    avg_tokens_per_conversation: number;
    cached_tokens: number;
    prompt_cache_hit_rate: number;
}

interface SessionBiData {
    window_days: number;
    product_demand: DemandItem[];
    stage_funnel: StageItem[];
    lost_sales: LostSales;
    lead_quality: LeadQuality;
    token_metrics?: TokenMetrics;
}

function toPct(num: number, den: number): number {
    if (den <= 0) return 0;
    return Math.min(Math.round((num / den) * 1000) / 10, 100);
}

function toFunnelStages(items: StageItem[]): FunnelStageDatum[] {
    return items.map((s, i) => {
        const prev = i === 0 ? s.count : items[i - 1].count;
        const pctPrev = i === 0 ? 100.0 : toPct(s.count, prev);
        return {
            key: s.stage,
            label: s.label,
            count: s.count,
            pct_of_top: s.pct_of_top,
            pct_of_prev: pctPrev,
            dropoff_pct: i === 0 ? 0 : Math.max(0, Math.round((100 - pctPrev) * 10) / 10),
        };
    });
}

function toDemandBars(items: DemandItem[]): BarDatum[] {
    const max = items[0]?.sessions || 1;
    return items.map((d) => ({
        label: d.grade ? `${d.product} · ${d.grade}` : d.product,
        value: d.sessions,
        pct: toPct(d.sessions, max),
        color: '#3b82f6',
    }));
}

function toQualityDonuts(quality: LeadQuality): DonutDatum[] {
    return quality.bands.map((b) => ({
        key: b.band,
        label: b.band.charAt(0).toUpperCase() + b.band.slice(1),
        count: b.count,
        pct: b.pct,
        color: QUALITY_COLORS[b.band] ?? '#94a3b8',
        description: `${b.count} ${b.band} lead${b.count !== 1 ? 's' : ''}`,
    }));
}

export default function SessionBiPanel({
    selectedBotId,
    authFetch,
    isAuthorized,
    userTier = '',
}: {
    selectedBotId: string;
    authFetch: (url: string) => Promise<unknown>;
    isAuthorized: boolean;
    userTier?: string;
}) {
    const [window, setWindow] = useState<number>(30);

    const { data, isLoading, error } = useQuery<SessionBiData>({
        queryKey: ['session-bi', selectedBotId, window],
        queryFn: () =>
            authFetch(
                `/api/sessions/bi/${selectedBotId}?window_days=${window}`
            ) as Promise<SessionBiData>,
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 5 * 60 * 1000,
    });

    const is402 = (error as any)?.message?.includes('402') || (error as any)?.status === 402;

    if (!isAuthorized || is402) {
        return (
            <Card className="p-6">
                <UpgradePrompt code="DEFAULT" tier={userTier} mode="inline" />
            </Card>
        );
    }

    const hasData =
        data &&
        (data.product_demand.length > 0 ||
            data.stage_funnel.some((s) => s.count > 0) ||
            data.lost_sales.total > 0 ||
            data.lead_quality.total_scored > 0);

    const funnelStages = toFunnelStages(data?.stage_funnel ?? []);
    const demandBars = toDemandBars(data?.product_demand ?? []);
    const qualityDonuts = toQualityDonuts(data?.lead_quality ?? { total_scored: 0, bands: [] });
    const lost = data?.lost_sales ?? { total: 0, por_escalations: 0, quoted_not_captured: 0 };
    const tm = data?.token_metrics;

    return (
        <div className="flex flex-col gap-6">
            {/* Header + window picker */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                        Sales intelligence
                    </h2>
                    <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Demand, funnel and lead signals from agent conversations
                    </p>
                </div>
                <Segmented
                    value={window}
                    onChange={setWindow}
                    options={WINDOWS}
                    ariaLabel="Time window"
                />
            </div>

            {isLoading && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <SkeletonBlock className="h-[260px] rounded-2xl" />
                    <SkeletonBlock className="h-[260px] rounded-2xl" />
                    <SkeletonBlock className="h-[200px] rounded-2xl" />
                    <SkeletonBlock className="h-[200px] rounded-2xl" />
                </div>
            )}

            {!isLoading && !hasData && (
                <Card>
                    <EmptyState
                        icon="query_stats"
                        title="No session data yet"
                        hint="Intelligence builds up as the agent handles conversations — check back after a few chats."
                    />
                </Card>
            )}

            {!isLoading && hasData && (
                <>
                    {/* Row 1: Demand + Funnel */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Product demand */}
                        <Card className="p-4 sm:p-5">
                            <SectionHeader
                                title="Product demand"
                                subtitle="Top products and grades enquired about"
                                icon="bar_chart"
                                className="mb-4"
                            />
                            {demandBars.length > 0 ? (
                                <HorizontalBars
                                    data={demandBars}
                                    valueFormat={(n) => `${fmtNum(n)} session${n !== 1 ? 's' : ''}`}
                                />
                            ) : (
                                <EmptyState icon="inventory_2" title="No product data yet" />
                            )}
                        </Card>

                        {/* Stage funnel */}
                        <Card className="p-4 sm:p-5">
                            <SectionHeader
                                title="Session funnel"
                                subtitle="How far conversations advance stage by stage"
                                icon="funnel"
                                className="mb-4"
                            />
                            {funnelStages.some((s) => s.count > 0) ? (
                                <FunnelChart stages={funnelStages} />
                            ) : (
                                <EmptyState icon="filter_alt" title="No funnel data yet" />
                            )}
                        </Card>
                    </div>

                    {/* Row 2: Lost sales + Lead quality */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Lost sales */}
                        <Card className="p-4 sm:p-5">
                            <SectionHeader
                                title="Lost sales signals"
                                subtitle="Buyers who didn't convert — and why"
                                icon="cancel"
                                className="mb-4"
                            />
                            <div className="grid grid-cols-2 gap-3">
                                <MetricCard
                                    label="POR escalations"
                                    value={fmtNum(lost.por_escalations)}
                                    hint="Price-on-request (unpriced products)"
                                    tone="warn"
                                />
                                <MetricCard
                                    label="Quoted, not captured"
                                    value={fmtNum(lost.quoted_not_captured)}
                                    hint="Left after quote, no contact given"
                                    tone="warn"
                                />
                            </div>
                            {lost.total > 0 && (
                                <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-400 leading-snug">
                                    {lost.por_escalations > 0 && (
                                        <>Add pricing for unpriced SKUs to convert POR enquiries. </>
                                    )}
                                    {lost.quoted_not_captured > 0 && (
                                        <>Consider a stronger email-capture prompt after quoting.</>
                                    )}
                                </p>
                            )}
                        </Card>

                        {/* Lead quality */}
                        <Card className="p-4 sm:p-5">
                            <SectionHeader
                                title="Lead quality"
                                subtitle="HOT / WARM / COLD breakdown of scored sessions"
                                icon="grade"
                                className="mb-4"
                            />
                            {data!.lead_quality.total_scored > 0 ? (
                                <DonutChart
                                    data={qualityDonuts}
                                    total={data!.lead_quality.total_scored}
                                    totalLabel="Scored leads"
                                />
                            ) : (
                                <EmptyState icon="person_search" title="No scored leads yet" />
                            )}
                        </Card>
                    </div>
                </>
            )}

            {/* Agent cost (Phase 6 metering) — the base for caching ROI. Shown
                once at least one turn has reported token usage. */}
            {!isLoading && tm && tm.metered_turns > 0 && (
                <Card className="p-4 sm:p-5">
                    <SectionHeader
                        title="Agent cost"
                        subtitle="Gemini token usage — the base for measuring caching ROI"
                        icon="paid"
                        className="mb-4"
                    />
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <MetricCard
                            label="Tokens / conversation"
                            value={fmtNum(Math.round(tm.avg_tokens_per_conversation))}
                            hint={`${fmtNum(tm.conversations)} conversation${tm.conversations !== 1 ? 's' : ''}`}
                        />
                        <MetricCard
                            label="Tokens / message"
                            value={fmtNum(Math.round(tm.avg_tokens_per_turn))}
                            hint={`${fmtNum(tm.metered_turns)} metered message${tm.metered_turns !== 1 ? 's' : ''}`}
                        />
                        <MetricCard
                            label="Cache hit rate"
                            value={`${Math.round(tm.cache_hit_rate * 100)}%`}
                            hint={`${fmtNum(tm.cache_hits)} of ${fmtNum(tm.turns)} turns`}
                        />
                        <MetricCard
                            label="Total tokens"
                            value={fmtNum(tm.total_tokens)}
                            hint={`${fmtNum(tm.input_tokens)} in · ${fmtNum(tm.output_tokens)} out`}
                        />
                        <MetricCard
                            label="Prompt cache reads"
                            value={`${Math.round(tm.prompt_cache_hit_rate * 100)}%`}
                            hint={`${fmtNum(tm.cached_tokens)} of ${fmtNum(tm.input_tokens)} prompt tokens (Gemini implicit cache)`}
                        />
                    </div>
                </Card>
            )}
        </div>
    );
}
