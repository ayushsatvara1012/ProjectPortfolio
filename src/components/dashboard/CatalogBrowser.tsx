import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { EmptyState, Badge, cx, fmtNum, Card, SectionHeader } from "@/src/components/dashboard/insights/ui";

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



export default CatalogBrowser;
