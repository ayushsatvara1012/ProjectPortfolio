'use client';

import React from 'react';
import { MoreHorizontal, X, Send } from 'lucide-react';
import { useBotSettings } from '@/src/lib/context/BotSettingsContext';
import { BotAvatar } from './LogoCustomizer';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE_URL = IS_DEV ? '' : 'https://www.sapybase.com';
const BrandLogo = `${ASSET_BASE_URL}/SB_loading.svg`;

type BotPreviewProps = {
  theme?: 'light' | 'dark';
};

const BotPreview = ({ theme = 'light' }: BotPreviewProps) => {
  const { botSettings } = useBotSettings();
  const {
    name,
    primaryColor,
    greeting,
    logoShape,
    customLogoUrl,
    avatarBgStyle,
    quickQuestions,
    hideBranding
  } = botSettings;

  const BOT_NAME = name || 'Sapy AI';
  const THEME_COLOR = primaryColor || '#5730F5';
  const LOGO_URL = customLogoUrl || `${ASSET_BASE_URL}/SB_loading.svg`;

  const isDark = theme === 'dark';

  const quickQs = (Array.isArray(quickQuestions) ? quickQuestions : []).filter(Boolean);

  return (
    <div className="relative h-full w-full flex items-center justify-center p-2 lg:p-8 transition-all duration-300 bg-transparent">
      {/* ── Main Chatbot Box ── */}
      <div className={`w-full max-w-[440px] h-[600px] flex flex-col rounded-2xl border shadow-2xl overflow-hidden relative z-10 transition-all ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        {/* ── Header ── */}
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 animate-gradient-x opacity-20"
            style={{
              background: `linear-gradient(90deg, ${THEME_COLOR}, #f97316, ${THEME_COLOR})`,
              backgroundSize: '200% 200%'
            }}
          />
          <div className={`backdrop-blur-md p-2 flex justify-end items-center relative z-10 border-b ${isDark ? 'bg-slate-900/40 text-slate-100 border-slate-800/50' : 'bg-white/40 text-slate-900 border-gray-200/50'}`}>
            <div className="relative flex flex-row justify-between items-center w-full">
              {/* Left: Avatar + Name */}
              <div className="relative flex items-center gap-3 pl-4">
                <div className="relative">
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-white animate-pulse z-10" />
                  <BotAvatar
                    shapeId={logoShape || 'circle'}
                    logoUrl={LOGO_URL}
                    botName={BOT_NAME}
                    themeColor={THEME_COLOR}
                    size="md"
                    bgStyle={avatarBgStyle || 'none'}
                  />
                </div>
                <div className="flex flex-row items-center justify-center">
                  <p className="text-lg font-display font-bold" style={{ color: THEME_COLOR }}>
                    {BOT_NAME}
                  </p>
                </div>
              </div>
              {/* Right: Action buttons */}
              <div className="flex items-center gap-1">
                <button className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                  <MoreHorizontal size={22} className="text-slate-500" />
                </button>
                <button className="p-2 hover:bg-red-50 rounded-full transition-colors group">
                  <X size={22} className="text-red-500 group-hover:rotate-90 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Messages Area ── */}
        <div className={`flex-1 p-4 flex flex-col gap-5 overflow-y-auto pt-6 pb-2 ${isDark ? 'bg-slate-950/50' : 'bg-gray-50/50'}`}>
          {/* Bot greeting */}
          <div className="flex max-w-[96%] self-start text-left">
            <div className="flex flex-col max-w-full min-w-0 items-start">
              <span className={`text-md uppercase tracking-widest font-bold font-sans mb-1.5 ml-1 leading-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                {BOT_NAME}
              </span>
              <div className={`px-4 py-2 min-h-[38px] flex items-center rounded-2xl rounded-tl-none border text-sm font-google leading-relaxed ${isDark ? 'bg-slate-800 text-slate-200 border-slate-700/60' : 'bg-slate-100 text-gray-800 border-gray-200/60'}`}>
                {greeting || 'Hi! How can I help you today?'}
              </div>
            </div>
          </div>

          {/* Mock user message */}
          <div className="flex max-w-[96%] self-end text-right">
            <div className="flex flex-col max-w-full min-w-0 items-end">
              <span className={`text-md uppercase tracking-widest font-bold font-sans mb-1.5 mr-1 leading-none ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                YOU
              </span>
              <div
                className="px-4 py-2 min-h-[38px] flex items-center rounded-2xl rounded-tr-none text-white text-sm font-google leading-relaxed"
                style={{ backgroundColor: THEME_COLOR }}
              >
                Looking good!
              </div>
            </div>
          </div>

          {/* Quick Questions */}
          {quickQs.length > 0 && (
            <div className="flex flex-col items-end gap-2 px-3 pb-2 pt-1">
              {quickQs.map((label, idx) => (
                <button
                  key={idx}
                  className={`px-4 py-2.5 border rounded-md text-md font-regular font-google whitespace-nowrap ${isDark ? 'bg-slate-900 border-slate-700 text-slate-200' : 'bg-slate-50 border-slate-200 text-slate-800'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1" />
        </div>

        {/* ── Branding Strip ── */}
        {!hideBranding && (
          <div className={`shrink-0 py-1.5 flex justify-center items-center backdrop-blur-sm ${isDark ? 'bg-slate-950/80' : 'bg-gray-50/80'}`}>
            <span className={`flex items-center gap-1.5 text-[9px] font-sans font-bold uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <img src={BrandLogo} alt="SaPyBase" className="w-5 h-5 grayscale opacity-50" />
              Powered by SaPyBase
            </span>
          </div>
        )}

        {/* ── Input Area ── */}
        <div className={`backdrop-blur-2xl border-t shrink-0 z-10 flex flex-col ${isDark ? 'bg-slate-900/95 border-slate-800/50' : 'bg-white/95 border-gray-200/50'}`}>
          <div className="p-2 w-full">
            <div className="relative flex items-center gap-2 pb-1">
              <input
                readOnly
                placeholder="Ask anything..."
                className={`flex-1 min-h-[40px] bg-transparent px-2.5 py-[9px] focus:outline-none leading-relaxed text-xl font-medium font-sans ${isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-900 placeholder-gray-400'}`}
              />
              <button className="p-2 shrink-0 rounded-lg transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center">
                <Send size={15} style={{ color: THEME_COLOR }} />
              </button>
            </div>
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
