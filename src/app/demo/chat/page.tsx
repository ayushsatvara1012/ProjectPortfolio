'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
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
        <div className="overflow-x-auto rounded-lg my-2 scrollbar-thin bg-slate-50 dark:bg-slate-900 p-3 border border-gray-100 dark:border-slate-800">
            <pre {...props} className="text-xs font-mono">{children}</pre>
        </div>
    ),
};

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

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
    const inputRef = React.useRef<HTMLTextAreaElement>(null);

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
        } catch (err) {
            setMessages(prev => [...prev, { role: 'bot', content: "Error occurred." }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500 font-google" style={{ height: 'calc(100vh - 5rem)' }}>
            {/* Header */}
            <div className={`${cellCls} px-6 py-4 border-b border-gray-100 dark:border-slate-800 shadow-sm relative z-10`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-950 animate-pulse z-10" />
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-display font-bold shadow-sm" style={{ backgroundColor: THEME_COLOR }}>
                                {BOT_NAME.charAt(0).toUpperCase()}
                            </div>
                        </div>
                        <div>
                            <h1 className="text-lg font-display font-bold leading-tight" style={{ color: THEME_COLOR }}>{BOT_NAME}</h1>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Online — Demo</p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                            {userMsgCount} / {DEMO_MSG_CAP} MSGS
                        </div>
                        <div className="w-24 h-1 bg-gray-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div
                                className="h-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${(userMsgCount / DEMO_MSG_CAP) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 relative custom-scrollbar">
                <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                    <span className="text-9xl font-black rotate-[-15deg] font-display">DEMO</span>
                </div>

                {messages.map((msg, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5 px-1">
                                {msg.role === 'user' ? 'YOU' : BOT_NAME}
                            </span>
                            <div
                                className={`px-4 py-2.5 rounded-2xl shadow-sm ${msg.role === 'user'
                                        ? 'text-white rounded-tr-none'
                                        : 'bg-white dark:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 rounded-tl-none'
                                    }`}
                                style={msg.role === 'user' ? { backgroundColor: THEME_COLOR } : {}}
                            >
                                <div className={`text-md leading-relaxed prose prose-sm max-w-none ${msg.role === 'user' ? 'prose-invert [&_*]:!text-white' : 'dark:prose-invert text-slate-800 dark:text-slate-200'}`}>
                                    <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={MD_COMPONENTS}>
                                        {msg.content}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ))}
                {isLoading && (
                    <div className="flex justify-start">
                        <div className="flex flex-col items-start max-w-[85%]">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5 px-1">{BOT_NAME}</span>
                            <div className="bg-white dark:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60 p-2 rounded-2xl rounded-tl-none shadow-sm">
                                <ThinkingDots color={THEME_COLOR} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input area */}
            <div className="p-4 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 transition-colors shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.01)]">
                <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex items-center gap-2 max-w-4xl mx-auto">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        disabled={isLoading || isCapReached}
                        placeholder={isCapReached ? "Demo message limit reached" : "Type your message..."}
                        className="flex-1 bg-slate-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-medium"
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim() || isCapReached}
                        className="p-2 text-slate-400 hover:scale-110 active:scale-95 transition-all flex items-center justify-center"
                        style={!isCapReached && input.trim() ? { color: THEME_COLOR } : {}}
                    >
                        <span className="material-symbols-outlined text-[28px]">send</span>
                    </button>
                </form>
                <p className="text-[9px] text-center text-slate-400 mt-2 uppercase tracking-[0.2em] font-bold">Powered by Sapybase AI</p>
            </div>
        </div>
    );
}
