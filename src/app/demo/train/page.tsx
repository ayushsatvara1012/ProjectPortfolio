'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { parseFileToChunks } from '@/src/lib/demo/demoRag';
import { saveKnowledge, getKnowledge, clearKnowledge, getBotConfig } from '@/src/lib/demo/demoStorage';

const TABS = [
    { id: 'pdf', label: 'PDF Upload', icon: 'description' },
    { id: 'csv', label: 'CSV / Excel', icon: 'table_chart' },
    { id: 'text', label: 'Text', icon: 'notes' },
];

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';
const inputCls = "w-full px-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 focus:border-slate-400 dark:focus:border-blue-400 text-sm text-slate-900 dark:text-slate-200 transition-colors rounded-sm";
const labelCls = "block text-md font-google uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-1.5 transition-colors";

const StatSkeleton = () => <div className="animate-pulse h-20 bg-slate-100 dark:bg-slate-800 transition-colors" />;

export default function DemoTrainAIPage() {
    const [botConfig, setBotConfig] = React.useState<any>(null);
    const [chunks, setChunks] = React.useState<any[]>([]);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setBotConfig(getBotConfig());
        setChunks(getKnowledge());
        setMounted(true);
    }, []);

    const [activeTab, setActiveTab] = React.useState('pdf');
    const [file, setFile] = React.useState<File | null>(null);
    const [csvFile, setCsvFile] = React.useState<File | null>(null);
    const [trainingText, setTrainingText] = React.useState('');
    const [textLabel, setTextLabel] = React.useState('');
    const [isTraining, setIsTraining] = React.useState(false);
    const [isPurging, setIsPurging] = React.useState(false);
    const [alert, setAlert] = React.useState<{ open: boolean; type: 'success' | 'error' | 'warning'; msg: string }>({ open: false, type: 'success', msg: '' });

    // Re-read from storage on every render so state updates reflect immediately
    const chunksUsed = chunks.length;
    const chunkLimit = 200;
    const chunkPct = chunkLimit > 0 ? Math.min((chunksUsed / chunkLimit) * 100, 100) : null;

    const [, forceUpdate] = React.useState(0);
    const refresh = () => forceUpdate(n => n + 1);

    const fileRef = React.useRef<HTMLInputElement>(null);
    const csvFileRef = React.useRef<HTMLInputElement>(null);

    const showAlert = (type: 'success' | 'error' | 'warning', msg: string) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 8000);
    };

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
            showAlert('success', `Training complete! ${newChunks.length} chunks committed to your bot's knowledge base.`);
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
            `⚠️ DESTRUCTIVE ACTION\n\nThis will permanently delete ALL ${chunksUsed} knowledge chunks for "${botConfig.name}".\n\nThis cannot be undone. Continue?`
        )) return;
        setIsPurging(true);
        clearKnowledge();
        refresh();
        setIsPurging(false);
        showAlert('success', 'Knowledge purged successfully.');
    };

    // ── Source Browser (local demo version) ─────────────────────────────────
    const DemoSourceBrowser = () => {
        const allChunks = getKnowledge();
        const [selectedChunks, setSelectedChunks] = React.useState(new Set<number>());

        const toggleChunk = (i: number) => {
            setSelectedChunks(prev => {
                const next = new Set(prev);
                if (next.has(i)) next.delete(i); else next.add(i);
                return next;
            });
        };

        const toggleAll = () => {
            if (selectedChunks.size === allChunks.length) {
                setSelectedChunks(new Set());
            } else {
                setSelectedChunks(new Set(allChunks.map((_: string, i: number) => i)));
            }
        };

        const handleDeleteSelected = () => {
            if (selectedChunks.size === 0) return;
            if (!window.confirm(`Delete ${selectedChunks.size} selected chunk(s)? This cannot be undone.`)) return;
            const remaining = allChunks.filter((_: string, i: number) => !selectedChunks.has(i));
            saveKnowledge(remaining);
            refresh();
            showAlert('success', `${selectedChunks.size} chunk(s) deleted successfully.`);
        };

        if (allChunks.length === 0) {
            return (
                <div className="py-6 text-center">
                    <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600 mb-2 block">inventory_2</span>
                    <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">No knowledge chunks yet.</p>
                </div>
            );
        }

        return (
            <div className="space-y-4">
                <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 border border-gray-100 dark:border-slate-800 rounded-xs">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] text-blue-500">notes</span>
                        <span className="text-xs font-bold font-google uppercase tracking-widest text-slate-700 dark:text-slate-300 truncate flex-1">
                            demo-knowledge
                        </span>
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 dark:border-slate-800 pt-2">
                        <button
                            onClick={toggleAll}
                            disabled={allChunks.length === 0}
                            className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors disabled:opacity-40"
                        >
                            <span className="material-symbols-outlined text-[14px]">
                                {selectedChunks.size === allChunks.length && allChunks.length > 0 ? 'check_box' : 'check_box_outline_blank'}
                            </span>
                            {selectedChunks.size === allChunks.length && allChunks.length > 0 ? 'Deselect All' : 'Select All'}
                        </button>
                        <span className="text-[10px] font-google font-bold text-slate-400 dark:text-slate-500">
                            {allChunks.length} segments
                        </span>
                    </div>
                </div>

                <div className="max-h-[240px] overflow-y-auto custom-scrollbar border border-gray-100 dark:border-slate-800 divide-y divide-gray-50 dark:divide-slate-800 transition-colors">
                    {allChunks.map((chunk: string, i: number) => (
                        <label
                            key={i}
                            className={`flex items-start gap-3 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${selectedChunks.has(i) ? 'bg-blue-50/50 dark:bg-blue-900/30' : ''}`}
                        >
                            <input
                                type="checkbox"
                                checked={selectedChunks.has(i)}
                                onChange={() => toggleChunk(i)}
                                className="mt-1 shrink-0 accent-slate-900 dark:accent-blue-500"
                            />
                            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 font-mono transition-colors">
                                {chunk || '(empty chunk)'}
                            </p>
                        </label>
                    ))}
                </div>

                {allChunks.length > 0 && (
                    <button
                        onClick={handleDeleteSelected}
                        disabled={selectedChunks.size === 0}
                        className="w-full py-2.5 min-h-[40px] bg-red-600 dark:bg-red-700 text-white text-xs uppercase tracking-widest font-bold hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                        <span className="material-symbols-outlined text-[16px]">delete_sweep</span> Delete Selected ({selectedChunks.size})
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-slate-950 px-4 py-4 md:px-8 md:py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">
                        psychology
                    </span>
                    <h1 className="text-xl md:text-2xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">Train AI</h1>
                </div>
                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">Ingest knowledge sources into your AI's vector brain.</p>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#E8EBF0] dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                {/* Data Storage */}
                <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">psychology</span>
                            <h4 className="text-md uppercase font-bold text-slate-600 dark:text-slate-400 font-google transition-colors">Data Storage</h4>
                        </div>
                    </div>
                    <div className="flex items-end gap-1 mb-3">
                        <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">{chunksUsed}</span>
                        <span className="text-xl text-slate-600 dark:text-slate-400 mb-1 font-medium italic transition-colors">/ {chunkLimit}</span>
                        <span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1 transition-colors">chunks</span>
                    </div>
                    {chunkPct !== null && (
                        <>
                            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 overflow-hidden transition-colors">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${chunkPct}%` }}
                                    className={`h-full ${chunkPct >= 100 ? 'bg-red-500' : chunkPct >= 80 ? 'bg-amber-500' : 'bg-slate-900 dark:bg-blue-500'}`}
                                />
                            </div>
                            <p className="text-xs uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-3 transition-colors">
                                {Math.round(chunkPct)}% Storage Used
                            </p>
                        </>
                    )}
                </div>

                {/* AI Memory */}
                <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">vital_signs</span>
                        <p className="text-md uppercase tracking-widest font-google font-semibold text-slate-600 dark:text-slate-400 transition-colors">AI Memory</p>
                    </div>
                    <p className="text-3xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">
                        {chunksUsed} <span className="text-sm font-google font-semibold text-slate-600 dark:text-slate-400 transition-colors">segments</span>
                    </p>
                </div>

                {/* System Tier */}
                <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">bolt</span>
                        <p className="text-md uppercase tracking-widest font-google font-semibold text-slate-600 dark:text-slate-400 transition-colors">System Tier</p>
                    </div>
                    <p className="text-3xl font-google font-bold tracking-tight text-amber-500 transition-colors">
                        DEMO <span className="text-sm font-google font-semibold text-slate-600 dark:text-slate-400 transition-colors">plan</span>
                    </p>
                </div>

                {/* Total Usage */}
                <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">database</span>
                            <h4 className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-google transition-colors">Total Usage</h4>
                        </div>
                    </div>
                    <div className="flex items-end gap-1 mb-3">
                        <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">0</span>
                        <span className="text-xl text-slate-600 dark:text-slate-400 mb-1 font-medium italic transition-colors">/ 15</span>
                        <span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1 transition-colors">reqs</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 overflow-hidden transition-colors">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: '0%' }}
                            className="h-full bg-slate-900 dark:bg-blue-500"
                        />
                    </div>
                    <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-3 transition-colors">
                        <span>0% CAP</span>
                        <span className="flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">schedule</span> Demo
                        </span>
                    </div>
                </div>
            </div>

            {/* Knowledge Sources form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[#E8EBF0] dark:bg-slate-800 overflow-hidden transition-colors duration-500">
                <div className={`lg:col-span-12 ${cellCls} p-4 md:p-8 relative overflow-y-auto custom-scrollbar`}>
                    <h2 className="text-md font-display font-bold text-slate-900 dark:text-slate-200 mb-4 transition-colors">Knowledge Sources</h2>

                    {/* Tabs */}
                    <div className="flex border border-gray-100 dark:border-slate-800 mb-5 overflow-x-auto transition-colors">
                        {TABS.map(t => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTab(t.id)}
                                className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 px-2 md:px-3 text-sm font-google uppercase tracking-widest font-bold transition-colors min-h-[44px] shrink-0 border-b-2 ${
                                    activeTab === t.id
                                        ? 'border-slate-900 dark:border-blue-500 text-slate-900 dark:text-slate-200 bg-[#FAFAFA] dark:bg-slate-900'
                                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-[#FAFAFA] dark:hover:bg-slate-800'
                                }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                                <span className="hidden sm:inline">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Alert banner */}
                    {alert.open && (
                        <div className={`mb-5 p-4 border flex items-start justify-between gap-3 ${
                            alert.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/30'
                            : alert.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900/30'
                            : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900/30'
                        }`}>
                            <span className="text-sm font-google">{alert.msg}</span>
                            <button onClick={() => setAlert(p => ({ ...p, open: false }))} className="shrink-0 opacity-60 hover:opacity-100">
                                <span className="material-symbols-outlined text-[16px]">close</span>
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleTrain} className="space-y-4">
                        {activeTab === 'pdf' && (
                            <div>
                                <label className={labelCls}>PDF Archive</label>
                                <div
                                    onClick={() => fileRef.current?.click()}
                                    className="flex flex-col items-center justify-center gap-3 px-4 py-6 md:px-6 md:py-8 bg-[#FAFAFA] dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-700 cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[32px] text-slate-600 dark:text-slate-400 transition-colors">cloud_upload</span>
                                    <div className="text-center w-full">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-google transition-colors break-all">{file ? file.name : 'Drop PDF here'}</p>
                                        <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-0.5 transition-colors">or click to browse</p>
                                        <p className="text-sm font-medium font-google text-slate-600 dark:text-slate-400 mt-0.5 transition-colors">Only 10MB</p>
                                    </div>
                                    <input
                                        type="file"
                                        ref={fileRef}
                                        className="hidden"
                                        accept=".pdf"
                                        onChange={e => {
                                            const f = e.target.files?.[0];
                                            if (f?.type === 'application/pdf') setFile(f);
                                            else showAlert('error', 'Please select a valid PDF.');
                                        }}
                                    />
                                </div>
                                {file && (
                                    <button
                                        type="button"
                                        onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                                        className="mt-2 flex items-center gap-1 text-md font-google text-red-500 hover:text-red-700"
                                    >
                                        <span className="material-symbols-outlined text-[16px]">close</span> Remove {file.name}
                                    </button>
                                )}
                            </div>
                        )}

                        {activeTab === 'csv' && (
                            <div>
                                <label className={labelCls}>CSV / Excel File</label>
                                <div
                                    onClick={() => csvFileRef.current?.click()}
                                    className="flex flex-col items-center justify-center gap-3 px-4 py-6 md:px-6 md:py-8 bg-[#FAFAFA] dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-700 cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[32px] text-slate-600 dark:text-slate-400 transition-colors">table_chart</span>
                                    <div className="text-center w-full">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-google transition-colors break-all">
                                            {csvFile ? csvFile.name : 'Drop CSV or Excel file here'}
                                        </p>
                                        <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-0.5 transition-colors">or click to browse</p>
                                        <p className="text-sm font-medium font-google text-slate-600 dark:text-slate-400 mt-0.5 transition-colors">.csv, .xlsx, .xls — max 5 MB</p>
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
                                    <button
                                        type="button"
                                        onClick={() => { setCsvFile(null); if (csvFileRef.current) csvFileRef.current.value = ''; }}
                                        className="mt-2 flex items-center gap-1 text-md font-google text-red-500 hover:text-red-700"
                                    >
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
                                    <textarea
                                        value={trainingText}
                                        onChange={e => setTrainingText(e.target.value)}
                                        rows={6}
                                        className={inputCls + ' resize-none font-google'}
                                        placeholder="Paste your FAQs, services, or raw knowledge here..."
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isTraining}
                            className="w-full py-3 min-h-[44px] bg-linear-to-r from-blue-600 to-green-600 text-white text-md uppercase tracking-widest font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                        >
                            {isTraining ? (
                                <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> Uploading...</>
                            ) : 'Start Training Sequence'}
                        </button>
                    </form>
                </div>
            </div>

            {/* Manage Knowledge */}
            <div className={`${cellCls} p-4 md:p-8 flex-1 overflow-y-auto custom-scrollbar border-t border-gray-100 dark:border-slate-800`}>
                <div className="flex items-center gap-2 mb-5">
                    <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400 transition-colors">folder_open</span>
                    <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200 transition-colors">Manage Knowledge</h2>
                </div>

                <DemoSourceBrowser />

                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800 transition-colors">
                    <div className="flex items-start gap-3 mb-4 p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 transition-colors">
                        <span className="material-symbols-outlined text-[18px] text-red-500 dark:text-red-400 shrink-0 mt-0.5 transition-colors">
                            delete_forever
                        </span>
                        <p className="text-lg font-medium tracking-wide text-red-600 dark:text-red-400 font-sans leading-relaxed transition-colors">
                            Deleting permanently removes all trained data for this bot. This action cannot be undone.
                        </p>
                    </div>
                    <button
                        onClick={handlePurge}
                        disabled={isPurging || chunksUsed === 0}
                        className="w-full py-3 min-h-[44px] bg-red-600 dark:bg-red-700 text-white text-md uppercase tracking-widest font-bold hover:bg-red-700 dark:hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]"
                    >
                        {isPurging ? (
                            <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> Deleting...</>
                        ) : (
                            <><span className="material-symbols-outlined text-[20px]">delete</span> Delete All Knowledge ({chunksUsed})</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
