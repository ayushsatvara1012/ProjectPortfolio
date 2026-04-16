import React from 'react';
import { MoreHorizontal, X, Send, User } from 'lucide-react';
import { useBotSettings } from '../context/BotSettingsContext';
import { BotAvatar } from './LogoCustomizer';

const ASSET_BASE_URL = import.meta.env.DEV ? '' : 'https://www.sapybase.com';

/**
 * BotPreview — High-fidelity replica of the production ChatWidget.jsx
 * Now supports logo_shape and custom_logo_url (v13).
 *
 * @param {Object} props
 * @param {string} props.theme - "light" | "dark"
 */
const BotPreview = ({ theme = 'light' }) => {
    const { botSettings } = useBotSettings();
    const { name, primaryColor, greeting, logoShape, customLogoUrl } = botSettings;

    const BOT_NAME = name || 'Sapy AI';
    const THEME_COLOR = primaryColor || '#5730F5';
    const LOGO_URL = customLogoUrl || `${ASSET_BASE_URL}/SB_loading.svg`;

    const isDark = theme === 'dark';

    return (
        <div className="relative h-full lg:h-full w-full lg:w-full flex items-center justify-center p-2 lg:p-8 transition-all duration-300 bg-transparent">

            {/* ── Main Chatbot Box ── */}
            <div className={`w-full max-w-[440px] h-[600px] flex flex-col rounded-2xl border shadow-2xl overflow-hidden relative z-10 transition-all ${isDark ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>

                {/* ── Header ── */}
                <div className="relative shrink-0">
                    <div
                        className="absolute inset-0 animate-gradient-x opacity-20"
                        style={{
                            background: `linear-gradient(90deg, ${THEME_COLOR}, #f97316, ${THEME_COLOR})`,
                            backgroundSize: '200% 200%'
                        }}
                    />

                    <div className={`backdrop-blur-md px-5 py-4 flex justify-between items-center relative z-10 border-b ${isDark ? 'bg-slate-900/40 text-slate-100 border-slate-800/50' : 'bg-white/40 text-slate-900 border-gray-200/50'}`}>
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                {/* Online indicator */}
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse absolute -left-1 -top-1 z-10" />
                                {/* ── v13: BotAvatar with shape + custom logo ── */}
                                <BotAvatar
                                    shapeId={logoShape || 'circle'}
                                    logoUrl={LOGO_URL}
                                    botName={BOT_NAME}
                                    themeColor={THEME_COLOR}
                                    size="md"
                                />
                            </div>
                            <div className="flex flex-col">
                                <p className="text-xl md:text-2xl font-display font-bold" style={{ color: THEME_COLOR }}>
                                    {BOT_NAME}
                                </p>
                                <span className={`text-sm font-medium italic mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                    Powered by SaPyBase
                                </span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}>
                                <MoreHorizontal size={20} className="text-slate-400" />
                            </button>
                            <button className="p-2 hover:bg-red-50 rounded-full transition-colors group">
                                <X size={20} className="text-red-400 group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Messages ── */}
                <div className={`flex-1 p-5 flex flex-col gap-6 overflow-y-auto ${isDark ? 'bg-slate-950/30' : 'bg-gray-50/30'}`}>
                    {/* Bot Greeting */}
                    <div className="flex gap-3 max-w-[90%] self-start pt-2">
                        <div className="shrink-0 mt-auto mb-1">
                            <BotAvatar
                                shapeId={logoShape || 'circle'}
                                logoUrl={LOGO_URL}
                                botName={BOT_NAME}
                                themeColor={THEME_COLOR}
                                size="sm"
                            />
                        </div>
                        <div className="flex flex-col items-start px-1">
                            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 font-sans mb-1.5 ml-1 leading-none">
                                {BOT_NAME}
                            </span>
                            <div className={`border rounded-2xl rounded-bl-none px-4 py-3 shadow-sm text-base leading-relaxed ${isDark ? 'bg-slate-800 text-slate-200 border-slate-700/60' : 'bg-white text-gray-800 border-gray-200/60'}`}>
                                {greeting || 'Hi! How can I help you today?'}
                            </div>
                        </div>
                    </div>

                    {/* Mock user message */}
                    <div className="flex flex-row-reverse gap-3 max-w-[90%] self-end">
                        <div className="shrink-0 mt-auto mb-1">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-md text-white" style={{ backgroundColor: THEME_COLOR }}>
                                <User size={18} />
                            </div>
                        </div>
                        <div className="flex flex-col items-end px-1">
                            <div className="px-4 py-3 rounded-2xl rounded-br-none shadow-sm text-base leading-relaxed text-white" style={{ backgroundColor: THEME_COLOR }}>
                                Looking good!
                            </div>
                        </div>
                    </div>

                    <div className="flex-1" />
                </div>

                {/* ── Footer ── */}
                <div className={`backdrop-blur-2xl border-t shrink-0 p-4 pt-2 ${isDark ? 'bg-slate-900/95 border-slate-800/50' : 'bg-white/95 border-gray-200/50'}`}>
                    <div className="pb-4 flex gap-2 overflow-x-auto no-scrollbar">
                        {(Array.isArray(botSettings.quickQuestions) ? botSettings.quickQuestions : [])
                            .filter(q => q.label)
                            .map((q, idx) => (
                                <button
                                    key={idx}
                                    className={`shrink-0 px-4 py-2 border text-[10px] uppercase tracking-widest font-bold font-sans rounded-full transition-all active:scale-95 whitespace-nowrap shadow-sm ${isDark ? 'bg-slate-800 hover:opacity-80' : 'bg-white hover:opacity-80'}`}
                                    style={{
                                        borderColor: `${THEME_COLOR}30`,
                                        color: THEME_COLOR
                                    }}
                                >
                                    {q.label}
                                </button>
                            ))}
                    </div>
                    <div className={`flex items-center gap-2 border rounded-xl px-4 py-2.5 shadow-xs ${isDark ? 'bg-slate-950 border-slate-800/60' : 'bg-[#FAFAFA] border-gray-200/60'}`}>
                        <input
                            readOnly
                            placeholder="Ask anything..."
                            className={`flex-1 bg-transparent text-base leading-relaxed focus:outline-none py-1.5 ${isDark ? 'text-slate-300 placeholder-slate-500' : 'text-slate-600 placeholder-gray-400'}`}
                        />
                        <button className="p-2 rounded-lg transition-all group">
                            <Send size={18} className="group-hover:scale-110 transition-transform" style={{ color: THEME_COLOR }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Subtle grid background */}
            <div
                className="absolute inset-0 opacity-[0.03] pointer-events-none"
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }}
            />
        </div>
    );
};

export default BotPreview;
