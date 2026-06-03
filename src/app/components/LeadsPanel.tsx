'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

const BAND_STYLES: Record<string, string> = {
    HOT: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-900/40',
    WARM: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-900/40',
    COLD: 'text-slate-500 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800/40 dark:border-slate-700',
};

const ScoreBadge = ({ score, band, reasons }: { score: number | null; band: string | null; reasons?: string[] }) => {
    if (score === null || score === undefined || !band) {
        return (
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-300 dark:text-slate-600 font-google">
                Unscored
            </span>
        );
    }
    const cls = BAND_STYLES[band] || BAND_STYLES.COLD;
    return (
        <span
            title={reasons && reasons.length ? reasons.join(' · ') : undefined}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm border text-[10px] uppercase tracking-widest font-bold font-google whitespace-nowrap ${cls}`}
        >
            {band} · {score}
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
    const [sort, setSort] = useState('recent');   // 'recent' | 'score'
    const [band, setBand] = useState('all');       // 'all' | 'HOT' | 'WARM' | 'COLD'
    const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const { getToken } = useAuth();

    const { data: leadsData, isLoading } = useQuery({
        queryKey: ['leads', selectedBotId, page, sort, band],
        queryFn: () => authFetch(`/api/leads/${selectedBotId}?page=${page}&limit=50&sort=${sort}&band=${band}`),
        enabled: !!selectedBotId && isAuthorized,
        staleTime: 60_000,
    });

    const deleteMutation = useMutation({
        mutationFn: (leadId: string) => authFetch(`/api/leads/${selectedBotId}/${leadId}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['leads', selectedBotId] });
            setDeleteConfirm(null);
        },
    });

    const handleExport = async () => {
        try {
            const token = await getToken();
            const baseUrl = (typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL?.trim() || ''));
            const res = await fetch(`${baseUrl}/api/leads/${selectedBotId}/export`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error("Failed to export leads");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `leads_${selectedBotId.slice(0, 8)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error(error);
            alert("Export failed. Please try again.");
        }
    };

    if (!isAuthorized) {
        return (
            <div className="p-8">
                <UpgradePrompt code="DEFAULT" tier="" mode="inline" />
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className={`${cellCls} p-8 animate-pulse flex-1 flex flex-col gap-4`}>
                <div className="h-6 bg-slate-100 dark:bg-slate-800 w-48 mb-4"></div>
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-12 bg-slate-100 dark:bg-slate-800 w-full mb-1"></div>
                ))}
            </div>
        );
    }

    const leads = (leadsData as any)?.leads || [];
    const total = (leadsData as any)?.total || 0;
    const pages = (leadsData as any)?.pages || 1;

    return (
        <div className="flex flex-col gap-px bg-white dark:bg-slate-800 flex-1 transition-colors duration-500 overflow-hidden rounded-2xl">
            {/* Header / Actions */}
            <div className={`${cellCls} p-4 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-slate-800`}>
                <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-[18px] text-blue-500 dark:text-blue-400">group</span>
                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest">
                        Total Leads: {total}
                    </h2>
                </div>
                {(total > 0 || band !== 'all') && (
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Band filter */}
                        {(['all', 'HOT', 'WARM', 'COLD'] as const).map(b => (
                            <button
                                key={b}
                                onClick={() => { setBand(b); setPage(1); }}
                                className={`px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold font-google transition-colors rounded-sm ${band === b
                                    ? (b === 'HOT' ? 'bg-red-500 text-white'
                                        : b === 'WARM' ? 'bg-amber-500 text-white'
                                            : b === 'COLD' ? 'bg-slate-500 text-white'
                                                : 'bg-slate-900 dark:bg-blue-600 text-white')
                                    : 'border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900'}`}
                            >
                                {b === 'all' ? 'All' : b}
                            </button>
                        ))}
                        {/* Sort toggle */}
                        <button
                            onClick={() => { setSort(s => s === 'score' ? 'recent' : 'score'); setPage(1); }}
                            className="px-3 py-1.5 text-[11px] uppercase tracking-widest font-bold font-google rounded-sm border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900 flex items-center gap-1.5 transition-colors"
                            title="Toggle sort order"
                        >
                            <span className="material-symbols-outlined text-[14px]">sort</span>
                            {sort === 'score' ? 'Score' : 'Recent'}
                        </button>
                        <button
                            onClick={handleExport}
                            className="px-4 py-2 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-300 text-sm font-bold font-google uppercase tracking-widest flex items-center justify-center gap-2 transition-colors active:scale-95"
                        >
                            <span className="material-symbols-outlined text-[16px]">download</span>
                            Export CSV
                        </button>
                    </div>
                )}
            </div>

            {/* Leads Table or Empty State */}
            {leads.length === 0 ? (
                <div className={`${cellCls} flex-1 flex flex-col items-center justify-center p-12 text-center`}>
                    <div className="w-14 h-14 border-2 border-dashed border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-5">
                        <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600">inbox</span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2">
                        {band !== 'all' ? `No ${band.toLowerCase()} leads` : 'No leads captured yet'}
                    </h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
                        {band !== 'all'
                            ? 'No leads in this band yet. Try a different filter.'
                            : 'Once your bot triggers the lead form, contacts will appear here.'}
                    </p>
                </div>
            ) : (
                <div className={`${cellCls} flex-1 flex flex-col overflow-hidden`}>

                    {/* ── Mobile card list (hidden on sm+) ── */}
                    <div className="sm:hidden flex-1 overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-slate-800/50">
                        {leads.map((lead: any) => (
                            <div key={lead.id} className="p-4 flex flex-col gap-3">
                                {/* Contact row */}
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex flex-col gap-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-semibold font-google text-slate-900 dark:text-slate-100 text-md break-all">{lead.email}</span>
                                            <ScoreBadge score={lead.score} band={lead.band} reasons={lead.reasons} />
                                        </div>
                                        {lead.name && (
                                            <span className="text-sm text-slate-500 dark:text-slate-400 font-google tracking-wide">{lead.name}</span>
                                        )}
                                    </div>
                                    {/* Delete action */}
                                    {deleteConfirm === lead.id ? (
                                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                                            <span className="text-[10px] uppercase font-bold text-red-500 dark:text-red-400 animate-pulse">Confirm?</span>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => deleteMutation.mutate(lead.id)}
                                                    disabled={deleteMutation.isPending}
                                                    className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-sm disabled:opacity-50 transition-colors"
                                                >
                                                    Yes
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm(null)}
                                                    className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setDeleteConfirm(lead.id)}
                                            className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                            title="Delete Lead"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                        </button>
                                    )}
                                </div>

                                {/* Context */}
                                <div className="flex flex-col gap-1">
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google">Context / Query</span>
                                    <p className="text-sm font-google text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded-sm border border-slate-100 dark:border-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                                        {lead.context || "No context provided."}
                                    </p>
                                </div>

                                {/* Captured at */}
                                <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500">
                                    {new Date(lead.created_at).toLocaleDateString()} &middot; {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* ── Desktop table (hidden on mobile) ── */}
                    <div className="hidden sm:flex flex-1 overflow-x-auto overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900/90 shadow-sm transition-colors border-b border-gray-100 dark:border-slate-800 backdrop-blur-sm">
                                <tr>
                                    <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google border-r border-gray-100 dark:border-slate-800/50 w-[30%]">Contact Info</th>
                                    <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google border-r border-gray-100 dark:border-slate-800/50 w-[12%]">Score</th>
                                    <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google border-r border-gray-100 dark:border-slate-800/50 w-[33%]">Context / Query</th>
                                    <th className="px-6 py-4 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google border-r border-gray-100 dark:border-slate-800/50 w-[15%]">Captured At</th>
                                    <th className="px-4 py-4 text-[11px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google text-center w-[10%]">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/50">
                                {leads.map((lead: any) => (
                                    <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-slate-900/30 transition-colors">
                                        <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800/50 align-top">
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-bold font-google text-slate-900 dark:text-slate-100 text-md break-all">{lead.email}</span>
                                                {lead.name && <span className="text-md text-slate-500 dark:text-slate-400 font-mono tracking-wide">{lead.name}</span>}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800/50 align-top">
                                            <ScoreBadge score={lead.score} band={lead.band} reasons={lead.reasons} />
                                        </td>
                                        <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800/50 align-top">
                                            <p className="text-md font-google text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 p-2 rounded-sm border border-slate-100 dark:border-slate-800 leading-relaxed whitespace-pre-wrap break-words">
                                                {lead.context || "No context provided."}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800/50 align-top">
                                            <span className="text-sm font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                                {new Date(lead.created_at).toLocaleDateString()}
                                                <br/>
                                                {new Date(lead.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-center align-top">
                                            {deleteConfirm === lead.id ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <span className="text-[10px] uppercase font-bold text-red-500 dark:text-red-400 animate-pulse">Confirm?</span>
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => deleteMutation.mutate(lead.id)}
                                                            disabled={deleteMutation.isPending}
                                                            className="text-xs font-bold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-sm disabled:opacity-50 transition-colors"
                                                        >
                                                            Yes
                                                        </button>
                                                        <button
                                                            onClick={() => setDeleteConfirm(null)}
                                                            className="text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 px-2 py-1 transition-colors"
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => setDeleteConfirm(lead.id)}
                                                    className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all mx-auto"
                                                    title="Delete Lead"
                                                >
                                                    <span className="material-symbols-outlined text-[16px]">delete</span>
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
                <div className={`${cellCls} p-4 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between`}>
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-4 py-2 text-xs font-bold font-google uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                        &larr; Prev
                    </button>
                    <span className="text-xs font-mono text-slate-500 dark:text-slate-500">
                        Page {page} of {pages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(pages, p + 1))}
                        disabled={page === pages}
                        className="px-4 py-2 text-xs font-bold font-google uppercase tracking-widest text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-30 transition-colors"
                    >
                        Next &rarr;
                    </button>
                </div>
            )}
        </div>
    );
};

export default LeadsPanel;
