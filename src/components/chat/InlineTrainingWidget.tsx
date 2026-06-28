'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@clerk/nextjs';
import UpgradePrompt from '@/src/components/features/UpgradePrompt';
import { UpgradeError } from '@/src/lib/errors';

interface InlineTrainingWidgetProps {
    selectedBotId: string;
    query: string;
    authFetch: any;
    onSuccess?: () => void;
    onCancel?: () => void;
}

export default function InlineTrainingWidget({
    selectedBotId,
    query,
    authFetch,
    onSuccess,
    onCancel
}: InlineTrainingWidgetProps) {
    const { getToken } = useAuth();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'quick' | 'pdf'>('quick');
    const [answerText, setAnswerText] = useState('');
    const [file, setFile] = useState<File | null>(null);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [upgradeError, setUpgradeError] = useState<any>(null);
    const [jobId, setJobId] = useState<string | null>(null);
    const [jobStatus, setJobStatus] = useState<string>('');

    const fileRef = useRef<HTMLInputElement>(null);
    const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
    const baseUrl = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL?.trim() || '');

    useEffect(() => {
        return () => {
            if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
        };
    }, []);

    const pollJobStatus = async (jId: string) => {
        try {
            const token = await getToken();
            const res = await fetch(`${baseUrl}/api/train/status/${jId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });

            if (res.status === 429) {
                pollTimerRef.current = setTimeout(() => pollJobStatus(jId), 4000);
                return;
            }

            const data = await res.json();
            if (data.status === 'done') {
                setJobId(null);
                setJobStatus('');
                setSuccessMessage(data.is_upsert ? 'Knowledge source updated successfully!' : 'Training completed! Facts added to bot.');
                queryClient.invalidateQueries({ queryKey: ['bots'] });
                queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedBotId] });
                queryClient.invalidateQueries({ queryKey: ['knowledge-chunks', selectedBotId] });
                queryClient.invalidateQueries({ queryKey: ['conversations', selectedBotId] });
                queryClient.invalidateQueries({ queryKey: ['fixes-needed', selectedBotId] });
                if (onSuccess) onSuccess();
            } else if (data.status === 'error') {
                setJobId(null);
                setJobStatus('');
                setError(data.message || 'Training job failed.');
            } else {
                setJobStatus(data.status || 'processing');
                pollTimerRef.current = setTimeout(() => pollJobStatus(jId), 3000);
            }
        } catch (err) {
            setJobId(null);
            setJobStatus('');
            setError('Failed to fetch training status.');
        }
    };

    const trainMutation = useMutation({
        mutationFn: async () => {
            const token = await getToken();
            const fd = new FormData();
            fd.append('company_id', selectedBotId);

            if (activeTab === 'quick') {
                if (!answerText.trim()) throw new Error('Answer text cannot be empty.');
                const trainedText = `When a user asks: "${query}"\nAnswer: ${answerText.trim()}`;
                fd.append('text', trainedText);
                fd.append('text_label', `faq-inline-${Date.now()}`);
            } else {
                if (!file) throw new Error('Please select a PDF file.');
                if (file.size > 10 * 1024 * 1024) throw new Error('File exceeds 10MB limit.');
                fd.append('file', file);
            }

            const res = await fetch(`${baseUrl}/api/train`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: fd,
            });

            const data = await res.json();
            if (!res.ok) {
                if (res.status === 402) {
                    const detail = data?.detail;
                    throw new UpgradeError(
                        typeof detail === 'object' && detail?.code
                            ? detail
                            : { code: 'CHUNK_LIMIT_EXCEEDED', message: typeof detail === 'string' ? detail : 'Storage limit reached.', tier: '', current: null, limit: null }
                    );
                }
                throw new Error(data.detail?.message || data.detail || 'Training failed.');
            }
            return data;
        },
        onSuccess: (data) => {
            if (data.job_id) {
                setJobId(data.job_id);
                setJobStatus('queued');
                pollJobStatus(data.job_id);
            } else {
                setSuccessMessage('Successfully trained your bot!');
                queryClient.invalidateQueries({ queryKey: ['bots'] });
                queryClient.invalidateQueries({ queryKey: ['knowledge-sources', selectedBotId] });
                queryClient.invalidateQueries({ queryKey: ['knowledge-chunks', selectedBotId] });
                queryClient.invalidateQueries({ queryKey: ['conversations', selectedBotId] });
                queryClient.invalidateQueries({ queryKey: ['fixes-needed', selectedBotId] });
                if (onSuccess) onSuccess();
            }
        },
        onError: (err: any) => {
            if (err instanceof UpgradeError) {
                setUpgradeError(err);
            } else {
                setError(err.message || 'Something went wrong.');
            }
        }
    });

    const isPending = trainMutation.isPending || !!jobId;

    if (upgradeError) {
        return (
            <div className="p-4 border border-rose-100 dark:border-rose-900/30 bg-rose-50/50 dark:bg-rose-950/10 rounded-xl">
                <UpgradePrompt
                    code={upgradeError.code}
                    tier={upgradeError.tier}
                    current={upgradeError.current}
                    limit={upgradeError.limit}
                    mode="inline"
                    onDismiss={() => setUpgradeError(null)}
                />
            </div>
        );
    }

    return (
        <div className="w-full bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-col gap-3 transition-all">
            <div className="flex items-center justify-between">
                <span className="text-xs font-semibold font-google text-slate-700 dark:text-slate-300">
                    Teach Vaayu AI the Answer
                </span>
                <div className="flex gap-1">
                    <button
                        type="button"
                        onClick={() => setActiveTab('quick')}
                        disabled={isPending}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'quick' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Write Answer
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('pdf')}
                        disabled={isPending}
                        className={`px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition-all ${activeTab === 'pdf' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        Upload PDF
                    </button>
                </div>
            </div>

            {error && (
                <div className="p-2.5 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/10 border border-rose-100 dark:border-rose-800/30 rounded-lg flex items-center justify-between">
                    <span>{error}</span>
                    <button onClick={() => setError('')} className="material-symbols-outlined text-[14px]">close</button>
                </div>
            )}

            {successMessage && (
                <div className="p-2.5 text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30 rounded-lg flex items-center justify-between">
                    <span>{successMessage}</span>
                    <button onClick={() => setSuccessMessage('')} className="material-symbols-outlined text-[14px]">close</button>
                </div>
            )}

            {activeTab === 'quick' ? (
                <div className="flex flex-col gap-2">
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-semibold">Question:</span> "{query}"
                    </div>
                    <textarea
                        rows={3}
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        disabled={isPending}
                        placeholder="Provide the facts or response that Vaayu should use to answer this..."
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-1 focus:ring-blue-500 focus:outline-none rounded-xl text-slate-900 dark:text-slate-200 transition-all resize-none"
                    />
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <div
                        onClick={() => !isPending && fileRef.current?.click()}
                        className={`flex flex-col items-center justify-center p-4 border border-dashed rounded-xl transition-all cursor-pointer ${file ? 'border-blue-400 bg-blue-50/20' : 'border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                    >
                        <span className="material-symbols-outlined text-[24px] text-slate-500 dark:text-slate-400">
                            cloud_upload
                        </span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 text-center mt-1">
                            {file ? file.name : 'Choose PDF file'}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500">Max 10MB</span>
                        <input
                            type="file"
                            ref={fileRef}
                            className="hidden"
                            accept=".pdf"
                            onChange={(e) => {
                                const f = e.target.files?.[0];
                                if (f && f.type === 'application/pdf') {
                                    setFile(f);
                                    setError('');
                                } else if (f) {
                                    setError('Please select a valid PDF file.');
                                    setFile(null);
                                }
                            }}
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-end gap-2 mt-1">
                {onCancel && (
                    <button
                        type="button"
                        disabled={isPending}
                        onClick={onCancel}
                        className="px-3 py-1.5 border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 rounded-lg text-xs font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                        Cancel
                    </button>
                )}
                <button
                    type="button"
                    disabled={isPending || (activeTab === 'quick' ? !answerText.trim() : !file)}
                    onClick={() => trainMutation.mutate()}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                    {isPending ? (
                        <>
                            <div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin rounded-full" />
                            {jobStatus ? `Training (${jobStatus})...` : 'Submitting...'}
                        </>
                    ) : (
                        'Save & Train'
                    )}
                </button>
            </div>
        </div>
    );
}
