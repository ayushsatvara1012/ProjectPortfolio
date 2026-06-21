'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

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

const STATUS_OPTIONS = ['new', 'contacted', 'won', 'lost'] as const;

const STATUS_STYLES: Record<string, string> = {
    new:       'text-slate-500 border-slate-200 dark:border-slate-700',
    contacted: 'text-blue-500  border-blue-200  dark:border-blue-800',
    won:       'text-emerald-600 border-emerald-200 dark:border-emerald-800',
    lost:      'text-slate-400 border-slate-200 dark:border-slate-700',
};

const STATUS_DOT: Record<string, string> = {
    new:       'bg-slate-400',
    contacted: 'bg-blue-400',
    won:       'bg-emerald-500',
    lost:      'bg-slate-300',
};

const fmtMoney = (n: number) => '$' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

// Dot + band label (no background)
const ScoreBadge = ({ score, band, reasons }: { score: number | null; band: string | null; reasons?: string[] }) => {
    if (score === null || score === undefined || !band) {
        return <span className="text-[10px] font-mono text-slate-300 dark:text-slate-600">—</span>;
    }
    return (
        <span title={reasons && reasons.length ? reasons.join(' · ') : undefined} className="inline-flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${BAND_DOT[band] || 'bg-slate-400'}`} />
            <span className={`text-[10px] font-mono uppercase tracking-wider ${BAND_TEXT[band] || 'text-slate-400'}`}>{band} · {score}</span>
        </span>
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
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 relative">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[status] || 'bg-slate-400'}`} />
                    <select
                        value={status}
                        onChange={e => handleStatusChange(lead, e.target.value)}
                        disabled={outcomeMutation.isPending}
                        aria-label="Lead status"
                        className={`appearance-none cursor-pointer pl-1 pr-5 py-0.5 rounded-sm border text-[10px] font-mono uppercase tracking-wider bg-transparent focus:outline-none disabled:opacity-50 ${STATUS_STYLES[status]}`}
                    >
                        {STATUS_OPTIONS.map(s => (
                            <option key={s} value={s} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-200 normal-case tracking-normal">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                        ))}
                    </select>
                    <span className="material-symbols-outlined absolute right-0 top-1/2 -translate-y-1/2 text-[12px] opacity-50 pointer-events-none">expand_more</span>
                </div>
                {status === 'won' && (
                    <div className="flex items-center gap-1 min-w-0">
                        <span className="text-[10px] font-mono text-slate-400">$</span>
                        <input
                            type="number" min="0" step="any" inputMode="decimal"
                            value={valueDraft[lead.id] ?? (lead.value_usd ?? '')}
                            onChange={e => setValueDraft(prev => ({ ...prev, [lead.id]: e.target.value }))}
                            onBlur={() => { if (valueDraft[lead.id] !== undefined) handleSaveValue(lead); }}
                            onKeyDown={e => {
                                if (e.key === 'Enter') { handleSaveValue(lead); (e.target as HTMLInputElement).blur(); }
                                else if (e.key === 'Escape') { setValueDraft(prev => { const n = { ...prev }; delete n[lead.id]; return n; }); (e.target as HTMLInputElement).blur(); }
                            }}
                            placeholder="0"
                            aria-label="Deal value in USD"
                            className="w-16 min-w-0 px-1.5 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-sm text-[10px] font-mono text-slate-900 dark:text-slate-200 focus:outline-none"
                        />
                        <button onClick={() => handleSaveValue(lead)} disabled={outcomeMutation.isPending} title="Save deal value"
                            className="w-5 h-5 flex items-center justify-center rounded-sm text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 disabled:opacity-50 transition-colors">
                            <span className="material-symbols-outlined text-[12px]">check</span>
                        </button>
                    </div>
                )}
            </div>
        );
    };

    if (!isAuthorized) {
        return <div className="p-6"><UpgradePrompt code="DEFAULT" tier="" mode="inline" /></div>;
    }

    if (isLoading) {
        return (
            <div className="border border-slate-100 dark:border-slate-800 rounded-md animate-pulse flex flex-col divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                <div className="px-4 py-2.5 flex gap-3">
                    <div className="h-3 bg-slate-100 dark:bg-slate-800 w-24 rounded" />
                </div>
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10" />)}
            </div>
        );
    }

    const leads = (leadsData as any)?.leads || [];
    const total = (leadsData as any)?.total || 0;
    const pages = (leadsData as any)?.pages || 1;

    return (
        <div className="flex flex-col border border-slate-100 dark:border-slate-800 rounded-md bg-white dark:bg-slate-900 overflow-hidden transition-colors duration-500">
            {/* Header / Actions */}
            <div className="px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-widest font-mono text-slate-400">Total Leads: {total}</span>
                </div>
                {(total > 0 || band !== 'all' || statusFilter !== 'all') && (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {/* Status filter */}
                        <div className="relative">
                            <select
                                value={statusFilter}
                                onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
                                aria-label="Filter by pipeline status"
                                className="appearance-none cursor-pointer pl-2 pr-6 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none transition-colors"
                            >
                                <option value="all" className="normal-case tracking-normal">All statuses</option>
                                {STATUS_OPTIONS.map(s => (
                                    <option key={s} value={s} className="normal-case tracking-normal">{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                ))}
                            </select>
                            <span className="material-symbols-outlined absolute right-1 top-1/2 -translate-y-1/2 text-[12px] text-slate-400 pointer-events-none">expand_more</span>
                        </div>
                        {/* Band filter */}
                        {(['all', 'HOT', 'WARM', 'COLD'] as const).map(b => (
                            <button
                                key={b}
                                onClick={() => { setBand(b); setPage(1); }}
                                className={`px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm transition-colors ${band === b
                                    ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900'
                                    : 'border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                            >{b === 'all' ? 'All' : b}</button>
                        ))}
                        {/* Sort toggle */}
                        <button
                            onClick={() => { setSort(s => s === 'score' ? 'recent' : 'score'); setPage(1); }}
                            className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded-sm border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 transition-colors"
                            title="Toggle sort order"
                        >
                            <span className="material-symbols-outlined text-[12px]">sort</span>{sort === 'score' ? 'Score' : 'Recent'}
                        </button>
                        {/* Export icon-only button */}
                        <button
                            onClick={handleExport}
                            title="Export CSV"
                            className="w-7 h-7 flex items-center justify-center border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="text-[13px] font-mono">↓</span>
                        </button>
                    </div>
                )}
            </div>

            {/* Mobile card list */}
            {leads.length === 0 ? (
                <div className="py-8 text-center">
                    <p className="text-sm italic text-slate-400 dark:text-slate-500">
                        {band !== 'all' ? `No ${band.toLowerCase()} leads` : statusFilter !== 'all' ? `No ${statusFilter} leads` : 'Once your bot triggers the lead form, contacts will appear here.'}
                    </p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Mobile cards */}
                    <div className="sm:hidden flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/50">
                        {leads.map((lead: any) => (
                            <div key={lead.id} className="px-3 py-3 flex flex-col gap-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-col gap-0.5 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold font-mono text-sm text-slate-900 dark:text-slate-100 break-all">{lead.email}</span>
                                            <ScoreBadge score={lead.score} band={lead.band} reasons={lead.reasons} />
                                        </div>
                                        {lead.name && <span className="text-[11px] font-mono text-slate-400">{lead.name}</span>}
                                    </div>
                                    {deleteConfirm === lead.id ? (
                                        <div className="flex flex-col items-end gap-1 shrink-0">
                                            <span className="text-[10px] font-mono text-rose-500 uppercase animate-pulse">Confirm?</span>
                                            <div className="flex gap-1.5">
                                                <button onClick={() => deleteMutation.mutate(lead.id)} disabled={deleteMutation.isPending} className="text-[10px] font-mono text-white bg-rose-500 hover:bg-rose-600 px-2 py-1 rounded-sm disabled:opacity-50 min-h-[28px]">Yes</button>
                                                <button onClick={() => setDeleteConfirm(null)} className="text-[10px] font-mono text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 min-h-[28px]">Cancel</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button onClick={() => setDeleteConfirm(lead.id)} className="w-7 h-7 rounded-sm flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all shrink-0" title="Delete Lead">
                                            <span className="material-symbols-outlined text-[14px]">delete</span>
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 shrink-0">Status</span>
                                    {renderStatusCell(lead)}
                                </div>
                                {lead.context && (
                                    <p className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded-sm border border-slate-100 dark:border-slate-700 leading-snug break-words">{lead.context}</p>
                                )}
                                <span className="text-[10px] font-mono text-slate-400">
                                    {new Date(lead.created_at).toLocaleDateString()} · {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:flex flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[940px]">
                            <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 transition-colors">
                                <tr>
                                    <th className="px-4 py-2 text-[10px] uppercase tracking-widest font-mono text-slate-400 border-r border-slate-100 dark:border-slate-800/50 w-[24%]">Contact Details</th>
                                    <th className="px-4 py-2 text-[10px] uppercase tracking-widest font-mono text-slate-400 border-r border-slate-100 dark:border-slate-800/50 w-[11%]">Lead Quality</th>
                                    <th className="px-4 py-2 text-[10px] uppercase tracking-widest font-mono text-slate-400 border-r border-slate-100 dark:border-slate-800/50 w-[16%]">Deal Stage & Value</th>
                                    <th className="px-4 py-2 text-[10px] uppercase tracking-widest font-mono text-slate-400 border-r border-slate-100 dark:border-slate-800/50 w-[26%]">What they were looking for</th>
                                    <th className="px-4 py-2 text-[10px] uppercase tracking-widest font-mono text-slate-400 border-r border-slate-100 dark:border-slate-800/50 w-[13%]">Captured</th>
                                    <th className="px-4 py-2 text-[10px] uppercase tracking-widest font-mono text-slate-400 text-center w-[10%]">Remove</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                                {leads.map((lead: any) => (
                                    <tr key={lead.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/20 transition-colors">
                                        <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800/50 align-top">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-slate-100 break-all">{lead.email}</span>
                                                {lead.name && <span className="text-[11px] font-mono text-slate-400">{lead.name}</span>}
                                            </div>
                                        </td>
                                        <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800/50 align-top">
                                            <ScoreBadge score={lead.score} band={lead.band} reasons={lead.reasons} />
                                        </td>
                                        <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800/50 align-top min-w-0">
                                            {renderStatusCell(lead)}
                                        </td>
                                        <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800/50 align-top">
                                            <p className="text-xs font-mono text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-900/30 px-2 py-1 rounded-sm leading-snug break-words">
                                                {lead.context || '—'}
                                            </p>
                                        </td>
                                        <td className="px-4 py-2.5 border-r border-slate-100 dark:border-slate-800/50 align-top">
                                            <span className="text-[10px] font-mono text-slate-400 whitespace-nowrap">
                                                {new Date(lead.created_at).toLocaleDateString()}<br />
                                                {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-center align-top">
                                            {deleteConfirm === lead.id ? (
                                                <div className="flex flex-col items-center gap-1.5">
                                                    <span className="text-[10px] font-mono text-rose-500 uppercase animate-pulse">Confirm?</span>
                                                    <div className="flex gap-1.5">
                                                        <button onClick={() => deleteMutation.mutate(lead.id)} disabled={deleteMutation.isPending} className="text-[10px] font-mono text-white bg-rose-500 hover:bg-rose-600 px-2 py-0.5 rounded-sm disabled:opacity-50 min-h-[24px]">Yes</button>
                                                        <button onClick={() => setDeleteConfirm(null)} className="text-[10px] font-mono text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-0.5 min-h-[24px]">No</button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button onClick={() => setDeleteConfirm(lead.id)} className="w-7 h-7 rounded-sm flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all mx-auto" title="Delete Lead">
                                                    <span className="material-symbols-outlined text-[14px]">delete</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {pages > 1 && leads.length > 0 && (
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-30 transition-colors min-h-[28px]">← Prev</button>
                    <span className="text-[10px] font-mono text-slate-400">Page {page} of {pages}</span>
                    <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages} className="text-[10px] font-mono uppercase tracking-wider text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-30 transition-colors min-h-[28px]">Next →</button>
                </div>
            )}
        </div>
    );
};

export default LeadsPanel;
