'use client';

import React, { useState, useEffect, useRef } from 'react';
import Alert from '@/src/components/ui/Alert';
import { parseFileToChunks, parseUrlToChunks } from '@/src/lib/demo/demoRag';
import { saveKnowledge, getKnowledge, clearKnowledge, getBotConfig } from '@/src/lib/demo/demoStorage';
import { Card, SectionHeader, Badge, cx, fmtNum } from '@/src/components/dashboard/insights/ui';

/* ────────────────────────────────────────────────────────────────────────── */
/* The demo Train AI surface mirrors /dashboard/train 1:1 (layout, crawl        */
/* discovery, drag-drop, async progress) but runs on sessionStorage + a mock    */
/* backend instead of Clerk + FastAPI, so prospects see the real experience.    */
/* ────────────────────────────────────────────────────────────────────────── */

import SourceBrowser from '@/src/components/dashboard/SourceBrowser';
import { StatCard } from '@/src/components/dashboard/TrainStatCard';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { createMockAuthFetch } from '@/src/lib/demo/mockBackend';

const queryClientProvider = new QueryClient();

const TABS = [
    { id: 'url', label: 'URL', icon: 'public' },
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
        <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors">
            <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
    </div>
);

type CrawlCandidate = { url: string; label: string; estimated_words: number };

