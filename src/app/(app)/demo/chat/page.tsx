'use client';

import React, { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { getBotConfig, getKnowledge, isTrained, getChatMessages, saveChatMessages } from '@/src/lib/demo/demoStorage';
import { retrieveChunks, askGemini, DEMO_MSG_CAP } from '@/src/lib/demo/demoRag';

const MD_COMPONENTS = {
    p: ({ children, ...props }: React.ComponentPropsWithoutRef<'p'>) => (
        <p {...props} className="first:mt-0 last:mb-0 mb-2">{children}</p>
    ),
    pre: ({ children, ...props }: React.ComponentPropsWithoutRef<'pre'>) => (
        <div className="overflow-x-auto rounded-xl my-2 scrollbar-thin bg-slate-50 dark:bg-slate-950 p-4 border border-slate-100 dark:border-slate-800">
            <pre {...props} className="text-xs font-mono">{children}</pre>
        </div>
    ),
};

const ThinkingDots = ({ color }: { color: string }) => (
    <div className="flex items-center gap-1 px-4 py-2">
        {[0, 1, 2].map(i => (
            <motion.div
                key={i}
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
                animate={{ opacity: [0.3, 1, 0.3], scale: [0.85, 1.15, 0.85] }}
                transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            />
        ))}
    </div>
);

export default function DemoChatPage() {
    const router = useRouter();
    const [botConfig, setBotConfig] = React.useState<any>(getBotConfig());
    const [chunks, setChunks] = React.useState<any[]>([]);
    const [trained, setTrained] = React.useState<boolean>(false);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        const conf = getBotConfig();
        const kn = getKnowledge();
        const tr = isTrained();

        setBotConfig(conf);
        setChunks(kn);
        setTrained(tr);
        setMounted(true);

        if (!tr) {
            router.replace('/demo/train');
        }
    }, [router]);

    const THEME_COLOR = botConfig.themeColor || botConfig.primaryColor || '#5730F5';
    const BOT_NAME = botConfig.name || 'Demo Bot';
    const GREETING = botConfig.greeting || 'Hi! Ask me anything about the document you uploaded.';

    const quickQs = (Array.isArray(botConfig.quickQuestions) ? botConfig.quickQuestions : [])
        .map((q: any) => typeof q === 'string' ? q : (q.label || '')).filter(Boolean);

    const [messages, setMessages] = React.useState<any[]>([]);
    const [input, setInput] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);

    const messagesEndRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (mounted && trained) {
            const saved = getChatMessages();
            setMessages(saved.length > 0 ? saved : [{ role: 'bot', content: GREETING }]);
        }
    }, [mounted, trained, GREETING]);

    React.useEffect(() => {
        if (mounted) saveChatMessages(messages);
    }, [messages, mounted]);

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
    }, []);

    React.useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, scrollToBottom]);

    if (!mounted || !trained) return null;

    const userMsgCount = messages.filter(m => m.role === 'user').length;
    const isCapReached = userMsgCount >= DEMO_MSG_CAP;

    const sendMessage = async (text?: string) => {
        const trimmed = (text || input).trim();
        if (!trimmed || isLoading || isCapReached) return;

        const userMsg = { role: 'user', content: trimmed };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            const relevant = retrieveChunks(chunks, trimmed);
            const answer = await askGemini(trimmed, relevant, botConfig, userMsgCount + 1);
            setMessages(prev => [...prev, { role: 'bot', content: answer }]);
        } catch {
            setMessages(prev => [...prev, { role: 'bot', content: "Error occurred." }]);
        } finally {
            setIsLoading(false);
        }
    };

    const showHero = messages.length <= 1;

    return (
        <div className="flex flex-col bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-500 font-google" style={{ height: 'calc(100vh - 5rem)' }}>
            {/* Header */}
            <div className="bg-[#f8f9fa] dark:bg-slate-950 px-6 py-4 border-b border-slate-100 dark:border-slate-800/60 relative z-10">
                <div className="flex justify-between items-center max-w-3xl mx-auto">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#f8f9fa] dark:border-[#05070a] animate-pulse z-10" />
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-google font-bold shadow-sm" style={{ backgroundColor: THEME_COLOR }}>
                                {BOT_NAME.charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div>
                            <h1 className="text-base font-semibold font-google leading-tight text-slate-800 dark:text-slate-200">{BOT_NAME}</h1>
                            <p className="text-xs text-slate-400 font-google">Demo bot</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="text-xs font-semibold text-slate-400 font-google">
                            {userMsgCount} / {DEMO_MSG_CAP} messages
                        </div>
                        <div className="w-24 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full mt-1.5 overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-500 rounded-full"
                                style={{ width: `${(userMsgCount / DEMO_MSG_CAP) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto relative custom-scrollbar flex flex-col">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.015] pointer-events-none select-none">
                    <span className="text-9xl font-black rotate-[-15deg] font-display">DEMO</span>
                </div>

                <div className="relative max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8 w-full flex-1 flex flex-col">
                    {showHero ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-12 md:py-20 max-w-2xl mx-auto px-4 w-full">
                            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-3xl font-display font-bold shadow-md mb-6" style={{ backgroundColor: THEME_COLOR }}>
                                {BOT_NAME.charAt(0).toUpperCase()}
                            </div>
                            <h2 className="text-3xl md:text-4xl font-google font-medium text-slate-800 dark:text-slate-200 mb-2">
                                Hello! I'm {BOT_NAME}.
                            </h2>
                            <p className="text-base text-slate-500 dark:text-slate-400 mb-8 max-w-md leading-relaxed">
                                {GREETING}
                            </p>

                            {quickQs.length > 0 && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full text-left">
                                    {quickQs.slice(0, 4).map((q: string, i: number) => (
                                        <button
                                            key={i}
                                            onClick={() => sendMessage(q)}
                                            disabled={isLoading}
                                            className="p-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm text-slate-700 dark:text-slate-300 transition-all font-google cursor-pointer leading-relaxed hover:border-slate-300 dark:hover:border-slate-700 shadow-sm"
                                        >
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-6 w-full">
                            {messages.map((msg, i) => (
                                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.role === 'bot' && (
                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-sm" style={{ backgroundColor: THEME_COLOR }}>
                                            {BOT_NAME.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div className={`flex flex-col max-w-[80%] sm:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                        {msg.role === 'user' ? (
                                            <div className="px-5 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200">
                                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words [word-break:break-word]">{msg.content}</p>
                                            </div>
                                        ) : (
                                            <div className="px-1 py-1 text-sm leading-relaxed prose prose-sm max-w-none dark:prose-invert text-slate-800 dark:text-slate-200 prose-p:break-words prose-pre:overflow-x-auto prose-pre:whitespace-pre">
                                                <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                            {isLoading && (
                                <div className="flex gap-4 justify-start">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-sm" style={{ backgroundColor: THEME_COLOR }}>
                                        {BOT_NAME.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex flex-col items-start pt-2">
                                        <ThinkingDots color={THEME_COLOR} />
                                    </div>
                                </div>
                            )}
                            <div ref={messagesEndRef} />
                        </div>
                    )}
                </div>
            </div>

            {/* Input area */}
            <div className="pb-6 pt-3 px-4 bg-[#f8f9fa] dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800/40 transition-colors">
                <div className="max-w-3xl mx-auto">
                    {/* Quick questions (only shown when active chat is running and cap not reached) */}
                    {quickQs.length > 0 && !showHero && !isCapReached && (
                        <div className="flex flex-wrap gap-2 mb-3">
                            {quickQs.slice(0, 3).map((q: string, i: number) => (
                                <button
                                    key={i}
                                    onClick={() => sendMessage(q)}
                                    disabled={isLoading}
                                    className="text-xs px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-all bg-white dark:bg-slate-900 truncate max-w-[200px]"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}
                    <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-full pl-5 pr-2 py-1 shadow-sm focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500/30 transition-all">
                        <input
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            disabled={isLoading || isCapReached}
                            placeholder={isCapReached ? "Demo message limit reached" : "Ask anything..."}
                            className="flex-1 bg-transparent py-3 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none font-medium"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim() || isCapReached}
                            className="p-2 rounded-full disabled:opacity-30 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center shrink-0"
                            style={!isCapReached && input.trim() ? { color: THEME_COLOR } : { color: '#94a3b8' }}
                        >
                            <span className="material-symbols-outlined text-[20px]">send</span>
                        </button>
                    </form>
                    <p className="text-[10px] text-center text-slate-400 mt-3 font-semibold uppercase tracking-[0.25em]">Vaayu Intelligence</p>
                </div>
            </div>
        </div>
    );
}
