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
import { useBotSwitcher } from '@/src/lib/context/BotSwitcherContext';

import SourceBrowser from '@/src/components/dashboard/SourceBrowser';
import CatalogBrowser from '@/src/components/dashboard/CatalogBrowser';
import { StatCard, StatSkeleton, TONE, NOISE_BG } from '@/src/components/dashboard/TrainStatCard';


const TABS = [
    { id: 'url', label: 'URL', icon: 'public' },
    { id: 'pdf', label: 'PDF Upload', icon: 'description' },
    { id: 'csv', label: 'CSV / Excel', icon: 'table_chart' },
    { id: 'text', label: 'Text', icon: 'notes' },
];

// Form primitives — aligned to the Insights input language.
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



// ── Catalog viewer ──────────────────────────────────────────────────────────
// Vertical bots (chemical, …) route catalog-shaped uploads into structured
// tables (product_skus / products) instead of RAG, so those rows never appear
// in "Manage knowledge". This read-only viewer surfaces them. It self-hides for
// non-vertical bots (the API returns no tables) and for empty catalogs.


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
    const { bots, selectedBotId, setSelectedBotId } = useBotSwitcher();
    const [upgradeError, setUpgradeError] = useState<UpgradeError | null>(null);
    const [trainingJobId, setTrainingJobId] = useState<string | null>(null);
    const [trainingProgress, setTrainingProgress] = useState<any>(null);
    // Multi-page crawl discovery (Phase 3): candidate same-site pages harvested
    // from the entry URL, with an estimated word cost. Selection drives the crawl
    // fan-out; null means no discovery has run for the current URL.
    type CrawlCandidate = { url: string; label: string; estimated_words: number };
    const [candidates, setCandidates] = useState<CrawlCandidate[] | null>(null);
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());
    const [entryEstimate, setEntryEstimate] = useState<number>(0);
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
        if (botId && botId !== selectedBotId && bots.some((b: any) => b.id === botId)) {
            setSelectedBotId(botId);
        }
    }, [searchParams, bots, selectedBotId, setSelectedBotId]);

    const fileRef = useRef<HTMLInputElement>(null);
    const csvFileRef = useRef<HTMLInputElement>(null);
    const baseUrl = (typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL?.trim() || ''));

    // Same queryKey as AppLayout's bot-list fetch, so this shares its cache
    // entry instead of double-fetching — only used here for plan-level fields
    // (word_limit, speed_tier) that BotSwitcherContext doesn't carry.
    const { data: botsData } = useQuery({
        queryKey: ['bots'],
        queryFn: () => authFetch('/api/companies'),
        enabled: isAuthReady,
    });

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

    // Drag-and-drop for the PDF/CSV dropzones — same validation as the click
    // path. Only one dropzone is visible at a time, so a single flag suffices.
    const [dragActive, setDragActive] = useState(false);

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

    const resetDiscovery = () => { setCandidates(null); setSelectedUrls(new Set()); setEntryEstimate(0); };

    const discoverMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const fd = new FormData();
            fd.append('url', url.trim());
            if (selectedBotId) fd.append('company_id', selectedBotId);
            const res = await fetch(`${baseUrl}/api/train/discover`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail?.message || data.detail || 'Could not scan the page.');
            return data;
        },
        onSuccess: (data) => {
            const found: CrawlCandidate[] = Array.isArray(data.candidates) ? data.candidates : [];
            setEntryEstimate(Number(data?.entry?.estimated_words) || 0);
            setCandidates(found);
            // Default every discovered page on — the owner opted into finding them.
            setSelectedUrls(new Set(found.map(c => c.url)));
            if (found.length === 0) showAlert('warning', 'No extra contact/about/hours pages were found on this site.');
        },
        onError: (err: any) => showAlert('error', err.message || 'Could not scan the page.'),
    });

    const trainMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const fd = new FormData();
            // Crawl fan-out: entry page + selected same-site pages, one job per source.
            const crawlUrls = candidates && selectedUrls.size > 0
                ? [url.trim(), ...candidates.filter(c => selectedUrls.has(c.url)).map(c => c.url)]
                : null;
            if (crawlUrls) fd.append('urls', JSON.stringify(crawlUrls));
            else if (url.trim()) fd.append('url', url.trim());
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
                        : { code: 'WORD_LIMIT_EXCEEDED', message: typeof detail === 'string' ? detail : 'Word limit reached.', tier: '', current: null, limit: null };
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
                setTrainingProgress({ status: 'queued', progress: 0, total: 0, mode: data.mode });
                setUrl(''); setTrainingText(''); setFile(null); setCsvFile(null); setTextLabel('');
                resetDiscovery();
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
                            // Crawl fan-out reports per-page outcomes rather than a single
                            // segment count; summarise trained / skipped / failed pages.
                            if (Array.isArray(status.trained)) {
                                const trained = status.trained.length;
                                const skipped = (status.skipped_quota?.length ?? 0);
                                const failed = (status.failed?.length ?? 0);
                                const parts = [`${trained} page(s) trained`];
                                if (skipped) parts.push(`${skipped} skipped (quota full)`);
                                if (failed) parts.push(`${failed} failed`);
                                showAlert(skipped || failed ? 'warning' : 'success', `${parts.join(' · ')}.`);
                                return;
                            }
                            const action = status.is_upsert ? 'Source updated!' : 'Training complete!';
                            const attention = warnings.length > 0 ? ` ${warnings.length} sheet issue(s) need attention — see below.` : '';
                            const msg = status.truncated
                                ? `${action} ${status.chunks_added} segments added (plan limit reached).${attention}`
                                : `${action} ${status.chunks_added} segments committed to your bot's knowledge base.${attention}`;
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

    const selectedBotUsage = ((botsData as any)?.bots || []).find((b: any) => b.id === selectedBotId);
    const chunksUsed = selectedBotUsage?.chunks_used ?? 0;
    const wordsUsed = selectedBotUsage?.words_used ?? 0;
    const wordLimit = (botsData as any)?.plan?.word_limit ?? 0;
    const wordUnlimited = wordLimit >= 10000000;
    const wordPct = wordLimit > 0 && !wordUnlimited ? Math.min((wordsUsed / wordLimit) * 100, 100) : null;

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
                                value={fmtNum(wordsUsed)}
                                limit={wordUnlimited ? undefined : fmtNum(wordLimit)}
                                unit="words"
                                progress={wordPct}
                                progressTone={barToneFor(wordPct)}
                                badge={wordUnlimited ? <Badge tone="ok" dot={false}>Unlimited</Badge> : undefined}
                                footer={
                                    wordPct !== null
                                        ? `${Math.round(wordPct)}% of storage used`
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

                {/* Add + Manage knowledge — the two halves of one workflow, side by
                    side on lg+ so an upload can be verified without scrolling. */}
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-5 items-start">
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
                            <div className="max-w-xl">
                                <label className={labelCls}>Source URL</label>
                                <input type="url" value={url}
                                    onChange={e => { setUrl(e.target.value); if (candidates) resetDiscovery(); }}
                                    className={inputCls} placeholder="https://docs.example.com" />
                                <div className="mt-1.5 flex items-center justify-between gap-3">
                                    <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                        We'll index this page's readable content.
                                    </p>
                                    <button type="button"
                                        onClick={() => { const r = trainUrlSchema.safeParse(url.trim()); if (!r.success) { showAlert('error', r.error.issues[0]?.message || 'Enter a valid URL first.'); return; } discoverMutation.mutate(); }}
                                        disabled={!url.trim() || discoverMutation.isPending || isTraining}
                                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-slate-700 dark:text-slate-200 hover:border-blue-400 dark:hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                        {discoverMutation.isPending
                                            ? <><div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin motion-reduce:hidden" /> Scanning…</>
                                            : <><span className="material-symbols-outlined text-[16px]">travel_explore</span> Find more pages</>}
                                    </button>
                                </div>

                                {candidates && candidates.length > 0 && (
                                    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 p-3.5">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-[12.5px] font-semibold text-slate-700 dark:text-slate-200">
                                                Also add these pages?
                                            </p>
                                            <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                                ~{fmtNum(entryEstimate + candidates.filter(c => selectedUrls.has(c.url)).reduce((s, c) => s + c.estimated_words, 0))} words est.
                                            </span>
                                        </div>
                                        <ul className="space-y-1">
                                            {candidates.map(c => (
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
                                        </ul>
                                        <p className="mt-2 text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                                            Counts are estimates; the real size is measured when each page is trained.
                                        </p>
                                    </div>
                                )}
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

                        <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-4 border-t border-slate-200/80 dark:border-slate-800 transition-colors">
                        <p className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug">
                            {isLockedOut
                                ? 'Monthly request quota reached — upgrade to keep training.'
                                : wordUnlimited
                                    ? 'Unlimited knowledge storage on your plan.'
                                    : `${fmtNum(wordsUsed)} / ${fmtNum(wordLimit)} words of storage used.`}
                        </p>
                        <button type="submit" disabled={isTraining || isLockedOut}
                            className="inline-flex w-full sm:w-auto shrink-0 items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-blue-600 to-emerald-600 px-7 py-3 text-[13.5px] font-semibold text-white hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 active:scale-[0.99]">
                            {trainingJobId ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin motion-reduce:hidden" />
                                    Training… {trainingProgress?.progress ?? 0} / {trainingProgress?.total ?? '?'} {trainingProgress?.mode === 'crawl' ? 'pages' : 'segments'}
                                </>
                            ) : trainMutation.isPending ? (
                                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full motion-reduce:hidden" /> Uploading…</>
                            ) : isLockedOut ? 'Quota exceeded' : (
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
                        selectedBotId={selectedBotId}
                        authFetch={authFetch}
                        queryClient={queryClient}
                        showAlert={showAlert}
                        refreshUser={refreshUser}
                        isFree={isFree}
                    />
                </Card>
                </div>

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
                </Card>
            </div>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
}
