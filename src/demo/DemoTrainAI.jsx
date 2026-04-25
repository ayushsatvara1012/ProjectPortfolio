import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { parseFileToChunks } from './demoRag';
import { saveKnowledge, getKnowledge, clearKnowledge, isTrained, getBotConfig } from './demoStorage';

const TABS = [
    { id: 'pdf', label: 'PDF Upload', icon: 'description' },
    { id: 'csv', label: 'CSV / Excel', icon: 'table_chart' },
    { id: 'text', label: 'Text', icon: 'notes' },
];

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';
const inputCls = "w-full px-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 focus:border-slate-400 dark:focus:border-blue-400 text-sm text-slate-900 dark:text-slate-200 transition-colors rounded-sm";
const labelCls = "block text-md font-google uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-1.5 transition-colors";

const StatSkeleton = () => <div className="animate-pulse h-20 bg-slate-100 dark:bg-slate-800 transition-colors" />;

const DemoTrainAI = () => {
    const navigate = useNavigate();
    const botConfig = getBotConfig();
    const chunks = getKnowledge();
    const chunksUsed = chunks.length;
    const chunkLimit = 200;
    const chunkPct = Math.min((chunksUsed / chunkLimit) * 100, 100);

    const [activeTab, setActiveTab] = useState('pdf');
    const [file, setFile] = useState(null);
    const [csvFile, setCsvFile] = useState(null);
    const [trainingText, setTrainingText] = useState('');
    const [textLabel, setTextLabel] = useState('');
    const [status, setStatus] = useState(null); // null | 'processing' | 'done' | 'error'
    const [statusMsg, setStatusMsg] = useState('');
    const [alert, setAlert] = useState({ open: false, type: 'success', msg: '' });

    const fileRef = useRef(null);
    const csvFileRef = useRef(null);

    const showAlert = (type, msg) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 8000);
    };

    const handleTrain = async (e) => {
        e.preventDefault();
        const activeFile = file || csvFile;
        if (!activeFile && !trainingText.trim()) {
            showAlert('error', 'Provide a PDF, CSV/Excel file, or text content.');
            return;
        }
        setStatus('processing');
        setStatusMsg('Parsing file and building knowledge index...');
        try {
            let newChunks;
            if (activeFile) {
                newChunks = await parseFileToChunks(activeFile);
            } else {
                // Text: split by sentence / paragraph
                const text = trainingText.trim();
                const paras = text.split(/\n{2,}/).filter(p => p.trim().length > 20);
                newChunks = paras.length >= 2 ? paras : [text];
            }
            if (!newChunks.length) throw new Error('No usable content found in the input.');
            if (newChunks.length > 200) newChunks = newChunks.slice(0, 200);
            saveKnowledge(newChunks);
            setStatus('done');
            const src = activeFile ? activeFile.name : (textLabel.trim() || 'Manual Entry');
            setStatusMsg(`Training complete! ${newChunks.length} knowledge chunks indexed from "${src}".`);
            setFile(null); setCsvFile(null); setTrainingText(''); setTextLabel('');
            if (fileRef.current) fileRef.current.value = '';
            if (csvFileRef.current) csvFileRef.current.value = '';
        } catch (err) {
            setStatus('error');
            setStatusMsg(err.message || 'Processing failed. Please try a different file.');
        }
    };

    const handlePurge = () => {
        if (!window.confirm('Delete all demo knowledge? This cannot be undone.')) return;
        clearKnowledge();
        setStatus(null);
        setStatusMsg('');
        showAlert('success', 'Knowledge cleared.');
    };

    const isProcessing = status === 'processing';

    return (
        <div className="flex flex-col bg-[#E8EBF0] dark:bg-slate-900 overflow-x-hidden transition-colors duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-slate-950 px-4 py-4 md:px-8 md:py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">psychology</span>
                    <h1 className="text-xl md:text-2xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200">Train AI</h1>
                </div>
                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed">
                    Upload a file and your demo bot will answer questions from it instantly — all in-browser.
                </p>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#E8EBF0] dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                {/* 1. Knowledge Chunks */}
                <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">psychology</span>
                            <h4 className="text-md uppercase font-bold text-slate-600 dark:text-slate-400 font-google">Data Storage</h4>
                        </div>
                    </div>
                    <div className="flex items-end gap-1 mb-3">
                        <span className="text-4xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">{chunksUsed}</span>
                        <span className="text-xl text-slate-600 dark:text-slate-400 mb-1 font-medium italic">/ {chunkLimit}</span>
                        <span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1">chunks</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${chunkPct}%` }}
                            className={`h-full ${chunkPct >= 100 ? 'bg-red-500' : chunkPct >= 80 ? 'bg-amber-500' : 'bg-slate-900 dark:bg-blue-500'}`} />
                    </div>
                    <p className="text-xs uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-3">{Math.round(chunkPct)}% Storage Used</p>
                </div>

                {/* 2. AI Memory */}
                <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">vital_signs</span>
                        <p className="text-md uppercase tracking-widest font-google font-semibold text-slate-600 dark:text-slate-400">AI Memory</p>
                    </div>
                    <p className="text-3xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200">
                        {chunksUsed} <span className="text-sm font-google font-semibold text-slate-600 dark:text-slate-400">chunks</span>
                    </p>
                </div>

                {/* 3. System Tier */}
                <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">bolt</span>
                        <p className="text-md uppercase tracking-widest font-google font-semibold text-slate-600 dark:text-slate-400">System Tier</p>
                    </div>
                    <p className="text-3xl font-google font-bold tracking-tight text-amber-500">
                        DEMO <span className="text-sm font-google font-semibold text-slate-600 dark:text-slate-400">plan</span>
                    </p>
                </div>

                {/* 4. Bot Name */}
                <div className={`${cellCls} p-4 md:p-8 flex flex-col justify-center`}>
                    <div className="flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">smart_toy</span>
                        <h4 className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-google">Bot Name</h4>
                    </div>
                    <p className="text-2xl font-google font-bold tracking-tight text-slate-900 dark:text-slate-200 truncate">
                        {botConfig.name}
                    </p>
                </div>
            </div>

            {/* Main Content */}
            <div>
                <div className={`${cellCls} p-4 md:p-8 relative`}>

                    {/* Training status banner */}
                    {status && (
                        <div className={`mb-5 flex flex-col sm:flex-row sm:items-start gap-3 p-4 border ${
                            status === 'done' ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                            : status === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-900/40 text-red-700 dark:text-red-300'
                            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/40 text-blue-700 dark:text-blue-300'
                        }`}>
                            <div className="flex items-start gap-3 flex-1 min-w-0">
                                {status === 'processing' && <div className="w-4 h-4 border-2 border-current/30 border-t-current animate-spin rounded-full shrink-0 mt-0.5" />}
                                {status === 'done' && <span className="material-symbols-outlined text-[18px] shrink-0">check_circle</span>}
                                {status === 'error' && <span className="material-symbols-outlined text-[18px] shrink-0">error</span>}
                                <p className="text-md font-display leading-relaxed">{statusMsg}</p>
                            </div>
                            {status === 'done' && (
                                <button
                                    onClick={() => navigate('/demo/chat')}
                                    className="shrink-0 px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all flex items-center gap-1.5 min-h-[44px] sm:min-h-0"
                                >
                                    <span className="material-symbols-outlined text-[14px]">chat</span> Chat Now
                                </button>
                            )}
                        </div>
                    )}

                    <h2 className="text-md font-display font-bold text-slate-900 dark:text-slate-200 mb-4">Knowledge Sources</h2>

                    {/* Source Tabs */}
                    <div className="flex border border-gray-100 dark:border-slate-800 mb-5 overflow-x-auto transition-colors">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 px-2 md:px-3 text-sm font-google uppercase tracking-widest font-bold transition-colors min-h-[44px] shrink-0 border-b-2 ${
                                    activeTab === t.id
                                        ? 'border-slate-900 dark:border-blue-500 text-slate-900 dark:text-slate-200 bg-[#FAFAFA] dark:bg-slate-900'
                                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-[#FAFAFA] dark:hover:bg-slate-800'
                                }`}>
                                <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
                                <span className="hidden sm:inline">{t.label}</span>
                            </button>
                        ))}
                    </div>

                    <form onSubmit={handleTrain} className="space-y-4">
                        {activeTab === 'pdf' && (
                            <div>
                                <label className={labelCls}>PDF Archive</label>
                                <div onClick={() => fileRef.current?.click()}
                                    className="flex flex-col items-center justify-center gap-3 px-4 py-6 md:px-6 md:py-8 bg-[#FAFAFA] dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-700 cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
                                    <span className="material-symbols-outlined text-[32px] text-slate-600 dark:text-slate-400">cloud_upload</span>
                                    <div className="text-center w-full">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-google break-all">{file ? file.name : 'Drop PDF here'}</p>
                                        <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-0.5">or click to browse</p>
                                        <p className="text-sm font-medium font-google text-slate-600 dark:text-slate-400 mt-0.5">Max 2 MB (demo)</p>
                                    </div>
                                    <input type="file" ref={fileRef} className="hidden" accept=".pdf"
                                        onChange={e => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            if (f.type !== 'application/pdf') { showAlert('error', 'Please select a valid PDF.'); return; }
                                            if (f.size > 2 * 1024 * 1024) { showAlert('error', 'Demo file limit is 2 MB.'); return; }
                                            setFile(f);
                                        }} />
                                </div>
                                {file && (
                                    <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                                        className="mt-2 flex items-center gap-1 text-md font-google text-red-500 hover:text-red-700">
                                        <span className="material-symbols-outlined text-[16px]">close</span> Remove {file.name}
                                    </button>
                                )}
                            </div>
                        )}

                        {activeTab === 'csv' && (
                            <div>
                                <label className={labelCls}>CSV / Excel File</label>
                                <div onClick={() => csvFileRef.current?.click()}
                                    className="flex flex-col items-center justify-center gap-3 px-4 py-6 md:px-6 md:py-8 bg-[#FAFAFA] dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-700 cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
                                    <span className="material-symbols-outlined text-[32px] text-slate-600 dark:text-slate-400">table_chart</span>
                                    <div className="text-center w-full">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-google break-all">
                                            {csvFile ? csvFile.name : 'Drop CSV or Excel file here'}
                                        </p>
                                        <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-0.5">or click to browse</p>
                                        <p className="text-sm font-medium font-google text-slate-600 dark:text-slate-400 mt-0.5">.csv, .xlsx, .xls — max 2 MB (demo)</p>
                                    </div>
                                    <input type="file" ref={csvFileRef} className="hidden" accept=".csv,.xlsx,.xls"
                                        onChange={e => {
                                            const f = e.target.files?.[0];
                                            if (!f) return;
                                            const ok = ['.csv', '.xlsx', '.xls'].some(ext => f.name.toLowerCase().endsWith(ext));
                                            if (!ok) { showAlert('error', 'Please select a .csv, .xlsx, or .xls file.'); return; }
                                            if (f.size > 2 * 1024 * 1024) { showAlert('error', 'Demo file limit is 2 MB.'); return; }
                                            setCsvFile(f);
                                        }} />
                                </div>
                                {csvFile && (
                                    <button type="button" onClick={() => { setCsvFile(null); if (csvFileRef.current) csvFileRef.current.value = ''; }}
                                        className="mt-2 flex items-center gap-1 text-md font-google text-red-500 hover:text-red-700">
                                        <span className="material-symbols-outlined text-[16px]">close</span> Remove {csvFile.name}
                                    </button>
                                )}
                                {csvFile && (
                                    <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 flex items-start gap-2">
                                        <span className="material-symbols-outlined text-[15px] text-blue-500 mt-0.5 shrink-0">info</span>
                                        <p className="text-xs text-blue-700 dark:text-blue-300 font-google leading-relaxed">
                                            Each row becomes one knowledge chunk. Make sure your file has a <span className="font-bold">header row</span> (column names in row 1).
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'text' && (
                            <div className="space-y-3">
                                <div>
                                    <label className={labelCls}>Source Label <span className="normal-case text-slate-400 font-normal tracking-normal">(optional)</span></label>
                                    <input type="text" value={textLabel} onChange={e => setTextLabel(e.target.value)}
                                        className={inputCls + ' font-mono text-xs'} placeholder="e.g. faq-returns, pricing-2025" />
                                </div>
                                <div>
                                    <label className={labelCls}>Knowledge Text</label>
                                    <textarea value={trainingText} onChange={e => setTrainingText(e.target.value)}
                                        rows={6} className={inputCls + ' resize-none font-google'}
                                        placeholder="Paste your FAQs, services, or raw knowledge here..." />
                                </div>
                            </div>
                        )}

                        <button type="submit" disabled={isProcessing}
                            className="w-full py-3 min-h-[44px] bg-gradient-to-r from-blue-600 to-green-600 text-white text-md uppercase tracking-widest font-bold hover:opacity-90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]">
                            {isProcessing
                                ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing...</>
                                : 'Start Training Sequence'
                            }
                        </button>
                    </form>
                </div>

                {/* Knowledge Management */}
                <div className="mt-6 pt-6 border-t border-gray-100 dark:border-slate-800 px-4 md:px-8 pb-4 md:pb-8">
                    <div className="flex items-center gap-2 mb-5">
                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">folder_open</span>
                        <h2 className="text-md font-google font-bold text-slate-900 dark:text-slate-200">Manage Knowledge</h2>
                </div>

                {chunksUsed === 0 ? (
                    <div className="py-6 text-center">
                        <span className="material-symbols-outlined text-[28px] text-slate-300 dark:text-slate-600 mb-2 block">inventory_2</span>
                        <p className="text-lg font-semibold text-slate-500 dark:text-slate-400">No knowledge indexed yet. Upload a file above to get started.</p>
                    </div>
                ) : (
                    <div>
                        <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 p-3 border border-gray-100 dark:border-slate-800 mb-3">
                            <span className="material-symbols-outlined text-[18px] text-blue-500">psychology</span>
                            <span className="text-xs font-bold font-google uppercase tracking-widest text-slate-700 dark:text-slate-300 flex-1">
                                Demo Knowledge Base
                            </span>
                            <span className="text-[10px] font-google font-bold text-slate-400">{chunksUsed} segments</span>
                        </div>
                        <div className="max-h-[240px] overflow-y-auto custom-scrollbar border border-gray-100 dark:border-slate-800 divide-y divide-gray-50 dark:divide-slate-800">
                            {chunks.slice(0, 20).map((chunk, idx) => (
                                <div key={idx} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3 font-mono">{chunk}</p>
                                </div>
                            ))}
                            {chunksUsed > 20 && (
                                <div className="p-3 text-center">
                                    <p className="text-xs font-google text-slate-400">...and {chunksUsed - 20} more chunks</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Danger Zone */}
                <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
                    <div className="flex items-start gap-3 mb-4 p-3 bg-red-50/50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30">
                        <span className="material-symbols-outlined text-[18px] text-red-500 shrink-0 mt-0.5">delete_forever</span>
                        <p className="text-lg font-medium tracking-wide text-red-600 dark:text-red-400 font-sans leading-relaxed">
                            Deleting permanently removes all demo knowledge. This action cannot be undone.
                        </p>
                    </div>
                    <button onClick={handlePurge} disabled={chunksUsed === 0}
                        className="w-full py-3 min-h-[44px] bg-red-600 dark:bg-red-700 text-white text-md uppercase tracking-widest font-bold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]">
                        <span className="material-symbols-outlined text-[20px]">delete</span> Delete All Knowledge ({chunksUsed})
                    </button>
                </div>
                </div>
            </div>

            {/* Inline alert */}
            {alert.open && (
                <div className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-50 flex items-center gap-3 px-5 py-3 border shadow-lg ${
                    alert.type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}>
                    <span className="material-symbols-outlined text-[18px]">{alert.type === 'error' ? 'error' : 'check_circle'}</span>
                    <p className="text-sm font-google flex-1">{alert.msg}</p>
                    <button onClick={() => setAlert(p => ({ ...p, open: false }))}><span className="material-symbols-outlined text-[16px]">close</span></button>
                </div>
            )}
        </div>
    );
};

export default DemoTrainAI;
