'use client';

import React from 'react';
import Image from 'next/image';
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
  const LOGO_URL = customLogoUrl || '';

  const isDark = theme === 'dark';

  const quickQs = (Array.isArray(quickQuestions) ? quickQuestions : []).filter(Boolean);

  return (
    <div className="relative h-full w-full flex items-center justify-center p-2 md:p-4 lg:p-8 transition-all duration-300 bg-transparent">
      {/* ── Main Chatbot Box ── */}
      <div className={`w-full max-w-[95vw] sm:max-w-[480px] h-[60vh] sm:h-[600px] flex flex-col rounded-2xl border shadow-2xl overflow-hidden relative z-10 transition-all ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`}>
        
        {/* ── Header ── */}
        <div className="relative shrink-0">
          <div
            className="absolute inset-0 animate-gradient-x opacity-20"
            style={{
              backgroundImage: `linear-gradient(90deg, ${THEME_COLOR}, #f97316, ${THEME_COLOR})`,
              backgroundSize: '200% 200%'
            }}
          />
          <div className={`backdrop-blur-md p-2 flex justify-end items-center relative z-10 border-b ${isDark ? 'bg-slate-900/40 text-slate-100 border-slate-800/50' : 'bg-white/40 text-slate-900 border-gray-200/50'}`}>
            <div className="relative flex flex-row justify-between items-center w-full">
              {/* Left: Avatar + Name */}
              <div className="relative flex items-center gap-3 pl-3">
                <div className="relative inline-flex shrink-0">
                  <BotAvatar
                    shapeId={logoShape || 'circle'}
                    logoUrl={LOGO_URL}
                    botName={BOT_NAME}
                    themeColor={THEME_COLOR}
                    size="md"
                    bgStyle={avatarBgStyle || 'none'}
                    isCustom={!!customLogoUrl}
                  />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse z-10" />
                </div>
                <div>
                  <p className="text-sm font-semibold font-google leading-tight text-slate-800 dark:text-slate-100">
                    {BOT_NAME}
                  </p>
                  <p className="text-[10px] text-slate-450 dark:text-slate-500 font-google">Online</p>
                </div>
              </div>
              {/* Right: Action buttons */}
              <div className="flex items-center gap-1">
                <button className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                  <MoreHorizontal size={20} className="text-slate-400" />
                </button>
                <button className="p-2 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-full transition-colors group">
                  <X size={20} className="text-red-500 group-hover:rotate-90 transition-transform" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Messages Area ── */}
        <div className={`flex-1 p-5 flex flex-col gap-6 overflow-y-auto ${isDark ? 'bg-slate-950/50' : 'bg-gray-50/50'}`}>
          
          {/* Bot greeting */}
          <div className="flex gap-3 justify-start items-start w-full">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 mt-1 shadow-sm" style={{ backgroundColor: THEME_COLOR }}>
              {BOT_NAME.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col max-w-[80%] items-start">
              <div className={`text-sm leading-relaxed ${isDark ? 'text-slate-200' : 'text-slate-800'}`}>
                {greeting || 'Hi! How can I help you today?'}
              </div>
            </div>
          </div>

          {/* Mock user message */}
          <div className="flex gap-3 justify-end w-full">
            <div className="max-w-[80%] px-5 py-3 rounded-2xl bg-slate-100 dark:bg-white/[0.04] text-slate-800 dark:text-slate-200">
              <p className="text-sm leading-relaxed">Looking good!</p>
            </div>
          </div>

          {/* Quick Questions */}
          {quickQs.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2 justify-start">
              {quickQs.slice(0, 2).map((label, idx) => (
                <button
                  key={idx}
                  className={`text-xs px-3.5 py-1.5 rounded-full border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 bg-white dark:bg-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-all truncate max-w-[180px] font-google`}
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
          <div className={`shrink-0 py-1.5 flex justify-center items-center border-t border-slate-100/10 ${isDark ? 'bg-slate-950/80' : 'bg-gray-50/80'}`}>
            <span className={`flex items-center gap-1.5 text-[9px] font-sans font-bold uppercase tracking-[0.2em] ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              <Image src={BrandLogo} alt="Sapybase" width={20} height={20} className="grayscale opacity-50" />
              Powered by Sapybase
            </span>
          </div>
        )}

        {/* ── Input Area ── */}
        <div className={`p-4 shrink-0 z-10 flex flex-col border-t ${isDark ? 'bg-slate-900 border-slate-800/60' : 'bg-[#f8f9fa] border-slate-150'}`}>
          <div className="w-full">
            <div className="flex items-center gap-2 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-slate-800/80 rounded-full pl-5 pr-2 py-0.5 shadow-sm">
              <input
                readOnly
                placeholder="Ask anything..."
                className={`flex-1 bg-transparent py-2.5 text-sm focus:outline-none font-medium ${isDark ? 'text-slate-100 placeholder-slate-500' : 'text-slate-900 placeholder-gray-400'}`}
              />
              <button className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-white/[0.04] transition-colors flex items-center justify-center shrink-0">
                <Send size={14} style={{ color: THEME_COLOR }} />
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
