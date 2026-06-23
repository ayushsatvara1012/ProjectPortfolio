'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBotConfig, saveBotConfig } from '@/src/lib/demo/demoStorage';
import { Card, SectionHeader, Badge, cx, card } from '@/src/app/components/insights/ui';
import BotIntegrationDocs from '@/src/app/components/BotIntegrationDocs';

// Mirrors the production CreateBotFlow look (bordered inputs, slim labels) so the
// demo register screen is visually identical to /dashboard/register. The logic is
// localStorage-only — no /api/register call, no auth.
const inputCls = "w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2.5 text-[13.5px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 transition-colors";
const labelCls = "block text-[12.5px] font-semibold text-slate-700 dark:text-slate-300 mb-1.5 transition-colors";

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
    const [copied, setCopied] = useState<string | null>(null);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
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

    const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';

    return (
        <div className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            {/* Slim sticky sub-header — matches /dashboard/register */}
            <div className="relative shrink-0 z-20 bg-[#f8f9fa]/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70">
                <div className="px-4 md:px-6 lg:px-8 py-3">
                    <p className="text-[13px] sm:text-[13.5px] text-slate-500 dark:text-slate-400 leading-snug">
                        Configure your AI bot identity and receive integration credentials.
                    </p>
                </div>
            </div>

            <div className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-3xl">
                    <div className="flex flex-col gap-5">
                        <AnimatePresence mode="wait" initial={false}>
                            {!registrationData ? (
                                /* ── Config form ─────────────────────────────────── */
                                <motion.div
                                    key="form"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.18 }}
                                >
                                    <div className={cx('relative overflow-hidden', card, 'p-5 sm:p-6')}>
                                        <SectionHeader
                                            title="Bot configuration"
                                            subtitle="Fill in the details to save your demo bot configuration."
                                            icon="smart_toy"
                                            className="mb-5"
                                        />

                                        <form onSubmit={handleSubmit} className="space-y-4 p-2">
                                            <div>
                                                <label className={labelCls}>Company name</label>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">corporate_fare</span>
                                                    <input type="text" name="companyName" required value={formData.companyName}
                                                        onChange={handleChange} className={cx(inputCls, 'pl-10')} placeholder="Acme Inc." />
                                                </div>
                                            </div>

                                            <div>
                                                <label className={labelCls}>Allowed origin</label>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">public</span>
                                                    <input type="url" name="allowedOrigin" required value={formData.allowedOrigin}
                                                        onChange={handleChange} className={cx(inputCls, 'pl-10')} placeholder="https://example.com" />
                                                </div>
                                                <p className="mt-1.5 text-[12px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                                    Your bot's API key will be locked to this domain.
                                                </p>
                                            </div>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div>
                                                    <label className={labelCls}>Theme color</label>
                                                    <div className="relative">
                                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">palette</span>
                                                        <input type="text" name="themeColor" value={formData.themeColor}
                                                            onChange={handleChange} className={cx(inputCls, 'pl-10 pr-12 font-mono uppercase tabular-nums')} />
                                                        <div className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
                                                            <input type="color" name="themeColor" value={formData.themeColor}
                                                                onChange={handleChange}
                                                                className="absolute inset-[-6px] w-[calc(100%+12px)] h-[calc(100%+12px)] cursor-pointer" />
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className={labelCls}>Tone</label>
                                                    <div className="relative">
                                                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">forum</span>
                                                        <select name="companyTone" value={formData.companyTone} onChange={handleChange}
                                                            className={cx(inputCls, 'pl-10 pr-9 appearance-none cursor-pointer')}>
                                                            <option value="Professional and helpful">Professional</option>
                                                            <option value="Friendly and casual">Friendly</option>
                                                            <option value="Technical and concise">Technical</option>
                                                        </select>
                                                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">expand_more</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 pt-1">
                                                <button type="submit"
                                                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-7 py-2.5 text-[13.5px] font-semibold text-white hover:bg-blue-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500/70 active:scale-[0.99]">
                                                    Create bot <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </motion.div>
                            ) : (
                                /* ── Saved credentials ───────────────────────────── */
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="flex flex-col gap-4"
                                >
                                    {/* Success header */}
                                    <Card className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
                                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                                            <span className="material-symbols-outlined text-[24px]">check_circle</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-[18px] font-bold text-slate-900 dark:text-slate-100 truncate tracking-[-0.01em]">
                                                    {registrationData.companyName}
                                                </h2>
                                                <Badge tone="neutral" dot={false}>Demo</Badge>
                                            </div>
                                            <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-0.5">Config saved to this demo session.</p>
                                        </div>
                                        <div className="flex flex-wrap gap-2.5 shrink-0">
                                            <button onClick={() => router.push('/demo/train')}
                                                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-5 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors active:scale-[0.98]">
                                                <span className="material-symbols-outlined text-[16px]">psychology</span> Train this bot
                                            </button>
                                            <button onClick={handleReset}
                                                className="inline-flex items-center rounded-lg bg-slate-100 dark:bg-slate-800 px-5 py-2.5 text-[13px] font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors active:scale-[0.98]">
                                                Create another
                                            </button>
                                        </div>
                                    </Card>

                                    {/* Credentials grid */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Demo session ID */}
                                        <Card className="p-5">
                                            <div className="flex items-center gap-2 mb-3.5">
                                                <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">vpn_key</span>
                                                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Demo session ID</p>
                                            </div>
                                            <div className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800 px-3.5 py-3">
                                                <span className="flex-1 truncate text-[12.5px] font-mono text-slate-900 dark:text-slate-100">{registrationData.apiKey}</span>
                                                <button onClick={() => handleCopy(registrationData.apiKey, 'key')}
                                                    aria-label="Copy session ID"
                                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                                                    <span className="material-symbols-outlined text-[16px]">{copied === 'key' ? 'check' : 'content_copy'}</span>
                                                </button>
                                            </div>
                                        </Card>

                                        {/* Quick embed */}
                                        <Card className="p-5">
                                            <div className="flex items-center justify-between mb-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">code</span>
                                                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Quick embed</p>
                                                </div>
                                                <button onClick={() => handleCopy(`<script src="${frontendUrl}/widget.js" data-api-key="${registrationData.apiKey}" defer></script>`, 'snippet')}
                                                    aria-label="Copy embed snippet"
                                                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                                    <span className="material-symbols-outlined text-[15px]">{copied === 'snippet' ? 'check' : 'content_copy'}</span>
                                                </button>
                                            </div>
                                            <pre className="rounded-lg bg-slate-900 dark:bg-slate-950 p-3.5 text-[11.5px] font-mono text-blue-300 overflow-x-auto leading-relaxed">
                                                <code>{`<script src="${frontendUrl}/widget.js"\n  data-api-key="${registrationData.apiKey}"\n  defer></script>`}</code>
                                            </pre>
                                        </Card>
                                    </div>

                                    {/* Integration docs */}
                                    <Card>
                                        <BotIntegrationDocs apiKey={registrationData.apiKey} apiUrl="" />
                                    </Card>

                                    {/* Demo-only CTAs */}
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <Link
                                            href="/demo/chat"
                                            className="flex-1 inline-flex items-center justify-center rounded-lg bg-slate-900 dark:bg-white text-white dark:text-black py-3 text-[13.5px] font-semibold hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors"
                                        >
                                            Try the chat →
                                        </Link>
                                        <Link
                                            href="/sign-up"
                                            className="flex-1 inline-flex items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 py-3 text-[13.5px] font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                        >
                                            Create a real account
                                        </Link>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
