import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { getBotConfig, getKnowledge, isTrained } from './demoStorage';

const SPEED_BADGE = {
    demo: { label: 'Demo', cls: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-400' },
};

const DemoMyBots = () => {
    const navigate = useNavigate();
    const botConfig = getBotConfig();
    const chunks = getKnowledge();
    const trained = isTrained();
    const chunksUsed = chunks.length;
    const chunkLimit = 200;
    const msgUsed = 0;
    const msgLimit = 15;

    const bot = {
        id: 'demo-bot',
        bot_name: botConfig.name,
        company_name: botConfig.companyName,
        allowed_origin: botConfig.allowedOrigin,
        theme_color: botConfig.themeColor || botConfig.primaryColor || '#5730F5',
        messages_used: msgUsed,
        chunks_used: chunksUsed,
    };

    const speedInfo = SPEED_BADGE.demo;

    return (
        <div className="flex flex-col min-h-[calc(100vh-5rem)] bg-slate-50 dark:bg-slate-900 transition-all duration-500 relative overflow-x-hidden">
            <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-100"
                style={{ backgroundImage: "url('/nature.webp')" }} />
            <div className="absolute inset-0 bg-white/40 dark:bg-slate-950/70 backdrop-blur-[2px] pointer-events-none" />

            <div className="relative flex flex-col h-full z-10">
                {/* Header */}
                <div className="bg-white/70 dark:bg-slate-950/70 backdrop-blur-md px-4 py-4 sm:px-8 sm:py-6 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 transition-colors">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[16px] text-slate-600 dark:text-slate-400">smart_toy</span>
                            <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200">My Bots</h1>
                        </div>
                        <p className="text-md font-display text-slate-500 dark:text-slate-400">Manage your AI assistants. (Demo — 1 bot included)</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                        <span className={`px-3 py-1 text-[10px] uppercase tracking-widest font-bold font-google border ${speedInfo.cls}`}>
                            {speedInfo.label} Speed
                        </span>
                        <span className="text-md font-google text-slate-500 dark:text-slate-400">1 / 1 bots</span>
                    </div>
                </div>

                {/* Plan summary strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-200/30 dark:bg-slate-800/30 border-b border-gray-100 dark:border-slate-800 transition-colors">
                    {[
                        { label: 'Plan', value: 'DEMO' },
                        { label: 'Msgs / Bot / Mo', value: String(msgLimit) },
                        { label: 'Knowledge Chunks', value: String(chunkLimit) },
                    ].map((s, i) => (
                        <div key={i} className="bg-white/50 dark:bg-slate-950/70 backdrop-blur-md px-4 py-3 sm:px-6 sm:py-4 transition-colors">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mb-0.5">{s.label}</p>
                            <p className="text-lg font-google font-semibold text-slate-900 dark:text-slate-200">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Bot Cards */}
                <div className="flex-1 p-4 sm:p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {/* Demo Bot Card */}
                        <motion.div
                            layout
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 flex flex-col transition-colors"
                        >
                            <div className="h-1 w-full" style={{ backgroundColor: bot.theme_color }} />
                            <div className="p-5 flex flex-col flex-1 gap-3">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-md font-google font-bold text-slate-900 dark:text-slate-200">{bot.bot_name}</h3>
                                        <p className="text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mt-0.5">{bot.company_name}</p>
                                    </div>
                                    <div className="w-8 h-8 rounded-full border border-gray-100 dark:border-slate-800 flex items-center justify-center"
                                        style={{ backgroundColor: bot.theme_color + '20' }}>
                                        <span className="material-symbols-outlined text-[16px]" style={{ color: bot.theme_color }}>smart_toy</span>
                                    </div>
                                </div>

                                <a href={bot.allowed_origin} target="_blank" rel="noopener noreferrer"
                                    className="text-sm tracking-wide font-medium text-blue-600 dark:text-slate-500 font-google truncate flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px]">link</span> {bot.allowed_origin}
                                </a>

                                {/* Knowledge status */}
                                <div className="flex items-center gap-2 px-3 py-2 rounded-sm border text-[10px] uppercase tracking-widest font-bold font-sans
                                    bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                                    <span className="material-symbols-outlined text-[14px]">{trained ? 'check_circle' : 'radio_button_unchecked'}</span>
                                    {trained ? `${chunksUsed} chunks trained` : 'Not trained yet'}
                                </div>

                                {/* Usage bar */}
                                <div>
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mb-1">
                                        <span>Usage</span>
                                        <span>{msgUsed} / {msgLimit}</span>
                                    </div>
                                    <div className="h-1 bg-slate-100 dark:bg-slate-800 w-full">
                                        <div className="h-full bg-slate-900 dark:bg-blue-500 transition-all" style={{ width: `${Math.min((msgUsed / msgLimit) * 100, 100)}%` }} />
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-auto pt-3 border-t border-gray-100 dark:border-slate-800">
                                    <button onClick={() => navigate('/demo/train')}
                                        className="flex-1 py-2 text-[10px] uppercase tracking-widest font-bold font-sans bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors flex items-center justify-center gap-1 cursor-pointer">
                                        <span className="material-symbols-outlined text-[12px]">psychology</span> Train
                                    </button>
                                    <button onClick={() => navigate('/demo/customize')}
                                        className="flex-1 py-2 text-[10px] uppercase tracking-widest font-bold font-sans border border-gray-100 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors flex items-center justify-center gap-1 cursor-pointer">
                                        <span className="material-symbols-outlined text-[12px]">settings</span> Settings
                                    </button>
                                    <button onClick={() => navigate('/demo/chat')}
                                        className="flex items-center justify-center p-2 border border-blue-100 dark:border-blue-900/40 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors cursor-pointer">
                                        <span className="material-symbols-outlined text-[14px]">chat</span>
                                    </button>
                                </div>
                            </div>
                        </motion.div>

                        {/* Add new bot — locked in demo */}
                        <motion.div layout
                            className="border-2 border-dashed border-gray-100 dark:border-slate-800 flex flex-col items-center justify-center p-8 min-h-[200px] transition-colors bg-gray-50/50 dark:bg-slate-900/50 cursor-not-allowed">
                            <span className="material-symbols-outlined text-[20px] text-slate-300 dark:text-slate-600 mb-3">lock</span>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-300 dark:text-slate-600 font-sans text-center">Bot Limit Reached</p>
                            <Link to="/sign-up" onClick={e => e.stopPropagation()}
                                className="mt-3 text-[10px] uppercase tracking-widest font-bold font-sans text-blue-600 dark:text-blue-400 hover:underline">
                                Sign Up for More →
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DemoMyBots;
