'use client';

import React from 'react';
import Image from 'next/image';
import { MoreHorizontal, X, Send } from 'lucide-react';
import { useBotSettings } from '@/src/lib/context/BotSettingsContext';
import { BotAvatar } from './LogoCustomizer';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE_URL = IS_DEV ? '' : 'https://www.sapybase.com';
const BrandLogo = `${ASSET_BASE_URL}/vaayu_logo.svg`;

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
        
        {/* ── Header (mirrors the live ChatWidget top nav exactly) ── */}
        <div className={`relative shrink-0 border-b ${isDark ? 'bg-slate-900 border-slate-800/80' : 'bg-white border-slate-200/70'}`}>
          <div className={`p-2 flex justify-end items-center relative ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
            <div className="relative flex flex-row justify-between items-center w-full">
              {/* Left: Avatar + Name — avatar is always a circle, no shadow */}
              <div className="relative flex items-center gap-3 pl-2">
                <BotAvatar
                  shapeId="circle"
                  logoUrl={LOGO_URL}
                  botName={BOT_NAME}
                  themeColor={THEME_COLOR}
                  size="md"
                  hasShadow={false}
                  bgStyle={avatarBgStyle || 'none'}
                  isCustom={!!customLogoUrl}
                />
                <div className="flex flex-col gap-1.5">
                  <p className={`text-[15px] font-google font-medium leading-none ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {BOT_NAME}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    <span className={`text-xs font-google leading-none ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Active now</span>
                  </div>
                </div>
              </div>
              {/* Right: Action buttons */}
              <div className="flex items-center gap-1">
                <button className={`p-2 rounded-full transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}>
                  <MoreHorizontal size={22} className={isDark ? 'text-slate-400' : 'text-slate-500'} />
                </button>
                <button className={`p-2 rounded-full transition-colors group ${isDark ? 'hover:bg-red-950/30' : 'hover:bg-red-50'}`}>
                  <X size={22} className={`${isDark ? 'text-slate-500 group-hover:text-red-400' : 'text-slate-400 group-hover:text-red-500'} transition-colors`} />
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
              <Image src={BrandLogo} alt="Vaayu" width={20} height={13} className="opacity-60" />
              Vaayu Intelligence
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
