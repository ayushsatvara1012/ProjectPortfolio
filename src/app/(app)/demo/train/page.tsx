'use client';

import React, { useState, useEffect, useRef } from 'react';
import Alert from '@/src/components/ui/Alert';
import { parseFileToChunks } from '@/src/lib/demo/demoRag';
import { saveKnowledge, getKnowledge, clearKnowledge, getBotConfig } from '@/src/lib/demo/demoStorage';
import { Card, SectionHeader, Badge, ProgressBar, EmptyState, cx, fmtNum } from '@/src/components/dashboard/insights/ui';

/* ────────────────────────────────────────────────────────────────────────── */
/* Local design tokens — mirror the dashboard Train AI surface so the demo KPI  */
/* strip is visually identical to /dashboard/train.                             */
/* ────────────────────────────────────────────────────────────────────────── */

type Tone = 'default' | 'accent' | 'info' | 'warn' | 'positive';

const TONE: Record<Tone, { grad: string; ring: string; bar: string }> = {
    default: { grad: 'from-slate-100 via-slate-50 to-white dark:from-slate-700/40 dark:via-slate-800/30 dark:to-slate-900', ring: 'ring-slate-200/70 dark:ring-slate-700/60', bar: 'bg-gradient-to-r from-slate-500 to-slate-400 dark:from-slate-400 dark:to-slate-500' },
    accent: { grad: 'from-blue-100 via-blue-50 to-white dark:from-blue-900/40 dark:via-blue-950/20 dark:to-slate-900', ring: 'ring-blue-200/70 dark:ring-blue-900/50', bar: 'bg-gradient-to-r from-blue-600 to-blue-400' },
    info: { grad: 'from-sky-100 via-sky-50 to-white dark:from-sky-900/40 dark:via-sky-950/20 dark:to-slate-900', ring: 'ring-sky-200/70 dark:ring-sky-900/50', bar: 'bg-gradient-to-r from-sky-500 to-sky-400' },
    warn: { grad: 'from-amber-100 via-amber-50 to-white dark:from-amber-900/40 dark:via-amber-950/20 dark:to-slate-900', ring: 'ring-amber-200/70 dark:ring-amber-900/50', bar: 'bg-gradient-to-r from-amber-500 to-amber-400' },
    positive: { grad: 'from-emerald-100 via-emerald-50 to-white dark:from-emerald-900/40 dark:via-emerald-950/20 dark:to-slate-900', ring: 'ring-emerald-200/70 dark:ring-emerald-900/50', bar: 'bg-gradient-to-r from-emerald-500 to-emerald-400' },
};

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

const TABS = [
    { id: 'pdf', label: 'PDF Upload', icon: 'description' },
    { id: 'csv', label: 'CSV / Excel', icon: 'table_chart' },
    { id: 'text', label: 'Text', icon: 'notes' },
];

// Form primitives — aligned to the Insights/dashboard input language.
const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-[13.5px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5 transition-colors";

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
            <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100 truncate">{file.name}</p>
            <p className="text-[12px] text-slate-500 dark:text-slate-400">{prettyBytes(file.size)}</p>
        </div>
        <button type="button" onClick={onRemove} aria-label="Remove file"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
    </div>
);

