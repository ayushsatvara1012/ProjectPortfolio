'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

const cellCls = 'bg-white dark:bg-white/[0.02] rounded-2xl transition-colors duration-500';

const fmtMoney = (n: number | string) =>
    '$' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtNum = (n: number | string) => Number(n || 0).toLocaleString('en-US');

// Window options mirror the backend's allowed values (0 = all-time).
const WINDOWS: { value: number; label: string }[] = [
    { value: 7, label: '7d' },
    { value: 30, label: '30d' },
    { value: 90, label: '90d' },
    { value: 0, label: 'All' },
];

// Per-stage accent (top → bottom of funnel). Keyed by backend stage key.
const STAGE_ACCENT: Record<string, { bar: string; dot: string; text: string }> = {
    conversations: { bar: 'bg-slate-400 dark:bg-slate-500', dot: 'bg-slate-400', text: 'text-slate-600 dark:text-slate-300' },
    leads: { bar: 'bg-indigo-400 dark:bg-indigo-500', dot: 'bg-indigo-400', text: 'text-indigo-600 dark:text-indigo-400' },
    contacted: { bar: 'bg-amber-400 dark:bg-amber-500', dot: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400' },
    won: { bar: 'bg-emerald-500 dark:bg-emerald-500', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
};

const QUALITY_ACCENT: Record<string, { bar: string; chip: string }> = {
    hot: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400' },
    warm: { bar: 'bg-amber-400', chip: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400' },
    cold: { bar: 'bg-sky-400', chip: 'bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400' },
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

const FunnelPanel = ({ selectedBotId, authFetch, isAuthorized }: FunnelPanelProps) => {
    const [windowDays, setWindowDays] = useState(30);

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
                    {/* ── Funnel stages (60%) + outcome summary (40%) ── */}
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                    <div className={`${cellCls} p-5 sm:p-8 lg:col-span-3`}>
                        <div className="flex flex-col gap-1">
                            {stages.map((s, i) => {
                                const accent = STAGE_ACCENT[s.key] || STAGE_ACCENT.conversations;
                                // Floor visible width so a non-zero stage never disappears.
                                const width = s.count > 0 ? Math.max(s.pct_of_top, 2) : 0;
                                const prev = i > 0 ? stages[i - 1] : null;
                                return (
                                    <React.Fragment key={s.key}>
                                        {/* Drop-off connector between stages */}
                                        {prev && (
                                            <div className="flex items-center gap-2 pl-1 py-1 select-none">
                                                <span className="material-symbols-outlined text-[14px] text-slate-300 dark:text-slate-600">south</span>
                                                <span className="text-[11px] font-google text-slate-400 dark:text-slate-500">
                                                    {s.pct_of_prev}% continued
                                                    {s.dropoff_pct > 0 && (
                                                        <span className="text-rose-500/80 dark:text-rose-400/80"> · {s.dropoff_pct}% drop-off</span>
                                                    )}
                                                </span>
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span className={`w-2 h-2 rounded-full ${accent.dot} shrink-0`} />
                                                    <span className="text-sm font-medium font-google text-slate-700 dark:text-slate-300 truncate">
                                                        {s.label}
                                                    </span>
                                                </div>
                                                <div className="flex items-baseline gap-2 shrink-0">
                                                    <span className="text-base sm:text-lg font-google font-bold text-slate-900 dark:text-slate-200">
                                                        {fmtNum(s.count)}
                                                    </span>
                                                    <span className={`text-xs font-google font-medium ${accent.text}`}>
                                                        {s.pct_of_top}%
                                                    </span>
                                                </div>
                                            </div>
                                            <div
                                                className="w-full h-3 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden"
                                                role="img"
                                                aria-label={`${s.label}: ${fmtNum(s.count)}, ${s.pct_of_top}% of top of funnel`}
                                            >
                                                <div
                                                    className={`h-full rounded-full ${accent.bar} transition-all duration-700`}
                                                    style={{ width: `${width}%` }}
                                                />
                                            </div>
                                        </div>
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* ── Outcome summary (40%, stacked beside the funnel) ── */}
                    <div className="lg:col-span-2 flex flex-col sm:flex-row lg:flex-col gap-4">
                        <div className={`${cellCls} p-6 sm:p-8 flex flex-col justify-center flex-1`}>
                            <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-google mb-2">
                                Overall conversion
                            </span>
                            <span className="text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">
                                {overall}%
                            </span>
                            <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                                of conversations end in a won deal
                            </p>
                        </div>
                        <div className={`${cellCls} p-6 sm:p-8 flex flex-col justify-center flex-1 border border-emerald-200 dark:border-emerald-900/40`}>
                            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 font-google uppercase tracking-wide mb-2">
                                Revenue won
                            </span>
                            <span className="text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">
                                {fmtMoney(wonValue)}
                            </span>
                            <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                                closed-won in this window
                            </p>
                        </div>
                    </div>
                    </div>

                    {/* ── Lead quality breakdown (orthogonal to the funnel) ── */}
                    <div className={`${cellCls} p-5 sm:p-8`}>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">local_fire_department</span>
                            <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Lead quality</h3>
                        </div>
                        <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-5">
                            How the {fmtNum(quality.total_scored)} scored leads in this window break down by intent.
                        </p>

                        {quality.total_scored === 0 ? (
                            <p className="text-sm font-google text-slate-400 dark:text-slate-500">
                                No scored leads in this window yet.
                            </p>
                        ) : (
                            <div className="flex flex-col gap-4">
                                {quality.bands.map((b: { band: string; count: number; pct: number }) => {
                                    const accent = QUALITY_ACCENT[b.band] || QUALITY_ACCENT.cold;
                                    return (
                                        <div key={b.band} className="flex flex-col gap-1.5">
                                            <div className="flex items-center justify-between gap-3">
                                                <span className={`text-[11px] font-semibold font-google uppercase tracking-wide px-2 py-0.5 rounded-md ${accent.chip}`}>
                                                    {b.band}
                                                </span>
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-sm font-google font-bold text-slate-900 dark:text-slate-200">{fmtNum(b.count)}</span>
                                                    <span className="text-xs font-google text-slate-400 dark:text-slate-500">{b.pct}%</span>
                                                </div>
                                            </div>
                                            <div
                                                className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden"
                                                role="img"
                                                aria-label={`${b.band} leads: ${fmtNum(b.count)}, ${b.pct}%`}
                                            >
                                                <div
                                                    className={`h-full rounded-full ${accent.bar} transition-all duration-700`}
                                                    style={{ width: `${b.count > 0 ? Math.max(b.pct, 2) : 0}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ── Lead source attribution: where your best leads come from ── */}
                    {(() => {
                        const sources = (attrData as any)?.sources || [];
                        const totalLeads = (attrData as any)?.total_leads || 0;
                        const maxLeads = sources.reduce((m: number, s: any) => Math.max(m, s.leads), 0) || 1;
                        return (
                            <div className={`${cellCls} p-5 sm:p-8`}>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">travel_explore</span>
                                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Where your leads come from</h3>
                                </div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-5">
                                    Top sources by lead volume — and the revenue each has actually closed.
                                </p>

                                {totalLeads === 0 ? (
                                    <p className="text-sm font-google text-slate-400 dark:text-slate-500">
                                        No leads in this window yet. Sources appear once visitors start converting.
                                    </p>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {sources.map((s: { source: string; leads: number; won: number; won_value: number }) => (
                                            <div key={s.source} className="flex flex-col gap-1.5">
                                                <div className="flex items-center justify-between gap-3">
                                                    <span className="text-sm font-medium font-google text-slate-700 dark:text-slate-300 truncate">{s.source}</span>
                                                    <div className="flex items-baseline gap-3 shrink-0">
                                                        <span className="text-sm font-google font-bold text-slate-900 dark:text-slate-200">{fmtNum(s.leads)}</span>
                                                        <span className="text-xs font-google text-slate-400 dark:text-slate-500">leads</span>
                                                        {s.won > 0 && (
                                                            <span className="text-xs font-google font-semibold text-emerald-600 dark:text-emerald-400">
                                                                {fmtMoney(s.won_value)} won
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div
                                                    className="w-full h-2.5 rounded-full bg-slate-100 dark:bg-white/[0.04] overflow-hidden"
                                                    role="img"
                                                    aria-label={`${s.source}: ${fmtNum(s.leads)} leads, ${fmtMoney(s.won_value)} won`}
                                                >
                                                    <div
                                                        className="h-full rounded-full bg-slate-400 dark:bg-slate-500 transition-all duration-700"
                                                        style={{ width: `${Math.max((s.leads / maxLeads) * 100, 3)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </>
            )}
        </div>
    );
};

export default FunnelPanel;