function DemoTrainAIInner() {
    const queryClient = useQueryClient();
    const [botConfig, setBotConfig] = useState<any>(null);
    const [chunks, setChunks] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setBotConfig(getBotConfig());
        setChunks(getKnowledge());
        setMounted(true);
    }, []);

    const [activeTab, setActiveTab] = useState('url');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [trainingText, setTrainingText] = useState('');
    const [textLabel, setTextLabel] = useState('');
    const [isTraining, setIsTraining] = useState(false);
    const [isPurging, setIsPurging] = useState(false);
    const [isDiscovering, setIsDiscovering] = useState(false);
    const [trainingProgress, setTrainingProgress] = useState<{ progress: number; total: number; mode: string } | null>(null);
    const [alert, setAlert] = useState<{ open: boolean; type: 'success' | 'error' | 'warning'; msg: string }>({ open: false, type: 'success', msg: '' });

    // Multi-page crawl discovery — candidate same-site pages harvested from the
    // entry URL, with an estimated word cost. Selection drives the crawl fan-out.
    const [candidates, setCandidates] = useState<CrawlCandidate[] | null>(null);
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
    const [entryEstimate, setEntryEstimate] = useState<number>(0);
    const [candidateFilter, setCandidateFilter] = useState('');
    const [dragActive, setDragActive] = useState(false);

    const authFetch = React.useMemo(() => createMockAuthFetch(botConfig?.name || 'Demo Bot'), [botConfig]);

    const fileRef = useRef<HTMLInputElement>(null);
    const csvFileRef = useRef<HTMLInputElement>(null);

    if (!mounted) return null;

    const chunksUsed = chunks.length;
    const wordsUsed = chunks.reduce((sum, c) => sum + c.trim().split(/\s+/).filter(Boolean).length, 0);
    const wordLimit = 12000;
    const wordPct = wordLimit > 0 ? Math.min((wordsUsed / wordLimit) * 100, 100) : null;
    const sourceCount = chunksUsed > 0 ? 1 : 0;
    const msgUsed = 0;
    const msgLimit = 15;
    const usagePct = Math.min((msgUsed / msgLimit) * 100, 100);
    const barToneFor = (pct: number | null) =>
        pct === null ? undefined : pct >= 100 ? 'bg-rose-500' : pct >= 80 ? 'bg-amber-500' : undefined;

    const refresh = () => {
        setChunks(getKnowledge());
        queryClient.invalidateQueries({ queryKey: ['knowledge-sources'] });
        queryClient.invalidateQueries({ queryKey: ['knowledge-chunks'] });
    };
    const showAlert = (type: 'success' | 'error' | 'warning' | 'development', msg: string) =>
        setAlert({ open: true, type: type === 'development' ? 'warning' : type, msg });

    const resetDiscovery = () => { setCandidates(null); setSelectedUrls(new Set()); setEntryEstimate(0); setCandidateFilter(''); };

    // ── Dropzone helpers (drag-and-drop, matching the live dashboard) ───────────
    const acceptPdfFile = (f: File | undefined) => {
        if (!f) return;
        if (f.type === 'application/pdf') setFile(f);
        else showAlert('error', 'Please select a valid PDF.');
    };
    const acceptCsvFile = (f: File | undefined) => {
        if (!f) return;
        const ok = ['.csv', '.xlsx', '.xls'].some(ext => f.name.toLowerCase().endsWith(ext));
        if (!ok) { showAlert('error', 'Please select a .csv, .xlsx, or .xls file.'); return; }
        if (f.size > 5 * 1024 * 1024) { showAlert('error', 'File exceeds 5 MB limit.'); return; }
        setCsvFile(f);
    };
    const dropHandlers = (accept: (f: File | undefined) => void) => ({
        onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); },
        onDragLeave: () => setDragActive(false),
        onDrop: (e: React.DragEvent) => { e.preventDefault(); setDragActive(false); accept(e.dataTransfer.files?.[0]); },
    });
    const dropzoneCls = (active: boolean) => cx(
        'group flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-12 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40',
        active
            ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/30'
            : 'border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50/40 dark:hover:bg-blue-950/20',
    );

    const handleDiscover = async () => {
        if (!url.trim()) { showAlert('error', 'Enter a valid URL first.'); return; }
        setIsDiscovering(true);
        try {
            const fd = new FormData();
            fd.append('url', url.trim());
            const data = await authFetch('/api/train/discover', { method: 'POST', body: fd }) as any;
            const found: CrawlCandidate[] = Array.isArray(data.candidates) ? data.candidates : [];
            setEntryEstimate(Number(data?.entry?.estimated_words) || 0);
            setCandidates(found);
            setCandidateFilter('');
            setSelectedUrls(new Set());
            if (found.length === 0) showAlert('warning', 'No other pages were found on this site.');
        } catch {
            showAlert('error', 'Could not scan the page.');
        } finally {
            setIsDiscovering(false);
        }
    };

    const handleTrain = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeFile = file || csvFile;
        if (!activeFile && !trainingText.trim() && !url.trim()) {
            showAlert('error', 'Provide a URL, PDF, CSV, or text.');
            return;
        }

        setIsTraining(true);
        try {
            // Crawl fan-out: entry page + each selected same-site page, each
            // really fetched and extracted (not simulated).
            const selectedPages = candidates ? candidates.filter(c => selectedUrls.has(c.url)) : [];
            const isCrawl = !!url.trim() && selectedPages.length > 0;

            let newChunks: string[] = [];
            let successPages = 0;
            let failedPages = 0;

            if (isCrawl) {
                const pageUrls = [url.trim(), ...selectedPages.map(c => c.url)];
                const total = pageUrls.length;
                setTrainingProgress({ progress: 0, total, mode: 'crawl' });
                for (let i = 0; i < pageUrls.length; i++) {
                    try {
                        newChunks.push(...await parseUrlToChunks(pageUrls[i]));
                        successPages += 1;
                    } catch {
                        failedPages += 1;
                    }
                    setTrainingProgress({ progress: i + 1, total, mode: 'crawl' });
                }
                if (successPages === 0) {
                    throw new Error('Could not extract any content from the selected pages.');
                }
            } else if (activeFile) {
                newChunks = await parseFileToChunks(activeFile);
            } else if (url.trim()) {
                newChunks = await parseUrlToChunks(url.trim());
            } else {
                newChunks = trainingText.split(/\n{2,}/).filter(p => p.trim().length > 20);
                if (newChunks.length === 0 && trainingText.trim()) newChunks = [trainingText.trim()];
            }

            if (newChunks.length > 200) newChunks = newChunks.slice(0, 200);

            // Simulated per-segment progress tick for non-crawl sources — crawl
            // already ticked in real time above, once per page actually fetched.
            if (!isCrawl) {
                const total = newChunks.length;
                setTrainingProgress({ progress: 0, total, mode: 'segments' });
                for (let i = 1; i <= total; i++) {
                    await sleep(Math.min(600, 1400 / Math.max(total, 1)));
                    setTrainingProgress({ progress: i, total, mode: 'segments' });
                }
            }

            const merged = [...chunks, ...newChunks].slice(0, 400);
            saveKnowledge(merged);
            refresh();
            if (isCrawl) {
                const parts = [`${successPages} page(s) trained`];
                if (failedPages) parts.push(`${failedPages} failed`);
                showAlert(failedPages ? 'warning' : 'success', `${parts.join(' · ')}.`);
            } else {
                showAlert('success', `Training complete! ${newChunks.length} segment(s) committed to your bot's knowledge base.`);
            }
            setFile(null); setCsvFile(null); setTrainingText(''); setTextLabel(''); setUrl('');
            resetDiscovery();
            if (fileRef.current) fileRef.current.value = '';
            if (csvFileRef.current) csvFileRef.current.value = '';
        } catch (err: any) {
            showAlert('error', err.message || 'Failed to process.');
        } finally {
            setTrainingProgress(null);
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
        refresh();
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
                        value={fmtNum(wordsUsed)}
                        limit={fmtNum(wordLimit)}
                        unit="words"
                        progress={wordPct ?? undefined}
                        progressTone={barToneFor(wordPct)}
                        footer={wordPct !== null ? `${Math.round(wordPct)}% of storage used` : undefined}
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
                        value={fmtNum(msgUsed)}
                        unit="msgs"
                        footer="Lifetime messages across all bots"
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

                {/* Add + Manage knowledge — side by side on lg+ so an upload can be
                    verified without scrolling (matches the live dashboard). */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-5 items-start">
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
                        {activeTab === 'url' && (
                            <div className="max-w-xl">
                                <label className={labelCls}>Source URL</label>
                                <input type="url" value={url}
                                    onChange={e => { setUrl(e.target.value); if (candidates) resetDiscovery(); }}
                                    className={inputCls} placeholder="https://docs.example.com" required={activeTab === 'url'} />
                                <div className="mt-1.5 flex items-center justify-between gap-3">
                                    <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                        We'll index this page's readable content.
                                    </p>
                                    <button type="button"
                                        onClick={handleDiscover}
                                        disabled={!url.trim() || isDiscovering || isTraining}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isDiscovering
                                            ? <><div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin motion-reduce:hidden" /> Scanning…</>
                                            : <><span className="material-symbols-outlined text-[16px]">travel_explore</span> Find more pages</>}
                                    </button>
                                </div>

                                {candidates && candidates.length > 0 && (() => {
                                    const q = candidateFilter.trim().toLowerCase();
                                    const filtered = q
                                        ? candidates.filter(c => c.url.toLowerCase().includes(q) || (c.label || '').toLowerCase().includes(q))
                                        : candidates;
                                    const selectedCount = candidates.filter(c => selectedUrls.has(c.url)).length;
                                    const totalEst = entryEstimate + candidates.filter(c => selectedUrls.has(c.url)).reduce((s, c) => s + c.estimated_words, 0);
                                    return (
                                    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-3.5">
                                        <div className="flex items-center justify-between mb-2 gap-3">
                                            <p className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                                                Also add these pages?
                                                <span className="ml-1.5 font-normal text-slate-400 dark:text-slate-500">{selectedCount} of {candidates.length} selected</span>
                                            </p>
                                            <span className="shrink-0 text-[11px] text-slate-400 dark:text-slate-500">
                                                ~{fmtNum(totalEst)} words est.
                                            </span>
                                        </div>
                                        {candidates.length > 8 && (
                                            <input type="text" value={candidateFilter}
                                                onChange={e => setCandidateFilter(e.target.value)}
                                                placeholder="Filter pages…"
                                                className="mb-2 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-[12.5px] text-slate-700 dark:text-slate-200 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500/40" />
                                        )}
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <button type="button"
                                                onClick={() => setSelectedUrls(prev => { const n = new Set(prev); filtered.forEach(c => n.add(c.url)); return n; })}
                                                className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                                                Select all{q ? ' shown' : ''}
                                            </button>
                                            <span className="text-slate-300 dark:text-slate-600">·</span>
                                            <button type="button"
                                                onClick={() => setSelectedUrls(new Set())}
                                                className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:underline">
                                                Clear all
                                            </button>
                                        </div>
                                        <ul className="space-y-1 max-h-72 overflow-y-auto">
                                            {filtered.map(c => (
                                                <li key={c.url}>
                                                    <label className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-white dark:hover:bg-slate-800/60 cursor-pointer transition-colors">
                                                        <input type="checkbox" checked={selectedUrls.has(c.url)}
                                                            onChange={() => setSelectedUrls(prev => { const n = new Set(prev); n.has(c.url) ? n.delete(c.url) : n.add(c.url); return n; })}
                                                            className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500/40" />
                                                        <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700 dark:text-slate-200" title={c.url}>
                                                            {c.label || c.url}
                                                        </span>
                                                        <span className="shrink-0 text-[11px] tabular-nums text-slate-400 dark:text-slate-500">~{fmtNum(c.estimated_words)}w</span>
                                                    </label>
                                                </li>
                                            ))}
                                            {filtered.length === 0 && (
                                                <li className="px-2 py-1.5 text-[12px] text-slate-400 dark:text-slate-500">No pages match “{candidateFilter.trim()}”.</li>
                                            )}
                                        </ul>
                                        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                                            Counts are estimates; the real size is measured when each page is trained.
                                        </p>
                                    </div>
                                    );
                                })()}
                            </div>
                        )}

                        {activeTab === 'pdf' && (
                            <div>
                                <label className={labelCls}>PDF document</label>
                                <button
                                    type="button"
                                    onClick={() => fileRef.current?.click()}
                                    {...dropHandlers(acceptPdfFile)}
                                    className={dropzoneCls(dragActive)}
                                >
                                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        <span className="material-symbols-outlined text-[24px]">cloud_upload</span>
                                    </span>
                                    <div className="text-center">
                                        <p className="text-[13.5px] font-semibold text-slate-700 dark:text-slate-200">Click to upload a PDF</p>
                                        <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">PDF only · up to 10 MB</p>
                                    </div>
                                    <input type="file" ref={fileRef} className="hidden" accept=".pdf"
                                        onChange={e => acceptPdfFile(e.target.files?.[0])} />
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
                                    {...dropHandlers(acceptCsvFile)}
                                    className={dropzoneCls(dragActive)}
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
                                        onChange={e => acceptCsvFile(e.target.files?.[0])}
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
                                <div className="max-w-xl">
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

                        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800 transition-colors">
                            <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">
                                {`${fmtNum(wordsUsed)} / ${fmtNum(wordLimit)} words of storage used.`}
                            </p>
                            <button type="submit" disabled={isTraining}
                                className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 px-7 py-3 text-[13.5px] font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-[0.99]">
                                {trainingProgress ? (
                                    <>
                                        <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:hidden" />
                                        Training… {trainingProgress.progress} / {trainingProgress.total} {trainingProgress.mode === 'crawl' ? 'pages' : 'segments'}
                                    </>
                                ) : isTraining ? (
                                    <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full motion-reduce:hidden" /> Uploading…</>
                                ) : (
                                    <><span className="material-symbols-outlined text-[18px]">bolt</span> Start training</>
                                )}
                            </button>
                        </div>
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

                    <SourceBrowser
                        selectedBotId="demo"
                        authFetch={authFetch}
                        queryClient={queryClient}
                        showAlert={showAlert}
                        refreshUser={refresh}
                        isFree={false}
                    />
                </Card>
                </div>

                {/* Danger zone */}
                <Card className="p-4 sm:p-5">
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
                </Card>
            </div>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
}

export default function DemoTrainAIPage() {
    return (
        <QueryClientProvider client={queryClientProvider}>
            <DemoTrainAIInner />
        </QueryClientProvider>
    );
}
