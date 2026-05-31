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
            <div className="p-8">
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 flex-1 p-6 md:p-8 animate-pulse">
                <div className={`${cellCls} p-6 h-20`} />
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className={`${cellCls} h-28`} />)}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className={`${cellCls} h-20`} />)}
                </div>
                <div className={`${cellCls} h-48`} />
            </div>
        );
    }

    const stats = (data as any)?.stats || {};

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
        <div className="flex flex-col gap-4 flex-1 transition-colors duration-500 overflow-y-auto custom-scrollbar p-6 md:p-8">

            {/* Header */}
            <div className={`${cellCls} p-6 sm:p-8`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-400">savings</span>
                    <div>
                        <h2 className="text-lg font-semibold font-google text-slate-900 dark:text-slate-200">
                            Live ROI dashboard
                        </h2>
                        <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-0.5">
                            Real-time value your bot generates — last 30 days
                        </p>
                    </div>
                </div>
            </div>

            {/* ── ROI Scorecards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-google mb-2">Support cost saved</span>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt(previewSavings)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                        {stats.answered_queries_30d?.toLocaleString()} queries × ${previewCost.toFixed(2)}/ticket
                    </p>
                </div>
                <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-google mb-2">Potential revenue</span>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt(previewRevenue)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                        {stats.leads_30d?.toLocaleString()} leads × ${previewLead.toFixed(2)}/lead
                    </p>
                </div>
                <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 font-google mb-2">Total ROI</span>
                    <span className="text-2xl sm:text-3xl md:text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt(previewTotal)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                        Answer rate: {answerRate}%
                    </p>
                </div>
            </div>

            {/* ── Activity Stats ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className={`${cellCls} p-6 flex items-center gap-4`}>
                    <div className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/[0.04] shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">forum</span>
                    </div>
                    <div>
                        <span className="text-lg sm:text-xl md:text-2xl font-google font-bold text-slate-900 dark:text-slate-200">{stats.total_queries_30d?.toLocaleString()}</span>
                        <p className="text-xs font-medium text-slate-400 font-google mt-0.5">Total queries</p>
                    </div>
                </div>
                <div className={`${cellCls} p-6 flex items-center gap-4`}>
                    <div className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/[0.04] shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-400">check_circle</span>
                    </div>
                    <div>
                        <span className="text-lg sm:text-xl md:text-2xl font-google font-bold text-slate-900 dark:text-slate-200">{stats.answered_queries_30d?.toLocaleString()}</span>
                        <p className="text-xs font-medium text-slate-400 font-google mt-0.5">Answered</p>
                    </div>
                </div>
                <div className={`${cellCls} p-6 flex items-center gap-4`}>
                    <div className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-white/[0.04] shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-slate-800 dark:text-slate-200">group</span>
                    </div>
                    <div>
                        <span className="text-lg sm:text-xl md:text-2xl font-google font-bold text-slate-900 dark:text-slate-200">{stats.leads_30d?.toLocaleString()}</span>
                        <p className="text-xs font-medium text-slate-400 font-google mt-0.5">Leads captured</p>
                    </div>
                </div>
            </div>

            {/* ── Benchmark Editor ── */}
            <div className={`${cellCls} p-4 sm:p-8`}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">tune</span>
                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Calibrate your benchmarks</h3>
                </div>
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-6">
                    Set values that match your business. Numbers update live above as you type.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 font-google mb-2">
                            Cost per support ticket ($)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={costPerTicket}
                            onChange={e => setCostPerTicket(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-white/[0.04] focus:bg-slate-200 dark:focus:bg-white/[0.08] focus:outline-none text-base font-mono text-slate-900 dark:text-slate-200 rounded-xl transition-colors"
                            placeholder="5.00"
                        />
                        <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-1.5">
                            Industry avg: $5–$25 per ticket
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-500 dark:text-slate-400 font-google mb-2">
                            Average lead value ($)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="5"
                            value={leadValue}
                            onChange={e => setLeadValue(e.target.value)}
                            className="w-full px-4 py-3 bg-slate-100 dark:bg-white/[0.04] focus:bg-slate-200 dark:focus:bg-white/[0.08] focus:outline-none text-base font-mono text-slate-900 dark:text-slate-200 rounded-xl transition-colors"
                            placeholder="50.00"
                        />
                        <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-1.5">
                            What is one captured lead worth to you?
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="w-full sm:w-auto px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
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
        </div>
    );
};

export default ROIPanel;
