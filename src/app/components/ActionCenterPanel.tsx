'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

const cellCls = 'bg-white dark:bg-white/[0.02] rounded-2xl transition-colors duration-500';

// Urgency → visual treatment (left accent, badge).
const URGENCY = {
    high: { label: 'Act now', accent: 'border-l-rose-500', badge: 'bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400', ring: 'text-rose-500' },
    medium: { label: 'Soon', accent: 'border-l-amber-400', badge: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-400', ring: 'text-amber-500' },
    low: { label: 'Later', accent: 'border-l-slate-300 dark:border-l-slate-600', badge: 'bg-slate-100 text-slate-500 dark:bg-white/[0.06] dark:text-slate-400', ring: 'text-slate-400' },
} as const;

const BAND_CHIP: Record<string, string> = {
    HOT: 'bg-rose-500 text-white',
    WARM: 'bg-amber-400 text-white',
    COLD: 'bg-sky-400 text-white',
};

type Urgency = keyof typeof URGENCY;

interface ActionLead {
    id: string;
    email: string;
    name?: string | null;
    context?: string | null;
    score: number;
    band: string | null;
    status: string;
    age_hours: number;
    urgency: Urgency;
    reason: string;
}

interface ActionCenterPanelProps {
    selectedBotId: string;
    authFetch: any;
    isAuthorized: boolean;
}

const ActionCenterPanel = ({ selectedBotId, authFetch, isAuthorized }: ActionCenterPanelProps) => {
    const queryClient = useQueryClient();
    // Remembers which outcome the user clicked so the button registers green/red
    // before the lead drops out of the queue on refetch.
    const [acted, setActed] = React.useState<Record<string, 'won' | 'lost'>>({});

    const { data, isLoading, isError } = useQuery({
        queryKey: ['action-center', selectedBotId],
        queryFn: () => authFetch(`/api/leads/${selectedBotId}/action-center`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 30_000,
    });

    const outcomeMutation = useMutation({
        mutationFn: ({ leadId, status }: { leadId: string; status: string }) =>
            authFetch(`/api/leads/${selectedBotId}/${leadId}/outcome`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, value_usd: null }),
            }),
        onSuccess: () => {
            // Refresh every surface the outcome touches.
            queryClient.invalidateQueries({ queryKey: ['action-center', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['leads', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['roi-benchmarks', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['funnel', selectedBotId] });
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
            <div className="flex flex-col gap-4 flex-1 transition-colors duration-500 md:p-8 animate-pulse">
                <div className={`${cellCls} p-6 h-24`} />
                {[1, 2, 3].map(i => <div key={i} className={`${cellCls} h-28`} />)}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col gap-4 flex-1 md:p-8">
                <div className={`${cellCls} p-8 text-center`}>
                    <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600">error_outline</span>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-2">Couldn&apos;t load the Action Center. Please try again.</p>
                </div>
            </div>
        );
    }

    const queue: ActionLead[] = (data as any)?.queue || [];
    const counts = (data as any)?.counts || { high: 0, medium: 0, low: 0, total: 0 };

    const summaryChip = (label: string, n: number, cls: string) => (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${cls}`}>
            <span className="text-sm font-google font-bold">{n}</span>
            <span className="text-xs font-google font-medium">{label}</span>
        </div>
    );

    return (
        <div className="flex flex-col gap-3 flex-1 transition-colors duration-500 overflow-y-auto custom-scrollbar md:p-8">

            {/* Slim header row */}
            <div className="flex items-center justify-between gap-3 flex-wrap px-1">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-400">bolt</span>
                    <h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Action Center</h2>
                    <span className="hidden sm:inline text-xs font-google text-slate-400 dark:text-slate-500">· your next actions, ranked</span>
                </div>
                {counts.total > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        {counts.high > 0 && summaryChip('Act now', counts.high, URGENCY.high.badge)}
                        {counts.medium > 0 && summaryChip('Soon', counts.medium, URGENCY.medium.badge)}
                        {counts.low > 0 && summaryChip('Later', counts.low, URGENCY.low.badge)}
                    </div>
                )}
            </div>

            {queue.length === 0 ? (
                <div className={`${cellCls} p-10 sm:p-14 flex flex-col items-center text-center`}>
                    <div className="w-12 h-12 flex items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-900/20">
                        <span className="material-symbols-outlined text-[22px] text-emerald-500">task_alt</span>
                    </div>
                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200 mt-4">You&apos;re all caught up</h3>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-1 max-w-sm">
                        No open leads need attention right now. New hot leads will appear here the moment they come in.
                    </p>
                </div>
            ) : (
                <>
                    {/* Dense divided list — one row per lead */}
                    <div className={`${cellCls} overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50`}>
                        {queue.map(lead => {
                            const u = URGENCY[lead.urgency] || URGENCY.low;
                            const mailto = `mailto:${lead.email}?subject=${encodeURIComponent('Following up on your enquiry')}`;
                            const pending = outcomeMutation.isPending;
                            return (
                                <div key={lead.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                    {/* Identity + context — left */}
                                    <div className="min-w-0 w-full sm:w-[32%] sm:shrink-0">
                                        <div className="flex items-baseline gap-2 min-w-0">
                                            <span className="text-sm font-google font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[55%] shrink-0">{lead.name || lead.email}</span>
                                            {lead.name && <span className="text-xs font-mono text-slate-500 dark:text-slate-400 truncate">{lead.email}</span>}
                                        </div>
                                        {lead.context && <p className="text-xs font-google text-slate-400 dark:text-slate-500 truncate mt-0.5">“{lead.context}”</p>}
                                    </div>

                                    {/* Three columns — reason · urgency · band, no partitions */}
                                    <div className="w-full sm:flex-1 grid grid-cols-3 items-center gap-3">
                                        <span className="text-[11px] font-google text-slate-500 dark:text-slate-400 truncate text-center">{lead.reason}</span>
                                        <div className="flex justify-center">
                                            <span className={`text-[10px] font-bold font-google uppercase tracking-widest px-2 py-0.5 rounded-md ${u.badge}`}>{u.label}</span>
                                        </div>
                                        <div className="flex justify-center">
                                            {lead.band && <span className={`text-[10px] font-bold font-google uppercase tracking-widest px-2 py-0.5 rounded-md ${BAND_CHIP[lead.band] || BAND_CHIP.COLD}`}>{lead.band}</span>}
                                        </div>
                                    </div>

                                    {/* Actions — right */}
                                    <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-auto">
                                        <a href={mailto} aria-label={`Email ${lead.email}`} className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
                                            <span className="material-symbols-outlined text-[15px]">mail</span>
                                        </a>
                                        <button type="button" disabled={pending} aria-label="Mark won"
                                            onClick={() => { setActed(a => ({ ...a, [lead.id]: 'won' })); outcomeMutation.mutate({ leadId: lead.id, status: 'won' }); }}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-google transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${acted[lead.id] === 'won' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}>
                                            Won
                                        </button>
                                        <button type="button" disabled={pending} aria-label="Dismiss as lost"
                                            onClick={() => { setActed(a => ({ ...a, [lead.id]: 'lost' })); outcomeMutation.mutate({ leadId: lead.id, status: 'lost' }); }}
                                            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-google transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${acted[lead.id] === 'lost' ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400'}`}>
                                            Lost
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs font-google text-slate-400 dark:text-slate-500 text-center">
                        Won deals add to realized revenue · set the exact deal value in the Leads CRM tab.
                    </p>
                </>
            )}
        </div>
    );
};

export default ActionCenterPanel;
