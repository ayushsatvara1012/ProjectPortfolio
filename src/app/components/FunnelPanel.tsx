'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

const cellCls = 'bg-white dark:bg-white/[0.02] rounded-2xl transition-colors duration-500';

const fmtMoney = (n: number | string) =>
    '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtNum = (n: number | string) => Number(n || 0).toLocaleString('en-US');

const WINDOWS: { value: number; label: string }[] = [
    { value: 7, label: '7d' },
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 0, label: 'All' },
];

const STAGE_ACCENT: Record<string, { bar: string; dot: string; text: string; bg: string }> = {
    conversations: { bar: 'bg-slate-400 dark:bg-slate-500', dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-900/40' },
    leads: { bar: 'bg-indigo-400 dark:bg-indigo-500', dot: 'bg-indigo-400', text: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50/50 dark:bg-indigo-950/10' },
    contacted: { bar: 'bg-amber-400 dark:bg-amber-500', dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50/50 dark:bg-amber-950/10' },
    won: { bar: 'bg-emerald-500 dark:bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50/50 dark:bg-emerald-950/10' },
};

const STAGE_DESCRIPTIONS: Record<string, string> = {
    conversations: 'Total volume of visitors who interacted with the chatbot.',
    leads: 'Potential customers who provided their email or details.',
    contacted: 'Leads followed up with by email or suggestions.',
    won: 'Leads successfully closed and converted to deals.',
};

const QUALITY_ACCENT: Record<string, { bar: string; chip: string; dot: string }> = {
    hot: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400', dot: 'bg-rose-500' },
    warm: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', dot: 'bg-amber-400' },
    cold: { bar: 'bg-sky-400', chip: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400', dot: 'bg-sky-400' },
};

const QUALITY_DESCRIPTIONS: Record<string, string> = {
    hot: 'Ready to buy! High purchase intent detected. Follow up immediately.',
    warm: 'Interested. Asked questions about features, pricing, or integrations.',
    cold: 'General browsing, FAQs, or low conversion signals.',
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

// ── Funnel Visual SVG Component ──
interface FunnelVisualProps {
    stages: FunnelStage[];
    hoveredStage: string | null;
    setHoveredStage: (key: string | null) => void;
}

export const FunnelVisual = ({ stages, hoveredStage, setHoveredStage }: FunnelVisualProps) => {
    const stageKeys = ['conversations', 'leads', 'contacted', 'won'];
    const getStageIndex = (key: string) => stageKeys.indexOf(key);

    const sliceCoords = [
        { points: '30,10 370,10 320,65 80,65', midY: 37.5, labelY: 43 },
        { points: '80,85 320,85 280,140 120,140', midY: 112.5, labelY: 118 },
        { points: '120,160 280,160 250,215 150,215', midY: 187.5, labelY: 193 },
        { points: '150,235 250,235 230,290 170,290', midY: 262.5, labelY: 268 }
    ];

    const isAnyHovered = hoveredStage !== null;

    return (
        <div className="relative w-full max-w-[280px] mx-auto select-none py-2">
            <svg viewBox="0 0 400 305" className="w-full h-auto overflow-visible">
                <defs>
                    <linearGradient id="grad-conversations" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#64748b" />
                        <stop offset="100%" stopColor="#475569" />
                    </linearGradient>
                    <linearGradient id="grad-leads" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#4f46e5" />
                    </linearGradient>
                    <linearGradient id="grad-contacted" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#ca8a04" />
                    </linearGradient>
                    <linearGradient id="grad-won" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#34d399" />
                        <stop offset="100%" stopColor="#059669" />
                    </linearGradient>

                    <filter id="glow-conversations" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#64748b" floodOpacity="0.25" />
                    </filter>
                    <filter id="glow-leads" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#4f46e5" floodOpacity="0.3" />
                    </filter>
                    <filter id="glow-contacted" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#ca8a04" floodOpacity="0.3" />
                    </filter>
                    <filter id="glow-won" x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#059669" floodOpacity="0.3" />
                    </filter>
                </defs>

                {stages.map((s) => {
                    const idx = getStageIndex(s.key);
                    if (idx === -1) return null;
                    const coords = sliceCoords[idx];
                    const isHovered = hoveredStage === s.key;

                    return (
                        <g
                            key={s.key}
                            onMouseEnter={() => setHoveredStage(s.key)}
                            onMouseLeave={() => setHoveredStage(null)}
                            className="cursor-pointer transition-all duration-300"
                            style={{
                                transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                                transformOrigin: `200px ${coords.midY}px`,
                            }}
                        >
                            <polygon
                                points={coords.points}
                                fill={`url(#grad-${s.key})`}
                                filter={isHovered ? `url(#glow-${s.key})` : undefined}
                                opacity={isAnyHovered && !isHovered ? 0.45 : 0.95}
                                stroke={isHovered ? '#ffffff' : 'transparent'}
                                strokeWidth={isHovered ? 1.5 : 0}
                                className="transition-all duration-300"
                            />
                            <text
                                x="200"
                                y={coords.labelY}
                                textAnchor="middle"
                                className="text-[14px] font-bold font-google fill-white pointer-events-none drop-shadow-sm transition-all duration-300"
                                opacity={isAnyHovered && !isHovered ? 0.6 : 1}
                            >
                                {fmtNum(s.count)}
                            </text>
                        </g>
                    );
                })}

                {/* Drop-off Connectors drawn on the right edge */}
                {stages.map((s, i) => {
                    if (i === 0) return null;
                    const idx = getStageIndex(s.key);
                    const prevCoords = sliceCoords[idx - 1];
                    const currCoords = sliceCoords[idx];
                    const midY = (prevCoords.midY + currCoords.midY) / 2;
                    const rightX = idx === 1 ? 320 : idx === 2 ? 280 : 250;

                    return (
                        <g key={`connector-${s.key}`} className="transition-opacity duration-300" opacity={isAnyHovered ? 0.3 : 0.85}>
                            <path
                                d={`M ${rightX},${midY} Q 365,${midY} 370,${midY}`}
                                fill="none"
                                stroke="#ef4444"
                                strokeWidth="1.5"
                                strokeDasharray="3 3"
                            />
                            <circle cx="370" cy={midY} r="3" fill="#ef4444" />
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

// ── Lead Quality Donut Component ──
interface QualityDonutProps {
    quality: {
        total_scored: number;
        bands: { band: string; count: number; pct: number }[];
    };
    activeBand: string | null;
    setActiveBand: (band: string | null) => void;
}

export const QualityDonut = ({ quality, activeBand, setActiveBand }: QualityDonutProps) => {
    const total = quality.total_scored;
    const bands = quality.bands || [];

    const sortedBands = [...bands].sort((a, b) => {
        const order = ['hot', 'warm', 'cold'];
        return order.indexOf(a.band.toLowerCase()) - order.indexOf(b.band.toLowerCase());
    });

    const radius = 70;
    const strokeWidth = 14;
    const circumference = 2 * Math.PI * radius;

    let accumulatedPercent = 0;

    const bandColors = {
        hot: { stroke: 'url(#grad-hot)', raw: '#f43f5e' },
        warm: { stroke: 'url(#grad-warm)', raw: '#f59e0b' },
        cold: { stroke: 'url(#grad-cold)', raw: '#0ea5e9' }
    };

    return (
        <div className="relative w-full max-w-[170px] mx-auto flex items-center justify-center">
            <svg viewBox="0 0 200 200" className="w-full h-auto transform -rotate-90 overflow-visible">
                <defs>
                    <linearGradient id="grad-hot" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#be123c" />
                    </linearGradient>
                    <linearGradient id="grad-warm" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                    <linearGradient id="grad-cold" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#38bdf8" />
                        <stop offset="100%" stopColor="#0284c7" />
                    </linearGradient>
                    <filter id="donut-shadow">
                        <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.1" />
                    </filter>
                </defs>

                <circle
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="transparent"
                    stroke="rgba(148, 163, 184, 0.08)"
                    strokeWidth={strokeWidth}
                />

                {sortedBands.map((b) => {
                    const key = b.band.toLowerCase();
                    const color = bandColors[key as keyof typeof bandColors] || bandColors.cold;

                    const pct = b.pct;
                    const segmentLength = (pct / 100) * circumference;
                    const strokeDashoffset = -((accumulatedPercent / 100) * circumference);

                    accumulatedPercent += pct;

                    const isHovered = activeBand === key;
                    const isAnyHovered = activeBand !== null;

                    return (
                        <circle
                            key={b.band}
                            cx="100"
                            cy="100"
                            r={radius}
                            fill="transparent"
                            stroke={color.stroke}
                            strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                            strokeDasharray={`${segmentLength} ${circumference}`}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            className="transition-all duration-300 cursor-pointer"
                            opacity={isAnyHovered && !isHovered ? 0.35 : 1}
                            filter="url(#donut-shadow)"
                            onMouseEnter={() => setActiveBand(key)}
                            onMouseLeave={() => setActiveBand(null)}
                        />
                    );
                })}
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                <span className="text-2xl font-bold font-google text-slate-900 dark:text-slate-100 leading-none">
                    {fmtNum(total)}
                </span>
                <span className="text-[9px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mt-1 font-google">
                    Scored Leads
                </span>
            </div>
        </div>
    );
};

const FunnelPanel = ({ selectedBotId, authFetch, isAuthorized }: FunnelPanelProps) => {
    const [windowDays, setWindowDays] = useState(30);
    const [hoveredStage, setHoveredStage] = useState<string | null>(null);
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
        return (
            <div className="p-8">
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    const windowSelector = (
        <div
            role="group"
            aria-label="Funnel time window"
            className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 self-start"
        >
            {WINDOWS.map(w => (
                <button
                    key={w.value}
                    type="button"
                    onClick={() => setWindowDays(w.value)}
                    aria-pressed={windowDays === w.value}
                    className={`px-3 py-1.5 text-xs font-medium font-google rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${windowDays === w.value
                            ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                >
                    {w.label}
                </button>
            ))}
        </div>
    );

    const header = (
        <div className={`${cellCls} p-6 sm:p-8`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-400">filter_alt</span>
                    <div>
                        <h2 className="text-lg font-semibold font-google text-slate-900 dark:text-slate-200">
                            Conversion funnel
                        </h2>
                        <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-0.5">
                            How visitors turn into revenue, stage by stage
                        </p>
                    </div>
                </div>
                {windowSelector}
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 flex-1 transition-colors duration-500 overflow-y-auto custom-scrollbar md:p-8 animate-pulse">
                <div className={`${cellCls} p-6 h-24`} />
                <div className={`${cellCls} p-6 sm:p-8`}>
                    <div className="flex flex-col gap-5">
                        {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-slate-100 dark:bg-white/[0.04] rounded-xl" />)}
                    </div>
                </div>
                <div className={`${cellCls} h-40`} />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col gap-4 flex-1 md:p-8">
                {header}
                <div className={`${cellCls} p-8 text-center`}>
                    <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600">error_outline</span>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-2">
                        Couldn&apos;t load the funnel. Please try again.
                    </p>
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
        <div className="flex flex-col gap-4 flex-1 transition-colors duration-500 overflow-y-auto custom-scrollbar md:p-8">
            {header}

            {isEmpty ? (
                <div className={`${cellCls} p-10 sm:p-14 flex flex-col items-center text-center`}>
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-white/[0.04]">
                        <span className="material-symbols-outlined text-[22px] text-slate-400 dark:text-slate-500">filter_alt_off</span>
                    </div>
                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200 mt-4">
                        No funnel data yet
                    </h3>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                        Once visitors start chatting and leaving their details in this window, you&apos;ll see the full journey here.
                    </p>
                </div>
            ) : (
                <>
                    {/* ── Visual Funnel Chart & Interactive Details ── */}
                    <div className={`${cellCls} p-5 sm:p-8`}>
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                            {/* Graphic Visual Funnel Chart */}
                            <div className="lg:col-span-5 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-100 dark:border-slate-800/40 pb-6 lg:pb-0 lg:pr-6">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-4 font-google">
                                    Interactive Funnel Graph
                                </span>
                                <FunnelVisual
                                    stages={stages}
                                    hoveredStage={hoveredStage}
                                    setHoveredStage={setHoveredStage}
                                />
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-google text-center mt-2">
                                    Hover slices to examine conversion parameters
                                </span>
                            </div>

                            {/* Informative Stage Description Details */}
                            <div className="lg:col-span-7 flex flex-col gap-3">
                                {stages.map((s, i) => {
                                    const accent = STAGE_ACCENT[s.key] || STAGE_ACCENT.conversations;
                                    const isHovered = hoveredStage === s.key;
                                    const prev = i > 0 ? stages[i - 1] : null;

                                    return (
                                        <React.Fragment key={s.key}>
                                            {/* lost visitors indicator details */}
                                            {prev && (
                                                <div className="flex items-center gap-2 pl-4 py-0.5 select-none opacity-80">
                                                    <span className="material-symbols-outlined text-[13px] text-slate-400 dark:text-slate-600">south</span>
                                                    <span className="text-[11px] font-google text-slate-400 dark:text-slate-500">
                                                        {s.pct_of_prev}% continued
                                                        {s.dropoff_pct > 0 && (
                                                            <span className="text-rose-500 font-medium"> · {s.dropoff_pct}% lost visitors</span>
                                                        )}
                                                    </span>
                                                </div>
                                            )}

                                            <div
                                                onMouseEnter={() => setHoveredStage(s.key)}
                                                onMouseLeave={() => setHoveredStage(null)}
                                                className={`p-4 rounded-xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${isHovered
                                                        ? 'border-indigo-400 dark:border-indigo-500 bg-slate-50 dark:bg-white/[0.04] translate-x-1'
                                                        : 'border-slate-100/50 dark:border-slate-800/20 bg-slate-50/20 dark:bg-white/[0.005]'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <span className={`w-2 h-2 rounded-full ${accent.dot} mt-1.5 shrink-0`} />
                                                    <div className="min-w-0">
                                                        <span className="text-sm font-semibold font-google text-slate-800 dark:text-slate-200">
                                                            {s.label}
                                                        </span>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-google leading-relaxed">
                                                            {STAGE_DESCRIPTIONS[s.key] || ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-baseline sm:flex-col sm:items-end justify-between sm:justify-center shrink-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800 pt-2 sm:pt-0">
                                                    <span className="text-base font-bold font-google text-slate-900 dark:text-slate-100">
                                                        {fmtNum(s.count)}
                                                    </span>
                                                    <span className={`text-xs font-google font-semibold ${accent.text} sm:mt-0.5`}>
                                                        {s.pct_of_top}%
                                                    </span>
                                                </div>
                                            </div>
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* ── Conversion Outcomes Card ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`${cellCls} p-6 sm:p-8 flex flex-col justify-center`}>
                            <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 font-google uppercase tracking-wider mb-2">
                                Overall conversion rate
                            </span>
                            <span className="text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">
                                {overall}%
                            </span>
                            <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                                percentage of bot conversations that end in a won customer deal
                            </p>
                        </div>
                        <div className={`${cellCls} p-6 sm:p-8 flex flex-col justify-center border border-emerald-200/60 dark:border-emerald-900/30 bg-emerald-50/[0.02] dark:bg-emerald-900/[0.01]`}>
                            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 font-google uppercase tracking-wider mb-2">
                                Revenue won
                            </span>
                            <span className="text-3xl md:text-4xl font-google font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                                {fmtMoney(wonValue)}
                            </span>
                            <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                                value of closed-won deals generated in this time window
                            </p>
                        </div>
                    </div>

                    {/* ── Lead Quality & Attribution Grid ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Lead Quality donut chart */}
                        <div className={`${cellCls} p-5 sm:p-8 flex flex-col`}>
                            <div className="flex items-center gap-2 mb-1">
                                <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">local_fire_department</span>
                                <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Lead quality breakdown</h3>
                            </div>
                            <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-6">
                                Lead volume in this window categorized by intent signals.
                            </p>

                            {quality.total_scored === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-6">
                                    <p className="text-sm font-google text-slate-400 dark:text-slate-500 italic">
                                        No scored leads in this window yet.
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 items-center">
                                    {/* Donut graphic */}
                                    <div className="sm:col-span-5 flex justify-center pb-4 sm:pb-0">
                                        <QualityDonut
                                            quality={quality}
                                            activeBand={activeBand}
                                            setActiveBand={setActiveBand}
                                        />
                                    </div>

                                    {/* Legends details list */}
                                    <div className="sm:col-span-7 flex flex-col gap-2.5">
                                        {quality.bands.map((b: { band: string; count: number; pct: number }) => {
                                            const key = b.band.toLowerCase();
                                            const accent = QUALITY_ACCENT[key] || QUALITY_ACCENT.cold;
                                            const isHovered = activeBand === key;

                                            return (
                                                <div
                                                    key={b.band}
                                                    onMouseEnter={() => setActiveBand(key)}
                                                    onMouseLeave={() => setActiveBand(null)}
                                                    className={`p-3 rounded-xl border transition-all duration-300 cursor-pointer ${isHovered
                                                            ? 'border-indigo-400 dark:border-indigo-500 bg-slate-50 dark:bg-white/[0.04]'
                                                            : 'border-transparent bg-slate-50/20 dark:bg-white/[0.005]'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`w-2 h-2 rounded-full ${accent.dot}`} />
                                                            <span className="text-[11px] font-bold uppercase tracking-wider font-google text-slate-700 dark:text-slate-300">
                                                                {b.band}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-baseline gap-1.5 shrink-0">
                                                            <span className="text-sm font-bold font-google text-slate-900 dark:text-slate-100">
                                                                {fmtNum(b.count)}
                                                            </span>
                                                            <span className="text-xs font-google text-slate-400 dark:text-slate-500">
                                                                ({b.pct}%)
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-google mt-1 leading-relaxed">
                                                        {QUALITY_DESCRIPTIONS[key] || ''}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Source Attribution visual bar chart */}
                        {(() => {
                            const sources = (attrData as any)?.sources || [];
                            const totalLeads = (attrData as any)?.total_leads || 0;
                            const maxLeads = sources.reduce((m: number, s: any) => Math.max(m, s.leads), 0) || 1;

                            return (
                                <div className={`${cellCls} p-5 sm:p-8 flex flex-col`}>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">travel_explore</span>
                                        <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Where customers found you</h3>
                                    </div>
                                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-6">
                                        Top traffic channels by lead volume and realized revenue won.
                                    </p>

                                    {totalLeads === 0 ? (
                                        <div className="flex-1 flex items-center justify-center p-6">
                                            <p className="text-sm font-google text-slate-400 dark:text-slate-500 italic">
                                                No sources in this window yet. Channels appear once leads convert.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-4 flex-1 justify-center">
                                            {sources.map((s: { source: string; leads: number; won: number; won_value: number }) => {
                                                const icon = SOURCE_ICONS[s.source.toLowerCase()] || 'language';
                                                const barPct = (s.leads / maxLeads) * 100;

                                                return (
                                                    <div key={s.source} className="flex flex-col gap-2 p-3 bg-slate-50/20 dark:bg-white/[0.005] rounded-xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all duration-300">
                                                        <div className="flex items-center justify-between gap-3 flex-wrap">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className="material-symbols-outlined text-[16px] text-slate-400 shrink-0">{icon}</span>
                                                                <span className="text-xs font-semibold font-google text-slate-700 dark:text-slate-300 truncate">
                                                                    {s.source}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="text-xs font-bold font-google text-slate-900 dark:text-slate-100">
                                                                    {fmtNum(s.leads)}
                                                                </span>
                                                                <span className="text-[10px] font-google text-slate-400 dark:text-slate-500">leads</span>
                                                                {s.won > 0 && (
                                                                    <span className="text-[10px] font-google font-bold text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                                                                        {fmtMoney(s.won_value)} won
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div
                                                            className="w-full h-2 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden"
                                                            role="img"
                                                            aria-label={`${s.source}: ${fmtNum(s.leads)} leads, ${fmtMoney(s.won_value)} won`}
                                                        >
                                                            <div
                                                                className="h-full rounded-full bg-indigo-500/80 dark:bg-indigo-600/80 transition-all duration-700"
                                                                style={{ width: `${Math.max(barPct, 3)}%` }}
                                                            />
                                                        </div>
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
