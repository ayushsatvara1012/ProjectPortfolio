'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '@/src/lib/context/UserContext';
import { useAuthenticatedFetch } from '@/src/lib/hooks/useAuthenticatedFetch';
import SkeletonLoader from '@/src/components/ui/SkeletonLoader';
import { customPlanConfigSchema } from '@/src/lib/validation/schemas';
import ExploreEnquiriesTab from './ExploreEnquiriesTab';
import ByodTab from './ByodTab';
import AgentRequestsTab from './AgentRequestsTab';

// ── Tier config ───────────────────────────────────────────────────────────────
const TIERS = ['FREE', 'EXPLORE', 'STARTER', 'PRO', 'BUSINESS', 'ENTERPRISE', 'CUSTOM'];

const TIER_LABELS: Record<string, string> = {
  FREE: 'Free', EXPLORE: 'Explore', STARTER: 'Starter',
  PRO: 'Growth', BUSINESS: 'Scale', ENTERPRISE: 'Enterprise', CUSTOM: 'Custom',
};

const TIER_STYLE: Record<string, string> = {
  FREE: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  EXPLORE: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  STARTER: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PRO: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  BUSINESS: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  ENTERPRISE: 'bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  CUSTOM: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  SUPER_ADMIN: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
};

const SUB_STATUS_STYLE: Record<string, string> = {
  ACTIVE:           'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  TRIAL_ACTIVE:     'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  AWAITING_PAYMENT: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  PAYMENT_FAILED:   'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  SUSPENDED:        'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  CANCELED:         'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  PAUSED:           'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  EXPIRED:          'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  REVOKED:          'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  REFUNDED:         'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const SUB_STATUS_DOT: Record<string, string> = {
  ACTIVE: 'bg-emerald-500', TRIAL_ACTIVE: 'bg-sky-500',
  AWAITING_PAYMENT: 'bg-amber-500', PAYMENT_FAILED: 'bg-red-500',
  SUSPENDED: 'bg-red-500', CANCELED: 'bg-slate-400',
  PAUSED: 'bg-amber-400', EXPIRED: 'bg-slate-400',
  REVOKED: 'bg-red-500', REFUNDED: 'bg-slate-400',
};

