'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

// Urgency → dot color only (no pill background)
const URGENCY = {
    high:   { label: 'Act now', dot: 'bg-rose-500',   text: 'text-rose-500' },
    medium: { label: 'Soon',    dot: 'bg-amber-500',  text: 'text-amber-500' },
    low:    { label: 'Later',   dot: 'bg-slate-400',  text: 'text-slate-400' },
} as const;

// Band → dot color only (no pill background)
const BAND_DOT: Record<string, string> = {
    HOT:  'bg-rose-500',
    WARM: 'bg-amber-400',
    COLD: 'bg-slate-400',
};
const BAND_TEXT: Record<string, string> = {
    HOT:  'text-rose-500',
    WARM: 'text-amber-500',
    COLD: 'text-slate-400',
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
            queryClient.invalidateQueries({ queryKey: ['action-center', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['leads', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['roi-benchmarks', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['funnel', selectedBotId] });
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
            <div className="animate-pulse border border-slate-100 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800">
                <div className="px-4 py-2 flex items-center gap-2">
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 w-24 rounded" />
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 w-10 rounded" />
                </div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="px-4 py-2 h-9 bg-slate-50/50 dark:bg-slate-900/20" />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="py-6 text-center">
                <p className="text-sm text-slate-500 dark:text-slate-400">Couldn&apos;t load the Action Center. Please try again.</p>
            </div>
        );
    }

    const queue: ActionLead[] = (data as any)?.queue || [];
    const counts = (data as any)?.counts || { high: 0, medium: 0, low: 0, total: 0 };

    const getEmailDraft = (lead: ActionLead) => {
        const leadName = lead.name || 'there';
        const context = lead.context ? `"${lead.context}"` : 'your questions';
        const botName = selectedBot?.bot_name || 'Vaayu AI';
        const companyName = selectedBot?.company_name || 'our company';
        const subject = `Following up on your inquiry with ${botName}`;
        const body = `Hi ${leadName},\n\n` +
            `Thanks for checking out our website and chatting with our AI assistant, ${botName}.\n\n` +
            `I saw you were asking about ${context}. I wanted to follow up personally to see if you have any other questions, or if we can help you with anything else.\n\n` +
            `Looking forward to hearing from you!\n\nBest regards,\nThe team at ${companyName}`;
        return { subject, body };
    };

    const handleCopyDraft = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="flex flex-col gap-3 transition-colors duration-500">
            {/* Header */}
            <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-mono">Action Queue</span>
                <span className="text-[11px] font-mono text-slate-400">{counts.total}</span>
                {counts.high > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-rose-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />{counts.high} urgent
                    </span>
                )}
                {counts.medium > 0 && (
                    <span className="flex items-center gap-1 text-[10px] font-mono text-amber-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />{counts.medium} soon
                    </span>
                )}
            </div>

            {queue.length === 0 ? (
                <div className="py-8 text-center border border-slate-100 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900">
                    <p className="text-sm text-slate-500 dark:text-slate-400">You&apos;re all caught up.</p>
                    <p className="text-[11px] font-mono text-slate-400 mt-1">New hot leads will appear here the moment they come in.</p>
                </div>
            ) : (
                <>
                    {/* Dense divided list */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-md divide-y divide-slate-100 dark:divide-slate-800 transition-colors duration-500">
                        {queue.map(lead => {
                            const u = URGENCY[lead.urgency] || URGENCY.low;
                            const pending = outcomeMutation.isPending;
                            const isEnteringValue = enteringValueLeadId === lead.id;

                            return (
                                <div key={lead.id} className="px-4 py-2 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                    {/* Identity */}
                                    <div className="min-w-0 w-full sm:w-[32%] sm:shrink-0">
                                        <div className="flex items-baseline gap-2 min-w-0">
                                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[55%] shrink-0">{lead.name || lead.email}</span>
                                            {lead.name && <span className="text-[11px] font-mono text-slate-400 truncate">{lead.email}</span>}
                                        </div>
                                        {lead.context && <p className="text-[11px] font-mono text-slate-400 truncate mt-0.5">"{lead.context}"</p>}
                                    </div>

                                    {/* Reason · Urgency dot · Band dot */}
                                    <div className="w-full sm:flex-1 flex flex-wrap sm:grid sm:grid-cols-3 items-center gap-x-3 gap-y-0.5">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{lead.reason}</span>
                                        <div className="flex items-center gap-1">
                                            <span className={`w-1.5 h-1.5 rounded-full ${u.dot}`} />
                                            <span className={`text-[10px] font-mono uppercase tracking-wider ${u.text}`}>{u.label}</span>
                                        </div>
                                        {lead.band && (
                                            <div className="flex items-center gap-1">
                                                <span className={`w-1.5 h-1.5 rounded-full ${BAND_DOT[lead.band] || 'bg-slate-400'}`} />
                                                <span className={`text-[10px] font-mono uppercase tracking-wider ${BAND_TEXT[lead.band] || 'text-slate-400'}`}>{lead.band}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="shrink-0 flex items-center gap-1.5 self-end sm:self-auto min-h-[36px]">
                                        {isEnteringValue ? (
                                            <div className="flex items-center gap-1.5">
                                                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-sm px-2 py-1">
                                                    <span className="text-[11px] font-mono text-slate-400">$</span>
                                                    <input
                                                        type="number" placeholder="Value"
                                                        value={dealValueInput}
                                                        onChange={e => setDealValueInput(e.target.value)}
                                                        onKeyDown={e => {
                                                            if (e.key === 'Enter') {
                                                                const val = parseFloat(dealValueInput);
                                                                setActed(a => ({ ...a, [lead.id]: 'won' }));
                                                                outcomeMutation.mutate({ leadId: lead.id, status: 'won', valueUsd: Number.isFinite(val) && val >= 0 ? val : 0 });
                                                                setEnteringValueLeadId(null);
                                                            } else if (e.key === 'Escape') { setEnteringValueLeadId(null); }
                                                        }}
                                                        disabled={pending}
                                                        className="w-16 bg-transparent text-[11px] font-mono focus:outline-none text-slate-900 dark:text-slate-100"
                                                        autoFocus
                                                    />
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        const val = parseFloat(dealValueInput);
                                                        setActed(a => ({ ...a, [lead.id]: 'won' }));
                                                        outcomeMutation.mutate({ leadId: lead.id, status: 'won', valueUsd: Number.isFinite(val) && val >= 0 ? val : 0 });
                                                        setEnteringValueLeadId(null);
                                                    }}
                                                    disabled={pending}
                                                    className="px-2.5 py-1 rounded-sm bg-emerald-600 text-white text-[11px] font-mono transition-colors disabled:opacity-50 min-h-[28px]"
                                                >Save</button>
                                                <button
                                                    onClick={() => {
                                                        setActed(a => ({ ...a, [lead.id]: 'won' }));
                                                        outcomeMutation.mutate({ leadId: lead.id, status: 'won', valueUsd: null });
                                                        setEnteringValueLeadId(null);
                                                    }}
                                                    disabled={pending}
                                                    className="px-2.5 py-1 rounded-sm border border-slate-200 dark:border-slate-700 text-slate-500 text-[11px] font-mono hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 min-h-[28px]"
                                                >Skip</button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setEmailDraftLead(lead)}
                                                    className="w-7 h-7 flex items-center justify-center rounded-sm border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                    title="Draft suggested email"
                                                >
                                                    <span className="material-symbols-outlined text-[14px]">mail</span>
                                                </button>
                                                <button
                                                    type="button" disabled={pending}
                                                    onClick={() => { setEnteringValueLeadId(lead.id); setDealValueInput(''); }}
                                                    className={`px-2.5 py-1 rounded-sm border text-[11px] font-mono transition-colors disabled:opacity-50 min-h-[28px] ${acted[lead.id] === 'won' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400'}`}
                                                >Won</button>
                                                <button
                                                    type="button" disabled={pending}
                                                    onClick={() => { setActed(a => ({ ...a, [lead.id]: 'lost' })); outcomeMutation.mutate({ leadId: lead.id, status: 'lost', valueUsd: null }); }}
                                                    className={`px-2.5 py-1 rounded-sm border text-[11px] font-mono transition-colors disabled:opacity-50 min-h-[28px] ${acted[lead.id] === 'lost' ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-500'}`}
                                                >Lost</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 text-center">
                        Won deals add to realized revenue · edit values in Leads CRM
                    </p>
                </>
            )}

            {/* Email Draft Modal */}
            {emailDraftLead && (() => {
                const draft = getEmailDraft(emailDraftLead);
                const mailto = `mailto:${emailDraftLead.email}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
                        <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-md shadow-2xl overflow-hidden flex flex-col">
                            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                                <span className="text-[11px] uppercase tracking-widest font-mono text-slate-500">Suggested Follow-up Email</span>
                                <button onClick={() => setEmailDraftLead(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                    <span className="material-symbols-outlined text-[18px]">close</span>
                                </button>
                            </div>
                            <div className="p-4 flex flex-col gap-3">
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest font-mono text-slate-400 block mb-1">Recipient</label>
                                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-sm text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                                        {emailDraftLead.name ? `${emailDraftLead.name} <${emailDraftLead.email}>` : emailDraftLead.email}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest font-mono text-slate-400 block mb-1">Subject</label>
                                    <div className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 rounded-sm text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700">
                                        {draft.subject}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase tracking-widest font-mono text-slate-400 block mb-1">Email Draft</label>
                                    <textarea readOnly rows={7} value={draft.body}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-sm text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-100 dark:border-slate-700 focus:outline-none resize-none"
                                    />
                                </div>
                            </div>
                            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleCopyDraft(`${draft.subject}\n\n${draft.body}`)}
                                    className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-sm text-[11px] font-mono hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[13px]">content_copy</span>
                                    {copied ? 'Copied!' : 'Copy Draft'}
                                </button>
                                <a href={mailto} onClick={() => setEmailDraftLead(null)}
                                    className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-sm text-[11px] font-mono flex items-center gap-1 transition-colors hover:bg-slate-700 dark:hover:bg-slate-200"
                                >
                                    <span className="material-symbols-outlined text-[13px]">mail</span>
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
