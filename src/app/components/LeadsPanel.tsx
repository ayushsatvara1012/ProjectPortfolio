'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import { Badge, badgeToneFor, Card, cx, EmptyState, fmtNum, Segmented } from '@/src/app/components/insights/ui';

const STATUS_OPTIONS = ['new', 'contacted', 'won', 'lost'] as const;
const STATUS_DOT: Record<string, string> = { new: 'bg-slate-400', contacted: 'bg-sky-500', won: 'bg-emerald-500', lost: 'bg-slate-300 dark:bg-slate-600' };

// Score badge: temperature tone + numeric score.
const ScoreBadge = ({ score, band, reasons }: { score: number | null; band: string | null; reasons?: string[] }) => {
    if (!score || !band) return <span className="text-[13px] text-slate-300 dark:text-slate-600">—</span>;
    return (
        <Badge tone={badgeToneFor(band)} title={reasons?.length ? reasons.join(' · ') : undefined}>
            {band} · {score}
        </Badge>
    );
};

interface LeadsPanelProps {
    selectedBotId: string;
    authFetch: any;
    isAuthorized: boolean;
}

const LeadsPanel = ({ selectedBotId, authFetch, isAuthorized }: LeadsPanelProps) => {
    const [page, setPage] = useState(1);
    const [sort, setSort] = useState('recent');
    const [band, setBand] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const [valueDraft, setValueDraft] = useState<Record<string, string>>({});
    const queryClient = useQueryClient();
    const { getToken } = useAuth();

    const { data: leadsData, isLoading } = useQuery({
        queryKey: ['leads', selectedBotId, page, sort, band, statusFilter],
        queryFn: () => authFetch(`/api/leads/${selectedBotId}?page=${page}&limit=50&sort=${sort}&band=${band}&status=${statusFilter}`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 60_000,
    });

    const deleteMutation = useMutation({
        mutationFn: (leadId: string) => authFetch(`/api/leads/${selectedBotId}/${leadId}`, { method: 'DELETE' }),
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['leads', selectedBotId] }); setDeleteConfirm(null); },
    });

    const outcomeMutation = useMutation({
        mutationFn: ({ leadId, status, value }: { leadId: string; status: string; value?: number | null }) =>
            authFetch(`/api/leads/${selectedBotId}/${leadId}/outcome`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status, value_usd: value ?? null }),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['roi-benchmarks', selectedBotId] });
        },
    });

    const handleStatusChange = (lead: any, newStatus: string) => {
        outcomeMutation.mutate({ leadId: lead.id, status: newStatus, value: newStatus === 'won' ? (lead.value_usd ?? 0) : null });
    };

    const handleSaveValue = (lead: any) => {
        const parsed = parseFloat(valueDraft[lead.id]);
        outcomeMutation.mutate({ leadId: lead.id, status: 'won', value: Number.isFinite(parsed) && parsed >= 0 ? parsed : 0 });
    };

    const handleExport = async () => {
        try {
            const token = await getToken();
            const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL?.trim() || '');
            const res = await fetch(`${baseUrl}/api/leads/${selectedBotId}/export`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error('Failed to export leads');
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `leads_${selectedBotId.slice(0, 8)}.csv`; a.click();
            URL.revokeObjectURL(url);
        } catch { alert('Export failed. Please try again.'); }
    };

    const renderStatusCell = (lead: any) => {
        const status = lead.status || 'new';
        return (
            <div className="flex flex-col gap-1.5">
                <div className="relative inline-flex items-center">
                    <span className={cx('absolute left-2.5 h-1.5 w-1.5 rounded-full pointer-events-none', STATUS_DOT[status])} />
                    <select
                        value={status}
                        onChange={(e) => handleStatusChange(lead, e.target.value)}
                        disabled={outcomeMutation.isPending}
                        aria-label="Lead status"
                        className="appearance-none cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-5 pr-7 py-1 text-[12px] font-semibold capitalize text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-50"
                    >
                        {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                    </select>
                    <span className="material-symbols-outlined absolute right-1 text-[14px] text-slate-400 pointer-events-none">expand_more</span>
                </div>
                {status === 'won' && (
                    <div className="flex items-center gap-1">
                        <span className="text-[12px] text-slate-400">$</span>
                        <input
                            type="number" min="0" step="any" inputMode="decimal"
                            value={valueDraft[lead.id] ?? (lead.value_usd ?? '')}
                            onChange={(e) => setValueDraft((p) => ({ ...p, [lead.id]: e.target.value }))}
                            onBlur={() => { if (valueDraft[lead.id] !== undefined) handleSaveValue(lead); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') { handleSaveValue(lead); (e.target as HTMLInputElement).blur(); }
                                else if (e.key === 'Escape') { setValueDraft((p) => { const n = { ...p }; delete n[lead.id]; return n; }); (e.target as HTMLInputElement).blur(); }
                            }}
                            placeholder="0"
                            aria-label="Deal value in USD"
                            className="w-20 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-2 py-1 text-[12px] tabular-nums text-right text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                        />
                        <button onClick={() => handleSaveValue(lead)} disabled={outcomeMutation.isPending} title="Save deal value" className="flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-50 transition-colors">
                            <span className="material-symbols-outlined text-[14px]">check</span>
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const DeleteCell = ({ lead, align = 'center' }: { lead: any; align?: 'center' | 'end' }) =>
        deleteConfirm === lead.id ? (
            <div className={cx('flex flex-col gap-1.5', align === 'center' ? 'items-center' : 'items-end')}>
                <span className="text-[11px] font-semibold uppercase text-rose-600 dark:text-rose-400">Delete?</span>
                <div className="flex gap-1.5">
                    <button onClick={() => deleteMutation.mutate(lead.id)} disabled={deleteMutation.isPending} className="rounded-md bg-rose-500 hover:bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-50">Yes</button>
                    <button onClick={() => setDeleteConfirm(null)} className="rounded-md px-2 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">No</button>
                </div>
            </div>
        ) : (
            <button onClick={() => setDeleteConfirm(lead.id)} title="Delete lead" className={cx('flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors', align === 'center' && 'mx-auto')}>
                <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
        );

    if (!isAuthorized) {
        return <Card className="p-6"><UpgradePrompt code="DEFAULT" tier="" mode="inline" /></Card>;
    }

    if (isLoading) {
        return (
            <Card className="overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800"><div className="h-4 w-28 rounded bg-slate-100 dark:bg-slate-800 animate-pulse motion-reduce:animate-none" /></div>
                {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-12 border-b border-slate-50 dark:border-slate-800/50" />)}
            </Card>
        );
    }

    const leads = (leadsData as any)?.leads || [];
    const total = (leadsData as any)?.total || 0;
    const pages = (leadsData as any)?.pages || 1;

    return (
        <Card className="flex flex-col overflow-hidden">
            {/* Header / Actions */}
            <div className="px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-slate-400">contacts</span>
                    <h3 className="text-[14px] font-semibold text-slate-900 dark:text-slate-100">{fmtNum(total)} lead{total !== 1 ? 's' : ''}</h3>
                </div>
                {(total > 0 || band !== 'all' || statusFilter !== 'all') && (
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                                aria-label="Filter by pipeline status"
                                className="appearance-none cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-7 py-1.5 text-[12px] font-semibold capitalize text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                            >
                                <option value="all">All statuses</option>
                                {STATUS_OPTIONS.map((s) => <option key={s} value={s} className="capitalize">{s}</option>)}
                            </select>
                            <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 pointer-events-none">expand_more</span>
                        </div>
                        <Segmented
                            ariaLabel="Filter by lead quality"
                            size="sm"
                            options={[{ value: 'all', label: 'All' }, { value: 'HOT', label: 'Hot' }, { value: 'WARM', label: 'Warm' }, { value: 'COLD', label: 'Cold' }]}
                            value={band}
                            onChange={(v) => { setBand(v); setPage(1); }}
                        />
                        <button
                            onClick={() => { setSort((s) => (s === 'score' ? 'recent' : 'score')); setPage(1); }}
                            title="Toggle sort order"
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="material-symbols-outlined text-[14px]">swap_vert</span>{sort === 'score' ? 'Score' : 'Recent'}
                        </button>
                        <button onClick={handleExport} title="Export CSV" className="inline-flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1.5 text-[12px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            <span className="material-symbols-outlined text-[14px]">download</span>CSV
                        </button>
                    </div>
                )}
            </div>

            {leads.length === 0 ? (
                <EmptyState
                    icon="person_search"
                    title={band !== 'all' ? `No ${band.toLowerCase()} leads` : statusFilter !== 'all' ? `No ${statusFilter} leads` : 'No leads captured yet'}
                    hint="When your assistant triggers the lead form, contacts will appear here."
                />
            ) : (
                <>
                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
                        {leads.map((lead: any) => (
                            <div key={lead.id} className="px-4 py-3.5 flex flex-col gap-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <p className="text-[14px] font-semibold text-slate-900 dark:text-slate-100 break-all">{lead.email}</p>
                                        {lead.name && <p className="text-[12px] text-slate-500 dark:text-slate-400">{lead.name}</p>}
                                    </div>
                                    <ScoreBadge score={lead.score} band={lead.band} reasons={lead.reasons} />
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">{renderStatusCell(lead)}</div>
                                {lead.context && <p className="text-[12.5px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 rounded-lg px-2.5 py-1.5 leading-snug break-words">{lead.context}</p>}
                                <div className="flex items-center justify-between">
                                    <span className="text-[11.5px] tabular-nums text-slate-400">{new Date(lead.created_at).toLocaleDateString()} · {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                    <DeleteCell lead={lead} align="end" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[920px]">
                            <thead className="bg-slate-50 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800">
                                <tr>
                                    {['Contact', 'Quality', 'Deal stage & value', 'What they wanted', 'Captured', ''].map((h, i) => (
                                        <th key={i} className={cx('px-4 py-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400', i === 5 && 'text-center')}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                                {leads.map((lead: any) => (
                                    <tr key={lead.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/30 transition-colors align-top">
                                        <td className="px-4 py-3">
                                            <p className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[200px]" title={lead.email}>{lead.email}</p>
                                            {lead.name && <p className="text-[12px] text-slate-500 dark:text-slate-400">{lead.name}</p>}
                                        </td>
                                        <td className="px-4 py-3"><ScoreBadge score={lead.score} band={lead.band} reasons={lead.reasons} /></td>
                                        <td className="px-4 py-3">{renderStatusCell(lead)}</td>
                                        <td className="px-4 py-3">
                                            <p className="text-[12.5px] text-slate-600 dark:text-slate-300 leading-snug break-words max-w-[260px]">{lead.context || '—'}</p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                {new Date(lead.created_at).toLocaleDateString()}<br />{new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center"><DeleteCell lead={lead} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {pages > 1 && leads.length > 0 && (
                <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/40">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30 transition-colors">← Prev</button>
                    <span className="text-[12px] tabular-nums text-slate-500 dark:text-slate-400">Page {page} of {pages}</span>
                    <button onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages} className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 disabled:opacity-30 transition-colors">Next →</button>
                </div>
            )}
        </Card>
    );
};

export default LeadsPanel;
