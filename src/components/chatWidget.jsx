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
    
    // Safety check: apply custom gradient freely if a gradient string is selected
    if (bgStyle && bgStyle !== 'none' && AVATAR_GRADIENTS[bgStyle]) {
        bgProps = { 
            backgroundImage: `linear-gradient(135deg, ${AVATAR_GRADIENTS[bgStyle][0]}, ${AVATAR_GRADIENTS[bgStyle][1]})`, 
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
                    className={`m-0! p-0! border-none! bg-transparent! max-w-none! max-h-none! ${isCustom ? 'w-full! h-full! object-contain!' : 'w-[75%]! h-[75%]! object-contain!'}`}
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

// ── v13: Dynamic FAB shapes — each logo_shape gets a unique outline ──────
export const FAB_SHAPES = {
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

export const FabWidgetPreview = ({ shapeId, logoUrl, botName, themeColor, bgStyle, isCustomUrl = false }) => {
    const fabShape = FAB_SHAPES[shapeId] || FAB_SHAPES.circle;
    const FAB_PATH = fabShape.path;
    const AVATAR_BG_STYLE = bgStyle || 'none';
    const LOGO_URL = logoUrl;
    const THEME_COLOR = themeColor || '#5730F5';
    const BOT_NAME = botName || 'S';
    const idPrefix = "preview";

    return (
        <svg
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            className="w-14 h-14 shrink-0 drop-shadow-sm"
            overflow="visible"
        >
            <defs>
                <clipPath id={`${idPrefix}-fab-clip`}>
                    <path d={FAB_PATH} />
                </clipPath>

                <filter id={`${idPrefix}-neumorphic-3d-inset`} x="-20%" y="-20%" width="140%" height="140%">
                    <feComponentTransfer in="SourceAlpha">
                        <feFuncA type="table" tableValues="1 0" />
                    </feComponentTransfer>
                    <feGaussianBlur stdDeviation="3" />
                    <feOffset dx="4" dy="4" result="offsetBlurDark" />
                    <feComposite operator="in" in2="SourceAlpha" result="innerShadowDark" />
                    <feFlood floodColor="rgba(0,0,0,0.14)" />
                    <feComposite operator="in" in2="innerShadowDark" result="finalDark" />

                    <feComponentTransfer in="SourceAlpha">
                        <feFuncA type="table" tableValues="1 0" />
                    </feComponentTransfer>
                    <feGaussianBlur stdDeviation="3" />
                    <feOffset dx="-3" dy="-3" result="offsetBlurLight" />
                    <feComposite operator="in" in2="SourceAlpha" result="innerShadowLight" />
                    <feFlood floodColor="rgba(255,255,255,0.8)" />
                    <feComposite operator="in" in2="innerShadowLight" result="finalLight" />

                    <feMerge>
                        <feMergeNode in="SourceGraphic" />
                        <feMergeNode in="finalDark" />
                        <feMergeNode in="finalLight" />
                    </feMerge>
                </filter>

                <linearGradient id={`${idPrefix}-fab-gradient`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" />
                    <stop offset="100%" stopColor="#E2E8F0" />
                </linearGradient>

                <linearGradient id={`${idPrefix}-fab-gradient-dark`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#1E293B" /> 
                    <stop offset="100%" stopColor="#0F172A" /> 
                </linearGradient>

                {AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE] && (
                    <linearGradient id={`${idPrefix}-sapybase-avatar-grad`} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor={AVATAR_GRADIENTS[AVATAR_BG_STYLE][0]} />
                        <stop offset="100%" stopColor={AVATAR_GRADIENTS[AVATAR_BG_STYLE][1]} />
                    </linearGradient>
                )}
            </defs>

            <path
                d={FAB_PATH}
                fill={(AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE]) ? `url(#${idPrefix}-sapybase-avatar-grad)` : `url(#${idPrefix}-fab-gradient)`}
                className={!(AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE]) ? `dark:fill-[url(#${idPrefix}-fab-gradient-dark)] transition-all duration-500` : "transition-all duration-500"}
            />

            {LOGO_URL && (
                <g clipPath={`url(#${idPrefix}-fab-clip)`}>
                    <image
                        href={LOGO_URL}
                        x={isCustomUrl ? (fabShape.x || 0) : (15 + (fabShape.x || 0))}
                        y={isCustomUrl ? (fabShape.y || 0) : (15 + (fabShape.y || 0))}
                        width={isCustomUrl ? 100 : 70}
                        height={isCustomUrl ? 100 : 70}
                        preserveAspectRatio="xMidYMid meet"
                        className="z-10"
                    />
                </g>
            )}

            {!LOGO_URL && (
                <text
                    x={50 + (fabShape.x || 0)}
                    y={52 + (fabShape.y || 0)}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill={(AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE]) ? "#ffffff" : THEME_COLOR}
                    className="font-bold select-none pointer-events-none"
                    style={{ fontSize: '26px', fontFamily: 'var(--font-display, sans-serif)' }}
                >
                    {(BOT_NAME || 'S').charAt(0).toUpperCase()}
                </text>
            )}

            <path
                d={FAB_PATH}
                fill="transparent"
                filter={`url(#${idPrefix}-neumorphic-3d-inset)`}
                className="pointer-events-none"
            />
        </svg>
    );
};


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
        // ── v13 & v14 ──
        logo_shape: window.SaPyBaseConfig?.logoShape || 'circle',
        custom_logo_url: window.SaPyBaseConfig?.customLogoUrl || '',
        avatar_bg_style: window.SaPyBaseConfig?.avatarBgStyle || 'none',
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
    const scrollContainerRef = useRef(null);
    const userHasScrolledUpRef = useRef(false);
    const tokenBufferRef = useRef([]);
    const rafIdRef = useRef(null);

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

    // ── Zone 1: Smart Scroll with Intent Detection ───────────────────────────
    const isNearBottom = useCallback(() => {
        const el = scrollContainerRef.current;
        if (!el) return true;
        return el.scrollHeight - el.scrollTop - el.clientHeight < 60;
    }, []);

    const scrollToBottom = useCallback((smooth = true) => {
        if (userHasScrolledUpRef.current) return;
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }, []);

    const forceScrollToBottom = useCallback((smooth = true) => {
        userHasScrolledUpRef.current = false;
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }, []);

    const handleScrollContainer = useCallback(() => {
        if (isNearBottom()) {
            userHasScrolledUpRef.current = false;
        } else {
            userHasScrolledUpRef.current = true;
        }
    }, [isNearBottom]);

    const handleTypingComplete = useCallback((index) => {
        setMessages(prev => {
            const updated = [...prev];
            if (updated[index]) {
                updated[index] = { ...updated[index], isTyped: true };
            }
            return updated;
        });
        scrollToBottom(true);
    }, [scrollToBottom]);

    // Only auto-scroll on new user messages or when not loading (non-stream events)
    useEffect(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'user') {
            forceScrollToBottom(true);
        } else if (!isLoading) {
            scrollToBottom(true);
        }
    }, [messages.length, isLoading, forceScrollToBottom, scrollToBottom]);

    useEffect(() => {
        if (isOpen) {
            setTimeout(() => {
                forceScrollToBottom(false); // Instant scroll when initializing window
                inputRef.current?.focus();
            }, 10);
        }
    }, [isOpen, forceScrollToBottom]);

    // ── Zone 2: rAF Token Drain Loop ─────────────────────────────────────────
    const drainTokenBuffer = useCallback(() => {
        if (tokenBufferRef.current.length === 0) {
            rafIdRef.current = null;
            return;
        }
        const chunk = tokenBufferRef.current.join('');
        tokenBufferRef.current = [];

        setMessages(prev => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg && lastMsg.role === 'bot' && lastMsg.isStreaming) {
                updated[updated.length - 1] = {
                    ...lastMsg,
                    content: lastMsg.content + chunk,
                };
            }
            return updated;
        });

        scrollToBottom(true);
        rafIdRef.current = requestAnimationFrame(drainTokenBuffer);
    }, [scrollToBottom]);

    const startDrainLoop = useCallback(() => {
        if (rafIdRef.current === null) {
            rafIdRef.current = requestAnimationFrame(drainTokenBuffer);
        }
    }, [drainTokenBuffer]);

    // Cleanup rAF on unmount
    useEffect(() => {
        return () => {
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }
        };
    }, []);

    const handleSend = async (e) => {
        if (e) e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input.trim();
        // Add user message + immediately seed a bot message bubble for the thinking state
        setMessages(prev => [
            ...prev,
            { role: 'user', content: userMessage },
            { role: 'bot', content: '', isStreaming: true, isTyped: false }
        ]);
        setInput('');
        setIsLoading(true);
        userHasScrolledUpRef.current = false; // Reset scroll intent on new message

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
            setMessages(prev => {
                const updated = [...prev];
                const lastMsg = updated[updated.length - 1];
                if (lastMsg && lastMsg.role === 'bot' && lastMsg.isStreaming) {
                    updated[updated.length - 1] = { role: 'bot', content: "Configure your API Key locally to start chatting with Sapy AI!", isStreaming: false, isTyped: false };
                } else {
                    updated.push({ role: 'bot', content: "Configure your API Key locally to start chatting with Sapy AI!" });
                }
                return updated;
            });
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
                        // Replace the pre-seeded empty bot message with the cached reply
                        setMessages(prev => {
                            const updated = [...prev];
                            const lastMsg = updated[updated.length - 1];
                            if (lastMsg && lastMsg.role === 'bot' && lastMsg.isStreaming) {
                                updated[updated.length - 1] = { role: 'bot', content: data.reply, isStreaming: false, isTyped: false };
                            } else {
                                updated.push({ role: 'bot', content: data.reply });
                            }
                            return updated;
                        });
                        setIsLoading(false);
                        throw new Error('CACHE_HIT');
                    }
                    if (!response.ok) {
                        // Handle specific HTTP errors before the stream begins
                        if (response.status === 402) {
                            let detail = null;
                            try { detail = await response.json(); } catch { /* noop */ }
                            const isMessageLimit = detail?.detail?.code === 'MESSAGE_LIMIT_EXCEEDED';
                            const errorContent = isMessageLimit
                                ? `I've reached my monthly message limit. Please contact the site owner to upgrade their plan at [sapybase.com](https://www.sapybase.com). I'll be back next billing cycle! 🚀`
                                : "I'm temporarily unavailable. Please try again later.";
                            // Replace the pre-seeded empty bot message with the error
                            setMessages(prev => {
                                const updated = [...prev];
                                const lastMsg = updated[updated.length - 1];
                                if (lastMsg && lastMsg.role === 'bot' && lastMsg.isStreaming) {
                                    updated[updated.length - 1] = { role: 'bot', content: errorContent, isStreaming: false, isTyped: false };
                                } else {
                                    updated.push({ role: 'bot', content: errorContent });
                                }
                                return updated;
                            });
                            setIsLoading(false);
                            throw new Error('HANDLED_ERROR');
                        }
                        throw new Error(`Server error: ${response.status}`);
                    }
                    // response.ok && text/event-stream → SSE stream begins normally
                },

                // ── STREAMING TOKEN HANDLER (Zone 2: rAF-buffered) ────────────
                onmessage(msg) {
                    // Sentinel: backend signals end-of-stream
                    if (msg.data === '[DONE]') {
                        // Drain any remaining tokens in buffer
                        if (tokenBufferRef.current.length > 0) {
                            const remaining = tokenBufferRef.current.join('');
                            tokenBufferRef.current = [];
                            setMessages(prev => {
                                const updated = [...prev];
                                const lastMsg = updated[updated.length - 1];
                                if (lastMsg && lastMsg.role === 'bot') {
                                    updated[updated.length - 1] = {
                                        ...lastMsg,
                                        content: lastMsg.content + remaining,
                                        isStreaming: false,
                                        isTyped: true,
                                    };
                                }
                                return updated;
                            });
                        } else {
                            setMessages(prev => {
                                const updated = [...prev];
                                const lastMsg = updated[updated.length - 1];
                                if (lastMsg && lastMsg.role === 'bot') {
                                    updated[updated.length - 1] = {
                                        ...lastMsg,
                                        isStreaming: false,
                                        isTyped: true,
                                    };
                                }
                                return updated;
                            });
                        }
                        // Cancel the drain loop
                        if (rafIdRef.current) {
                            cancelAnimationFrame(rafIdRef.current);
                            rafIdRef.current = null;
                        }
                        setIsLoading(false);
                        forceScrollToBottom(true);
                        return;
                    }

                    let chunk = '';
                    try {
                        const parsed = JSON.parse(msg.data);
                        chunk = parsed.token || parsed.content || parsed.text || '';
                    } catch {
                        chunk = msg.data;
                    }

                    if (!chunk) return;

                    // Fade out the loading aura on first real token
                    if (!firstChunkReceived) {
                        firstChunkReceived = true;
                        setIsLoading(false);
                    }

                    // Push token into buffer and start the drain loop
                    tokenBufferRef.current.push(chunk);
                    startDrainLoop();
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
                    // Replace the pre-seeded empty bot message with the error
                    setMessages(prev => {
                        const updated = [...prev];
                        const lastMsg = updated[updated.length - 1];
                        if (lastMsg && lastMsg.role === 'bot' && lastMsg.isStreaming) {
                            updated[updated.length - 1] = {
                                role: 'bot',
                                content: "I'm having trouble connecting to the SaPyBase servers right now. Please try again later or use the contact form.",
                                isStreaming: false,
                                isTyped: false,
                            };
                        } else {
                            updated.push({
                                role: 'bot',
                                content: "I'm having trouble connecting to the SaPyBase servers right now. Please try again later or use the contact form.",
                            });
                        }
                        return updated;
                    });
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
                            <div
                                ref={scrollContainerRef}
                                onScroll={handleScrollContainer}
                                className="flex-1 p-4 overflow-y-auto overscroll-none touch-pan-y flex flex-col gap-5 pt-6 pb-2 relative scroll-smooth custom-scrollbar"
                            >
                                <AnimatePresence initial={false}>
                                    {messages.map((msg, idx) => (
                                        <motion.div
                                            key={idx}
                                            variants={messageVariants}
                                            initial="hidden"
                                            animate="visible"
                                            layout="position"
                                            className={`flex min-w-0 max-w-[96%] sm:max-w-[96%] ${msg.role === 'user' ? 'self-end text-right' : 'self-start text-left'}`}
                                        >
                                            <div className={`flex flex-col max-w-full min-w-0 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                                {msg.role === 'bot' ? (
                                                    <span className="text-md uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 ml-1 leading-none">{BOT_NAME}</span>
                                                ) : (
                                                    <span className="text-md uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 mr-1 leading-none">YOU</span>
                                                )}
                                                <div
                                                    className={`px-4 py-2 min-h-[38px] flex items-center max-w-full break-words ${msg.role === 'user'
                                                        ? 'text-white rounded-2xl rounded-tr-none'
                                                        : 'bg-slate-200 dark:bg-slate-800 text-gray-800 dark:text-slate-200 border border-gray-200/60 dark:border-slate-700/60 rounded-2xl rounded-tl-none overflow-hidden prose prose-compact dark:prose-invert max-w-none prose-p:leading-normal prose-pre:bg-gray-50 dark:prose-pre:bg-slate-900 prose-pre:text-gray-800 dark:prose-pre:text-slate-200 prose-pre:text-sm prose-code:text-sm prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:whitespace-pre-wrap prose-pre:break-words prose-table:block prose-table:overflow-x-auto prose-headings:text-gray-900 dark:prose-headings:text-slate-100 prose-strong:text-gray-900 dark:prose-strong:text-slate-100 prose-ul:my-1 prose-li:my-0 prose-p:font-semibold prose-img:max-w-full prose-img:rounded-lg'
                                                        }`}
                                                    style={msg.role === 'user' ? { backgroundColor: THEME_COLOR } : {}}
                                                >
                                                    {msg.role === 'user' ? (
                                                        <div className="min-w-0 max-w-full whitespace-pre-wrap text-lg font-semibold font-sans leading-relaxed">{msg.content}</div>
                                                    ) : (
                                                        <div className="min-w-0 max-w-full text-lg font-semibold font-sans leading-relaxed">
                                                            <TypewriterContent
                                                                content={msg.content}
                                                                isStreaming={msg.isStreaming}
                                                                isTyped={msg.isTyped}
                                                                onComplete={() => handleTypingComplete(idx)}
                                                                themeColor={THEME_COLOR}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </motion.div>
                                    ))}
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

                                {AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE] && (
                                    <linearGradient id="sapybase-avatar-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                                        <stop offset="0%" stopColor={AVATAR_GRADIENTS[AVATAR_BG_STYLE][0]} />
                                        <stop offset="100%" stopColor={AVATAR_GRADIENTS[AVATAR_BG_STYLE][1]} />
                                    </linearGradient>
                                )}
                            </defs>

                            {/* 1. Base Layer (Solid Color or Dynamic Custom Gradient) */}
                            <path
                                d={FAB_PATH}
                                fill={(AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE]) ? "url(#sapybase-avatar-grad)" : "url(#fab-gradient)"}
                                className={!(AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE]) ? "dark:fill-[url(#fab-gradient-dark)] transition-all duration-500" : "transition-all duration-500"}
                            />

                            {/* 2. Logo Image Layer (Adaptive scaling & clipping) */}
                            {LOGO_URL && (
                                <g clipPath="url(#fab-clip)">
                                    <image
                                        href={LOGO_URL}
                                        x={configData.custom_logo_url ? (fabShape.x || 0) : (15 + (fabShape.x || 0))}
                                        y={configData.custom_logo_url ? (fabShape.y || 0) : (15 + (fabShape.y || 0))}
                                        width={configData.custom_logo_url ? 100 : 70}
                                        height={configData.custom_logo_url ? 100 : 70}
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
                                    fill={(AVATAR_BG_STYLE !== 'none' && AVATAR_GRADIENTS[AVATAR_BG_STYLE]) ? "#ffffff" : THEME_COLOR}
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

// ── Stream-Safe Markdown Sanitizer ────────────────────────────────────────────
// Auto-closes incomplete markdown tags during streaming to prevent layout thrash
function sanitizeStreamMarkdown(text) {
    if (!text) return '';

    let result = text;

    // Count unclosed code fences (```)
    const fenceMatches = result.match(/```/g);
    if (fenceMatches && fenceMatches.length % 2 !== 0) {
        result += '\n```';
    }

    // Count unclosed bold (**) — only outside code fences
    const withoutFences = result.replace(/```[\s\S]*?```/g, '');
    const boldMatches = withoutFences.match(/\*\*/g);
    if (boldMatches && boldMatches.length % 2 !== 0) {
        result += '**';
    }

    // Count unclosed italic (*) — careful not to match ** pairs
    const withoutBold = withoutFences.replace(/\*\*/g, '');
    const italicMatches = withoutBold.match(/\*/g);
    if (italicMatches && italicMatches.length % 2 !== 0) {
        result += '*';
    }

    // Count unclosed inline code (`)
    const inlineCodeMatches = withoutFences.match(/(?<!`)`(?!`)/g);
    if (inlineCodeMatches && inlineCodeMatches.length % 2 !== 0) {
        result += '`';
    }

    return result;
}

// ── TYPEWRITER COMPONENT: Ultra-smooth streaming with cursor & crossfade ──────
const TypewriterContent = ({ content, isStreaming, isTyped, onComplete, themeColor = '#5730F5' }) => {
    const [segments, setSegments] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const lastContent = useRef('');
    const timerRef = useRef(null);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    // Effect for artificial word-by-word typewriter (non-streaming messages only)
    useEffect(() => {
        if (isStreaming || isTyped || !content) {
            setIsTyping(false);
            return;
        }

        if (content !== lastContent.current) {
            lastContent.current = content;
            setSegments([]);
            setIsTyping(true);

            let currentIdx = 0;
            const words = content.split(/(\s+)/);

            const typeNextWord = () => {
                if (currentIdx < words.length) {
                    const word = words[currentIdx];
                    setSegments(prev => [...prev, word]);
                    currentIdx++;
                    if (onComplete) onComplete();
                    const delay = word.length > 5 ? 25 : 15;
                    timerRef.current = setTimeout(typeNextWord, delay);
                } else {
                    setIsTyping(false);
                }
            };

            typeNextWord();
        }
    }, [content, isTyped, isStreaming, onComplete]);

    // ── Streaming: ThinkingLogo crossfade → sanitized markdown + cursor ────────
    if (isStreaming) {
        const hasContent = content && content.length > 0;
        const safeContent = hasContent ? sanitizeStreamMarkdown(content) : '';

        return (
            <div className="relative">
                <AnimatePresence mode="wait">
                    {!hasContent ? (
                        <motion.div
                            key="thinking"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                            className="overflow-hidden"
                        >
                            <ThinkingLogo size={45} className="origin-left" themeColor={themeColor} />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="streaming"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.25, ease: 'easeOut' }}
                        >
                            <ReactMarkdown
                                rehypePlugins={[rehypeSanitize]}
                                components={{
                                    p: ({ node, ...props }) => <p {...props} className="first:mt-0 last:mb-0 mb-2" />,
                                }}
                            >
                                {safeContent}
                            </ReactMarkdown>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // ── Non-streaming: word-by-word typewriter with cursor ─────────────────────
    return (
        <div className="relative">
            <ReactMarkdown
                rehypePlugins={[rehypeSanitize]}
                components={{
                    p: ({ node, ...props }) => <p {...props} className="first:mt-0 last:mb-0 mb-2" />,
                }}
            >
                {isTyping ? segments.join('') : content}
            </ReactMarkdown>
        </div>
    );
};

export default ChatWidget;