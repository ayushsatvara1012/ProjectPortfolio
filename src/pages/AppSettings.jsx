import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useUser, useAuth, UserButton } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, Zap, Rocket, Shield, AlertCircle, ExternalLink } from 'lucide-react';
import Alert from '../components/alert';
import { useBotSettings } from '../context/BotSettingsContext';
import { useUserRole } from '../context/UserContext';
import BotPreview from '../components/BotPreview';
import { useAuthenticatedFetch } from '../hooks/useApiCall';
import LogoCustomizer from '../components/LogoCustomizer';
import { SkeletonBase } from '../components/SkeletonLoader';

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';
const inputCls = "w-full text-md font-medium font-google px-3 py-2.5 bg-transparent border border-gray-300 dark:border-slate-800 focus:outline-none focus:ring-1 focus:ring-slate-900/20 dark:focus:ring-blue-500/50 focus:border-slate-400 dark:focus:border-blue-400 text-slate-900 dark:text-slate-200 transition-colors rounded-sm";
const labelCls = "block text-lg font-semibold font-google text-slate-600 dark:text-slate-400 mb-1.5 transition-colors";
const headingCls = "text-xl font-medium font-google mb-4 transition-colors text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-green-600 dark:from-blue-400 dark:to-green-500";
const sectionGap = 'space-y-px';

