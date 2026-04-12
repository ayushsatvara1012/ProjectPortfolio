/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, User, X, MoreHorizontal } from 'lucide-react';
import ThinkingLogo from './thinkLogo';
import BrandLogo from './brandLogo';

// ── v13: Shape class map (mirrors LogoCustomizer.jsx) ─────────────────────────
// Kept inline here so the widget bundle stays self-contained with no extra import.
const SHAPE_CLASS_MAP = {
    circle: 'rounded-full',
    squircle: 'rounded-[2rem]',
    bento: 'rounded-2xl',
    sharp: 'rounded-lg',
};

// ── v14: Avatar Gradient catalog (mirrors LogoCustomizer) ─────────────────────
export const AVATAR_GRADIENTS = {
    none: null,
    cosmic: ['#c026d3', '#3b82f6'], // Fuchsia to Blue
    sunset: ['#f97316', '#eab308'], // Orange to Yellow
    ocean: ['#06b6d4', '#3b82f6'],  // Cyan to Blue
    hacker: ['#22c55e', '#14b8a6'], // Green to Teal
};

// ── v13: BotAvatar — self-contained, handles image load errors ─────────────────
function BotAvatar({ shapeId, logoUrl, botName, themeColor, sizeClass, hasShadow = true, transparentBgImage = false, isCustom = false, bgStyle = 'none' }) {
    const [imgFailed, setImgFailed] = useState(false);
    const prevUrlRef = useRef(logoUrl);

    useEffect(() => {
        if (logoUrl !== prevUrlRef.current) {
            setImgFailed(false);
            prevUrlRef.current = logoUrl;
        }
    }, [logoUrl]);

    const initial = (String(botName || 'S')).charAt(0).toUpperCase();
    const showImage = logoUrl && logoUrl.trim() && !imgFailed;
    const activeShapeClass = SHAPE_CLASS_MAP[shapeId] || 'rounded-xl';

    let bgProps = { backgroundColor: showImage ? (transparentBgImage ? 'transparent' : '#ffffff') : themeColor };
    
    // Safety check: only apply custom gradient if it is a custom image AND gradient is selected
    if (showImage && isCustom && bgStyle && AVATAR_GRADIENTS[bgStyle]) {
        bgProps = { 
            background: `linear-gradient(135deg, ${AVATAR_GRADIENTS[bgStyle][0]}, ${AVATAR_GRADIENTS[bgStyle][1]})`, 
            backgroundColor: 'transparent' 
        };
    }

    return (
        <div
            className={`${sizeClass} ${activeShapeClass} overflow-hidden! flex! items-center! justify-center! shrink-0! dark:border-slate-700! ${hasShadow ? 'shadow-sm!' : ''} p-0! m-0! border-none!`}
            style={{ ...bgProps, boxSizing: 'border-box' }}
        >
            {showImage ? (
                <img
                    src={logoUrl}
                    alt={`${botName} logo`}
                    className="w-[75%]! h-[75%]! object-contain! m-0! p-0! border-none! bg-transparent! max-w-none! max-h-none!"
                    onError={() => setImgFailed(true)}
                    style={{ display: 'block', boxSizing: 'border-box' }}
                />
            ) : (
                <span
                    className="font-bold! leading-none! select-none! text-white! m-0! p-0!"
                    style={{ fontSize: sizeClass.includes('w-10') ? '1rem' : '0.7rem' }}
                >
                    {initial}
                </span>
            )}
        </div>
    );
}


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
        // ── v13 ──
        logo_shape: window.SaPyBaseConfig?.logoShape || 'circle',
        custom_logo_url: window.SaPyBaseConfig?.customLogoUrl || '',
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
                        // ── v13 ──
                        logo_shape: data.logo_shape || 'circle',
                        custom_logo_url: data.custom_logo_url || '',
                        avatar_bg_style: data.avatar_bg_style || 'none',
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

    const BOT_NAME = configData.bot_name || 'SaPyBase';
    const THEME_COLOR = configData.theme_color || '#5730F5';
    const LOGO_URL = configData.custom_logo_url || configData.logo_url;
    const LOGO_SHAPE = configData.logo_shape || 'circle';
    const AVATAR_BG_STYLE = configData.avatar_bg_style || 'none';

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

    const scrollToBottom = (smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    };

    const handleTypingComplete = useCallback((index) => {
        setMessages(prev => {
            const updated = [...prev];
            if (updated[index]) {
                updated[index] = { ...updated[index], isTyped: true };
            }
            return updated;
        });
        scrollToBottom(true);
    }, []);

    useEffect(() => {
        scrollToBottom(true);
    }, [messages, isLoading]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                scrollToBottom(false); // Instant scroll when initializing window
                inputRef.current?.focus();
            }, 10);
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
                        setMessages(prev => {
                            const updated = [...prev];
                            const lastMsg = updated[updated.length - 1];
                            if (lastMsg && lastMsg.role === 'bot') {
                                updated[updated.length - 1] = {
                                    ...lastMsg,
                                    isStreaming: false,
                                    isTyped: true // streaming text is fully assembled, prevent re-type
                                };
                            }
                            return updated;
                        });
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
                    scrollToBottom(true);
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

    // ── v13: Dynamic FAB shapes — each logo_shape gets a unique outline ──────
    const FAB_SHAPES = {
        // 1. Organic round speech bubble with elegant tail (bottom-left)
        circle: {
            path: 'M 50 4 C 75.5 4 96 24.5 96 50 C 96 75.5 75.5 96 50 96 C 24.5 96 4 75.5 4 50 C 4 24.5 24.5 4 50 4 Z',
            logoSize: 'w-full h-full',
            x: 0, y: 0,
        },
        // 2. Squarish chat bubble with rounded corners + tail (the classic)
        squircle: {
            path: 'M 22 4 H 78 Q 96 4 96 22 V 62 Q 96 80 78 80 H 36 L 18 96 L 22 80 H 22 Q 4 80 4 62 V 22 Q 4 4 22 4 Z',
            logoSize: 'w-full h-full',
            x: 0, y: -8, // Body Y range (4 to 80), Center Y = 42. SVG center is 50. Output: -8
        },
        // 3. Clean circle — no tail, modern and minimal
        bento: {
            path: 'M39.5 0H60.5A39.5 39.5 0 0160.5 79H46Q40 79 27 90 35 79 32 78A39.5 39.5 0 0139.5 0Z',
            logoSize: 'w-full h-full',
            x: 0, y: -10.5, // Body Y range (0 to 79), Center Y = 39.5. SVG center is 50. Output: -10.5
        },
        // 4. Sharp rectangle with slight rounding — no tail, clean edge
        sharp: {
            path: 'M50 3C77 3 97 23 97 50 97 77 77 97 50 97 35 97 26 90 26 90L9 97 15 83C6 71 3 61 3 50 3 23 23 3 50 3Z',
            logoSize: 'w-full h-full',
            x: 0, y: 0, // Body is a perfect circle centered at (50, 50). Output: 0
        },
    };
    const fabShape = FAB_SHAPES[LOGO_SHAPE] || FAB_SHAPES.circle;
    const FAB_PATH = fabShape.path;

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
                                        {/* ── v13: shaped avatar in header ── */}
                                        <div className="relative">
                                            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white animate-pulse z-10" />
                                            <BotAvatar
                                                shapeId={LOGO_SHAPE}
                                                logoUrl={LOGO_URL}
                                                botName={BOT_NAME}
                                                themeColor={THEME_COLOR}
                                                sizeClass="w-10 h-10"
                                                isCustom={!!configData.custom_logo_url}
                                                bgStyle={AVATAR_BG_STYLE}
                                            />
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
                            <div className="flex-1 p-4 overflow-y-auto overscroll-none touch-pan-y flex flex-col gap-5 pt-6 pb-2 relative scroll-smooth custom-scrollbar">
                                <AnimatePresence initial={false}>
                                    {messages.map((msg, idx) => (
                                        <motion.div
                                            key={idx}
                                            variants={messageVariants}
                                            initial="hidden"
                                            animate="visible"
                                            layout="position"
                                            className={`flex items-center gap-2 min-w-0 max-w-[85%] sm:max-w-[80%] ${msg.role === 'user' ? 'self-end flex-row-reverse' : 'self-start'}`}
                                        >
                                            <div className="shrink-0">
                                                {msg.role === 'user' ? (
                                                    <div className="w-6 h-6 rounded-full text-white flex items-center justify-center shadow-md dark:shadow-blue-900/40" style={{ backgroundColor: THEME_COLOR }}>
                                                        <User size={14} />
                                                    </div>
                                                ) : (
                                                    /* ── v13: shaped avatar in message list ── */
                                                    <BotAvatar
                                                        shapeId={LOGO_SHAPE}
                                                        logoUrl={LOGO_URL}
                                                        botName={BOT_NAME}
                                                        themeColor={THEME_COLOR}
                                                        sizeClass="w-6 h-6"
                                                        hasShadow={false}
                                                        transparentBgImage={true}
                                                        isCustom={!!configData.custom_logo_url}
                                                        bgStyle={AVATAR_BG_STYLE}
                                                    />
                                                )}
                                            </div>

                                            <div className={`flex flex-col max-w-full min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                {msg.role === 'bot' && (
                                                    <span className="text-md uppercase tracking-widest font-bold text-slate-400 font-sans mb-1 ml-1 leading-none">{BOT_NAME}</span>
                                                )}
                                                <div
                                                    className={`px-4 py-2 shadow-sm min-h-[38px] flex items-center max-w-full break-words ${msg.role === 'user'
                                                        ? 'text-white rounded-2xl rounded-br-none'
                                                        : 'bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200/60 dark:border-slate-700/60 rounded-2xl rounded-bl-none overflow-hidden prose prose-compact dark:prose-invert max-w-none prose-p:leading-normal prose-pre:bg-gray-50 dark:prose-pre:bg-slate-900 prose-pre:text-gray-800 dark:prose-pre:text-slate-200 prose-pre:text-sm prose-code:text-sm prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:break-words prose-table:block prose-table:overflow-x-auto prose-headings:text-gray-900 dark:prose-headings:text-slate-100 prose-strong:text-gray-900 dark:prose-strong:text-slate-100 prose-ul:my-1 prose-li:my-0 prose-p:font-semibold prose-img:max-w-full prose-img:rounded-lg'
                                                        }`}
                                                    style={msg.role === 'user' ? { backgroundColor: THEME_COLOR } : {}}
                                                >
                                                    {msg.role === 'user' ? (
                                                        <div className="min-w-0 max-w-full whitespace-pre-wrap text-lg font-semibold font-sans leading-relaxed">{msg.content}</div>
                                                    ) : (
                                                        <div className="min-w-0 max-w-full text-lg font-semibold font-sans leading-relaxed">
                                                            <TypewriterContent
                                                                key={`${idx}-${msg.content.length}`} // Unique key to force reset on content change
                                                                content={msg.content}
                                                                isStreaming={msg.isStreaming}
                                                                isTyped={msg.isTyped}
                                                                onComplete={() => handleTypingComplete(idx)}
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

                        {/* ── SVG layer: clip-path fill + aura + themed stroke ── */}
                        <svg
                            viewBox="0 0 100 100"
                            xmlns="http://www.w3.org/2000/svg"
                            className="absolute inset-0 w-full h-full z-0"
                            overflow="visible"
                        >
                            <defs>
                                <clipPath id="fab-clip">
                                    <path d={FAB_PATH} />
                                </clipPath>

                                {/* ── v3: Premium Inset Neumorphic Filter ── */}
                                <filter id="neumorphic-3d-inset" x="-20%" y="-20%" width="140%" height="140%">
                                    {/* A. Dark Inner Shadow (Top-Left) */}
                                    <feComponentTransfer in="SourceAlpha">
                                        <feFuncA type="table" tableValues="1 0" />
                                    </feComponentTransfer>
                                    <feGaussianBlur stdDeviation="3" />
                                    <feOffset dx="4" dy="4" result="offsetBlurDark" />
                                    <feComposite operator="in" in2="SourceAlpha" result="innerShadowDark" />
                                    <feFlood floodColor="rgba(0,0,0,0.14)" />
                                    <feComposite operator="in" in2="innerShadowDark" result="finalDark" />

                                    {/* B. Light Inner Highlight (Bottom-Right) */}
                                    <feComponentTransfer in="SourceAlpha">
                                        <feFuncA type="table" tableValues="1 0" />
                                    </feComponentTransfer>
                                    <feGaussianBlur stdDeviation="3" />
                                    <feOffset dx="-3" dy="-3" result="offsetBlurLight" />
                                    <feComposite operator="in" in2="SourceAlpha" result="innerShadowLight" />
                                    <feFlood floodColor="rgba(255,255,255,0.8)" />
                                    <feComposite operator="in" in2="innerShadowLight" result="finalLight" />

                                    {/* C. Combine Everything */}
                                    <feMerge>
                                        <feMergeNode in="SourceGraphic" />
                                        <feMergeNode in="finalDark" />
                                        <feMergeNode in="finalLight" />
                                    </feMerge>
                                </filter>

                                {/* ── v3: Greyish Surface Gradient (Slate Tone) ── */}
                                <linearGradient id="fab-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#FFFFFF" />

                                    <stop offset="100%" stopColor="#E2E8F0" />
                                </linearGradient>

                                <linearGradient id="fab-gradient-dark" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#1E293B" /> {/* Slate-800 */}
                                    <stop offset="100%" stopColor="#0F172A" /> {/* Slate-900 */}
                                </linearGradient>

                                {AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE] && configData.custom_logo_url && (
                                    <linearGradient id="sapybase-avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor={AVATAR_GRADIENTS[AVATAR_BG_STYLE][0]} />
                                        <stop offset="100%" stopColor={AVATAR_GRADIENTS[AVATAR_BG_STYLE][1]} />
                                    </linearGradient>
                                )}
                            </defs>

                            {/* 1. Base Layer (Solid Color or Dynamic Custom Gradient) */}
                            <path
                                d={FAB_PATH}
                                fill={(configData.custom_logo_url && AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE]) ? "url(#sapybase-avatar-grad)" : "url(#fab-gradient)"}
                                className={!(configData.custom_logo_url && AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE]) ? "dark:fill-[url(#fab-gradient-dark)] transition-all duration-500" : "transition-all duration-500"}
                            />

                            {/* 2. Logo Image Layer (Adaptive scaling & clipping) */}
                            {LOGO_URL && (
                                <g clipPath="url(#fab-clip)">
                                    <image
                                        href={LOGO_URL}
                                        x={15 + (fabShape.x || 0)}
                                        y={15 + (fabShape.y || 0)}
                                        width={70}
                                        height={70}
                                        preserveAspectRatio="xMidYMid meet"
                                        className="z-10"
                                    />
                                </g>
                            )}

                            {/* 3. Fallback Initial Layer (Clean, no filter) */}
                            {!LOGO_URL && (
                                <text
                                    x={50 + (fabShape.x || 0)}
                                    y={52 + (fabShape.y || 0)}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fill={THEME_COLOR}
                                    className="font-bold select-none pointer-events-none"
                                    style={{ fontSize: '26px', fontFamily: 'var(--font-display, sans-serif)' }}
                                >
                                    {(BOT_NAME || 'S').charAt(0).toUpperCase()}
                                </text>
                            )}

                            {/* 4. Shadow Overlay Layer (Applies 3D depth ON TOP of the content) */}
                            <path
                                d={FAB_PATH}
                                fill="transparent"
                                filter="url(#neumorphic-3d-inset)"
                                className="pointer-events-none"
                            />

                            {/* 5. Pulsing aura (Subtle Stroke Only) */}
                            <path
                                d={FAB_PATH}
                                fill="none"
                                stroke="white"
                                strokeWidth="0.8"
                                className="aura-path opacity-30 dark:stroke-slate-500/30"
                            />

                            {/* 5. Themed stroke border (Subtle Outer Edge) */}
                            <path
                                d={FAB_PATH}
                                fill="none"
                                stroke={THEME_COLOR}
                                strokeWidth="1.2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="opacity-20"
                            />
                        </svg>

                        {/* ── v14: Standalone LOGO was integrated into the SVG above ── */}

                    </motion.button>
                </div>
            </div>
        </div>
    );
};

// ── TYPEWRITER COMPONENT: Handles silky smooth transitions for chat text ──
const TypewriterContent = ({ content, isStreaming, isTyped, onComplete }) => {
    const [segments, setSegments] = useState([]);
    const [isTyping, setIsTyping] = useState(!isStreaming && !isTyped);
    const lastContent = useRef('');

    // Effect for artificial typewriter with "Premium Jitter"
    useEffect(() => {
        if (!content || isTyped) {
            setIsTyping(false);
            return;
        }

        if (content !== lastContent.current) {
            lastContent.current = content;
            setSegments([]);
            setIsTyping(true);

            let currentIdx = 0;
            const words = content.split(/(\s+)/); // Keep whitespace

            const typeNextWord = () => {
                if (currentIdx < words.length) {
                    const word = words[currentIdx];
                    setSegments(prev => [...prev, word]);
                    currentIdx++;
                    if (onComplete) onComplete();

                    // Natural pacing: slightly faster for small words, slower for punctuation
                    const delay = word.length > 5 ? 25 : 15;
                    setTimeout(typeNextWord, delay);
                } else {
                    setIsTyping(false);
                }
            };

            typeNextWord();
        }
    }, [content, isTyped, onComplete]);

    // If we are actively streaming from SSE, we still want to wrap tokens for smoothness
    // However, the tokens come in directly from the parent state.
    if (isStreaming) {
        return (
            <div className="relative overflow-hidden transition-all duration-300">
                <ReactMarkdown
                    rehypePlugins={[rehypeSanitize]}
                    components={{
                        p: ({ node, ...props }) => <p {...props} className="first:mt-0 last:mb-0 mb-2 transition-opacity duration-500 animate-in fade-in slide-in-from-bottom-1" />,
                        li: ({ node, ...props }) => <li {...props} className="animate-in fade-in slide-in-from-left-1" />
                    }}
                >
                    {content}
                </ReactMarkdown>
            </div>
        );
    }

    return (
        <div className="relative transition-all duration-500">
            <ReactMarkdown
                rehypePlugins={[rehypeSanitize]}
                components={{
                    p: ({ node, ...props }) => <p {...props} className="first:mt-0 last:mb-0 mb-2" />,
                }}
            >
                {isTyping ? segments.join('') : content}
            </ReactMarkdown>
            {isTyping && (
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                    className="inline-block w-1.5 h-4 ml-0.5 bg-slate-400 align-middle"
                />
            )}
        </div>
    );
};

export default ChatWidget;