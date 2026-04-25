'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBotConfig, getKnowledge, isTrained, getChatMessages, saveChatMessages } from '@/src/lib/demo/demoStorage';
import { retrieveChunks, askGemini, DEMO_MSG_CAP } from '@/src/lib/demo/demoRag';

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
    const botConfig = getBotConfig();
    const chunks = getKnowledge();
    const trained = isTrained();

    const THEME_COLOR = botConfig.themeColor || botConfig.primaryColor || '#5730F5';
    const BOT_NAME = botConfig.name || 'Demo Bot';
    const GREETING = botConfig.greeting || 'Hi! Ask me anything about the document you uploaded.';

    const quickQs = (Array.isArray(botConfig.quickQuestions) ? botConfig.quickQuestions : [])
        .map((q: any) => typeof q === 'string' ? q : (q.label || '')).filter(Boolean);

    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [mounted, setMounted] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        setMounted(true);
        if (!trained) {
            router.replace('/demo/train');
            return;
        }
        const saved = getChatMessages();
        setMessages(saved.length > 0 ? saved : [{ role: 'bot', content: GREETING }]);
    }, [trained, GREETING, router]);

    useEffect(() => {
        if (mounted) saveChatMessages(messages);
    }, [messages, mounted]);

    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
    }, []);

    useEffect(() => {
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
        <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500">
            <div className={`${cellCls} px-8 py-5 border-b border-gray-100 dark:border-slate-800`}>
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: THEME_COLOR }}>
                            {BOT_NAME.charAt(0)}
                        </div>
                        <div>
                            <h1 className="font-bold">{BOT_NAME}</h1>
                            <p className="text-[10px] uppercase font-bold text-green-500">Online — Demo</p>
                        </div>
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {userMsgCount} / {DEMO_MSG_CAP} MSGS
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-6 relative">
                 <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
                     <span className="text-9xl font-black rotate-[-15deg]">DEMO</span>
                 </div>
                 {messages.map((msg, i) => (
                     <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                         <div className={`max-w-[80%] p-4 rounded-2xl ${msg.role === 'user' ? 'text-white rounded-tr-none' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none'}`} style={msg.role === 'user' ? { backgroundColor: THEME_COLOR } : {}}>
                            <p className="text-sm">{msg.content}</p>
                         </div>
                     </motion.div>
                 ))}
                 {isLoading && (
                     <div className="flex justify-start">
                         <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 p-2 rounded-2xl rounded-tl-none">
                             <ThinkingDots color={THEME_COLOR} />
                         </div>
                     </div>
                 )}
                 <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 transition-colors">
                <form onSubmit={e => { e.preventDefault(); sendMessage(); }} className="flex gap-4">
                    <input value={input} onChange={e => setInput(e.target.value)} disabled={isLoading || isCapReached} placeholder={isCapReached ? "Limit reached" : "Type message..."} className="flex-1 bg-transparent border-none outline-none text-sm text-slate-900 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500" />
                    <button type="submit" disabled={isLoading || !input.trim() || isCapReached} className="text-blue-600 dark:text-blue-400 font-bold uppercase text-xs disabled:opacity-40 transition-opacity">Send</button>
                </form>
            </div>
        </div>
    );
}
