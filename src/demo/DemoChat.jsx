import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, Navigate } from 'react-router-dom';
import { getBotConfig, getKnowledge, isTrained, getChatMessages, saveChatMessages } from './demoStorage';
import { retrieveChunks, askGemini, DEMO_MSG_CAP } from './demoRag';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

// ── Thinking Indicator ─────────────────────────────────────────────────────────
const ThinkingDots = ({ color }) => (
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

// ── Demo Chat Page ─────────────────────────────────────────────────────────────
const DemoChat = () => {
    const botConfig = getBotConfig();
    const chunks = getKnowledge();
    const trained = isTrained();

    const THEME_COLOR = botConfig.themeColor || botConfig.primaryColor || '#5730F5';
    const BOT_NAME = botConfig.name || 'Demo Bot';
    const GREETING = botConfig.greeting || 'Hi! Ask me anything about the document you uploaded.';

    const quickQs = (Array.isArray(botConfig.quickQuestions) ? botConfig.quickQuestions : [])
        .map(q => typeof q === 'string' ? q : (q.label || '')).filter(Boolean);

    // ── State ──────────────────────────────────────────────────────────────────
    const initialMessages = () => {
        const saved = getChatMessages();
        return saved.length > 0 ? saved : [{ role: 'bot', content: GREETING }];
    };

    const [messages, setMessages] = useState(initialMessages);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const animatedIndices = useRef(new Set());

    // ── Persist messages ───────────────────────────────────────────────────────
    useEffect(() => {
        saveChatMessages(messages);
    }, [messages]);

    // ── Auto-scroll ────────────────────────────────────────────────────────────
    const scrollToBottom = useCallback(() => {
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        });
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading, scrollToBottom]);

    // ── Guard: redirect if not trained ─────────────────────────────────────────
    if (!trained) {
        return <Navigate to="/demo/train" replace />;
    }

    // ── Message count (user messages only) ─────────────────────────────────────
    const userMsgCount = messages.filter(m => m.role === 'user').length;
    const isCapReached = userMsgCount >= DEMO_MSG_CAP;

    // ── Send Message ───────────────────────────────────────────────────────────
    const sendMessage = async (text) => {
        const trimmed = (text || input).trim();
        if (!trimmed || isLoading) return;

        const userMsg = { role: 'user', content: trimmed };
        const nextMessages = [...messages, userMsg];
        setMessages(nextMessages);
        setInput('');
        setIsLoading(true);

        try {
            const relevant = retrieveChunks(chunks, trimmed);
            const answer = await askGemini(trimmed, relevant, botConfig, userMsgCount + 1);
            setMessages(prev => [...prev, { role: 'bot', content: answer }]);
        } catch (err) {
            console.error('[DemoChat] Error:', err);
            setMessages(prev => [...prev, {
                role: 'bot',
                content: "Something went wrong while generating a response. Please try again.",
            }]);
        } finally {
            setIsLoading(false);
            // Re-focus input after response
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading) sendMessage();
        }
    };

    const handleClear = () => {
        setMessages([{ role: 'bot', content: GREETING }]);
        animatedIndices.current.clear();
    };

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-[calc(100vh-5rem)] bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500">
            {/* Header */}
            <div className={`${cellCls} px-4 py-4 md:px-8 md:py-5 shrink-0 border-b border-gray-100 dark:border-slate-800`}>
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative">
                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-slate-950 animate-pulse z-10" />
                            <div
                                className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center shrink-0 shadow-sm"
                                style={{ backgroundColor: THEME_COLOR }}
                            >
                                <span className="font-bold leading-none select-none text-white text-[14px]">
                                    {BOT_NAME.charAt(0).toUpperCase()}
                                </span>
                            </div>
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-display font-bold text-slate-900 dark:text-slate-200 truncate">{BOT_NAME}</h1>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-green-500 font-sans">
                                Online — Demo Mode
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="hidden sm:flex text-[10px] uppercase tracking-widest font-bold text-slate-400 font-sans items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {userMsgCount} / {DEMO_MSG_CAP} msgs
                        </span>
                        <button
                            onClick={handleClear}
                            className="p-2 hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Clear chat"
                        >
                            <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">refresh</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 relative flex flex-col min-h-0 overflow-hidden bg-gray-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100">
                {/* Animated blue aura when loading */}
                <div className={`absolute inset-0 pointer-events-none z-20 transition-opacity duration-200 ${isLoading ? 'opacity-100' : 'opacity-0'}`}>
                    <div
                        className="absolute inset-0 animate-pulse shadow-[inset_0px_0px_25px_rgba(59,130,246,0.50)] ring-1 ring-inset ring-blue-500/10 dark:ring-blue-400/20"
                    />
                </div>

                {/* Demo Mode Watermark */}
                <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center opacity-[0.03]">
                    <span className="text-[80px] sm:text-[120px] font-display font-black uppercase tracking-widest text-slate-900 dark:text-slate-100 rotate-[-15deg] select-none">
                        DEMO
                    </span>
                </div>

                <div
                    ref={scrollContainerRef}
                    className="flex-1 p-4 overflow-y-auto min-h-0 flex flex-col gap-5 pt-6 pb-2 relative custom-scrollbar touch-pan-y"
                >
                    <div className="flex flex-col gap-5">
                        <AnimatePresence initial={false}>
                            {messages.map((msg, idx) => {
                                const isNew = !animatedIndices.current.has(idx);
                                if (isNew) animatedIndices.current.add(idx);
                                return (
                                    <motion.div
                                        key={idx}
                                        layout="position"
                                        initial={isNew ? { opacity: 0, y: 10, scale: 0.95 } : false}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                        className={`flex min-w-0 max-w-[85%] ${msg.role === 'user' ? 'self-end text-right' : 'self-start text-left'}`}
                                    >
                                        <div className={`flex flex-col max-w-full min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            {msg.role === 'bot' ? (
                                                <span className="text-md uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 ml-1 leading-none">{BOT_NAME}</span>
                                            ) : (
                                                <span className="text-md uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 mr-1 leading-none">YOU</span>
                                            )}
                                            <div
                                                className={`px-4 py-2 min-h-[38px] w-fit max-w-full ${msg.role === 'user'
                                                    ? 'text-white rounded-2xl rounded-tr-none'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200/60 dark:border-slate-700/60 rounded-2xl rounded-tl-none overflow-hidden'
                                                    }`}
                                                style={msg.role === 'user' ? { backgroundColor: THEME_COLOR, overflowWrap: 'anywhere' } : {}}
                                            >
                                                <div className="min-w-0 max-w-full whitespace-pre-wrap text-md font-google leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
                                                    {msg.content}
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* Typing indicator */}
                        {isLoading && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex min-w-0 max-w-[85%] self-start text-left"
                            >
                                <div className="flex flex-col items-start">
                                    <span className="text-md uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 ml-1 leading-none">{BOT_NAME}</span>
                                    <div className="bg-slate-100 dark:bg-slate-800 border border-gray-200/60 dark:border-slate-700/60 rounded-2xl rounded-tl-none overflow-hidden">
                                        <ThinkingDots color={THEME_COLOR} />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>

                    {/* Quick Questions — only show on initial message */}
                    {messages.length === 1 && !input.trim() && quickQs.length > 0 && (
                        <div className="flex flex-col items-end gap-2 px-3 pb-2 pt-1">
                            {quickQs.slice(0, 5).map((q, qidx) => (
                                <button
                                    key={qidx}
                                    onClick={() => sendMessage(q)}
                                    className="px-4 py-2.5 border rounded-md text-md font-regular font-google transition-colors max-w-full text-left break-words bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Cap reached banner */}
                    {isCapReached && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center gap-3 p-5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl mx-2"
                        >
                            <span className="material-symbols-outlined text-[24px] text-amber-500">timer_off</span>
                            <p className="text-sm font-google text-amber-700 dark:text-amber-300 text-center leading-relaxed">
                                You've reached the demo limit of <b>{DEMO_MSG_CAP} messages</b>. Sign up for a free account to get unlimited conversations.
                            </p>
                            <Link
                                to="/sign-up"
                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-green-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all flex items-center gap-2"
                            >
                                <span className="material-symbols-outlined text-[14px]">rocket_launch</span>
                                Create Free Account
                            </Link>
                        </motion.div>
                    )}

                    <div ref={messagesEndRef} className="h-2 shrink-0" aria-hidden="true" />
                </div>
            </div>

            {/* Branding Footer */}
            <div className="shrink-0 py-1.5 flex justify-center items-center bg-gray-50/80 dark:bg-slate-950/80 backdrop-blur-sm border-t border-gray-200/50 dark:border-slate-800/50">
                <a
                    href="https://www.sapybase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-[9px] font-sans font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors group"
                >
                    <img src="/SB_loading.svg" alt="SaPyBase" className="w-5 h-5 grayscale opacity-50 group-hover:opacity-100 transition-opacity" />
                    Powered by SaPyBase
                </a>
            </div>

            {/* Input Area */}
            <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-gray-200/50 dark:border-slate-800/50 shrink-0 z-10 flex flex-col">
                <div className="p-2 w-full shadow-xs">
                    <form
                        onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                        className="relative flex items-center gap-2 pb-1"
                    >
                        <textarea
                            ref={inputRef}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={isCapReached ? 'Demo limit reached — sign up to continue' : 'Ask anything...'}
                            className="flex-1 max-h-32 min-h-[40px] bg-transparent resize-none px-2.5 py-[9px] focus:outline-none leading-relaxed text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 disabled:opacity-50 appearance-none rounded-none text-base sm:text-xl font-medium font-sans"
                            rows={1}
                            disabled={isLoading || isCapReached}
                            aria-label="Chat input"
                        />
                        <button
                            type="submit"
                            disabled={isLoading || !input.trim() || isCapReached}
                            aria-label="Send message"
                            className="p-2 shrink-0 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
                            style={{ color: THEME_COLOR }}
                        >
                            <span className="material-symbols-outlined text-[20px]">send</span>
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default DemoChat;
