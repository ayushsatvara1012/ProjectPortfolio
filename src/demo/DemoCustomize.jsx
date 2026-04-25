import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { getBotConfig, saveBotConfig } from './demoStorage';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';
const inputCls = "w-full text-md font-medium font-google px-3 py-2.5 bg-transparent border border-gray-300 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 focus:border-slate-400 dark:focus:border-blue-400 text-slate-900 dark:text-slate-200 transition-colors rounded-sm";
const labelCls = "block text-lg font-semibold font-google text-slate-600 dark:text-slate-400 mb-1.5 transition-colors";
const headingCls = "text-xl font-medium font-google mb-4 transition-colors text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-600 dark:from-blue-400 dark:to-green-500";

// ── Inline BotPreview — matches production ChatWidget UI exactly ───────────────
const InlineBotPreview = ({ settings, theme = 'light' }) => {
    const isDark = theme === 'dark';
    const color = settings.primaryColor || '#5730F5';
    const botName = settings.name || 'Demo Bot';
    const greeting = settings.greeting || 'Hi! How can I help you today?';

    const ASSET_BASE = import.meta.env.DEV ? '' : 'https://www.sapybase.com';
    const logoUrl = settings.customLogoUrl || `${ASSET_BASE}/SB_loading.svg`;

    const quickQs = (Array.isArray(settings.quickQuestions) ? settings.quickQuestions : [])
        .map(q => typeof q === 'string' ? q : (q.label || '')).filter(Boolean);

    return (
        <div className={`w-full max-w-[480px] h-[520px] sm:h-[600px] flex flex-col rounded-2xl border shadow-2xl overflow-hidden relative z-10 transition-all ${isDark ? 'bg-slate-900/95 border-slate-800/50' : 'bg-white/95 border-gray-200/50'}`}>
            {/* Header — gradient glow + blurred bar */}
            <div className="relative shrink-0">
                <div
                    className="absolute inset-0 animate-gradient-x opacity-20"
                    style={{ background: `linear-gradient(90deg, ${color}, #f97316, ${color})`, backgroundSize: '200% 200%' }}
                />
                <div className={`backdrop-blur-md p-2 flex justify-end items-center relative z-10 border-b ${isDark ? 'bg-slate-900/40 text-slate-100 border-slate-800/50' : 'bg-white/40 text-slate-900 border-gray-200/50'}`}>
                    <div className="relative flex flex-row justify-between items-center w-full">
                        <div className="relative flex items-center gap-3 pl-4">
                            <div className="relative">
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white animate-pulse z-10" />
                                <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center border-2" style={{ borderColor: color + '40', backgroundColor: color + '20' }}>
                                    <img src={logoUrl} alt={botName} className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
                                </div>
                            </div>
                            <div className="flex flex-row items-center justify-center">
                                <p className="text-lg font-display font-bold" style={{ color }}>{botName}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-1 pr-2">
                            <div className={`p-2 rounded-full ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'} transition-colors`}>
                                <span className={`material-symbols-outlined text-[22px] ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>more_horiz</span>
                            </div>
                            <div className={`p-2 rounded-full ${isDark ? 'hover:bg-red-950/30' : 'hover:bg-red-50'} transition-colors`}>
                                <span className="material-symbols-outlined text-[22px] text-red-500">close</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Messages area — same bg as real widget */}
            <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-5 pt-6 pb-2 ${isDark ? 'bg-slate-950/50' : 'bg-gray-50/50'}`}>
                {/* Bot message — role label + bubble matching production */}
                <div className="flex min-w-0 max-w-[85%] self-start text-left">
                    <div className="flex flex-col max-w-full min-w-0 items-start">
                        <span className="text-md uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 ml-1 leading-none">{botName}</span>
                        <div className={`px-4 py-2 min-h-[38px] w-fit max-w-full rounded-2xl rounded-tl-none overflow-hidden ${isDark ? 'bg-slate-800 text-slate-200 border border-slate-700/60' : 'bg-slate-100 text-gray-800 border border-gray-200/60'}`}>
                            <div className="min-w-0 max-w-full text-md font-google leading-relaxed">
                                {greeting}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick questions — right-aligned, matching production */}
                {quickQs.length > 0 && (
                    <div className="flex flex-col items-end gap-2 px-3 pb-2 pt-1">
                        {quickQs.slice(0, 4).map((q, i) => (
                            <button
                                key={i}
                                className={`px-4 py-2.5 border rounded-md text-md font-regular font-google transition-colors max-w-full text-left break-words ${isDark ? 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500' : 'bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-400'}`}
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Powered by SaPyBase — branding bar above input */}
            <div className={`shrink-0 py-1.5 flex justify-center items-center ${isDark ? 'bg-slate-950/80' : 'bg-gray-50/80'} backdrop-blur-sm`}>
                <span className={`flex items-center gap-1.5 text-[9px] font-sans font-bold uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                    <img src={`${ASSET_BASE}/SB_loading.svg`} alt="SaPyBase" className="w-5 h-5 grayscale opacity-50" />
                    Powered by SaPyBase
                </span>
            </div>

            {/* Input area — matches production: transparent bg textarea, no rounded pill */}
            <div className={`backdrop-blur-2xl border-t shrink-0 z-10 flex flex-col ${isDark ? 'bg-slate-900/95 border-slate-800/50' : 'bg-white/95 border-gray-200/50'}`}>
                <div className="p-2 w-full">
                    <div className="relative flex items-center gap-2 pb-1">
                        <textarea
                            readOnly
                            placeholder="Ask anything..."
                            rows={1}
                            className={`flex-1 max-h-32 min-h-[40px] bg-transparent resize-none px-2.5 py-[9px] focus:outline-none leading-relaxed appearance-none rounded-none text-xl font-medium font-sans ${isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-900 placeholder-gray-400'}`}
                        />
                        <button
                            className="p-2 shrink-0 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center opacity-50"
                            style={{ color }}
                        >
                            <span className="material-symbols-outlined text-[18px]">send</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ── DemoCustomize ──────────────────────────────────────────────────────────────
const DemoCustomize = () => {
    const [settings, setSettings] = useState(getBotConfig());
    const [isDark, setIsDark] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [savedMsg, setSavedMsg] = useState('');

    useEffect(() => {
        const isGlobalDark = document.documentElement.classList.contains('dark');
        setIsDark(isGlobalDark);
    }, []);

    const updateSetting = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        setIsSaving(true);
        saveBotConfig(settings);
        setTimeout(() => {
            setIsSaving(false);
            setSavedMsg('Settings saved to demo session!');
            setTimeout(() => setSavedMsg(''), 4000);
        }, 600);
    };

    const TONES = ['Professional', 'Friendly', 'Humorous', 'Technical', 'Concise'];
    const currentTones = Array.isArray(settings.companyTone) ? settings.companyTone : ['Professional'];

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-2 lg:h-[calc(100vh-5rem)] lg:overflow-hidden overflow-x-hidden bg-[#E8EBF0] dark:bg-slate-900 transition-colors duration-500 min-h-0">

            {/* LEFT: Settings Form */}
            <div className="bg-white dark:bg-slate-950 flex flex-col relative transition-colors lg:overflow-y-auto scrollbar-hide">
                <div className="px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-100 dark:border-slate-800 shrink-0 transition-colors">
                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-0.5">Customize</h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-500 leading-relaxed">Configure your bot's visual identity. Changes reflect instantly in the preview.</p>
                </div>

                <div className="p-4 sm:p-8 flex-1 overflow-y-auto scrollbar-hide">
                    <div className="space-y-8">

                        {/* Bot Appearance */}
                        <div className="space-y-6">
                            <p className={headingCls + ' flex items-center'}>
                                <span className="material-symbols-outlined inline text-[14px] mr-1.5 text-slate-500">palette</span>
                                Bot Appearance
                            </p>
                            <div>
                                <label className={labelCls}>Bot Name</label>
                                <input type="text" value={settings.name} onChange={e => updateSetting('name', e.target.value)}
                                    className={inputCls} placeholder="SaPyBase AI" />
                            </div>
                            <div>
                                <label className={labelCls}>Greeting Message</label>
                                <input type="text" value={settings.greeting} onChange={e => updateSetting('greeting', e.target.value)}
                                    className={inputCls} placeholder="Hi! How can I help you today?" />
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-slate-800" />

                        {/* Theme Color */}
                        <div className="space-y-4">
                            <p className={headingCls + ' flex items-center'}>
                                <span className="material-symbols-outlined inline text-[14px] mr-1.5 text-slate-500">color_lens</span>
                                Theme Color
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="relative flex-1">
                                    <input type="text" value={settings.primaryColor || '#5730F5'}
                                        onChange={e => updateSetting('primaryColor', e.target.value)}
                                        className={inputCls + ' pr-12 font-mono uppercase'} placeholder="#5730F5" />
                                    <div className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 border border-gray-100 dark:border-slate-700 overflow-hidden">
                                        <input type="color" value={settings.primaryColor || '#5730F5'}
                                            onChange={e => { updateSetting('primaryColor', e.target.value); updateSetting('themeColor', e.target.value); }}
                                            className="absolute inset-[-8px] w-[200%] h-[200%] cursor-pointer" />
                                    </div>
                                </div>
                                <div className="w-12 h-12 rounded-sm border border-gray-200 dark:border-slate-700" style={{ backgroundColor: settings.primaryColor || '#5730F5' }} />
                            </div>
                        </div>

                        <div className="border-t border-gray-100 dark:border-slate-800" />

                        {/* Company Tone */}
                        <div className="space-y-6">
                            <p className={headingCls + ' flex items-center'}>
                                <span className="material-symbols-outlined inline text-[14px] mr-1.5 text-slate-500">forum</span>
                                Tone &amp; Behavior
                            </p>
                            <div className="mb-6">
                                <label className={labelCls}>Company Tone</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {TONES.map(tone => (
                                        <label key={tone} className="flex items-center gap-2 p-3 border border-gray-100 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                                            <input type="checkbox" checked={currentTones.includes(tone)}
                                                onChange={e => {
                                                    const next = e.target.checked
                                                        ? [...currentTones, tone]
                                                        : currentTones.filter(t => t !== tone);
                                                    updateSetting('companyTone', next);
                                                }}
                                                className="w-4 h-4 accent-slate-900 dark:accent-blue-600" />
                                            <span className="text-lg font-google text-slate-700 dark:text-slate-300">{tone}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* System Prompt */}
                            <div className="mb-6">
                                <label className={labelCls}>System Prompt / Instructions</label>
                                <textarea value={settings.systemPrompt || ''} onChange={e => updateSetting('systemPrompt', e.target.value)}
                                    className={inputCls + ' min-h-[120px] resize-none py-3'}
                                    placeholder="Example: You are a helpful assistant. Always be professional and direct..." />
                            </div>

                            {/* Quick Questions */}
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className={labelCls + ' mb-0'}>Quick Questions</label>
                                    <button
                                        onClick={() => updateSetting('quickQuestions', [...(Array.isArray(settings.quickQuestions) ? settings.quickQuestions : []), ''])}
                                        className="p-1 px-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold font-sans transition-colors flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[12px]">add</span> Add
                                    </button>
                                </div>
                                <p className="text-md font-google text-slate-400 dark:text-slate-500 mb-3">Each chip appears in the chat as a quick question.</p>
                                <div className="space-y-2">
                                    {(Array.isArray(settings.quickQuestions) ? settings.quickQuestions : []).map((q, idx) => (
                                        <div key={idx} className="flex items-center gap-2">
                                            <input type="text" value={typeof q === 'string' ? q : (q.label || '')}
                                                onChange={e => {
                                                    const newQs = [...settings.quickQuestions];
                                                    newQs[idx] = e.target.value;
                                                    updateSetting('quickQuestions', newQs);
                                                }}
                                                className={inputCls + ' text-md font-semibold py-2'}
                                                placeholder="e.g. What are your pricing plans?" />
                                            <button onClick={() => {
                                                const newQs = [...settings.quickQuestions];
                                                newQs.splice(idx, 1);
                                                updateSetting('quickQuestions', newQs);
                                            }} className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0">
                                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Save */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                            {savedMsg && (
                                <div className="mb-3 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-sm font-google flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px]">check_circle</span>{savedMsg}
                                </div>
                            )}
                            <button onClick={handleSave} disabled={isSaving}
                                className="w-full py-4 min-h-[48px] bg-gradient-to-r from-blue-600 to-green-600 text-white text-lg uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50">
                                {isSaving
                                    ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> PERSISTING...</>
                                    : <>SAVE_CONFIG</>
                                }
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT: Preview — fixed on desktop, centered */}
            <div className={`overflow-hidden border-t lg:border-t-0 lg:border-l w-full min-h-[600px] lg:h-full relative flex flex-col items-center justify-center p-4 sm:p-8 ${isDark ? 'dark bg-slate-950 border-slate-800' : 'bg-[#FAFAFA] border-gray-100'}`}>
                <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-100" style={{ backgroundImage: "url('/nature_1.webp')" }} />
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/60 backdrop-blur-[1px] pointer-events-none" />

                {/* Dark/Light toggle */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-full px-4 text-center">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-500 font-sans">Check contrast in both modes</p>
                    <button onClick={() => setIsDark(d => !d)}
                        className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all">
                        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                            {isDark
                                ? <span className="material-symbols-outlined text-[14px] text-amber-500">light_mode</span>
                                : <span className="material-symbols-outlined text-[14px] text-blue-500">dark_mode</span>}
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-300">
                            {isDark ? 'Light Mode' : 'Dark Mode'} — <span className="text-blue-500 dark:text-amber-500">Switch</span>
                        </span>
                    </button>
                </div>

                {/* Bot preview — centered */}
                <div className="w-full max-w-[480px] flex items-center justify-center relative z-10">
                    <InlineBotPreview settings={settings} theme={isDark ? 'dark' : 'light'} />
                </div>
            </div>
        </div>
    );
};

export default DemoCustomize;
