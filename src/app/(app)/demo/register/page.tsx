'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBotConfig, saveBotConfig } from '@/src/lib/demo/demoStorage';

const inputCls = "w-full text-sm font-google px-4 py-3 bg-slate-100 dark:bg-white/[0.04] focus:bg-slate-200 dark:focus:bg-white/[0.08] focus:outline-none text-slate-900 dark:text-slate-200 transition-colors rounded-xl";
const labelCls = "block text-sm font-medium font-google text-slate-600 dark:text-slate-400 mb-2 transition-colors";
const cardCls = "bg-white dark:bg-white/[0.02] rounded-2xl transition-colors duration-500";

export default function DemoCreateBotPage() {
    const router = useRouter();
    const current = getBotConfig();

    const [formData, setFormData] = useState({
        companyName: current.companyName || '',
        allowedOrigin: current.allowedOrigin || '',
        themeColor: current.themeColor || '#5730F5',
        companyTone: current.companyTone_str || 'Professional and helpful',
    });
    const [registrationData, setRegistrationData] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.companyName.trim() || !formData.allowedOrigin.trim()) return;
        saveBotConfig({
            companyName: formData.companyName,
            allowedOrigin: formData.allowedOrigin,
            themeColor: formData.themeColor,
            primaryColor: formData.themeColor,
            companyTone_str: formData.companyTone,
            name: formData.companyName.trim() + ' AI',
        });
        setRegistrationData({
            apiKey: 'sb_demo_not_real',
            companyName: formData.companyName,
            allowedOrigin: formData.allowedOrigin,
        });
    };

    const handleReset = () => {
        setRegistrationData(null);
        setFormData({ companyName: '', allowedOrigin: '', themeColor: '#5730F5', companyTone: 'Professional and helpful' });
    };

    const embedSnippet = `<script src="https://sapybase.com/widget.js" data-api-key="${registrationData?.apiKey}" defer></script>`;

    return (
        <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-500">
            {/* Header */}
            <div className="px-6 md:px-8 pt-8 pb-6 shrink-0">
                <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">domain</span>
                    <h1 className="text-2xl md:text-3xl font-semibold font-google text-slate-900 dark:text-slate-200 transition-colors">Create Bot</h1>
                </div>
                <p className="text-sm font-google text-slate-500 dark:text-slate-400">Configure your AI bot identity and receive integration credentials.</p>
            </div>

            <AnimatePresence mode="wait" initial={false}>
                {!registrationData ? (
                    <motion.div
                        key="form"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 px-6 md:px-8 pb-8"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {/* Left panel - Info */}
                            <div className={`${cardCls} p-6 md:p-8 flex flex-col`}>
                                <h2 className="text-lg font-semibold font-google text-slate-900 dark:text-slate-200 mb-2 transition-colors">
                                    Identity &amp; deployment
                                </h2>
                                <p className="text-sm font-google text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                    Configure your bot identity. In the real platform, this provisions a live API key and domain-locked widget.
                                </p>
                                <div className="space-y-3">
                                    {[
                                        { icon: 'bolt', text: 'Instant Creation', sub: 'Active immediately' },
                                        { icon: 'verified_user', text: 'Enterprise Security', sub: 'Domain-locked access' },
                                        { icon: 'code', text: 'Easy Integration', sub: 'Zero-config snippet' },
                                    ].map((f, i) => (
                                        <motion.div key={i}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.05 + i * 0.07 }}
                                            className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] transition-colors"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">{f.icon}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-900 dark:text-slate-200 font-medium transition-colors">{f.text}</p>
                                                <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-0.5 transition-colors">{f.sub}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Right panel — form */}
                            <div className={`${cardCls} p-6 md:p-8 relative`}>
                                <h3 className="text-lg font-semibold font-google text-slate-900 dark:text-slate-200 mb-2 transition-colors">Bot configuration</h3>
                                <p className="text-sm font-google text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">Fill in details to save your demo configuration.</p>

                                <form onSubmit={handleSubmit} className="space-y-5">
                                    {[
                                        { name: 'companyName', label: 'Company Name', icon: 'corporate_fare', type: 'text', placeholder: 'Acme Inc.' },
                                        { name: 'allowedOrigin', label: 'Allowed Origin', icon: 'public', type: 'url', placeholder: 'https://example.com' },
                                    ].map(f => (
                                        <div key={f.name}>
                                            <label className={labelCls}>{f.label}</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">{f.icon}</span>
                                                <input
                                                    type={f.type}
                                                    name={f.name}
                                                    required
                                                    value={(formData as any)[f.name]}
                                                    onChange={handleChange}
                                                    className={inputCls + ' pl-10'}
                                                    placeholder={f.placeholder}
                                                />
                                            </div>
                                        </div>
                                    ))}

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Theme Color</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">palette</span>
                                                <input
                                                    type="text"
                                                    name="themeColor"
                                                    value={formData.themeColor}
                                                    onChange={handleChange}
                                                    className={inputCls + ' pl-10 pr-12 font-mono uppercase'}
                                                />
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-white/[0.08]">
                                                    <input
                                                        type="color"
                                                        name="themeColor"
                                                        value={formData.themeColor}
                                                        onChange={handleChange}
                                                        className="absolute inset-[-6px] w-[calc(100%+12px)] h-[calc(100%+12px)] cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Tone</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">forum</span>
                                                <select
                                                    name="companyTone"
                                                    value={formData.companyTone}
                                                    onChange={handleChange}
                                                    className={inputCls + ' pl-10 appearance-none'}
                                                >
                                                    <option value="Professional and helpful">Professional</option>
                                                    <option value="Friendly and casual">Friendly</option>
                                                    <option value="Technical and concise">Technical</option>
                                                </select>
                                                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 dark:text-slate-500 pointer-events-none">expand_more</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-3.5 min-h-[48px] bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
                                    >
                                        Create bot <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                    </button>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 px-6 md:px-8 pb-8 space-y-5"
                    >
                        {/* Success header card */}
                        <div className={`${cardCls} p-6 md:p-8 flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6`}>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[24px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl md:text-2xl font-semibold font-google text-slate-900 dark:text-slate-200 transition-colors">{registrationData.companyName}</h2>
                                <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-0.5">Config saved to demo session.</p>
                            </div>
                            <div className="flex flex-wrap gap-3 shrink-0">
                                <button
                                    onClick={() => router.push('/demo/train')}
                                    className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center gap-2 active:scale-[0.98] cursor-pointer"
                                >
                                    Train AI <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="px-5 py-2.5 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 text-sm font-semibold font-google rounded-xl hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors active:scale-[0.98] cursor-pointer"
                                >
                                    New bot
                                </button>
                            </div>
                        </div>

                        {/* Credentials grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className={`${cardCls} p-6`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">vpn_key</span>
                                    <p className="text-sm font-medium font-google text-slate-600 dark:text-slate-400">Demo Session ID</p>
                                </div>
                                <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/[0.04]">
                                    <span className="flex-1 truncate text-sm font-mono text-slate-900 dark:text-slate-200">{registrationData.apiKey}</span>
                                    <button
                                        onClick={() => handleCopy(registrationData.apiKey)}
                                        className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-white/[0.10] transition-colors shrink-0 cursor-pointer"
                                    >
                                        {copied
                                            ? <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-450">check</span>
                                            : <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                        }
                                    </button>
                                </div>
                            </div>
                            <div className={`${cardCls} p-6`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">code</span>
                                    <p className="text-sm font-medium font-google text-slate-600 dark:text-slate-400">Quick Embed</p>
                                </div>
                                <div className="relative">
                                    <pre className="p-3.5 bg-slate-900 dark:bg-slate-950 rounded-xl text-blue-300 text-xs font-mono overflow-x-auto leading-relaxed">
                                        <code>{embedSnippet}</code>
                                    </pre>
                                    <button
                                        onClick={() => handleCopy(embedSnippet)}
                                        className="absolute top-2 right-2 p-1.5 rounded-lg text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition-colors cursor-pointer"
                                    >
                                        {copied
                                            ? <span className="material-symbols-outlined text-[15px] text-emerald-400">check</span>
                                            : <span className="material-symbols-outlined text-[15px]">content_copy</span>
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* CTA links */}
                        <div className={`${cardCls} flex flex-col sm:flex-row gap-4`}>
                            <Link
                                href="/demo/chat"
                                className="flex-1 py-3.5 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-center text-sm font-semibold rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                            >
                                Try the Chat →
                            </Link>
                            <Link
                                href="/sign-up"
                                className="flex-1 py-3.5 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-center text-sm font-semibold rounded-xl transition-colors flex items-center justify-center cursor-pointer"
                            >
                                Create Real Account
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}



