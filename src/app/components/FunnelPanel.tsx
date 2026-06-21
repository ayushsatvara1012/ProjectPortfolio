'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

const fmtMoney = (n: number | string) => '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtNum = (n: number | string) => Number(n || 0).toLocaleString('en-US');

const WINDOWS: { value: number; label: string }[] = [
    { value: 7, label: '7d' },
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 0, label: 'All' },
];

// Short labels for mobile
const STAGE_SHORT: Record<string, string> = {
    conversations: 'CONV',
    leads:         'LEADS',
    contacted:     'CONT',
    won:           'WON',
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
    conversations: 'Total visitors who interacted with the chatbot.',
    leads:         'Potential customers who provided their email or details.',
    contacted:     'Leads followed up with by email or suggestions.',
    won:           'Leads successfully closed and converted to deals.',
};

const QUALITY_ACCENT: Record<string, { dot: string; text: string }> = {
    hot:  { dot: 'bg-slate-900 dark:bg-slate-100',  text: 'text-slate-900 dark:text-slate-100' },
    warm: { dot: 'bg-slate-500 dark:bg-slate-400',  text: 'text-slate-600 dark:text-slate-300' },
    cold: { dot: 'bg-slate-300 dark:bg-slate-600',  text: 'text-slate-400 dark:text-slate-500' },
};

const QUALITY_DESCRIPTIONS: Record<string, string> = {
    hot:  'High purchase intent detected. Follow up immediately.',
    warm: 'Interested — asked about features, pricing, or integrations.',
    cold: 'General browsing or low conversion signals.',
};

const SOURCE_ICONS: Record<string, string> = {
    'chat widget': 'forum',
    'pricing page': 'credit_card',
    'docs': 'menu_book',
};

interface FunnelPanelProps {
    selectedBotId: string;
    authFetch: any;
    isAuthorized: boolean;
}

interface FunnelStage {
    key: string;
    label: string;
    count: number;
    pct_of_top: number;
    pct_of_prev: number;
    dropoff_pct: number;
}