// ── Source browser — mirrors the dashboard "Manage knowledge" panel ─────────
const DemoSourceBrowser = ({ chunks, setChunks, showAlert }: {
    chunks: string[];
    setChunks: (c: string[]) => void;
    showAlert: (type: 'success' | 'error' | 'warning', msg: string) => void;
}) => {
    const allChunks = chunks;
    const [selectedChunks, setSelectedChunks] = useState(new Set<number>());

    const toggleChunk = (i: number) =>
        setSelectedChunks(prev => {
            const next = new Set(prev);
            if (next.has(i)) next.delete(i); else next.add(i);
            return next;
        });

    const toggleAll = () => {
        if (selectedChunks.size === allChunks.length) setSelectedChunks(new Set());
        else setSelectedChunks(new Set(allChunks.map((_: string, i: number) => i)));
    };

    const handleDeleteSelected = () => {
        if (selectedChunks.size === 0) return;
        if (!window.confirm(`Delete ${selectedChunks.size} selected segment(s)? This cannot be undone.`)) return;
        const remaining = allChunks.filter((_: string, i: number) => !selectedChunks.has(i));
        saveKnowledge(remaining);
        setChunks(remaining);
        setSelectedChunks(new Set());
        showAlert('success', `${selectedChunks.size} segment(s) deleted successfully.`);
    };

    const allSelected = selectedChunks.size === allChunks.length && allChunks.length > 0;

    if (allChunks.length === 0) {
        return (
            <EmptyState
                icon="auto_stories"
                title="No knowledge sources yet"
                hint="Add a PDF, CSV, or paste text above to start training this bot."
            />
        );
    }

    return (
        <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 overflow-hidden">
            <div className="flex flex-col gap-3 bg-slate-50/70 dark:bg-slate-800/30 p-4 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400">
                        <span className="material-symbols-outlined text-[17px]">notes</span>
                    </span>
                    <span className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100 truncate flex-1 min-w-0">
                        demo-knowledge
                    </span>
                    <Badge tone="neutral" dot={false}>{allChunks.length} segments</Badge>
                </div>

                <div className="flex items-center justify-between border-t border-slate-200/70 dark:border-slate-700/60 pt-2.5">
                    <button
                        onClick={toggleAll}
                        disabled={allChunks.length === 0}
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

            <div className="max-h-[260px] overflow-y-auto custom-scrollbar divide-y divide-slate-100 dark:divide-slate-800/70" data-lenis-prevent>
                {allChunks.map((chunk: string, i: number) => {
                    const checked = selectedChunks.has(i);
                    return (
                        <label
                            key={i}
                            className={cx(
                                'flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors',
                                checked ? 'bg-blue-50/60 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/40',
                            )}
                        >
                            <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleChunk(i)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded accent-blue-600 dark:accent-blue-500"
                            />
                            <span className="text-[11px] font-bold tabular-nums text-slate-300 dark:text-slate-600 mt-0.5 shrink-0 w-6">
                                {String(i + 1).padStart(2, '0')}
                            </span>
                            <p className="text-[12.5px] text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 transition-colors">
                                {chunk || '(empty segment)'}
                            </p>
                        </label>
                    );
                })}
            </div>

            {allChunks.length > 0 && (
                <div className="border-t border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
                    <button
                        onClick={handleDeleteSelected}
                        disabled={selectedChunks.size === 0}
                        className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500/50 active:scale-[0.99]"
                    >
                        <span className="material-symbols-outlined text-[17px]">delete_sweep</span>
                        Delete selected ({selectedChunks.size})
                    </button>
                </div>
            )}
        </div>
    );
};

