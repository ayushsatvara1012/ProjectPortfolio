'use client';

import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { parseFileToChunks } from '@/src/lib/demo/demoRag';
import { saveKnowledge, getKnowledge, clearKnowledge, getBotConfig } from '@/src/lib/demo/demoStorage';

const TABS = [
    { id: 'pdf', label: 'PDF Upload', icon: 'description' },
    { id: 'csv', label: 'CSV / Excel', icon: 'table_chart' },
    { id: 'text', label: 'Text', icon: 'notes' },
];

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';
const inputCls = "w-full px-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 focus:border-slate-400 dark:focus:border-blue-400 text-sm text-slate-900 dark:text-slate-200 transition-colors rounded-sm";
const labelCls = "block text-md uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-1.5 transition-colors font-bold";

export default function DemoTrainAIPage() {
    const router = useRouter();
    const botConfig = getBotConfig();
    const chunks = getKnowledge();
    const chunksUsed = chunks.length;
    const chunkLimit = 200;
    const chunkPct = Math.min((chunksUsed / chunkLimit) * 100, 100);

    const [activeTab, setActiveTab] = useState('pdf');
    const [file, setFile] = useState<File | null>(null);
    const [csvFile, setCsvFile] = useState<File | null>(null);
    const [trainingText, setTrainingText] = useState('');
    const [status, setStatus] = useState<null | 'processing' | 'done' | 'error'>(null);
    const [statusMsg, setStatusMsg] = useState('');

    const fileRef = useRef<HTMLInputElement>(null);
    const csvFileRef = useRef<HTMLInputElement>(null);

    const handleTrain = async (e: React.FormEvent) => {
        e.preventDefault();
        const activeFile = file || csvFile;
        if (!activeFile && !trainingText.trim()) return;

        setStatus('processing');
        setStatusMsg('Parsing and indexing...');
        try {
            let newChunks: string[];
            if (activeFile) {
                newChunks = await parseFileToChunks(activeFile);
            } else {
                newChunks = trainingText.split(/\n{2,}/).filter(p => p.trim().length > 20);
            }
            if (newChunks.length > 200) newChunks = newChunks.slice(0, 200);
            saveKnowledge(newChunks);
            setStatus('done');
            setStatusMsg(`Training complete! ${newChunks.length} segments indexed.`);
            setFile(null); setCsvFile(null); setTrainingText('');
        } catch (err: any) {
            setStatus('error');
            setStatusMsg(err.message || 'Failed to process.');
        }
    };

    const handlePurge = () => {
        if (!confirm('Clear all knowledge?')) return;
        clearKnowledge();
        setStatus(null);
    };

    return (
        <div className="flex flex-col bg-[#E8EBF0] dark:bg-slate-900 min-h-full">
            <div className="bg-white dark:bg-slate-950 px-8 py-6 border-b border-gray-100 dark:border-slate-800">
                <h1 className="text-2xl font-bold">Train AI</h1>
                <p className="text-sm text-slate-500">Upload documents and your demo bot will answer questions instantly (In-Browser).</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-gray-200/30 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800">
                <div className={`${cellCls} px-4 py-3 sm:px-6 sm:py-4`}>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2">Storage</p>
                    <div className="flex items-end gap-1 mb-2">
                        <span className="text-3xl font-bold text-slate-900 dark:text-slate-200">{chunksUsed}</span>
                        <span className="text-sm text-slate-400 dark:text-slate-500 mb-1">/ {chunkLimit}</span>
                    </div>
                    <div className="h-1 bg-slate-100 dark:bg-slate-800 w-full overflow-hidden">
                        <div className="h-full bg-blue-500 transition-all" style={{ width: `${chunkPct}%` }} />
                    </div>
                </div>
                <div className={`${cellCls} px-4 py-3 sm:px-6 sm:py-4`}><p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2">Memory</p><p className="text-2xl font-bold text-slate-900 dark:text-slate-200">{chunksUsed} segments</p></div>
                <div className={`${cellCls} px-4 py-3 sm:px-6 sm:py-4`}><p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2">Plan</p><p className="text-2xl font-bold text-amber-500">DEMO</p></div>
                <div className={`${cellCls} px-4 py-3 sm:px-6 sm:py-4`}><p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 mb-2">Bot</p><p className="text-2xl font-bold truncate text-slate-900 dark:text-slate-200">{botConfig.name}</p></div>
            </div>

            <div className="p-4 sm:p-8 space-y-8">
                <div className={`${cellCls} p-6 sm:p-8 border border-gray-100 dark:border-slate-800`}>
                    {status && (
                        <div className={`mb-6 p-4 border flex justify-between items-center ${
                            status === 'done' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/30'
                            : status === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/30'
                            : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900/30'
                        }`}>
                           <span className="text-sm">{statusMsg}</span>
                           {status === 'done' && <button onClick={() => router.push('/demo/chat')} className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold uppercase hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors">Chat Now →</button>}
                        </div>
                    )}

                    <div className="flex border border-gray-100 dark:border-slate-800 mb-6">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)} className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 ${activeTab === t.id ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
                                <span className="hidden sm:inline">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleTrain} className="space-y-6">
                        {(activeTab === 'pdf' || activeTab === 'csv') && (
                            <div onClick={() => (activeTab === 'pdf' ? fileRef : csvFileRef).current?.click()} className="h-40 border-2 border-dashed border-gray-100 dark:border-slate-700 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <span className="material-symbols-outlined text-[32px] text-slate-400 dark:text-slate-500 mb-2">cloud_upload</span>
                                <p className="text-sm font-bold text-slate-600 dark:text-slate-400">{(activeTab === 'pdf' ? file : csvFile)?.name || `Upload ${activeTab.toUpperCase()}`}</p>
                                <input type="file" ref={activeTab === 'pdf' ? fileRef : csvFileRef} className="hidden" accept={activeTab === 'pdf' ? '.pdf' : '.csv,.xlsx,.xls'} onChange={e => {
                                    const f = e.target.files?.[0];
                                    if (f) activeTab === 'pdf' ? setFile(f) : setCsvFile(f);
                                }} />
                            </div>
                        )}
                        {activeTab === 'text' && <textarea rows={6} className={inputCls} placeholder="Paste knowledge here..." value={trainingText} onChange={e => setTrainingText(e.target.value)} />}
                        <button type="submit" className="w-full py-4 bg-blue-600 text-white font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors">Train AI Sequence</button>
                    </form>
                </div>

                {chunksUsed > 0 && (
                    <div className="space-y-4">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-200">Knowledge Segments</h2>
                        <div className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 divide-y divide-gray-100 dark:divide-slate-800 max-h-60 overflow-auto">
                            {chunks.slice(0, 50).map((c: string, i: number) => <div key={i} className="p-4 text-xs font-mono text-slate-700 dark:text-slate-300">{c}</div>)}
                        </div>
                        <button onClick={handlePurge} className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold uppercase text-xs tracking-widest transition-colors">Purge Knowledge Base</button>
                    </div>
                )}
            </div>
        </div>
    );
}
