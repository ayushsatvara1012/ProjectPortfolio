/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, X, MoreHorizontal } from 'lucide-react';
import ThinkingLogo from './thinkLogo';
import BrandLogo from './brandLogo';

const ChatWidget = ({ apiKey }) => {
    // 1. Resolve API Key & Base URL
    const activeApiKey = apiKey || window.SaPyBaseConfig?.apiKey;
    const activeApiUrl = window.SaPyBaseConfig?.apiUrl || (import.meta.env.DEV ? 'http://localhost:8000' : 'https://sapyai.onrender.com');

    const ASSET_BASE_URL = import.meta.env.DEV ? '' : 'https://www.sapybase.com';

    // 2. Initialize with defaults, merging in window.SaPyBaseConfig for high-fidelity fallback
    const DEFAULT_CONFIG = {
        theme_color: window.SaPyBaseConfig?.themeColor || '#5730F5',
        bot_name: window.SaPyBaseConfig?.botName || 'Sapy AI',
        logo_url: window.SaPyBaseConfig?.logoUrl || `${ASSET_BASE_URL}/SB_loading_clean.svg`,
        initial_message: window.SaPyBaseConfig?.welcomeMessage || "Hi! I'm your AI assistant. How can I help you today?",
        quick_questions: window.SaPyBaseConfig?.quickQuestions || [],
    };

    // ── CONFIG STATE: starts with defaults, then gets overwritten by /api/config ──
    const [configData, setConfigData] = useState(DEFAULT_CONFIG);
    const [configLoaded, setConfigLoaded] = useState(false);

    // ── FETCH BOT-SPECIFIC CONFIG FROM BACKEND ────────────────────────────────
    useEffect(() => {
        if (!activeApiKey) return;
        const fetchConfig = async () => {
            try {
                const res = await fetch(`${activeApiUrl}/api/config`, {
                    headers: { 'x-api-key': activeApiKey },
                });
                if (res.ok) {
                    const data = await res.json();
                    setConfigData({
                        theme_color: data.theme_color || DEFAULT_CONFIG.theme_color,
                        bot_name: data.bot_name || DEFAULT_CONFIG.bot_name,
                        logo_url: data.logo_url || DEFAULT_CONFIG.logo_url,
                        initial_message: data.initial_message || DEFAULT_CONFIG.initial_message,
                        quick_questions: data.quick_questions || [],
                    });
                    // Update the welcome message now that we have the real one
                    setMessages([{ role: 'bot', content: data.initial_message || DEFAULT_CONFIG.initial_message }]);
                }
            } catch (err) {
                console.warn('[SaPyBase] Could not load bot config:', err);
            } finally {
                setConfigLoaded(true);
            }
        };
        fetchConfig();
    }, [activeApiKey]);

    const THEME_COLOR = configData.theme_color;
    const BOT_NAME = configData.bot_name;
    const LOGO_URL = configData.logo_url;

    const [isOpen, setIsOpen] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'bot', content: DEFAULT_CONFIG.initial_message }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 640);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Typing effect for the "Chat with me" label
    const [currentPhrase, setCurrentPhrase] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [loopNum, setLoopNum] = useState(0);
    const [typingSpeed, setTypingSpeed] = useState(100);
    const phrases = ["Chat with me !", "Have questions ?", "I'm here to help!", "Powered by Sapybase !"];

    useEffect(() => {
        let timer;
        const handleTyping = () => {
            const i = loopNum % phrases.length;
            const fullText = phrases[i];
            setCurrentPhrase(isDeleting
                ? fullText.substring(0, currentPhrase.length - 1)
                : fullText.substring(0, currentPhrase.length + 1)
            );
            setTypingSpeed(isDeleting ? 40 : 100);
            if (!isDeleting && currentPhrase === fullText) {
                timer = setTimeout(() => setIsDeleting(true), 2500);
            } else if (isDeleting && currentPhrase === '') {
                setIsDeleting(false);
                setLoopNum(loopNum + 1);
            } else {
                timer = setTimeout(handleTyping, typingSpeed);
            }
        };
        timer = setTimeout(handleTyping, typingSpeed);
        return () => clearTimeout(timer);
    }, [currentPhrase, isDeleting, loopNum, typingSpeed]);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const menuRef = useRef(null);
    const abortControllerRef = useRef(null);

    useEffect(() => {

        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                setShowMenu(false);
            }
        };

        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showMenu]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };
    useEffect(() => {
        scrollToBottom();
    }, [messages, isLoading]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input.trim();
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setInput('');
        setIsLoading(true);

        // ── MEMORY LEAK PREVENTION: Abort any in-flight SSE stream ──
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        const ctrl = new AbortController();
        abortControllerRef.current = ctrl;

        // Resolve API Key
        const resolvedApiKey = apiKey || window.SaPyBaseConfig?.apiKey;
        if (!resolvedApiKey) {
            console.warn("SaPyBase Widget: Missing API Key. Processing aborted.");
            setMessages(prev => [...prev, { role: 'bot', content: "Configure your API Key locally to start chatting with Sapy AI!" }]);
            setIsLoading(false);
            return;
        }

        // Build context history: last 4 messages BEFORE this new user message
        const recentHistory = messages.slice(-4).map(m => ({ role: m.role, content: m.content }));

        // Track whether we've received the first chunk (to fade out the loading aura)
        let firstChunkReceived = false;

        try {
            await fetchEventSource(`${activeApiUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': resolvedApiKey,
                },
                body: JSON.stringify({ message: userMessage, history: recentHistory }),
                signal: ctrl.signal,
                openWhenHidden: true, // Keep streaming even if the tab loses focus

                // ── HYBRID CACHE INTERCEPTION ────────────────────────────────
                async onopen(response) {
                    if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
                        // CACHE HIT: Backend returned a full JSON response instead of a stream.
                        // Read the body, update state with the complete reply, and throw
                        // a sentinel error to cleanly exit the SSE listener.
                        const data = await response.json();
                        setMessages(prev => [...prev, { role: 'bot', content: data.reply }]);
                        setIsLoading(false);
                        throw new Error('CACHE_HIT');
                    }
                    if (!response.ok) {
                        // Handle specific HTTP errors before the stream begins
                        if (response.status === 402) {
                            let detail = null;
                            try { detail = await response.json(); } catch { /* noop */ }
                            const isMessageLimit = detail?.detail?.code === 'MESSAGE_LIMIT_EXCEEDED';
                            setMessages(prev => [...prev, {
                                role: 'bot',
                                content: isMessageLimit
                                    ? `I've reached my monthly message limit. Please contact the site owner to upgrade their plan at [sapybase.com](https://www.sapybase.com). I'll be back next billing cycle! 🚀`
                                    : "I'm temporarily unavailable. Please try again later.",
                            }]);
                            setIsLoading(false);
                            throw new Error('HANDLED_ERROR');
                        }
                        throw new Error(`Server error: ${response.status}`);
                    }
                    // response.ok && text/event-stream → SSE stream begins normally
                },

                // ── STREAMING TOKEN HANDLER ──────────────────────────────────
                onmessage(msg) {
                    // Sentinel: backend signals end-of-stream
                    if (msg.data === '[DONE]') {
                        setIsLoading(false);
                        return;
                    }

                    let chunk = '';
                    try {
                        const parsed = JSON.parse(msg.data);
                        chunk = parsed.token || parsed.content || parsed.text || '';
                    } catch {
                        // If the data isn't JSON, use the raw string directly
                        chunk = msg.data;
                    }

                    if (!chunk) return;

                    // Fade out the Apple Intelligence loading aura on first token
                    if (!firstChunkReceived) {
                        firstChunkReceived = true;
                        setIsLoading(false);
                        // Seed the bot message placeholder
                        setMessages(prev => [...prev, { role: 'bot', content: chunk }]);
                    } else {
                        // Append subsequent tokens to the last (bot) message
                        setMessages(prev => {
                            const updated = [...prev];
                            const lastMsg = updated[updated.length - 1];
                            if (lastMsg && lastMsg.role === 'bot') {
                                updated[updated.length - 1] = {
                                    ...lastMsg,
                                    content: lastMsg.content + chunk,
                                    isStreaming: true // Mark as actively streaming
                                };
                            }
                            return updated;
                        });
                    }

                    // Auto-scroll to track the streaming text
                    scrollToBottom();
                },

                // ── ERROR HANDLER (Infinite Retry Prevention) ────────────────
                onerror(err) {
                    // CRITICAL: In @microsoft/fetch-event-source, `return` = RETRY.
                    // You MUST `throw` to STOP. Every path here must throw.

                    if (err.message === 'CACHE_HIT' || err.message === 'HANDLED_ERROR') {
                        // These are controlled exits — already handled in onopen.
                        // Throw to stop the library from retrying.
                        throw err;
                    }

                    console.error('SSE Chat Error:', err);
                    setMessages(prev => [...prev, {
                        role: 'bot',
                        content: "I'm having trouble connecting to the SaPyBase servers right now. Please try again later or use the contact form.",
                    }]);
                    setIsLoading(false);

                    // Stop the library from retrying on real errors too.
                    throw err;
                },

                onclose() {
                    // Stream closed normally by the server
                    setIsLoading(false);
                },
            });
        } catch (err) {
            // Catch AbortError (user sent a new message mid-stream) and sentinel errors silently
            if (err.name === 'AbortError' || err.message === 'CACHE_HIT' || err.message === 'HANDLED_ERROR') {
                return;
            }
            // Any other unexpected error
            console.error('Chat Error (outer):', err);
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    // Animation variants
    const windowVariants = {
        hidden: { opacity: 0, scale: 0.8, y: 20, transformOrigin: "bottom right" },
        visible: {
            opacity: 1,
            scale: 1,
            y: 0,
            transition: { type: "spring", stiffness: 350, damping: 25 }
        },
        exit: {
            opacity: 0,
            scale: 0.8,
            y: 20,
            transition: { duration: 0.2 }
        }
    };

    const messageVariants = {
        hidden: { opacity: 0, y: 10, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 300, damping: 25 } }
    };

    // Completely disable rendering if no API key is found (works in both dev and production IIFE)
    if (!activeApiKey) {
        return null;
    }

    const BUBBLE_PATH = `
  M 22 4
  H 78
  Q 96 4 96 22
  V 62
  Q 96 80 78 80
  H 36
  L 18 96
  L 22 80
  H 22
  Q 4 80 4 62
  V 22
  Q 4 4 22 4
  Z
`;

    return (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-2147483647 font-sans pointer-events-none" style={{ isolation: 'isolate', width: isOpen ? '100%' : 'auto', height: isOpen ? '100%' : 'auto' }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={windowVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="fixed inset-0 sm:inset-auto sm:bottom-26 sm:right-6 w-full h-dvh sm:w-[480px] sm:h-[600px] bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl sm:rounded-2xl shadow-lg shadow-blue-900/20 dark:shadow-black/40 flex flex-col sm:overflow-hidden border-t sm:border border-gray-200/50 dark:border-slate-800/50 z-2147483647 pointer-events-auto origin-bottom-right"
                        style={isMobile ? { height: '100dvh', minHeight: '-webkit-fill-available' } : {}}
                    >
                        {/* Header with Animated Gradient Glow - Removed overflow-hidden to allow menu visibility */}
                        <div className="relative shrink-0">
                            {/* Animated Background */}
                            <div
                                className="absolute inset-0 animate-gradient-x opacity-20"
                                style={{
                                    background: `linear-gradient(90deg, ${THEME_COLOR}, #f97316, ${THEME_COLOR})`,
                                    backgroundSize: '200% 200%'
                                }}
                            />

                            <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-md text-slate-900 dark:text-slate-100 p-2 pt-[max(env(safe-area-inset-top),0.75rem)] sm:pt-2 flex justify-end items-center relative z-10 border-b border-gray-200/50 dark:border-slate-800/50">
                                <div className="relative flex flex-row justify-between items-center w-full" ref={menuRef}>
                                    <div className="relative flex items-center gap-3 pl-4">
                                        <div className="relative">
                                            <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 shadow-sm border border-gray-100 dark:border-slate-700 flex items-center justify-center p-1.5 transition-transform hover:scale-105">
                                                <BrandLogo themeColor={THEME_COLOR} className="w-full h-full" />
                                            </div>
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white animate-pulse" />
                                        </div>
                                        <div className="flex flex-row items-center justify-center">
                                            <p className="text-lg font-display font-bold" style={{ color: THEME_COLOR }}>{BOT_NAME}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setShowMenu(!showMenu)}
                                            className="p-2.5 sm:p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors group focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                                            style={{ touchAction: 'manipulation' }}
                                            aria-label="Chat menu"
                                        >
                                            <MoreHorizontal size={22} className="text-slate-500 dark:text-slate-400" />
                                        </button>

                                        <button
                                            onClick={() => setIsOpen(false)}
                                            className="p-2.5 sm:p-2 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full transition-colors group focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                                            style={{ touchAction: 'manipulation' }}
                                            aria-label="Close chat"
                                        >
                                            <X size={22} className="text-red-500 dark:text-red-400 transition-transform group-hover:rotate-90" />
                                        </button>
                                    </div>

                                    <AnimatePresence>
                                        {showMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 backdrop-blur-md rounded-xl shadow-2xl border border-gray-100 dark:border-slate-700 py-1 z-2147483647 overflow-hidden"
                                            >
                                                <button
                                                    onClick={() => {
                                                        setMessages([{ role: 'bot', content: configData.initial_message }]);
                                                        setShowMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-md font-bold font-sans text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-gray-100 dark:border-slate-700"
                                                >
                                                    Clear chat
                                                </button>

                                                <a
                                                    href="https://www.sapybase.com"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full text-left px-4 py-2 text-md font-bold font-sans hover:bg-slate-50 dark:hover:bg-white/5 transition-colors flex items-center justify-between group"
                                                    onClick={() => setShowMenu(false)}
                                                    style={{ color: THEME_COLOR }}
                                                >
                                                    Add to your site
                                                    <span className="text-sm font-bold font-sans opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                                                </a>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        {/* Messages Area Wrapper */}
                        <div className="flex-1 relative flex flex-col min-h-0 bg-gray-50/50 dark:bg-slate-950/50 text-slate-900 dark:text-slate-100">
                            
                            {/* The Animated Blue Aura (All borders) */}
                            <div className={`absolute inset-0 pointer-events-none z-20 transition-opacity duration-200 ${isLoading ? 'opacity-100' : 'opacity-0'}`}>
                                <div 
                                    className="absolute inset-0 animate-pulse shadow-[inset_0px_0px_25px_rgba(59,130,246,0.50)] ring-1 ring-inset ring-blue-500/10 dark:ring-blue-400/20"
                                />
                            </div>

                            {/* Scrollable Messages Container */}
                            <div className="flex-1 p-4 overflow-y-auto overscroll-none touch-pan-y flex flex-col gap-5 pt-6 pb-2 relative scroll-smooth">
                                <AnimatePresence initial={false}>
                                    {messages.map((msg, idx) => (
                                        <motion.div
                                            key={idx}
                                            variants={messageVariants}
                                            initial="hidden"
                                            animate="visible"
                                            layout="position"
                                            className={`flex gap-2 min-w-0 max-w-full sm:max-w-[95%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
                                        >
                                            <div className="shrink-0 mt-auto mb-1">
                                                {msg.role === 'user' ? (
                                                    <div className="w-6 h-6 rounded-full text-white flex items-center justify-center shadow-md dark:shadow-blue-900/40" style={{ backgroundColor: THEME_COLOR }}>
                                                        <User size={14} />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 flex items-center justify-center pointer-events-none">
                                                        <BrandLogo themeColor={THEME_COLOR} className="w-full h-full" />
                                                    </div>
                                                )}
                                            </div>

                                            <div className={`flex flex-col max-w-full min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                {msg.role === 'bot' && (
                                                    <span className="text-md uppercase tracking-widest font-bold text-slate-400 font-sans mb-1 ml-1 leading-none">{BOT_NAME}</span>
                                                )}
                                                <div
                                                    className={`px-4 py-2 shadow-sm min-h-[38px] flex items-center max-w-full wrap-break-word ${msg.role === 'user'
                                                        ? 'text-white rounded-2xl rounded-br-none'
                                                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200/60 dark:border-slate-700/60 rounded-2xl rounded-bl-none overflow-hidden prose prose-compact dark:prose-invert max-w-none prose-p:leading-normal prose-pre:bg-gray-50 dark:prose-pre:bg-slate-900 prose-pre:text-gray-800 dark:prose-pre:text-slate-200 prose-pre:text-sm prose-code:text-sm prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:wrap-break-word prose-table:block prose-table:overflow-x-auto prose-headings:text-gray-900 dark:prose-headings:text-slate-100 prose-strong:text-gray-900 dark:prose-strong:text-slate-100 prose-ul:my-1 prose-li:my-0 prose-p:font-semibold prose-img:max-w-full prose-img:rounded-lg'
                                                        }`}
                                                    style={msg.role === 'user' ? { backgroundColor: THEME_COLOR } : {}}
                                                >
                                                    {msg.role === 'user' ? (
                                                        <div className="w-full min-w-0 max-w-full whitespace-pre-wrap text-lg font-semibold font-sans leading-relaxed">{msg.content}</div>
                                                    ) : (
                                                        <div className="w-full min-w-0 max-w-full text-lg font-semibold font-sans leading-relaxed">
                                                            <TypewriterContent 
                                                                key={`${idx}-${msg.content.length}`} // Unique key to force reset on content change
                                                                content={msg.content} 
                                                                isStreaming={msg.isStreaming} 
                                                                onComplete={scrollToBottom}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}

                                    {isLoading && (
                                        <motion.div
                                            variants={messageVariants}
                                            initial="hidden"
                                            animate="visible"
                                            layout="position"
                                            className="flex flex-col items-start gap-1"
                                        >
                                            <ThinkingLogo size={45} className="origin-left" themeColor={THEME_COLOR} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                                <div ref={messagesEndRef} className="h-2 shrink-0" aria-hidden="true" />
                            </div>
                        </div>

                        {/* Fixed Branding Footer */}
                        <div className="shrink-0 py-1.5 flex justify-center items-center bg-gray-50/80 dark:bg-slate-950/80 backdrop-blur-sm">
                            <a
                                href="https://www.sapybase.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[9px] font-sans font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors group"
                            >
                                <BrandLogo themeColor="currentColor" className="w-2.5 h-2.5 grayscale opacity-50 group-hover:opacity-100 transition-opacity" />
                                Powered by SaPyBase
                            </a>
                        </div>

                        {/* Quick Questions & Input Area */}
                        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-t border-gray-200/50 dark:border-slate-800/50 shrink-0 z-10 flex flex-col">
                            {/* Quick Questions Area */}
                            {messages.length === 1 && configData.quick_questions?.length > 0 && (
                                <div className="px-3 pt-3 pb-1 flex gap-2 overflow-x-auto scrollbar-hide snap-x">
                                    {configData.quick_questions.map((q, qidx) => (
                                        <button
                                            key={qidx}
                                            onClick={() => { setInput(q.prompt); inputRef.current?.focus(); }}
                                            className="shrink-0 snap-start px-3 py-1.5 border text-[10px] uppercase tracking-widest font-bold font-sans rounded-full transition-colors whitespace-nowrap"
                                            style={{
                                                touchAction: 'manipulation',
                                                color: THEME_COLOR,
                                                borderColor: THEME_COLOR.startsWith('#') ? `${THEME_COLOR}33` : THEME_COLOR,
                                                backgroundColor: THEME_COLOR.startsWith('#') ? `${THEME_COLOR}15` : 'transparent'
                                            }}
                                        >
                                            {q.label}
                                        </button>
                                    ))}
                                </div>
                            )}

                            {/* Actual Input Box with Safe Area Support */}
                            <div className="p-2 sm:p-2 w-full pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-xs" style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}>
                                <form onSubmit={handleSend} className="relative flex items-center gap-2 pb-1">
                                    <textarea
                                        ref={inputRef}
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Ask anything..."
                                        className="flex-1 max-h-32 min-h-[40px] bg-transparent resize-none px-2.5 py-[9px] focus:outline-none leading-relaxed text-slate-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 disabled:opacity-50 appearance-none rounded-none text-xl font-medium font-sans"
                                        rows={1}
                                        disabled={isLoading}
                                        aria-label="Chat input"
                                    />
                                    <button
                                        type="submit"
                                        disabled={isLoading || !input.trim()}
                                        aria-label="Send message"
                                        className="p-2 shrink-0 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center translate-y-px"
                                        style={{ color: THEME_COLOR, touchAction: 'manipulation' }}
                                    >
                                        <Send size={15} />
                                    </button>
                                </form>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className={`fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-2147483646 pointer-events-auto ${isOpen ? 'hidden sm:block' : 'block'}`}>
                {/* ── Flex Wrapper for Vertical Centering ── */}
                <div className="relative flex items-center justify-end">

                    {/* Typewriter Promo Label */}
                    <AnimatePresence>
                        {!isOpen && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, x: 10 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.9, x: 10 }}
                                // Removed absolute top-1/2. Flexbox handles centering.
                                className="absolute right-[calc(100%+12px)] hidden sm:flex items-center pointer-events-none"
                            >
                                <div className="bg-white dark:bg-slate-900 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-indigo-100/50 dark:border-slate-800 flex items-center gap-1.5 min-w-[150px] justify-center relative">
                                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-200 font-sans whitespace-nowrap">
                                        {currentPhrase}
                                    </span>
                                    <motion.span
                                        animate={{ opacity: [1, 0, 1] }}
                                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                        className="w-0.5 h-4 rounded-full"
                                        style={{ backgroundColor: THEME_COLOR }}
                                    />
                                    {/* Speech Bubble Tail */}
                                    <div className="absolute -right-[6px] top-[calc(50%-6px)] w-3 h-3 bg-white dark:bg-slate-900 border-r border-t border-indigo-100/50 dark:border-slate-800 rotate-45 rounded-sm" />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: "spring", stiffness: 400, damping: 17 }}
                        onClick={() => setIsOpen((prev) => !prev)}
                        aria-label={isOpen ? "Collapse chat" : "Open AI chat assistant"}
                        aria-expanded={isOpen}
                        style={{ touchAction: "manipulation", background: "transparent" }}
                        className="relative flex flex-col items-center justify-center focus:outline-none sm:w-20 sm:h-20 w-15 h-15 shadow-none transition-all p-1"
                    >

                        {/* ── Single SVG layer: clip-path fill + aura + marching dashes ── */}
                        <svg
                            viewBox="0 0 100 100"
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute inset-0 w-full h-full z-0"
                            overflow="visible"
                        >
                            <defs>
                                {/* Clip mask so white fill is exactly bubble-shaped */}
                                <clipPath id="bubble-clip">
                                    <path d={BUBBLE_PATH} />
                                </clipPath>


                            </defs>

                            {/* White fill clipped to bubble shape — replaces bg-white on the button */}
                            <rect
                                x="0" y="0" width="100" height="100"
                                fill="white"
                                clipPath="url(#bubble-clip)"
                                className='dark:fill-slate-900'
                            />

                            {/* Pulsing aura — also bubble-shaped */}
                            <path
                                d={BUBBLE_PATH}
                                fill="white"
                                className="aura-path dark:fill-slate-900/50"
                            />

                            {/* Marching dashes border */}
                            <path
                                d={BUBBLE_PATH}
                                fill="none"
                                stroke={THEME_COLOR}
                                strokeWidth="1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>

                        {/* ── Stable Logo (Reusable BrandLogo component) ── */}
                        <div className="w-4/5 h-4/5 relative -top-1.5 sm:-top-2 z-10 transition-all pointer-events-none p-2 flex items-center justify-center">
                            <BrandLogo themeColor={THEME_COLOR} className="w-full h-full" />
                        </div>

                    </motion.button>
                </div>
            </div>
        </div>
    );
};

// ── TYPEWRITER COMPONENT: Handles artificial typing for cached/chunk answers ──
const TypewriterContent = ({ content, isStreaming, onComplete }) => {
    const [displayedText, setDisplayedText] = useState('');
    const [isTyping, setIsTyping] = useState(!isStreaming);
    const index = useRef(0);
    const lastContent = useRef('');

    // If we are actively streaming from SSE, don't use artificial typing
    if (isStreaming) {
        return <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>;
    }

    // Effect for artificial typewriter (for Cache Hits or older messages)
    useEffect(() => {
        // Only run for fresh content that isn't streaming
        if (content !== lastContent.current) {
            lastContent.current = content;
            setDisplayedText('');
            index.current = 0;
            setIsTyping(true);

            const interval = setInterval(() => {
                if (index.current < content.length) {
                    setDisplayedText(prev => prev + content[index.current]);
                    index.current += 1;
                    if (onComplete) onComplete();
                } else {
                    setIsTyping(false);
                    clearInterval(interval);
                }
            }, 10); // Fast typing (10ms per char) for premium feel

            return () => clearInterval(interval);
        }
    }, [content]);

    return (
        <ReactMarkdown rehypePlugins={[rehypeSanitize]}>
            {isTyping ? displayedText : content}
        </ReactMarkdown>
    );
};

export default ChatWidget;