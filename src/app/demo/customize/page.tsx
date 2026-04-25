'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBotConfig, saveBotConfig } from '@/src/lib/demo/demoStorage';

const inputCls = "w-full text-sm font-medium px-3 py-2.5 bg-transparent border border-gray-300 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-slate-900 dark:text-slate-200 transition-colors rounded-sm";
const labelCls = "block text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1.5 transition-colors";

const InlineBotPreview = ({ settings, theme = 'light' }: any) => {
    const isDark = theme === 'dark';
    const color = settings.primaryColor || '#5730F5';
    const botName = settings.name || 'Demo Bot';
    const greeting = settings.greeting || 'Hi! How can I help you today?';
    const logoUrl = settings.customLogoUrl || '/SB_loading.svg';

    const quickQs = (Array.isArray(settings.quickQuestions) ? settings.quickQuestions : [])
        .map((q: any) => typeof q === 'string' ? q : (q.label || '')).filter(Boolean);

    return (
        <div className={`w-full max-w-[440px] h-[580px] flex flex-col rounded-2xl border shadow-2xl overflow-hidden relative transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-gray-200'}`}>
            <div className="relative shrink-0 border-b p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full flex items-center justify-center border-2" style={{ borderColor: color + '40', backgroundColor: color + '20' }}>
                    <img src={logoUrl} alt="" className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <p className="font-bold" style={{ color }}>{botName}</p>
                    <p className="text-[10px] text-green-500 font-bold uppercase">Online</p>
                </div>
            </div>

            <div className={`flex-1 overflow-y-auto p-4 flex flex-col gap-4 ${isDark ? 'bg-slate-950/50' : 'bg-gray-50/50'}`}>
                <div className="flex flex-col items-start max-w-[85%]">
                     <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">{botName}</span>
                     <div className={`p-3 rounded-2xl rounded-tl-none border ${isDark ? 'bg-slate-800 text-slate-200 border-slate-700' : 'bg-white text-slate-800 border-gray-200'}`}>
                         <p className="text-sm">{greeting}</p>
                     </div>
                </div>

                <div className="flex flex-col items-end gap-2">
                    {quickQs.map((q: string, i: number) => (
                        <div key={i} className={`px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-white border-gray-200 text-slate-700 hover:border-slate-400'}`}>
                            {q}
                        </div>
                    ))}
                </div>
            </div>

            <div className="p-4 bg-white border-t">
                 <div className="h-10 rounded-xl bg-slate-50 border flex items-center px-4 text-xs text-slate-400">Ask anything...</div>
            </div>
        </div>
    );
};

export default function DemoCustomizePage() {
    const [settings, setSettings] = useState<any>(null);
    const [isDarkPreview, setIsDarkPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setSettings(getBotConfig());
    }, []);

    const updateSetting = (key: string, value: any) => {
        setSettings((prev: any) => ({ ...prev, [key]: value }));
    };

    const handleSave = () => {
        setIsSaving(true);
        saveBotConfig(settings);
        setTimeout(() => setIsSaving(false), 1000);
    };

    if (!settings) return null;

    const TONES = ['Professional', 'Friendly', 'Humorous', 'Technical', 'Concise'];
    const currentTones = Array.isArray(settings.companyTone) ? settings.companyTone : ['Professional'];

    return (
        <div className="flex flex-col lg:grid lg:grid-cols-2 h-full bg-[#E8EBF0] dark:bg-slate-900 transition-colors duration-500">
            <div className="bg-white dark:bg-slate-950 flex flex-col border-r border-gray-100 dark:border-slate-800 lg:overflow-y-auto transition-colors">
                <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 transition-colors">
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-200">Customize</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-500">Visual identity and behavior configuration.</p>
                </div>

                <div className="p-8 space-y-10">
                    <div className="space-y-6">
                        <p className="text-sm font-bold uppercase text-blue-600">Appearance</p>
                        <div>
                            <label className={labelCls}>Bot Name</label>
                            <input type="text" value={settings.name} onChange={e => updateSetting('name', e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Greeting Message</label>
                            <input type="text" value={settings.greeting} onChange={e => updateSetting('greeting', e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Theme Color</label>
                            <div className="flex gap-4">
                                <input type="color" value={settings.primaryColor || '#5730F5'} onChange={e => { updateSetting('primaryColor', e.target.value); updateSetting('themeColor', e.target.value); }} className="w-12 h-12 border border-gray-200 dark:border-slate-700 p-1" />
                                <input type="text" value={settings.primaryColor || '#5730F5'} onChange={e => updateSetting('primaryColor', e.target.value)} className={inputCls + ' font-mono'} />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <p className="text-sm font-bold uppercase text-blue-600">Behavior</p>
                        <div>
                            <label className={labelCls}>Tone</label>
                            <div className="grid grid-cols-2 gap-2">
                                {TONES.map(t => (
                                    <label key={t} className={`flex items-center gap-2 p-3 border cursor-pointer transition-colors ${currentTones.includes(t) ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-900/40' : 'border-gray-100 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                                        <input type="checkbox" checked={currentTones.includes(t)} onChange={e => {
                                            const next = e.target.checked ? [...currentTones, t] : currentTones.filter((x: string) => x !== t);
                                            updateSetting('companyTone', next);
                                        }} className="w-4 h-4 accent-slate-900 dark:accent-blue-600" />
                                        <span className="text-xs font-bold uppercase text-slate-700 dark:text-slate-300">{t}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className={labelCls}>System Instructions</label>
                            <textarea rows={4} value={settings.systemPrompt || ''} onChange={e => updateSetting('systemPrompt', e.target.value)} className={inputCls + ' resize-none'} placeholder="Act as a professional support agent..." />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 dark:border-slate-800 transition-colors">
                         <button onClick={handleSave} disabled={isSaving} className="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-3">
                             {isSaving ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> SAVING...</> : 'SAVE_CONFIG'}
                         </button>
                    </div>
                </div>
            </div>

            <div className={`flex flex-col items-center justify-center p-10 relative ${isDarkPreview ? 'bg-slate-950' : 'bg-[#FAFAFA] dark:bg-slate-900'} transition-colors`}>
                 <div className="absolute inset-0 bg-cover bg-center opacity-40 pointer-events-none" style={{ backgroundImage: "url('/nature_1.webp')" }} />
                 <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/60 backdrop-blur-[1px] pointer-events-none" />
                 <div className="absolute top-6 flex flex-col items-center gap-2 z-20">
                     <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Check contrast in both modes</p>
                     <button onClick={() => setIsDarkPreview(!isDarkPreview)} className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all">
                         <div className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                             <span className="material-symbols-outlined text-[14px] text-slate-700 dark:text-slate-300">{isDarkPreview ? 'light_mode' : 'dark_mode'}</span>
                         </div>
                         <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-300">
                             {isDarkPreview ? 'Light Mode' : 'Dark Mode'} — <span className="text-blue-500 dark:text-amber-500">Switch</span>
                         </span>
                     </button>
                 </div>
                 <InlineBotPreview settings={settings} theme={isDarkPreview ? 'dark' : 'light'} />
            </div>
        </div>
    );
}
