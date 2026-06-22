'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import { Badge, badgeToneFor, Card, cx, EmptyState, SectionHeader } from '@/src/app/components/insights/ui';

const URGENCY = {
    high: { label: 'Act now', tone: 'hot' as const },
    medium: { label: 'Soon', tone: 'warm' as const },
    low: { label: 'Later', tone: 'neutral' as const },
} as const;

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
    const { user } = useUser();
    const userEmail = user?.primaryEmailAddress?.emailAddress || 'your-email@example.com';

    const [acted, setActed] = useState<Record<string, 'won' | 'lost'>>({});
    const [enteringValueLeadId, setEnteringValueLeadId] = useState<string | null>(null);
    const [dealValueInput, setDealValueInput] = useState('');
    const [emailDraftLead, setEmailDraftLead] = useState<ActionLead | null>(null);
    const [draftSubject, setDraftSubject] = useState('');
    const [draftBody, setDraftBody] = useState('');
    const [draftCc, setDraftCc] = useState('');
    const [copied, setCopied] = useState(false);
    const [showEmailProviders, setShowEmailProviders] = useState(false);

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

    useEffect(() => {
        if (emailDraftLead) {
            const draft = getEmailDraft(emailDraftLead);
            setDraftSubject(draft.subject);
            setDraftBody(draft.body);
            setDraftCc('');
            setCopied(false);
            setShowEmailProviders(false);
        }
    }, [emailDraftLead]); // eslint-disable-line react-hooks/exhaustive-deps

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
        return <Card className="p-6"><UpgradePrompt code="DEFAULT" tier="" mode="inline" /></Card>;
    }

    if (isLoading) {
        return (
            <Card className="overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800"><div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" /></div>
                {[1, 2, 3].map((i) => <div key={i} className="h-14 border-b border-slate-50 dark:border-slate-800/50" />)}
            </Card>
        );
    }

    if (isError) {
        return <Card><EmptyState icon="error" title="Couldn't load the action queue" hint="Please try again." /></Card>;
    }

    const queue: ActionLead[] = (data as any)?.queue || [];
    const counts = (data as any)?.counts || { high: 0, medium: 0, low: 0, total: 0 };

    const handleCopyDraft = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <Card className="overflow-hidden">
            {/* Header */}
            <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
                <SectionHeader title="Action queue" subtitle="Hot leads worth a follow-up right now" icon="bolt" />
                <div className="flex items-center gap-1.5 shrink-0">
                    {counts.high > 0 && <Badge tone="hot">{counts.high} urgent</Badge>}
                    {counts.medium > 0 && <Badge tone="warm">{counts.medium} soon</Badge>}
                </div>
            </div>

            {queue.length === 0 ? (
                <EmptyState icon="celebration" title="You're all caught up" hint="New hot leads will appear here the moment they come in." />
            ) : (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {queue.map((lead) => {
                        const u = URGENCY[lead.urgency] || URGENCY.low;
                        const pending = outcomeMutation.isPending;
                        const isEnteringValue = enteringValueLeadId === lead.id;
                        return (
                            <li key={lead.id} className="px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center gap-3 hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors">
                                {/* Identity */}
                                <div className="min-w-0 lg:w-[34%] lg:shrink-0">
                                    <div className="flex items-baseline gap-2 min-w-0">
                                        <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 truncate">{lead.name || lead.email}</span>
                                        {lead.name && <span className="text-[12px] text-slate-500 dark:text-slate-400 truncate">{lead.email}</span>}
                                    </div>
                                    {lead.context && <p className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate mt-0.5">“{lead.context}”</p>}
                                </div>

                                {/* Reason + badges */}
                                <div className="lg:flex-1 flex flex-wrap items-center gap-2 min-w-0">
                                    <span className="text-[12.5px] text-slate-600 dark:text-slate-300 truncate max-w-full">{lead.reason}</span>
                                    <Badge tone={u.tone}>{u.label}</Badge>
                                    {lead.band && <Badge tone={badgeToneFor(lead.band)}>{lead.band}</Badge>}
                                </div>

                                {/* Actions */}
                                <div className="shrink-0 flex items-center gap-2 self-end lg:self-auto">
                                    {isEnteringValue ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1">
                                                <span className="text-[12px] text-slate-400">$</span>
                                                <input
                                                    type="number" placeholder="Value" value={dealValueInput}
                                                    onChange={(e) => setDealValueInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') {
                                                            const val = parseFloat(dealValueInput);
                                                            setActed((a) => ({ ...a, [lead.id]: 'won' }));
                                                            outcomeMutation.mutate({ leadId: lead.id, status: 'won', valueUsd: Number.isFinite(val) && val >= 0 ? val : 0 });
                                                            setEnteringValueLeadId(null);
                                                        } else if (e.key === 'Escape') setEnteringValueLeadId(null);
                                                    }}
                                                    disabled={pending} autoFocus
                                                    className="w-16 bg-transparent text-[12px] tabular-nums text-slate-900 dark:text-slate-100 focus:outline-none"
                                                />
                                            </div>
                                            <button onClick={() => { const val = parseFloat(dealValueInput); setActed((a) => ({ ...a, [lead.id]: 'won' })); outcomeMutation.mutate({ leadId: lead.id, status: 'won', valueUsd: Number.isFinite(val) && val >= 0 ? val : 0 }); setEnteringValueLeadId(null); }} disabled={pending} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors disabled:opacity-50">Save</button>
                                            <button onClick={() => { setActed((a) => ({ ...a, [lead.id]: 'won' })); outcomeMutation.mutate({ leadId: lead.id, status: 'won', valueUsd: null }); setEnteringValueLeadId(null); }} disabled={pending} className="rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50">Skip</button>
                                        </div>
                                    ) : (
                                        <>
                                            <button type="button" onClick={() => setEmailDraftLead(lead)} title="Draft follow-up email" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                                <span className="material-symbols-outlined text-[16px]">mail</span>
                                            </button>
                                            <button type="button" disabled={pending} onClick={() => { setEnteringValueLeadId(lead.id); setDealValueInput(''); }} className={cx('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50', acted[lead.id] === 'won' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-400')}>Won</button>
                                            <button type="button" disabled={pending} onClick={() => { setActed((a) => ({ ...a, [lead.id]: 'lost' })); outcomeMutation.mutate({ leadId: lead.id, status: 'lost', valueUsd: null }); }} className={cx('rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors disabled:opacity-50', acted[lead.id] === 'lost' ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-rose-400 hover:text-rose-600 dark:hover:text-rose-400')}>Lost</button>
                                        </>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            )}

            {queue.length > 0 && (
                <p className="px-5 py-2.5 text-[11.5px] text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-800">
                    Won deals add to realized revenue · edit values in the Leads CRM below
                </p>
            )}

            {/* Email Draft Modal */}
            {emailDraftLead && (() => {
                const toStr = encodeURIComponent(emailDraftLead.email);
                const ccStr = encodeURIComponent(draftCc);
                const subStr = encodeURIComponent(draftSubject);
                const bodyStr = encodeURIComponent(draftBody);
                const authUserStr = encodeURIComponent(userEmail);
                const mailto = `mailto:${emailDraftLead.email}?cc=${ccStr}&subject=${subStr}&body=${bodyStr}`;
                const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${toStr}&cc=${ccStr}&su=${subStr}&body=${bodyStr}&authuser=${authUserStr}`;
                const outlookUrl = `https://outlook.live.com/mail/0/deeplink/compose?to=${toStr}&cc=${ccStr}&subject=${subStr}&body=${bodyStr}`;
                const yahooUrl = `https://compose.mail.yahoo.com/?to=${toStr}&cc=${ccStr}&subject=${subStr}&body=${bodyStr}`;

                return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4" role="dialog" aria-modal="true" aria-label="Compose follow-up email">
                        <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[800px]">
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-blue-500">auto_awesome</span>
                                    <span className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">AI-drafted follow-up</span>
                                </div>
                                <button onClick={() => setEmailDraftLead(null)} aria-label="Close" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>

                            <div className="flex flex-col flex-1 overflow-hidden">
                                <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                                    <span className="text-slate-400 text-[13px] w-16">From</span>
                                    <div className="flex-1 text-[14px] text-slate-500 dark:text-slate-400 truncate">{userEmail}</div>
                                </div>
                                <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                                    <span className="text-slate-400 text-[13px] w-16">To</span>
                                    <div className="flex-1 text-[14px] font-medium text-slate-800 dark:text-slate-200 truncate">{emailDraftLead.name ? `${emailDraftLead.name} <${emailDraftLead.email}>` : emailDraftLead.email}</div>
                                </div>
                                <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                                    <span className="text-slate-400 text-[13px] w-16">Cc</span>
                                    <input value={draftCc} onChange={(e) => setDraftCc(e.target.value)} placeholder="Add Cc…" className="flex-1 bg-transparent text-[14px] text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                                </div>
                                <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3">
                                    <span className="text-slate-400 text-[13px] w-16">Subject</span>
                                    <input value={draftSubject} onChange={(e) => setDraftSubject(e.target.value)} placeholder="Email subject…" className="flex-1 bg-transparent text-[14px] font-semibold text-slate-900 dark:text-slate-100 focus:outline-none placeholder:text-slate-400 dark:placeholder:text-slate-600" />
                                </div>
                                <div className="flex-1 p-6 overflow-hidden">
                                    <textarea value={draftBody} onChange={(e) => setDraftBody(e.target.value)} placeholder="Write your email here…" className="w-full h-full bg-transparent text-[14.5px] leading-relaxed text-slate-700 dark:text-slate-300 focus:outline-none resize-none custom-scrollbar" />
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3 bg-slate-50/50 dark:bg-slate-900">
                                <button type="button" onClick={() => handleCopyDraft(`${draftSubject}\n\n${draftBody}`)} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2 text-[13px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <span className="material-symbols-outlined text-[16px]">content_copy</span>{copied ? 'Copied!' : 'Copy draft'}
                                </button>
                                <div className="relative">
                                    <button type="button" onClick={() => setShowEmailProviders((p) => !p)} aria-expanded={showEmailProviders} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-5 py-2 text-[13px] font-semibold text-white transition-colors">
                                        <span className="material-symbols-outlined text-[16px]">send</span>Send via…
                                        <span className="material-symbols-outlined text-[16px]">{showEmailProviders ? 'expand_more' : 'expand_less'}</span>
                                    </button>
                                    {showEmailProviders && (
                                        <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-10 flex flex-col py-1">
                                            {[{ href: gmailUrl, icon: 'mail', label: 'Gmail' }, { href: outlookUrl, icon: 'forward_to_inbox', label: 'Outlook' }, { href: yahooUrl, icon: 'email', label: 'Yahoo Mail' }].map((p) => (
                                                <a key={p.label} href={p.href} target="_blank" rel="noopener noreferrer" onClick={() => setEmailDraftLead(null)} className="px-4 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">{p.icon}</span>{p.label}
                                                </a>
                                            ))}
                                            <div className="h-px bg-slate-100 dark:bg-slate-700 my-1" />
                                            <a href={mailto} onClick={() => setEmailDraftLead(null)} className="px-4 py-2 text-[13px] text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                                                <span className="material-symbols-outlined text-[16px]">devices</span>Default mail app
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </Card>
    );
};

export default ActionCenterPanel;
