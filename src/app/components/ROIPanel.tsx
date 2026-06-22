'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import { card, cx, fmtMoney, fmtNum, MetricCard, SectionHeader, SkeletonBlock } from '@/src/app/components/insights/ui';

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
            <div className={cx(card, 'p-6')}>
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col gap-3">
                <SkeletonBlock className="h-5 w-48" />
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map(i => <SkeletonBlock key={i} className="h-[110px]" />)}
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

    const answerRate = total > 0 ? Math.round((stats.answered_queries_30d / total) * 100) : 0;
    const dash = (v: React.ReactNode) => (total === 0 ? '—' : v);

    return (
        <section className="flex flex-col gap-3" aria-label="Financial impact and ROI">
            <SectionHeader
                title="Financial impact & ROI"
                subtitle="What your assistant is worth — last 30 days"
                icon="payments"
                right={
                    <button
                        onClick={() => setShowCalibrate(v => !v)}
                        aria-expanded={showCalibrate}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                    >
                        <span className="material-symbols-outlined text-[16px]">tune</span>
                        {showCalibrate ? 'Hide' : 'Calibrate'}
                    </button>
                }
            />

            {/* Calibrate drawer */}
            {showCalibrate && (
                <div className={cx(card, 'p-5')}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Cost per support ticket ($)</label>
                            <input
                                type="number" min="0" step="0.5"
                                value={costPerTicket}
                                onChange={e => setCostPerTicket(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[14px] tabular-nums text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                placeholder="5.00"
                            />
                            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Industry avg: $5–$25 per ticket</p>
                        </div>
                        <div>
                            <label className="block text-[12px] font-semibold text-slate-600 dark:text-slate-300 mb-1.5">Average lead value ($)</label>
                            <input
                                type="number" min="0" step="5"
                                value={leadValue}
                                onChange={e => setLeadValue(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-[14px] tabular-nums text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                placeholder="50.00"
                            />
                            <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-1">Estimate of one captured lead's worth</p>
                        </div>
                    </div>
                    <button
                        onClick={() => saveMutation.mutate()}
                        disabled={saveMutation.isPending}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 dark:bg-slate-100 px-4 py-2 text-[12.5px] font-semibold text-white dark:text-slate-900 disabled:opacity-50 transition-colors"
                    >
                        {saveMutation.isPending
                            ? <><span className="h-3 w-3 border-2 border-slate-400 border-t-white animate-spin rounded-full motion-reduce:animate-none" />Saving…</>
                            : saved ? <><span className="material-symbols-outlined text-[16px]">check</span>Saved</> : 'Save benchmarks'}
                    </button>
                </div>
            )}

            {/* KPI scorecard */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                    label="Support saved"
                    value={dash(fmtMoney(previewSavings))}
                    hint={`${fmtNum(stats.answered_queries_30d ?? 0)} queries answered`}
                    icon="support_agent"
                    tone="default"
                />
                <MetricCard
                    label="Potential revenue"
                    value={dash(fmtMoney(previewRevenue))}
                    hint={`${fmtNum(stats.leads_30d ?? 0)} leads captured`}
                    icon="trending_up"
                    tone="info"
                />
                <MetricCard
                    label="Proven revenue"
                    value={fmtMoney(realizedRevenue)}
                    hint={`${fmtNum(wonDeals)} closed-won deal${wonDeals !== 1 ? 's' : ''}`}
                    icon="verified"
                    tone="positive"
                />
                <MetricCard
                    label="Estimated total ROI"
                    value={dash(fmtMoney(previewTotal))}
                    hint={`${answerRate}% answer rate`}
                    icon="account_balance"
                    tone="accent"
                />
            </div>
        </section>
    );
};

export default ROIPanel;
