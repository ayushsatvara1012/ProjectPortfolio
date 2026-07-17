'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { getBotConfig, getKnowledge, isTrained } from '@/src/lib/demo/demoStorage';

const SPEED_BADGE: Record<string, { label: string; cls: string }> = {
    demo: { label: 'Demo', cls: 'text-slate-600 bg-slate-100 dark:text-slate-400 dark:bg-slate-800' },
};

export default function DemoMyBotsPage() {
    const router = useRouter();
    const [botConfig, setBotConfig] = React.useState<any>(null);
    const [chunks, setChunks] = React.useState<any[]>([]);
    const [trained, setTrained] = React.useState<boolean>(false);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setBotConfig(getBotConfig());
        setChunks(getKnowledge());
        setTrained(isTrained());
        setMounted(true);
    }, []);

    if (!mounted || !botConfig) {
        return null; // Don't paint until hydrated so server/client configs match.
    }

    const wordsUsed = chunks.reduce((sum: number, c: string) => sum + (typeof c === 'string' ? c.trim().split(/\s+/).filter(Boolean).length : 0), 0);
    const msgUsed = 0;
    const msgLimit = 15;
    const wordLimit = 12000;

    const bot = {
        id: 'demo-bot',
        bot_name: botConfig.name,
        company_name: botConfig.companyName,
        allowed_origin: botConfig.allowedOrigin,
        theme_color: botConfig.themeColor || botConfig.primaryColor || '#5730F5',
        messages_used: msgUsed,
    };

    const plan = {
        tier: 'DEMO',
        can_add_more: false,
        speed_tier: 'demo',
        current_bots: 1,
        max_bots: 1,
        message_limit: msgLimit,
        word_limit: wordLimit,
    };

    const speedInfo = SPEED_BADGE[plan.speed_tier];

    return (
        <div className="flex flex-col h-full bg-[#f8f9fa] dark:bg-slate-950 transition-all duration-500 relative overflow-hidden">
            <div className="relative flex flex-col h-full z-10">
                {/* Header — breadcrumb in the top nav carries the title (matches dashboard) */}
                <div className="px-6 py-5 sm:px-8 sm:py-6 flex items-center justify-between transition-colors">
                    <div>
                        <p className="text-sm md:text-base font-display text-slate-500 dark:text-slate-400">Manage all your AI assistants across your plan.</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3">
                        <span className={`px-3 py-1.5 text-xs font-medium font-google rounded-full ${speedInfo.cls}`}>
                            {speedInfo.label} Speed
                        </span>
                        <span className="text-sm font-google text-slate-500 dark:text-slate-400">
                            {plan.current_bots} / {plan.max_bots} bots
                        </span>
                    </div>
                </div>

                {/* Plan Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 px-6 md:px-8 mb-6">
                    {[
                        { label: 'Plan', value: plan.tier },
                        { label: 'Messages / bot / mo', value: plan.message_limit.toLocaleString() },
                        { label: 'Knowledge words', value: plan.word_limit.toLocaleString() },
                    ].map((s, i) => (
                        <div key={i} className="bg-white dark:bg-slate-900 px-5 py-4 rounded-2xl transition-colors">
                            <p className="text-xs text-slate-400 dark:text-slate-500 font-google mb-1">{s.label}</p>
                            <p className="text-base md:text-lg font-google font-semibold text-slate-900 dark:text-slate-200">{s.value}</p>
                        </div>
                    ))}
                </div>

                {/* Bots Grid */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        <AnimatePresence>
                            <motion.div
                                key={bot.id}
                                layout
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="bg-white dark:bg-slate-900 rounded-2xl flex flex-col transition-colors shadow-sm"
                            >
                                <div className="p-6 flex flex-col flex-1 gap-4">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">{bot.bot_name}</h3>
                                            <p className="text-xs text-slate-400 dark:text-slate-500 font-google mt-0.5">{bot.company_name}</p>
                                        </div>
                                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-slate-100 dark:bg-slate-800">
                                            <span className="material-symbols-outlined text-[18px] text-slate-700 dark:text-slate-300">smart_toy</span>
                                        </div>
                                    </div>

                                    <a
                                        href={bot.allowed_origin}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-google flex items-center gap-2 min-w-0"
                                    >
                                        <span className="material-symbols-outlined text-[15px] shrink-0">link</span>
                                        <span className="truncate">{bot.allowed_origin || 'No origin set'}</span>
                                    </a>

                                    {/* Training status */}
                                    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium font-google ${trained ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'}`}>
                                        <span className="material-symbols-outlined text-[15px]">{trained ? 'check_circle' : 'radio_button_unchecked'}</span>
                                        {trained ? `${wordsUsed.toLocaleString()} words trained` : 'Not trained yet'}
                                    </div>

                                    {/* Usage bar */}
                                    <div>
                                        <div className="flex justify-between text-xs text-slate-400 dark:text-slate-500 font-google mb-1.5">
                                            <span>Usage</span>
                                            <span>{bot.messages_used} / {plan.message_limit}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 w-full rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-slate-800 dark:bg-slate-300 rounded-full transition-all"
                                                style={{ width: `${Math.min((bot.messages_used / plan.message_limit) * 100, 100)}%` }}
                                            />
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex gap-2 mt-auto pt-2">
                                        <button
                                            onClick={() => router.push('/demo/train')}
                                            className="flex-1 py-2.5 text-sm font-medium font-sans rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[15px]">psychology</span> Train
                                        </button>
                                        <button
                                            onClick={() => router.push('/demo/customize')}
                                            className="flex-1 py-2.5 text-sm font-medium font-sans rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[15px]">settings</span> Settings
                                        </button>
                                        <button
                                            onClick={() => router.push('/demo/chat')}
                                            className="flex items-center justify-center p-2.5 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors cursor-pointer"
                                        >
                                            <span className="material-symbols-outlined text-[16px]">chat</span>
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        </AnimatePresence>

                        {/* Locked slot — matches the dashboard's bot-limit-reached card */}
                        <motion.div
                            layout
                            className="rounded-2xl bg-slate-50/60 dark:bg-slate-900/20 flex flex-col items-center justify-center p-8 min-h-[200px] transition-colors cursor-not-allowed"
                        >
                            <span className="material-symbols-outlined text-[22px] text-slate-300 dark:text-slate-600 mb-3">lock</span>
                            <p className="text-sm font-medium text-slate-400 dark:text-slate-600 font-sans text-center">Bot limit reached</p>
                            <Link
                                href="/sign-up"
                                onClick={e => e.stopPropagation()}
                                className="mt-3 text-sm font-medium font-sans text-slate-600 dark:text-slate-400 hover:underline"
                            >
                                Sign up for more →
                            </Link>
                        </motion.div>
                    </div>
                </div>
            </div>
        </div>
    );
}
