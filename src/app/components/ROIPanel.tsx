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
            <div className="py-1 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                    <span className="text-sm tracking-normal font-semibold text-slate-800 dark:text-slate-200 font-sans">Financial Impact & ROI</span>
                    <span className="text-xs font-sans text-slate-500 hidden sm:inline">· last 30 days</span>
                </div>
                <button
                    onClick={() => setShowCalibrate(!showCalibrate)}
                    className="flex items-center gap-1 text-xs font-sans uppercase tracking-wider font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors min-h-[32px]"
                >
                    <span className="material-symbols-outlined text-[16px]">tune</span>
                    {showCalibrate ? 'Hide' : 'Calibrate'}
                </button>
            </div>

            {/* Calibrate drawer */}
            {showCalibrate && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm px-5 py-4 bg-white dark:bg-slate-900/50 transition-colors">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-xs uppercase tracking-widest text-slate-500 font-sans font-semibold mb-1">Cost per support ticket ($)</label>
                            <input
                                type="number" min="0" step="0.5"
                                value={costPerTicket}
                                onChange={e => setCostPerTicket(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm text-sm font-sans text-slate-900 dark:text-slate-200 focus:outline-none"
                                placeholder="5.00"
                            />
                            <p className="text-xs font-sans text-slate-500 mt-1">Industry avg: $5–$25 per ticket</p>
                        </div>
                        <div>
                            <label className="block text-xs uppercase tracking-widest text-slate-500 font-sans font-semibold mb-1">Average lead value ($)</label>
                            <input
                                type="number" min="0" step="5"
                                value={leadValue}
                                onChange={e => setLeadValue(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm text-sm font-sans text-slate-900 dark:text-slate-200 focus:outline-none"
                                placeholder="50.00"
                            />
                            <p className="text-xs font-sans text-slate-500 mt-1">Estimate of one captured lead's worth</p>
                        </div>
                    </div>
                    <button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        className="px-4 py-2 text-xs font-sans uppercase tracking-wider font-semibold bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-md shadow-sm disabled:opacity-50 flex items-center gap-1.5 transition-colors"
                    >
                        {saveMutation.isPending ? <><div className="w-3 h-3 border-2 border-slate-400 border-t-white animate-spin rounded-full" />Saving...</> : saved ? <><span className="material-symbols-outlined text-[14px]">check</span>Saved</> : 'Save Benchmarks'}
                    </button>
                </div>
            )}

            {/* Scorecard row — bento box grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 transition-colors duration-500">
                {/* 1. Support Saved */}
                <div className="flex flex-col justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm px-5 py-4">
                    <span className="text-xs uppercase tracking-widest text-slate-500 font-sans mb-1 font-semibold">Support Saved</span>
                    <span className="text-2xl font-sans tabular-nums font-bold text-slate-900 dark:text-slate-200">{total === 0 ? '—' : fmt(previewSavings)}</span>
                    <p className="text-xs font-sans text-slate-500 mt-1">{stats.answered_queries_30d?.toLocaleString() ?? 0} queries answered</p>
                </div>

                {/* 2. Potential Revenue */}
                <div className="flex flex-col justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm px-5 py-4">
                    <span className="text-xs uppercase tracking-widest text-slate-500 font-sans mb-1 font-semibold">Potential Revenue</span>
                    <span className="text-2xl font-sans tabular-nums font-bold text-slate-900 dark:text-slate-200">{total === 0 ? '—' : fmt(previewRevenue)}</span>
                    <p className="text-xs font-sans text-slate-500 mt-1">{stats.leads_30d?.toLocaleString() ?? 0} leads captured</p>
                </div>

                {/* 3. Proven Revenue */}
                <div className="flex flex-col justify-center bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl shadow-sm px-5 py-4">
                    <span className="text-xs uppercase tracking-widest text-emerald-600 dark:text-emerald-400 font-sans mb-1 font-semibold">Proven Revenue</span>
                    <span className="text-2xl font-sans tabular-nums font-bold text-emerald-700 dark:text-emerald-300">{fmt(realizedRevenue)}</span>
                    <p className="text-xs font-sans text-emerald-600/70 dark:text-emerald-400/70 mt-1">From {wonDeals.toLocaleString()} closed-won deal{wonDeals !== 1 ? 's' : ''}</p>
                </div>

                {/* 4. Estimated ROI */}
                <div className="flex flex-col justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border border-indigo-200 dark:border-indigo-800/50 rounded-xl shadow-sm px-5 py-4">
                    <span className="text-xs uppercase tracking-widest text-indigo-600 dark:text-indigo-400 font-sans mb-1 font-semibold">Estimated ROI</span>
                    <span className="text-2xl font-sans tabular-nums font-bold text-indigo-700 dark:text-indigo-300">{total === 0 ? '—' : fmt(previewTotal)}</span>
                    <p className="text-xs font-sans text-indigo-600/70 dark:text-indigo-400/70 mt-1">Answer rate: {answerRate}%</p>
                </div>
            </div>
        </div>
    );
};

export default ROIPanel;
