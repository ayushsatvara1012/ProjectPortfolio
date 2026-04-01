import React, { useState, useRef, useEffect } from 'react';
import {
    UploadCloud, BrainCircuit, Database, Eye, EyeOff,
    Zap, Lock, Activity, Globe, FileText, AlignLeft, X, Clock
} from 'lucide-react';
import Alert from '../components/alert';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import ManageSubscriptions from '../components/ManageSubscriptions';
import { useUserRole } from '../context/UserContext';
import UpgradePrompt from '../components/UpgradePrompt';

const StatSkeleton = () => <div className="animate-pulse h-20 bg-slate-100 dark:bg-slate-800 transition-colors" />;
const TABS = [
    { id: 'url', label: 'URL', Icon: Globe },
    { id: 'pdf', label: 'PDF Upload', Icon: FileText },
    { id: 'text', label: 'Manual Text', Icon: AlignLeft },
];

// Grid primitives
const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';
const inputCls = "w-full px-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-indigo-500/50 focus:border-slate-400 dark:focus:border-indigo-400 text-sm text-slate-900 dark:text-slate-200 transition-colors";
const labelCls = "block text-md font-display uppercase tracking-widest text-slate-600 dark:text-slate-400 mb-1.5 transition-colors";

const AppTrainAI = () => {
    const { getToken } = useAuth();
    const {
        userTier, isLoading: ctxLoading,
        messagesUsed, messageLimit, billingPeriodEnd,
        totalDocuments, totalMessages
    } = useUserRole();

    const [activeTab, setActiveTab] = useState('url');
    const [url, setUrl] = useState('');
    const [file, setFile] = useState(null);
    const [trainingText, setTrainingText] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [isTraining, setIsTraining] = useState(false);
    const [alert, setAlert] = useState({ open: false, type: 'success', msg: '' });
    const [bots, setBots] = useState([]);
    const [selectedBotId, setSelectedBotId] = useState('');
    const [upgradeError, setUpgradeError] = useState(null);

    const fileRef = useRef(null);
    const baseUrl = import.meta.env.VITE_API_URL || '';

    useEffect(() => {
        const fetchBots = async () => {
            const token = await getToken();
            const res = await fetch(`${baseUrl}/api/companies`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
                const data = await res.json();
                setBots(data.bots || []);
                if (data.bots?.length > 0) setSelectedBotId(data.bots[0].id);
            }
        };
        fetchBots();
    }, []);

    const isFree = !ctxLoading && (userTier === 'FREE' || !userTier);
    const isLockedOut = !ctxLoading && (userTier === 'FREE' || userTier === 'BASIC' || userTier === 'STARTER') && messagesUsed >= messageLimit;

    const showAlert = (type, msg) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 8000);
    };

    const handleTrain = async (e) => {
        e.preventDefault();
        if (!url.trim() && !file && !trainingText.trim()) { showAlert('error', 'Provide a URL, PDF file, or manual text.'); return; }
        setIsTraining(true);
        try {
            const token = await getToken();
            const fd = new FormData();
            if (url.trim()) fd.append('url', url.trim());
            if (file) fd.append('file', file);
            if (trainingText.trim()) fd.append('text', trainingText.trim());
            if (apiKey.trim()) fd.append('api_key', apiKey.trim());
            if (selectedBotId) fd.append('company_id', selectedBotId);
            const res = await fetch(`${baseUrl}/api/train`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd,
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 402) {
                    const detail = data?.detail;
                    setUpgradeError(
                        typeof detail === 'object' && detail?.code
                            ? detail
                            : { code: 'CHUNK_LIMIT_EXCEEDED', message: typeof detail === 'string' ? detail : 'Chunk limit reached.', tier: '', current: null, limit: null }
                    );
                    return;
                }
                throw new Error(data.detail?.message || data.detail || 'Training failed.');
            }
            showAlert(data.warning ? 'warning' : 'success', data.warning || data.message || 'Training successful!');
            setUrl(''); setTrainingText(''); setFile(null);
            if (fileRef.current) fileRef.current.value = '';
        } catch (err) {
            showAlert('error', err.message);
        } finally { setIsTraining(false); }
    };

    const periodEndStr = billingPeriodEnd
        ? new Date(billingPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

    const statCards = [
        { label: 'Ingested Sources', value: totalDocuments ?? 0, Icon: Database, unit: 'docs' },
        { label: 'AI Memory', value: totalMessages ?? 0, Icon: Activity, unit: 'msgs' },
        { label: 'System Tier', value: userTier || '—', Icon: Zap, unit: 'plan' },
        { label: 'Quota Used', value: `${messagesUsed ?? 0}/${messageLimit ?? 200}`, Icon: Lock, unit: 'reqs' },
    ];

    return (
        <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500">
            {/* ── Page Header ── */}
            <div className="bg-white dark:bg-slate-950 px-8 py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                <div className="flex items-center gap-2 mb-1">
                    <BrainCircuit className="w-4 h-4 text-slate-600 dark:text-slate-400 transition-colors" />
                    <h1 className="text-xl md:text-2xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 transition-colors">Train AI</h1>
                </div>
                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">Ingest knowledge sources into your AI's vector brain.</p>
            </div>

            {/* ── Stats Row (tic-tac-toe grid) ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#E8EBF0] dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                {ctxLoading
                    ? Array(4).fill(0).map((_, i) => <div key={i} className={`${cellCls} p-8`}><StatSkeleton /></div>)
                    : statCards.map(({ label, value, Icon, unit }) => (
                        <div key={label} className={`${cellCls} p-8`}>
                            <div className="flex items-center gap-2 mb-3">
                                <Icon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 transition-colors" />
                                <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">{label}</p>
                            </div>
                            <p className="text-2xl md:text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">
                                {value} <span className="text-sm font-mono text-slate-600 dark:text-slate-400 transition-colors">{unit}</span>
                            </p>
                        </div>
                    ))
                }
            </div>

            {/* ── Main Grid ── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[#E8EBF0] dark:bg-slate-800 flex-1 overflow-hidden transition-colors duration-500">
                {/* Knowledge Sources */}
                <div className={`lg:col-span-7 ${cellCls} p-8 relative overflow-y-auto custom-scrollbar`}>
                    {isFree && (
                        <div className="absolute inset-0 z-20 bg-white/95 dark:bg-slate-950/95 flex flex-col items-center justify-center gap-5 p-10 transition-colors duration-500">
                            <div className="w-12 h-12 border-2 border-slate-900 dark:border-slate-700 flex items-center justify-center transition-colors">
                                <Lock className="w-6 h-6 text-slate-900 dark:text-slate-200 transition-colors" />
                            </div>
                            <div className="text-center">
                                <p className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2 transition-colors">Trial Plan Required</p>
                                <p className="text-md font-display text-slate-600 dark:text-slate-400 leading-relaxed max-w-sm transition-colors">
                                    Vector training is available on Starter and Scale plans. Unlock your bot's brain today.
                                </p>
                            </div>
                            <a href="/app/pricing" className="px-8 py-3 bg-slate-900 dark:bg-indigo-600 text-white text-md uppercase tracking-widest font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all flex items-center active:scale-95">
                                Upgrade Now
                            </a>
                        </div>
                    )}

                    <h2 className="text-md font-display font-bold text-slate-900 dark:text-slate-200 mb-4 transition-colors">Knowledge Sources</h2>

                    {/* Source Tabs */}
                    <div className="flex border border-gray-100 dark:border-slate-800 mb-5 overflow-x-auto transition-colors">
                        {TABS.map(t => (
                            <button key={t.id} onClick={() => setActiveTab(t.id)}
                                className={`flex items-center gap-1.5 flex-1 py-2.5 px-3 text-sm font-display uppercase tracking-widest font-bold transition-colors min-h-[40px] shrink-0 border-b-2 ${activeTab === t.id
                                        ? 'border-slate-900 dark:border-indigo-500 text-slate-900 dark:text-slate-200 bg-[#FAFAFA] dark:bg-slate-900'
                                        : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-[#FAFAFA] dark:hover:bg-slate-800'
                                    }`}>
                                <t.Icon className="w-3.5 h-3.5" />{t.label}
                            </button>
                        ))}
                    </div>

                    {/* Bot Selector (multi-bot) */}
                    {bots.length > 1 && (
                        <div className="mb-5">
                            <label className={labelCls}>Training Target Bot</label>
                            <select
                                value={selectedBotId}
                                onChange={e => setSelectedBotId(e.target.value)}
                                className={inputCls + ' appearance-none font-mono'}
                            >
                                {bots.map(b => (
                                    <option key={b.id} value={b.id}>{b.bot_name} — {b.company_name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* API Key */}
                    <div className="mb-4">
                        <label className={labelCls}>API Secret Key</label>
                        <div className="relative">
                            <input type={showKey ? 'text' : 'password'} value={apiKey}
                                onChange={e => setApiKey(e.target.value)} className={inputCls + ' pr-10 text-sm font-mono'} placeholder="sb_live_..." />
                            <button type="button" onClick={() => setShowKey(p => !p)}
                                className="absolute inset-y-0 right-3 flex items-center text-slate-600 hover:text-slate-600">
                                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    <form onSubmit={handleTrain} className="space-y-4">
                        {activeTab === 'url' && (
                            <div>
                                <label className={labelCls}>Source URL</label>
                                <input type="url" value={url} onChange={e => setUrl(e.target.value)} className={inputCls + ' text-sm font-mono'} placeholder="https://docs.example.com" />
                            </div>
                        )}
                        {activeTab === 'pdf' && (
                            <div>
                                <label className={labelCls}>PDF Archive</label>
                                <div onClick={() => fileRef.current?.click()}
                                    className="flex flex-col items-center justify-center gap-3 px-6 py-8 bg-[#FAFAFA] dark:bg-slate-900 border border-dashed border-gray-200 dark:border-slate-700 cursor-pointer hover:border-slate-400 dark:hover:border-slate-500 transition-colors">
                                    <UploadCloud className="w-7 h-7 text-slate-600 dark:text-slate-400 transition-colors" />
                                    <div className="text-center">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium transition-colors">{file ? file.name : 'Drop PDF here'}</p>
                                        <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-0.5 transition-colors">or click to browse</p>
                                    </div>
                                    <input type="file" ref={fileRef} className="hidden" accept=".pdf"
                                        onChange={e => { const f = e.target.files?.[0]; if (f?.type === 'application/pdf') setFile(f); else showAlert('error', 'Please select a valid PDF.'); }} />
                                </div>
                                {file && (
                                    <button type="button" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ''; }}
                                        className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                                        <X className="w-3.5 h-3.5" /> Remove {file.name}
                                    </button>
                                )}
                            </div>
                        )}
                        {activeTab === 'text' && (
                            <div>
                                <label className={labelCls}>Knowledge Text</label>
                                <textarea value={trainingText} onChange={e => setTrainingText(e.target.value)}
                                    rows={6} className={inputCls + ' resize-none'} placeholder="Paste your FAQs, services, or raw knowledge here..." />
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
                            className="w-full py-3 min-h-[44px] bg-slate-900 dark:bg-indigo-600 text-white text-md uppercase tracking-widest font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 active:scale-[0.99]">
                            {isTraining ? (<><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> Training...</>) : isLockedOut ? 'Quota Exceeded' : 'Start Training Sequence'}
                        </button>
                    </form>
                </div>

                {/* Right column */}
                <div className="lg:col-span-5 gap-px flex flex-col bg-[#E8EBF0] dark:bg-slate-800 overflow-y-auto custom-scrollbar transition-colors">
                    {/* Usage */}
                    <div className={`${cellCls} p-8 flex flex-col justify-center min-h-[240px]`}>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <Database className="w-3.5 h-3.5 text-slate-600 dark:text-slate-400 transition-colors" />
                                <h4 className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 transition-colors">Total Usage</h4>
                            </div>
                            {(messageLimit ?? 0) >= 999999 && (
                                <span className="px-2 py-0.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-md uppercase tracking-widest font-bold text-slate-500 dark:text-slate-400 transition-colors">Unlimited</span>
                            )}
                        </div>
                        <div className="flex items-end gap-1 mb-4">
                            <span className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">{messagesUsed ?? 0}</span>
                            {(messageLimit ?? 0) < 999999 && <span className="text-xl text-slate-600 dark:text-slate-400 mb-1 font-medium italic transition-colors">/ {messageLimit}</span>}
                            <span className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mb-2 ml-1 transition-colors">reqs</span>
                        </div>
                        {(messageLimit ?? 0) < 999999 && (
                            <>
                                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 overflow-hidden transition-colors">
                                    <motion.div initial={{ width: 0 }}
                                        animate={{ width: `${Math.min(((messagesUsed ?? 0) / (messageLimit ?? 1)) * 100, 100)}%` }}
                                        className={`h-full ${(messagesUsed / messageLimit) >= 1 ? 'bg-red-500' : (messagesUsed / messageLimit) >= 0.8 ? 'bg-amber-500' : 'bg-slate-900 dark:bg-indigo-500'}`} />
                                </div>
                                <div className="flex justify-between text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 mt-3 transition-colors">
                                    <span>{Math.round(((messagesUsed ?? 0) / (messageLimit ?? 1)) * 100)}% Capacity</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Resets {periodEndStr}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
};

export default AppTrainAI;
