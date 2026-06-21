'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@clerk/nextjs';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

// Urgency → dot color only (no pill background)
const URGENCY = {
    high:   { label: 'Act now', dot: 'bg-rose-500',   text: 'text-rose-400' },
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
    HOT:  'text-rose-400',
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

    useEffect(() => {
        if (emailDraftLead) {
            const draft = getEmailDraft(emailDraftLead);
            setDraftSubject(draft.subject);
            setDraftBody(draft.body);
            setDraftCc('');
            setCopied(false);
            setShowEmailProviders(false);
        }
    }, [emailDraftLead]);

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
        <div className="flex flex-col gap-3 transition-colors duration-500 w-full">
            {/* Header */}
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 px-5 py-3 border border-slate-200 dark:border-slate-800 rounded-t-xl shadow-sm border-b-0">
                <span className="text-sm tracking-normal font-semibold text-slate-800 dark:text-slate-200 font-sans">Action Queue</span>
                <span className="text-xs font-sans text-slate-400">{counts.total}</span>
                {counts.high > 0 && (
                    <span className="flex items-center gap-1 text-xs font-sans font-medium text-rose-500 dark:text-rose-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 inline-block" />{counts.high} urgent
                    </span>
                )}
                {counts.medium > 0 && (
                    <span className="flex items-center gap-1 text-xs font-sans font-medium text-amber-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />{counts.medium} soon
                    </span>
                )}
            </div>

            {queue.length === 0 ? (
                <div className="py-8 text-center border border-slate-200 dark:border-slate-800 rounded-b-xl bg-white dark:bg-slate-900 shadow-sm">
                    <p className="text-sm text-slate-500 dark:text-slate-400">You&apos;re all caught up.</p>
                    <p className="text-xs font-sans text-slate-400 mt-1">New hot leads will appear here the moment they come in.</p>
                </div>
            ) : (
                <>
                    {/* Dense divided list */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-b-xl shadow-sm divide-y divide-slate-100 dark:divide-slate-800/50 transition-colors duration-500 overflow-hidden">
                        {queue.map(lead => {
                            const u = URGENCY[lead.urgency] || URGENCY.low;
                            const pending = outcomeMutation.isPending;
                            const isEnteringValue = enteringValueLeadId === lead.id;

                            return (
                                <div key={lead.id} className="px-5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                    {/* Identity */}
                                    <div className="min-w-0 w-full sm:w-[32%] sm:shrink-0">
                                        <div className="flex items-baseline gap-2 min-w-0">
                                            <span className="text-sm font-semibold text-slate-900 dark:text-slate-200 truncate max-w-[55%] shrink-0">{lead.name || lead.email}</span>
                                            {lead.name && <span className="text-xs font-sans text-slate-500 truncate">{lead.email}</span>}
                                        </div>
                                        {lead.context && <p className="text-xs font-sans text-slate-500 truncate mt-0.5">"{lead.context}"</p>}
                                    </div>

                                    {/* Reason · Urgency dot · Band dot */}
                                    <div className="w-full sm:flex-1 flex flex-wrap sm:grid sm:grid-cols-3 items-center gap-x-3 gap-y-1">
                                        <span className="text-xs text-slate-600 dark:text-slate-400 truncate">{lead.reason}</span>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-1.5 h-1.5 rounded-full ${u.dot}`} />
                                            <span className={`text-xs font-sans uppercase tracking-wider font-semibold ${u.text}`}>{u.label}</span>
                                        </div>
                                        {lead.band && (
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${BAND_DOT[lead.band] || 'bg-slate-400'}`} />
                                                <span className={`text-xs font-sans uppercase tracking-wider font-semibold ${BAND_TEXT[lead.band] || 'text-slate-400'}`}>{lead.band}</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="shrink-0 flex items-center gap-2 self-end sm:self-auto min-h-[36px]">
                                        {isEnteringValue ? (
                                            <div className="flex items-center gap-2">
                                                <div className="flex items-center gap-1 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm px-2 py-1">
                                                    <span className="text-xs font-sans text-slate-400">$</span>
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
                                                        className="w-16 bg-transparent text-xs font-sans focus:outline-none text-slate-900 dark:text-slate-100 tabular-nums"
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
                                                    className="px-3 py-1 rounded-md shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-sans font-semibold transition-colors disabled:opacity-50 min-h-[32px]"
                                                >Save</button>
                                                <button
                                                    onClick={() => {
                                                        setActed(a => ({ ...a, [lead.id]: 'won' }));
                                                        outcomeMutation.mutate({ leadId: lead.id, status: 'won', valueUsd: null });
                                                        setEnteringValueLeadId(null);
                                                    }}
                                                    disabled={pending}
                                                    className="px-3 py-1 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-xs font-sans font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors disabled:opacity-50 min-h-[32px]"
                                                >Skip</button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => setEmailDraftLead(lead)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm"
                                                    title="Draft suggested email"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">mail</span>
                                                </button>
                                                <button
                                                    type="button" disabled={pending}
                                                    onClick={() => { setEnteringValueLeadId(lead.id); setDealValueInput(''); }}
                                                    className={`px-3 py-1 rounded-md shadow-sm border text-xs font-semibold font-sans transition-colors disabled:opacity-50 min-h-[32px] ${acted[lead.id] === 'won' ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-emerald-400 hover:text-emerald-500 dark:hover:text-emerald-400 bg-white dark:bg-slate-900'}`}
                                                >Won</button>
                                                <button
                                                    type="button" disabled={pending}
                                                    onClick={() => { setActed(a => ({ ...a, [lead.id]: 'lost' })); outcomeMutation.mutate({ leadId: lead.id, status: 'lost', valueUsd: null }); }}
                                                    className={`px-3 py-1 rounded-md shadow-sm border text-xs font-semibold font-sans transition-colors disabled:opacity-50 min-h-[32px] ${acted[lead.id] === 'lost' ? 'bg-rose-500 border-rose-500 text-white' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-rose-400 hover:text-rose-500 bg-white dark:bg-slate-900'}`}
                                                >Lost</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs font-sans text-slate-500 dark:text-slate-500 mt-2 px-1">
                        Won deals add to realized revenue · edit values in Leads CRM
                    </p>
                </>
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
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-3 sm:p-4">
                        <div className="w-full max-w-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[85vh] max-h-[800px]">
                            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-blue-500">auto_awesome</span>
                                    <span className="text-sm tracking-normal font-semibold font-sans text-slate-800 dark:text-slate-200">New Message</span>
                                </div>
                                <button onClick={() => setEmailDraftLead(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                    <span className="material-symbols-outlined text-[20px]">close</span>
                                </button>
                            </div>
                            
                            {/* Email Client Layout */}
                            <div className="flex flex-col flex-1 overflow-hidden bg-white dark:bg-slate-900">
                                <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3.5 transition-colors">
                                    <span className="text-slate-400 font-sans text-[13px] w-14">From:</span>
                                    <div className="flex-1 text-[14px] font-sans text-slate-500 dark:text-slate-400 font-medium truncate">
                                        {userEmail}
                                    </div>
                                </div>
                                <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3.5 transition-colors">
                                    <span className="text-slate-400 font-sans text-[13px] w-14">To:</span>
                                    <div className="flex-1 text-[14px] font-sans text-slate-800 dark:text-slate-200 font-medium truncate">
                                        {emailDraftLead.name ? `${emailDraftLead.name} <${emailDraftLead.email}>` : emailDraftLead.email}
                                    </div>
                                </div>
                                <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3.5 transition-colors">
                                    <span className="text-slate-400 font-sans text-[13px] w-14">Cc:</span>
                                    <input
                                        value={draftCc}
                                        onChange={e => setDraftCc(e.target.value)}
                                        placeholder="Add Cc..."
                                        className="flex-1 bg-transparent text-[14px] font-sans text-slate-800 dark:text-slate-200 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                                    />
                                </div>
                                <div className="flex items-center border-b border-slate-100 dark:border-slate-800 px-6 py-3.5 transition-colors">
                                    <span className="text-slate-400 font-sans text-[13px] w-14">Subject:</span>
                                    <input
                                        value={draftSubject}
                                        onChange={e => setDraftSubject(e.target.value)}
                                        placeholder="Email subject..."
                                        className="flex-1 bg-transparent text-[14px] font-sans text-slate-900 dark:text-slate-100 focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 font-semibold"
                                    />
                                </div>
                                <div className="flex flex-col flex-1 p-6 overflow-hidden">
                                    <textarea
                                        value={draftBody}
                                        onChange={e => setDraftBody(e.target.value)}
                                        className="w-full h-full bg-transparent text-[15px] leading-relaxed font-sans text-slate-700 dark:text-slate-300 focus:outline-none resize-none custom-scrollbar"
                                        placeholder="Write your email here..."
                                    />
                                </div>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end bg-slate-50/50 dark:bg-slate-900 transition-colors">
                                <div className="flex items-center justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={() => handleCopyDraft(`${draftSubject}\n\n${draftBody}`)}
                                        className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-lg text-[13px] font-sans hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                        {copied ? 'Copied!' : 'Copy Draft'}
                                    </button>
                                    
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => setShowEmailProviders(p => !p)}
                                            className="px-5 py-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-semibold rounded-lg text-[13px] font-sans flex items-center gap-2 transition-colors"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">send</span>
                                            Send via...
                                            <span className="material-symbols-outlined text-[16px]">{showEmailProviders ? 'expand_more' : 'expand_less'}</span>
                                        </button>

                                        {showEmailProviders && (
                                            <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden z-10 flex flex-col py-1 animate-in fade-in slide-in-from-bottom-2 duration-200">
                                                <a href={gmailUrl} target="_blank" rel="noopener noreferrer" onClick={() => setEmailDraftLead(null)} className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">mail</span> Gmail
                                                </a>
                                                <a href={outlookUrl} target="_blank" rel="noopener noreferrer" onClick={() => setEmailDraftLead(null)} className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">forward_to_inbox</span> Outlook
                                                </a>
                                                <a href={yahooUrl} target="_blank" rel="noopener noreferrer" onClick={() => setEmailDraftLead(null)} className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">email</span> Yahoo Mail
                                                </a>
                                                <div className="h-px bg-slate-100 dark:bg-slate-700 my-1"></div>
                                                <a href={mailto} onClick={() => setEmailDraftLead(null)} className="px-4 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 flex items-center gap-2 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">devices</span> Default Mail App
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}
        </div>
    );
};

export default ActionCenterPanel;