export default function DemoTrainAIPage() {
    const [botConfig, setBotConfig] = useState<any>(null);
    const [chunks, setChunks] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setBotConfig(getBotConfig());
        setChunks(getKnowledge());
        setMounted(true);
    }, []);

    const [activeTab, setActiveTab] = useState('pdf');
    const [file, setFile] = useState<File | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [trainingText, setTrainingText] = useState('');
    const [textLabel, setTextLabel] = useState('');
    const [isTraining, setIsTraining] = useState(false);
    const [isPurging, setIsPurging] = useState(false);
    const [alert, setAlert] = useState<{ open: boolean; type: 'success' | 'error' | 'warning'; msg: string }>({ open: false, type: 'success', msg: '' });

    const fileRef = useRef<HTMLInputElement>(null);
    const csvFileRef = useRef<HTMLInputElement>(null);

    if (!mounted) return null;

    const chunksUsed = chunks.length;
    const chunkLimit = 200;
    const chunkPct = chunkLimit > 0 ? Math.min((chunksUsed / chunkLimit) * 100, 100) : null;
    const sourceCount = chunksUsed > 0 ? 1 : 0;
    const msgUsed = 0;
    const msgLimit = 15;
    const usagePct = Math.min((msgUsed / msgLimit) * 100, 100);
    const barToneFor = (pct: number | null) =>
        pct === null ? undefined : pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : undefined;

    const refresh = () => setChunks(getKnowledge());
    const showAlert = (type: 'success' | 'error' | 'warning', msg: string) => setAlert({ open: true, type, msg });

    const handleTrain = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeFile = file || csvFile;
        if (!activeFile && !trainingText.trim()) {
            showAlert('error', 'Provide a PDF file, CSV/Excel file, or manual text.');
            return;
        }

        setIsTraining(true);
        try {
            let newChunks: string[];
            if (activeFile) {
                newChunks = await parseFileToChunks(activeFile);
            } else {
                newChunks = trainingText.split(/\n{2,}/).filter(p => p.trim().length > 20);
            }
            if (newChunks.length > 200) newChunks = newChunks.slice(0, 200);
            saveKnowledge(newChunks);
            refresh();
            showAlert('success', `Training complete! ${newChunks.length} segments committed to your bot's knowledge base.`);
            setFile(null); setCsvFile(null); setTrainingText(''); setTextLabel('');
            if (fileRef.current) fileRef.current.value = '';
            if (csvFileRef.current) csvFileRef.current.value = '';
        } catch (err: any) {
            showAlert('error', err.message || 'Failed to process.');
        } finally {
            setIsTraining(false);
        }
    };

    const handlePurge = () => {
        if (!window.confirm(
            `⚠️ DESTRUCTIVE ACTION\n\nThis will permanently delete ALL knowledge content for "${botConfig?.name}".\n\nThis cannot be undone. Continue?`
        )) return;
        setIsPurging(true);
        clearKnowledge();
        setChunks([]);
        setIsPurging(false);
        showAlert('success', 'Knowledge purged successfully.');
    };


    return (
        <div className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            {/* ── Sticky header ──────────────────────────────────────────────── */}
            <div className="relative shrink-0 z-20 bg-[#f8f9fa]/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 md:px-6 lg:px-8 py-3">
                    <p className="text-[13px] sm:text-[13.5px] text-slate-500 dark:text-slate-400 leading-snug min-w-0">
                        Ingest knowledge sources into your AI's vector brain.
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="alert" dot={false}>Demo plan</Badge>
                    </div>
                </div>
            </div>

            {/* ── Scroll body ────────────────────────────────────────────────── */}
            <div className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar flex flex-col gap-5 p-4 md:p-6 lg:p-8">
                {/* KPI strip */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    <StatCard
                        label="Knowledge storage"
                        icon="database"
                        tone="accent"
                        value={fmtNum(chunksUsed * 60)}
                        limit={fmtNum(chunkLimit * 60)}
                        unit="words"
                        progress={chunkPct ?? undefined}
                        progressTone={barToneFor(chunkPct)}
                        footer={chunkPct !== null ? `${Math.round(chunkPct)}% of storage used` : undefined}
                    />

                    <StatCard
                        label="Knowledge sources"
                        icon="folder_open"
                        tone="info"
                        value={fmtNum(sourceCount)}
                        unit={sourceCount === 1 ? 'source' : 'sources'}
                        footer={`${fmtNum(chunksUsed)} segment${chunksUsed === 1 ? '' : 's'} indexed`}
                    />

                    <StatCard
                        label="AI memory"
                        icon="vital_signs"
                        tone="default"
                        value={fmtNum(chunksUsed)}
                        unit="segs"
                        footer="Segments in this demo session"
                    />

                    <StatCard
                        label="Monthly usage"
                        icon="bolt"
                        tone="warn"
                        value={fmtNum(msgUsed)}
                        limit={fmtNum(msgLimit)}
                        unit="reqs"
                        progress={usagePct}
                        progressTone={barToneFor(usagePct)}
                        footer={
                            <span className="flex items-center justify-between gap-2">
                                <span>{Math.round(usagePct)}% of demo cap</span>
                                <span className="inline-flex items-center gap-1 shrink-0">
                                    <span className="material-symbols-outlined text-[13px]">schedule</span>
                                    demo
                                </span>
                            </span>
                        }
                    />
                </div>

                {/* Add knowledge */}
                <Card className="relative p-4 sm:p-5 overflow-hidden">
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

                        <button type="submit" disabled={isTraining}
                            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 px-7 py-3 text-[13.5px] font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-[0.99]">
                            {isTraining ? (
                                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full motion-reduce:hidden" /> Uploading…</>
                            ) : (
                                <><span className="material-symbols-outlined text-[18px]">bolt</span> Start training</>
                            )}
                        </button>
                    </form>
                </Card>

                {/* Manage knowledge */}
                <Card className="p-4 sm:p-5">
                    <SectionHeader
                        title="Manage knowledge"
                        subtitle="Review, audit, and prune the exact segments powering this bot."
                        icon="folder_open"
                        className="mb-4"
                    />

                    <DemoSourceBrowser chunks={chunks} setChunks={setChunks} showAlert={showAlert} />

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
                                disabled={isPurging || chunksUsed === 0}
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
