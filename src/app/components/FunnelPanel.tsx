'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import {
    BarDatum,
    Card,
    cx,
    DonutChart,
    DonutDatum,
    EmptyState,
    fmtMoney,
    fmtMoneyCompact,
    fmtNum,
    FunnelChart,
    FunnelStageDatum,
    HorizontalBars,
    MetricCard,
    SectionHeader,
    Segmented,
    SkeletonBlock,
} from '@/src/app/components/insights/ui';

const WINDOWS = [
    { value: 7, label: '7d' },
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 0, label: 'All' },
] as const;

const STAGE_DESCRIPTIONS: Record<string, string> = {
    conversations: 'Visitors who chatted with the assistant.',
    leads: 'Provided their email or contact details.',
    contacted: 'Followed up by email or suggestion.',
    won: 'Closed and converted to a deal.',
};

// Temperature metaphor: hot = rose, warm = amber, cold = sky.
const QUALITY_COLORS: Record<string, string> = { hot: '#f43f5e', warm: '#f59e0b', cold: '#0ea5e9' };
const QUALITY_DESCRIPTIONS: Record<string, string> = {
    hot: 'High intent — follow up now.',
    warm: 'Engaged — asked about features or pricing.',
    cold: 'Browsing or low-intent signals.',
};

const SOURCE_ICONS: Record<string, string> = {
    'chat widget': 'forum',
    'pricing page': 'sell',
    docs: 'menu_book',
    direct: 'arrow_outward',
};

interface FunnelPanelProps {
    selectedBotId: string;
    authFetch: any;
    isAuthorized: boolean;
}

const FunnelPanel = ({ selectedBotId, authFetch, isAuthorized }: FunnelPanelProps) => {
    const [windowDays, setWindowDays] = useState<number>(30);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['funnel', selectedBotId, windowDays],
        queryFn: () => authFetch(`/api/funnel/${selectedBotId}?window_days=${windowDays}`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 60_000,
    });

    const { data: attrData } = useQuery({
        queryKey: ['attribution', selectedBotId, windowDays],
        queryFn: () => authFetch(`/api/leads/${selectedBotId}/attribution?window_days=${windowDays}`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 60_000,
    });

    if (!isAuthorized) {
        return <Card className="p-6"><UpgradePrompt code="DEFAULT" tier="" mode="inline" /></Card>;
    }

    const windowSelector = (
        <Segmented
            ariaLabel="Funnel time window"
            options={WINDOWS.map(w => ({ value: w.value, label: w.label }))}
            value={windowDays}
            onChange={setWindowDays}
            size="sm"
        />
    );

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3">
                    <SkeletonBlock className="h-5 w-44" />
                    <SkeletonBlock className="h-8 w-40" />
                </div>
                <SkeletonBlock className="h-[260px]" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SkeletonBlock className="h-24" />
                    <SkeletonBlock className="h-24" />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <Card>
                <EmptyState icon="error" title="Couldn't load the funnel" hint="Please try again in a moment." />
            </Card>
        );
    }

    const funnel = (data as any)?.funnel || {};
    const rawStages = funnel.stages || [];
    const stages: FunnelStageDatum[] = rawStages.map((s: any) => ({ ...s, description: STAGE_DESCRIPTIONS[s.key] }));
    const top: number = funnel.top || 0;
    const overall: number = funnel.overall_conversion || 0;
    const wonValue: number = (data as any)?.won_value || 0;
    const quality = (data as any)?.quality || { total_scored: 0, bands: [] };
    const isEmpty = top === 0 && stages.every((s) => s.count === 0);

    const qualityData: DonutDatum[] = [...(quality.bands || [])]
        .sort((a: any, b: any) => ['hot', 'warm', 'cold'].indexOf(a.band) - ['hot', 'warm', 'cold'].indexOf(b.band))
        .map((b: any) => ({
            key: b.band.toLowerCase(),
            label: b.band.charAt(0).toUpperCase() + b.band.slice(1),
            count: b.count,
            pct: b.pct,
            color: QUALITY_COLORS[b.band.toLowerCase()] || '#94a3b8',
            description: QUALITY_DESCRIPTIONS[b.band.toLowerCase()],
        }));

    const sources = (attrData as any)?.sources || [];
    const totalLeads = (attrData as any)?.total_leads || 0;
    const sourceBars: BarDatum[] = sources.map((s: any) => ({
        label: s.source,
        value: s.leads,
        secondary: s.won > 0 ? fmtMoneyCompact(s.won_value) : undefined,
        icon: SOURCE_ICONS[(s.source || '').toLowerCase()] || 'language',
    }));

    return (
        <div className="flex flex-col gap-4">
            <SectionHeader
                title="Conversion funnel"
                subtitle="How visitors turn into revenue, stage by stage"
                icon="filter_alt"
                right={windowSelector}
            />

            {isEmpty ? (
                <Card>
                    <EmptyState icon="filter_alt" title="No funnel data in this window yet" hint="Stages fill in as visitors chat and leads convert." />
                </Card>
            ) : (
                <>
                    {/* Funnel + outcomes */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <Card className="lg:col-span-8 p-4 sm:p-5">
                            <FunnelChart stages={stages} />
                        </Card>
                        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
                            <MetricCard
                                label="Overall conversion"
                                value={`${overall}%`}
                                hint="conversations → won deals"
                                icon="conversion_path"
                                tone="accent"
                            />
                            <MetricCard
                                label="Revenue won"
                                value={fmtMoney(wonValue)}
                                hint="closed-won in this window"
                                icon="paid"
                                tone="positive"
                            />
                        </div>
                    </div>

                    {/* Quality + attribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <Card className="p-4 sm:p-5">
                            <SectionHeader title="Lead quality" subtitle="Volume by purchase-intent signals" className="mb-4" />
                            <DonutChart data={qualityData} total={quality.total_scored} totalLabel="Scored" />
                        </Card>

                        <Card className="p-4 sm:p-5">
                            <SectionHeader title="Where customers found you" subtitle="Top channels by leads & revenue won" className="mb-4" />
                            {totalLeads === 0 ? (
                                <EmptyState icon="travel_explore" title="No sources in this window yet" />
                            ) : (
                                <HorizontalBars data={sourceBars} valueFormat={(n) => `${fmtNum(n)}`} />
                            )}
                        </Card>
                    </div>
                </>
            )}
        </div>
    );
};

export default FunnelPanel;
