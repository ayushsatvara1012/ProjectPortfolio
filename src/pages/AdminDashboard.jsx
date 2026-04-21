import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SkeletonLoader from '../components/SkeletonLoader';
import { useUser } from '@clerk/clerk-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserRole } from '../context/UserContext';
import { useAuthenticatedFetch } from '../hooks/useApiCall';

// ── Tier config ───────────────────────────────────────────────────────────────
const TIERS = ['FREE', 'BASIC', 'STARTER', 'PRO', 'ENTERPRISE', 'CUSTOM'];

const TIER_STYLE = {
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
    { key: 'white_label', label: 'White Label', icon: 'branding_watermark', desc: 'Remove "Powered by SaPyBase"' },
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

const TierBadge = ({ tier }) => (
    <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-google font-bold uppercase tracking-widest rounded-none ${TIER_STYLE[tier] || TIER_STYLE.FREE}`}>
        {tier || 'FREE'}
    </span>
);

const StatusBadge = ({ status }) => {
    const active = status !== 'suspended';
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-google font-bold uppercase tracking-widest rounded-none ${active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {active ? 'Active' : 'Suspended'}
        </span>
    );
};

// ── Usage bar ─────────────────────────────────────────────────────────────────
const UsageBar = ({ used = 0, limit = 0 }) => {
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
const Toggle = ({ checked, onChange, label, disabled }) => (
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
const SectionLabel = ({ children }) => (
    <label className="block text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">
        {children}
    </label>
);

// ── Number input ──────────────────────────────────────────────────────────────
const NumInput = ({ label, value, onChange, placeholder, disabled, hint }) => (
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
const ManageSlideOver = ({ user, onClose, onSave, isSaving }) => {
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
        },
    });

    const set = (key, val) => setDraft(d => ({ ...d, [key]: val }));
    const setCfg = (key, val) => setDraft(d => ({ ...d, cfg: { ...d.cfg, [key]: val } }));

    const handleTierChange = (newTier) => {
        set('tier', newTier);
        if (newTier === 'CUSTOM') {
            set('custom_plan_enabled', true);
        } else {
            set('custom_plan_enabled', false);
        }
    };

    const handleToggleCustom = (enabled) => {
        set('custom_plan_enabled', enabled);
        if (enabled) {
            set('tier', 'CUSTOM');
        } else {
            set('tier', user.tier === 'CUSTOM' ? 'FREE' : user.tier);
        }
    };

    const numVal = (v) => (v === '' || v === null || v === undefined) ? null : Number(v);

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
        const payload = {
            tier: draft.custom_plan_enabled ? 'CUSTOM' : draft.tier,
            status: draft.status,
        };
        if (draft.custom_plan_enabled) {
            const c = draft.cfg;
            payload.custom_plan_config = {
                plan_name: c.plan_name || 'Custom Plan',
                monthly_price_usd: numVal(c.monthly_price_usd) ?? 0,
                max_bots: numVal(c.max_bots) ?? 1,
                max_messages: numVal(c.max_messages) ?? 500,
                max_chunks: numVal(c.max_chunks) ?? 100,
                gemini_model: c.gemini_model || null,
                max_output_tokens: numVal(c.max_output_tokens) || null,
                human_handoff: c.human_handoff,
                lead_capture: c.lead_capture,
                white_label: c.white_label,
                webhook: c.webhook,
                custom_logo: c.custom_logo,
                analytics: c.analytics,
                notes: c.notes || '',
            };
        }
        onSave(payload);
    };

    const companies = Array.isArray(user.companies) ? user.companies : [];

    return (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
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
                className="ml-auto relative z-10 flex flex-col w-full max-w-lg h-full bg-white dark:bg-slate-950 border-l border-gray-100 dark:border-slate-800 shadow-2xl overflow-y-auto"
            >
                {/* Header */}
                <div className="flex items-start justify-between p-4 pt-15 sm:p-6 border-b border-gray-100 dark:border-slate-800 sticky top-0 bg-white dark:bg-slate-950 z-10">
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
                        {/* Toggle header */}
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

                                        {/* Plan identity */}
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

                                        {/* Resource limits */}
                                        <div>
                                            <p className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[12px]">tune</span>
                                                Resource Limits
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <NumInput
                                                    label="Max Bots"
                                                    value={draft.cfg.max_bots}
                                                    onChange={v => setCfg('max_bots', v)}
                                                    placeholder="e.g. 10"
                                                    disabled={isSaving}
                                                />
                                                <NumInput
                                                    label="Messages / mo"
                                                    value={draft.cfg.max_messages}
                                                    onChange={v => setCfg('max_messages', v)}
                                                    placeholder="e.g. 50000"
                                                    disabled={isSaving}
                                                />
                                                <NumInput
                                                    label="Knowledge Chunks"
                                                    value={draft.cfg.max_chunks}
                                                    onChange={v => setCfg('max_chunks', v)}
                                                    placeholder="e.g. 10000"
                                                    disabled={isSaving}
                                                />
                                            </div>
                                        </div>

                                        {/* Model configuration */}
                                        <div>
                                            <p className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
                                                AI Model Configuration
                                            </p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div>
                                                    <SectionLabel>Gemini Model</SectionLabel>
                                                    <select
                                                        value={draft.cfg.gemini_model}
                                                        onChange={e => setCfg('gemini_model', e.target.value)}
                                                        disabled={isSaving}
                                                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:opacity-50 rounded-none"
                                                    >
                                                        {GEMINI_MODELS.map(m => (
                                                            <option key={m.value} value={m.value}>{m.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <SectionLabel>Max Output Tokens</SectionLabel>
                                                    <select
                                                        value={draft.cfg.max_output_tokens}
                                                        onChange={e => setCfg('max_output_tokens', e.target.value === '' ? '' : Number(e.target.value))}
                                                        disabled={isSaving}
                                                        className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:opacity-50 rounded-none"
                                                    >
                                                        {TOKEN_OPTIONS.map(o => (
                                                            <option key={o.value} value={o.value}>{o.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Feature flags */}
                                        <div>
                                            <p className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
                                                <span className="material-symbols-outlined text-[12px]">toggle_on</span>
                                                Feature Access
                                            </p>
                                            <div className="space-y-0 border border-gray-100 dark:border-slate-800">
                                                {FEATURE_FLAGS.map((f, i) => (
                                                    <div
                                                        key={f.key}
                                                        className={`flex items-center justify-between px-4 py-3 ${i < FEATURE_FLAGS.length - 1 ? 'border-b border-gray-100 dark:border-slate-800' : ''}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">{f.icon}</span>
                                                            <div>
                                                                <p className="text-xs font-google font-bold text-slate-900 dark:text-slate-200">{f.label}</p>
                                                                <p className="text-[10px] font-google text-slate-400 dark:text-slate-500">{f.desc}</p>
                                                            </div>
                                                        </div>
                                                        <Toggle
                                                            checked={!!draft.cfg[f.key]}
                                                            onChange={v => setCfg(f.key, v)}
                                                            label={f.label}
                                                            disabled={isSaving}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Internal notes */}
                                        <div>
                                            <SectionLabel>Internal Notes (not shown to user)</SectionLabel>
                                            <textarea
                                                rows={2}
                                                placeholder="e.g. Agency deal signed 2026-04-20, invoiced via Stripe"
                                                value={draft.cfg.notes}
                                                onChange={e => setCfg('notes', e.target.value)}
                                                disabled={isSaving}
                                                className="w-full bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-700 px-3 py-2.5 text-sm font-google text-slate-900 dark:text-slate-200 focus:ring-1 focus:ring-blue-500 outline-none transition-colors disabled:opacity-50 rounded-none resize-none"
                                            />
                                        </div>

                                        {/* Live config summary */}
                                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 p-3">
                                            <p className="text-[10px] font-google font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">preview</span>
                                                Plan Summary
                                            </p>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px] font-mono text-emerald-800 dark:text-emerald-300">
                                                <span>{draft.cfg.max_bots || '—'} bots</span>
                                                <span>{draft.cfg.max_messages ? Number(draft.cfg.max_messages).toLocaleString() : '—'} msg/mo</span>
                                                <span>{draft.cfg.max_chunks ? Number(draft.cfg.max_chunks).toLocaleString() : '—'} chunks</span>
                                                <span>{draft.cfg.gemini_model ? draft.cfg.gemini_model.replace('gemini-', '') : 'default model'}</span>
                                                <span>${draft.cfg.monthly_price_usd || '0'}/mo</span>
                                                <span>{FEATURE_FLAGS.filter(f => draft.cfg[f.key]).length} features on</span>
                                            </div>
                                        </div>

                                        {!isValid && (
                                            <p className="text-[10px] font-google text-red-600 dark:text-red-400 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-[12px]">warning</span>
                                                All numeric values must be 0 or greater
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Bot Visibility */}
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <SectionLabel>Deployed Bots</SectionLabel>
                            <span className="px-1.5 py-0.5 text-[10px] font-google font-bold bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                {companies.length}
                            </span>
                            {companies.length > 0 && (
                                <span className="px-1.5 py-0.5 text-[10px] font-google font-bold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                                    {companies.filter(b => b.is_active !== false).length} active
                                </span>
                            )}
                        </div>

                        {companies.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-8 border border-dashed border-gray-200 dark:border-slate-700">
                                <span className="material-symbols-outlined text-[32px] text-gray-200 dark:text-slate-700 mb-2">smart_toy</span>
                                <p className="text-[10px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">No bots deployed</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {companies.map((bot, i) => {
                                    const isActive = bot.is_active !== false;
                                    const createdAt = bot.created_at ? new Date(bot.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
                                    return (
                                        <div key={bot.id || i} className="flex items-start gap-3 p-3 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900">
                                            <div className={`w-7 h-7 border flex items-center justify-center shrink-0 mt-0.5 ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' : 'bg-gray-100 dark:bg-slate-800 border-gray-200 dark:border-slate-700'}`}>
                                                <span className={`material-symbols-outlined text-[14px] ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>smart_toy</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                    <p className="text-xs font-google font-bold text-slate-900 dark:text-slate-200 truncate">
                                                        {bot.bot_name || 'Unnamed Bot'}
                                                    </p>
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-google font-bold uppercase tracking-wider ${isActive ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' : 'bg-gray-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-gray-200 dark:border-slate-700'}`}>
                                                        <span className={`w-1 h-1 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                        {isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                                {bot.company_name && bot.company_name !== bot.bot_name && (
                                                    <p className="text-[10px] font-google text-slate-500 dark:text-slate-400 truncate">{bot.company_name}</p>
                                                )}
                                                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">{bot.allowed_origin || '—'}</p>
                                                {createdAt && (
                                                    <p className="text-[9px] font-google text-slate-300 dark:text-slate-600 mt-0.5">Deployed {createdAt}</p>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 p-4 flex gap-3">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="flex-1 px-4 py-3 text-sm font-google font-bold uppercase tracking-widest border border-gray-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-900 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !isValid}
                        className="flex-1 px-4 py-3 text-sm font-google font-bold uppercase tracking-widest bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving
                            </>
                        ) : 'Save Changes'}
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

// ── Mobile user card ──────────────────────────────────────────────────────────
const UserCard = ({ u, onManage }) => {
    const usage = u.usage_tracking || {};
    const isCustom = u.tier === 'CUSTOM';
    return (
        <div className="bg-white dark:bg-slate-950 border border-gray-100 dark:border-slate-800 p-4 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-sm font-google font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        {u.email?.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-google font-bold text-slate-900 dark:text-slate-100 truncate" title={u.email}>{u.email}</p>
                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">{u.clerk_id}</p>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <TierBadge tier={u.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : u.tier} />
                    <StatusBadge status={u.status} />
                </div>
            </div>

            {isCustom && u.custom_plan_config?.plan_name && (
                <div className="mb-3 px-2 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-[10px] font-google font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[11px]">build</span>
                    {u.custom_plan_config.plan_name}
                    {u.custom_plan_config.monthly_price_usd ? ` · $${u.custom_plan_config.monthly_price_usd}/mo` : ''}
                </div>
            )}

            <div className="mb-3">
                <UsageBar used={usage.messages_used} limit={usage.message_limit} />
            </div>

            <div className="flex items-center justify-between">
                <span className="text-[10px] font-google text-slate-400 dark:text-slate-500 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">smart_toy</span>
                    {(u.companies || []).length} bot{(u.companies || []).length !== 1 ? 's' : ''}
                    {(u.companies || []).length > 0 && (
                        <span className="text-emerald-600 dark:text-emerald-400">
                            · {(u.companies || []).filter(b => b.is_active !== false).length} active
                        </span>
                    )}
                </span>
                <button
                    onClick={() => onManage(u)}
                    className="px-3 py-1.5 text-[10px] font-google font-bold uppercase tracking-widest bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors"
                >
                    Manage
                </button>
            </div>
        </div>
    );
};

// ── Main component ────────────────────────────────────────────────────────────
const AdminDashboard = () => {
    const { user, isLoaded: isUserLoaded } = useUser();
    const queryClient = useQueryClient();
    const { userRole } = useUserRole();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState(null);
    const [tierFilter, setTierFilter] = useState('ALL');
    const authFetch = useAuthenticatedFetch();

    // ── Queries ───────────────────────────────────────────────────────────────
    const usersQuery = useQuery({
        queryKey: ['admin', 'users'],
        queryFn: () => authFetch('/api/admin/users'),
        enabled: isUserLoaded && !!user,
    });

    const statsQuery = useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: () => authFetch('/api/admin/stats'),
        enabled: isUserLoaded && !!user,
    });

    const users = usersQuery.data || [];
    const stats = statsQuery.data || { total_users: 0, total_companies: 0, active_bots: 0, total_messages: 0, custom_plan_count: 0 };
    const isLoading = usersQuery.isLoading || statsQuery.isLoading;
    const hasError = usersQuery.isError || statsQuery.isError;

    const refetchAll = () => {
        usersQuery.refetch();
        statsQuery.refetch();
    };

    // ── Mutations ─────────────────────────────────────────────────────────────
    const limitsMutation = useMutation({
        mutationFn: ({ clerkId, payload }) =>
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

    const handleSaveLimits = (payload) => {
        if (!selectedUser) return;
        limitsMutation.mutate({ clerkId: selectedUser.clerk_id, payload });
    };

    // ── Search + filter ───────────────────────────────────────────────────────
    const filteredUsers = users.filter(u => {
        const term = searchTerm.toLowerCase();
        const matchesTerm = !term || (
            u.email?.toLowerCase().includes(term) ||
            u.clerk_id?.toLowerCase().includes(term) ||
            u.custom_plan_config?.plan_name?.toLowerCase().includes(term) ||
            (u.companies || []).some(c =>
                (c.bot_name || c.name || '').toLowerCase().includes(term) ||
                (c.allowed_origin || c.origin || '').toLowerCase().includes(term)
            )
        );
        const matchesTier = tierFilter === 'ALL' || u.tier === tierFilter;
        return matchesTerm && matchesTier;
    });

    const FILTER_TIERS = ['ALL', ...TIERS];

    return (
        <div className="w-full max-w-full overflow-x-hidden flex flex-col bg-gray-100 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors duration-500 font-sans">

            {/* Header */}
            <div className="bg-white dark:bg-slate-950 px-4 py-8 md:p-10 flex flex-col md:flex-row md:items-end justify-between gap-6 transition-colors duration-500">
                <div>
                    <div className="px-2 py-0.5 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 text-sm uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display flex items-center gap-2 w-fit mb-4 rounded-none transition-colors">
                        <span className="material-symbols-outlined text-[14px]">verified_user</span>
                        Super Admin Console
                    </div>
                    <h1 className="text-xl font-display font-black tracking-tight leading-none text-slate-900 dark:text-slate-200 uppercase transition-colors">
                        Platform <span className="text-slate-400 dark:text-slate-600">Management</span>
                    </h1>
                    <p className="text-md font-mono text-slate-500 dark:text-slate-400 leading-relaxed mt-2 transition-colors">Monitor ecosystem health and manage user subscriptions.</p>
                </div>

                <div className="w-full md:w-auto flex items-center gap-px bg-gray-100 dark:bg-slate-800 border border-gray-100 dark:border-slate-800 transition-colors duration-500 overflow-hidden min-w-0">
                    <div className="bg-white dark:bg-slate-950 relative flex items-center transition-colors flex-1 md:flex-none">
                        <span className="material-symbols-outlined absolute left-3 text-[14px] text-slate-400 dark:text-slate-500">search</span>
                        <input
                            type="text"
                            placeholder="Search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-4 py-2.5 bg-transparent border-none focus:outline-none text-sm text-slate-900 dark:text-slate-200 font-medium w-full md:w-64 rounded-none transition-colors"
                        />
                    </div>
                    <button
                        onClick={refetchAll}
                        disabled={isLoading}
                        className="p-3 bg-slate-900 dark:bg-blue-600 text-white hover:bg-slate-800 dark:hover:bg-blue-500 disabled:opacity-50 transition-colors shrink-0"
                    >
                        <span className="material-symbols-outlined text-[16px]">refresh</span>
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-gray-100 dark:bg-slate-800 border-t border-b border-gray-100 dark:border-slate-800 transition-colors duration-500">
                {isLoading ? (
                    <div className="col-span-5 bg-white dark:bg-slate-950 p-8 transition-colors"><SkeletonLoader.Stats /></div>
                ) : (
                    [
                        { label: 'Total Users', value: stats.total_users, icon: 'group', color: 'text-slate-900 dark:text-slate-200' },
                        { label: 'Total Bots', value: stats.total_companies, icon: 'smart_toy', color: 'text-slate-900 dark:text-slate-200' },
                        { label: 'Active Bots', value: stats.active_bots, icon: 'bolt', color: 'text-emerald-600 dark:text-emerald-400' },
                        { label: 'Total Messages', value: stats.total_messages?.toLocaleString() ?? '0', icon: 'forum', color: 'text-blue-600 dark:text-blue-400' },
                        { label: 'Custom Plans', value: stats.custom_plan_count, icon: 'build', color: 'text-emerald-600 dark:text-emerald-400' },
                    ].map((s, i) => (
                        <div key={i} className="bg-white dark:bg-slate-950 p-3 sm:p-5 md:p-8 transition-colors duration-500">
                            <div className="flex items-center justify-between mb-3">
                                <div className={`p-1.5 sm:p-2 border border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900 rounded-none transition-colors ${s.color}`}>
                                    <span className="material-symbols-outlined text-[14px] sm:text-[16px] transition-colors">{s.icon}</span>
                                </div>
                                <span className="text-[10px] sm:text-md uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display transition-colors">Live</span>
                            </div>
                            <p className="text-[9px] sm:text-[11px] md:text-md uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display mb-1 transition-colors truncate">{s.label}</p>
                            <h3 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">{s.value}</h3>
                        </div>
                    ))
                )}
            </div>

            {/* Tier filter tabs */}
            {!isLoading && !hasError && (
                <div className="bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 px-4 pt-4 pb-1 flex gap-1 overflow-x-auto scrollbar-hide transition-colors duration-500 min-w-0">
                    {FILTER_TIERS.map(t => (
                        <button
                            key={t}
                            onClick={() => setTierFilter(t)}
                            className={`px-3 py-1.5 text-[10px] font-google font-bold uppercase tracking-widest transition-colors ${tierFilter === t
                                    ? 'bg-slate-900 dark:bg-blue-600 text-white'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-900'
                                }`}
                        >
                            {t}
                            {t !== 'ALL' && (
                                <span className="ml-1.5 opacity-60">
                                    {users.filter(u => u.tier === t).length}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            )}

            {/* Main Content */}
            <div className="bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 transition-colors duration-500">
                <div className="px-4 py-8 md:p-10">
                    {isLoading ? (
                        <SkeletonLoader.Table />
                    ) : hasError ? (
                        <div className="flex flex-col items-center justify-center py-20 border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-900/10">
                            <span className="material-symbols-outlined text-[40px] text-red-300 dark:text-red-700 mb-3">error</span>
                            <p className="text-sm font-google font-bold text-red-600 dark:text-red-400 mb-1">Failed to load data</p>
                            <p className="text-[11px] font-google text-red-400 dark:text-red-600 mb-4">Check your connection and try again</p>
                            <button onClick={refetchAll} className="px-4 py-2 text-[10px] font-google font-bold uppercase tracking-widest bg-red-600 text-white hover:bg-red-700 transition-colors">
                                Retry
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Mobile: Bento cards */}
                            <div className="md:hidden space-y-3">
                                {filteredUsers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-16 border border-dashed border-gray-200 dark:border-slate-700">
                                        <span className="material-symbols-outlined text-[40px] text-gray-200 dark:text-slate-700 mb-3">manage_accounts</span>
                                        <p className="text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">No users found</p>
                                    </div>
                                ) : filteredUsers.map(u => (
                                    <UserCard key={u.clerk_id} u={u} onManage={setSelectedUser} />
                                ))}
                            </div>

                            {/* Desktop: sticky-header table */}
                            <div className="hidden md:block overflow-x-auto max-h-[640px] overflow-y-auto border border-gray-100 dark:border-slate-800 custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-slate-900 shadow-sm transition-colors">
                                        <tr>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-r border-gray-100 dark:border-slate-800">Entity Details</th>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-r border-gray-100 dark:border-slate-800">Tier / Plan</th>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-r border-gray-100 dark:border-slate-800">Usage</th>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 border-r border-gray-100 dark:border-slate-800">Bots</th>
                                            <th className="px-6 py-4 text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 text-right">Controls</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                        {filteredUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={5}>
                                                    <div className="flex flex-col items-center justify-center py-16">
                                                        <span className="material-symbols-outlined text-[40px] text-gray-200 dark:text-slate-700 mb-3">manage_accounts</span>
                                                        <p className="text-[11px] font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">No users found</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : filteredUsers.map(u => {
                                            const usage = u.usage_tracking || {};
                                            const botCount = (u.companies || []).length;
                                            const isCustom = u.tier === 'CUSTOM';
                                            return (
                                                <tr key={u.clerk_id} className="hover:bg-gray-50 dark:hover:bg-slate-900/50 transition-colors">
                                                    <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-9 h-9 bg-gray-50 dark:bg-slate-900 border border-gray-100 dark:border-slate-800 flex items-center justify-center text-sm font-google font-bold text-slate-500 shrink-0">
                                                                {u.email?.charAt(0).toUpperCase()}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-google font-bold text-slate-900 dark:text-slate-200 truncate max-w-[200px]" title={u.email}>{u.email}</p>
                                                                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-[200px]">{u.clerk_id}</p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800">
                                                        <div className="flex flex-col gap-1">
                                                            <TierBadge tier={u.role === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : u.tier} />
                                                            <StatusBadge status={u.status} />
                                                            {isCustom && u.custom_plan_config?.plan_name && (
                                                                <span className="text-[10px] font-google text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                                                                    <span className="material-symbols-outlined text-[10px]">build</span>
                                                                    {u.custom_plan_config.plan_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800 min-w-[160px]">
                                                        <UsageBar used={usage.messages_used} limit={usage.message_limit} />
                                                    </td>
                                                    <td className="px-6 py-4 border-r border-gray-100 dark:border-slate-800">
                                                        <div className="flex flex-col gap-1">
                                                            <span className="inline-flex items-center gap-1 text-[11px] font-google font-bold text-slate-700 dark:text-slate-300">
                                                                <span className="material-symbols-outlined text-[13px]">smart_toy</span>
                                                                {botCount} total
                                                            </span>
                                                            {botCount > 0 && (
                                                                <span className="text-[10px] font-google text-emerald-600 dark:text-emerald-400">
                                                                    {(u.companies || []).filter(b => b.is_active !== false).length} active
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <button
                                                            onClick={() => setSelectedUser(u)}
                                                            className="px-3 py-1.5 text-[10px] font-google font-bold uppercase tracking-widest bg-slate-900 dark:bg-slate-800 text-white hover:bg-slate-700 dark:hover:bg-slate-700 transition-colors"
                                                        >
                                                            Manage
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Slide-over */}
            <AnimatePresence>
                {selectedUser && (
                    <ManageSlideOver
                        user={selectedUser}
                        onClose={() => setSelectedUser(null)}
                        onSave={handleSaveLimits}
                        isSaving={limitsMutation.isPending}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export default AdminDashboard;
