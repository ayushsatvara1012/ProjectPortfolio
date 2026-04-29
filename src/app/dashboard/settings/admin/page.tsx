'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch } from '@/src/lib/hooks/useAuthenticatedFetch';
import SkeletonLoader from '@/src/app/components/SkeletonLoader';
import { customPlanConfigSchema } from '@/src/lib/validation/schemas';

// ── Tier config ───────────────────────────────────────────────────────────────
const TIERS = ['FREE', 'BASIC', 'STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM'];

const TIER_STYLE: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
  BASIC: 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 border border-sky-200 dark:border-sky-800',
  STARTER: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800',
  PRO: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800',
  ENTERPRISE: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-800',
  CUSTOM: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800',
  SUPER_ADMIN: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border border-rose-200 dark:border-rose-800',
};

const GEMINI_MODELS = [
  { value: '', label: 'Use tier default' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (cheapest)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (balanced)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (flagship)' },
  { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro Preview (next-gen)' },
];

const TOKEN_OPTIONS = [
  { value: '', label: 'Use tier default' },
  { value: 400, label: '400 tokens (concise)' },
  { value: 600, label: '600 tokens' },
  { value: 800, label: '800 tokens' },
  { value: 1200, label: '1,200 tokens (detailed)' },
  { value: 2048, label: '2,048 tokens (maximum)' },
];

const FEATURE_FLAGS = [
  { key: 'human_handoff', label: 'Human Handoff', icon: 'support_agent', desc: 'Talk-to-human button + transcript email' },
  { key: 'lead_capture', label: 'Lead Capture', icon: 'contact_mail', desc: 'Collect visitor email/name in widget' },
  { key: 'white_label', label: 'White Label', icon: 'branding_watermark', desc: 'Remove "Powered by Sapybase"' },
  { key: 'webhook', label: 'Webhooks', icon: 'webhook', desc: 'Zapier / Make integration' },
  { key: 'custom_logo', label: 'Custom Logo', icon: 'image', desc: 'Upload own logo URL' },
  { key: 'analytics', label: 'Analytics', icon: 'bar_chart', desc: 'Insights & ROI reports' },
];

const BLANK_CUSTOM_CONFIG = {
  plan_name: '',
  monthly_price_usd: '',
  max_bots: '',
  max_messages: '',
  max_chunks: '',
  gemini_model: '',
  max_output_tokens: '',
  human_handoff: false,
  lead_capture: false,
  white_label: false,
  webhook: false,
  custom_logo: false,
  analytics: false,
  notes: '',
};

const TierBadge = ({ tier }: { tier: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-google font-bold uppercase tracking-widest rounded-none ${TIER_STYLE[tier] || TIER_STYLE.FREE}`}>
    {tier || 'FREE'}
  </span>
);

const StatusBadge = ({ status }: { status: string }) => {
  const active = status !== 'suspended';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-google font-bold uppercase tracking-widest rounded-none ${active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {active ? 'Active' : 'Suspended'}
    </span>
  );
};

// ── Usage bar ─────────────────────────────────────────────────────────────────
const UsageBar = ({ used = 0, limit = 0 }: { used?: number; limit?: number }) => {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] font-google font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
          {used.toLocaleString()} / {limit > 0 ? limit.toLocaleString() : '∞'}
        </span>
        <span className="text-[10px] font-google font-bold text-slate-400 dark:text-slate-500">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 w-full bg-gray-100 dark:bg-slate-800">
        <div className={`h-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

// ── Toggle switch ─────────────────────────────────────────────────────────────
const Toggle = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${checked ? 'bg-blue-600' : 'bg-gray-200 dark:bg-slate-700'}`}
    role="switch"
    aria-checked={checked}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    <span className="sr-only">{label}</span>
  </button>
);

// ── Section header ────────────────────────────────────────────────────────────
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
    {children}
  </label>
);

// ── Number input ──────────────────────────────────────────────────────────────
const NumInput = ({ label, value, onChange, placeholder, disabled, hint }: { label: string; value: any; onChange: (v: string) => void; placeholder: string; disabled?: boolean; hint?: string }) => (
  <div>
    <SectionLabel>{label}</SectionLabel>
    <input
      type="number"
      min={0}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:opacity-50 rounded-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
    />
    {hint && <p className="text-[10px] font-google text-slate-400 dark:text-slate-500 mt-1">{hint}</p>}
  </div>
);

// ── Manage Slide-Over ─────────────────────────────────────────────────────────
const ManageSlideOver = ({ user, onClose, onSave, isSaving }: { user: any; onClose: () => void; onSave: (p: any) => void; isSaving: boolean }) => {
  const existingCfg = user.custom_plan_config || {};
  const isCustom = user.tier === 'CUSTOM';

  const [draft, setDraft] = useState({
    tier: user.tier || 'FREE',
    status: user.status || 'active',
    custom_plan_enabled: isCustom,
    cfg: {
      ...BLANK_CUSTOM_CONFIG,
      ...(isCustom ? {
        plan_name: existingCfg.plan_name || '',
        monthly_price_usd: existingCfg.monthly_price_usd ?? '',
        max_bots: existingCfg.max_bots ?? '',
        max_messages: existingCfg.max_messages ?? '',
        max_chunks: existingCfg.max_chunks ?? '',
        gemini_model: existingCfg.gemini_model || '',
        max_output_tokens: existingCfg.max_output_tokens ?? '',
        human_handoff: !!existingCfg.human_handoff,
        lead_capture: !!existingCfg.lead_capture,
        white_label: !!existingCfg.white_label,
        webhook: !!existingCfg.webhook,
        custom_logo: !!existingCfg.custom_logo,
        analytics: !!existingCfg.analytics,
        notes: existingCfg.notes || '',
      } : {}),
    } as any,
  });

  const set = (key: string, val: any) => setDraft(d => ({ ...d, [key]: val }));
  const setCfg = (key: string, val: any) => setDraft(d => ({ ...d, cfg: { ...d.cfg, [key]: val } }));

  const handleTierChange = (newTier: string) => {
    set('tier', newTier);
    if (newTier === 'CUSTOM') {
      set('custom_plan_enabled', true);
    } else {
      set('custom_plan_enabled', false);
    }
  };

  const handleToggleCustom = (enabled: boolean) => {
    set('custom_plan_enabled', enabled);
    if (enabled) {
      set('tier', 'CUSTOM');
    } else {
      set('tier', user.tier === 'CUSTOM' ? 'FREE' : user.tier);
    }
  };

  const numVal = (v: any) => (v === '' || v === null || v === undefined) ? null : Number(v);

  const validate = () => {
    if (!draft.custom_plan_enabled) return true;
    const c = draft.cfg;
    return (
      (c.max_bots === '' || Number(c.max_bots) >= 0) &&
      (c.max_messages === '' || Number(c.max_messages) >= 0) &&
      (c.max_chunks === '' || Number(c.max_chunks) >= 0) &&
      (c.monthly_price_usd === '' || Number(c.monthly_price_usd) >= 0)
    );
  };
  const isValid = validate();

  const handleSave = () => {
    if (!isValid || isSaving) return;
    const payload: any = {
      tier: draft.custom_plan_enabled ? 'CUSTOM' : draft.tier,
      status: draft.status,
    };
    if (draft.custom_plan_enabled) {
      const c = draft.cfg;
      const candidate = {
        plan_name: c.plan_name || 'Custom Plan',
        monthly_price_usd: c.monthly_price_usd === '' ? 0 : c.monthly_price_usd,
        max_bots: c.max_bots === '' ? 1 : c.max_bots,
        max_messages: c.max_messages === '' ? 500 : c.max_messages,
        max_chunks: c.max_chunks === '' ? 100 : c.max_chunks,
        gemini_model: c.gemini_model || undefined,
        max_output_tokens: c.max_output_tokens === '' ? undefined : c.max_output_tokens,
        human_handoff: !!c.human_handoff,
        lead_capture: !!c.lead_capture,
        white_label: !!c.white_label,
        webhook: !!c.webhook,
        custom_logo: !!c.custom_logo,
        analytics: !!c.analytics,
        notes: c.notes || '',
      };
      const parsed = customPlanConfigSchema.safeParse(candidate);
      if (!parsed.success) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('Sapybase:toast', {
            detail: { kind: 'error', message: parsed.error.issues[0]?.message || 'Invalid plan config.' },
          }));
        }
        return;
      }
      payload.custom_plan_config = {
        ...parsed.data,
        gemini_model: parsed.data.gemini_model ?? null,
        max_output_tokens: parsed.data.max_output_tokens ?? null,
      };
    }
    onSave(payload);
  };

  const companies = Array.isArray(user.companies) ? user.companies : [];

  return (
    <div className="fixed inset-0 z-100 flex" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="ml-auto relative z-110 flex flex-col w-full max-w-lg h-full bg-white dark:bg-slate-950 border-l border-gray-100 dark:border-slate-800 shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 sm:p-6 border-b border-gray-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-950 z-10">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <TierBadge tier={draft.custom_plan_enabled ? 'CUSTOM' : draft.tier} />
              <StatusBadge status={draft.status} />
              {user.role === 'SUPER_ADMIN' && <TierBadge tier="SUPER_ADMIN" />}
            </div>
            <p className="text-sm font-google font-bold text-slate-900 dark:text-slate-100 truncate" title={user.email}>{user.email}</p>
            <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">{user.clerk_id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors shrink-0">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-4 sm:p-6 space-y-6">

          {/* Access Tier */}
          <div>
            <SectionLabel>Access Tier</SectionLabel>
            <select
              value={draft.custom_plan_enabled ? 'CUSTOM' : draft.tier}
              onChange={e => handleTierChange(e.target.value)}
              disabled={isSaving}
              className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google font-bold text-slate-900 dark:text-slate-200 uppercase tracking-widest focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:opacity-50 rounded-none"
            >
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* Account Status */}
          <div>
            <SectionLabel>Account Status</SectionLabel>
            <button
              type="button"
              onClick={() => set('status', draft.status === 'suspended' ? 'active' : 'suspended')}
              disabled={isSaving}
              className={`w-full flex items-center justify-between px-4 py-3 border text-sm font-google font-bold uppercase tracking-widest transition-colors disabled:opacity-50 ${draft.status === 'suspended'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
                : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'
                }`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">{draft.status === 'suspended' ? 'block' : 'check_circle'}</span>
                {draft.status === 'suspended' ? 'Activate Account' : 'Suspend Account'}
              </span>
              <StatusBadge status={draft.status} />
            </button>
          </div>

          {/* ── Custom Plan Builder ─────────────────────────────── */}
          <div className={`border-2 transition-colors ${draft.custom_plan_enabled ? 'border-emerald-400 dark:border-emerald-600' : 'border-gray-100 dark:border-slate-800'}`}>
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">build</span>
                </div>
                <div>
                  <p className="text-sm font-google font-bold text-slate-900 dark:text-slate-100">Custom Plan Builder</p>
                  <p className="text-[10px] font-google text-slate-400 dark:text-slate-500">Agency / white-glove configuration</p>
                </div>
              </div>
              <Toggle
                checked={draft.custom_plan_enabled}
                onChange={handleToggleCustom}
                label="Enable custom plan"
                disabled={isSaving}
              />
            </div>

            <AnimatePresence>
              {draft.custom_plan_enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-4 space-y-5 border-t border-gray-100 dark:border-slate-800 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <SectionLabel>Plan Label</SectionLabel>
                        <input
                          type="text"
                          placeholder="e.g. Agency Pro"
                          value={draft.cfg.plan_name}
                          onChange={e => setCfg('plan_name', e.target.value)}
                          disabled={isSaving}
                          className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:opacity-50 rounded-none"
                        />
                      </div>
                      <div>
                        <NumInput
                          label="Monthly Price (USD)"
                          value={draft.cfg.monthly_price_usd}
                          onChange={v => setCfg('monthly_price_usd', v)}
                          placeholder="e.g. 299"
                          disabled={isSaving}
                          hint="For your records only"
                        />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[12px]">tune</span>
                        Resource Limits
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <NumInput label="Max Bots" value={draft.cfg.max_bots} onChange={v => setCfg('max_bots', v)} placeholder="10" disabled={isSaving} />
                        <NumInput label="Messages / mo" value={draft.cfg.max_messages} onChange={v => setCfg('max_messages', v)} placeholder="5000" disabled={isSaving} />
                        <NumInput label="Storage(chunks)" value={draft.cfg.max_chunks} onChange={v => setCfg('max_chunks', v)} placeholder="1000" disabled={isSaving} />
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                        AI Model Configuration
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <SectionLabel>Gemini Model</SectionLabel>
                          <select value={draft.cfg.gemini_model} onChange={e => setCfg('gemini_model', e.target.value)} disabled={isSaving} className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:opacity-50 rounded-none">
                            {GEMINI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <SectionLabel>Max Output Tokens</SectionLabel>
                          <select value={draft.cfg.max_output_tokens} onChange={e => setCfg('max_output_tokens', e.target.value)} disabled={isSaving} className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:opacity-50 rounded-none">
                            {TOKEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[12px]">toggle_on</span>
                        Feature Access
                      </p>
                      <div className="space-y-0 border border-gray-100 dark:border-slate-800">
                        {FEATURE_FLAGS.map((f, i) => (
                          <div key={f.key} className={`flex items-center justify-between px-4 py-3 ${i < FEATURE_FLAGS.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}>
                            <div className="flex items-center gap-3">
                              <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">{f.icon}</span>
                              <div>
                                <p className="text-xs font-google font-bold text-slate-900 dark:text-slate-200">{f.label}</p>
                                <p className="text-[10px] font-google text-slate-400 dark:text-slate-500">{f.desc}</p>
                              </div>
                            </div>
                            <Toggle checked={!!draft.cfg[f.key]} onChange={v => setCfg(f.key, v)} label={f.label} disabled={isSaving} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <SectionLabel>Internal Notes</SectionLabel>
                      <textarea rows={2} placeholder="Deal notes..." value={draft.cfg.notes} onChange={e => setCfg('notes', e.target.value)} disabled={isSaving} className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:opacity-50 rounded-none resize-none" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div>
            <SectionLabel>Deployed Bots ({companies.length})</SectionLabel>
            {companies.length === 0 ? (
              <p className="text-[10px] font-google text-slate-400 text-center py-4 border border-dashed border-gray-100">No bots.</p>
            ) : (
              <div className="space-y-2">
                {companies.map((bot: any, i: number) => (
                  <div key={bot.id || i} className="p-3 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 flex justify-between items-center">
                    <div>
                      <p className="text-sm font-google font-semibold text-slate-900 dark:text-slate-200">{bot.bot_name || 'Unnamed'}</p>
                      <a href={bot.allowed_origin} target="_blank" className="text-[10px] font-mono text-blue-400 underline">{bot.allowed_origin || 'No origin'}</a>
                    </div>
                    <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase ${bot.is_active !== false ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-slate-500 border border-gray-200'}`}>
                      {bot.is_active !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 p-4 flex gap-3">
          <button onClick={onClose} disabled={isSaving} className="flex-1 px-4 py-3 text-sm font-google font-bold uppercase tracking-widest border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors disabled:opacity-50">Cancel</button>
          <button onClick={handleSave} disabled={isSaving || !isValid} className="flex-1 px-4 py-3 text-sm font-google font-bold uppercase tracking-widest bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const { userRole } = useUserRole();
  const authFetch = useAuthenticatedFetch();
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => authFetch('/api/admin/users') as Promise<any>,
    enabled: isLoaded && !!user && userRole === 'SUPER_ADMIN',
  });

  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => authFetch('/api/admin/stats') as Promise<any>,
    enabled: isLoaded && !!user && userRole === 'SUPER_ADMIN',
  });

  const users = usersQuery.data || [];
  const stats = statsQuery.data || { total_users: 0, total_companies: 0, active_bots: 0, total_messages: 0, custom_plan_count: 0 };
  const isLoading = usersQuery.isLoading || statsQuery.isLoading;

  const limitsMutation = useMutation({
    mutationFn: ({ clerkId, payload }: { clerkId: string; payload: any }) =>
      authFetch(`/api/admin/users/${clerkId}/limits`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setSelectedUser(null);
    },
  });

  const filteredUsers = users.filter((u: any) => {
    const term = searchTerm.toLowerCase();
    const matchesTerm = !term || u.email?.toLowerCase().includes(term) || u.clerk_id?.toLowerCase().includes(term);
    const matchesTier = tierFilter === 'ALL' || u.tier === tierFilter;
    return matchesTerm && matchesTier;
  });

  if (userRole !== 'SUPER_ADMIN') {
    return <div className="p-20 text-center">Unauthorized. Super Admin only.</div>;
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-100 dark:border-slate-800 px-4 py-5 sm:px-6 sm:py-8">
        <h1 className="text-lg sm:text-xl md:text-2xl font-display font-black uppercase tracking-tight leading-tight">
          Super Admin <span className="text-slate-400">Console</span>
        </h1>
        <div className="mt-4 flex flex-col md:flex-row gap-3 sm:gap-4">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="flex-1 max-w-full md:max-w-md bg-gray-50 dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-4 py-2.5 text-md font-medium outline-none"
          />
          <div className="-mx-4 sm:-mx-6 md:mx-0 px-4 sm:px-6 md:px-0 overflow-x-auto scrollbar-hide">
            <div className="flex gap-1 min-w-max ">
              {['ALL', ...TIERS].map(t => (
                <button
                  key={t}
                  onClick={() => setTierFilter(t)}
                  className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${tierFilter === t ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'text-slate-500 hover:bg-gray-100'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-px bg-gray-100 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800">
        {[
          { label: 'Total Users', value: stats.total_users, icon: 'group' },
          { label: 'Total Bots', value: stats.total_companies, icon: 'smart_toy' },
          { label: 'Active Bots', value: stats.active_bots, icon: 'bolt' },
          { label: 'Messages', value: stats.total_messages?.toLocaleString(), icon: 'forum' },
          { label: 'Custom Plans', value: stats.custom_plan_count, icon: 'build' },
        ].map((s, i) => (
          <div key={i} className="bg-white dark:bg-slate-900 p-4 sm:p-6">
            <p className="text-[9px] sm:text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1 truncate">{s.label}</p>
            <h3 className="text-base sm:text-lg md:text-xl font-display font-bold truncate">{s.value}</h3>
          </div>
        ))}
      </div>

      {/* Users — table on md+, stacked cards on mobile */}
      <div className="flex-1 p-4 sm:p-6 bg-white">
        {isLoading ? <SkeletonLoader.Table /> : (
          <>
            {/* Desktop / tablet: traditional table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-800 text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    <th className="py-4 px-2">User / Clerk ID</th>
                    <th className="py-4 px-2">Tier / Status</th>
                    <th className="py-4 px-2">Usage</th>
                    <th className="py-4 px-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-900">
                  {filteredUsers.map((u: any) => (
                    <tr key={u.clerk_id} className="hover:bg-gray-50/50 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="py-4 px-2 min-w-0">
                        <p className="text-md font-google truncate max-w-[260px]">{u.email}</p>
                        <p className="text-[10px] font-mono text-slate-400 truncate max-w-[260px]">{u.clerk_id}</p>
                      </td>
                      <td className="py-4 px-2 space-y-1">
                        <TierBadge tier={u.tier} />
                        <br />
                        <StatusBadge status={u.status} />
                      </td>
                      <td className="py-4 px-2">
                        <UsageBar used={u.usage_tracking?.messages_used} limit={u.usage_tracking?.message_limit} />
                      </td>
                      <td className="py-4 px-2 text-right">
                        <button onClick={() => setSelectedUser(u)} className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-slate-900 dark:bg-slate-800 text-white hover:bg-blue-600 transition-colors">Manage</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile: each user as a stacked card so user / tier / usage / action
                stack vertically instead of being scrolled horizontally. */}
            <div className="md:hidden flex flex-col gap-3">
              {filteredUsers.map((u: any) => (
                <div
                  key={u.clerk_id}
                  className="bg-white dark:bg-slate-900 border border-gray-100 dark:border-slate-800 rounded-sm p-4 flex flex-col gap-3 min-w-0"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">User</p>
                    <p className="text-md font-google font-semibold break-all">{u.email}</p>
                    <p className="text-[10px] font-mono text-slate-400 break-all">{u.clerk_id}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mr-1">Tier</span>
                    <TierBadge tier={u.tier} />
                    <StatusBadge status={u.status} />
                  </div>

                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Usage</p>
                    <UsageBar used={u.usage_tracking?.messages_used} limit={u.usage_tracking?.message_limit} />
                  </div>

                  <button
                    onClick={() => setSelectedUser(u)}
                    className="self-start px-3 py-2 min-h-[40px] text-[10px] font-bold uppercase tracking-widest bg-slate-900 dark:bg-slate-800 text-white hover:bg-blue-600 transition-colors"
                  >
                    Manage
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <AnimatePresence>
        {selectedUser && (
          <ManageSlideOver
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            isSaving={limitsMutation.isPending}
            onSave={(payload) => limitsMutation.mutate({ clerkId: selectedUser.clerk_id, payload })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
