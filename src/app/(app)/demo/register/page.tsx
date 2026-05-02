'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBotConfig, saveBotConfig } from '@/src/lib/demo/demoStorage';

const inputCls = "w-full pl-10 pr-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/50 dark:focus:ring-blue-500/50 focus:border-blue-400 dark:focus:border-blue-400 text-sm text-slate-900 dark:text-slate-200 transition-colors rounded-sm dark:focus:bg-slate-900";
const cellCls = "bg-white dark:bg-slate-950 transition-colors duration-500";

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
        <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-slate-950 px-4 py-4 sm:px-8 sm:py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400 transition-colors">smart_toy</span>
                    <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">Create Your Bot</h1>
                </div>
                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed transition-colors">Configure your bot and get your API integration credentials.</p>
            </div>

            <AnimatePresence mode="wait" initial={false}>
                {!registrationData ? (
                    <motion.div
                        key="form"
                        exit={{ opacity: 0, y: -8 }}
                        className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[#E8EBF0] dark:bg-slate-800 flex-1 overflow-hidden transition-colors duration-500"
                    >
                        {/* Left panel */}
                        <div className={`lg:col-span-5 ${cellCls} p-6 sm:p-10 overflow-y-auto custom-scrollbar`}>
                            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 mb-4 transition-colors">
                                Identity &{' '}
                                <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">Deployment</span>
                            </h2>
                            <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-8 transition-colors">
                                Configure your bot identity. In the real platform, this provisions a live API key and domain-locked widget.
                            </p>
                            <div className="space-y-4">
                                {[
                                    { icon: 'bolt', text: 'Instant Creation', sub: 'Active immediately' },
                                    { icon: 'verified_user', text: 'Enterprise Security', sub: 'Domain-locked access' },
                                    { icon: 'code', text: 'Easy Integration', sub: 'Zero-config snippet' },
                                ].map((f, i) => (
                                    <div key={i} className="flex text-md font-google items-center gap-4 p-4 border border-gray-100 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 group hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                                        <div className="w-10 h-10 border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-950 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                                            <span className="material-symbols-outlined text-[16px] text-slate-900 dark:text-slate-200 transition-colors">{f.icon}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-900 dark:text-slate-200 font-medium transition-colors">{f.text}</p>
                                            <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mt-0.5 transition-colors">{f.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Right panel — form */}
                        <div className={`lg:col-span-7 ${cellCls} p-6 sm:p-10 overflow-y-auto custom-scrollbar border-l border-gray-100 dark:border-slate-800 relative`}>
                            <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-1 transition-colors">AI ChatBot Config</h3>
                            <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-8 transition-colors">Fill in details to save your demo configuration.</p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {[
                                    { name: 'companyName', label: 'Company Name', icon: 'corporate_fare', type: 'text', placeholder: 'Acme Inc.' },
                                    { name: 'allowedOrigin', label: 'Allowed Origin', icon: 'public', type: 'url', placeholder: 'https://example.com' },
                                ].map(f => (
                                    <div key={f.name}>
                                        <label className="block text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1.5 transition-colors">{f.label}</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-600 dark:text-slate-500 transition-colors">{f.icon}</span>
                                            <input
                                                type={f.type}
                                                name={f.name}
                                                required
                                                value={(formData as any)[f.name]}
                                                onChange={handleChange}
                                                className={inputCls + ' text-sm font-google tracking-wide'}
                                                placeholder={f.placeholder}
                                            />
                                        </div>
                                    </div>
                                ))}

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1.5 transition-colors">Theme Color</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-600 dark:text-slate-500 transition-colors">palette</span>
                                            <input
                                                type="text"
                                                name="themeColor"
                                                value={formData.themeColor}
                                                onChange={handleChange}
                                                className={inputCls + ' pr-12 font-mono uppercase'}
                                            />
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 border border-gray-100 dark:border-slate-700 overflow-hidden transition-colors">
                                                <input
                                                    type="color"
                                                    name="themeColor"
                                                    value={formData.themeColor}
                                                    onChange={handleChange}
                                                    className="absolute inset-[-8px] w-[200%] h-[200%] cursor-pointer"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1.5 transition-colors">Tone</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-600 dark:text-slate-500 transition-colors">forum</span>
                                            <select
                                                name="companyTone"
                                                value={formData.companyTone}
                                                onChange={handleChange}
                                                className={inputCls + ' appearance-none text-sm font-mono'}
                                            >
                                                <option value="Professional and helpful">Professional</option>
                                                <option value="Friendly and casual">Friendly</option>
                                                <option value="Technical and concise">Technical</option>
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-600 dark:text-slate-500 pointer-events-none transition-colors">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full flex items-center justify-center gap-2 py-3 min-h-[44px] bg-gradient-to-r from-blue-600 to-green-600 text-white text-md uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all active:scale-[0.99]"
                                >
                                    Create <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </button>
                            </form>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="success"
                        className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500"
                    >
                        {/* Success header */}
                        <div className="bg-white dark:bg-slate-950 px-4 py-4 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6 border-b border-gray-100 dark:border-slate-800 shrink-0 transition-colors duration-500">
                            <div className="w-12 h-12 border-2 border-emerald-900 dark:border-emerald-500 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0 transition-colors">
                                <span className="material-symbols-outlined text-[24px] text-emerald-900 dark:text-emerald-500 transition-colors">check_circle</span>
                            </div>
                            <div className="flex-1">
                                <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 uppercase transition-colors">{registrationData.companyName}</h2>
                                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mt-1 transition-colors">Config saved to demo session.</p>
                            </div>
                            <div className="flex gap-3 sm:gap-4 sm:ml-auto">
                                <button
                                    onClick={() => router.push('/demo/train')}
                                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-gradient-to-r from-blue-600 to-green-600 text-white text-md uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md"
                                >
                                    Train AI <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </button>
                                <button
                                    onClick={handleReset}
                                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 border border-gray-100 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-md uppercase tracking-widest font-bold font-sans hover:bg-[#FAFAFA] dark:hover:bg-slate-800 transition-all active:scale-95"
                                >
                                    New Config
                                </button>
                            </div>
                        </div>

                        {/* API Key + Embed */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E8EBF0] dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors">
                            <div className="bg-white dark:bg-slate-950 p-6 sm:p-8 transition-colors">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[14px] text-slate-600 dark:text-slate-500 transition-colors">vpn_key</span>
                                    <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans transition-colors">Demo Session ID</p>
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-[#FAFAFA] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 font-mono text-sm text-slate-900 dark:text-slate-200 font-medium transition-colors">
                                    <span className="flex-1 truncate">{registrationData.apiKey}</span>
                                    <button
                                        onClick={() => handleCopy(registrationData.apiKey)}
                                        className="p-2 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 transition-colors shadow-sm"
                                    >
                                        {copied
                                            ? <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                                            : <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                        }
                                    </button>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-slate-950 p-6 sm:p-8 transition-colors">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[14px] text-slate-600 dark:text-slate-500 transition-colors">code</span>
                                    <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-display transition-colors">Quick Embed</p>
                                </div>
                                <div className="relative">
                                    <pre className="p-4 bg-slate-900 border border-slate-900 text-blue-300 text-md font-mono overflow-x-auto leading-relaxed h-[88px] flex items-center">
                                        <code>{embedSnippet}</code>
                                    </pre>
                                    <button
                                        onClick={() => handleCopy(embedSnippet)}
                                        className="absolute top-2 right-2 p-2 bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors"
                                    >
                                        {copied
                                            ? <span className="material-symbols-outlined text-[16px] text-emerald-400">check_circle</span>
                                            : <span className="material-symbols-outlined text-[16px]">content_copy</span>
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* CTA links */}
                        <div className="p-4 sm:p-8 pt-4 flex flex-col sm:flex-row gap-4">
                            <Link
                                href="/demo/chat"
                                className="flex-1 py-4 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-center text-md uppercase tracking-widest font-bold font-sans transition-colors"
                            >
                                Try the Chat →
                            </Link>
                            <Link
                                href="/sign-up"
                                className="flex-1 py-4 border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-[#FAFAFA] dark:hover:bg-slate-800 text-center text-md uppercase tracking-widest font-bold font-sans transition-colors"
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
