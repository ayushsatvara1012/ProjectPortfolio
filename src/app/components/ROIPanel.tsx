'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

const cellCls = 'bg-white dark:bg-white/[0.02] rounded-2xl transition-colors duration-500';

const fmt = (n: number | string) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ROIPanelProps {
    selectedBotId: string;
    authFetch: any;
    isAuthorized: boolean;
}

const ROIPanel = ({ selectedBotId, authFetch, isAuthorized }: ROIPanelProps) => {
    const queryClient = useQueryClient();
    const [showCalibrate, setShowCalibrate] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['roi-benchmarks', selectedBotId],
        queryFn: () => authFetch(`/api/roi-benchmarks/${selectedBotId}`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 60_000,
    });

    const [costPerTicket, setCostPerTicket] = useState('');
    const [leadValue, setLeadValue] = useState('');
    const [saved, setSaved] = useState(false);

    // Sync local state from fetched data on first load
    useEffect(() => {
        if ((data as any)?.benchmarks && costPerTicket === '') {
            setCostPerTicket(String((data as any).benchmarks.avg_human_cost_per_ticket));
            setLeadValue(String((data as any).benchmarks.avg_lead_value));
        }
    }, [data, costPerTicket]);

    const saveMutation = useMutation({
        mutationFn: () => authFetch(`/api/roi-benchmarks/${selectedBotId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                avg_human_cost_per_ticket: parseFloat(costPerTicket) || 5,
                avg_lead_value: parseFloat(leadValue) || 50,
            }),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['roi-benchmarks', selectedBotId] });
            setSaved(true);
            setTimeout(() => setSaved(false), 2500);
        },
    });

    if (!isAuthorized) {
        return (
            <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl">
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                <div className={`${cellCls} p-6 h-20`} />
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => <div key={i} className={`${cellCls} h-24`} />)}
                </div>
            </div>
        );
    }

    const stats = (data as any)?.stats || {};
    const roi = (data as any)?.roi || {};
    const realizedRevenue = roi.realized_revenue || 0;
    const wonDeals = roi.won_deals || 0;

    // Live preview: recalculate as user types
    const previewCost = parseFloat(costPerTicket) || 0;
    const previewLead = parseFloat(leadValue) || 0;
    const previewSavings = (stats.answered_queries_30d || 0) * previewCost;
    const previewRevenue = (stats.leads_30d || 0) * previewLead;
    const previewTotal = previewSavings + previewRevenue;

    const answerRate = stats.total_queries_30d > 0
        ? Math.round((stats.answered_queries_30d / stats.total_queries_30d) * 100)
        : 0;

    return (
        <div className="flex flex-col gap-4 transition-colors duration-500">
            {/* Header / Calibrate Toggle */}
            <div className="flex items-center justify-between gap-4 flex-wrap px-1">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-emerald-600 dark:text-emerald-400">payments</span>
                    <h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Financial Impact & ROI</h2>
                    <span className="hidden sm:inline text-xs font-google text-slate-400 dark:text-slate-500">· real-time value your bot generates</span>
                </div>
                <button
                    onClick={() => setShowCalibrate(!showCalibrate)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-all focus:outline-none"
                >
                    <span className="material-symbols-outlined text-[14px]">tune</span>
                    {showCalibrate ? 'Hide Settings' : 'Calibrate ROI'}
                </button>
            </div>

            {/* ── Expandable Benchmark Editor ── */}
            {showCalibrate && (
                <div className={`${cellCls} p-4 sm:p-6 border border-slate-200 dark:border-slate-800/80 animate-fade-in`}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 font-google mb-1.5">
                                Cost per support ticket ($)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="0.5"
                                value={costPerTicket}
                                onChange={e => setCostPerTicket(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] focus:bg-slate-200 dark:focus:bg-white/[0.08] focus:outline-none text-sm font-mono text-slate-900 dark:text-slate-200 rounded-xl transition-colors"
                                placeholder="5.00"
                            />
                            <p className="text-[10px] font-google text-slate-400 mt-1">
                                Industry avg: $5–$25 per ticket
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 font-google mb-1.5">
                                Average lead value ($)
                            </label>
                            <input
                                type="number"
                                min="0"
                                step="5"
                                value={leadValue}
                                onChange={e => setLeadValue(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-100 dark:bg-white/[0.04] focus:bg-slate-200 dark:focus:bg-white/[0.08] focus:outline-none text-sm font-mono text-slate-900 dark:text-slate-200 rounded-xl transition-colors"
                                placeholder="50.00"
                            />
                            <p className="text-[10px] font-google text-slate-400 mt-1">
                                Estimate of what one captured lead is worth
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        className="w-full sm:w-auto px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-semibold font-google rounded-lg hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-[0.98]"
                    >
                        {saveMutation.isPending ? (
                            <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full" /> Saving...</>
                        ) : saved ? (
                            <><span className="material-symbols-outlined text-[14px]">check</span> Saved</>
                        ) : (
                            <>Save Benchmarks</>
                        )}
                    </button>
                </div>
            )}

            {/* ── ROI Scorecards & Proven Revenue Row ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* 1. Support Savings */}
                <div className={`${cellCls} p-4 sm:p-5 flex flex-col justify-center border border-slate-100 dark:border-slate-800/40`}>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 font-google mb-1.5">Support Saved</span>
                    <span className="text-xl sm:text-2xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt(previewSavings)}</span>
                    <p className="text-[10px] font-google text-slate-400 dark:text-slate-500 mt-1">
                        {stats.answered_queries_30d?.toLocaleString()} queries answered
                    </p>
                </div>

                {/* 2. Potential Revenue */}
                <div className={`${cellCls} p-4 sm:p-5 flex flex-col justify-center border border-slate-100 dark:border-slate-800/40`}>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 font-google mb-1.5">Potential Revenue</span>
                    <span className="text-xl sm:text-2xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt(previewRevenue)}</span>
                    <p className="text-[10px] font-google text-slate-400 dark:text-slate-500 mt-1">
                        {stats.leads_30d?.toLocaleString()} leads captured
                    </p>
                </div>

                {/* 3. Closed-Won Revenue */}
                <div className={`${cellCls} p-4 sm:p-5 flex flex-col justify-center border border-emerald-250 dark:border-emerald-950/40 bg-emerald-50/10 dark:bg-emerald-950/5`}>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 dark:text-emerald-400 font-google mb-1.5">Proven Revenue</span>
                    <span className="text-xl sm:text-2xl font-google font-bold tracking-tight text-emerald-600 dark:text-emerald-400">{fmt(realizedRevenue)}</span>
                    <p className="text-[10px] font-google text-emerald-500 dark:text-emerald-400/80 mt-1">
                        From {wonDeals.toLocaleString()} closed-won deal{wonDeals !== 1 ? 's' : ''}
                    </p>
                </div>

                {/* 4. Total ROI */}
                <div className={`${cellCls} p-4 sm:p-5 flex flex-col justify-center border border-slate-100 dark:border-slate-800/40`}>
                    <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500 font-google mb-1.5">Estimated ROI</span>
                    <span className="text-xl sm:text-2xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt(previewTotal)}</span>
                    <p className="text-[10px] font-google text-slate-400 dark:text-slate-500 mt-1">
                        Answer rate: {answerRate}%
                    </p>
                </div>
            </div>
        </div>
    );
};

export default ROIPanel;