// ── Tier metadata ──────────────────────────────────────────────────────────────
const TIER_META = {
    FREE:    { label: 'Free',         color: 'text-slate-500',   badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500',    icon: Shield },
    BASIC:   { label: 'Basic',        color: 'text-blue-600',    badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600',     icon: Zap },
    STARTER: { label: 'Professional', color: 'text-emerald-600', badge: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600', icon: Rocket },
    PRO:     { label: 'Enterprise',   color: 'text-cyan-600',    badge: 'bg-cyan-50 dark:bg-cyan-900/30 text-cyan-600',    icon: Shield },
};

const POLAR_URLS = {
    BASIC:   import.meta.env.VITE_POLAR_BASIC_URL,
    STARTER: import.meta.env.VITE_POLAR_STARTER_URL,
    PRO:     import.meta.env.VITE_POLAR_PRO_URL,
};

// ── Account Tabs ───────────────────────────────────────────────────────────────
const ACCOUNT_TABS = [
    { id: 'profile',  label: 'Profile',  icon: 'person' },
    { id: 'billing',  label: 'Billing',  icon: 'credit_card' },
    { id: 'apikeys',  label: 'API Keys', icon: 'vpn_key' },
];

// ── Profile Tab ────────────────────────────────────────────────────────────────
const ProfileTab = () => {
    const { user } = useUser();
    const { userRole } = useUserRole();

    const roleDisplay = userRole === 'SUPER_ADMIN'
        ? { label: 'Platform Owner', cls: 'bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/40' }
        : userRole === 'ADMIN'
        ? { label: 'Admin', cls: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-900/40' }
        : { label: 'Member', cls: 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700' };

    return (
        <div className="space-y-6">
            {/* Avatar card */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border border-gray-100 dark:border-slate-800 transition-colors">
                <div className="relative shrink-0">
                    <UserButton appearance={{ elements: { avatarBox: 'w-16 h-16' } }} />
                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white dark:border-slate-950 rounded-full" title="Online" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-2xl font-display font-bold text-slate-900 dark:text-slate-100 truncate transition-colors">
                        {user?.fullName || 'Developer'}
                    </h3>
                    <p className="text-md font-display text-slate-500 dark:text-slate-400 mt-0.5 truncate transition-colors">
                        {user?.primaryEmailAddress?.emailAddress}
                    </p>
                    <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 border text-[10px] uppercase tracking-widest font-bold font-sans transition-colors ${roleDisplay.cls}`}>
                        <span className="material-symbols-outlined text-[11px]">
                            {userRole === 'SUPER_ADMIN' ? 'verified_user' : userRole === 'ADMIN' ? 'shield_person' : 'person'}
                        </span>
                        {roleDisplay.label}
                    </span>
                </div>
            </div>

            {/* Connected accounts hint */}
            <div className="p-5 border border-dashed border-gray-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 flex items-start gap-3 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">info</span>
                <div>
                    <p className="text-md font-display font-semibold text-slate-700 dark:text-slate-300 transition-colors">Click your avatar to manage your profile</p>
                    <p className="text-md font-display text-slate-500 dark:text-slate-500 mt-0.5 leading-relaxed transition-colors">
                        Update your name, password, profile photo, and connected social accounts (Google, GitHub) from the Clerk profile panel.
                    </p>
                </div>
            </div>

            {/* Account metadata grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100 dark:bg-slate-800">
                <div className="bg-white dark:bg-slate-950 p-5 transition-colors">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Full Name</p>
                    <p className="text-md font-display font-semibold text-slate-800 dark:text-slate-200 truncate transition-colors">
                        {user?.fullName || '—'}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-950 p-5 transition-colors">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Primary Email</p>
                    <p className="text-md font-display font-semibold text-slate-800 dark:text-slate-200 truncate transition-colors">
                        {user?.primaryEmailAddress?.emailAddress || '—'}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-950 p-5 transition-colors">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Account Created</p>
                    <p className="text-md font-display font-semibold text-slate-800 dark:text-slate-200 transition-colors">
                        {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-950 p-5 transition-colors">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Role</p>
                    <p className={`text-md font-display font-semibold transition-colors ${
                        userRole === 'SUPER_ADMIN' ? 'text-rose-600 dark:text-rose-400' :
                        userRole === 'ADMIN' ? 'text-amber-600 dark:text-amber-400' :
                        'text-slate-800 dark:text-slate-200'
                    }`}>
                        {roleDisplay.label}
                    </p>
                </div>
            </div>
        </div>
    );
};

// ── Billing Tab ────────────────────────────────────────────────────────────────
const BillingTab = () => {
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const {
        userTier, subscriptionStatus, billingPeriodEnd, isLoading, refreshUser,
    } = useUserRole();

    const [alert, setAlert] = useState({ open: false, type: 'success', title: '', msg: '' });
    const [processing, setProcessing] = useState(null);

    const tier = userTier || 'FREE';
    const meta = TIER_META[tier] || TIER_META.FREE;
    const TierIcon = meta.icon;

    const formattedPeriodEnd = billingPeriodEnd
        ? new Date(billingPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';

    const showAlert = useCallback((type, title, msg) => {
        setAlert({ open: true, type, title, msg });
        setTimeout(() => setAlert(prev => ({ ...prev, open: false })), 8000);
    }, []);

    const baseUrl = import.meta.env.VITE_API_URL || '';

    const handleUpgrade = (targetTier) => async () => {
        setProcessing(targetTier.toLowerCase());
        try {
            const token = await getToken();
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userId = payload.sub;
            const returnUrl = `${window.location.origin}/app/register?payment=success`;
            const checkoutUrl = `${POLAR_URLS[targetTier]}?customer_external_id=${userId}&success_url=${encodeURIComponent(returnUrl)}`;
            window.location.href = checkoutUrl;
        } catch {
            showAlert('error', 'Error', 'Could not initiate checkout. Please try again.');
            setProcessing(null);
        }
    };

    const handleBillingPortal = async () => {
        setProcessing('portal');
        try {
            const token = await getToken();
            const res = await fetch(`${baseUrl}/api/billing/portal`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);
            window.open(data.url, '_blank');
        } catch (e) {
            showAlert('error', 'Portal Error', e.message || 'Could not open billing portal.');
        } finally { setProcessing(null); }
    };

    const handleCancel = async () => {
        if (!window.confirm('Are you sure you want to cancel? You will retain access until the end of the billing period.')) return;
        setProcessing('cancel');
        try {
            const token = await getToken();
            const res = await fetch(`${baseUrl}/api/user/subscription/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail);
            showAlert('warning', 'Cancellation Scheduled', 'Your subscription will end at the close of your billing period.');
            await refreshUser();
        } catch (e) {
            showAlert('error', 'Error', e.message || 'Cancellation failed. Please try again.');
        } finally { setProcessing(null); }
    };

    const isDisabled = () => processing !== null;
    const label = (key, text) => processing === key ? 'Processing...' : text;

    const btnBase = 'py-3 px-5 text-[10px] uppercase tracking-[0.15em] font-bold font-display transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 min-h-[44px]';
    const btnPrimary = `${btnBase} bg-gradient-to-r from-blue-600 to-green-600 text-white hover:opacity-90 shadow-md`;
    const btnSecondary = `${btnBase} border border-gray-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 bg-white dark:bg-slate-950`;
    const btnDanger = `${btnBase} border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 bg-white dark:bg-slate-950`;

    if (isLoading) return (
        <div className="space-y-4 animate-pulse">
            <SkeletonBase className="h-20 w-full" />
            <div className="grid grid-cols-3 gap-px">
                {[1,2,3].map(i => <SkeletonBase key={i} className="h-20" />)}
            </div>
            <SkeletonBase className="h-12 w-full" />
        </div>
    );

    return (
        <div className="space-y-6">
            {/* Current plan hero */}
            <div className="p-6 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 border border-gray-100 dark:border-slate-800 flex items-center justify-between gap-4 transition-colors">
                <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1">Current Plan</p>
                    <div className="flex items-center gap-2.5">
                        <TierIcon className={`w-5 h-5 ${meta.color}`} />
                        <span className={`text-2xl font-display font-bold ${meta.color}`}>{meta.label}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 text-[10px] uppercase tracking-widest font-bold font-display border border-current/10 ${meta.badge} transition-colors`}>
                        <TierIcon className="w-3 h-3" />
                        {meta.label}
                    </span>
                    <span className={`text-[10px] uppercase tracking-widest font-bold font-sans ${
                        subscriptionStatus === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' :
                        subscriptionStatus === 'CANCELED' ? 'text-red-500 dark:text-red-400' :
                        'text-amber-500 dark:text-amber-400'
                    }`}>
                        {subscriptionStatus || 'Active'}
                    </span>
                </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-slate-800">
                <div className="bg-white dark:bg-slate-950 p-5 text-center transition-colors">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Plan</p>
                    <p className={`text-lg font-display font-bold ${meta.color}`}>{meta.label}</p>
                </div>
                <div className="bg-white dark:bg-slate-950 p-5 text-center transition-colors">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">Status</p>
                    <p className={`text-lg font-display font-bold ${
                        subscriptionStatus === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' :
                        subscriptionStatus === 'CANCELED' ? 'text-red-500 dark:text-red-400' :
                        'text-amber-500 dark:text-amber-400'
                    }`}>
                        {subscriptionStatus || 'Active'}
                    </p>
                </div>
                <div className="bg-white dark:bg-slate-950 p-5 text-center transition-colors">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-1.5">
                        {tier === 'FREE' ? '—' : 'Renews'}
                    </p>
                    <p className="text-lg font-display font-bold text-slate-900 dark:text-slate-100">
                        {tier === 'FREE' ? 'N/A' : formattedPeriodEnd}
                    </p>
                </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                {tier === 'FREE' && (
                    <>
                        <button onClick={handleUpgrade('BASIC')} disabled={isDisabled()} className={`${btnPrimary} flex-1`}>{label('basic', 'Upgrade to Basic — $5/mo')}</button>
                        <button onClick={handleUpgrade('STARTER')} disabled={isDisabled()} className={`${btnSecondary} flex-1`}>{label('starter', 'Upgrade to Starter — $10/mo')}</button>
                        <button onClick={handleUpgrade('PRO')} disabled={isDisabled()} className={`${btnSecondary} flex-1`}>{label('pro', 'Upgrade to Pro — $20/mo')}</button>
                    </>
                )}
                {tier === 'BASIC' && (
                    <>
                        <button onClick={handleBillingPortal} disabled={isDisabled()} className={`${btnPrimary} flex-1`}><ExternalLink className="w-4 h-4" />{label('portal', 'Manage Billing')}</button>
                        <button onClick={handleUpgrade('STARTER')} disabled={isDisabled()} className={`${btnSecondary} flex-1`}>{label('starter', 'Upgrade to Professional — $10/mo')}</button>
                        <button onClick={handleUpgrade('PRO')} disabled={isDisabled()} className={`${btnSecondary} flex-1`}>{label('pro', 'Upgrade to Enterprise — $20/mo')}</button>
                        {subscriptionStatus !== 'CANCELED' && (
                            <button onClick={handleCancel} disabled={isDisabled()} className={`${btnDanger} flex-1`}><AlertCircle className="w-4 h-4" />{label('cancel', 'Cancel Subscription')}</button>
                        )}
                    </>
                )}
                {(tier === 'STARTER' || tier === 'PRO') && (
                    <>
                        <button onClick={handleBillingPortal} disabled={isDisabled()} className={`${btnPrimary} flex-1`}><ExternalLink className="w-4 h-4" />{label('portal', 'Manage Billing')}</button>
                        {subscriptionStatus !== 'CANCELED' && (
                            <button onClick={handleCancel} disabled={isDisabled()} className={`${btnDanger} flex-1`}><AlertCircle className="w-4 h-4" />{label('cancel', 'Cancel Subscription')}</button>
                        )}
                    </>
                )}
            </div>

            {/* Pricing CTA for free users */}
            {tier === 'FREE' && (
                <div className="p-4 border border-dashed border-blue-200 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-900/10 flex items-center justify-between gap-3 transition-colors">
                    <p className="text-md font-display text-slate-600 dark:text-slate-400 transition-colors">See full feature comparison across all plans.</p>
                    <button
                        onClick={() => navigate('/app/pricing')}
                        className="shrink-0 text-[10px] uppercase tracking-widest font-bold font-sans text-blue-600 dark:text-blue-400 hover:underline underline-offset-4 transition-colors"
                    >
                        View Pricing →
                    </button>
                </div>
            )}

            <Alert isOpen={alert.open} type={alert.type} title={alert.title} message={alert.msg} onClose={() => setAlert(prev => ({ ...prev, open: false }))} />
        </div>
    );
};

// ── API Keys Tab ───────────────────────────────────────────────────────────────
const ApiKeysTab = () => {
    const { getToken } = useAuth();
    const authFetch = useAuthenticatedFetch();
    const [isRotating, setIsRotating] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [showKey, setShowKey] = useState(false);
    const [alert, setAlert] = useState({ open: false, type: 'success', msg: '' });
    const baseUrl = import.meta.env.VITE_API_URL || '';

    const { data: botsData, isLoading: botsLoading } = useQuery({
        queryKey: ['bots'],
        queryFn: () => authFetch('/api/companies'),
    });
    const bots = botsData?.bots || [];

    const showAlertMsg = (type, msg) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 6000);
    };

    const handleRotate = async () => {
        if (!window.confirm('Rotating your API key will immediately invalidate the current key and any integrations using it. Continue?')) return;
        setIsRotating(true);
        setNewKey('');
        setShowKey(false);
        try {
            const token = await getToken();
            const res = await fetch(`${baseUrl}/api/company/rotate-key`, {
                method: 'POST', headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Key rotation failed.');
            setNewKey(data.new_key);
            showAlertMsg('success', 'Key rotated. Copy it now — it will not be shown again.');
        } catch (e) {
            showAlertMsg('error', e.message);
        } finally { setIsRotating(false); }
    };

    return (
        <div className="space-y-6">
            {/* Warning banner */}
            <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 transition-colors">
                <span className="material-symbols-outlined text-[18px] text-amber-500 mt-0.5 shrink-0">warning</span>
                <div>
                    <p className="text-md font-display font-semibold text-amber-800 dark:text-amber-300 transition-colors">Rotating invalidates immediately</p>
                    <p className="text-md font-display text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed transition-colors">
                        Your old API key will stop working instantly. Update any embeddings, webhook configs, or integrations before rotating if you're in production.
                    </p>
                </div>
            </div>

            {/* New key reveal */}
            <AnimatePresence>
                {newKey && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="p-5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/50 transition-colors"
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                            <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-400 font-sans">New Key — Copy Now (shown once)</p>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-sm text-slate-900 dark:text-slate-200 bg-white dark:bg-slate-950 border border-emerald-200 dark:border-emerald-900/50 p-3 transition-colors">
                            <span className="flex-1 truncate select-all">{showKey ? newKey : newKey.slice(0, 8) + '••••••••••••••••'}</span>
                            <button onClick={() => setShowKey(p => !p)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors p-1">
                                <span className="material-symbols-outlined text-[16px]">{showKey ? 'visibility_off' : 'visibility'}</span>
                            </button>
                            <button
                                onClick={() => { navigator.clipboard.writeText(newKey); showAlertMsg('success', 'Copied to clipboard!'); }}
                                className="px-3 py-1.5 bg-gradient-to-r from-blue-600 to-green-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-[12px]">content_copy</span>
                                Copy
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Bots list — shows which bot this key applies to */}
            {bots.length > 0 && (
                <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-3">Your Bots</p>
                    <div className="space-y-px bg-gray-100 dark:bg-slate-800">
                        {botsLoading ? (
                            [1,2].map(i => <SkeletonBase key={i} className="h-14 w-full" />)
                        ) : bots.map((bot) => (
                            <div key={bot.id} className="bg-white dark:bg-slate-950 px-5 py-3.5 flex items-center justify-between gap-3 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="material-symbols-outlined text-[18px] text-slate-400 dark:text-slate-500 shrink-0">smart_toy</span>
                                    <div className="min-w-0">
                                        <p className="text-md font-display font-semibold text-slate-800 dark:text-slate-200 truncate transition-colors">{bot.bot_name || 'Unnamed Bot'}</p>
                                        <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">{bot.allowed_origin || 'No domain set'}</p>
                                    </div>
                                </div>
                                <span className="shrink-0 text-[10px] uppercase tracking-widest font-bold font-sans px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                                    Active
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Rotate button */}
            <div className="pt-2">
                <button
                    onClick={handleRotate}
                    disabled={isRotating}
                    className="flex items-center gap-2.5 px-6 py-3 min-h-[48px] bg-gradient-to-r from-blue-600 to-green-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all shadow-md disabled:opacity-50 active:scale-[0.99]"
                >
                    {isRotating
                        ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> Rotating Key...</>
                        : <><span className="material-symbols-outlined text-[16px]">refresh</span> Rotate API Key</>
                    }
                </button>
                <p className="text-[10px] font-mono text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-widest">
                    All bots share one secret key per account
                </p>
            </div>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
};

// ── Account (unified) ──────────────────────────────────────────────────────────
export const AccountSection = ({ initialTab }) => {
    const [activeTab, setActiveTab] = useState(initialTab || 'profile');

    return (
        <div className="min-h-screen bg-white dark:bg-slate-900 transition-colors duration-500">
            {/* Page header */}
            <div className="px-6 py-6 border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 transition-colors">
                <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-0.5 transition-colors">Account</h2>
                <p className="text-md font-display text-slate-500 dark:text-slate-500 leading-relaxed transition-colors">
                    Manage your profile, subscription, and API credentials.
                </p>
            </div>

            {/* Tab bar */}
            <div className="flex items-center border-b border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 gap-1 transition-colors overflow-x-auto">
                {ACCOUNT_TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-3.5 text-[11px] uppercase tracking-widest font-bold font-sans border-b-2 transition-all whitespace-nowrap ${
                            activeTab === tab.id
                                ? 'border-slate-900 dark:border-slate-100 text-slate-900 dark:text-slate-100'
                                : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                        }`}
                    >
                        <span className={`material-symbols-outlined text-[16px] ${activeTab === tab.id ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'}`}>
                            {tab.icon}
                        </span>
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="p-6 md:p-8 max-w-3xl">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                    >
                        {activeTab === 'profile' && <ProfileTab />}
                        {activeTab === 'billing' && <BillingTab />}
                        {activeTab === 'apikeys' && <ApiKeysTab />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
};

// ── Billing (standalone redirect shim — keeps old route alive) ─────────────────
export const BillingSection = () => <AccountSection initialTab="billing" />;

// ── API Keys (standalone redirect shim — keeps old route alive) ────────────────
export const ApiKeysSection = () => <AccountSection initialTab="apikeys" />;

// ── Customize ─────────────────────────────────────────────────────────────────
export const CustomizeSection = () => {
    const { botSettings, updateSetting, saveSettings, fetchSettings, isSaving, isLoading } = useBotSettings();
    const { userTier, userRole } = useUserRole();
    const authFetch = useAuthenticatedFetch();
    const [alert, setAlert] = useState({ open: false, type: 'success', msg: '' });

    const [searchParams] = useSearchParams();
    const editBotId = searchParams.get('edit');

    // Bot Selection
    const [selectedBotId, setSelectedBotId] = useState(editBotId || '');
    const { data: botsData } = useQuery({
        queryKey: ['bots'],
        queryFn: () => authFetch('/api/companies'),
    });
    const bots = botsData?.bots || [];

    useEffect(() => {
        if (bots.length > 0 && !selectedBotId) {
            if (editBotId && bots.some(b => b.id === editBotId)) {
                setSelectedBotId(editBotId);
            } else {
                setSelectedBotId(bots[0].id);
            }
        } else if (bots.length > 0 && selectedBotId && editBotId && selectedBotId !== editBotId) {
            if (bots.some(b => b.id === editBotId)) {
                setSelectedBotId(editBotId);
            }
        }
    }, [bots, selectedBotId, editBotId]);

    useEffect(() => {
        if (selectedBotId) {
            fetchSettings(selectedBotId);
        }
    }, [selectedBotId]);

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
    const isProUser = ['PRO', 'BUSINESS', 'ENTERPRISE'].includes(userTier) || userRole === 'SUPER_ADMIN';

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-px h-auto lg:h-[calc(100vh-3rem)] bg-[#E8EBF0] dark:bg-slate-900 overflow-visible lg:overflow-hidden transition-colors duration-500">

            {/* ── LEFT: Settings Form ── */}
            <div className="bg-white dark:bg-slate-950 flex flex-col lg:overflow-hidden relative transition-colors h-auto lg:h-full">

                {/* Header */}
                <div className="px-8 py-6 border-b border-gray-100 dark:border-slate-800 shrink-0 transition-colors">
                    <h2 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-0.5 transition-colors">Customize</h2>
                    <p className="text-md font-display text-slate-500 dark:text-slate-500 leading-relaxed transition-colors">Configure your bot's visual identity. Changes reflect instantly in the preview.</p>
                </div>

                {/* Scrollable form */}
                <div className={`p-8 lg:flex-1 relative ${showFullOverlay ? 'overflow-hidden select-none' : 'lg:overflow-y-auto custom-scrollbar'}`}>

                    {/* Full lock overlay (FREE / no tier) */}
                    {showFullOverlay && (
                        <div className="absolute inset-0 z-50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center border-t border-gray-100 dark:border-slate-800 transition-colors cursor-help">
                            <span className="material-symbols-outlined text-[32px] text-slate-500 dark:text-slate-500 mb-4 transition-colors">lock</span>
                            <h3 className="text-md font-display uppercase tracking-widest font-bold text-slate-900 dark:text-slate-200 mb-2 transition-colors">Upgrade Required</h3>
                            <p className="text-md font-display text-slate-500 dark:text-slate-500 leading-relaxed max-w-[260px] mb-6 transition-colors">Customizing your bot's visual identity requires an active subscription.</p>
                            <Link to="/app/pricing" className="px-6 py-3 bg-linear-to-r from-blue-600 to-green-600 text-white text-md font-display uppercase tracking-widest font-bold hover:opacity-90 transition-all shadow-sm">
                                View Plans
                            </Link>
                        </div>
                    )}

                    {/* SUPER_ADMIN: Model Override */}
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
                                <p className="text-[10px] text-amber-600/70 mt-2 italic font-sans uppercase tracking-widest leading-relaxed">
                                    This override bypasses the user's subscription tier model mapping.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Bot Selector (multi-bot) */}
                    {bots.length > 1 && (
                        <div className="mb-8 p-6 bg-[#FAFAFA] dark:bg-slate-900 border border-gray-100 dark:border-slate-800 transition-colors shadow-sm">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-[14px] text-slate-500 dark:text-slate-500">smart_toy</span>
                                <p className={headingCls + ' mb-0'}>Select your Bot</p>
                            </div>
                            <div className="relative">
                                <select
                                    value={selectedBotId}
                                    onChange={e => setSelectedBotId(e.target.value)}
                                    className={inputCls + " appearance-none pr-10"}
                                >
                                    {bots.map(b => (
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

                            {/* ── Branding Toggle (STARTER+) ── */}
                            <div className="relative">
                                <div className={`flex items-start justify-between gap-4 p-4 border transition-colors ${canHideBranding ? 'border-gray-200 dark:border-slate-800 bg-[#FAFAFA] dark:bg-slate-900' : 'border-gray-100 dark:border-slate-800/50 bg-gray-50 dark:bg-slate-900/40 opacity-50'}`}>
                                    <div className="min-w-0">
                                        <p className="text-md font-semibold font-google text-slate-800 dark:text-slate-200 transition-colors">
                                            Remove "Powered by SaPyBase" branding
                                        </p>
                                        <p className="text-[11px] font-google text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">
                                            {canHideBranding
                                                ? 'Hide the SaPyBase footer from your widget. Your brand, fully.'
                                                : 'Available on Starter plan and above.'}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={botSettings.hideBranding}
                                        disabled={!canHideBranding}
                                        onClick={() => canHideBranding && updateSetting('hideBranding', !botSettings.hideBranding)}
                                        className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${botSettings.hideBranding && canHideBranding ? 'bg-blue-600' : 'bg-slate-200 dark:bg-slate-700'} ${!canHideBranding ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${botSettings.hideBranding && canHideBranding ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                                {!canHideBranding && (
                                    <div className="mt-1 flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[11px] text-blue-500">lock</span>
                                        <Link to="/app/pricing" className="text-[10px] font-bold font-sans uppercase tracking-widest text-blue-600 dark:text-blue-400 hover:underline underline-offset-2">
                                            Upgrade to Starter to unlock
                                        </Link>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* ── Divider ── */}
                        <div className="border-t border-gray-100 dark:border-slate-800 transition-colors" />

                        {/* ── Section: Logo & Shape (v13) ── */}
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

                        {/* ── Divider ── */}
                        <div className="border-t border-gray-100 dark:border-slate-800 transition-colors" />

                        {/* ── Advanced sections (STARTER+ gate) ── */}
                        <div className="space-y-6 relative">
                            {isAdvancedLocked && (
                                <div className="absolute -inset-4 z-40 bg-white/40 dark:bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center group cursor-help transition-all hover:backdrop-blur-sm">
                                    <div className="px-3 py-1.5 bg-linear-to-r from-blue-600 to-green-600 text-white text-sm uppercase tracking-widest font-bold font-sans shadow-lg flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">lock</span> Starter or Pro Required
                                    </div>
                                    <Link to="/app/pricing" className="mt-2 text-md font-bold text-slate-800 dark:text-slate-200 underline underline-offset-4 decoration-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Upgrade Now</Link>
                                </div>
                            )}

                            <div className={isAdvancedLocked ? 'opacity-40 grayscale-[0.5] pointer-events-none filter blur-[0.5px]' : ''}>
                                {/* Company Tone */}
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
                                                            ? [...botSettings.companyTone, tone]
                                                            : botSettings.companyTone.filter(t => t !== tone);
                                                        updateSetting('companyTone', newTones);
                                                    }}
                                                    className="w-4 h-4 accent-slate-900 dark:accent-blue-600"
                                                />
                                                <span className="text-lg font-google text-slate-700 dark:text-slate-300">{tone}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                {/* System Prompt */}
                                <div className="mb-6">
                                    <label className={labelCls}>System Prompt / Instructions</label>
                                    <textarea
                                        value={botSettings.systemPrompt}
                                        onChange={e => updateSetting('systemPrompt', e.target.value)}
                                        className={inputCls + ' min-h-[120px] resize-none py-3'}
                                        placeholder="Example: You are a helpful assistant for SaPyBase. Always be professional and direct..."
                                    />
                                </div>

                                {/* Quick Questions */}
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
                                    <p className="text-md font-google text-slate-400 dark:text-slate-500 mb-3">Each chip appears in the chat as a quick question. The text is both the label and the message sent to the bot.</p>
                                    <div className="space-y-2">
                                        {(Array.isArray(botSettings.quickQuestions) ? botSettings.quickQuestions : []).map((q, idx) => (
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
                                                    placeholder="e.g. What are your pricing plans?"
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

                        {/* ── Divider ── */}
                        <div className="border-t border-gray-100 dark:border-slate-800 transition-colors" />

                        {/* ── Section: Integrations (PRO) ── */}
                        <div className="space-y-4 relative">
                            {!isProUser && (
                                <div className="absolute -inset-4 z-40 bg-white/40 dark:bg-slate-950/40 backdrop-blur-[2px] flex flex-col items-center justify-center p-4 text-center group cursor-help transition-all hover:backdrop-blur-sm">
                                    <div className="px-3 py-1.5 bg-linear-to-r from-blue-600 to-green-600 text-white text-sm uppercase tracking-widest font-bold font-sans shadow-lg flex items-center gap-2">
                                        <span className="material-symbols-outlined text-sm">lock</span> Pro Required
                                    </div>
                                    <Link to="/app/pricing" className="mt-2 text-md font-bold text-slate-800 dark:text-slate-200 underline underline-offset-4 decoration-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">Upgrade Now</Link>
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
                                        <p className="text-md font-google text-yellow-600 mb-3">
                                            When a lead is captured, we'll POST the lead data to this URL. Works with Zapier, Make, Slack, HubSpot, and any HTTPS endpoint.
                                        </p>
                                        <input
                                            type="url"
                                            value={botSettings.webhookUrl || ''}
                                            onChange={e => updateSetting('webhookUrl', e.target.value)}
                                            className={inputCls}
                                            placeholder="https://hooks.zapier.com/hooks/catch/..."
                                        />
                                        <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-widest">
                                            Payload: event, lead_id, email, name, context, bot_id, bot_name
                                        </p>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Human Handoff — Instant Contact Link</label>
                                        <p className="text-md font-google text-yellow-600 mb-3">
                                            When a visitor requests a human, show them a direct link after the email is sent. Use a WhatsApp link, Calendly booking page, or any HTTPS URL.
                                        </p>
                                        <input
                                            type="url"
                                            value={botSettings.handoffRedirectUrl || ''}
                                            onChange={e => updateSetting('handoffRedirectUrl', e.target.value)}
                                            className={inputCls}
                                            placeholder="https://wa.me/1234567890  or  https://calendly.com/yourname"
                                        />
                                        <p className="text-[11px] font-mono text-slate-400 dark:text-slate-500 mt-2 uppercase tracking-widest">
                                            Shown as a "Connect instantly" button after handoff is requested
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Save Button */}
                        <div className="pt-4 border-t border-gray-100 dark:border-slate-800 transition-colors">
                            <button
                                onClick={async () => {
                                    if (showFullOverlay) {
                                        setAlert({ open: true, type: 'error', msg: 'Unauthorized: Customize requires an active subscription.' });
                                        return;
                                    }
                                    const res = await saveSettings(selectedBotId);
                                    if (res.success) {
                                        setAlert({ open: true, type: 'success', msg: 'Settings saved successfully!' });
                                    } else {
                                        setAlert({ open: true, type: 'error', msg: res.message });
                                    }
                                }}
                                disabled={isSaving || showFullOverlay}
                                className="w-full py-4 min-h-[48px] bg-linear-to-r from-blue-600 to-green-600 text-white text-lg uppercase tracking-widest font-bold font-sans hover:opacity-90 transition-all flex items-center justify-center gap-3 active:scale-[0.98] disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <><div className="w-3 h-3 border-2 border-white/30 border-t-white animate-spin" /> PERSISTING...</>
                                ) : (
                                    <>SAVE_CONFIG</>
                                )}
                            </button>
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

            {/* ── RIGHT: Preview Column ── */}
            <div className={`overflow-hidden border-t lg:border-t-0 lg:border-l w-full h-auto lg:h-[calc(100vh-3rem)] relative transition-colors flex flex-col items-center justify-center p-0 lg:p-8 ${isDark ? 'dark bg-slate-950 border-slate-800' : 'bg-[#FAFAFA] border-gray-100'}`}>

                {/* Responsive Background Layer */}
                <div
                    className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-100 transition-opacity duration-700"
                    style={{ backgroundImage: "url('/nature_1.webp')" }}
                />

                {/* Glassmorphism Overlay */}
                <div className="absolute inset-0 bg-white/50 dark:bg-slate-950/60 backdrop-blur-[1px] pointer-events-none transition-colors duration-500" />

                {/* Theme toggle */}
                <div className="absolute bottom-8 lg:top-2 lg:bottom-auto left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-3 w-full px-4 text-center">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 dark:text-slate-500 font-sans">
                        Check contrast in both modes
                    </p>
                    <button
                        onClick={() => setIsDark(d => !d)}
                        className="flex items-center gap-2.5 px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all group"
                    >
                        <div className="w-5 h-5 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 transition-colors">
                            {isDark
                                ? <span className="material-symbols-outlined text-[14px] text-amber-500">light_mode</span>
                                : <span className="material-symbols-outlined text-[14px] text-blue-500">dark_mode</span>
                            }
                        </div>
                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-700 dark:text-slate-300">
                            {isDark ? 'Preview: Light Mode' : 'Preview: Dark Mode'} — <span className="text-blue-500 dark:text-amber-500">Switch</span>
                        </span>
                    </button>
                </div>

                <div className="w-full lg:h-full lg:w-full flex lg:items-center lg:justify-center origin-top lg:origin-center scale-[0.82] lg:scale-100 transition-transform duration-500 py-4 lg:py-0">
                    <BotPreview theme={isDark ? 'dark' : 'light'} />
                </div>
            </div>
        </div>
    );
};

// ── Shell ─────────────────────────────────────────────────────────────────────
const AppSettings = () => <Outlet />;
export default AppSettings;
