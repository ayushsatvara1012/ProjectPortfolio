'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBotConfig, saveBotConfig } from '@/src/lib/demo/demoStorage';

const inputCls = "w-full pl-10 pr-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/50 text-sm text-slate-900 dark:text-slate-200 transition-colors rounded-sm";
const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

export default function DemoCreateBotPage() {
    const router = useRouter();
    const current = getBotConfig();

    const [formData, setFormData] = useState({
        companyName: current.companyName || 'Demo Company',
        allowedOrigin: current.allowedOrigin || 'https://demo.sapybase.com',
        themeColor: current.themeColor || '#5730F5',
        companyTone: current.companyTone_str || 'Professional and helpful',
    });
    const [saved, setSaved] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.companyName.trim()) return;
        saveBotConfig({
            companyName: formData.companyName,
            allowedOrigin: formData.allowedOrigin,
            themeColor: formData.themeColor,
            primaryColor: formData.themeColor,
            companyTone_str: formData.companyTone,
            name: (formData.companyName.trim() || 'Demo') + ' AI',
        });
        setSaved(true);
    };

    const handleReset = () => {
        setSaved(false);
    };

    return (
        <div className="flex flex-col bg-[#E8EBF0] dark:bg-slate-900 min-h-full">
            <div className="bg-white dark:bg-slate-950 px-8 py-6 border-b border-gray-100 dark:border-slate-800">
                <h1 className="text-2xl font-bold">Create Your Bot</h1>
                <p className="text-sm text-slate-500">Configure your demo bot identity (Local Only).</p>
            </div>

            <AnimatePresence mode="wait">
                {!saved ? (
                    <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-gray-200/30 dark:bg-slate-800/30">
                        <div className={`lg:col-span-5 ${cellCls} p-10`}>
                            <h2 className="text-4xl font-bold mb-6 text-slate-900 dark:text-slate-200">Identity & <span className="text-blue-600">Deployment</span></h2>
                            <p className="text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">Configure your bot identity. In the real platform, this provisions a live API key and domain-locked widget.</p>
                            <div className="space-y-4">
                                {[{ icon: 'bolt', t: 'Instant Creation' }, { icon: 'verified_user', t: 'Security' }, { icon: 'code', t: 'Easy Embed' }].map(f => (
                                    <div key={f.t} className="flex items-center gap-4 p-4 border border-gray-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 transition-colors">
                                        <div className="w-10 h-10 bg-white dark:bg-slate-800 flex items-center justify-center border border-gray-100 dark:border-slate-700">
                                            <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-400">{f.icon}</span>
                                        </div>
                                        <span className="font-bold text-sm text-slate-800 dark:text-slate-200">{f.t}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className={`lg:col-span-7 ${cellCls} p-10 lg:border-l border-gray-100 dark:border-slate-800`}>
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">Company Name</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">corporate_fare</span>
                                        <input type="text" name="companyName" value={formData.companyName} onChange={handleChange} className={inputCls} />
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">Allowed Origin</label>
                                    <div className="relative">
                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">public</span>
                                        <input type="url" name="allowedOrigin" value={formData.allowedOrigin} onChange={handleChange} className={inputCls} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">Theme Color</label>
                                        <input type="color" name="themeColor" value={formData.themeColor} onChange={handleChange} className="w-full h-10 border p-1" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 block">Tone</label>
                                        <select name="companyTone" value={formData.companyTone} onChange={handleChange} className={inputCls}>
                                            <option value="Professional and helpful">Professional</option>
                                            <option value="Friendly and casual">Friendly</option>
                                            <option value="Technical and concise">Technical</option>
                                        </select>
                                    </div>
                                </div>
                                <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold uppercase tracking-widest hover:bg-blue-700 transition-colors">Save Config</button>
                            </form>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-10 space-y-6">
                        <div className="bg-white dark:bg-slate-950 p-8 border border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center transition-colors">
                            <div className="flex items-center gap-6">
                                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center rounded-full"><span className="material-symbols-outlined text-[24px]">check_circle</span></div>
                                <div>
                                    <h2 className="text-2xl font-bold uppercase text-slate-900 dark:text-slate-200">{formData.companyName}</h2>
                                    <p className="text-slate-500 dark:text-slate-400">Bot config saved to demo session.</p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={() => router.push('/demo/train')} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase text-xs transition-colors">Train AI →</button>
                                <button onClick={handleReset} className="px-6 py-2.5 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 font-bold uppercase text-xs transition-colors">Edit Again</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                             <div className="bg-white dark:bg-slate-950 p-8 border border-gray-100 dark:border-slate-800 transition-colors">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Demo Session ID</p>
                                <div className="p-4 bg-slate-50 dark:bg-slate-900 font-mono text-sm border border-gray-100 dark:border-slate-800 text-slate-700 dark:text-slate-300">demo_session_not_real</div>
                             </div>
                             <div className="bg-white dark:bg-slate-950 p-8 border border-gray-100 dark:border-slate-800 transition-colors">
                                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4">Quick Embed</p>
                                <pre className="p-4 bg-slate-900 text-blue-300 text-xs overflow-auto">{`<script src="https://sapybase.com/widget.js"\n  data-api-key="sb_demo" defer></script>`}</pre>
                             </div>
                        </div>

                        <div className="flex gap-4">
                            <Link href="/demo/chat" className="flex-1 py-4 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-center font-bold uppercase transition-colors">Try the Chat →</Link>
                            <Link href="/sign-up" className="flex-1 py-4 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 text-center font-bold uppercase transition-colors">Create Real Account</Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
