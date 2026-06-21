'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

const fmt = (n: number | string) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtOrDash = (n: number | undefined, total: number) => (total === 0 ? '—' : fmt(n ?? 0));

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
            <div className="p-6 bg-white dark:bg-slate-900 rounded-md">
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="animate-pulse">
                {/* Slim skeleton — single unified border container */}
                <div className="border border-slate-100 dark:border-slate-800 rounded-md grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 divide-x-0 sm:divide-x divide-slate-100 dark:divide-slate-800">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="px-4 py-3">
                            <div className="h-3 bg-slate-100 dark:bg-slate-800 w-20 mb-2 rounded" />
                            <div className="h-5 bg-slate-100 dark:bg-slate-800 w-14 rounded" />
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    const stats = (data as any)?.stats || {};
    const roi = (data as any)?.roi || {};
    const realizedRevenue = roi.realized_revenue || 0;
    const wonDeals = roi.won_deals || 0;
    const total = stats.total_queries_30d || 0;

    const previewCost = parseFloat(costPerTicket) || 0;
    const previewLead = parseFloat(leadValue) || 0;
    const previewSavings = (stats.answered_queries_30d || 0) * previewCost;
    const previewRevenue = (stats.leads_30d || 0) * previewLead;
    const previewTotal = previewSavings + previewRevenue;

    const answerRate = total > 0
        ? Math.round((stats.answered_queries_30d / total) * 100)
        : 0;

    return (
        <div className="flex flex-col gap-3 transition-colors duration-500">
            {/* Header row */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">Financial Impact & ROI</span>
                    <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 hidden sm:inline">· last 30 days</span>
                </div>
                <button
                    onClick={() => setShowCalibrate(!showCalibrate)}
                    className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors min-h-[32px]"
                >
                    <span className="material-symbols-outlined text-[13px]">tune</span>
                    {showCalibrate ? 'Hide' : 'Calibrate'}
                </button>
            </div>

            {/* Calibrate drawer */}
            {showCalibrate && (
                <div className="border border-slate-100 dark:border-slate-800 rounded-md px-4 py-3 bg-white dark:bg-slate-900/50 transition-colors">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-1">Cost per support ticket ($)</label>
                            <input
                                type="number" min="0" step="0.5"
                                value={costPerTicket}
                                onChange={e => setCostPerTicket(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm text-sm font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
                                placeholder="5.00"
                            />
                            <p className="text-[10px] font-mono text-slate-400 mt-1">Industry avg: $5–$25 per ticket</p>
                        </div>
                        <div>
                            <label className="block text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-1">Average lead value ($)</label>
                            <input
                                type="number" min="0" step="5"
                                value={leadValue}
                                onChange={e => setLeadValue(e.target.value)}
                                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm text-sm font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
                                placeholder="50.00"
                            />
                            <p className="text-[10px] font-mono text-slate-400 mt-1">Estimate of one captured lead's worth</p>
                        </div>
                    </div>
                    <button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        className="px-4 py-1.5 text-[11px] font-mono uppercase tracking-wider bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                    >
                        {saveMutation.isPending ? <><div className="w-2.5 h-2.5 border-2 border-slate-400 border-t-white animate-spin rounded-full" />Saving...</> : saved ? <><span className="material-symbols-outlined text-[12px]">check</span>Saved</> : 'Save Benchmarks'}
                    </button>
                </div>
            )}

            {/* Scorecard row — shared container with dividers */}
            <div className="grid grid-cols-2 sm:grid-cols-4 border border-slate-100 dark:border-slate-800 rounded-md divide-y sm:divide-y-0 sm:divide-x divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900 transition-colors duration-500">
                {/* 1. Support Saved */}
                <div className="px-4 py-3 flex flex-col justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-1">Support Saved</span>
                    <span className="text-lg font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-200">{total === 0 ? '—' : fmt(previewSavings)}</span>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{stats.answered_queries_30d?.toLocaleString() ?? 0} queries answered</p>
                </div>

                {/* 2. Potential Revenue */}
                <div className="px-4 py-3 flex flex-col justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-1">Potential Revenue</span>
                    <span className="text-lg font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-200">{total === 0 ? '—' : fmt(previewRevenue)}</span>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">{stats.leads_30d?.toLocaleString() ?? 0} leads captured</p>
                </div>

                {/* 3. Proven Revenue */}
                <div className="px-4 py-3 flex flex-col justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-mono mb-1">Proven Revenue</span>
                    <span className="text-lg font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{fmt(realizedRevenue)}</span>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">From {wonDeals.toLocaleString()} closed-won deal{wonDeals !== 1 ? 's' : ''}</p>
                </div>

                {/* 4. Estimated ROI */}
                <div className="px-4 py-3 flex flex-col justify-center">
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono mb-1">Estimated ROI</span>
                    <span className="text-lg font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-200">{total === 0 ? '—' : fmt(previewTotal)}</span>
                    <p className="text-[10px] font-mono text-slate-400 mt-0.5">Answer rate: {answerRate}%</p>
                </div>
            </div>
        </div>
    );
};

export default ROIPanel;
