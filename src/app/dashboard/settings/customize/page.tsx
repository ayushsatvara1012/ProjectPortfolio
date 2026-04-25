'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useBotSettings } from '@/src/lib/context/BotSettingsContext';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch } from '@/src/lib/hooks/useAuthenticatedFetch';
import LogoCustomizer from '@/src/app/components/LogoCustomizer';
import BotPreview from '@/src/app/components/BotPreview';
import Alert from '@/src/app/components/Alert';

const inputCls = "w-full text-md font-medium font-google px-3 py-2.5 bg-transparent border border-gray-300 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 focus:border-slate-400 dark:focus:border-blue-400 text-slate-900 dark:text-slate-200 transition-colors rounded-sm";
const labelCls = "block text-lg font-semibold font-google text-slate-600 dark:text-slate-400 mb-1.5 transition-colors";
const headingCls = "text-xl font-medium font-google mb-4 transition-colors text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-600 dark:from-blue-400 dark:to-green-500";

export default function CustomizePage() {
  const { botSettings, updateSetting, saveSettings, fetchSettings, isSaving, isLoading } = useBotSettings();
  const { userTier, userRole } = useUserRole();
  const authFetch = useAuthenticatedFetch();
  const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'warning', msg: '' });

  const searchParams = useSearchParams();
  const editBotId = searchParams.get('edit');

  // Bot Selection
  const [selectedBotId, setSelectedBotId] = useState(editBotId || '');
  const { data: botsData } = useQuery({
    queryKey: ['bots'],
    queryFn: () => authFetch('/api/companies') as Promise<any>,
  });
  const bots = botsData?.bots || [];

  useEffect(() => {
    if (bots.length > 0 && !selectedBotId) {
      if (editBotId && bots.some((b: any) => b.id === editBotId)) {
        setSelectedBotId(editBotId);
      } else {
        setSelectedBotId(bots[0].id);
      }
    } else if (bots.length > 0 && selectedBotId && editBotId && selectedBotId !== editBotId) {
      if (bots.some((b: any) => b.id === editBotId)) {
        setSelectedBotId(editBotId);
      }
    }
  }, [bots, selectedBotId, editBotId]);

  useEffect(() => {
    if (selectedBotId) {
      fetchSettings(selectedBotId);
    }
  }, [selectedBotId, fetchSettings]);

  // Theme toggle for preview
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isGlobalDark = document.documentElement.classList.contains('dark');
    setIsDark(isSystemDark || isGlobalDark);
  }, []);

  // Tier guards
  const isTotallyLocked = !userTier || userTier === 'null';
  const isFree = userTier === 'FREE';
  const isBasic = userTier === 'BASIC';
  const isAdvancedLocked = (isFree || isBasic) && userRole !== 'SUPER_ADMIN';
  const showFullOverlay = (isTotallyLocked || isFree) && userRole !== 'SUPER_ADMIN';

  // White-label = STARTER, PRO, BUSINESS, ENTERPRISE, CUSTOM, or SUPER_ADMIN
  const isWhiteLabelUser = !isFree && !isBasic && !!userTier && userTier !== 'null';
  const canHideBranding = isWhiteLabelUser || userRole === 'SUPER_ADMIN';

  // Pro user = PRO, BUSINESS, ENTERPRISE, or SUPER_ADMIN
  const isProUser = ['PRO', 'BUSINESS', 'ENTERPRISE'].includes(userTier || '') || userRole === 'SUPER_ADMIN';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[#E8EBF0] dark:bg-slate-900 transition-colors duration-500 min-h-[calc(100vh-3rem)]">
      {/* ── LEFT: Settings Form ── */}
      <div className="bg-white dark:bg-slate-950 flex flex-col relative transition-colors">
        <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 shrink-0 transition-colors">
          <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-0.5 transition-colors">Customize</h2>
          <p className="text-md font-display text-slate-500 dark:text-slate-500 leading-relaxed transition-colors">Configure your bot's visual identity. Changes reflect instantly in the preview.</p>
        </div>

        <div className={`p-8 relative ${showFullOverlay ? 'overflow-hidden select-none' : 'overflow-y-auto custom-scrollbar'} lg:max-h-[calc(100vh-9.5rem)]`}>
          {showFullOverlay && (
            <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border-t border-gray-100 dark:border-slate-800 transition-colors cursor-help">
              <span className="material-symbols-outlined text-[32px] text-slate-500 dark:text-slate-500 mb-4 transition-colors">lock</span>
              <h3 className="text-md font-display uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 mb-2 transition-colors">Upgrade Required</h3>
              <p className="text-md font-display text-slate-500 dark:text-slate-500 leading-relaxed max-w-[260px] mb-6 transition-colors">Customizing your bot's visual identity requires an active subscription.</p>
              <Link href="/dashboard/pricing" className="px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white text-md font-display uppercase tracking-widest font-bold hover:opacity-90 transition-all shadow-sm">
                View Plans
              </Link>
            </div>
          )}

          {userRole === 'SUPER_ADMIN' && (
            <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 transition-colors">
              <p className={headingCls + ' text-amber-700! dark:text-amber-500! mb-2'}>Admin: Model Engine Override</p>
              <div>
                <label className={labelCls + ' text-amber-600! dark:text-amber-400!'}>Select Model Engine</label>
                <select
                  value={botSettings.aiModel}
                  onChange={e => updateSetting('aiModel', e.target.value)}
                  className={inputCls + ' bg-white! dark:bg-slate-950! border-amber-200! dark:border-amber-900/50!'}
                >
                  <option value="">Default (Auto / Tier-based)</option>
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (Max Speed)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Balanced Thinking)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Standard Reasoning)</option>
                  <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Next-Gen Preview)</option>
                </select>
              </div>
            </div>
          )}

          {bots.length > 1 && (
            <div className="mb-8 p-6 bg-[#FAFAFA] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 transition-colors shadow-sm">
              <div className="flex items-center justify-center gap-2 mb-4">
                <span className="material-symbols-outlined text-[14px] text-slate-500 dark:text-slate-500">smart_toy</span>
                <p className={headingCls + ' flex items-center mb-0'}>Select your Bot</p>
              </div>
              <div className="relative">
                <select
                  value={selectedBotId}
                  onChange={e => setSelectedBotId(e.target.value)}
                  className={inputCls + " appearance-none pr-10"}
                >
                  {bots.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.bot_name || 'Unnamed Bot'} — {b.company_name}
                    </option>
                  ))}
                </select>
                <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-500 pointer-events-none">expand_more</span>
              </div>
            </div>
          )}

          <div className={`space-y-8 ${showFullOverlay || isLoading ? 'opacity-30 pointer-events-none' : ''}`}>
            {/* ── Section: Bot Appearance ── */}
            <div className="space-y-6">
              <p className={headingCls + ' flex items-center'}>
                <span className="material-symbols-outlined inline text-[14px] mr-1.5 text-slate-500 dark:text-slate-500 transition-colors">palette</span>
                Bot Appearance
              </p>
              <div>
                <label className={labelCls}>Bot Name</label>
                <input
                  type="text"
                  value={botSettings.name}
                  onChange={e => updateSetting('name', e.target.value)}
                  className={inputCls}
                  placeholder="SaPyBase AI"
                />
              </div>
              <div>
                <label className={labelCls}>Greeting Message</label>
                <input
                  type="text"
                  value={botSettings.greeting}
                  onChange={e => updateSetting('greeting', e.target.value)}
                  className={inputCls}
                  placeholder="Hi! How can I help you today?"
                />
              </div>

              <div className="relative">
                <div className={`flex items-start justify-between gap-4 p-4 border transition-colors ${canHideBranding ? 'border-gray-200 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900' : 'border-gray-100 dark:border-slate-800/50 bg-gray-50 dark:bg-slate-900/40 opacity-50'}`}>
                  <div className="min-w-0">
                    <p className="text-md font-semibold font-google text-slate-800 dark:text-slate-200 transition-colors">
                      Remove "Powered by SaPyBase" branding
                    </p>
                    <p className="text-[11px] font-google text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                      {canHideBranding ? 'Hide the SaPyBase footer from your widget.' : 'Available on Starter plan and above.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => canHideBranding && updateSetting('hideBranding', !botSettings.hideBranding)}
                    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${botSettings.hideBranding && canHideBranding ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${botSettings.hideBranding && canHideBranding ? 'translate-x-5' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800 transition-colors" />

            <div className="space-y-4">
              <p className={headingCls + ' flex items-center'}>
                <span className="material-symbols-outlined inline text-[14px] mr-1.5 text-slate-500 dark:text-slate-500 transition-colors">image</span>
                Logo & Avatar Shape
              </p>
              <LogoCustomizer
                logoShape={botSettings.logoShape || 'circle'}
                customLogoUrl={botSettings.customLogoUrl || ''}
                primaryColor={botSettings.primaryColor || '#5730F5'}
                botName={botSettings.name || 'S'}
                isProUser={isProUser}
                avatarBgStyle={botSettings.avatarBgStyle || 'none'}
                onShapeChange={(shapeId) => updateSetting('logoShape', shapeId)}
                onUrlChange={(url) => updateSetting('customLogoUrl', url)}
                onBgStyleChange={(styleId) => updateSetting('avatarBgStyle', styleId)}
                onPrimaryColorChange={(val) => updateSetting('primaryColor', val)}
              />
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800 transition-colors" />

            <div className="space-y-6 relative">
              {isAdvancedLocked && (
                <div className="absolute -inset-4 z-40 bg-white/40 dark:bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center group cursor-help transition-all hover:backdrop-blur-sm">
                  <div className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-green-600 text-white text-sm uppercase tracking-widest font-bold font-sans shadow-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">lock</span> Starter or Pro Required
                  </div>
                  <Link href="/dashboard/pricing" className="mt-2 text-md font-bold text-slate-800 dark:text-slate-200 underline underline-offset-4 decoration-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Upgrade Now</Link>
                </div>
              )}

              <div className={isAdvancedLocked ? 'opacity-40 grayscale-[0.5] pointer-events-none filter blur-[0.5px]' : ''}>
                <div className="mb-6">
                  <label className={labelCls}>Company Tone</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['Professional', 'Friendly', 'Humorous', 'Technical', 'Concise'].map(tone => (
                      <label key={tone} className="flex items-center gap-2 p-3 border border-gray-100 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900 cursor-pointer hover:border-slate-300 dark:hover:border-slate-600 transition-colors">
                        <input
                          type="checkbox"
                          checked={botSettings.companyTone?.includes(tone)}
                          onChange={(e) => {
                            const newTones = e.target.checked
                              ? [...(botSettings.companyTone || []), tone]
                              : (botSettings.companyTone || []).filter((t: string) => t !== tone);
                            updateSetting('companyTone', newTones);
                          }}
                          className="w-4 h-4 accent-slate-900 dark:accent-blue-600"
                        />
                        <span className="text-lg font-google text-slate-700 dark:text-slate-300">{tone}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="mb-6">
                  <label className={labelCls}>System Prompt / Instructions</label>
                  <textarea
                    value={botSettings.systemPrompt}
                    onChange={e => updateSetting('systemPrompt', e.target.value)}
                    className={inputCls + ' min-h-[120px] resize-none py-3'}
                    placeholder="Example: You are a helpful assistant for SaPyBase..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className={labelCls + ' mb-0'}>Quick Questions</label>
                    <button
                      onClick={() => updateSetting('quickQuestions', [...(Array.isArray(botSettings.quickQuestions) ? botSettings.quickQuestions : []), ''])}
                      className="p-1 px-2 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-500 text-[10px] uppercase tracking-widest font-bold font-sans transition-colors flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[12px]">add</span> Add
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(Array.isArray(botSettings.quickQuestions) ? botSettings.quickQuestions : []).map((q: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={typeof q === 'string' ? q : (q.label || '')}
                          onChange={e => {
                            const newQs = [...botSettings.quickQuestions];
                            newQs[idx] = e.target.value;
                            updateSetting('quickQuestions', newQs);
                          }}
                          className={inputCls + ' text-md font-semibold py-2'}
                        />
                        <button
                          onClick={() => {
                            const newQs = [...botSettings.quickQuestions];
                            newQs.splice(idx, 1);
                            updateSetting('quickQuestions', newQs);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-800 transition-colors" />

            <div className="space-y-4 relative">
              {!isProUser && (
                <div className="absolute -inset-4 z-40 bg-white/40 dark:bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center group cursor-help transition-all hover:backdrop-blur-sm">
                  <div className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-green-600 text-white text-sm uppercase tracking-widest font-bold font-sans shadow-lg flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">lock</span> Pro Required
                  </div>
                  <Link href="/dashboard/pricing" className="mt-2 text-md font-bold text-slate-800 dark:text-slate-200 underline underline-offset-4 decoration-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Upgrade Now</Link>
                </div>
              )}
              <div className={!isProUser ? 'opacity-40 grayscale-[0.5] pointer-events-none filter blur-[0.5px]' : ''}>
                <p className={headingCls + ' flex items-center'}>
                  <span className="material-symbols-outlined inline text-[14px] mr-1.5 text-slate-500 dark:text-slate-500 transition-colors">webhook</span>
                  Integrations
                </p>
                <div className="space-y-6">
                  <div>
                    <label className={labelCls}>Lead Capture Webhook URL</label>
                    <input
                      type="url"
                      value={botSettings.webhookUrl || ''}
                      onChange={e => updateSetting('webhookUrl', e.target.value)}
                      className={inputCls}
                      placeholder="https://hooks.zapier.com/hooks/catch/..."
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Human Handoff — Instant Contact Link</label>
                    <input
                      type="url"
                      value={botSettings.handoffRedirectUrl || ''}
                      onChange={e => updateSetting('handoffRedirectUrl', e.target.value)}
                      className={inputCls}
                      placeholder="https://wa.me/..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-100 dark:border-slate-800 transition-colors">
              <button
                onClick={async () => {
                  if (showFullOverlay) {
                    setAlert({ open: true, type: 'error', msg: 'Upgrade required to save changes.' });
                    return;
                  }
                  const res = await saveSettings(selectedBotId);
                  if (res.success) {
                    setAlert({ open: true, type: 'success', msg: 'Settings saved successfully!' });
                  } else {
                    setAlert({ open: true, type: 'error', msg: res.message ?? 'Failed to save settings.' });
                  }
                }}
                disabled={isSaving || showFullOverlay}
                className="w-full py-4 min-h-[48px] bg-gradient-to-r from-blue-600 to-green-600 text-white text-lg uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
              >
                {isSaving ? 'PERSISTING...' : 'SAVE_CONFIG'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Preview Column ── */}
      <div className={`overflow-hidden border-t lg:border-t-0 lg:border-l w-full relative transition-colors flex flex-col items-center justify-center p-0 lg:p-8 ${isDark ? 'dark bg-slate-950 border-slate-800' : 'bg-[#FAFAFA] border-gray-100'}`}>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-100 transition-opacity duration-700"
          style={{ backgroundImage: "url('/nature_1.webp')" }}
        />
        <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/60 backdrop-blur-[1px] pointer-events-none transition-colors duration-500" />

        <div className="absolute bottom-8 lg:top-2 lg:bottom-auto left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-full px-4 text-center">
          <button
            onClick={() => setIsDark(d => !d)}
            className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:scale-105 transition-all group"
          >
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-300">
              {isDark ? 'Switch to Light' : 'Switch to Dark'}
            </span>
          </button>
        </div>

        <div className="w-full lg:w-full flex lg:items-center lg:justify-center origin-top lg:origin-center scale-[0.82] lg:scale-100 transition-transform duration-500 py-4 lg:py-0">
          <BotPreview theme={isDark ? 'dark' : 'light'} />
        </div>
      </div>

      <Alert
        isOpen={alert.open}
        type={alert.type}
        message={alert.msg}
        onClose={() => setAlert(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