const GEMINI_MODELS = [
  { value: '', label: 'Use tier default' },
  { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite (cheapest)' },
  { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (balanced)' },
  { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (flagship)' },
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
  { key: 'advanced_bot', label: 'Advanced behavior', icon: 'psychology', desc: 'System prompt, tone, quick questions' },
  { key: 'human_handoff', label: 'Human handoff', icon: 'support_agent', desc: 'Talk-to-human button + transcript email' },
  { key: 'lead_capture', label: 'Lead capture', icon: 'contact_mail', desc: 'Collect visitor email / name in widget' },
  { key: 'white_label', label: 'White label', icon: 'branding_watermark', desc: 'Remove "Vaayu Intelligence" badge' },
  { key: 'webhook', label: 'Webhooks', icon: 'webhook', desc: 'Zapier / Make integration' },
  { key: 'custom_logo', label: 'Custom logo', icon: 'image', desc: 'Upload own logo URL' },
  { key: 'analytics', label: 'Analytics', icon: 'bar_chart', desc: 'Insights & ROI reports' },
  { key: 'byo_database', label: 'Bring Your Own Database', icon: 'database', desc: 'Client connects their own Postgres (BYOD)' },
];

const ACTION_LABELS: Record<string, string> = {
  activate: 'Activate', suspend: 'Suspend', reactivate: 'Reactivate',
  cancel: 'Cancel subscription', extend: 'Extend billing period',
  reset: 'Reset product ID',
};

const ACTION_STYLE: Record<string, string> = {
  activate: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  reactivate: 'bg-emerald-600 hover:bg-emerald-500 text-white',
  suspend: 'bg-red-600 hover:bg-red-500 text-white',
  cancel: 'bg-red-600 hover:bg-red-500 text-white',
  extend: 'bg-blue-600 hover:bg-blue-500 text-white',
  reset: 'bg-orange-600 hover:bg-orange-500 text-white',
};

const BLANK_CUSTOM_CONFIG = {
  plan_name: '',
  monthly_price_usd: '',
  trial_days: 14,
  max_bots: '',
  max_messages: '',
  max_chunks: '',
  gemini_model: '',
  max_output_tokens: '',
  advanced_bot: false,
  human_handoff: false,
  lead_capture: false,
  white_label: false,
  webhook: false,
  custom_logo: false,
  analytics: false,
  byo_database: false,
  notes: '',
};

// ── Shared small components ───────────────────────────────────────────────────
const TierBadge = ({ tier }: { tier: string }) => (
  <span className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium font-google rounded-full ${TIER_STYLE[tier] || TIER_STYLE.FREE}`}>
    {TIER_LABELS[tier] || tier || 'Free'}
  </span>
);

const StatusBadge = ({ status }: { status: string }) => {
  const active = status !== 'suspended';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium font-google rounded-full ${active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
      {active ? 'Active' : 'Suspended'}
    </span>
  );
};

const SubscriptionStatusBadge = ({ status }: { status: string }) => {
  const style = SUB_STATUS_STYLE[status] || SUB_STATUS_STYLE.EXPIRED;
  const dot = SUB_STATUS_DOT[status] || 'bg-slate-400';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium font-google rounded-full ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
      {status?.replace(/_/g, ' ') || 'Unknown'}
    </span>
  );
};

const UsageBar = ({ used = 0, limit = 0 }: { used?: number; limit?: number }) => {
  const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-blue-500';
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium font-google text-slate-400 dark:text-slate-500">
          {used.toLocaleString()} / {limit > 0 ? limit.toLocaleString() : '∞'}
        </span>
        <span className="text-xs font-medium font-google text-slate-400 dark:text-slate-500">{Math.round(pct)}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const Toggle = ({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) => (
  <button
    type="button"
    onClick={() => !disabled && onChange(!checked)}
    disabled={disabled}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed ${checked ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'}`}
    role="switch"
    aria-checked={checked}
  >
    <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
    <span className="sr-only">{label}</span>
  </button>
);

const inputCls = "w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 focus:bg-slate-200 dark:focus:bg-slate-700 focus:outline-none text-base font-google text-slate-900 dark:text-slate-200 rounded-xl transition-colors disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
const selectCls = "w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 focus:bg-slate-200 dark:focus:bg-slate-700 focus:outline-none text-base font-google text-slate-900 dark:text-slate-200 rounded-xl transition-colors disabled:opacity-50";
const labelCls = "block text-base font-medium font-google text-slate-600 dark:text-slate-400 mb-2";

const NumInput = ({ label, value, onChange, placeholder, disabled, hint }: { label: string; value: any; onChange: (v: string) => void; placeholder: string; disabled?: boolean; hint?: string }) => (
  <div>
    <label className={labelCls}>{label}</label>
    <input
      type="number"
      min={0}
      placeholder={placeholder}
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={inputCls}
    />
    {hint && <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-1.5">{hint}</p>}
  </div>
);

// ── Quick Action Modal ────────────────────────────────────────────────────────
const QuickActionModal = ({
  action, targetUser, onConfirm, onClose, isPending,
}: {
  action: string; targetUser: any; onConfirm: (payload: any) => void; onClose: () => void; isPending: boolean;
}) => {
  const [reason, setReason] = useState('');
  const [extendDays, setExtendDays] = useState(30);

  const handleConfirm = () => {
    onConfirm({
      action,
      reason: reason.trim() || undefined,
      ...(action === 'extend' ? { extend_days: extendDays } : {}),
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative z-10 w-full sm:max-w-md bg-white dark:bg-slate-950 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 sm:p-6">
          <div>
            <p className="text-base font-semibold font-google text-slate-900 dark:text-slate-100">{ACTION_LABELS[action] || action}</p>
            <p className="text-xs font-google text-slate-400 dark:text-slate-500 truncate max-w-[240px] mt-0.5">{targetUser?.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded-lg">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 sm:px-6 pb-4 space-y-4">
          {action === 'extend' && (
            <div>
              <label className={labelCls}>Extend by (days)</label>
              <input
                type="number"
                min={1}
                max={365}
                value={extendDays}
                onChange={e => setExtendDays(Number(e.target.value))}
                className={inputCls}
              />
              <p className="text-xs font-google text-slate-400 mt-1.5">1–365 days</p>
            </div>
          )}
          <div>
            <label className={labelCls}>Reason (optional)</label>
            <textarea
              rows={3}
              maxLength={500}
              placeholder="Reason for this action..."
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 focus:bg-slate-200 dark:focus:bg-slate-700 focus:outline-none text-base font-google text-slate-900 dark:text-slate-200 rounded-xl transition-colors resize-none"
            />
            <p className="text-xs font-google text-slate-400 text-right mt-1">{reason.length}/500</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-5 sm:px-6 pb-5 sm:pb-6">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-3 text-base font-semibold font-google rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isPending || (action === 'extend' && (extendDays < 1 || extendDays > 365))}
            className={`flex-1 px-4 py-3 text-base font-semibold font-google rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${ACTION_STYLE[action] || 'bg-slate-900 text-white hover:bg-slate-800'}`}
          >
            {isPending && <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>}
            {isPending ? 'Applying…' : 'Confirm'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ── Vertical editor (per-bot, admin-only) ────────────────────────────────────
// Locked to SUPER_ADMIN per docs/vertical-lock-plan.md — this is the only place
// a bot's vertical can be changed. Dropdown is sourced from the same registry
// allowlist the backend validates against (GET /api/admin/verticals), so there
// is no second hardcoded list of verticals to drift out of sync.
const VERTICAL_LABELS: Record<string, string> = { chemical: 'Chemical industry' };

const VerticalEditor = ({
  bot, verticals, onChange, isPending,
}: {
  bot: any; verticals: string[]; onChange: (companyId: string, vertical: string | null) => void; isPending: boolean;
}) => {
  const current: string = bot.vertical || '';
  const [draft, setDraft] = useState(current);
  const [confirming, setConfirming] = useState(false);

  const label = (v: string) => (v ? (VERTICAL_LABELS[v] || v) : 'Generic');

  if (confirming) {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
        <span className="material-symbols-outlined text-[14px] text-amber-600 dark:text-amber-400 shrink-0">warning</span>
        <p className="text-xs font-google text-amber-800 dark:text-amber-300 flex-1 min-w-[140px]">
          Change vertical from <strong>{label(current)}</strong> to <strong>{label(draft)}</strong>?
          This immediately changes the live bot&rsquo;s tools, prompts, and RAG scope.
        </p>
        <div className="flex gap-2 shrink-0">
          <button type="button" onClick={() => setConfirming(false)} disabled={isPending}
            className="px-3 py-1.5 text-xs font-semibold font-google rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 disabled:opacity-50">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onChange(bot.id, draft || null); setConfirming(false); }}
            disabled={isPending}
            className="px-3 py-1.5 text-xs font-semibold font-google rounded-lg bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 flex items-center gap-1.5"
          >
            {isPending && <span className="material-symbols-outlined text-[12px] animate-spin">progress_activity</span>}
            Confirm change
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 mt-2">
      <select
        value={draft}
        onChange={e => setDraft(e.target.value)}
        disabled={isPending}
        className="px-2.5 py-1.5 bg-slate-100 dark:bg-slate-800 text-xs font-google text-slate-700 dark:text-slate-300 rounded-lg outline-none disabled:opacity-50"
      >
        <option value="">Generic (no vertical)</option>
        {verticals.map(v => <option key={v} value={v}>{label(v)}</option>)}
      </select>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        disabled={isPending || draft === current}
        className="px-3 py-1.5 text-xs font-semibold font-google rounded-lg bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Save
      </button>
    </div>
  );
};

// ── Manage Slide-Over ─────────────────────────────────────────────────────────
const ManageModal = ({ user, onClose, onSave, isSaving, verticals, onChangeVertical, isVerticalPending }: { user: any; onClose: () => void; onSave: (p: any) => void; isSaving: boolean; verticals: string[]; onChangeVertical: (companyId: string, vertical: string | null) => void; isVerticalPending: boolean }) => {
  const authFetch = useAuthenticatedFetch();
  const queryClient = useQueryClient();
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
        trial_days: existingCfg.trial_days ?? 14,
        max_bots: existingCfg.max_bots ?? '',
        max_messages: existingCfg.max_messages ?? '',
        max_chunks: existingCfg.max_chunks ?? '',
        gemini_model: existingCfg.gemini_model || '',
        max_output_tokens: existingCfg.max_output_tokens ?? '',
        advanced_bot: !!existingCfg.advanced_bot,
        human_handoff: !!existingCfg.human_handoff,
        lead_capture: !!existingCfg.lead_capture,
        white_label: !!existingCfg.white_label,
        webhook: !!existingCfg.webhook,
        custom_logo: !!existingCfg.custom_logo,
        analytics: !!existingCfg.analytics,
        byo_database: !!existingCfg.byo_database,
        notes: existingCfg.notes || '',
      } : {}),
    } as any,
  });

  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(existingCfg.polar_checkout_url ?? null);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const set = (key: string, val: any) => setDraft(d => ({ ...d, [key]: val }));
  const setCfg = (key: string, val: any) => setDraft(d => ({ ...d, cfg: { ...d.cfg, [key]: val } }));

  const handleTierChange = (newTier: string) => {
    set('tier', newTier);
    set('custom_plan_enabled', newTier === 'CUSTOM');
  };

  const handleToggleCustom = (enabled: boolean) => {
    set('custom_plan_enabled', enabled);
    set('tier', enabled ? 'CUSTOM' : (user.tier === 'CUSTOM' ? 'FREE' : user.tier));
  };

  const buildCandidate = () => {
    const c = draft.cfg;
    return {
      plan_name: c.plan_name || 'Custom Plan',
      monthly_price_usd: c.monthly_price_usd === '' ? 0 : Number(c.monthly_price_usd),
      trial_days: c.trial_days === '' ? 14 : Number(c.trial_days),
      max_bots: c.max_bots === '' ? 1 : Number(c.max_bots),
      max_messages: c.max_messages === '' ? 500 : Number(c.max_messages),
      max_chunks: c.max_chunks === '' ? 100 : Number(c.max_chunks),
      gemini_model: c.gemini_model || undefined,
      max_output_tokens: c.max_output_tokens === '' ? undefined : Number(c.max_output_tokens),
      advanced_bot: !!c.advanced_bot,
      human_handoff: !!c.human_handoff,
      lead_capture: !!c.lead_capture,
      white_label: !!c.white_label,
      webhook: !!c.webhook,
      custom_logo: !!c.custom_logo,
      analytics: !!c.analytics,
      byo_database: !!c.byo_database,
      notes: c.notes || '',
    };
  };

  const handleProvision = async () => {
    setIsProvisioning(true);
    try {
      const res = await authFetch(`/api/admin/users/${user.clerk_id}/custom-plan/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: buildCandidate() }),
      }) as any;
      setCheckoutUrl(res.checkout_url);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'custom-plan-dashboard'] });
      window.dispatchEvent(new CustomEvent('Sapybase:toast', {
        detail: { kind: 'success', message: 'Polar product created. Copy the checkout link below.' },
      }));
    } catch (err: any) {
      const msg = String(err?.message || '');
      let display: string;
      if (msg === 'AUTH_REQUIRED') display = 'Session expired. Sign out and sign back in, then try again.';
      else if (msg.includes('already has a linked Polar') || msg.includes('already provisioned')) display = 'This plan is already provisioned in Polar.';
      else if (msg.includes('POLAR_ACCESS_TOKEN') || msg.includes('not configured')) display = 'Polar API token not configured. Contact support.';
      else if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('reach Polar')) display = 'Polar API is unavailable. Please try again in a moment.';
      else if (msg.includes('greater than 0') || msg.includes('trial_days') || msg.includes('price')) display = 'Invalid plan config — price must be > $0 and trial days 0–30.';
      else if (msg === 'FORBIDDEN') display = 'Access denied. Super Admin required.';
      else if (msg && msg !== 'undefined') display = msg;
      else display = 'Provision failed. Check the server logs for details.';
      window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind: 'error', message: display } }));
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleCopyUrl = () => {
    const url = checkoutUrl || existingCfg.polar_checkout_url;
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    });
  };

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
      const candidate = buildCandidate();
      const parsed = customPlanConfigSchema.safeParse(candidate);
      if (!parsed.success) {
        window.dispatchEvent(new CustomEvent('Sapybase:toast', {
          detail: { kind: 'error', message: parsed.error.issues[0]?.message || 'Invalid plan config.' },
        }));
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 lg:p-8" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 dark:bg-slate-950/80 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="relative z-[110] flex flex-col w-full h-full bg-white dark:bg-slate-950 shadow-2xl overflow-y-auto rounded-2xl"
        data-lenis-prevent
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 sm:p-6 sticky top-0 bg-white dark:bg-slate-950 z-10 border-b border-slate-100 dark:border-slate-800">
          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <TierBadge tier={draft.custom_plan_enabled ? 'CUSTOM' : draft.tier} />
              <StatusBadge status={draft.status} />
              {user.role === 'SUPER_ADMIN' && <TierBadge tier="SUPER_ADMIN" />}
            </div>
            <p className="text-base font-semibold font-google text-slate-900 dark:text-slate-100 truncate" title={user.email}>{user.email}</p>
            <p className="text-xs font-mono text-slate-400 dark:text-slate-500 mt-0.5 truncate">{user.clerk_id}</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors rounded-lg shrink-0">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-5 sm:p-6 space-y-5">

          {/* Access Tier */}
          <div>
            <label className={labelCls}>Access tier</label>
            <select
              value={draft.custom_plan_enabled ? 'CUSTOM' : draft.tier}
              onChange={e => handleTierChange(e.target.value)}
              disabled={isSaving}
              className={selectCls}
            >
              {TIERS.map(t => <option key={t} value={t}>{TIER_LABELS[t] || t}</option>)}
            </select>
          </div>

          {/* Account Status */}
          <div>
            <label className={labelCls}>Account status</label>
            <button
              type="button"
              onClick={() => set('status', draft.status === 'suspended' ? 'active' : 'suspended')}
              disabled={isSaving}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-base font-semibold font-google transition-colors disabled:opacity-50 ${draft.status === 'suspended'
                ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40'
                : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40'}`}
            >
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">{draft.status === 'suspended' ? 'block' : 'check_circle'}</span>
                {draft.status === 'suspended' ? 'Activate account' : 'Suspend account'}
              </span>
              <StatusBadge status={draft.status} />
            </button>
          </div>

          {/* Custom Plan Builder */}
          <div className={`bg-slate-50 dark:bg-slate-900 rounded-2xl transition-all ${draft.custom_plan_enabled ? 'ring-2 ring-emerald-400 dark:ring-emerald-600' : ''}`}>
            <div className="flex items-center justify-between p-5">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">build</span>
                </div>
                <div>
                  <p className="text-base font-semibold font-google text-slate-900 dark:text-slate-100">Custom plan builder</p>
                  <p className="text-xs font-google text-slate-400 dark:text-slate-500">Agency / white-glove configuration</p>
                </div>
              </div>
              <Toggle checked={draft.custom_plan_enabled} onChange={handleToggleCustom} label="Enable custom plan" disabled={isSaving} />
            </div>

            <AnimatePresence>
              {draft.custom_plan_enabled && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <div className="px-5 pb-5 space-y-5 border-t border-slate-100 dark:border-slate-800 pt-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="col-span-1 sm:col-span-2">
                        <label className={labelCls}>Plan label</label>
                        <input
                          type="text" placeholder="e.g. Agency Pro" value={draft.cfg.plan_name}
                          onChange={e => setCfg('plan_name', e.target.value)} disabled={isSaving}
                          className={inputCls}
                        />
                      </div>
                      <NumInput label="Monthly price (USD)" value={draft.cfg.monthly_price_usd} onChange={v => setCfg('monthly_price_usd', v)} placeholder="e.g. 299" disabled={isSaving} hint="Must be > $0 to provision in Polar" />
                      <div>
                        <label className={labelCls}>Trial days</label>
                        <input
                          type="number" min={0} max={30} placeholder="14" value={draft.cfg.trial_days}
                          onChange={e => setCfg('trial_days', e.target.value)} disabled={isSaving}
                          className={inputCls}
                        />
                        <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-1.5">
                          After {draft.cfg.trial_days || 14} days, Polar charges ${draft.cfg.monthly_price_usd || '—'}/mo
                        </p>
                      </div>
                    </div>

                    <div>
                      <p className="text-base font-medium font-google text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">tune</span>Resource limits
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <NumInput label="Max bots" value={draft.cfg.max_bots} onChange={v => setCfg('max_bots', v)} placeholder="10" disabled={isSaving} />
                        <NumInput label="Messages / mo" value={draft.cfg.max_messages} onChange={v => setCfg('max_messages', v)} placeholder="5000" disabled={isSaving} />
                        <NumInput label="Knowledge base chunks" value={draft.cfg.max_chunks} onChange={v => setCfg('max_chunks', v)} placeholder="1000" disabled={isSaving} hint="RAG vector chunks — unrelated to the BYOD database toggle below" />
                      </div>
                    </div>

                    <div>
                      <p className="text-base font-medium font-google text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">auto_awesome</span>AI model configuration
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className={labelCls}>Gemini model</label>
                          <select value={draft.cfg.gemini_model} onChange={e => setCfg('gemini_model', e.target.value)} disabled={isSaving} className={selectCls}>
                            {GEMINI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className={labelCls}>Max output tokens</label>
                          <select value={draft.cfg.max_output_tokens} onChange={e => setCfg('max_output_tokens', e.target.value)} disabled={isSaving} className={selectCls}>
                            {TOKEN_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <p className="text-base font-medium font-google text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[14px]">toggle_on</span>Feature access
                      </p>
                      <div className="bg-white dark:bg-slate-900 rounded-xl overflow-hidden">
                        {FEATURE_FLAGS.map((f, i) => (
                          <div key={f.key} className={`flex items-center justify-between px-4 py-3 ${i < FEATURE_FLAGS.length - 1 ? 'border-b border-slate-100 dark:border-slate-800' : ''}`}>
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500 shrink-0">{f.icon}</span>
                              <div className="min-w-0">
                                <p className="text-base font-medium font-google text-slate-900 dark:text-slate-200">{f.label}</p>
                                <p className="text-xs font-google text-slate-400 dark:text-slate-500 truncate">{f.desc}</p>
                              </div>
                            </div>
                            <Toggle checked={!!draft.cfg[f.key]} onChange={v => setCfg(f.key, v)} label={f.label} disabled={isSaving} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>Internal notes</label>
                      <textarea rows={2} placeholder="Deal notes..." value={draft.cfg.notes} onChange={e => setCfg('notes', e.target.value)} disabled={isSaving}
                        className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 focus:bg-slate-200 dark:focus:bg-slate-700 focus:outline-none text-base font-google text-slate-900 dark:text-slate-200 rounded-xl transition-colors disabled:opacity-50 resize-none" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Checkout URL display */}
          {(checkoutUrl || user.custom_plan_polar_product_id) && (
            <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                <p className="text-base font-semibold font-google text-emerald-700 dark:text-emerald-400">
                  {checkoutUrl ? 'Polar product created' : 'Already provisioned'}
                </p>
              </div>
              {(checkoutUrl || existingCfg.polar_checkout_url) ? (
                <>
                  <label className={labelCls}>Checkout link</label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input readOnly value={checkoutUrl || existingCfg.polar_checkout_url || ''} className="flex-1 min-w-0 px-4 py-3 bg-white dark:bg-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300 rounded-xl outline-none truncate" />
                    <button type="button" onClick={handleCopyUrl} className="shrink-0 px-4 py-3 text-base font-semibold font-google bg-emerald-600 text-white hover:bg-emerald-500 rounded-xl transition-colors flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[14px]">{copiedUrl ? 'check' : 'content_copy'}</span>
                      {copiedUrl ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-xs font-google text-slate-500 dark:text-slate-400 mt-2 flex items-start gap-1">
                    <span className="material-symbols-outlined text-[12px] mt-0.5 shrink-0">warning</span>
                    Send this link to the customer. They enter their card to start the trial.
                  </p>
                </>
              ) : (
                <p className="text-xs font-google text-slate-500 dark:text-slate-400">Plan is provisioned in Polar but checkout URL is not available. Check the database for the product ID.</p>
              )}
            </div>
          )}

          {/* Deployed Bots */}
          <div>
            <p className="text-base font-medium font-google text-slate-500 dark:text-slate-400 mb-3">Deployed bots ({companies.length})</p>
            {companies.length === 0 ? (
              <p className="text-xs font-google text-slate-400 text-center py-6 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">No bots deployed.</p>
            ) : (
              <div className="space-y-2">
                {companies.map((bot: any, i: number) => (
                  <div key={bot.id || i} className="px-4 py-3 bg-slate-50 dark:bg-slate-900 rounded-xl">
                    <div className="flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <p className="text-base font-semibold font-google text-slate-900 dark:text-slate-200 truncate">{bot.bot_name || 'Unnamed'}</p>
                        <a href={bot.allowed_origin} target="_blank" rel="noreferrer" className="text-xs font-mono text-blue-500 underline truncate block">{bot.allowed_origin || 'No origin'}</a>
                      </div>
                      <span className={`shrink-0 px-2.5 py-0.5 text-xs font-medium font-google rounded-full ${bot.is_active !== false ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {bot.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <VerticalEditor bot={bot} verticals={verticals} onChange={onChangeVertical} isPending={isVerticalPending} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800 p-5 space-y-3">
          {draft.custom_plan_enabled && !user.custom_plan_polar_product_id && !checkoutUrl && (
            <button
              type="button" onClick={handleProvision}
              disabled={isProvisioning || isSaving || Number(draft.cfg.monthly_price_usd) <= 0}
              title={Number(draft.cfg.monthly_price_usd) <= 0 ? 'Price must be > $0 to provision' : undefined}
              className="w-full px-4 py-3 text-base font-semibold font-google rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[16px]">{isProvisioning ? 'hourglass_empty' : 'add_shopping_cart'}</span>
              {isProvisioning ? 'Creating in Polar…' : 'Create in Polar & generate link'}
            </button>
          )}
          <div className="flex gap-3">
            <button onClick={onClose} disabled={isSaving || isProvisioning}
              className="flex-1 px-4 py-3 text-base font-semibold font-google rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={isSaving || isProvisioning || !isValid}
              className="flex-1 px-4 py-3 text-base font-semibold font-google rounded-xl bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-700 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
              {isSaving ? 'Saving…' : 'Save config'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

// ── Shared helpers ────────────────────────────────────────────────────────────
const fmtDate = (iso: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const fmtRelative = (iso: string | null) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const PlanRowDetail = ({ planUser, onAction }: { planUser: any; onAction: (action: string, u: any) => void }) => {
  const cfg = planUser.custom_plan_config || {};
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 py-2">
      <div className="space-y-1.5">
        <p className="text-xs font-medium font-google text-slate-400 mb-3">Plan config</p>
        {[
          ['Plan', cfg.plan_name || '—'],
          ['Price', cfg.monthly_price_usd != null ? `$${cfg.monthly_price_usd}/mo` : '—'],
          ['Trial', cfg.trial_days != null ? `${cfg.trial_days} days` : '—'],
          ['Max bots', cfg.max_bots ?? '—'],
          ['Messages', cfg.max_messages ?? '—'],
          ['Chunks', cfg.max_chunks ?? '—'],
        ].map(([k, v]) => (
          <div key={k} className="flex gap-2 text-xs font-google">
            <span className="text-slate-400 w-20 shrink-0">{k}</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">{String(v)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <p className="text-xs font-medium font-google text-slate-400 mb-3">Polar</p>
        {planUser.polar_checkout_url && (
          <a href={planUser.polar_checkout_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-google text-blue-500 hover:underline">
            <span className="material-symbols-outlined text-[13px]">open_in_new</span>Checkout link
          </a>
        )}
        {planUser.polar_subscription_link && (
          <a href={planUser.polar_subscription_link} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs font-google text-blue-500 hover:underline">
            <span className="material-symbols-outlined text-[13px]">open_in_new</span>Polar dashboard
          </a>
        )}
        {!planUser.polar_checkout_url && !planUser.polar_subscription_link && (
          <p className="text-xs font-google text-slate-400">No Polar links available</p>
        )}
      </div>
      <div>
        <p className="text-xs font-medium font-google text-slate-400 mb-3">Quick actions</p>
        <div className="flex flex-wrap gap-2">
          {(planUser.quick_actions || []).map((act: string) => (
            <button key={act} onClick={() => onAction(act, planUser)}
              className={`px-3 py-2 text-xs font-semibold font-google rounded-xl transition-colors ${ACTION_STYLE[act] || 'bg-slate-900 text-white hover:bg-slate-700'}`}>
              {ACTION_LABELS[act] || act}
            </button>
          ))}
          {(!planUser.quick_actions || planUser.quick_actions.length === 0) && (
            <p className="text-xs font-google text-slate-400">No actions available</p>
          )}
        </div>
      </div>
    </div>
  );
};

const CustomPlanTableRow = ({ planUser, onAction }: { planUser: any; onAction: (action: string, u: any) => void }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <tr className="border-b border-slate-50 dark:border-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-900/50 transition-colors">
        <td className="py-3.5 px-4 min-w-0">
          <p className="text-base font-google text-slate-900 dark:text-slate-100 truncate max-w-[120px] sm:max-w-[200px]">{planUser.email}</p>
        </td>
        <td className="py-3.5 px-4">
          <SubscriptionStatusBadge status={planUser.subscription_status} />
        </td>
        <td className="py-3.5 px-4 text-xs font-google text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {fmtDate(planUser.billing_period_end)}
        </td>
        <td className="py-3.5 px-4 text-xs font-google text-slate-500 dark:text-slate-400 whitespace-nowrap">
          {fmtRelative(planUser.last_polar_event_at)}
        </td>
        <td className="py-3.5 px-4 text-right">
          <button onClick={() => setExpanded(e => !e)}
            className="px-3 py-1.5 text-xs font-semibold font-google rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[13px]">{expanded ? 'expand_less' : 'expand_more'}</span>
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-slate-50/70 dark:bg-slate-900/70">
          <td colSpan={5} className="px-4 pb-5 pt-3">
            <PlanRowDetail planUser={planUser} onAction={onAction} />
          </td>
        </tr>
      )}
    </>
  );
};

const CustomPlanCard = ({ planUser, onAction }: { planUser: any; onAction: (action: string, u: any) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const cfg = planUser.custom_plan_config || {};
  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold font-google text-slate-900 dark:text-slate-100 break-all">{planUser.email}</p>
          <div className="mt-1.5"><SubscriptionStatusBadge status={planUser.subscription_status} /></div>
        </div>
        <button onClick={() => setExpanded(e => !e)} className="shrink-0 p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors rounded-lg">
          <span className="material-symbols-outlined text-[20px]">{expanded ? 'expand_less' : 'expand_more'}</span>
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs font-google">
        <div>
          <p className="text-xs font-medium text-slate-400 mb-0.5">Billing end</p>
          <p className="text-slate-700 dark:text-slate-300">{fmtDate(planUser.billing_period_end)}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 mb-0.5">Last event</p>
          <p className="text-slate-700 dark:text-slate-300">{fmtRelative(planUser.last_polar_event_at)}</p>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                {[['Plan', cfg.plan_name || '—'], ['Price', cfg.monthly_price_usd != null ? `$${cfg.monthly_price_usd}/mo` : '—'], ['Bots', cfg.max_bots ?? '—'], ['Messages', cfg.max_messages ?? '—']].map(([k, v]) => (
                  <div key={k} className="text-xs font-google">
                    <span className="text-slate-400">{k}: </span>
                    <span className="text-slate-700 dark:text-slate-300 font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-3">
                {planUser.polar_checkout_url && <a href={planUser.polar_checkout_url} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">open_in_new</span>Checkout</a>}
                {planUser.polar_subscription_link && <a href={planUser.polar_subscription_link} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[13px]">open_in_new</span>Polar dashboard</a>}
              </div>
              <div className="flex flex-wrap gap-2">
                {(planUser.quick_actions || []).map((act: string) => (
                  <button key={act} onClick={() => onAction(act, planUser)}
                    className={`px-3 py-2 text-xs font-semibold font-google rounded-xl transition-colors ${ACTION_STYLE[act] || 'bg-slate-900 text-white'}`}>
                    {ACTION_LABELS[act] || act}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main Dashboard ────────────────────────────────────────────────────────────
export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const queryClient = useQueryClient();
  const { userRole } = useUserRole();
  const authFetch = useAuthenticatedFetch();

  const [activeTab, setActiveTab] = useState<'users' | 'plans' | 'metrics' | 'enquiries' | 'byod' | 'agent_requests'>('users');
  const [searchTerm, setSearchTerm] = useState('');
  const [tierFilter, setTierFilter] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [planSearch, setPlanSearch] = useState('');
  const [planStatusFilter, setPlanStatusFilter] = useState('ALL');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionTargetUser, setActionTargetUser] = useState<any>(null);
  const [reconcileResult, setReconcileResult] = useState<any>(null);
  const [isReconciling, setIsReconciling] = useState(false);

  const isAdmin = isLoaded && !!user && userRole === 'SUPER_ADMIN';

  const usersQuery = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => authFetch('/api/admin/users') as Promise<any>,
    enabled: isAdmin,
  });

  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => authFetch('/api/admin/stats') as Promise<any>,
    enabled: isAdmin,
  });

  const dashboardQuery = useQuery({
    queryKey: ['admin', 'custom-plan-dashboard'],
    queryFn: () => authFetch('/api/admin/custom-plan/dashboard') as Promise<any>,
    enabled: isAdmin && activeTab === 'plans',
  });

  const metricsQuery = useQuery({
    queryKey: ['admin', 'custom-plan-metrics'],
    queryFn: () => authFetch('/api/admin/custom-plan/metrics') as Promise<any>,
    enabled: isAdmin && activeTab === 'metrics',
  });

  const tokenUsageQuery = useQuery({
    queryKey: ['admin', 'token-usage'],
    queryFn: () => authFetch('/api/admin/token-usage?window_days=30') as Promise<any>,
    enabled: isAdmin && activeTab === 'metrics',
  });

  // Explore enquiries — fetched always (not just on the tab) so the pending
  // badge is live on every tab. Shares its cache key with ExploreEnquiriesTab.
  const enquiriesQuery = useQuery({
    queryKey: ['admin', 'explore-enquiries'],
    queryFn: () => authFetch('/api/admin/explore/enquiries') as Promise<any>,
    enabled: isAdmin,
    refetchInterval: 60_000,
  });
  const pendingEnquiries = enquiriesQuery.data?.pending_count || 0;

  // Vertical-lock plan: allowlist sourced from the pack registry, single
  // source of truth shared with the PATCH /api/company backend validation.
  const verticalsQuery = useQuery({
    queryKey: ['admin', 'verticals'],
    queryFn: () => authFetch('/api/admin/verticals') as Promise<any>,
    enabled: isAdmin,
  });
  const verticals: string[] = verticalsQuery.data?.verticals || [];

  const users = usersQuery.data || [];
  const stats = statsQuery.data || { total_users: 0, total_companies: 0, active_bots: 0, total_messages: 0, custom_plan_count: 0 };
  const isLoading = usersQuery.isLoading || statsQuery.isLoading;

  const limitsMutation = useMutation({
    mutationFn: ({ clerkId, payload }: { clerkId: string; payload: any }) =>
      authFetch(`/api/admin/users/${clerkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind: 'success', message: 'Plan config saved.' } }));
    },
  });

  const verticalMutation = useMutation({
    mutationFn: ({ companyId, vertical }: { companyId: string; vertical: string | null }) =>
      authFetch(`/api/admin/companies/${companyId}/vertical`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind: 'success', message: 'Vertical updated.' } }));
    },
    onError: (err: any) => {
      window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind: 'error', message: err?.message || 'Failed to update vertical.' } }));
    },
  });

  const overrideMutation = useMutation({
    mutationFn: ({ clerkId, payload }: { clerkId: string; payload: any }) =>
      authFetch(`/api/admin/users/${clerkId}/custom-plan/override`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'custom-plan-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] });
      setActiveAction(null);
      setActionTargetUser(null);
      window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind: 'success', message: 'Action applied successfully.' } }));
    },
    onError: (err: any) => {
      window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind: 'error', message: err?.message || 'Action failed.' } }));
    },
  });

  const filteredUsers = users.filter((u: any) => {
    const term = searchTerm.toLowerCase();
    const matchesTerm = !term || u.email?.toLowerCase().includes(term) || u.clerk_id?.toLowerCase().includes(term);
    const matchesTier = tierFilter === 'ALL' || u.tier === tierFilter;
    return matchesTerm && matchesTier;
  });

  const planUsers: any[] = (dashboardQuery.data?.custom_plan_users || []).filter((u: any) => {
    const term = planSearch.toLowerCase();
    const matchesTerm = !term || u.email?.toLowerCase().includes(term);
    const matchesStatus = planStatusFilter === 'ALL' || u.subscription_status === planStatusFilter;
    return matchesTerm && matchesStatus;
  });

  const handleRunReconcile = async () => {
    setIsReconciling(true);
    try {
      const result = await authFetch('/api/admin/custom-plan/reconcile', { method: 'POST' }) as any;
      setReconcileResult(result);
      window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind: 'success', message: 'Reconciliation complete.' } }));
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('Sapybase:toast', { detail: { kind: 'error', message: err?.message || 'Reconciliation failed.' } }));
    } finally {
      setIsReconciling(false);
    }
  };

  if (userRole !== 'SUPER_ADMIN') {
    return <div className="p-20 text-center text-base font-google text-slate-500">Unauthorized. Super admin only.</div>;
  }

  const PLAN_STATUSES = ['ALL', 'ACTIVE', 'TRIAL_ACTIVE', 'AWAITING_PAYMENT', 'PAYMENT_FAILED', 'SUSPENDED', 'CANCELED', 'PAUSED', 'EXPIRED'];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-500">

      {/* ── Header ── */}
      <div className="px-6 md:px-8 pt-8 pb-0 shrink-0">
        <h1 className="text-2xl md:text-3xl font-semibold font-google text-slate-900 dark:text-slate-200 mb-6">
          Super admin console
        </h1>

        {/* Stats — single horizontal-scroll row on mobile (hidden scrollbar), grid on md+ */}
        <div className="flex md:grid md:grid-cols-5 gap-4 mb-6 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {[
            { label: 'Total users', value: stats.total_users, icon: 'group' },
            { label: 'Total bots', value: stats.total_companies, icon: 'smart_toy' },
            { label: 'Active bots', value: stats.active_bots, icon: 'bolt' },
            { label: 'Messages', value: stats.total_messages?.toLocaleString(), icon: 'forum' },
            { label: 'Custom plans', value: stats.custom_plan_count, icon: 'build' },
          ].map((s, i) => (
            <div key={i} className="min-w-[150px] shrink-0 md:min-w-0 bg-white dark:bg-slate-900 rounded-2xl p-5 transition-colors duration-500">
              <p className="text-xs font-medium font-google text-slate-400 dark:text-slate-500 mb-1 truncate">{s.label}</p>
              <h3 className="text-xl md:text-2xl font-semibold font-google truncate text-slate-900 dark:text-slate-100">{s.value}</h3>
            </div>
          ))}
        </div>

        {/* Pill tab bar — scrolls horizontally on mobile instead of overflowing the page */}
        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
          {([
            { key: 'users', label: 'All users', icon: 'group' },
            { key: 'plans', label: 'Custom plans', icon: 'build' },
            { key: 'metrics', label: 'Metrics', icon: 'bar_chart' },
            { key: 'enquiries', label: 'Enquiries', icon: 'inbox' },
            { key: 'byod', label: 'BYOD', icon: 'database' },
            { key: 'agent_requests', label: 'Agent requests', icon: 'support_agent' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 text-base font-medium font-google rounded-lg whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <span className="material-symbols-outlined text-[14px]">{tab.icon}</span>
              {tab.label}
              {tab.key === 'enquiries' && pendingEnquiries > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-semibold rounded-full bg-amber-500 text-white">
                  {pendingEnquiries}
                </span>
              )}
            </button>
          ))}
        </div>
        </div>
      </div>

      {/* ── Tab: Users ── */}
      {activeTab === 'users' && (
        <div className="flex-1 px-6 md:px-8 py-6 space-y-5">
          {/* Search + filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text" placeholder="Search by email or Clerk ID…" value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="flex-1 max-w-full md:max-w-md px-4 py-3 bg-white dark:bg-slate-900 text-base font-google text-slate-900 dark:text-slate-200 rounded-xl outline-none placeholder:text-slate-400 transition-colors duration-500"
            />
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex gap-1.5 min-w-max bg-white dark:bg-slate-900 rounded-xl p-1">
                {['ALL', ...TIERS].map(t => (
                  <button key={t} onClick={() => setTierFilter(t)}
                    className={`px-3 py-1.5 text-xs font-medium font-google rounded-lg whitespace-nowrap transition-colors ${tierFilter === t ? 'bg-slate-900 dark:bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    {t === 'ALL' ? 'All' : (TIER_LABELS[t] || t)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {isLoading ? <SkeletonLoader.Table /> : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl overflow-hidden transition-colors duration-500">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">User / Clerk ID</th>
                      <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Tier / Status</th>
                      <th className="py-4 px-5 text-xs font-medium font-google text-slate-400">Usage</th>
                      <th className="py-4 px-5 text-xs font-medium font-google text-slate-400 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {filteredUsers.map((u: any) => (
                      <tr key={u.clerk_id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900 transition-colors">
                        <td className="py-4 px-5 min-w-0">
                          <p className="text-base font-google text-slate-900 dark:text-slate-100 truncate max-w-[140px] md:max-w-[260px]">{u.email}</p>
                          <p className="text-xs font-mono text-slate-400 dark:text-slate-500 truncate max-w-[140px] md:max-w-[260px] mt-0.5">{u.clerk_id}</p>
                        </td>
                        <td className="py-4 px-5 space-y-1.5">
                          <div><TierBadge tier={u.tier} /></div>
                          <div><StatusBadge status={u.status} /></div>
                        </td>
                        <td className="py-4 px-5 min-w-[160px]">
                          <UsageBar used={u.usage_tracking?.messages_used} limit={u.usage_tracking?.message_limit} />
                        </td>
                        <td className="py-4 px-5 text-right">
                          <button onClick={() => setSelectedUser(u)}
                            className="px-4 py-2 text-xs font-semibold font-google rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors">
                            Manage
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden flex flex-col gap-4">
                {filteredUsers.map((u: any) => (
                  <div key={u.clerk_id} className="bg-white dark:bg-slate-900 rounded-2xl p-5 flex flex-col gap-4 transition-colors duration-500">
                    <div className="min-w-0">
                      <p className="text-base font-semibold font-google text-slate-900 dark:text-slate-100 break-all">{u.email}</p>
                      <p className="text-xs font-mono text-slate-400 break-all mt-0.5">{u.clerk_id}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <TierBadge tier={u.tier} />
                      <StatusBadge status={u.status} />
                    </div>
                    <UsageBar used={u.usage_tracking?.messages_used} limit={u.usage_tracking?.message_limit} />
                    <button onClick={() => setSelectedUser(u)}
                      className="self-start px-4 py-2.5 text-xs font-semibold font-google rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 transition-colors">
                      Manage
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Custom Plans ── */}
      {activeTab === 'plans' && (
        <div className="flex-1 px-6 md:px-8 py-6 space-y-5">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text" placeholder="Search by email…" value={planSearch}
              onChange={e => setPlanSearch(e.target.value)}
              className="flex-1 px-4 py-3 bg-white dark:bg-slate-900 text-base font-google text-slate-900 dark:text-slate-200 rounded-xl outline-none placeholder:text-slate-400 transition-colors duration-500"
            />
            <div className="overflow-x-auto scrollbar-hide">
              <div className="flex gap-1.5 min-w-max bg-white dark:bg-slate-900 rounded-xl p-1">
                {PLAN_STATUSES.map(s => (
                  <button key={s} onClick={() => setPlanStatusFilter(s)}
                    className={`px-3 py-1.5 text-xs font-medium font-google rounded-lg whitespace-nowrap transition-colors ${planStatusFilter === s ? 'bg-slate-900 dark:bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}>
                    {s === 'ALL' ? 'All' : s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {dashboardQuery.isLoading ? (
            <SkeletonLoader.Table />
          ) : dashboardQuery.isError ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl">
              <p className="text-base font-google text-red-500 mb-3">Failed to load custom plans.</p>
              <button onClick={() => dashboardQuery.refetch()}
                className="px-4 py-2.5 text-xs font-semibold font-google rounded-xl bg-slate-900 text-white hover:bg-slate-700 transition-colors">
                Retry
              </button>
            </div>
          ) : planUsers.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
              <span className="material-symbols-outlined text-[32px] text-slate-300 dark:text-slate-600 mb-2 block">build_circle</span>
              <p className="text-base font-google text-slate-400">No custom plan users found.</p>
            </div>
          ) : (
            <>
              <div className="hidden md:block bg-white dark:bg-slate-900 rounded-2xl overflow-hidden transition-colors duration-500">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                      <th className="py-4 px-4 text-xs font-medium font-google text-slate-400">Email</th>
                      <th className="py-4 px-4 text-xs font-medium font-google text-slate-400">Status</th>
                      <th className="py-4 px-4 text-xs font-medium font-google text-slate-400">Billing end</th>
                      <th className="py-4 px-4 text-xs font-medium font-google text-slate-400">Last event</th>
                      <th className="py-4 px-4 text-xs font-medium font-google text-slate-400 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planUsers.map((u: any) => (
                      <CustomPlanTableRow
                        key={u.clerk_id}
                        planUser={u}
                        onAction={(action, target) => { setActiveAction(action); setActionTargetUser(target); }}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden flex flex-col gap-4">
                {planUsers.map((u: any) => (
                  <CustomPlanCard
                    key={u.clerk_id}
                    planUser={u}
                    onAction={(action, target) => { setActiveAction(action); setActionTargetUser(target); }}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Tab: Metrics ── */}
      {activeTab === 'metrics' && (
        <div className="flex-1 px-6 md:px-8 py-6 space-y-5">
          {metricsQuery.isLoading ? (
            <SkeletonLoader.Table />
          ) : metricsQuery.isError ? (
            <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl">
              <p className="text-base font-google text-red-500 mb-3">Failed to load metrics.</p>
              <button onClick={() => metricsQuery.refetch()}
                className="px-4 py-2.5 text-xs font-semibold font-google rounded-xl bg-slate-900 text-white hover:bg-slate-700 transition-colors">
                Retry
              </button>
            </div>
          ) : (() => {
            const metrics = metricsQuery.data || {};
            const statusCounts: Record<string, number> = metrics.status_counts || {};
            const total = Object.values(statusCounts).reduce((a: number, b) => a + (b as number), 0);
            const stale: any[] = metrics.awaiting_payment_stale || [];
            const staleCount: number = metrics.awaiting_payment_stale_count || 0;
            const failed24h: number = metrics.payment_failed_24h || 0;
            const failed7d: number = metrics.payment_failed_7d || 0;

            const barColor: Record<string, string> = {
              ACTIVE: 'bg-emerald-500', TRIAL_ACTIVE: 'bg-sky-500',
              AWAITING_PAYMENT: 'bg-amber-500', PAYMENT_FAILED: 'bg-red-500',
              SUSPENDED: 'bg-red-400', CANCELED: 'bg-slate-400',
              PAUSED: 'bg-amber-400', EXPIRED: 'bg-slate-300',
            };

            return (
              <>
                {/* Status distribution */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 transition-colors duration-500">
                  <p className="text-base font-medium font-google text-slate-500 dark:text-slate-400 mb-5 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">donut_small</span>
                    Subscription status distribution
                  </p>
                  {total === 0 ? (
                    <p className="text-base font-google text-slate-400 py-6 text-center">No custom plan users yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(statusCounts)
                        .filter(([, count]) => (count as number) > 0)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([status, count]) => {
                          const pct = Math.round(((count as number) / total) * 100);
                          return (
                            <div key={status}>
                              <div className="flex items-center justify-between mb-1.5">
                                <SubscriptionStatusBadge status={status} />
                                <span className="text-xs font-medium font-google text-slate-500 dark:text-slate-400">{count as number} <span className="font-normal text-slate-400">({pct}%)</span></span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full">
                                <div className={`h-full rounded-full transition-all duration-700 ${barColor[status] || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>

                {/* Alert boxes */}
                <div className="space-y-3">
                  {staleCount > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-2xl p-5 border-l-4 border-amber-400">
                      <p className="text-base font-semibold font-google text-amber-700 dark:text-amber-400 flex items-center gap-2 mb-3">
                        <span className="material-symbols-outlined text-[16px]">hourglass_top</span>
                        {staleCount} user{staleCount > 1 ? 's' : ''} awaiting payment for 7+ days
                      </p>
                      <div className="space-y-1.5">
                        {stale.map((u: any) => (
                          <div key={u.clerk_id} className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="text-xs font-google text-amber-800 dark:text-amber-300">{u.email}</p>
                            {u.custom_plan_polar_product_id && (
                              <span className="text-xs font-mono text-amber-600 dark:text-amber-400">{u.custom_plan_polar_product_id}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {failed24h > 0 && (
                    <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-5 border-l-4 border-red-500">
                      <p className="text-base font-semibold font-google text-red-700 dark:text-red-400 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">credit_card_off</span>
                        {failed24h} payment failure{failed24h > 1 ? 's' : ''} in the last 24 hours
                        {failed7d > 0 && <span className="font-normal text-red-500">({failed7d} in 7d)</span>}
                      </p>
                    </div>
                  )}

                  {staleCount === 0 && failed24h === 0 && total > 0 && (
                    <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl p-5 border-l-4 border-emerald-400">
                      <p className="text-base font-semibold font-google text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        No alerts — all custom plans look healthy.
                      </p>
                    </div>
                  )}
                </div>

                {/* Reconciliation */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 transition-colors duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                    <div>
                      <p className="text-base font-semibold font-google text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-slate-500">sync</span>
                        Manual reconciliation
                      </p>
                      <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-0.5">Cross-check DB state against Polar subscriptions and flag mismatches.</p>
                    </div>
                    <button
                      onClick={handleRunReconcile}
                      disabled={isReconciling}
                      className="shrink-0 px-5 py-3 text-base font-semibold font-google rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {isReconciling
                        ? <><span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>Running…</>
                        : <><span className="material-symbols-outlined text-[14px]">sync</span>Run reconciliation</>
                      }
                    </button>
                  </div>

                  {reconcileResult && (
                    <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                      {reconcileResult.mismatches?.length > 0 ? (
                        <>
                          <p className="text-base font-semibold font-google text-red-600 dark:text-red-400 mb-3 flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-[14px]">warning</span>
                            {reconcileResult.mismatches.length} mismatch{reconcileResult.mismatches.length > 1 ? 'es' : ''} found
                          </p>
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {reconcileResult.mismatches.map((m: any, i: number) => (
                              <div key={i} className="p-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-xs font-google text-red-700 dark:text-red-400">
                                <span className="font-semibold">{m.clerk_id || m.email}</span>: {m.issue || JSON.stringify(m)}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-base font-medium font-google text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">check_circle</span>
                          No mismatches — DB and Polar are in sync.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Token spend (Phase D) */}
                <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 transition-colors duration-500">
                  <p className="text-base font-medium font-google text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">token</span>
                    Gemini token spend (last 30 days)
                  </p>
                  <p className="text-xs font-google text-slate-400 dark:text-slate-500 mb-5">
                    Control-plane chat_logs only — BYOD-routed tenants store logs in their own database and aren&apos;t reflected here.
                  </p>
                  {tokenUsageQuery.isLoading ? (
                    <p className="text-base font-google text-slate-400 py-6 text-center">Loading…</p>
                  ) : tokenUsageQuery.isError ? (
                    <p className="text-base font-google text-red-500 py-6 text-center">Failed to load token usage.</p>
                  ) : (() => {
                    const fleet = tokenUsageQuery.data?.fleet || {};
                    const topCompanies: any[] = tokenUsageQuery.data?.top_companies || [];
                    const compact = (n: number) => new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
                    return (
                      <>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
                          {[
                            { label: 'Total tokens', value: compact(fleet.total_tokens) },
                            { label: 'Metered turns', value: compact(fleet.metered_turns) },
                            { label: 'Avg / conversation', value: compact(fleet.avg_tokens_per_conversation) },
                            { label: 'Prompt cache hit rate', value: `${Math.round((fleet.prompt_cache_hit_rate || 0) * 100)}%` },
                          ].map((s, i) => (
                            <div key={i} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4">
                              <p className="text-xs font-medium font-google text-slate-400 dark:text-slate-500 mb-1">{s.label}</p>
                              <p className="text-lg font-semibold font-google text-slate-900 dark:text-slate-100">{s.value}</p>
                            </div>
                          ))}
                        </div>
                        {topCompanies.length === 0 ? (
                          <p className="text-base font-google text-slate-400 py-4 text-center">No metered token usage in this window.</p>
                        ) : (
                          <div className="overflow-x-auto -mx-1">
                            <table className="w-full min-w-[520px] text-sm">
                              <thead>
                                <tr className="text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                                  <th className="py-2 px-2 font-medium">Company</th>
                                  <th className="py-2 px-2 font-medium text-right">Input</th>
                                  <th className="py-2 px-2 font-medium text-right">Output</th>
                                  <th className="py-2 px-2 font-medium text-right">Total</th>
                                  <th className="py-2 px-2 font-medium text-right">Turns</th>
                                </tr>
                              </thead>
                              <tbody>
                                {topCompanies.map(c => (
                                  <tr key={c.company_id} className="border-t border-slate-100 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                                    <td className="py-2.5 px-2 truncate max-w-[220px]">{c.company_name || 'Unnamed'}</td>
                                    <td className="py-2.5 px-2 text-right">{compact(c.input_tokens)}</td>
                                    <td className="py-2.5 px-2 text-right">{compact(c.output_tokens)}</td>
                                    <td className="py-2.5 px-2 text-right font-medium">{compact(c.total_tokens)}</td>
                                    <td className="py-2.5 px-2 text-right">{c.metered_turns}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ── Explore enquiries ── */}
      {activeTab === 'enquiries' && (
        <div className="px-6 md:px-8 py-6">
          <ExploreEnquiriesTab />
        </div>
      )}

      {/* ── BYOD fleet ── */}
      {activeTab === 'byod' && (
        <div className="px-6 md:px-8 py-6">
          <ByodTab />
        </div>
      )}

      {/* ── Agent requests fleet ── */}
      {activeTab === 'agent_requests' && (
        <div className="px-6 md:px-8 py-6">
          <AgentRequestsTab />
        </div>
      )}

      {/* ── Manage modal ── */}
      <AnimatePresence>
        {selectedUser && (
          <ManageModal
            user={selectedUser}
            onClose={() => setSelectedUser(null)}
            isSaving={limitsMutation.isPending}
            onSave={(payload) => limitsMutation.mutate({ clerkId: selectedUser.clerk_id, payload })}
            verticals={verticals}
            isVerticalPending={verticalMutation.isPending}
            onChangeVertical={(companyId, vertical) => verticalMutation.mutate({ companyId, vertical })}
          />
        )}
      </AnimatePresence>

      {/* ── Quick action modal ── */}
      <AnimatePresence>
        {activeAction && actionTargetUser && (
          <QuickActionModal
            action={activeAction}
            targetUser={actionTargetUser}
            isPending={overrideMutation.isPending}
            onClose={() => { setActiveAction(null); setActionTargetUser(null); }}
            onConfirm={(payload) => overrideMutation.mutate({ clerkId: actionTargetUser.clerk_id, payload })}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
