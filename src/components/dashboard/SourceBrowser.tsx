import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EmptyState, Badge, cx } from "@/src/components/dashboard/insights/ui";

const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-[13.5px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-colors";

const sourceIconFor = (name: string) =>
    name.toLowerCase().endsWith(".pdf") ? "picture_as_pdf"
        : [".csv", ".xlsx", ".xls"].some(ext => name.toLowerCase().endsWith(ext)) ? "table_chart"
            : "language";

// ── Source Browser Sub-Component ──────────────────────────────────────────────
const SourceBrowser = ({ selectedBotId, authFetch, queryClient, showAlert, refreshUser, isFree }: any) => {
    const [selectedSource, setSelectedSource] = useState('');
    const [selectedChunks, setSelectedChunks] = useState(new Set<string>());
    const [sourceFilter, setSourceFilter] = useState('');

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
            showAlert('error', err.message || 'Failed to delete segments.');
        },
    });

    const handleDeleteSelected = () => {
        if (selectedChunks.size === 0) return;
        if (!window.confirm(`Delete ${selectedChunks.size} selected segment(s)? This cannot be undone.`)) return;
        deleteMutation.mutate();
    };

    // ── DELETE ENTIRE SOURCE (New Bulk Logic) ───────────────────────────────
    const deleteSourceMutation = useMutation({
        mutationFn: (sourceName: string) => authFetch(`/api/knowledge/source/${selectedBotId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source_name: sourceName }),
        }),
        onSuccess: (data: any, sourceName: string) => {
            queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedBotId] });
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            refreshUser();
            if (sourceName === selectedSource) setSelectedSource('');
            showAlert('success', data?.message || 'Source deleted fully.');
        },
        onError: (err: any) => {
            showAlert('error', err.message || 'Failed to delete entire source.');
        },
    });

    const handleDeleteSource = (sourceName: string) => {
        if (!sourceName) return;
        if (!window.confirm(`Permanently delete the ENTIRE source "${sourceName}" and all its segments? This cannot be undone.`)) return;
        deleteSourceMutation.mutate(sourceName);
    };

    const isDeleting = deleteMutation.isPending || deleteSourceMutation.isPending;
    const allSelected = selectedChunks.size === chunks.length && chunks.length > 0;

    const filterTerm = sourceFilter.trim().toLowerCase();
    const visibleSources = filterTerm
        ? sources.filter((s: any) => (s.source || '').toLowerCase().includes(filterTerm))
        : sources;

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
                <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
                    {sources.length > 8 && (
                        <div className="p-2 border-b border-slate-200/80 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/30">
                            <input
                                type="text"
                                value={sourceFilter}
                                onChange={e => setSourceFilter(e.target.value)}
                                placeholder="Filter sources…"
                                aria-label="Filter knowledge sources"
                                className={cx(inputCls, 'py-2')}
                            />
                        </div>
                    )}
                    <div role="listbox" aria-label="Knowledge sources" className="max-h-[240px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/70">
                        {visibleSources.length === 0 ? (
                            <p className="px-3.5 py-4 text-[12.5px] text-slate-400 dark:text-slate-500">
                                No sources match &ldquo;{sourceFilter.trim()}&rdquo;.
                            </p>
                        ) : (
                            visibleSources.map((s: any) => {
                                const active = s.source === selectedSource;
                                return (
                                    <div
                                        key={s.source}
                                        className={cx(
                                            'flex items-center gap-2 pl-1 pr-2 py-1 transition-colors',
                                            active ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                                        )}
                                    >
                                        <button
                                            type="button"
                                            role="option"
                                            aria-selected={active}
                                            onClick={() => setSelectedSource(s.source)}
                                            disabled={isDeleting}
                                            className="flex flex-1 min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-60"
                                        >
                                            <span className={cx('material-symbols-outlined text-[17px] shrink-0', active ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500')}>
                                                {sourceIconFor(s.source || '')}
                                            </span>
                                            <span className={cx('truncate text-[12.5px]', active ? 'font-semibold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-600 dark:text-slate-300')}>
                                                {s.source || 'Unknown'}
                                            </span>
                                            <span className="ml-auto shrink-0 text-[11.5px] font-semibold tabular-nums text-slate-400 dark:text-slate-500">
                                                {s.chunk_count}
                                            </span>
                                        </button>
                                        <button
                                            onClick={() => handleDeleteSource(s.source)}
                                            disabled={isDeleting}
                                            title={`Delete the entire source "${s.source}"`}
                                            aria-label={`Delete the entire source ${s.source}`}
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50"
                                        >
                                            <span className="material-symbols-outlined text-[17px]">delete_forever</span>
                                        </button>
                                    </div>
                                );
                            })
                        )}
                    </div>
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

                    <div className="max-h-[min(48vh,520px)] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/70">
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

export default SourceBrowser;