// ── Horizontal Bar Chart ──────────────────────────────────────────────────────
const FunnelBarChart = ({ stages }: { stages: FunnelStage[] }) => {
    const [hovered, setHovered] = useState<string | null>(null);
    const maxCount = stages.reduce((m, s) => Math.max(m, s.count), 0) || 1;

    return (
        <div className="flex flex-col gap-0">
            {stages.map((s, i) => {
                const barPct = (s.count / maxCount) * 100;
                const isHovered = hovered === s.key;

                return (
                    <div key={s.key}>
                        {/* Dropoff connector between stages */}
                        {i > 0 && (
                            <div className="flex items-center gap-3 py-0.5 pl-28 sm:pl-32">
                                <span className="text-[10px] font-mono text-slate-400">{s.pct_of_prev}% continued</span>
                                {s.dropoff_pct > 0 && (
                                    <span className="text-[10px] font-mono text-rose-500">↓ {s.dropoff_pct}% lost</span>
                                )}
                            </div>
                        )}
                        {/* Row */}
                        <div
                            className={`flex items-center gap-3 py-1.5 px-2 rounded-sm cursor-default transition-colors ${isHovered ? 'bg-slate-50/80 dark:bg-slate-900/40' : ''}`}
                            onMouseEnter={() => setHovered(s.key)}
                            onMouseLeave={() => setHovered(null)}
                        >
                            {/* Stage label */}
                            <span className="w-24 sm:w-28 shrink-0 text-[10px] sm:text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                <span className="hidden sm:inline">{s.key}</span>
                                <span className="sm:hidden">{STAGE_SHORT[s.key] || s.key}</span>
                            </span>

                            {/* Bar track */}
                            <div className="flex-1 h-[5px] bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden">
                                <div
                                    className="h-full bg-slate-800 dark:bg-slate-200 transition-all duration-500"
                                    style={{ width: `${Math.max(barPct, s.count > 0 ? 1 : 0)}%` }}
                                />
                            </div>

                            {/* Count */}
                            <span className="w-14 sm:w-16 text-right font-mono tabular-nums text-sm text-slate-800 dark:text-slate-200 shrink-0">{fmtNum(s.count)}</span>

                            {/* Pct */}
                            <span className="w-10 sm:w-12 text-right font-mono text-[11px] text-slate-400 shrink-0">{s.pct_of_top}%</span>
                        </div>

                        {/* Tooltip on hover */}
                        {isHovered && (
                            <div className="ml-28 sm:ml-32 pl-2 pb-1 text-[10px] font-mono text-slate-400 italic leading-snug">
                                {STAGE_DESCRIPTIONS[s.key] || ''}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

// ── Thin Flat Monochromatic Donut ─────────────────────────────────────────────
const QualityDonut = ({ quality, activeBand, setActiveBand }: {
    quality: { total_scored: number; bands: { band: string; count: number; pct: number }[] };
    activeBand: string | null;
    setActiveBand: (b: string | null) => void;
}) => {
    const total = quality.total_scored;
    const bands = quality.bands || [];

    const sortedBands = [...bands].sort((a, b) => {
        const order = ['hot', 'warm', 'cold'];
        return order.indexOf(a.band.toLowerCase()) - order.indexOf(b.band.toLowerCase());
    });

    const radius = 70;
    const strokeWidth = 6;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercent = 0;

    // Flat solid monochrome colors (light and dark)
    const segmentColors: Record<string, { light: string; dark: string }> = {
        hot:  { light: '#1e293b', dark: '#f1f5f9' }, // slate-800 / slate-100
        warm: { light: '#64748b', dark: '#94a3b8' }, // slate-500 / slate-400
        cold: { light: '#cbd5e1', dark: '#334155' }, // slate-300 / slate-700
    };

    if (total === 0) {
        return (
            <p className="py-4 text-center text-sm italic text-slate-400 dark:text-slate-500">No scored leads in this window yet.</p>
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center gap-6">
                {/* Donut */}
                <div className="relative w-[140px] h-[140px] shrink-0">
                    <svg viewBox="0 0 200 200" className="w-full h-auto transform -rotate-90 overflow-visible">
                        {/* Track */}
                        <circle cx="100" cy="100" r={radius} fill="transparent" stroke="rgba(148,163,184,0.1)" strokeWidth={strokeWidth} />
                        {sortedBands.map(b => {
                            const key = b.band.toLowerCase();
                            const colors = segmentColors[key] || segmentColors.cold;
                            const pct = b.pct;
                            const segmentLength = (pct / 100) * circumference;
                            const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                            accumulatedPercent += pct;
                            const isHovered = activeBand === key;
                            const isAnyHovered = activeBand !== null;
                            return (
                                <circle
                                    key={b.band}
                                    cx="100" cy="100" r={radius}
                                    fill="transparent"
                                    // Use CSS variable trick for dark mode isn't possible inline, use a class-based approach via currentColor trick
                                    stroke={colors.light}
                                    strokeWidth={strokeWidth}
                                    strokeDasharray={`${segmentLength} ${circumference}`}
                                    strokeDashoffset={strokeDashoffset}
                                    strokeLinecap="butt"
                                    className="transition-opacity duration-300 cursor-pointer dark:[stroke:var(--ring-color)]"
                                    style={{ '--ring-color': colors.dark } as any}
                                    opacity={isAnyHovered && !isHovered ? 0.35 : 1}
                                    onMouseEnter={() => setActiveBand(key)}
                                    onMouseLeave={() => setActiveBand(null)}
                                />
                            );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                        <span className="text-xl font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100 leading-none">{fmtNum(total)}</span>
                        <span className="text-[9px] uppercase tracking-widest font-mono text-slate-400 mt-0.5">Scored</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-col gap-2 flex-1 min-w-0">
                    {sortedBands.map(b => {
                        const key = b.band.toLowerCase();
                        const accent = QUALITY_ACCENT[key] || QUALITY_ACCENT.cold;
                        const isHovered = activeBand === key;
                        return (
                            <div
                                key={b.band}
                                onMouseEnter={() => setActiveBand(key)}
                                onMouseLeave={() => setActiveBand(null)}
                                className={`flex items-start gap-2 py-1.5 px-2 rounded-sm cursor-default transition-colors ${isHovered ? 'bg-slate-50 dark:bg-slate-900/30' : ''}`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 mt-1 ${accent.dot}`} />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className={`text-[10px] font-mono uppercase tracking-wider font-semibold ${accent.text}`}>{b.band}</span>
                                        <span className="text-sm font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">{fmtNum(b.count)}</span>
                                        <span className="text-[10px] font-mono text-slate-400">({b.pct}%)</span>
                                    </div>
                                    <p className="text-[10px] font-mono text-slate-400 leading-snug mt-0.5">{QUALITY_DESCRIPTIONS[key] || ''}</p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// ── FunnelPanel ───────────────────────────────────────────────────────────────
const FunnelPanel = ({ selectedBotId, authFetch, isAuthorized }: FunnelPanelProps) => {
    const [windowDays, setWindowDays] = useState(30);
    const [activeBand, setActiveBand] = useState<string | null>(null);

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
        return <div className="p-6"><UpgradePrompt code="DEFAULT" tier="" mode="inline" /></div>;
    }

    // Underline window selector
    const windowSelector = (
        <div role="group" aria-label="Funnel time window" className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800">
            {WINDOWS.map(w => (
                <button
                    key={w.value}
                    type="button"
                    onClick={() => setWindowDays(w.value)}
                    aria-pressed={windowDays === w.value}
                    className={`pb-1.5 text-[11px] font-mono uppercase tracking-wider border-b-2 transition-all focus-visible:outline-none ${windowDays === w.value
                        ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100 font-semibold'
                        : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                >
                    {w.label}
                </button>
            ))}
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-800 pb-1.5">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-3 bg-slate-100 dark:bg-slate-800 w-8 rounded" />)}
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md p-4 sm:p-5">
                    {[1, 2, 3, 4].map(i => <div key={i} className="h-8 bg-slate-50 dark:bg-slate-800/50 mb-1 rounded" />)}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="h-20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md" />
                    <div className="h-20 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md" />
                </div>
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md p-6 text-center">
                    <p className="text-sm italic text-slate-400 dark:text-slate-500">Couldn&apos;t load the funnel. Please try again.</p>
                </div>
            </div>
        );
    }

    const funnel = (data as any)?.funnel || {};
    const stages: FunnelStage[] = funnel.stages || [];
    const top: number = funnel.top || 0;
    const overall: number = funnel.overall_conversion || 0;
    const wonValue: number = (data as any)?.won_value || 0;
    const quality = (data as any)?.quality || { total_scored: 0, bands: [] };
    const isEmpty = top === 0 && stages.every(s => s.count === 0);

    return (
        <div className="flex flex-col gap-4 transition-colors duration-500">
            {/* Header: title + window selector */}
            <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
                <div>
                    <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400">Conversion Funnel</span>
                    <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-0.5">How visitors turn into revenue, stage by stage</p>
                </div>
                {windowSelector}
            </div>

            {isEmpty ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md py-8 text-center">
                    <p className="text-sm italic text-slate-400 dark:text-slate-500">No funnel data in this window yet.</p>
                    <p className="text-[11px] font-mono text-slate-400 mt-1">Channels appear once leads convert.</p>
                </div>
            ) : (
                <>
                    {/* Horizontal Bar Chart */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md p-4 sm:p-5">
                        <FunnelBarChart stages={stages} />
                    </div>

                    {/* Conversion Outcomes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md px-4 py-4 sm:py-5 flex flex-col justify-center transition-colors duration-500">
                            <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400 mb-1">Overall Conversion Rate</span>
                            <span className="text-3xl font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-200">{overall}%</span>
                            <p className="text-[10px] font-mono text-slate-400 mt-1">bot conversations ending in a won customer deal</p>
                        </div>
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md px-4 py-4 sm:py-5 flex flex-col justify-center transition-colors duration-500">
                            <span className="text-[10px] uppercase tracking-widest font-mono text-emerald-600 dark:text-emerald-400 mb-1">Revenue Won</span>
                            <span className="text-3xl font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmtMoney(wonValue)}</span>
                            <p className="text-[10px] font-mono text-slate-400 mt-1">value of closed-won deals in this window</p>
                        </div>
                    </div>

                    {/* Lead Quality & Source Attribution */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Lead Quality — thin flat donut */}
                        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md p-4 sm:p-5 transition-colors duration-500">
                            <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400 block mb-1">Lead Quality Breakdown</span>
                            <p className="text-[10px] font-mono text-slate-400 mb-4">Lead volume categorized by intent signals.</p>
                            <QualityDonut quality={quality} activeBand={activeBand} setActiveBand={setActiveBand} />
                        </div>

                        {/* Source Attribution */}
                        {(() => {
                            const sources = (attrData as any)?.sources || [];
                            const totalLeads = (attrData as any)?.total_leads || 0;
                            const maxLeads = sources.reduce((m: number, s: any) => Math.max(m, s.leads), 0) || 1;

                            return (
                                <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md p-4 sm:p-5 transition-colors duration-500">
                                    <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400 block mb-1">Where Customers Found You</span>
                                    <p className="text-[10px] font-mono text-slate-400 mb-4">Top traffic channels by lead volume and realized revenue won.</p>

                                    {totalLeads === 0 ? (
                                        <p className="py-4 text-center text-sm italic text-slate-400 dark:text-slate-500">No sources in this window yet.</p>
                                    ) : (
                                        <div className="flex flex-col gap-0">
                                            {sources.map((s: { source: string; leads: number; won: number; won_value: number }) => {
                                                const icon = SOURCE_ICONS[s.source.toLowerCase()] || 'language';
                                                const barPct = (s.leads / maxLeads) * 100;
                                                return (
                                                    <div key={s.source} className="grid grid-cols-12 items-center gap-2 py-2 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                                        {/* Source name */}
                                                        <div className="col-span-4 flex items-center gap-1.5 min-w-0">
                                                            <span className="material-symbols-outlined text-[13px] text-slate-400 shrink-0">{icon}</span>
                                                            <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 truncate">{s.source}</span>
                                                        </div>
                                                        {/* Bar track */}
                                                        <div className="col-span-5 h-[4px] bg-slate-100 dark:bg-slate-800 rounded-none overflow-hidden">
                                                            <div className="h-full bg-slate-800 dark:bg-slate-200 transition-all duration-500" style={{ width: `${Math.max(barPct, 3)}%` }} />
                                                        </div>
                                                        {/* Count */}
                                                        <span className="col-span-1 text-right font-mono tabular-nums text-[11px] text-slate-600 dark:text-slate-300 shrink-0">{fmtNum(s.leads)}</span>
                                                        {/* Won value */}
                                                        <span className="col-span-2 text-right font-mono tabular-nums text-[11px] text-emerald-600 dark:text-emerald-400 shrink-0">
                                                            {s.won > 0 ? fmtMoney(s.won_value) : ''}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </>
            )}
        </div>
    );
};

export default FunnelPanel;
