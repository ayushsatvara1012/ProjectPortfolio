'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Alert from '@/src/components/ui/Alert';
import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '@/src/lib/context/UserContext';
import UpgradePrompt from '@/src/components/features/UpgradePrompt';
import { useAuthenticatedFetch, useIsAuthReady, UpgradeError } from '@/src/lib/hooks/useAuthenticatedFetch';
import { trainUrlSchema, trainTextSchema } from '@/src/lib/validation/schemas';
import { Card, SectionHeader, Badge, ProgressBar, EmptyState, cx, fmtNum } from '@/src/components/dashboard/insights/ui';

/* ────────────────────────────────────────────────────────────────────────── */
/* Local design tokens — mirror the Insights MetricCard surface so the Train    */
/* AI stat strip is visually identical, while adding a progress-bar + footer    */
/* slot the KPI cards here need (storage / monthly usage).                      */
/* ────────────────────────────────────────────────────────────────────────── */

type Tone = 'default' | 'accent' | 'info' | 'warn' | 'positive';

const TONE: Record<Tone, { grad: string; ring: string; bar: string }> = {
    default: { grad: 'from-slate-100 via-slate-50 to-white dark:from-slate-700/40 dark:via-slate-800/30 dark:to-slate-900', ring: 'ring-slate-200/70 dark:ring-slate-700/60', bar: 'bg-gradient-to-r from-slate-500 to-slate-400 dark:from-slate-400 dark:to-slate-500' },
    accent: { grad: 'from-blue-100 via-blue-50 to-white dark:from-blue-900/40 dark:via-blue-950/20 dark:to-slate-900', ring: 'ring-blue-200/70 dark:ring-blue-900/50', bar: 'bg-gradient-to-r from-blue-600 to-blue-400' },
    info: { grad: 'from-sky-100 via-sky-50 to-white dark:from-sky-900/40 dark:via-sky-950/20 dark:to-slate-900', ring: 'ring-sky-200/70 dark:ring-sky-900/50', bar: 'bg-gradient-to-r from-sky-500 to-sky-400' },
    warn: { grad: 'from-amber-100 via-amber-50 to-white dark:from-amber-900/40 dark:via-amber-950/20 dark:to-slate-900', ring: 'ring-amber-200/70 dark:ring-amber-900/50', bar: 'bg-gradient-to-r from-amber-500 to-amber-400' },
    positive: { grad: 'from-emerald-100 via-emerald-50 to-white dark:from-emerald-900/40 dark:via-emerald-950/20 dark:to-slate-900', ring: 'ring-emerald-200/70 dark:ring-emerald-900/50', bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400' },
};

// Fine fractal-noise grain — same overlay the Insights cards use so the tinted
// gradients read as a tactile, premium surface rather than a flat fill.
const NOISE_BG =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='tnNoise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23tnNoise)'/%3E%3C/svg%3E\")";

function StatCard({
    label, icon, tone = 'default', value, limit, unit, progress, progressTone, footer, badge,
}: {
    label: React.ReactNode;
    icon?: string;
    tone?: Tone;
    value: React.ReactNode;
    limit?: React.ReactNode;
    unit?: React.ReactNode;
    progress?: number | null;
    progressTone?: string;
    footer?: React.ReactNode;
    badge?: React.ReactNode;
}) {
    const t = TONE[tone];
    return (
        <div
            className={cx(
                'relative flex flex-col gap-3 p-4 sm:p-5 overflow-hidden rounded-2xl',
                'bg-gradient-to-br ring-1 ring-inset shadow-sm shadow-slate-900/[0.03] transition-colors duration-300',
                t.grad,
                t.ring,
            )}
        >
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-[0.35] dark:opacity-[0.20] mix-blend-soft-light"
                style={{ backgroundImage: NOISE_BG, backgroundSize: '140px 140px' }}
            />
            <div className="relative z-10 flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300 leading-tight">
                    {icon && <span className="material-symbols-outlined text-[16px] text-slate-400/90 dark:text-slate-500">{icon}</span>}
                    {label}
                </span>
                {badge}
            </div>

            <div className="relative z-10 flex items-end gap-1.5 flex-wrap">
                <span className="text-[26px] sm:text-[28px] font-bold tabular-nums leading-none tracking-[-0.02em] text-slate-900 dark:text-slate-100">
                    {value}
                </span>
                {limit && <span className="text-[15px] font-semibold tabular-nums text-slate-400 dark:text-slate-500 leading-none mb-0.5">/ {limit}</span>}
                {unit && <span className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400 leading-none mb-0.5">{unit}</span>}
            </div>

            {typeof progress === 'number' && (
                <div className="relative z-10">
                    <ProgressBar pct={progress} tone={progressTone || t.bar} height="h-1.5" />
                </div>
            )}

            {footer && <div className="relative z-10 text-[12px] text-slate-500 dark:text-slate-400 leading-tight">{footer}</div>}
        </div>
    );
}

const StatSkeleton = () => (
    <div className="rounded-2xl ring-1 ring-inset ring-slate-200/70 dark:ring-slate-700/60 bg-slate-50 dark:bg-slate-900 p-4 sm:p-5 h-[140px] animate-pulse motion-reduce:animate-none transition-colors" />
);

const TABS = [
    { id: 'url', label: 'URL', icon: 'public' },
    { id: 'pdf', label: 'PDF Upload', icon: 'description' },
    { id: 'csv', label: 'CSV / Excel', icon: 'table_chart' },
    { id: 'text', label: 'Text', icon: 'notes' },
];

// Form primitives — aligned to the Insights input language.
const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-[13.5px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5 transition-colors";

const sourceIconFor = (name: string) =>
    name.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf'
        : ['.csv', '.xlsx', '.xls'].some(ext => name.toLowerCase().endsWith(ext)) ? 'table_chart'
            : 'language';

const prettyBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// ── Selected-file chip ────────────────────────────────────────────────────────
const FileChip = ({ file, icon, onRemove }: { file: File; icon: string; onRemove: () => void }) => (
    <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-3 transition-colors">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <span className="material-symbols-outlined text-[18px]">{icon}</span>
        </span>
        <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{file.name}</p>
            <p className="text-[11.5px] text-slate-500 dark:text-slate-400 tabular-nums">{prettyBytes(file.size)}</p>
        </div>
        <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${file.name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
        >
            <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
    </div>
);

// ── Source Browser Sub-Component ──────────────────────────────────────────────
const SourceBrowser = ({ selectedBotId, authFetch, queryClient, showAlert, refreshUser, isFree }: any) => {
    const [selectedSource, setSelectedSource] = useState('');
    const [selectedChunks, setSelectedChunks] = useState(new Set<string>());

    // Fetch distinct sources for this bot
    const { data: sourcesData, isLoading: sourcesLoading } = useQuery({
        queryKey: ['knowledge-sources', selectedBotId],
        queryFn: () => authFetch(`/api/knowledge/sources/${selectedBotId}`),
        enabled: !!selectedBotId && !isFree,
        staleTime: 30_000,
    });
    const sources = (sourcesData as any)?.sources || [];

    // Auto-select first source when data arrives or source list changes
    useEffect(() => {
        if (sources.length > 0 && (!selectedSource || !sources.find((s: any) => s.source === selectedSource))) {
            setSelectedSource(sources[0].source);
        } else if (sources.length === 0) {
            setSelectedSource('');
        }
    }, [sources, selectedSource]);

    // Clear selection when source changes
    useEffect(() => {
        setSelectedChunks(new Set());
    }, [selectedSource]);

    // Fetch chunks for the selected source
    const { data: chunksData, isLoading: chunksLoading } = useQuery({
        queryKey: ['knowledge-chunks', selectedBotId, selectedSource],
        queryFn: () => authFetch(`/api/knowledge/chunks/${selectedBotId}?source=${encodeURIComponent(selectedSource)}&limit=100`),
        enabled: !!selectedBotId && !!selectedSource && !isFree,
        staleTime: 30_000,
    });
    const chunks = (chunksData as any)?.chunks || [];
    const totalChunks = (chunksData as any)?.total ?? 0;

    // Toggle individual chunk selection
    const toggleChunk = (id: string) => {
        setSelectedChunks(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    // Select All / Deselect All
    const toggleAll = () => {
        if (selectedChunks.size === chunks.length) {
            setSelectedChunks(new Set());
        } else {
            setSelectedChunks(new Set(chunks.map((c: any) => c.id)));
        }
    };

    // Delete selected chunks
    const deleteMutation = useMutation({
        mutationFn: () => authFetch(`/api/knowledge/chunks/${selectedBotId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chunk_ids: Array.from(selectedChunks) }),
        }),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['knowledge-chunks', selectedBotId, selectedSource] });
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            refreshUser();
            setSelectedChunks(new Set());
            showAlert('success', data?.message || 'Chunks deleted successfully.');
        },
        onError: (err: any) => {
            showAlert('error', err.message || 'Failed to delete chunks.');
        },
    });

    const handleDeleteSelected = () => {
        if (selectedChunks.size === 0) return;
        if (!window.confirm(`Delete ${selectedChunks.size} selected chunk(s)? This cannot be undone.`)) return;
        deleteMutation.mutate();
    };

    // ── DELETE ENTIRE SOURCE (New Bulk Logic) ───────────────────────────────
    const deleteSourceMutation = useMutation({
        mutationFn: () => authFetch(`/api/knowledge/source/${selectedBotId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_name: selectedSource }),
        }),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            refreshUser();
            setSelectedSource('');
            showAlert('success', data?.message || 'Source deleted fully.');
        },
        onError: (err: any) => {
            showAlert('error', err.message || 'Failed to delete entire source.');
        },
    });

    const handleDeleteSource = () => {
        if (!selectedSource) return;
        if (!window.confirm(`Permanently delete the ENTIRE source "${selectedSource}" and all its chunks? This cannot be undone.`)) return;
        deleteSourceMutation.mutate();
    };

    const isDeleting = deleteMutation.isPending || deleteSourceMutation.isPending;
    const allSelected = selectedChunks.size === chunks.length && chunks.length > 0;

    if (isFree || !selectedBotId) {
        return (
            <EmptyState
                icon="lock"
                title="Upgrade to browse knowledge sources"
                hint="Inspect, audit, and prune the exact segments powering your bot on Starter and Scale plans."
            />
        );
    }

    return (
        <div className="space-y-4">
            {!sourcesLoading && sources.length === 0 && (
                <EmptyState
                    icon="auto_stories"
                    title="No knowledge sources yet"
                    hint="Add a URL, paste text, or upload a document above to start training this bot."
                />
            )}

            {sources.length > 0 && (
                <div className="flex gap-2">
                    <div className="relative flex-1 min-w-0">
                        <select
                            value={selectedSource}
                            onChange={e => setSelectedSource(e.target.value)}
                            disabled={sourcesLoading || sources.length === 0 || isDeleting}
                            aria-label="Select a knowledge source"
                            className={cx(inputCls, 'appearance-none cursor-pointer pr-9 disabled:opacity-60')}
                        >
                            {sourcesLoading && <option>Loading sources…</option>}
                            {!sourcesLoading && sources.length === 0 && <option>No knowledge sources</option>}
                            {sources.map((s: any) => (
                                <option key={s.source} value={s.source}>
                                    {(s.source || 'Unknown').length > 44 ? s.source.substring(0, 41) + '…' : s.source} — {s.chunk_count} segments
                                </option>
                            ))}
                        </select>
                        <span className="material-symbols-outlined pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">expand_more</span>
                    </div>

                    {selectedSource && (
                        <button
                            onClick={handleDeleteSource}
                            disabled={isDeleting}
                            title="Delete this entire source (all segments)"
                            aria-label="Delete this entire source"
                            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 dark:hover:bg-rose-600 transition-colors disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                        </button>
                    )}
                </div>
            )}

            {selectedSource && (
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                    <div className="flex flex-col gap-3 bg-slate-50/70 dark:bg-slate-800/30 p-4 transition-colors">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                                <span className="material-symbols-outlined text-[17px]">{sourceIconFor(selectedSource)}</span>
                            </span>
                            <span className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">
                                {selectedSource}
                            </span>
                            <Badge tone="neutral" dot={false}>
                                {chunksLoading ? '…' : `${chunks.length}${totalChunks > chunks.length ? `/${totalChunks}` : ''}`} segments
                            </Badge>
                        </div>

                        <div className="flex items-center justify-between border-t border-slate-200/70 dark:border-slate-700/60 pt-2.5">
                            <button
                                onClick={toggleAll}
                                disabled={chunks.length === 0}
                                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors disabled:opacity-40"
                            >
                                <span className="material-symbols-outlined text-[17px]">
                                    {allSelected ? 'check_box' : 'check_box_outline_blank'}
                                </span>
                                {allSelected ? 'Deselect all' : 'Select all'}
                            </button>
                            {selectedChunks.size > 0 && (
                                <span className="text-[12px] font-semibold tabular-nums text-blue-600 dark:text-blue-400">
                                    {selectedChunks.size} selected
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="max-h-[260px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/70">
                        {chunksLoading ? (
                            <div className="flex flex-col items-center justify-center gap-2 py-10">
                                <div className="w-4 h-4 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 animate-spin rounded-full motion-reduce:hidden" />
                                <p className="text-[12.5px] font-medium text-slate-500 dark:text-slate-400">Loading segments…</p>
                            </div>
                        ) : chunks.length === 0 ? (
                            <EmptyState icon="inventory_2" title="No segments for this source" />
                        ) : (
                            chunks.map((chunk: any, i: number) => {
                                const checked = selectedChunks.has(chunk.id);
                                return (
                                    <label
                                        key={chunk.id}
                                        className={cx(
                                            'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                                            checked ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => toggleChunk(chunk.id)}
                                            className="mt-0.5 h-4 w-4 shrink-0 rounded accent-blue-600 dark:accent-blue-500"
                                        />
                                        <span className="text-[11px] font-bold tabular-nums text-slate-300 dark:text-slate-600 mt-0.5 shrink-0 w-6">
                                            {String(i + 1).padStart(2, '0')}
                                        </span>
                                        <p className="text-[12.5px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 transition-colors">
                                            {chunk.content || '(empty segment)'}
                                        </p>
                                    </label>
                                );
                            })
                        )}
                    </div>

                    {chunks.length > 0 && (
                        <div className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                            <button
                                onClick={handleDeleteSelected}
                                disabled={selectedChunks.size === 0 || isDeleting}
                                className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 active:scale-[0.99]"
                            >
                                {isDeleting ? (
                                    <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:hidden" /> Deleting…</>
                                ) : (
                                    <><span className="material-symbols-outlined text-[17px]">delete_sweep</span> Delete selected ({selectedChunks.size})</>
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ── Catalog viewer ──────────────────────────────────────────────────────────
// Vertical bots (chemical, …) route catalog-shaped uploads into structured
// tables (product_skus / products) instead of RAG, so those rows never appear
// in "Manage knowledge". This read-only viewer surfaces them. It self-hides for
// non-vertical bots (the API returns no tables) and for empty catalogs.

const humanizeColumn = (col: string) =>
    col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bcas\b/i, 'CAS').replace(/\bhsn\b/i, 'HSN').replace(/\bgst\b/i, 'GST').replace(/\bsds\b/i, 'SDS');

const NUMERIC_COLS = new Set(['list_price', 'price', 'gst_rate', 'total']);

const formatCatalogCell = (col: string, val: any): React.ReactNode => {
    if (val === null || val === undefined || String(val).trim() === '') {
        return <span className="text-slate-300 dark:text-slate-600">—</span>;
    }
    if (typeof val === 'boolean') return val ? 'Yes' : 'No';
    return String(val);
};

const CatalogBrowser = ({ selectedBotId, authFetch, queryClient, showAlert }: any) => {
    const { data, isLoading } = useQuery({
        queryKey: ['knowledge-catalog', selectedBotId],
        queryFn: () => authFetch(`/api/knowledge/catalog/${selectedBotId}`),
        enabled: !!selectedBotId,
        staleTime: 30_000,
    });

    const clearMutation = useMutation({
        mutationFn: () => authFetch(`/api/knowledge/catalog/${selectedBotId}`, { method: 'DELETE' }),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['knowledge-catalog', selectedBotId] });
            showAlert('success', res?.message || 'Product catalog cleared.');
        },
        onError: (err: any) => showAlert('error', err?.message || 'Failed to clear catalog.'),
    });

    // Which single row is being deleted (table_name + id), so only its spinner shows.
    const [deletingRow, setDeletingRow] = useState<string | null>(null);
    const rowDeleteMutation = useMutation({
        mutationFn: (vars: { table_name: string; id: string }) =>
            authFetch(`/api/knowledge/catalog/${selectedBotId}`, {
                method: 'DELETE',
                body: JSON.stringify({ table_name: vars.table_name, row_ids: [vars.id] }),
            }),
        onSuccess: (res: any) => {
            queryClient.invalidateQueries({ queryKey: ['knowledge-catalog', selectedBotId] });
            showAlert('success', res?.message || 'Catalog row deleted.');
        },
        onError: (err: any) => showAlert('error', err?.message || 'Failed to delete row.'),
        onSettled: () => setDeletingRow(null),
    });

    const handleRowDelete = (table_name: string, id: string) => {
        if (rowDeleteMutation.isPending) return;
        if (!window.confirm('Delete this catalog row? This cannot be undone. (A future catalog re-upload replaces all rows.)')) return;
        setDeletingRow(id);
        rowDeleteMutation.mutate({ table_name, id });
    };

    const tables = (data as any)?.tables || [];
    const nonEmpty = tables.filter((t: any) => (t.rows?.length || 0) > 0);

    // Nothing to show for non-vertical bots or empty catalogs — hide entirely.
    if (isLoading || nonEmpty.length === 0) return null;

    const totalRows = nonEmpty.reduce((sum: number, t: any) => sum + (t.total || 0), 0);

    const handleClear = () => {
        if (!window.confirm(
            `Permanently clear the ENTIRE product catalog (${fmtNum(totalRows)} rows across ${nonEmpty.length} table${nonEmpty.length > 1 ? 's' : ''})? This cannot be undone. Re-upload a catalog spreadsheet to repopulate it.`
        )) return;
        clearMutation.mutate();
    };

    return (
        <Card className="p-4 sm:p-5">
            <SectionHeader
                title="Product catalog"
                subtitle="Structured rows your bot reads for quotes, specs, and SDS lookups — imported from catalog spreadsheets."
                icon="inventory_2"
                className="mb-4"
            />
            <div className="space-y-5">
                {nonEmpty.map((t: any) => (
                    <div key={t.table_name} className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                        <div className="flex items-center gap-2.5 bg-slate-50/70 dark:bg-slate-800/30 px-4 py-3 transition-colors">
                            <span className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 capitalize flex-1 min-w-0 truncate">
                                {humanizeColumn(t.table_name)}
                            </span>
                            <Badge tone="neutral" dot={false}>
                                {t.total > t.showing ? `${t.showing}/${t.total}` : t.total} rows
                            </Badge>
                        </div>
                        <div className="max-h-[320px] overflow-auto custom-scrollbar">
                            <table className="w-full border-collapse text-[12.5px]">
                                <thead className="sticky top-0 z-10">
                                    <tr className="bg-white dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800">
                                        {t.columns.map((c: string) => (
                                            <th
                                                key={c}
                                                className={cx(
                                                    'px-3 py-2 font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap',
                                                    NUMERIC_COLS.has(c) ? 'text-right' : 'text-left',
                                                )}
                                            >
                                                {humanizeColumn(c)}
                                            </th>
                                        ))}
                                        <th className="w-9 px-2 py-2" aria-label="Actions" />
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                                    {t.rows.map((row: any[], ri: number) => {
                                        const rowId = t.ids?.[ri];
                                        const isDeleting = deletingRow === rowId;
                                        return (
                                            <tr key={rowId ?? ri} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                                                {row.map((cell: any, ci: number) => {
                                                    const col = t.columns[ci];
                                                    return (
                                                        <td
                                                            key={ci}
                                                            className={cx(
                                                                'px-3 py-2 text-slate-600 dark:text-slate-300 whitespace-nowrap',
                                                                NUMERIC_COLS.has(col) ? 'text-right tabular-nums' : 'text-left',
                                                            )}
                                                        >
                                                            {formatCatalogCell(col, cell)}
                                                        </td>
                                                    );
                                                })}
                                                <td className="w-9 px-2 py-2 text-right">
                                                    {rowId && (
                                                        <button
                                                            onClick={() => handleRowDelete(t.table_name, rowId)}
                                                            disabled={rowDeleteMutation.isPending}
                                                            title="Delete this row"
                                                            aria-label="Delete this catalog row"
                                                            className="inline-flex items-center justify-center h-6 w-6 rounded-md text-slate-400 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
                                                        >
                                                            {isDeleting ? (
                                                                <div className="w-3 h-3 border-2 border-rose-400/30 border-t-rose-500 animate-spin rounded-full motion-reduce:hidden" />
                                                            ) : (
                                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                                            )}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        {t.total > t.showing && (
                            <div className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-2.5 text-[11.5px] text-slate-400 dark:text-slate-500">
                                Showing the first {t.showing} of {fmtNum(t.total)} rows.
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="mt-5 pt-4 border-t border-slate-200/80 dark:border-slate-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Clearing the catalog removes every row above. Re-upload a catalog spreadsheet to repopulate it.
                </p>
                <button
                    onClick={handleClear}
                    disabled={clearMutation.isPending || !selectedBotId}
                    className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg px-4 py-2 text-[12.5px] font-semibold text-rose-700 dark:text-rose-300 ring-1 ring-inset ring-rose-200 dark:ring-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 active:scale-[0.99]"
                >
                    {clearMutation.isPending ? (
                        <><div className="w-3.5 h-3.5 border-2 border-rose-400/30 border-t-rose-500 animate-spin rounded-full motion-reduce:hidden" /> Clearing…</>
                    ) : (
                        <><span className="material-symbols-outlined text-[16px]">delete_sweep</span> Clear catalog</>
                    )}
                </button>
            </div>
        </Card>
    );
};

export default function TrainPage() {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const {
        userTier, userRole, isLoading: ctxLoading,
        messagesUsed, messageLimit, billingPeriodEnd,
        totalMessages, refreshUser
    } = useUserRole();
    const authFetch = useAuthenticatedFetch();
    const isAuthReady = useIsAuthReady();
    const searchParams = useSearchParams();

    const [activeTab, setActiveTab] = useState('url');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [trainingText, setTrainingText] = useState('');
    const [textLabel, setTextLabel] = useState('');
    const [alert, setAlert] = useState<{ open: boolean; type: 'success' | 'error' | 'warning' | 'development'; msg: string }>({ open: false, type: 'success', msg: '' });
    const [selectedBotId, setSelectedBotId] = useState('');
    const [upgradeError, setUpgradeError] = useState<UpgradeError | null>(null);
    const [trainingJobId, setTrainingJobId] = useState<string | null>(null);
    const [trainingProgress, setTrainingProgress] = useState<any>(null);
    // Catalog cleaning report from the last upload (vertical bots only) — the
    // importer's warnings (near-miss columns, skipped rows) are too detailed
    // for the 400px auto-dismiss toast, so they persist here until the next
    // upload or an explicit dismiss.
    const [catalogWarnings, setCatalogWarnings] = useState<string[] | null>(null);
    const pollRef = useRef<NodeJS.Timeout | null>(null);
    const pollAbortRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        const queryText = searchParams.get('query');
        const botId = searchParams.get('bot');
        if (queryText) {
            setActiveTab('text');
            setTrainingText(queryText);
        }
        if (botId) {
            setSelectedBotId(botId);
        }
    }, [searchParams]);

    const fileRef = useRef<HTMLInputElement>(null);
    const csvFileRef = useRef<HTMLInputElement>(null);
    const baseUrl = (typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL?.trim() || ''));

    const { data: botsData } = useQuery({
        queryKey: ['bots'],
        queryFn: () => authFetch('/api/companies'),
        enabled: isAuthReady,
    });

    const bots = (botsData as any)?.bots || [];

    useEffect(() => {
        if (bots.length > 0 && !selectedBotId) {
            setSelectedBotId(bots[0].id);
        }
    }, [bots, selectedBotId]);

    useEffect(() => () => {
        if (pollRef.current) clearTimeout(pollRef.current);
        if (pollAbortRef.current) clearTimeout(pollAbortRef.current);
    }, []);

    const isFree = !ctxLoading && (userTier === 'FREE' || !userTier) && userRole !== 'SUPER_ADMIN';
    const isLockedOut = !ctxLoading && (userTier === 'FREE' || userTier === 'STARTER') && messagesUsed >= messageLimit && userRole !== 'SUPER_ADMIN';

    // Distinct-source count for the current bot — same read-only query the
    // SourceBrowser uses (React Query dedupes on the shared key), surfaced here
    // purely to power the "Knowledge sources" KPI card.
    const { data: sourcesData } = useQuery({
        queryKey: ['knowledge-sources', selectedBotId],
        queryFn: () => authFetch(`/api/knowledge/sources/${selectedBotId}`),
        enabled: !!selectedBotId && !isFree,
        staleTime: 30_000,
    });
    const sourceCount = (sourcesData as any)?.sources?.length ?? 0;

    const showAlert = (type: 'success' | 'error' | 'warning' | 'development', msg: string) => {
        setAlert({ open: true, type, msg });
    };

    const trainMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const fd = new FormData();
            if (url.trim()) fd.append('url', url.trim());
            if (file) fd.append('file', file);
            if (csvFile) fd.append('csv_file', csvFile);
            if (trainingText.trim()) fd.append('text', trainingText.trim());
            if (trainingText.trim() && textLabel.trim()) fd.append('text_label', textLabel.trim());
            if (selectedBotId) fd.append('company_id', selectedBotId);
            const res = await fetch(`${baseUrl}/api/train`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 402) {
                    const detail = data?.detail;
                    const errDetail = typeof detail === 'object' && detail?.code
                        ? detail
                        : { code: 'CHUNK_LIMIT_EXCEEDED', message: typeof detail === 'string' ? detail : 'Chunk limit reached.', tier: '', current: null, limit: null };
                    throw new UpgradeError(errDetail);
                }
                throw new Error(data.detail?.message || data.detail || 'Training failed.');
            }
            return data;
        },
        onSuccess: async (data) => {
            // Catalog cleaning warnings (near-miss columns, skipped rows) are
            // computed synchronously before the chunking job is even queued —
            // they live on this immediate response, not on the job-status poll.
            const warnings: string[] = Array.isArray(data.catalog_warnings) ? data.catalog_warnings : [];
            setCatalogWarnings(warnings.length > 0 ? warnings : null);

            if (data.job_id) {
                setTrainingJobId(data.job_id);
                setTrainingProgress({ status: 'queued', progress: 0, total: 0 });
                setUrl(''); setTrainingText(''); setFile(null); setCsvFile(null); setTextLabel('');
                if (fileRef.current) fileRef.current.value = '';
                if (csvFileRef.current) csvFileRef.current.value = '';

                const jobId = data.job_id;
                // Backoff schedule: ramp up so the backend isn't hammered for
                // long-running jobs and 429s extend the next interval.
                const SCHEDULE = [2000, 2000, 3000, 5000, 8000, 12000, 15000];
                let attempt = 0;
                let nextDelay = SCHEDULE[0];

                const stopPolling = () => {
                    if (pollRef.current) clearTimeout(pollRef.current);
                    pollRef.current = null;
                    if (pollAbortRef.current) clearTimeout(pollAbortRef.current);
                    pollAbortRef.current = null;
                };

                const tick = async () => {
                    try {
                        const token = await getToken();
                        const res = await fetch(`${baseUrl}/api/train/status/${jobId}`, {
                            headers: { Authorization: `Bearer ${token}` },
                        });

                        if (res.status === 429) {
                            // Rate-limited: double next interval (capped) and retry.
                            nextDelay = Math.min(nextDelay * 2, 30000);
                            pollRef.current = setTimeout(tick, nextDelay);
                            return;
                        }

                        const status = await res.json();
                        setTrainingProgress(status);

                        if (status.status === 'done') {
                            stopPolling();
                            setTrainingJobId(null);
                            queryClient.invalidateQueries({ queryKey: ['bots'] });
                            queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedBotId] });
                            queryClient.invalidateQueries({ queryKey: ['knowledge-chunks', selectedBotId] });
                            queryClient.invalidateQueries({ queryKey: ['knowledge-catalog', selectedBotId] });
                            refreshUser();
                            const action = status.is_upsert ? 'Source updated!' : 'Training complete!';
                            const attention = warnings.length > 0 ? ` ${warnings.length} sheet issue(s) need attention — see below.` : '';
                            const msg = status.truncated
                                ? `${action} ${status.chunks_added} chunks added (plan limit reached).${attention}`
                                : `${action} ${status.chunks_added} chunks committed to your bot's knowledge base.${attention}`;
                            showAlert(warnings.length > 0 ? 'warning' : 'success', msg);
                            return;
                        }
                        if (status.status === 'error') {
                            stopPolling();
                            setTrainingJobId(null);
                            showAlert('error', status.message || 'Training failed.');
                            return;
                        }

                        attempt += 1;
                        nextDelay = SCHEDULE[Math.min(attempt, SCHEDULE.length - 1)];
                        pollRef.current = setTimeout(tick, nextDelay);
                    } catch {
                        stopPolling();
                    }
                };

                pollRef.current = setTimeout(tick, nextDelay);
                pollAbortRef.current = setTimeout(() => {
                    stopPolling();
                    setTrainingJobId(null);
                }, 300_000);
                return;
            }
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['knowledge-chunks', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['knowledge-catalog', selectedBotId] });
            refreshUser();
            showAlert(data.warning ? 'warning' : 'success', data.warning || data.message || 'Training successful!');
            setUrl(''); setTrainingText(''); setFile(null); setCsvFile(null);
            if (fileRef.current) fileRef.current.value = '';
            if (csvFileRef.current) csvFileRef.current.value = '';
        },
        onError: (err) => {
            if (err instanceof UpgradeError) setUpgradeError(err);
            else showAlert('error', err.message);
        },
    });

    const handleTrain = (e: React.FormEvent) => {
        e.preventDefault();
        if (!url.trim() && !file && !csvFile && !trainingText.trim()) {
            showAlert('error', 'Provide a URL, PDF file, CSV/Excel file, or manual text.');
            return;
        }
        if (url.trim()) {
            const r = trainUrlSchema.safeParse(url.trim());
            if (!r.success) {
                showAlert('error', r.error.issues[0]?.message || 'Invalid URL.');
                return;
            }
        }
        if (trainingText.trim()) {
            const r = trainTextSchema.safeParse(trainingText);
            if (!r.success) {
                showAlert('error', r.error.issues[0]?.message || 'Invalid text.');
                return;
            }
        }
        trainMutation.mutate();
    };

    const isTraining = trainMutation.isPending || !!trainingJobId;

    const purgeMutation = useMutation({
        mutationFn: () => authFetch(`/api/train/${selectedBotId}`, { method: 'DELETE' }),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['knowledge-chunks', selectedBotId] });
            refreshUser();
            showAlert('success', data?.message || 'Knowledge purged successfully.');
        },
        onError: (err: any) => {
            showAlert('error', err.message || 'Failed to purge knowledge.');
        },
    });

    const handlePurge = () => {
        if (!selectedBotId) return;
        const selectedBot = bots.find((b: any) => b.id === selectedBotId);
        const botName = selectedBot?.bot_name || 'this bot';
        if (!window.confirm(
            `⚠️ DESTRUCTIVE ACTION\n\nThis will permanently delete ALL knowledge content for "${botName}".\n\nThis cannot be undone. Continue?`
        )) return;
        purgeMutation.mutate();
    };

    const isPurging = purgeMutation.isPending;

    const selectedBot = bots.find((b: any) => b.id === selectedBotId);
    const chunksUsed = selectedBot?.chunks_used ?? 0;
    const chunkLimit = (botsData as any)?.plan?.chunk_limit ?? 0;
    const chunkUnlimited = chunkLimit >= 999999;
    const chunkPct = chunkLimit > 0 && !chunkUnlimited ? Math.min((chunksUsed / chunkLimit) * 100, 100) : null;

    const msgUnlimited = (messageLimit ?? 0) >= 999999;
    // A real zero-cap plan (e.g. FREE: messages=0) is NOT the same as "unlimited" —
    // both leave usagePct null, so the footer must tell them apart explicitly
    // instead of defaulting to "Unlimited requests this period" for both.
    const msgZeroCap = !msgUnlimited && (messageLimit ?? 0) <= 0;
    const usagePct = !msgUnlimited && (messageLimit ?? 0) > 0
        ? Math.min(((messagesUsed ?? 0) / (messageLimit ?? 1)) * 100, 100) : null;
    const speedTier = (botsData as any)?.plan?.speed_tier as string | undefined;

    const periodEndStr = billingPeriodEnd
        ? new Date(billingPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

    const barToneFor = (pct: number | null) =>
        pct === null ? undefined : pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : undefined;

    return (
        <div className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            {/* ── Sticky header ──────────────────────────────────────────────── */}
            <div className="relative shrink-0 z-20 bg-[#f8f9fa]/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 md:px-6 lg:px-8 py-3">
                    <p className="text-[13px] sm:text-[13.5px] text-slate-500 dark:text-slate-400 leading-snug min-w-0">
                        Ingest knowledge sources into your AI's vector brain.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {userTier && <Badge tone="ok" dot={false}>{userTier} plan</Badge>}
                        {speedTier && speedTier !== 'none' && (
                            <Badge tone="cold" dot={false}>{speedTier} speed</Badge>
                        )}
                        {bots.length > 1 && (
                            <div className="relative">
                                <select
                                    value={selectedBotId}
                                    onChange={e => setSelectedBotId(e.target.value)}
                                    aria-label="Select bot to train"
                                    className="appearance-none cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-3 pr-8 py-1.5 text-[12.5px] font-medium text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                    {bots.map((b: any) => <option key={b.id} value={b.id}>{b.bot_name}</option>)}
                                </select>
                                <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 pointer-events-none">expand_more</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Scroll body ────────────────────────────────────────────────── */}
            <div className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar flex flex-col gap-5 p-4 md:p-6 lg:p-8">
                {/* KPI strip — real, bot-scoped figures (no fabricated trends) */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {ctxLoading ? (
                        Array(4).fill(0).map((_, i) => <StatSkeleton key={i} />)
                    ) : (
                        <>
                            <StatCard
                                label="Knowledge storage"
                                icon="database"
                                tone="accent"
                                value={fmtNum(chunksUsed * 60)}
                                limit={chunkUnlimited ? undefined : fmtNum(chunkLimit * 60)}
                                unit="words"
                                progress={chunkPct}
                                progressTone={barToneFor(chunkPct)}
                                badge={chunkUnlimited ? <Badge tone="ok" dot={false}>Unlimited</Badge> : undefined}
                                footer={
                                    chunkPct !== null
                                        ? `${Math.round(chunkPct)}% of storage used`
                                        : 'Unlimited storage on your plan'
                                }
                            />

                            <StatCard
                                label="Knowledge sources"
                                icon="folder_open"
                                tone="info"
                                value={isFree ? '—' : fmtNum(sourceCount)}
                                unit={sourceCount === 1 ? 'source' : 'sources'}
                                footer={isFree
                                    ? 'Upgrade to manage sources'
                                    : `${fmtNum(chunksUsed)} segment${chunksUsed === 1 ? '' : 's'} indexed`}
                            />

                            <StatCard
                                label="AI memory"
                                icon="vital_signs"
                                tone="default"
                                value={fmtNum(totalMessages ?? 0)}
                                unit="msgs"
                                footer="Lifetime messages across all bots"
                            />

                            <StatCard
                                label="Monthly usage"
                                icon="bolt"
                                tone="warn"
                                value={fmtNum(messagesUsed ?? 0)}
                                limit={msgUnlimited ? undefined : fmtNum(messageLimit ?? 0)}
                                unit="reqs"
                                progress={usagePct}
                                progressTone={barToneFor(usagePct)}
                                badge={msgUnlimited ? <Badge tone="ok" dot={false}>Unlimited</Badge> : undefined}
                                footer={
                                    usagePct !== null ? (
                                        <span className="flex items-center justify-between gap-2">
                                            <span>{Math.round(usagePct)}% of monthly cap</span>
                                            <span className="inline-flex items-center gap-1 shrink-0">
                                                <span className="material-symbols-outlined text-[13px]">schedule</span>
                                                renews {periodEndStr}
                                            </span>
                                        </span>
                                    ) : msgZeroCap
                                        ? 'No request quota on your current plan'
                                        : 'Unlimited requests this period'
                                }
                            />
                        </>
                    )}
                </div>

                {/* Add knowledge */}
                <Card className="relative p-4 sm:p-5 overflow-hidden">
                    {isFree && (
                        <div className="absolute inset-0 z-20 bg-white/95 dark:bg-slate-900/95 flex flex-col items-center justify-center gap-5 p-6 md:p-10 rounded-2xl transition-colors">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                                <span className="material-symbols-outlined text-[26px] text-slate-700 dark:text-slate-200">lock</span>
                            </div>
                            <div className="text-center">
                                <p className="text-[17px] font-bold text-slate-900 dark:text-slate-100 mb-1.5">Trial plan required</p>
                                <p className="text-[13.5px] text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm">
                                    Vector training is available on Starter and Scale plans. Unlock your bot's brain today.
                                </p>
                            </div>
                            <a href="/dashboard/pricing" className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors active:scale-95">
                                Upgrade now
                            </a>
                        </div>
                    )}

                    <SectionHeader
                        title="Add knowledge"
                        subtitle="Pick a source type, then feed it into this bot's knowledge base."
                        icon="add_circle"
                        className="mb-4"
                    />

                    {/* Source-type tabs */}
                    <div role="tablist" aria-label="Knowledge source type" className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 dark:bg-slate-800/80 p-1 mb-5">
                        {TABS.map(t => {
                            const active = activeTab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    role="tab"
                                    aria-selected={active}
                                    onClick={() => setActiveTab(t.id)}
                                    className={cx(
                                        'inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors min-h-[38px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
                                        active
                                            ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200',
                                    )}
                                >
                                    <span className="material-symbols-outlined text-[17px]">{t.icon}</span>
                                    <span className="hidden sm:inline">{t.label}</span>
                                </button>
                            );
                        })}
                    </div>

                    <form onSubmit={handleTrain} className="space-y-4">
                        {activeTab === 'url' && (
                            <div>
                                <label className={labelCls}>Source URL</label>
                                <input type="url" value={url} onChange={e => setUrl(e.target.value)} className={inputCls} placeholder="https://docs.example.com" />
                                <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                    We'll crawl and index the page's readable content.
                                </p>
                            </div>
                        )}

                        {activeTab === 'pdf' && (
                            <div>
                                <label className={labelCls}>PDF document</label>
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    className="group flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 px-4 py-8 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                                    </span>
                                    <div className="text-center">
                                        <p className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-200">Click to upload a PDF</p>
                                        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">PDF only · up to 10 MB</p>
                                    </div>
                                    <input type="file" ref={fileRef} className="hidden" accept=".pdf"
                                        onChange={e => { const f = e.target.files?.[0]; if (f?.type === 'application/pdf') setFile(f); else showAlert('error', 'Please select a valid PDF.'); }} />
                                </button>
                                {file && <FileChip file={file} icon="picture_as_pdf" onRemove={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }} />}
                            </div>
                        )}

                        {activeTab === 'csv' && (
                            <div>
                                <label className={labelCls}>CSV / Excel file</label>
                                <button
                                    type="button"
                                    onClick={() => csvFileRef.current?.click()}
                                    className="group flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 px-4 py-8 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                                >
                                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        <span className="material-symbols-outlined text-[24px]">table_chart</span>
                                    </span>
                                    <div className="text-center">
                                        <p className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-200">Click to upload a spreadsheet</p>
                                        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">.csv, .xlsx, .xls · up to 5 MB</p>
                                    </div>
                                    <input
                                        type="file"
                                        ref={csvFileRef}
                                        className="hidden"
                                        accept=".csv,.xlsx,.xls"
                                        onChange={e => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            const ok = ['.csv', '.xlsx', '.xls'].some(ext => f.name.toLowerCase().endsWith(ext));
                                            if (!ok) { showAlert('error', 'Please select a .csv, .xlsx, or .xls file.'); return; }
                                            if (f.size > 5 * 1024 * 1024) { showAlert('error', 'File exceeds 5 MB limit.'); return; }
                                            setCsvFile(f);
                                        }}
                                    />
                                </button>
                                {csvFile && <FileChip file={csvFile} icon="table_chart" onRemove={() => { setCsvFile(null); if (csvFileRef.current) csvFileRef.current.value = ''; }} />}
                                {csvFile && (
                                    <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/30 px-3.5 py-3 ring-1 ring-inset ring-blue-100 dark:ring-blue-900/40">
                                        <span className="material-symbols-outlined text-[16px] text-blue-500 mt-0.5 shrink-0">info</span>
                                        <p className="text-[12px] text-blue-800 dark:text-blue-200 leading-relaxed">
                                            Each row becomes a piece of knowledge your bot can answer from. Make sure row 1 holds your <span className="font-semibold">column headers</span>. Re-uploading the same filename safely replaces the previous version.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'text' && (
                            <div className="space-y-4">
                                <div>
                                    <label className={labelCls}>Source label <span className="font-normal text-slate-400 dark:text-slate-500">(optional)</span></label>
                                    <input
                                        type="text"
                                        value={textLabel}
                                        onChange={e => setTextLabel(e.target.value)}
                                        className={inputCls}
                                        placeholder="e.g. faq-returns, pricing-2025"
                                    />
                                    <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                        {textLabel.trim()
                                            ? <>Re-uploading with label <span className="font-semibold text-slate-700 dark:text-slate-200">"{textLabel.trim()}"</span> safely replaces only that source.</>
                                            : 'Without a label, re-submitting overwrites all previous unlabelled text entries.'}
                                    </p>
                                </div>
                                <div>
                                    <label className={labelCls}>Knowledge text</label>
                                    <textarea value={trainingText} onChange={e => setTrainingText(e.target.value)}
                                        rows={6} className={cx(inputCls, 'resize-none leading-relaxed')} placeholder="Paste your FAQs, services, or raw knowledge here…" />
                                </div>
                            </div>
                        )}

                        {upgradeError && (
                            <UpgradePrompt
                                mode="inline"
                                code={upgradeError.code}
                                tier={upgradeError.tier}
                                current={upgradeError.current}
                                limit={upgradeError.limit}
                                onDismiss={() => setUpgradeError(null)}
                            />
                        )}

                        <button type="submit" disabled={isTraining || isLockedOut}
                            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 px-7 py-3 text-[13.5px] font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-[0.99]">
                            {trainingJobId ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:hidden" />
                                    Training… {trainingProgress?.progress ?? 0} / {trainingProgress?.total ?? '?'} chunks
                                </>
                            ) : trainMutation.isPending ? (
                                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full motion-reduce:hidden" /> Uploading…</>
                            ) : isLockedOut ? 'Quota exceeded' : (
                                <><span className="material-symbols-outlined text-[18px]">bolt</span> Start training</>
                            )}
                        </button>
                    </form>
                </Card>

                {/* Catalog cleaning report — near-miss columns / skipped rows from the
                    last upload. Persists until dismissed or the next upload, since the
                    detail here is too long for the auto-dismiss toast. */}
                {catalogWarnings && catalogWarnings.length > 0 && (
                    <Card className="p-4 sm:p-5">
                        <div className="flex flex-col gap-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 ring-1 ring-inset ring-amber-100 dark:ring-amber-900/40 p-4">
                            <div className="flex items-start justify-between gap-2.5">
                                <div className="flex items-start gap-2.5 min-w-0">
                                    <span className="material-symbols-outlined text-[18px] text-amber-500 dark:text-amber-400 shrink-0 mt-0.5">warning</span>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-semibold text-amber-700 dark:text-amber-300">
                                            Your last upload needs attention
                                        </p>
                                        <p className="text-[12px] text-amber-600/90 dark:text-amber-400/90 leading-relaxed mt-0.5">
                                            The rest of your sheet imported fine — these rows or sheets were skipped or need a column rename.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setCatalogWarnings(null)}
                                    aria-label="Dismiss catalog warnings"
                                    className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            </div>
                            <ul className="list-disc pl-9 space-y-1.5">
                                {catalogWarnings.map((w, i) => (
                                    <li key={i} className="text-[12px] text-amber-700/90 dark:text-amber-300/90 leading-relaxed">{w}</li>
                                ))}
                            </ul>
                        </div>
                    </Card>
                )}

                {/* Product catalog (vertical bots only — self-hides otherwise) */}
                <CatalogBrowser selectedBotId={selectedBotId} authFetch={authFetch} queryClient={queryClient} showAlert={showAlert} />

                {/* Manage knowledge */}
                <Card className="p-4 sm:p-5">
                    <SectionHeader
                        title="Manage knowledge"
                        subtitle="Review, audit, and prune the exact segments powering this bot."
                        icon="folder_open"
                        className="mb-4"
                    />

                    <SourceBrowser
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        queryClient={queryClient}
                        showAlert={showAlert}
                        refreshUser={refreshUser}
                        isFree={isFree}
                    />

                    {/* Danger zone */}
                    <div className="mt-6 pt-5 border-t border-slate-200/80 dark:border-slate-800 transition-colors">
                        <div className="flex flex-col gap-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/20 ring-1 ring-inset ring-rose-100 dark:ring-rose-900/40 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-start gap-2.5 min-w-0">
                                <span className="material-symbols-outlined text-[18px] text-rose-500 dark:text-rose-400 shrink-0 mt-0.5">delete_forever</span>
                                <div className="min-w-0">
                                    <p className="text-[13px] font-semibold text-rose-700 dark:text-rose-300">Delete all knowledge</p>
                                    <p className="text-[12px] text-rose-600/90 dark:text-rose-400/90 leading-relaxed mt-0.5">
                                        Permanently removes every trained segment for this bot. This cannot be undone.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={handlePurge}
                                disabled={isPurging || isFree || !selectedBotId || chunksUsed === 0}
                                className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 active:scale-[0.99]"
                            >
                                {isPurging ? (
                                    <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full motion-reduce:hidden" /> Deleting…</>
                                ) : (
                                    <><span className="material-symbols-outlined text-[17px]">delete</span> Delete all ({fmtNum(chunksUsed)})</>
                                )}
                            </button>
                        </div>
                    </div>
                </Card>
            </div>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
}
