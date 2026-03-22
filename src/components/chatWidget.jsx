/* eslint-disable no-unused-vars */
import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreHorizontal, Send, User, ChevronDown, X } from 'lucide-react';
import ThinkingLogo from './thinkLogo';

const ChatWidget = ({ apiKey }) => {
    const config = window.SaPyBaseConfig || {};
    const THEME_COLOR = config.themeColor || '#5730F5';
    const BOT_NAME = config.botName || 'Sapy AI';

    const [isOpen, setIsOpen] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'bot', content: "Hi! I'm the SaPyBase AI Assistant. How can I help you with our engineering services today?" }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);
    const menuRef = useRef(null);

    // Click outside handler for dropdown menu
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

            const response = await fetch('https://sapyai.onrender.com/api/chat', { // Update this to your deployed backend URL later
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
    const LOGO_URL = "https://www.sapybase.com/SB_loading_clean.svg"

    const activeApiKey = apiKey || window.SaPyBaseConfig?.apiKey || import.meta.env?.VITE_SAPYBASE_API_KEY;

    // Completely disable rendering in production if no key is found at all
    if (!activeApiKey && !import.meta.env?.DEV) {
        return null;
    }

    return (
        <div className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-[2147483647] font-sans pointer-events-none" style={{ isolation: 'isolate', width: isOpen ? '100%' : 'auto', height: isOpen ? '100%' : 'auto' }}>
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        variants={windowVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="fixed inset-0 sm:inset-auto sm:bottom-24 sm:right-6 w-full h-dvh sm:w-[480px] sm:h-[600px] bg-white/95 backdrop-blur-2xl sm:rounded-2xl shadow-2xl shadow-purple-900/20 flex flex-col overflow-hidden border-t sm:border border-gray-200/50 z-2147483647 pointer-events-auto origin-bottom-right"
                    >
                        {/* Header */}
                        <div className="bg-white/10 text-slate-900 p-2 pt-[max(env(safe-area-inset-top),0.75rem)] sm:pt-2 flex justify-end items-center shrink-0 relative z-10">
                            <div className="relative flex flex-row justify-between items-center w-full" ref={menuRef}>
                                <p className='font-glook pl-5 font-bold' style={{ color: THEME_COLOR }}>{BOT_NAME}</p>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setShowMenu(!showMenu)}
                                        className="p-2 sm:p-1.5 hover:bg-black/5 rounded-full transition-colors group focus:outline-none"
                                        aria-label="Chat menu"
                                    >
                                        <MoreHorizontal size={24} className="text-slate-500" />
                                    </button>

                                    <button
                                        onClick={() => setIsOpen(false)}
                                        className="p-2 sm:p-1.5 hover:bg-red-50 rounded-full transition-colors group focus:outline-none"
                                        aria-label="Close chat"
                                    >
                                        <X size={24} className="text-red-500 transition-transform group-hover:rotate-90" />
                                    </button>
                                </div>

                                <AnimatePresence>
                                    {showMenu && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                            className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-[2147483647] overflow-hidden"
                                        >
                                            <button
                                                onClick={() => {
                                                    setMessages([{ role: 'bot', content: "Hi! I'm the SaPyBase AI Assistant. How can I help you today?" }]);
                                                    setShowMenu(false);
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                                            >
                                                Clear chat
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 p-4 overflow-y-auto bg-gray-50/50 flex flex-col gap-5 pt-6 pb-2 relative scroll-smooth">
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
                                                <img src={LOGO_URL} alt="SaPyBase AI" className="w-9 h-9 object-contain pointer-events-none" />
                                            )}
                                        </div>

                                        <div
                                            className={`px-4 py-2.5 shadow-sm ${msg.role === 'user'
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

                        {/* Input Area */}
                        <div className="p-2 sm:p-2.5 pb-[max(env(safe-area-inset-bottom),0.5rem)] sm:pb-3 bg-white/95 backdrop-blur-2xl border-t border-gray-200/50 shrink-0 z-10">
                            <form onSubmit={handleSend} className="relative flex items-end gap-2 bg-gray-50 border border-gray-200/80 rounded-xl p-1.5 shadow-sm">
                                <textarea
                                    ref={inputRef}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    placeholder="Ask anything..."
                                    className="flex-1 max-h-32 min-h-[38px] bg-transparent resize-none px-2.5 py-2 focus:outline-none text-sm leading-tight placeholder-gray-400 disabled:opacity-50"
                                    rows={1}
                                    disabled={isLoading}
                                    aria-label="Chat input"
                                />
                                <button
                                    type="submit"
                                    disabled={isLoading || !input.trim()}
                                    aria-label="Send message"
                                    className="p-2 shrink-0 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-0.5"
                                    style={{ backgroundColor: THEME_COLOR }}
                                >
                                    <Send size={16} />
                                </button>
                            </form>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* FAB Trigger Button */}
            <AnimatePresence>
                {!isOpen ? (
                    <motion.div
                        key="open-trigger"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[2147483647] origin-center pointer-events-auto"
                    >
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            onClick={() => setIsOpen(true)}
                            aria-label="Open AI chat assistant"
                            aria-expanded={isOpen}
                            className="relative flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 bg-transparent transition-transform group z-10 focus:outline-none"
                        >
                            <img src={LOGO_URL} alt="SaPyBase" className="w-full h-full relative m-auto z-10 drop-shadow-xl group-hover:drop-shadow-2xl transition-all pointer-events-none" />
                        </motion.button>
                    </motion.div>
                ) : (
                    <motion.div
                        key="close-trigger"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[2147483647] origin-center pointer-events-auto"
                    >
                        <motion.button
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                            onClick={() => setIsOpen(false)}
                            aria-label="Collapse chat"
                            className="hidden sm:flex items-center justify-center w-14 h-14 bg-white text-gray-500 rounded-full shadow-lg hover:bg-gray-50 transition-colors z-10 focus:outline-none border border-gray-100"
                        >
                            <ChevronDown size={28} />
                        </motion.button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ChatWidget;