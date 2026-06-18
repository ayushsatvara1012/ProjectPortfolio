'use client';

import React, { useState } from 'react';
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
    selectedBot?: any;
}

const ActionCenterPanel = ({ selectedBotId, authFetch, isAuthorized, selectedBot }: ActionCenterPanelProps) => {
    const queryClient = useQueryClient();
    // Remembers which outcome the user clicked so the button registers green/red
    // before the lead drops out of the queue on refetch.
    const [acted, setActed] = useState<Record<string, 'won' | 'lost'>>({});
    const [enteringValueLeadId, setEnteringValueLeadId] = useState<string | null>(null);
    const [dealValueInput, setDealValueInput] = useState('');
    const [emailDraftLead, setEmailDraftLead] = useState<ActionLead | null>(null);
    const [copied, setCopied] = useState(false);

    const { data, isLoading, isError } = useQuery({
        queryKey: ['action-center', selectedBotId],
        queryFn: () => authFetch(`/api/leads/${selectedBotId}/action-center`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 30_000,
    });

    const outcomeMutation = useMutation({
        mutationFn: ({ leadId, status, valueUsd }: { leadId: string; status: string; valueUsd: number | null }) =>
            authFetch(`/api/leads/${selectedBotId}/${leadId}/outcome`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, value_usd: valueUsd }),
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
            <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl">
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4 animate-pulse">
                <div className={`${cellCls} p-6 h-24`} />
                {[1, 2, 3].map(i => <div key={i} className={`${cellCls} h-28`} />)}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col gap-4">
                <div className={`${cellCls} p-8 text-center border border-rose-100 dark:border-rose-900/30`}>
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

    const getEmailDraft = (lead: ActionLead) => {
        const leadName = lead.name || 'there';
        const context = lead.context ? `"${lead.context}"` : 'your questions';
        const botName = selectedBot?.bot_name || 'Vaayu AI';
        const companyName = selectedBot?.company_name || 'our company';

        const subject = `Following up on your inquiry with ${botName}`;
        const body = `Hi ${leadName},\n\n` +
            `Thanks for checking out our website and chatting with our AI assistant, ${botName}.\n\n` +
            `I saw you were asking about ${context}. I wanted to follow up personally to see if you have any other questions, or if we can help you with anything else.\n\n` +
            `Looking forward to hearing from you!\n\n` +
            `Best regards,\n` +
            `The team at ${companyName}`;

        return { subject, body };
    };

    const handleCopyDraft = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-3 transition-colors duration-500">
            {/* Slim header row */}
            <div className="flex items-center justify-between gap-3 flex-wrap px-1">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-400">bolt</span>
                    <h2 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Action Queue</h2>
                    <span className="hidden sm:inline text-xs font-google text-slate-400 dark:text-slate-500">· high-value leads requiring follow-up</span>
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
                <div className={`${cellCls} p-10 sm:p-14 flex flex-col items-center text-center border border-slate-100 dark:border-slate-800/40`}>
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
                    <div className={`${cellCls} overflow-hidden divide-y divide-slate-100 dark:divide-slate-800/50 border border-slate-100 dark:border-slate-800/40`}>
                        {queue.map(lead => {
                            const u = URGENCY[lead.urgency] || URGENCY.low;
                            const pending = outcomeMutation.isPending;
                            const isEnteringValue = enteringValueLeadId === lead.id;

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
                                    <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-auto min-h-[36px]">
                                        {isEnteringValue ? (
                                            <div className="flex items-center gap-1.5 animate-fade-in">
                                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700">
                                                    <span className="text-xs font-mono text-slate-400">$</span>
                                                    <input
                                                        type="number"
                                                        placeholder="Deal Value"
                                                        value={dealValueInput}
                                                        onChange={(e) => setDealValueInput(e.target.value)}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                const val = parseFloat(dealValueInput);
                                                                setActed(a => ({ ...a, [lead.id]: 'won' }));
                                                                outcomeMutation.mutate({
                                                                    leadId: lead.id,
                                                                    status: 'won',
                                                                    valueUsd: Number.isFinite(val) && val >= 0 ? val : 0
                                                                });
                                                                setEnteringValueLeadId(null);
                                                            } else if (e.key === 'Escape') {
                                                                setEnteringValueLeadId(null);
                                                            }
                                                        }}
                                                        disabled={pending}
                                                        className="w-16 bg-transparent text-xs font-mono focus:outline-none text-slate-900 dark:text-slate-100"
                                                        autoFocus
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const val = parseFloat(dealValueInput);
                                                        setActed(a => ({ ...a, [lead.id]: 'won' }));
                                                        outcomeMutation.mutate({
                                                            leadId: lead.id,
                                                            status: 'won',
                                                            valueUsd: Number.isFinite(val) && val >= 0 ? val : 0
                                                        });
                                                        setEnteringValueLeadId(null);
                                                    }}
                                                    disabled={pending}
                                                    className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setActed(a => ({ ...a, [lead.id]: 'won' }));
                                                        outcomeMutation.mutate({
                                                            leadId: lead.id,
                                                            status: 'won',
                                                            valueUsd: null
                                                        });
                                                        setEnteringValueLeadId(null);
                                                    }}
                                                    disabled={pending}
                                                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors disabled:opacity-50"
                                                >
                                                    Skip
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Open draft drafter instead of direct mailto link */}
                                                <button
                                                    type="button"
                                                    onClick={() => setEmailDraftLead(lead)}
                                                    className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline-none"
                                                    title="Draft Suggested Email"
                                                >
                                                    <span className="material-symbols-outlined text-[15px]">mail</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={pending}
                                                    onClick={() => {
                                                        setEnteringValueLeadId(lead.id);
                                                        setDealValueInput('');
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-google transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${acted[lead.id] === 'won' ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                                                >
                                                    Won
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={pending}
                                                    onClick={() => {
                                                        setActed(a => ({ ...a, [lead.id]: 'lost' }));
                                                        outcomeMutation.mutate({ leadId: lead.id, status: 'lost', valueUsd: null });
                                                    }}
                                                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold font-google transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 ${acted[lead.id] === 'lost' ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400'}`}
                                                >
                                                    Lost
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs font-google text-slate-400 dark:text-slate-500 text-center">
                        Won deals add to realized revenue · you can also edit values inside the Leads CRM section.
                    </p>
                </>
            )}

            {/* ── Suggested Email Draft Modal ── */}
            {emailDraftLead && (() => {
                const draft = getEmailDraft(emailDraftLead);
                const mailto = `mailto:${emailDraftLead.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-fade-in">
                        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl overflow-hidden flex flex-col">
                            {/* Modal Header */}
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-blue-500">auto_awesome</span>
                                    <span className="font-semibold text-slate-900 dark:text-slate-100">Suggested Follow-up Email</span>
                                </div>
                                <button
                                    onClick={() => setEmailDraftLead(null)}
                                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                >
                                    <span className="material-symbols-outlined">close</span>
                                </button>
                            </div>

                            {/* Modal Content */}
                            <div className="p-5 flex flex-col gap-4">
                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Recipient</label>
                                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm font-mono text-slate-700 dark:text-slate-300">
                                        {emailDraftLead.name ? `${emailDraftLead.name} <${emailDraftLead.email}>` : emailDraftLead.email}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Subject</label>
                                    <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm text-slate-700 dark:text-slate-300 font-medium">
                                        {draft.subject}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email Draft Body</label>
                                    <textarea
                                        readOnly
                                        rows={8}
                                        value={draft.body}
                                        className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-sm font-sans text-slate-700 dark:text-slate-300 border border-transparent focus:outline-none resize-none"
                                    />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => handleCopyDraft(`${draft.subject}\n\n${draft.body}`)}
                                    className="px-4 py-2 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[14px]">content_copy</span>
                                    {copied ? 'Copied!' : 'Copy Draft'}
                                </button>

                                <a
                                    href={mailto}
                                    onClick={() => setEmailDraftLead(null)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
                                >
                                    <span className="material-symbols-outlined text-[14px]">mail</span>
                                    Open Email App
                                </a>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ActionCenterPanel;
