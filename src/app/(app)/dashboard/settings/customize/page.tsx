'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useBotSettings } from '@/src/lib/context/BotSettingsContext';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch, useIsAuthReady } from '@/src/lib/hooks/useAuthenticatedFetch';
import LogoCustomizer from '@/src/app/components/LogoCustomizer';
import BotPreview from '@/src/app/components/BotPreview';
import Alert from '@/src/app/components/Alert';
import SampleFormEditor, { validateSampleForm } from '@/src/app/components/SampleFormEditor';

// Friendly heading per vertical pack (kept tiny; grows as packs are added).
const VERTICAL_LABEL: Record<string, string> = { chemical: 'Chemical agent' };

const inputCls = "w-full text-sm font-google px-4 py-3 bg-slate-100 dark:bg-slate-800 focus:bg-slate-200 dark:focus:bg-slate-700 focus:outline-none text-slate-900 dark:text-slate-200 transition-colors rounded-xl";
const labelCls = "block text-sm font-medium font-google text-slate-600 dark:text-slate-400 mb-2 transition-colors";
const sectionHeadingCls = "text-sm font-semibold font-google text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-4 transition-colors";
const cardCls = "bg-white dark:bg-slate-900 rounded-2xl p-5 transition-colors duration-500";

// Lightweight client-side email check (the backend is the source of truth).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/";

