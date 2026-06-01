'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Alert from '@/src/app/components/Alert';
import { useAuth } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { useUserRole } from '@/src/lib/context/UserContext';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import { useAuthenticatedFetch, useIsAuthReady, UpgradeError } from '@/src/lib/hooks/useAuthenticatedFetch';
import { trainUrlSchema, trainTextSchema } from '@/src/lib/validation/schemas';

const StatSkeleton = () => <div className="animate-pulse h-20 bg-slate-100 dark:bg-slate-800 transition-colors" />;
const TABS = [
    { id: 'url', label: 'URL', icon: 'public' },
    { id: 'pdf', label: 'PDF Upload', icon: 'description' },
    { id: 'csv', label: 'CSV / Excel', icon: 'table_chart' },
    { id: 'text', label: 'Text', icon: 'notes' },
];

// Grid primitives
const cellCls = 'bg-white dark:bg-slate-900 rounded-2xl transition-colors duration-500';
const inputCls = "w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 focus:bg-slate-200 dark:focus:bg-slate-700 focus:outline-none text-base text-slate-900 dark:text-slate-200 transition-colors rounded-xl";
const labelCls = "block text-base font-medium font-google text-slate-600 dark:text-slate-400 mb-2 transition-colors";

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

    if (isFree || !selectedBotId) {
        return (
            <div className="py-6 text-center">
                <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600 mb-2 block">lock</span>
                <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">Upgrade to browse knowledge sources.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {!sourcesLoading && sources.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <span className="material-symbols-outlined text-[48px] text-gray-200 dark:text-slate-700 mb-4">auto_stories</span>
                    <p className="text-base uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display mb-2">No sources yet</p>
                    <p className="text-base text-slate-400 dark:text-slate-600 font-display mb-6">Add a URL, paste text, or upload a document to start training your bot.</p>
                </div>
            )}

            {sources.length > 0 && (
                <div className="flex gap-2">
                    <select
                        value={selectedSource}
                        onChange={e => setSelectedSource(e.target.value)}
                        disabled={sourcesLoading || sources.length === 0 || isDeleting}
                        className={inputCls + ' appearance-none font-mono text-xs flex-1'}
                    >
                        {sourcesLoading && <option>Loading sources...</option>}
                        {!sourcesLoading && sources.length === 0 && <option>No knowledge sources</option>}
                        {sources.map((s: any) => (
                            <option key={s.source} value={s.source}>
                                {(s.source || 'Unknown').length > 40 ? s.source.substring(0, 37) + '...' : s.source} ({s.chunk_count} chunks)
                            </option>
                        ))}
                    </select>

                    {selectedSource && (
                        <button
                            onClick={handleDeleteSource}
                            disabled={isDeleting}
                            title="Delete this entire source (all chunks)"
                            className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/30 hover:bg-red-600 hover:text-white dark:hover:bg-red-700 transition-all rounded-xs flex items-center justify-center shrink-0"
                        >
                            <span className="material-symbols-outlined text-[18px]">delete_forever</span>
                        </button>
                    )}
                </div>
            )}

            {selectedSource && (
                <>
                    <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/30 p-4 rounded-xl">
                        <div className="flex items-center gap-2">
                             <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">
                                {selectedSource.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf'
                                    : ['.csv', '.xlsx', '.xls'].some(ext => selectedSource.toLowerCase().endsWith(ext)) ? 'table_chart'
                                    : 'language'}
                            </span>
                            <span className="text-base font-medium font-google text-slate-700 dark:text-slate-300 truncate flex-1">
                                {selectedSource}
                            </span>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <button
                                onClick={toggleAll}
                                disabled={chunks.length === 0}
                                className="flex items-center gap-1.5 text-base font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-40"
                            >
                                <span className="material-symbols-outlined text-[16px]">
                                    {selectedChunks.size === chunks.length && chunks.length > 0 ? 'check_box' : 'check_box_outline_blank'}
                                </span>
                                {selectedChunks.size === chunks.length && chunks.length > 0 ? 'Deselect all' : 'Select all'}
                            </button>
                            <span className="text-xs font-medium font-google text-slate-400 dark:text-slate-500">
                                {chunksLoading ? '…' : `${chunks.length}${totalChunks > chunks.length ? ` of ${totalChunks}` : ''} segments`}
                            </span>
                        </div>
                    </div>

                    <div className="max-h-[240px] overflow-y-auto custom-scrollbar transition-colors">
                        {chunksLoading ? (
                            <div className="p-6 text-center">
                                <div className="w-4 h-4 border-2 border-slate-300 dark:border-slate-600 border-t-slate-600 dark:border-t-slate-300 animate-spin mx-auto mb-2 rounded-full" />
                                <p className="text-lg font-semibold text-slate-400">Loading chunks...</p>
                            </div>
                        ) : chunks.length === 0 ? (
                            <div className="p-6 text-center">
                                <span className="material-symbols-outlined text-[24px] text-slate-300 dark:text-slate-600 mb-1 block">inventory_2</span>
                                <p className="text-lg font-semibold text-slate-400">No chunks for this source.</p>
                            </div>
                        ) : (
                            chunks.map((chunk: any) => (
                                <label
                                    key={chunk.id}
                                    className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${selectedChunks.has(chunk.id) ? 'bg-blue-50/50 dark:bg-blue-900/30' : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        checked={selectedChunks.has(chunk.id)}
                                        onChange={() => toggleChunk(chunk.id)}
                                        className="mt-1 shrink-0 accent-slate-900 dark:accent-blue-500"
                                    />
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 font-mono transition-colors">
                                        {chunk.content || '(empty chunk)'}
                                    </p>
                                </label>
                            ))
                        )}
                    </div>

                    {chunks.length > 0 && (
                        <button
                            onClick={handleDeleteSelected}
                            disabled={selectedChunks.size === 0 || isDeleting}
                            className="w-full py-3 min-h-[44px] rounded-xl bg-red-600 dark:bg-red-700 text-white text-base font-semibold hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                        >
                            {isDeleting ? (
                                <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Deleting...</>
                            ) : (
                                <><span className="material-symbols-outlined text-[16px]">delete_sweep</span> Delete Selected ({selectedChunks.size})</>
                            )}
                        </button>
                    )}
                </>
            )}
        </div>
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
    const isLockedOut = !ctxLoading && (userTier === 'FREE' || userTier === 'BASIC' || userTier === 'STARTER') && messagesUsed >= messageLimit && userRole !== 'SUPER_ADMIN';

    const showAlert = (type: 'success' | 'error' | 'warning' | 'development', msg: string) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 8000);
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
                            refreshUser();
                            const action = status.is_upsert ? 'Source updated!' : 'Training complete!';
                            const msg = status.truncated
                                ? `${action} ${status.chunks_added} chunks added (plan limit reached).`
                                : `${action} ${status.chunks_added} chunks committed to your bot's knowledge base.`;
                            showAlert('success', msg);
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
            `⚠️ DESTRUCTIVE ACTION\n\nThis will permanently delete ALL ${selectedBot?.chunks_used ?? 0} knowledge chunks for "${botName}".\n\nThis cannot be undone. Continue?`
        )) return;
        purgeMutation.mutate();
    };

    const isPurging = purgeMutation.isPending;

    const selectedBot = bots.find((b: any) => b.id === selectedBotId);
    const chunksUsed = selectedBot?.chunks_used ?? 0;
    const chunkLimit = (botsData as any)?.plan?.chunk_limit ?? 0;
    const chunkPct = chunkLimit > 0 && chunkLimit < 999999 ? Math.min((chunksUsed / chunkLimit) * 100, 100) : null;

    const periodEndStr = billingPeriodEnd
        ? new Date(billingPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

    return (
        <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-500">
            <div className="px-6 py-7 md:px-8 md:py-8 shrink-0 transition-colors duration-500">
                <div className="flex items-center gap-2.5 mb-2">
                    <span className="material-symbols-outlined text-[22px] text-slate-500 dark:text-slate-400 transition-colors">
                        psychology
                    </span>
                    <h1 className="text-2xl md:text-3xl font-display font-semibold tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">Train AI</h1>
                </div>
                <p className="text-base md:text-base font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">Ingest knowledge sources into your AI's vector brain.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 px-6 md:px-8 mb-6">
                {ctxLoading ? (
                    Array(4).fill(0).map((_, i) => <div key={i} className={`${cellCls} p-4 md:p-8`}><StatSkeleton /></div>)
                ) : (
                    <>
                        <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">psychology</span>
                                    <h4 className="text-base font-semibold text-slate-600 dark:text-slate-400 font-google transition-colors">Data storage</h4>
                                </div>
                                {chunkLimit >= 999999 && (
                                    <span className="px-2 py-0.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-base uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 transition-colors">∞</span>
                                )}
                            </div>
                            <div className="flex items-end gap-1 mb-3">
                                <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">{chunksUsed}</span>
                                {chunkLimit < 999999 && <span className="text-xl text-slate-600 dark:text-slate-400 mb-1 font-medium italic transition-colors">/ {chunkLimit}</span>}
                                <span className="text-base font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1 transition-colors">chunks</span>
                            </div>
                            {chunkPct !== null && (
                                <>
                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 overflow-hidden transition-colors">
                                        <motion.div initial={{ width: 0 }}
                                            animate={{ width: `${chunkPct}%` }}
                                            className={`h-full ${chunkPct >= 100 ? 'bg-red-500' : chunkPct >= 80 ? 'bg-amber-500' : 'bg-slate-900 dark:bg-blue-500'}`} />
                                    </div>
                                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-3 transition-colors">
                                        {Math.round(chunkPct)}% storage used
                                    </p>
                                </>
                            )}
                        </div>

                        <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">vital_signs</span>
                                <p className="text-base font-semibold font-google text-slate-600 dark:text-slate-400 transition-colors">AI Memory</p>
                            </div>
                            <p className="text-3xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">
                                {totalMessages ?? 0} <span className="text-base font-google font-semibold text-slate-600 dark:text-slate-400 transition-colors">msgs</span>
                            </p>
                        </div>

                        <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                            <div className="flex items-center gap-2 mb-3">
                                <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">bolt</span>
                                <p className="text-base font-semibold font-google text-slate-600 dark:text-slate-400 transition-colors">System tier</p>
                            </div>
                            <p className="text-3xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">
                                {userTier || '—'} <span className="text-base font-google font-semibold text-slate-600 dark:text-slate-400 transition-colors">plan</span>
                            </p>
                        </div>

                        <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                           <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">database</span>
                                    <h4 className="text-base font-semibold text-slate-600 dark:text-slate-400 font-google transition-colors">Total usage</h4>
                                </div>
                                {(messageLimit ?? 0) >= 999999 && (
                                    <span className="px-2 py-0.5 bg-white dark:bg-slate-950 text-base uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 transition-colors">∞</span>
                                )}
                            </div>
                            <div className="flex items-end gap-1 mb-3">
                                <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">{messagesUsed ?? 0}</span>
                                {(messageLimit ?? 0) < 999999 && <span className="text-xl text-slate-600 dark:text-slate-400 mb-1 font-medium italic transition-colors">/ {messageLimit}</span>}
                                <span className="text-base font-medium text-slate-500 dark:text-slate-400 mb-2 ml-1 transition-colors">reqs</span>
                            </div>
                            {(messageLimit ?? 0) < 999999 && (
                                <>
                                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 overflow-hidden transition-colors">
                                        <motion.div initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(((messagesUsed ?? 0) / (messageLimit ?? 1)) * 100, 100)}%` }}
                                            className={`h-full bg-slate-900 dark:bg-slate-250`} />
                                    </div>
                                    <div className="flex justify-between text-xs font-medium text-slate-500 dark:text-slate-400 mt-3 transition-colors">
                                        <span>{Math.round(((messagesUsed ?? 0) / (messageLimit ?? 1)) * 100)}% cap</span>
                                        <span className="flex items-center gap-1">
                                            <span className="material-symbols-outlined text-[12px]">schedule</span> {periodEndStr}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 px-6 md:px-8 overflow-hidden transition-colors duration-500">
                <div className={`lg:col-span-12 ${cellCls} p-4 md:p-8 relative overflow-y-auto custom-scrollbar`}>
                    {isFree && (
                        <div className="absolute inset-0 z-20 bg-[#f8f9fa]/95 dark:bg-slate-950/95 flex flex-col items-center justify-center gap-5 p-6 md:p-10 transition-colors duration-500">
                            <div className="w-12 h-12 flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                                <span className="material-symbols-outlined text-[28px] text-slate-900 dark:text-slate-200 transition-colors">
                                    lock
                                </span>
                            </div>
                            <div className="text-center">
                                <p className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2 transition-colors">Trial Plan Required</p>
                                <p className="text-base font-display text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm transition-colors">
                                    Vector training is available on Starter and Scale plans. Unlock your bot's brain today.
                                </p>
                            </div>
                            <a href="/dashboard/pricing" className="px-7 py-3 bg-slate-900 dark:bg-white text-white dark:text-black text-base font-semibold rounded-xl hover:opacity-90 transition-all flex items-center active:scale-95">
                                Upgrade now
                            </a>
                        </div>
                    )}

                    <h2 className="text-lg font-semibold font-display text-slate-900 dark:text-slate-200 mb-5 transition-colors">Knowledge sources</h2>

                    <div className="flex mb-6 overflow-x-auto transition-colors bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-1">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 px-3 text-base font-medium font-google rounded-lg transition-colors min-h-[40px] shrink-0 ${activeTab === t.id
                                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}>
                                <span className="material-symbols-outlined text-[17px]">{t.icon}</span>
                                <span className="hidden sm:inline">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    {bots.length > 1 && (
                        <div className="mb-5">
                            <label className={labelCls}>Training Target Bot</label>
                            <select
                                value={selectedBotId}
                                onChange={e => setSelectedBotId(e.target.value)}
                                className={inputCls + ' appearance-none font-mono'}
                            >
                                {bots.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.bot_name} — {b.company_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <form onSubmit={handleTrain} className="space-y-4">
                        {activeTab === 'url' && (
                            <div>
                                <label className={labelCls}>Source URL</label>
                                <input type="url" value={url} onChange={e => setUrl(e.target.value)} className={inputCls + ' text-base font-google tracking-wide'} placeholder="https://docs.example.com" />
                            </div>
                        )}
                        {activeTab === 'pdf' && (
                            <div>
                                <label className={labelCls}>PDF Archive</label>
                                <div onClick={() => fileRef.current?.click()}
                                    className="flex flex-col items-center justify-center gap-3 px-4 py-6 md:px-6 md:py-8 bg-[#f1f3f5]/70 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                                    <span className="material-symbols-outlined text-[32px] text-slate-600 dark:text-slate-400 transition-colors">
                                        cloud_upload
                                    </span>
                                    <div className="text-center w-full">
                                        <p className="text-base text-slate-700 dark:text-slate-300 font-google transition-colors break-all">{file ? file.name : 'Drop PDF here'}</p>
                                        <p className="text-base uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-0.5 transition-colors">or click to browse</p>
                                        <p className="text-base font-medium font-google text-slate-600 dark:text-slate-400 mt-0.5 transition-colors">Only 10MB</p>
                                    </div>
                                    <input type="file" ref={fileRef} className="hidden" accept=".pdf"
                                        onChange={e => { const f = e.target.files?.[0]; if (f?.type === 'application/pdf') setFile(f); else showAlert('error', 'Please select a valid PDF.'); }} />
                                </div>
                                {file && (
                                    <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                                        className="mt-2 flex items-center gap-1 text-base font-google text-red-500 hover:text-red-700">
                                        <span className="material-symbols-outlined text-[16px]">close</span> Remove {file.name}
                                    </button>
                                )}
                            </div>
                        )}
                        {activeTab === 'csv' && (
                            <div>
                                <label className={labelCls}>CSV / Excel File</label>
                                <div onClick={() => csvFileRef.current?.click()}
                                    className="flex flex-col items-center justify-center gap-3 px-4 py-6 md:px-6 md:py-8 bg-[#f1f3f5]/70 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors">
                                    <span className="material-symbols-outlined text-[32px] text-slate-600 dark:text-slate-400 transition-colors">table_chart</span>
                                    <div className="text-center w-full">
                                        <p className="text-base text-slate-700 dark:text-slate-300 font-google transition-colors break-all">
                                            {csvFile ? csvFile.name : 'Drop CSV or Excel file here'}
                                        </p>
                                        <p className="text-base uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-0.5 transition-colors">or click to browse</p>
                                        <p className="text-base font-medium font-google text-slate-600 dark:text-slate-400 mt-0.5 transition-colors">.csv, .xlsx, .xls — max 5 MB</p>
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
                                </div>
                                {csvFile && (
                                    <button type="button" onClick={() => { setCsvFile(null); if (csvFileRef.current) csvFileRef.current.value = ''; }}
                                        className="mt-2 flex items-center gap-1 text-base font-google text-red-500 hover:text-red-700">
                                        <span className="material-symbols-outlined text-[16px]">close</span> Remove {csvFile.name}
                                    </button>
                                )}
                                {csvFile && (
                                    <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 flex items-start gap-2">
                                        <span className="material-symbols-outlined text-[15px] text-blue-500 mt-0.5 shrink-0">info</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 font-google leading-relaxed">
                                            Each row becomes one knowledge chunk. Make sure your file has a <span className="font-bold">header row</span> (column names in row 1). Re-uploading the same filename will safely replace the previous version.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'text' && (
                            <div className="space-y-3">
                                <div>
                                    <label className={labelCls}>Source Label <span className="normal-case text-slate-400 dark:text-slate-500 font-normal tracking-normal">(optional)</span></label>
                                    <input
                                        type="text"
                                        value={textLabel}
                                        onChange={e => setTextLabel(e.target.value)}
                                        className={inputCls + ' font-mono text-xs'}
                                        placeholder="e.g. faq-returns, pricing-2025"
                                    />
                                    <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500 font-google leading-relaxed">
                                        {textLabel.trim()
                                            ? <>Re-uploading with label <span className="font-mono font-bold text-slate-600 dark:text-slate-300">"{textLabel.trim()}"</span> will safely replace only that source.</>
                                            : 'Without a label, re-submitting will overwrite all previous unlabelled text entries.'}
                                    </p>
                                </div>
                                <div>
                                    <label className={labelCls}>Knowledge Text</label>
                                    <textarea value={trainingText} onChange={e => setTrainingText(e.target.value)}
                                        rows={6} className={inputCls + ' resize-none font-google'} placeholder="Paste your FAQs, services, or raw knowledge here..." />
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
                            className="w-full py-3.5 min-h-[48px] rounded-xl bg-linear-to-r from-blue-600 to-green-600 text-white text-base font-medium hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]">
                            {trainingJobId ? (
                                <>
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Training… {trainingProgress?.progress ?? 0} / {trainingProgress?.total ?? '?'} chunks
                                </>
                            ) : trainMutation.isPending ? (
                                <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full" /> Uploading…</>
                            ) : isLockedOut ? 'Quota exceeded' : 'Start training'}
                        </button>
                    </form>
                </div>
            </div>

            <div className={`${cellCls} p-6 md:p-8 mx-6 md:mx-8 my-6 flex-1 overflow-y-auto custom-scrollbar`}>
                <div className="flex items-center gap-2.5 mb-5">
                    <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400 transition-colors">folder_open</span>
                    <h2 className="text-lg font-semibold font-google text-slate-900 dark:text-slate-200 transition-colors">Manage knowledge</h2>
                </div>

                <SourceBrowser
                    selectedBotId={selectedBotId}
                    authFetch={authFetch}
                    queryClient={queryClient}
                    showAlert={showAlert}
                    refreshUser={refreshUser}
                    isFree={isFree}
                />

                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 transition-colors">
                    <div className="flex items-start gap-3 mb-4 p-4 bg-red-50/50 dark:bg-red-900/10 rounded-xl transition-colors">
                        <span className="material-symbols-outlined text-[18px] text-red-500 dark:text-red-400 shrink-0 mt-0.5 transition-colors">
                            delete_forever
                        </span>
                        <p className="text-base font-medium text-red-600 dark:text-red-400 font-sans leading-relaxed transition-colors">
                            Deleting permanently removes all trained data for this bot. This action cannot be undone.
                        </p>
                    </div>
                    <button
                        onClick={handlePurge}
                        disabled={isPurging || isFree || !selectedBotId || chunksUsed === 0}
                        className="w-full py-3.5 min-h-[48px] rounded-xl bg-red-600 dark:bg-red-700 text-white text-base font-semibold hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                        {isPurging ? (
                            <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white animate-spin rounded-full" /> Deleting…</>
                        ) : (
                            <><span className="material-symbols-outlined text-[18px]">delete</span> Delete all knowledge ({chunksUsed})</>
                        )}
                    </button>
                </div>
            </div>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
}
