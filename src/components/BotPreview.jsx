import React from 'react';
import { MoreHorizontal, X, Send, User } from 'lucide-react';
import { useBotSettings } from '../context/BotSettingsContext';

const ASSET_BASE_URL = import.meta.env.DEV ? '' : 'https://www.sapybase.com';

/**
 * BotPreview — High-fidelity replica of the production ChatWidget.jsx
 * Perfectly synced visuals: gradient headers, backdrop-blur, and bubble geometry.
 * Designed to fit flush in a docked grid cell.
 */
const BotPreview = () => {
    const { botSettings } = useBotSettings();
    const { name, primaryColor, greeting } = botSettings;

    const BOT_NAME = name || 'Sapy AI';
    const THEME_COLOR = primaryColor || '#5730F5';
    const LOGO_URL = `${ASSET_BASE_URL}/SB_loading_clean.svg`;

    return (
        <div className="relative h-full w-full bg-[#FAFAFA] flex items-center justify-center p-8 overflow-hidden">
            
            {/* ── Main Chatbot Box (Rounded Contained Look from Sketch) ── */}
            <div className="w-full max-w-[440px] h-[600px] flex flex-col bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden relative z-10 transition-all">
                
                {/* ── Header ────────────────────────────────────────────── */}
                <div className="relative shrink-0">
                    <div 
                        className="absolute inset-0 animate-gradient-x opacity-20" 
                        style={{ 
                            background: `linear-gradient(90deg, ${THEME_COLOR}, #f97316, ${THEME_COLOR})`,
                            backgroundSize: '200% 200%' 
                        }} 
                    />

                    <div className="bg-white/40 backdrop-blur-md text-slate-900 px-5 py-4 flex justify-between items-center relative z-10 border-b border-gray-200/50">
                        <div className="flex items-center gap-3">
                            <div className="relative text-white">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse absolute -left-1 -top-1" />
                                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm">
                                    <img src={LOGO_URL} alt="bot" className="w-7 h-7 object-contain" />
                                </div>
                            </div>
                            <div className="flex flex-col">
                                <p className="font-bold text-base leading-none tracking-tight" style={{ color: THEME_COLOR }}>{BOT_NAME}</p>
                                <span className="text-[10px] italic text-slate-500 mt-1">Powered by SaPyBase</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button className="p-2 hover:bg-black/5 rounded-full transition-colors">
                                <MoreHorizontal size={20} className="text-slate-400" />
                            </button>
                            <button className="p-2 hover:bg-red-50 rounded-full transition-colors group">
                                <X size={20} className="text-red-400 group-hover:rotate-90 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* ── Messages ──────────────────────────────────────────── */}
                <div className="flex-1 p-5 bg-gray-50/30 flex flex-col gap-6 overflow-y-auto">
                    {/* Bot Greeting */}
                    <div className="flex gap-3 max-w-[90%] self-start pt-2">
                        <div className="shrink-0 mt-auto mb-1">
                            <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm">
                                <img src={LOGO_URL} alt={BOT_NAME} className="w-6 h-6 object-contain" />
                            </div>
                        </div>
                        <div className="flex flex-col items-start px-1">
                            <span className="text-[10px] font-bold text-slate-400 mb-1.5 ml-1 uppercase tracking-widest leading-none">
                                {BOT_NAME}
                            </span>
                            <div className="bg-white text-gray-800 border border-gray-200/60 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm text-sm leading-relaxed">
                                {greeting || 'Hi! How can I help you today?'}
                            </div>
                        </div>
                    </div>

                    {/* User Mock Message */}
                    <div className="flex flex-row-reverse gap-3 max-w-[90%] self-end">
                        <div className="shrink-0 mt-auto mb-1">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-md text-white" style={{ backgroundColor: THEME_COLOR }}>
                                <User size={18} />
                            </div>
                        </div>
                        <div className="flex flex-col items-end px-1">
                            <div className="px-4 py-3 rounded-2xl rounded-br-none shadow-sm text-sm text-white" style={{ backgroundColor: THEME_COLOR }}>
                                Looking good!
                            </div>
                        </div>
                    </div>

                    <div className="flex-1" />
                </div>

                {/* ── Footer ────────────────────────────────────────────── */}
                <div className="bg-white/95 backdrop-blur-2xl border-t border-gray-200/50 shrink-0 p-4 pt-2">
                    <div className="pb-4 flex gap-2 overflow-x-auto no-scrollbar">
                        {['Pricing', 'Integration', 'Support'].map(q => (
                            <button key={q}
                                className="shrink-0 px-4 py-2 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-100 text-indigo-700 text-[11px] font-bold rounded-full transition-all active:scale-95 whitespace-nowrap"
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 bg-[#FAFAFA] border border-gray-200/60 rounded-xl px-4 py-2.5 shadow-xs">
                        <input
                            readOnly
                            placeholder="Ask anything..."
                            className="flex-1 bg-transparent text-sm text-slate-600 placeholder-gray-400 focus:outline-none py-1.5"
                        />
                        <button className="p-2 rounded-lg transition-all group">
                            <Send size={18} className="group-hover:scale-110 transition-transform" style={{ color: THEME_COLOR }} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Subtle Grid Background for workspace feel */}
            <div 
                className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '24px 24px' }} 
            />
        </div>
    );
};

export default BotPreview;
