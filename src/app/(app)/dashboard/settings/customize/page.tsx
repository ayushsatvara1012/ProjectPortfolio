'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useBotSettings } from '@/src/lib/context/BotSettingsContext';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useBotSwitcher } from '@/src/lib/context/BotSwitcherContext';
import { useAuthenticatedFetch } from '@/src/lib/hooks/useAuthenticatedFetch';
import LogoCustomizer from '@/src/components/features/LogoCustomizer';
import ChatWidget from '@/src/components/chat/ChatWidget';
import Alert from '@/src/components/ui/Alert';
import SampleFormEditor, { validateSampleForm } from '@/src/components/dashboard/SampleFormEditor';

// Friendly heading per vertical pack (kept tiny; grows as packs are added).
const VERTICAL_LABEL: Record<string, string> = { chemical: 'Chemical agent' };

// ── Shared field styles (AWS-console inspired: white inputs + hairline borders on
// a seamless page, no heavy card chrome) ──────────────────────────────────────
const inputCls = "w-full text-sm font-google px-3.5 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:border-slate-400 dark:focus:border-slate-500 focus:outline-none focus:ring-4 focus:ring-slate-900/[0.04] dark:focus:ring-white/[0.04] text-slate-900 dark:text-slate-200 transition rounded-lg placeholder:text-slate-400 dark:placeholder:text-slate-500";
const labelCls = "block text-[13px] font-medium font-google text-slate-900 dark:text-slate-100 mb-1.5 transition-colors";
const helpCls = "text-xs font-google text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed";
const sectionHeadingCls = "text-sm font-semibold font-google text-slate-900 dark:text-slate-50 flex items-center gap-1.5 transition-colors";
const sectionDescCls = "text-xs font-google text-slate-500 dark:text-slate-400 mt-0.5 mb-3 leading-relaxed";
const toggleRowCls = "flex items-center justify-between gap-4 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors";

// Lightweight client-side email check (the backend is the source of truth).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLACK_WEBHOOK_PREFIX = "https://hooks.slack.com/";

// Section wrapper — seamless, separated by a hairline divider instead of a card.
const Section = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <section className={`py-4 first:pt-1 border-b border-slate-100 dark:border-slate-800/70 last:border-b-0 ${className}`}>
    {children}
  </section>
);

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
    className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 dark:focus-visible:ring-slate-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-950 disabled:cursor-not-allowed ${
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
  <div className="absolute inset-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center group cursor-help rounded-xl transition-all">
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
  { id: 'leads',      label: 'Leads',      icon: 'notifications_active' },
];

