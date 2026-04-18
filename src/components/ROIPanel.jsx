import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UpgradePrompt from './UpgradePrompt';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

const fmt = (n) => '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const ROIPanel = ({ selectedBotId, authFetch, userTier, userRole }) => {
    const queryClient = useQueryClient();
    const isAuthorized = userTier === 'PRO' || userTier === 'ENTERPRISE' || userRole === 'SUPER_ADMIN';

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
    React.useEffect(() => {
        if (data?.benchmarks && costPerTicket === '') {
            setCostPerTicket(String(data.benchmarks.avg_human_cost_per_ticket));
            setLeadValue(String(data.benchmarks.avg_lead_value));
        }
    }, [data]);

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
                <UpgradePrompt code="DEFAULT" tier={userTier} mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={`${cellCls} p-8 animate-pulse flex-1 flex flex-col gap-4`}>
                <div className="h-6 bg-slate-100 dark:bg-slate-800 w-48 mb-4" />
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 dark:bg-slate-800 w-full" />)}
            </div>
        );
    }

    const stats = data?.stats || {};

    // Live preview: recalculate as user types
    const previewCost = parseFloat(costPerTicket) || 0;
    const previewLead = parseFloat(leadValue) || 0;
    const previewSavings = stats.answered_queries_30d * previewCost;
    const previewRevenue = stats.leads_30d * previewLead;
    const previewTotal = previewSavings + previewRevenue;

    const answerRate = stats.total_queries_30d > 0
        ? Math.round((stats.answered_queries_30d / stats.total_queries_30d) * 100)
        : 0;

    return (
        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1 transition-colors duration-500 overflow-y-auto custom-scrollbar">

            {/* Header */}
            <div className={`${cellCls} p-6 sm:p-8 border-b border-gray-100 dark:border-slate-800`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-green-500 dark:text-green-400">savings</span>
                    <div>
                        <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                            Live ROI Dashboard
                        </h2>
                        <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-0.5">
                            Real-time value your bot generates — last 30 days
                        </p>
                    </div>
                </div>
            </div>

            {/* ── ROI Scorecards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-100 dark:bg-slate-800">
                <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mb-2">Support Cost Saved</span>
                    <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{fmt(previewSavings)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                        {stats.answered_queries_30d?.toLocaleString()} queries × ${previewCost.toFixed(2)}/ticket
                    </p>
                </div>
                <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mb-2">Potential Revenue</span>
                    <span className="text-4xl font-google font-bold tracking-tight text-blue-600 dark:text-blue-400">{fmt(previewRevenue)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                        {stats.leads_30d?.toLocaleString()} leads × ${previewLead.toFixed(2)}/lead
                    </p>
                </div>
                <div className={`${cellCls} p-8 flex flex-col justify-center`}>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mb-2">Total ROI</span>
                    <span className="text-4xl font-google font-bold tracking-tight text-green-600 dark:text-green-400">{fmt(previewTotal)}</span>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2">
                        Answer rate: {answerRate}%
                    </p>
                </div>
            </div>

            {/* ── Activity Stats ── */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-100 dark:bg-slate-800">
                <div className={`${cellCls} p-6 flex items-center gap-4`}>
                    <div className="w-10 h-10 flex items-center justify-center bg-slate-100 dark:bg-slate-900 shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">forum</span>
                    </div>
                    <div>
                        <span className="text-2xl font-google font-bold text-slate-900 dark:text-slate-200">{stats.total_queries_30d?.toLocaleString()}</span>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google mt-0.5">Total Queries</p>
                    </div>
                </div>
                <div className={`${cellCls} p-6 flex items-center gap-4`}>
                    <div className="w-10 h-10 flex items-center justify-center bg-emerald-50 dark:bg-emerald-900/20 shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-emerald-500 dark:text-emerald-400">check_circle</span>
                    </div>
                    <div>
                        <span className="text-2xl font-google font-bold text-slate-900 dark:text-slate-200">{stats.answered_queries_30d?.toLocaleString()}</span>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google mt-0.5">Answered</p>
                    </div>
                </div>
                <div className={`${cellCls} p-6 flex items-center gap-4`}>
                    <div className="w-10 h-10 flex items-center justify-center bg-blue-50 dark:bg-blue-900/20 shrink-0">
                        <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">group</span>
                    </div>
                    <div>
                        <span className="text-2xl font-google font-bold text-slate-900 dark:text-slate-200">{stats.leads_30d?.toLocaleString()}</span>
                        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-google mt-0.5">Leads Captured</p>
                    </div>
                </div>
            </div>

            {/* ── Benchmark Editor ── */}
            <div className={`${cellCls} p-4 sm:p-8`}>
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[16px] text-slate-500 dark:text-slate-400">tune</span>
                    <h3 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">Calibrate Your Benchmarks</h3>
                </div>
                <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-6">
                    Set values that match your business. Numbers update live above as you type.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-google mb-2">
                            Cost per Support Ticket ($)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={costPerTicket}
                            onChange={e => setCostPerTicket(e.target.value)}
                            className="w-full px-3 py-2.5 bg-transparent border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-lg font-mono text-slate-900 dark:text-slate-200 transition-colors"
                            placeholder="5.00"
                        />
                        <p className="text-[10px] font-google text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-widest">
                            Industry avg: $5–$25 per ticket
                        </p>
                    </div>
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 font-google mb-2">
                            Average Lead Value ($)
                        </label>
                        <input
                            type="number"
                            min="0"
                            step="5"
                            value={leadValue}
                            onChange={e => setLeadValue(e.target.value)}
                            className="w-full px-3 py-2.5 bg-transparent border border-gray-200 dark:border-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-lg font-mono text-slate-900 dark:text-slate-200 transition-colors"
                            placeholder="50.00"
                        />
                        <p className="text-[10px] font-google text-slate-400 dark:text-slate-500 mt-1.5 uppercase tracking-widest">
                            What is one captured lead worth to you?
                        </p>
                    </div>
                </div>
                <button
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="w-full sm:w-auto px-6 py-3 bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold font-google uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                    {saveMutation.isPending ? (
                        <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> Saving...</>
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