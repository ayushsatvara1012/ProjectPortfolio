import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { getBotConfig, saveBotConfig } from './demoStorage';

const inputCls = "w-full pl-10 pr-3 py-2.5 bg-transparent border border-gray-100 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500/50 dark:focus:ring-blue-500/50 focus:border-blue-400 dark:focus:border-blue-400 text-sm text-slate-900 dark:text-slate-200 transition-colors rounded-sm dark:focus:bg-slate-900";
const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

const DemoCreateBot = () => {
    const navigate = useNavigate();
    const current = getBotConfig();

    const [formData, setFormData] = useState({
        companyName: current.companyName || 'Demo Company',
        allowedOrigin: current.allowedOrigin || 'https://demo.sapybase.com',
        themeColor: current.themeColor || '#5730F5',
        companyTone: current.companyTone_str || 'Professional and helpful',
    });
    const [saved, setSaved] = useState(false);

    const handleChange = e => setFormData({ ...formData, [e.target.name]: e.target.value });

    const handleSubmit = (e) => {
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
        const fresh = getBotConfig();
        setFormData({
            companyName: fresh.companyName,
            allowedOrigin: fresh.allowedOrigin,
            themeColor: fresh.themeColor,
            companyTone: fresh.companyTone_str,
        });
    };

    return (
        <div className="flex flex-col bg-[#E8EBF0] dark:bg-slate-900 overflow-x-hidden transition-colors duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-slate-950 px-4 py-4 sm:px-8 sm:py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">smart_toy</span>
                    <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200">Create Your Bot</h1>
                </div>
                <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed">
                    Configure your demo bot identity. Changes are saved locally in this browser tab only.
                </p>
            </div>

            <AnimatePresence mode="wait" initial={false}>
                {!saved ? (
                    <motion.div key="form" exit={{ opacity: 0, y: -8 }}
                        className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-[#E8EBF0] dark:bg-slate-800 flex-1 overflow-hidden transition-colors duration-500">

                        {/* Left: Feature highlights */}
                        <div className={`lg:col-span-5 ${cellCls} p-4 sm:p-10 min-w-0 custom-scrollbar`}>
                            <h2 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 mb-4">
                                Identity &{' '}
                                <span className="bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">Deployment</span>
                            </h2>
                            <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-8">
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
                                            <span className="material-symbols-outlined text-[16px] text-slate-900 dark:text-slate-200">{f.icon}</span>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">{f.text}</p>
                                            <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mt-0.5">{f.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Demo note */}
                            <div className="mt-8 p-4 bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 flex items-start gap-3">
                                <span className="material-symbols-outlined text-[18px] text-amber-500 mt-0.5 shrink-0">experiment</span>
                                <p className="text-md font-display text-amber-700 dark:text-amber-300 leading-relaxed">
                                    Demo mode — no API key is generated. Identity is stored in your browser tab only.
                                </p>
                            </div>
                        </div>

                        {/* Right: Form */}
                        <div className={`lg:col-span-7 ${cellCls} p-4 sm:p-10 overflow-y-auto custom-scrollbar lg:border-l border-gray-100 dark:border-slate-800 min-w-0`}>
                            <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-1">AI ChatBot Config</h3>
                            <p className="text-md font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-8">Configure your demo bot's identity.</p>

                            <form onSubmit={handleSubmit} className="space-y-5">
                                {[
                                    { name: 'companyName', label: 'Company Name', icon: 'corporate_fare', type: 'text', placeholder: 'Acme Inc.' },
                                    { name: 'allowedOrigin', label: 'Allowed Origin', icon: 'public', type: 'url', placeholder: 'https://example.com' },
                                ].map(f => (
                                    <div key={f.name}>
                                        <label className="block text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1.5">{f.label}</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-600 dark:text-slate-500">{f.icon}</span>
                                            <input type={f.type} name={f.name} value={formData[f.name]}
                                                onChange={handleChange} className={inputCls + ' text-sm font-google tracking-wide'} placeholder={f.placeholder} />
                                        </div>
                                    </div>
                                ))}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1.5">Theme Color</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-600 dark:text-slate-500">palette</span>
                                            <input type="text" name="themeColor" value={formData.themeColor}
                                                onChange={handleChange} className={inputCls + ' pr-12 font-mono uppercase'} />
                                            <div className="absolute right-1 top-1/2 -translate-y-1/2 w-8 h-8 border border-gray-100 dark:border-slate-700 overflow-hidden">
                                                <input type="color" name="themeColor" value={formData.themeColor}
                                                    onChange={handleChange} className="absolute inset-[-8px] w-[200%] h-[200%] cursor-pointer" />
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans mb-1.5">Tone</label>
                                        <div className="relative">
                                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-600 dark:text-slate-500">forum</span>
                                            <select name="companyTone" value={formData.companyTone} onChange={handleChange}
                                                className={inputCls + ' appearance-none text-sm font-mono'}>
                                                <option value="Professional and helpful">Professional</option>
                                                <option value="Friendly and casual">Friendly</option>
                                                <option value="Technical and concise">Technical</option>
                                            </select>
                                            <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-600 dark:text-slate-500 pointer-events-none">expand_more</span>
                                        </div>
                                    </div>
                                </div>

                                <button type="submit"
                                    className="w-full flex items-center justify-center gap-2 py-3 min-h-[44px] bg-gradient-to-r from-blue-600 to-green-600 text-white text-md uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all active:scale-[0.99]">
                                    Save Config <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                </button>
                            </form>
                        </div>
                    </motion.div>
                ) : (
                    <motion.div key="success"
                        className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500">

                        <div className="bg-white dark:bg-slate-950 px-4 py-4 sm:px-8 sm:py-6 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 border-b border-gray-100 dark:border-slate-800 shrink-0 transition-colors duration-500">
                            <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                                <div className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-emerald-900 dark:border-emerald-500 bg-white dark:bg-slate-900 flex items-center justify-center shrink-0">
                                    <span className="material-symbols-outlined text-[20px] sm:text-[24px] text-emerald-900 dark:text-emerald-500">check_circle</span>
                                </div>
                                <div className="min-w-0">
                                    <h2 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 uppercase truncate">{formData.companyName}</h2>
                                    <p className="text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">Bot config saved to demo session.</p>
                                </div>
                            </div>
                            <div className="flex gap-2 sm:gap-4 w-full sm:w-auto sm:ml-auto">
                                <button onClick={() => navigate('/demo/train')}
                                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 bg-gradient-to-r from-blue-600 to-green-600 text-white text-[10px] sm:text-md uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all flex items-center justify-center gap-2 active:scale-95 shadow-md">
                                    Train AI <span className="material-symbols-outlined text-[14px] sm:text-[16px]">arrow_forward</span>
                                </button>
                                <button onClick={handleReset}
                                    className="flex-1 sm:flex-none px-4 sm:px-6 py-2.5 border border-gray-100 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-[10px] sm:text-md uppercase tracking-widest font-bold font-sans hover:bg-[#FAFAFA] dark:hover:bg-slate-800 transition-all active:scale-95">
                                    Edit Again
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-[#E8EBF0] dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
                            <div className="bg-white dark:bg-slate-950 p-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[14px] text-slate-600 dark:text-slate-500">vpn_key</span>
                                    <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans">Demo Session ID</p>
                                </div>
                                <div className="flex items-center gap-3 p-4 bg-[#FAFAFA] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 font-mono text-sm text-slate-900 dark:text-slate-200 font-medium">
                                    <span className="flex-1 truncate text-amber-600 dark:text-amber-400">demo_session — not a real API key</span>
                                    <span className="material-symbols-outlined text-[16px] text-slate-400">experiment</span>
                                </div>
                                <p className="mt-3 text-xs font-google text-slate-400 leading-relaxed">
                                    In the real platform, a unique API key like <code className="font-mono">sb_xxxxx</code> would be generated here for embedding.
                                </p>
                            </div>
                            <div className="bg-white dark:bg-slate-950 p-8">
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[14px] text-slate-600 dark:text-slate-500">code</span>
                                    <p className="text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-display">Quick Embed (Preview)</p>
                                </div>
                                <pre className="p-4 bg-slate-900 border border-slate-900 text-blue-300 text-md font-mono overflow-x-auto max-w-full leading-relaxed h-[88px] flex items-center opacity-60">
                                    <code>{`<script src="https://sapybase.com/widget.js"\n  data-api-key="sb_demo_xxxx" defer></script>`}</code>
                                </pre>
                                <p className="mt-3 text-xs font-google text-slate-400 leading-relaxed">Sign up to get a real embed snippet for your site.</p>
                            </div>
                        </div>

                        <div className="p-4 sm:p-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <Link to="/demo/chat"
                                className="flex-1 py-3 flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-green-600 text-white text-[10px] sm:text-md uppercase tracking-widest font-bold hover:opacity-90 transition-all">
                                <span className="material-symbols-outlined text-[16px] sm:text-[18px]">chat</span>
                                Try the Chat →
                            </Link>
                            <Link to="/sign-up"
                                className="flex-1 py-3 flex items-center justify-center gap-2 border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-[10px] sm:text-md uppercase tracking-widest font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                                <span className="material-symbols-outlined text-[16px] sm:text-[18px]">rocket_launch</span>
                                Create Real Account
                            </Link>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default DemoCreateBot;
