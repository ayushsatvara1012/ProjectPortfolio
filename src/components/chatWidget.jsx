/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence, color } from 'framer-motion';
import { MoreHorizontal, Send, User, ChevronDown, X } from 'lucide-react';
import ThinkingLogo from './thinkLogo';

const ChatWidget = ({ apiKey }) => {
    // 1. Determine if we are testing locally or live on a client's site
    const ASSET_BASE_URL = import.meta.env.DEV ? '' : 'https://www.sapybase.com';

    // 2. Safely grab the window config if it exists
    const winConfig = window.SaPyBaseConfig || {};

    // 3. Set the initial config, using the dynamic asset URL for fallbacks!
    const [configData, setConfigData] = useState({
        theme_color: winConfig.themeColor || '#5730F5',
        bot_name: winConfig.botName || 'Sapy AI',

        // --- THE FIX IS HERE ---
        // If the client didn't provide a custom logo, use the dynamic base URL
        logo_url: winConfig.logoUrl || `${ASSET_BASE_URL}/SB_loading_clean.svg`,

        initial_message: winConfig.welcomeMessage || "Hi! I'm the SaPyBase AI Assistant. How can I help you today?",
        quick_questions: winConfig.quickQuestions || []
    });

    const THEME_COLOR = configData.theme_color;
    const BOT_NAME = configData.bot_name;
    const LOGO_URL = configData.logo_url;

    const [isOpen, setIsOpen] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    // 3. CRITICAL FIX: Initialize messages with the welcome message so it is never blank!
    const [messages, setMessages] = useState([
        { role: 'bot', content: configData.initial_message }
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

    const activeApiKey = apiKey || window.SaPyBaseConfig?.apiKey || import.meta.env?.VITE_SAPYBASE_API_KEY;
    const BASE_URL = import.meta.env.DEV ? 'http://localhost:8000' : 'https://sapyai.onrender.com';

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const menuRef = useRef(null);

    // Initial message is already set in state above, so we don't need the fetch loop here for basic config.
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

        try {
            // Call your local FastAPI engine
            // Prioritize Prop, then Window Object, then Vite environment variable
            const activeApiKey = apiKey || window.SaPyBaseConfig?.apiKey || import.meta.env?.VITE_SAPYBASE_API_KEY;

            if (!activeApiKey) {
                console.warn("SaPyBase Widget: Missing API Key. Processing aborted.");
                setMessages(prev => [...prev, { role: 'bot', content: "Configure your API Key locally to start chatting with Sapy AI!" }]);
                return;
            }

            const response = await fetch(`${BASE_URL}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': activeApiKey
                },
                body: JSON.stringify({ message: userMessage }),
            });

            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();

            setMessages(prev => [...prev, { role: 'bot', content: data.reply }]);
        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { role: 'bot', content: "I'm having trouble connecting to the SaPyBase servers right now. Please try again later or use the contact form." }]);
        } finally {
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

    // Completely disable rendering in production if no key is found at all
    if (!activeApiKey && !import.meta.env?.DEV) {
        return null;
    }

    return (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-2147483647 font-sans pointer-events-none" style={{ isolation: 'isolate', width: isOpen ? '100%' : 'auto', height: isOpen ? '100%' : 'auto' }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={windowVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="fixed inset-0 sm:inset-auto sm:bottom-26 sm:right-6 w-full h-[100dvh] sm:w-[480px] sm:h-[600px] bg-white/95 backdrop-blur-2xl sm:rounded-2xl shadow-lg shadow-blue-900/20 flex flex-col sm:overflow-hidden border-t sm:border border-gray-200/50 z-2147483647 pointer-events-auto origin-bottom-right"
                        style={isMobile ? { height: '100dvh', minHeight: '-webkit-fill-available' } : {}}
                    >
                        {/* Header with Animated Gradient Glow - Removed overflow-hidden to allow menu visibility */}
                        <div className="relative shrink-0">
                            {/* Animated Background */}
                            <div className="absolute inset-0 bg-linear-to-r from-indigo-500/20 via-purple-500/20 to-pink-500/20 animate-gradient-x" style={{ backgroundSize: '150% 150%' }} />

                            <div className="bg-white/40 backdrop-blur-md text-slate-900 p-2 pt-[max(env(safe-area-inset-top),0.75rem)] sm:pt-2 flex justify-end items-center relative z-10 border-b border-gray-200/50">
                                <div className="relative flex flex-row justify-between items-center w-full" ref={menuRef}>
                                    <div className="relative flex items-center gap-2 pl-4">
                                        <div className="absolute top-2.5 w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                        <div className="flex flex-col ml-4">
                                            <p className="font-questrial font-bold text-lg" style={{ color: THEME_COLOR }}>{BOT_NAME}</p>
                                            <a href="https://www.sapybase.com" className="text-xs italic text-slate-500">Powered by SaPyBase</a>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => setShowMenu(!showMenu)}
                                            className="p-2.5 sm:p-2 hover:bg-black/5 rounded-full transition-colors group focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                                            style={{ touchAction: 'manipulation' }}
                                            aria-label="Chat menu"
                                        >
                                            <MoreHorizontal size={22} className="text-slate-500" />
                                        </button>

                                        <button
                                            onClick={() => setIsOpen(false)}
                                            className="p-2.5 sm:p-2 hover:bg-red-50 rounded-full transition-colors group focus:outline-none min-w-[44px] min-h-[44px] flex items-center justify-center"
                                            style={{ touchAction: 'manipulation' }}
                                            aria-label="Close chat"
                                        >
                                            <X size={22} className="text-red-500 transition-transform group-hover:rotate-90" />
                                        </button>
                                    </div>

                                    <AnimatePresence>
                                        {showMenu && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                className="absolute right-0 top-full mt-2 w-48 bg-white backdrop-blur-md rounded-xl shadow-2xl border border-gray-100 py-1 z-2147483647 overflow-hidden"
                                            >
                                                <button
                                                    onClick={() => {
                                                        setMessages([{ role: 'bot', content: configData.initial_message }]);
                                                        setShowMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors border-b border-gray-100"
                                                >
                                                    Clear chat
                                                </button>

                                                <a
                                                    href="https://www.sapybase.com"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="w-full text-left px-4 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 transition-colors flex items-center justify-between group"
                                                    onClick={() => setShowMenu(false)}
                                                >
                                                    Add to your site
                                                    <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">↗</span>
                                                </a>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 p-4 overflow-y-auto overscroll-none touch-pan-y bg-gray-50/50 flex flex-col gap-5 pt-6 pb-2 relative scroll-smooth">
                            <AnimatePresence initial={false}>
                                {messages.map((msg, idx) => (
                                    <motion.div
                                        key={idx}
                                        variants={messageVariants}
                                        initial="hidden"
                                        animate="visible"
                                        layout="position"
                                        className={`flex gap-3 max-w-[92%] sm:max-w-[88%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
                                    >
                                        <div className="shrink-0 mt-auto mb-1">
                                            {msg.role === 'user' ? (
                                                <div className="w-9 h-9 rounded-full text-white flex items-center justify-center shadow-md" style={{ backgroundColor: THEME_COLOR }}>
                                                    <User size={18} />
                                                </div>
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center relative " >
                                                    <img src={LOGO_URL} alt="SaPyBase AI" className=" object-contain pointer-events-none scale-80" />
                                                </div>
                                            )}
                                        </div>

                                        <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            {msg.role === 'bot' && (
                                                <span className="text-[10px] font-bold text-slate-400 mb-1 ml-1 uppercase tracking-widest leading-none">{BOT_NAME}</span>
                                            )}
                                            <div
                                                className={`px-4 py-2 shadow-sm min-h-[38px] flex items-center ${msg.role === 'user'
                                                    ? 'text-white rounded-2xl rounded-br-none'
                                                    : 'bg-white text-gray-800 border border-gray-200/60 rounded-2xl rounded-bl-none prose prose-compact max-w-none prose-p:leading-normal prose-pre:bg-gray-50 prose-pre:text-gray-800 prose-headings:text-gray-900 prose-strong:text-gray-900 prose-ul:my-1 prose-li:my-0'
                                                    }`}
                                                style={msg.role === 'user' ? { backgroundColor: THEME_COLOR } : {}}
                                            >
                                                {msg.role === 'user' ? (
                                                    <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                                                ) : (
                                                    <div className="text-sm">
                                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
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
                                        <ThinkingLogo size={45} className="origin-left" />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                            <div ref={messagesEndRef} className="h-2 shrink-0" aria-hidden="true" />
                        </div>

                        {/* Quick Questions & Input Area */}
                        <div className="bg-white/95 backdrop-blur-2xl border-t border-gray-200/50 shrink-0 z-10 flex flex-col">
                            {/* Quick Questions Area */}
                            {messages.length === 1 && configData.quick_questions?.length > 0 && (
                                <div className="px-3 pt-3 pb-1 flex gap-2 overflow-x-auto scrollbar-hide snap-x">
                                    {configData.quick_questions.map((q, qidx) => (
                                        <button
                                            key={qidx}
                                            onClick={() => { setInput(q.prompt); inputRef.current?.focus(); }}
                                            className="shrink-0 snap-start px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 text-xs sm:text-sm rounded-full transition-colors whitespace-nowrap"
                                            style={{ touchAction: 'manipulation' }}
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
                                        className="flex-1 max-h-32 min-h-[40px] bg-transparent resize-none px-2.5 py-[9px] focus:outline-none text-[16px] leading-normal placeholder-gray-400 disabled:opacity-50 appearance-none rounded-none"
                                        style={{ fontSize: '16px' }}
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
                {/* Typewriter Promo Label */}
                <AnimatePresence>
                    {!isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, x: 10 }}
                            animate={{ opacity: 1, scale: 1, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, x: 10 }}
                            className="absolute right-full mr-5 top-1/2 -translate-y-1/2 hidden sm:flex items-center pointer-events-none"
                        >
                            <div className="bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl shadow-2xl border border-indigo-100/50 flex items-center gap-1.5 min-w-[150px] justify-center relative">
                                <span className="text-sm font-bold text-slate-700 whitespace-nowrap tracking-tight">
                                    {currentPhrase}
                                </span>
                                <motion.span
                                    animate={{ opacity: [1, 0, 1] }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="w-0.5 h-4 bg-indigo-500 rounded-full"
                                />
                                {/* Speech Bubble Tail */}
                                <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 bg-white/95 border-r border-t border-indigo-100/50 rotate-45" />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    whileTap={{ scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={() => setIsOpen(prev => !prev)}
                    aria-label={isOpen ? "Collapse chat" : "Open AI chat assistant"}
                    aria-expanded={isOpen}
                    style={{ touchAction: 'manipulation' }}
                    className="relative flex flex-col items-center justify-center focus:outline-none sm:w-20 sm:h-20 w-15 h-15 rounded-full bg-white shadow-md sm:shadow-none transition-all p-1"
                >
                    {/* Rotating Dashed Border Layer */}
                    <motion.div
                        className="absolute inset-0 rounded-full border border-dashed border-indigo-400 z-0"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    />

                    {/* Pulsing Background Aura */}
                    <motion.div
                        className="absolute inset-0 rounded-full bg-indigo-400/10 z-0"
                        animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Stable Logo */}
                    <img
                        src={LOGO_URL}
                        alt="SaPyBase"
                        className="w-4/5 h-4/5 relative -top-1 z-10 drop-shadow-xl transition-all pointer-events-none p-2"
                    />

                    {/* Chevron — appears below the logo when chat is open */}
                    <AnimatePresence>
                        {isOpen && (
                            <motion.span
                                key="fab-chevron"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                className="absolute bottom-[10px] left-1/2 -translate-x-1/2 z-20"
                            >
                                <ChevronDown size={25} strokeWidth={2} className='text-blue-900' />
                            </motion.span>
                        )}
                    </AnimatePresence>
                </motion.button>
            </div>
        </div>
    );
};

export default ChatWidget;