export default function CustomizePage() {
  const { botSettings, updateSetting, saveSettings, fetchSettings, isSaving, isLoading, isDirty } = useBotSettings();
  const { userTier, userRole, entitlements, isLoading: userLoading } = useUserRole();
  // Bot list + selection are global (AppLayout fetches once and every dashboard
  // page shares the same selectedBotId) — this page only overlays the `?edit=`
  // deep-link from "My Bots" onto that shared selection.
  const { bots, selectedBotId, setSelectedBotId, showPreview } = useBotSwitcher();
  const authFetch = useAuthenticatedFetch();
  const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'warning', msg: '' });
  const [activeTab, setActiveTab] = useState<Tab>('appearance');

  const searchParams = useSearchParams();
  const editBotId = searchParams.get('edit');

  useEffect(() => {
    if (editBotId && editBotId !== selectedBotId && bots.some((b) => b.id === editBotId)) {
      setSelectedBotId(editBotId);
    }
  }, [bots, selectedBotId, editBotId, setSelectedBotId]);

  useEffect(() => {
    if (selectedBotId) fetchSettings(selectedBotId);
  }, [selectedBotId, fetchSettings]);

  // ── Phase 4: beforeunload guard for unsaved changes ──
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // ── Phase 4: auto-dismiss success alerts after 3 s ──
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (alert.open && alert.type === 'success') {
      dismissTimerRef.current = setTimeout(() => setAlert(p => ({ ...p, open: false })), 3000);
      return () => clearTimeout(dismissTimerRef.current);
    }
  }, [alert.open, alert.type]);

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

  const gridCls = `grid grid-cols-1 sm:grid-cols-2 ${showPreview ? '' : 'xl:grid-cols-3'} gap-x-4 gap-y-4`;

  const handleSave = useCallback(async () => {
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
  }, [showFullOverlay, leadAlertsInvalid, alertEmailInvalid, slackUrlInvalid, packConfigInvalid, sampleSinkInvalid, selectedBotId, saveSettings]);

  // ── Phase 4: Cmd+S / Ctrl+S keyboard shortcut ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleSave]);

  return (
    <div className="flex flex-col lg:flex-row flex-1 min-h-0 bg-slate-50 dark:bg-slate-950 transition-colors duration-500">

      {/* ── Settings panel ── */}
      <div className="flex flex-col flex-1 lg:min-h-0 lg:overflow-hidden transition-colors duration-500">

        {/* Tab bar — insights-style underline nav */}
        <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 px-5 md:px-6">
          <div role="tablist" aria-label="Customize sections" className="flex items-center gap-1">
            {TABS.map(tab => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative inline-flex items-center gap-1.5 py-3 px-2.5 text-[13px] font-semibold font-google whitespace-nowrap transition-colors focus-visible:outline-none ${
                    active
                      ? 'text-slate-900 dark:text-slate-50'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{tab.icon}</span>
                  {tab.label}
                  {active && <span className="absolute bottom-0 left-1 right-1 h-0.5 rounded-full bg-slate-900 dark:bg-slate-100" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable body */}
        <div data-lenis-prevent className={`px-5 md:px-6 pb-6 relative flex-1 lg:min-h-0 lg:overflow-y-auto custom-scrollbar ${showFullOverlay ? 'overflow-hidden select-none' : ''}`}>

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

          <div className={`${showPreview ? 'max-w-3xl' : ''} mx-auto ${showFullOverlay || isLoading || userLoading ? 'opacity-30 pointer-events-none' : ''}`}>

            {/* Admin: model override */}
            {userRole === 'SUPER_ADMIN' && (
              <Section>
                <p className="text-[13px] font-semibold font-google text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">admin_panel_settings</span>
                  Model engine override
                </p>
                <p className={sectionDescCls}>Super-admin only — pins this bot to a specific model engine.</p>
                <div className="sm:max-w-xs">
                  <select
                    value={botSettings.aiModel}
                    onChange={e => updateSetting('aiModel', e.target.value)}
                    className={inputCls + ' appearance-none pr-10'}
                  >
                    <option value="">Default (auto / tier-based)</option>
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash-Lite (max speed)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash (balanced thinking)</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro (standard reasoning)</option>
                    <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (next-gen preview)</option>
                  </select>
                </div>
              </Section>
            )}

            <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
            >
            {/* ═══ APPEARANCE TAB ═══ */}
            {activeTab === 'appearance' && (
            <>
              <Section>
                <p className={sectionHeadingCls}>
                  <span className="material-symbols-outlined text-[15px] text-slate-400">badge</span>
                  Bot identity
                </p>
                <p className={sectionDescCls}>The name and greeting visitors see first.</p>

                <div className={gridCls}>
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
                </div>

                {/* Branding toggle */}
                <div className={`mt-4 ${toggleRowCls} ${canHideBranding ? '' : 'opacity-60'}`}>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium font-google text-slate-900 dark:text-slate-100">Remove &ldquo;Vaayu Intelligence&rdquo; branding</p>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {canHideBranding ? 'Hide the Sapybase footer from your widget.' : 'Available on Starter plan and above.'}
                    </p>
                  </div>
                  <Toggle
                    label="Remove Vaayu Intelligence branding"
                    checked={!!botSettings.hideBranding}
                    onChange={(v) => canHideBranding && updateSetting('hideBranding', v)}
                    disabled={!canHideBranding}
                  />
                </div>
              </Section>

              <Section>
                <p className={sectionHeadingCls}>
                  <span className="material-symbols-outlined text-[15px] text-slate-400">image</span>
                  Logo &amp; avatar
                </p>
                <p className={sectionDescCls}>Upload a logo and pick the avatar background and brand color.</p>
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
              </Section>
            </>
            )}

            {/* ═══ BEHAVIOR TAB ═══ */}
            {activeTab === 'behavior' && (
            <>
              <Section>
                <p className={sectionHeadingCls}>
                  <span className="material-symbols-outlined text-[15px] text-slate-400">category</span>
                  Industry vertical
                </p>
                <p className={sectionDescCls}>Activates industry-specific tools, hub cards, and dashboard views.</p>
                <div className="relative sm:max-w-xs">
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
              </Section>

              <Section className="relative">
                {isAdvancedLocked && <LockOverlay label="Starter or Pro required" />}
                <p className={sectionHeadingCls + (isAdvancedLocked ? ' opacity-40' : '')}>
                  <span className="material-symbols-outlined text-[15px] text-slate-400">psychology</span>
                  Advanced behavior
                </p>
                <p className={sectionDescCls + (isAdvancedLocked ? ' opacity-40' : '')}>Tune the bot&rsquo;s tone, instructions, and conversation starters.</p>

                <div className={`space-y-5 ${isAdvancedLocked ? 'opacity-40 grayscale-[0.5] pointer-events-none blur-[0.5px]' : ''}`}>
                  <div>
                    <label className={labelCls}>Company tone</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {['Professional', 'Friendly', 'Humorous', 'Technical', 'Concise'].map(tone => {
                        const active = botSettings.companyTone?.includes(tone);
                        return (
                          <label
                            key={tone}
                            className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                              active
                                ? 'border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800'
                                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={active}
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
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>System prompt / instructions</label>
                    <textarea
                      value={botSettings.systemPrompt}
                      onChange={e => updateSetting('systemPrompt', e.target.value)}
                      className={inputCls + ' min-h-[110px] resize-y'}
                      placeholder="Example: You are a helpful assistant for Sapybase..."
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className={labelCls + ' mb-0'}>Quick questions</label>
                      <button
                        onClick={() => updateSetting('quickQuestions', [...(Array.isArray(botSettings.quickQuestions) ? botSettings.quickQuestions : []), ''])}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium font-google bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
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
                            placeholder={`Question ${idx + 1}`}
                          />
                          <button
                            onClick={() => {
                              const newQs = [...botSettings.quickQuestions];
                              newQs.splice(idx, 1);
                              updateSetting('quickQuestions', newQs);
                            }}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors shrink-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10"
                            aria-label={`Remove question ${idx + 1}`}
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Section>

              {/* Vertical agent (Phase 5 customise) — only for a pack bot */}
              {isVerticalBot && (
                <Section>
                  <p className={sectionHeadingCls}>
                    <span className="material-symbols-outlined text-[15px] text-slate-400">science</span>
                    {VERTICAL_LABEL[botSettings.vertical] || 'Vertical agent'}
                  </p>
                  <p className={sectionDescCls}>
                    Your industry pack pre-configures the agent. Customise the sample-request form your widget collects and where its submissions land.
                  </p>
                  <SampleFormEditor
                    fields={botSettings.sampleForm || []}
                    onChange={(f) => updateSetting('sampleForm', f)}
                    sinkUrl={botSettings.sampleSinkUrl || ''}
                    onSinkUrlChange={(v) => updateSetting('sampleSinkUrl', v)}
                    sinkSecret={botSettings.sampleSinkSecret || ''}
                    onSinkSecretChange={(v) => updateSetting('sampleSinkSecret', v)}
                    botId={selectedBotId}
                    authFetch={authFetch}
                    sinkStatus={botSettings.sinkStatus}
                  />
                </Section>
              )}
            </>
            )}

            {/* ═══ LEADS & INTEGRATIONS TAB ═══ */}
            {activeTab === 'leads' && (
            <>
              {hasIntegrationsAccess && (
                <Section>
                  <p className={sectionHeadingCls}>
                    <span className="material-symbols-outlined text-[15px] text-slate-400">webhook</span>
                    Integrations
                  </p>
                  <p className={sectionDescCls}>Forward captured leads and route visitors to a human.</p>
                  <div className={gridCls}>
                    <div className="relative">
                      {!canUseWebhooks && <LockOverlay label="Webhooks required" />}
                      <div className={!canUseWebhooks ? 'opacity-40 grayscale-[0.5] pointer-events-none blur-[0.5px]' : ''}>
                        <label className={labelCls}>Lead capture webhook URL</label>
                        <input
                          type="url"
                          value={botSettings.webhookUrl || ''}
                          onChange={e => updateSetting('webhookUrl', e.target.value)}
                          className={inputCls}
                          placeholder="https://hooks.zapier.com/..."
                        />
                      </div>
                    </div>
                    <div className="relative">
                      {!canUseHumanHandoff && <LockOverlay label="Human handoff required" />}
                      <div className={!canUseHumanHandoff ? 'opacity-40 grayscale-[0.5] pointer-events-none blur-[0.5px]' : ''}>
                        <label className={labelCls}>Human handoff — contact link</label>
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
                </Section>
              )}

              <Section className="relative">
                {!canUseLeadCapture && <LockOverlay label="Lead capture (Pro) required" />}
                <p className={sectionHeadingCls + (!canUseLeadCapture ? ' opacity-40' : '')}>
                  <span className="material-symbols-outlined text-[15px] text-slate-400">notifications_active</span>
                  Lead alerts &amp; notifications
                </p>
                <p className={sectionDescCls + (!canUseLeadCapture ? ' opacity-40' : '')}>Get notified when leads convert and decide where alerts land.</p>

                <div className={`${!canUseLeadCapture ? 'opacity-40 grayscale-[0.5] pointer-events-none blur-[0.5px]' : ''}`}>
                  {/* Alert toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className={toggleRowCls}>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium font-google text-slate-900 dark:text-slate-100">Instant hot-lead alerts</p>
                        <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">Email the moment a high-intent visitor converts.</p>
                      </div>
                      <Toggle
                        label="Instant hot-lead alerts"
                        checked={botSettings.hotLeadAlertsEnabled}
                        onChange={(v) => updateSetting('hotLeadAlertsEnabled', v)}
                        disabled={!canUseLeadCapture}
                      />
                    </div>
                    <div className={toggleRowCls}>
                      <div className="min-w-0">
                        <p className="text-[13px] font-medium font-google text-slate-900 dark:text-slate-100">Weekly results email</p>
                        <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">A weekly digest of new and hot leads.</p>
                      </div>
                      <Toggle
                        label="Weekly results email"
                        checked={botSettings.weeklyDigestEnabled}
                        onChange={(v) => updateSetting('weeklyDigestEnabled', v)}
                        disabled={!canUseLeadCapture}
                      />
                    </div>
                  </div>

                  {/* Recipient + booking */}
                  <div className={gridCls + ' mt-4'}>
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
                        className={inputCls + (alertEmailInvalid ? ' !border-red-400 dark:!border-red-500' : '')}
                        placeholder="Defaults to your account email"
                        aria-invalid={alertEmailInvalid}
                        aria-describedby="alert-email-hint"
                      />
                      <p id="alert-email-hint" className={`${helpCls} ${alertEmailInvalid ? '!text-red-500 dark:!text-red-400' : ''}`}>
                        {alertEmailInvalid
                          ? 'Enter a valid email address (e.g. you@company.com).'
                          : 'Used for hot-lead alerts and the weekly digest.'}
                      </p>
                    </div>

                    <div>
                      <label className={labelCls} htmlFor="booking-url">Booking link for hot leads</label>
                      <input
                        id="booking-url"
                        type="url"
                        spellCheck={false}
                        autoComplete="off"
                        value={botSettings.bookingUrl}
                        onChange={(e) => updateSetting('bookingUrl', e.target.value)}
                        className={inputCls + (bookingUrlInvalid ? ' !border-red-400 dark:!border-red-500' : '')}
                        placeholder="https://calendly.com/your-team/intro"
                        aria-invalid={bookingUrlInvalid}
                        aria-describedby="booking-url-hint"
                      />
                      <p id="booking-url-hint" className={`${helpCls} ${bookingUrlInvalid ? '!text-red-500 dark:!text-red-400' : ''}`}>
                        {bookingUrlInvalid
                          ? 'Must be a secure link (starts with https://).'
                          : 'Qualified leads see a “Book a call” button. Works with Calendly, Cal.com, etc.'}
                      </p>
                    </div>
                  </div>

                  {/* Slack */}
                  <div className="mt-4">
                    <label className={labelCls} htmlFor="slack-url">Slack channel — Incoming Webhook URL</label>
                    <input
                      id="slack-url"
                      type="url"
                      spellCheck={false}
                      autoComplete="off"
                      value={botSettings.slackWebhookUrl}
                      onChange={(e) => updateSetting('slackWebhookUrl', e.target.value)}
                      className={inputCls + (slackUrlInvalid ? ' !border-red-400 dark:!border-red-500' : '')}
                      placeholder="https://hooks.slack.com/services/..."
                      aria-invalid={slackUrlInvalid}
                      aria-describedby="slack-url-hint"
                    />
                    <p id="slack-url-hint" className={`${helpCls} ${slackUrlInvalid ? '!text-red-500 dark:!text-red-400' : ''}`}>
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
                </div>
              </Section>
            </>
            )}
            </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Sticky save bar — slides up when dirty */}
        <AnimatePresence>
          {isDirty && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="shrink-0 overflow-hidden"
            >
              <div className="px-5 md:px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur transition-colors">
                <div className={`${showPreview ? 'max-w-3xl' : ''} mx-auto flex items-center justify-between gap-3`}>
                  <p className="text-xs font-google text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                    </span>
                    Unsaved changes
                    <kbd className="hidden sm:inline-flex ml-1.5 px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-500 dark:text-slate-400">
                      {typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent) ? '⌘' : 'Ctrl'}+S
                    </kbd>
                  </p>
                  <button
                    onClick={handleSave}
                    disabled={isSaving || showFullOverlay}
                    className="sm:min-w-[140px] flex py-2 px-5 min-h-[40px] bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
                  >
                    {isSaving
                      ? <><div className="w-3.5 h-3.5 border-2 border-white/30 dark:border-slate-800/50 border-t-white dark:border-t-slate-800 rounded-full animate-spin" /> Saving…</>
                      : 'Save changes'
                    }
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Live preview panel — smooth slide ── */}
      <AnimatePresence>
        {showPreview && selectedBotId && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 'var(--preview-w)', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30, mass: 0.8 }}
            className="overflow-hidden shrink-0 border-t lg:border-t-0 lg:border-l border-slate-100 dark:border-slate-800 h-[68vh] lg:h-auto [--preview-w:100%] lg:[--preview-w:440px]"
          >
            <div className="flex items-center justify-center w-full lg:w-[440px] h-full p-4 lg:p-6">
              <div className="w-full max-w-[390px] h-full max-h-[660px] rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
                <ChatWidget key={selectedBotId} apiKey={selectedBotId} isEmbed={true} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Alert
        isOpen={alert.open}
        type={alert.type}
        message={alert.msg}
        onClose={() => setAlert(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