// Accessible on/off switch — keyboard focusable, exposes role="switch" + state.
const Toggle = ({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  disabled?: boolean;
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)}
    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900 disabled:cursor-not-allowed ${
      checked && !disabled ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'
    }`}
  >
    <span
      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow transition-transform duration-200 ${
        checked && !disabled ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const LockOverlay = ({ label, href = '/dashboard/pricing' }: { label: string; href?: string }) => (
  <div className="absolute inset-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center group cursor-help rounded-2xl transition-all">
    <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-black text-xs font-semibold font-google rounded-xl shadow-lg">
      <span className="material-symbols-outlined text-[14px]">lock</span>
      {label}
    </div>
    <Link
      href={href}
      className="mt-2 text-sm font-semibold font-google text-slate-700 dark:text-slate-300 underline underline-offset-4 opacity-0 group-hover:opacity-100 transition-opacity"
    >
      Upgrade now
    </Link>
  </div>
);

type Tab = 'appearance' | 'behavior' | 'leads';
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'appearance', label: 'Appearance', icon: 'palette' },
  { id: 'behavior',   label: 'Behavior',   icon: 'psychology' },
  { id: 'leads',      label: 'Leads & Integrations', icon: 'notifications_active' },
];

export default function CustomizePage() {
  const { botSettings, updateSetting, saveSettings, fetchSettings, isSaving, isLoading } = useBotSettings();
  const { userTier, userRole, entitlements, isLoading: userLoading } = useUserRole();
  const authFetch = useAuthenticatedFetch();
  const isAuthReady = useIsAuthReady();
  const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'warning', msg: '' });
  const [activeTab, setActiveTab] = useState<Tab>('appearance');

  const searchParams = useSearchParams();
  const editBotId = searchParams.get('edit');

  const [selectedBotId, setSelectedBotId] = useState(editBotId || '');
  const { data: botsData } = useQuery({
    queryKey: ['bots'],
    queryFn: () => authFetch('/api/companies') as Promise<any>,
    enabled: isAuthReady,
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
    if (selectedBotId) fetchSettings(selectedBotId);
  }, [selectedBotId, fetchSettings]);

  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isGlobalDark = document.documentElement.classList.contains('dark');
    setIsDark(isSystemDark || isGlobalDark);
  }, []);

  const isTotallyLocked = !userTier || userTier === 'null';
  const isFree = (userTier ?? '').toUpperCase() === 'FREE';
  const hasAnyEntitlement = Object.values(entitlements).some(Boolean);
  const showFullOverlay = (isTotallyLocked || isFree) && !hasAnyEntitlement && userRole !== 'SUPER_ADMIN';
  const isAdvancedLocked = !entitlements.canUseAdvancedBot;
  const canHideBranding = entitlements.canWhiteLabel;
  const canUseCustomLogo = entitlements.canUseCustomLogo;
  const canUseWebhooks = entitlements.canUseWebhooks && entitlements.canUseLeadCapture;
  const canUseHumanHandoff = entitlements.canUseHumanHandoff;
  const hasIntegrationsAccess = canUseWebhooks || canUseHumanHandoff;
  const canUseLeadCapture = entitlements.canUseLeadCapture;

  // ── Inline validation for lead-alert fields (non-blocking until save) ──
  const alertEmailTrimmed = (botSettings.alertEmail || '').trim();
  const slackUrlTrimmed = (botSettings.slackWebhookUrl || '').trim();
  const bookingUrlTrimmed = (botSettings.bookingUrl || '').trim();
  const alertEmailInvalid = alertEmailTrimmed !== '' && !EMAIL_RE.test(alertEmailTrimmed);
  const slackUrlInvalid = slackUrlTrimmed !== '' && !slackUrlTrimmed.startsWith(SLACK_WEBHOOK_PREFIX);
  const bookingUrlInvalid = bookingUrlTrimmed !== '' && !bookingUrlTrimmed.toLowerCase().startsWith('https://');
  const leadAlertsInvalid = alertEmailInvalid || slackUrlInvalid || bookingUrlInvalid;

  // ── Phase 5 (customise): vertical-pack section validity (only when a pack is set) ──
  const isVerticalBot = !!botSettings.vertical;
  const sampleFormValidation = validateSampleForm(botSettings.sampleForm || []);
  const sampleSinkInvalid =
    (botSettings.sampleSinkUrl || '').trim() !== '' &&
    !(botSettings.sampleSinkUrl || '').trim().toLowerCase().startsWith('https://');
  const packConfigInvalid = isVerticalBot && (!sampleFormValidation.valid || sampleSinkInvalid);

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-500">

      {/* ── LEFT: Settings ── */}
      <div className="flex flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden border-r border-slate-100 dark:border-slate-800 transition-colors duration-500">

        {/* Header + tab bar */}
        <div className="px-6 md:px-8 pt-5 pb-4 shrink-0 space-y-3">
          <p className="text-sm font-google text-slate-500 dark:text-slate-400 transition-colors">Changes reflect instantly in the preview.</p>

          {/* Segmented control */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl transition-colors">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold font-google rounded-lg transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable cards body */}
        <div data-lenis-prevent className={`px-4 md:px-5 pb-6 space-y-4 relative flex-1 min-h-0 overflow-y-auto custom-scrollbar ${showFullOverlay ? 'overflow-hidden select-none' : ''}`}>

          {/* Full upgrade overlay */}
          {showFullOverlay && (
            <div className="absolute inset-0 z-50 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center transition-colors cursor-help">
              <span className="material-symbols-outlined text-[32px] text-slate-400 dark:text-slate-500 mb-4">lock</span>
              <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200 mb-2">Upgrade required</h3>
              <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px] mb-6">
                Customizing your bot's visual identity requires an active subscription.
              </p>
              <Link
                href="/dashboard/pricing"
                className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors active:scale-[0.98]"
              >
                View plans
              </Link>
            </div>
          )}

          <div className={`space-y-4 ${showFullOverlay || isLoading || userLoading ? 'opacity-30 pointer-events-none' : ''}`}>

            {/* Admin: model override */}
            {userRole === 'SUPER_ADMIN' && (
              <div className="p-5 bg-amber-50 dark:bg-amber-900/10 rounded-2xl border border-amber-200 dark:border-amber-900/30 transition-colors">
                <p className="text-sm font-semibold font-google text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">admin_panel_settings</span>
                  Model engine override
                </p>
                <div>
                  <label className="block text-sm font-medium font-google text-amber-600 dark:text-amber-400 mb-2">Select model engine</label>
                  <select
                    value={botSettings.aiModel}
                    onChange={e => updateSetting('aiModel', e.target.value)}
                    className="w-full px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 focus:outline-none text-sm font-google text-slate-900 dark:text-slate-200 rounded-xl transition-colors"
                  >
                    <option value="">Default (auto / tier-based)</option>
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (max speed)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (balanced thinking)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (standard reasoning)</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (next-gen preview)</option>
                  </select>
                </div>
              </div>
            )}

            {/* Bot selector (multi-bot) */}
            {bots.length > 1 && (
              <div className={cardCls}>
                <p className={sectionHeadingCls}>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">smart_toy</span>
                  Select bot
                </p>
                <div className="relative">
                  <select
                    value={selectedBotId}
                    onChange={e => setSelectedBotId(e.target.value)}
                    className={inputCls + ' appearance-none pr-10'}
                  >
                    {bots.map((b: any) => (
                      <option key={b.id} value={b.id}>
                        {b.bot_name || 'Unnamed bot'} — {b.company_name}
                      </option>
                    ))}
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">expand_more</span>
                </div>
              </div>
            )}

            {/* ═══ APPEARANCE TAB ═══ */}
            {activeTab === 'appearance' && (
            <>
            {/* ── Bot Appearance ── */}
            <div className={cardCls + ' space-y-4'}>
              <p className={sectionHeadingCls}>
                <span className="material-symbols-outlined text-[16px] text-slate-400">palette</span>
                Bot appearance
              </p>

              <div>
                <label className={labelCls}>Bot name</label>
                <input
                  type="text"
                  value={botSettings.name}
                  onChange={e => updateSetting('name', e.target.value)}
                  className={inputCls}
                  placeholder="Sapybase AI"
                />
              </div>

              <div>
                <label className={labelCls}>Greeting message</label>
                <input
                  type="text"
                  value={botSettings.greeting}
                  onChange={e => updateSetting('greeting', e.target.value)}
                  className={inputCls}
                  placeholder="Hi! How can I help you today?"
                />
              </div>

              {/* Branding toggle */}
              <div className={`flex items-start justify-between gap-4 p-4 rounded-xl transition-colors ${canHideBranding ? 'bg-slate-50 dark:bg-slate-800' : 'bg-slate-50 dark:bg-slate-800 opacity-50'}`}>
                <div className="min-w-0">
                  <p className="text-sm font-medium font-google text-slate-800 dark:text-slate-200 transition-colors">
                    Remove "Vaayu Intelligence" branding
                  </p>
                  <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                    {canHideBranding ? 'Hide the Sapybase footer from your widget.' : 'Available on Starter plan and above.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => canHideBranding && updateSetting('hideBranding', !botSettings.hideBranding)}
                  className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${botSettings.hideBranding && canHideBranding ? 'bg-slate-900 dark:bg-white' : 'bg-slate-200 dark:bg-slate-700'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white dark:bg-slate-900 rounded-full shadow transition-transform duration-200 ${botSettings.hideBranding && canHideBranding ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* ── Logo & Avatar ── */}
            <div className={cardCls}>
              <p className={sectionHeadingCls}>
                <span className="material-symbols-outlined text-[16px] text-slate-400">image</span>
                Logo &amp; avatar
              </p>
              <LogoCustomizer
                customLogoUrl={botSettings.customLogoUrl || ''}
                primaryColor={botSettings.primaryColor || '#5730F5'}
                botName={botSettings.name || 'S'}
                isProUser={canUseCustomLogo}
                avatarBgStyle={botSettings.avatarBgStyle || 'none'}
                onUrlChange={(url) => updateSetting('customLogoUrl', url)}
                onBgStyleChange={(styleId) => updateSetting('avatarBgStyle', styleId)}
                onPrimaryColorChange={(val) => updateSetting('primaryColor', val)}
              />
            </div>
            </>
            )}

            {/* ═══ BEHAVIOR TAB ═══ */}
            {activeTab === 'behavior' && (
            <>
            {/* ── Vertical / Industry pack ── */}
            <div className={cardCls + ' space-y-4'}>
              <p className={sectionHeadingCls}>
                <span className="material-symbols-outlined text-[16px] text-slate-400">category</span>
                Industry vertical
              </p>
              <div>
                <label className={labelCls}>Vertical pack</label>
                <div className="relative">
                  <select
                    value={botSettings.vertical || ''}
                    onChange={e => updateSetting('vertical', e.target.value)}
                    className={inputCls + ' appearance-none pr-10'}
                  >
                    <option value="">Generic (no vertical)</option>
                    <option value="chemical">Chemical industry</option>
                  </select>
                  <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">expand_more</span>
                </div>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1.5">
                  Selecting a vertical activates industry-specific tools, hub cards, and dashboard views.
                </p>
              </div>
            </div>

            {/* ── Advanced Behavior ── */}
            <div className={`${cardCls} relative`}>
              {isAdvancedLocked && <LockOverlay label="Starter or Pro required" />}

              <p className={sectionHeadingCls + (isAdvancedLocked ? ' opacity-40' : '')}>
                <span className="material-symbols-outlined text-[16px] text-slate-400">psychology</span>
                Advanced behavior
              </p>

              <div className={`space-y-5 ${isAdvancedLocked ? 'opacity-40 grayscale-[0.5] pointer-events-none blur-[0.5px]' : ''}`}>
                <div>
                  <label className={labelCls}>Company tone</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {['Professional', 'Friendly', 'Humorous', 'Technical', 'Concise'].map(tone => (
                      <label
                        key={tone}
                        className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={botSettings.companyTone?.includes(tone)}
                          onChange={(e) => {
                            const newTones = e.target.checked
                              ? [...(botSettings.companyTone || []), tone]
                              : (botSettings.companyTone || []).filter((t: string) => t !== tone);
                            updateSetting('companyTone', newTones);
                          }}
                          className="w-4 h-4 accent-slate-900 dark:accent-blue-500 shrink-0"
                        />
                        <span className="text-sm font-google text-slate-700 dark:text-slate-300">{tone}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>System prompt / instructions</label>
                  <textarea
                    value={botSettings.systemPrompt}
                    onChange={e => updateSetting('systemPrompt', e.target.value)}
                    className={inputCls + ' min-h-[120px] resize-none'}
                    placeholder="Example: You are a helpful assistant for Sapybase..."
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className={labelCls + ' mb-0'}>Quick questions</label>
                    <button
                      onClick={() => updateSetting('quickQuestions', [...(Array.isArray(botSettings.quickQuestions) ? botSettings.quickQuestions : []), ''])}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium font-google bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                    >
                      <span className="material-symbols-outlined text-[12px]">add</span>
                      Add
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
                          className={inputCls}
                        />
                        <button
                          onClick={() => {
                            const newQs = [...botSettings.quickQuestions];
                            newQs.splice(idx, 1);
                            updateSetting('quickQuestions', newQs);
                          }}
                          className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Vertical agent (Phase 5 customise) — only for a pack bot ── */}
            {isVerticalBot && (
              <div className={cardCls + ' space-y-4'}>
                <p className={sectionHeadingCls}>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">science</span>
                  {VERTICAL_LABEL[botSettings.vertical] || 'Vertical agent'}
                </p>
                <p className="text-xs font-google text-slate-400 dark:text-slate-500 -mt-2 leading-relaxed">
                  Your industry pack pre-configures the agent. Customise the sample-request form your widget collects and where its submissions land.
                </p>
                <div>
                  <label className={labelCls}>Sample request form</label>
                  <SampleFormEditor
                    fields={botSettings.sampleForm || []}
                    onChange={(f) => updateSetting('sampleForm', f)}
                    sinkUrl={botSettings.sampleSinkUrl || ''}
                    onSinkUrlChange={(v) => updateSetting('sampleSinkUrl', v)}
                    sinkSecret={botSettings.sampleSinkSecret || ''}
                    onSinkSecretChange={(v) => updateSetting('sampleSinkSecret', v)}
                  />
                </div>
              </div>
            )}
            </>
            )}

            {/* ═══ LEADS & INTEGRATIONS TAB ═══ */}
            {activeTab === 'leads' && (
            <>
            {/* ── Integrations ── */}
            {hasIntegrationsAccess && (
              <div className={cardCls + ' space-y-5'}>
                <p className={sectionHeadingCls}>
                  <span className="material-symbols-outlined text-[16px] text-slate-400">webhook</span>
                  Integrations
                </p>

                <div className="relative">
                  {!canUseWebhooks && <LockOverlay label="Webhooks required" />}
                  <div className={!canUseWebhooks ? 'opacity-40 grayscale-[0.5] pointer-events-none blur-[0.5px]' : ''}>
                    <label className={labelCls}>Lead capture webhook URL</label>
                    <input
                      type="url"
                      value={botSettings.webhookUrl || ''}
                      onChange={e => updateSetting('webhookUrl', e.target.value)}
                      className={inputCls}
                      placeholder="https://hooks.zapier.com/hooks/catch/..."
                    />
                  </div>
                </div>

                <div className="relative">
                  {!canUseHumanHandoff && <LockOverlay label="Human handoff required" />}
                  <div className={!canUseHumanHandoff ? 'opacity-40 grayscale-[0.5] pointer-events-none blur-[0.5px]' : ''}>
                    <label className={labelCls}>Human handoff — instant contact link</label>
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
            )}

            {/* ── Lead alerts & notifications ── */}
            <div className={cardCls + ' relative'}>
              {!canUseLeadCapture && <LockOverlay label="Lead capture (Pro) required" />}

              <p className={sectionHeadingCls + (!canUseLeadCapture ? ' opacity-40' : '')}>
                <span className="material-symbols-outlined text-[16px] text-slate-400">notifications_active</span>
                Lead alerts &amp; notifications
              </p>

              <div className={`space-y-4 ${!canUseLeadCapture ? 'opacity-40 grayscale-[0.5] pointer-events-none blur-[0.5px]' : ''}`}>

                {/* Instant hot-lead alert */}
                <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium font-google text-slate-800 dark:text-slate-200 transition-colors">
                      Instant hot-lead alerts
                    </p>
                    <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                      Get an email the moment a high-intent visitor converts, so you can follow up while they're still engaged.
                    </p>
                  </div>
                  <Toggle
                    label="Instant hot-lead alerts"
                    checked={botSettings.hotLeadAlertsEnabled}
                    onChange={(v) => updateSetting('hotLeadAlertsEnabled', v)}
                    disabled={!canUseLeadCapture}
                  />
                </div>

                {/* Weekly results digest */}
                <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800 transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-medium font-google text-slate-800 dark:text-slate-200 transition-colors">
                      Weekly results email
                    </p>
                    <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                      A weekly digest of new leads, hot prospects, and who to follow up with first.
                    </p>
                  </div>
                  <Toggle
                    label="Weekly results email"
                    checked={botSettings.weeklyDigestEnabled}
                    onChange={(v) => updateSetting('weeklyDigestEnabled', v)}
                    disabled={!canUseLeadCapture}
                  />
                </div>

                {/* Alert recipient email */}
                <div>
                  <label className={labelCls} htmlFor="alert-email">Send alerts to</label>
                  <input
                    id="alert-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    value={botSettings.alertEmail}
                    onChange={(e) => updateSetting('alertEmail', e.target.value)}
                    className={inputCls + (alertEmailInvalid ? ' ring-1 ring-red-400 dark:ring-red-500' : '')}
                    placeholder="Defaults to your account email"
                    aria-invalid={alertEmailInvalid}
                    aria-describedby="alert-email-hint"
                  />
                  <p
                    id="alert-email-hint"
                    className={`text-xs font-google mt-1.5 leading-relaxed transition-colors ${
                      alertEmailInvalid ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {alertEmailInvalid
                      ? 'Enter a valid email address (e.g. you@company.com).'
                      : 'Used for both hot-lead alerts and the weekly digest. Leave blank to use your account email.'}
                  </p>
                </div>

                {/* Slack handoff webhook */}
                <div>
                  <label className={labelCls} htmlFor="slack-url">Slack channel — Incoming Webhook URL</label>
                  <input
                    id="slack-url"
                    type="url"
                    spellCheck={false}
                    autoComplete="off"
                    value={botSettings.slackWebhookUrl}
                    onChange={(e) => updateSetting('slackWebhookUrl', e.target.value)}
                    className={inputCls + (slackUrlInvalid ? ' ring-1 ring-red-400 dark:ring-red-500' : '')}
                    placeholder="https://hooks.slack.com/services/..."
                    aria-invalid={slackUrlInvalid}
                    aria-describedby="slack-url-hint"
                  />
                  <p
                    id="slack-url-hint"
                    className={`text-xs font-google mt-1.5 leading-relaxed transition-colors ${
                      slackUrlInvalid ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {slackUrlInvalid ? (
                      'Must be a Slack Incoming Webhook (starts with https://hooks.slack.com/).'
                    ) : (
                      <>
                        Post every new lead to a Slack channel.{' '}
                        <a
                          href="https://api.slack.com/messaging/webhooks"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline underline-offset-2 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                        >
                          Create a webhook →
                        </a>
                      </>
                    )}
                  </p>
                </div>

                {/* Instant booking link (Calendly / Cal.com / …) */}
                <div>
                  <label className={labelCls} htmlFor="booking-url">Booking link — instant &ldquo;Book a call&rdquo; for hot leads</label>
                  <input
                    id="booking-url"
                    type="url"
                    spellCheck={false}
                    autoComplete="off"
                    value={botSettings.bookingUrl}
                    onChange={(e) => updateSetting('bookingUrl', e.target.value)}
                    className={inputCls + (bookingUrlInvalid ? ' ring-1 ring-red-400 dark:ring-red-500' : '')}
                    placeholder="https://calendly.com/your-team/intro"
                    aria-invalid={bookingUrlInvalid}
                    aria-describedby="booking-url-hint"
                  />
                  <p
                    id="booking-url-hint"
                    className={`text-xs font-google mt-1.5 leading-relaxed transition-colors ${
                      bookingUrlInvalid ? 'text-red-500 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {bookingUrlInvalid
                      ? 'Must be a secure link (starts with https://).'
                      : 'Qualified (hot &amp; warm) leads see a “Book a call” button the moment they leave their details. Works with Calendly, Cal.com, HubSpot Meetings, etc.'}
                  </p>
                </div>

              </div>
            </div>
            </>
            )}

            {/* ── Save button ── */}
            <button
              onClick={async () => {
                if (showFullOverlay) {
                  setAlert({ open: true, type: 'error', msg: 'Upgrade required to save changes.' });
                  return;
                }
                if (leadAlertsInvalid) {
                  setAlert({
                    open: true,
                    type: 'error',
                    msg: alertEmailInvalid
                      ? 'Please enter a valid alert email address before saving.'
                      : slackUrlInvalid
                        ? 'Slack webhook URL must start with https://hooks.slack.com/.'
                        : 'Booking link must start with https://.',
                  });
                  return;
                }
                if (packConfigInvalid) {
                  setAlert({
                    open: true,
                    type: 'error',
                    msg: sampleSinkInvalid
                      ? 'Data destination must be a secure link (starts with https://).'
                      : 'Fix the sample form: every field needs a unique key.',
                  });
                  return;
                }
                const res = await saveSettings(selectedBotId);
                if (res.success) {
                  setAlert({ open: true, type: 'success', msg: 'Settings saved successfully.' });
                } else {
                  setAlert({ open: true, type: 'error', msg: res.message ?? 'Failed to save settings.' });
                }
              }}
              disabled={isSaving || showFullOverlay}
              className="w-full py-3.5 min-h-[48px] bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
            >
              {isSaving
                ? <><div className="w-3.5 h-3.5 border-2 border-white/30 dark:border-slate-800/50 border-t-white dark:border-t-slate-800 rounded-full animate-spin" /> Saving…</>
                : 'Save settings'
              }
            </button>

          </div>
        </div>
      </div>

      {/* ── RIGHT: Preview ── */}
      <div className={`relative flex items-center justify-center border-t lg:border-t-0 min-h-[450px] lg:min-h-0 lg:flex-1 lg:shrink-0 overflow-hidden transition-colors ${isDark ? 'dark bg-slate-950 border-slate-800' : 'bg-slate-50 border-slate-100'}`}>
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-opacity duration-700"
          style={{ backgroundImage: "url('/nature_1.webp')", backgroundColor: '#e2e8f0' }}
        />
        <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/60 backdrop-blur-[1px] pointer-events-none transition-colors duration-500" />

        {/* Theme toggle */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          <p className="text-xs font-medium font-google text-slate-500 dark:text-slate-400">Check contrast in both modes</p>
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all border border-slate-200 dark:border-slate-700"
          >
            <div className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="material-symbols-outlined text-[13px] text-slate-700 dark:text-slate-300">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </div>
            <span className="text-xs font-medium font-google text-slate-700 dark:text-slate-300">
              {isDark ? 'Light mode' : 'Dark mode'}
            </span>
          </button>
        </div>

        {/* Bot preview */}
        <div className="relative z-10 flex items-center justify-center w-full py-20 lg:py-0">
          <div className="scale-[0.75] sm:scale-[0.82] lg:scale-100 transition-transform duration-500">
            <BotPreview theme={isDark ? 'dark' : 'light'} />
          </div>
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
