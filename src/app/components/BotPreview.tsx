'use client';

import React from 'react';
import Image from 'next/image';
import { MoreHorizontal, X, Send } from 'lucide-react';
import { useBotSettings } from '@/src/lib/context/BotSettingsContext';
import { BotAvatar } from './LogoCustomizer';

const IS_DEV = process.env.NODE_ENV === 'development';
const ASSET_BASE_URL = IS_DEV ? '' : 'https://www.sapybase.com';
const BrandLogo = `${ASSET_BASE_URL}/vaayu_logo.svg`;

// Mirrors HUB_ICON in ChatWidget.tsx (Tabler card icon -> material-symbols) so the
// preview's hub looks like the real widget.
const HUB_ICON: Record<string, string> = {
  'file-certificate': 'description',
  flask: 'science',
  'message-circle': 'forum',
  receipt: 'receipt_long',
  package: 'package_2',
};

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
    hideBranding,
    vertical,
    hubCards,
    sampleForm,
  } = botSettings;

  const BOT_NAME = name || 'Sapy AI';
  const THEME_COLOR = primaryColor || '#5730F5';
  const LOGO_URL = customLogoUrl || '';

  const isDark = theme === 'dark';

  const quickQs = (Array.isArray(quickQuestions) ? quickQuestions : []).filter(Boolean);

  // Phase 5 — a vertical (pack) bot opens on a HUB home screen, not a bare chat.
  // The preview mirrors that so the owner sees their real widget while customising.
  const cards = Array.isArray(hubCards) ? hubCards : [];
  const formFields = Array.isArray(sampleForm) ? sampleForm : [];
  const showHub = !!vertical && cards.length > 0;

  return (
    <div className="relative h-full w-full flex items-center justify-center p-2 md:p-4 lg:p-8 transition-all duration-300 bg-transparent">
      {/* ── Main Chatbot Box ── */}
      <div className={`w-full max-w-[95vw] sm:max-w-[500px] h-[60vh] sm:h-[650px] flex flex-col rounded-2xl border shadow-2xl overflow-hidden relative z-10 transition-all ${isDark ? 'bg-slate-900/95 border-slate-800' : 'bg-white/95 border-slate-200'}`} style={{ '--sapy-theme': THEME_COLOR } as React.CSSProperties}>
        
        {/* ── Header (mirrors the live ChatWidget top nav exactly) ── */}
        <div className={`relative shrink-0 ${isDark ? 'bg-slate-950/50' : 'bg-gray-50/50'}`}>
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
                  transparentBgImage={true}
                />
                <div className="flex items-center pl-1">
                  <p className={`text-[15px] font-google font-medium leading-none ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                    {BOT_NAME}
                  </p>
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
        <div className={`flex-1 p-5 flex flex-col overflow-y-auto ${showHub ? 'gap-4 bg-gradient-to-b from-[var(--sapy-theme)]/[0.06] via-[var(--sapy-theme)]/[0.02] to-transparent' : 'gap-6'} ${isDark ? 'bg-slate-950/50' : 'bg-gray-50/50'}`}
          style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 28px), transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 20px, black calc(100% - 28px), transparent)' }}>

          {showHub ? (
            <>
              {/* Hub home — greeting + pack action GRID (mirrors the live widget) */}
              <p className={`text-[19px] font-google font-semibold leading-snug pt-1 ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                {greeting || 'How can we help you today?'}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {cards.map((card, i) => {
                  const oddLast = cards.length % 2 === 1 && i === cards.length - 1;
                  return (
                    <div
                      key={card.id}
                      className={`${oddLast ? 'col-span-2' : ''} flex flex-col items-center justify-center text-center gap-2 rounded-2xl border px-3 py-5 transition-colors ${isDark ? 'bg-slate-900/70 border-slate-800' : 'bg-white border-slate-200'}`}
                    >
                      <span className="material-symbols-outlined text-[26px] leading-none" style={{ color: THEME_COLOR }} aria-hidden>
                        {HUB_ICON[card.icon] || 'bolt'}
                      </span>
                      <p className={`text-[13.5px] font-google font-medium leading-tight ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{card.label}</p>
                      {card.subtitle && (
                        <p className={`text-[11.5px] font-google leading-snug ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{card.subtitle}</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Live sample-form preview — reflects the field editor as the owner types */}
              {formFields.length > 0 && (
                <div className={`mt-1 rounded-2xl border p-3.5 ${isDark ? 'bg-slate-900/40 border-slate-800' : 'bg-white/70 border-slate-200'}`}>
                  <p className={`text-[11px] font-google font-semibold uppercase tracking-wide mb-2 ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>Sample request form</p>
                  <div className="flex flex-col gap-2">
                    {formFields.slice(0, 8).map((f, i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <span className={`text-[11.5px] font-google ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                          {f.label || 'Untitled field'}{f.required && <span className="text-red-500"> *</span>}
                        </span>
                        <div className={`h-7 rounded-lg border ${isDark ? 'border-slate-700 bg-slate-950/40' : 'border-slate-200 bg-slate-50'}`} />
                      </div>
                    ))}
                    {formFields.length > 8 && (
                      <span className={`text-[11px] font-google ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>+{formFields.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}
              <div className="flex-1" />
            </>
          ) : (
            <>
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
                <div className="max-w-[85%] px-4 py-2.5 rounded-[20px] bg-slate-100 dark:bg-white/[0.04] text-slate-800 dark:text-slate-200">
                  <p className="text-sm leading-relaxed">Looking good!</p>
                </div>
              </div>

              <div className="flex-1" />
            </>
          )}
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
        <div className={`p-4 shrink-0 z-10 flex flex-col ${isDark ? 'bg-slate-950/50' : 'bg-gray-50/50'}`}>
          {showHub && (
            <div className={`flex items-center gap-1 p-1 mb-3 rounded-full self-center ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
              {[['Home', 'home', true], ['Chat', 'forum', false]].map(([label, icon, active]) => (
                <span
                  key={label as string}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12.5px] font-google font-medium transition-colors ${active ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                  <span className="material-symbols-outlined text-[15px]">{icon as string}</span>
                  {label as string}
                </span>
              ))}
            </div>
          )}
          {!showHub && quickQs.length > 0 && (
            <div className="flex flex-col items-start gap-2 pb-3.5">
              {quickQs.slice(0, 3).map((label, idx) => (
                <button
                  key={idx}
                  className="px-4 py-2.5 min-h-[40px] rounded-full text-[14px] font-normal font-google transition-all max-w-full text-left break-words bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/60 dark:border-slate-800/80 shadow-sm hover:text-[var(--sapy-theme)] dark:hover:text-[var(--sapy-theme)] hover:border-slate-300 dark:hover:border-slate-700 hover:shadow"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
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
