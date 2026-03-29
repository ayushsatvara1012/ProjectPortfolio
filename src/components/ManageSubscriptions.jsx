import React, { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Zap, Rocket, Shield, Calendar, Clock, AlertCircle, ExternalLink } from 'lucide-react';
import { useUserRole } from '../context/UserContext';
import Alert from './alert';

// ─── Skeleton Loader ───────────────────────────────────────────────────────────
const BillingSkeleton = () => (
    <div className="animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-slate-200 rounded-none" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-100">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-slate-200 rounded-none" />
            ))}
        </div>
        <div className="h-12 bg-slate-200 rounded-none" />
        <div className="h-12 bg-slate-200 rounded-none" />
    </div>
);

// ─── Tier metadata ─────────────────────────────────────────────────────────────
const TIER_META = {
    FREE:    { label: 'Free',         color: 'text-slate-500',   badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500',    icon: Shield },
    TRIAL:   { label: 'Free Trial',   color: 'text-indigo-600',  badge: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600', icon: Zap },
    STARTER: { label: 'Professional', color: 'text-blue-600',    badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600',     icon: Rocket },
    PRO:     { label: 'Enterprise',   color: 'text-violet-600',  badge: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600', icon: Shield },
};

const POLAR_URLS = {
    STARTER: `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_ohwJA87iVQyjKgqyQsTcx4yJuWNg5VK907DuI4ZdmGd/redirect`,
    PRO:     `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_uXNpB5PduaGrEORwhlkn1rELOCqepPiNXJGG917fccl/redirect`,
};

// ─── Component ─────────────────────────────────────────────────────────────────
const ManageSubscriptions = () => {
    const { getToken } = useAuth();
    const navigate = useNavigate();
    const {
        userTier,
        subscriptionStatus,
        trialEndDate,
        billingPeriodEnd,
        isLoading,
        refreshUser,
    } = useUserRole();

    const [alert, setAlert] = useState({ open: false, type: 'success', title: '', msg: '' });
    const [processing, setProcessing] = useState(null); // 'trial' | 'portal' | 'cancel' | 'starter' | 'pro'

    // Resolve tier safely
    const tier = userTier || 'FREE';
    const meta = TIER_META[tier] || TIER_META.FREE;
    const TierIcon = meta.icon;

    // ── Computed values ────────────────────────────────────────────────────────
    const trialDaysLeft = (() => {
        if (!trialEndDate) return null;
        const delta = new Date(trialEndDate) - new Date();
        return Math.max(0, Math.ceil(delta / (1000 * 60 * 60 * 24)));
    })();

    const formattedPeriodEnd = billingPeriodEnd
        ? new Date(billingPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';

    // ── Helpers ────────────────────────────────────────────────────────────────
    const showAlert = useCallback((type, title, msg) => {
        setAlert({ open: true, type, title, msg });
        setTimeout(() => setAlert(prev => ({ ...prev, open: false })), 8000);
    }, []);

    const baseUrl = import.meta.env.VITE_API_URL || '';

    // ── Actions ────────────────────────────────────────────────────────────────
    const handleStartTrial = async () => {
        setProcessing('trial');
        try {
            const token = await getToken();
            const res = await fetch(`${baseUrl}/api/user/subscription-manual`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await res.json();

            if (!res.ok) {
                // Trial Bouncer feedback
                if (res.status === 403) {
                    showAlert('warning', 'Trial Locked', data.detail || 'Your plan does not allow trial activation.');
                } else {
                    showAlert('error', 'Error', data.detail || 'Could not start trial.');
                }
                return;
            }

            showAlert('success', 'Trial Activated!', 'Your 30-day free trial has started. Enjoy premium access!');
            await refreshUser();
        } catch {
            showAlert('error', 'Error', 'Network error. Please try again.');
        } finally {
            setProcessing(null);
        }
    };

    const handleUpgrade = (targetTier) => async () => {
        setProcessing(targetTier.toLowerCase());
        try {
            const token = await getToken();
            // Get the current Clerk user ID from the token payload
            const payload = JSON.parse(atob(token.split('.')[1]));
            const userId = payload.sub;
            const returnUrl = `${window.location.origin}/register?payment=success`;
            const checkoutUrl = `${POLAR_URLS[targetTier]}?customer_external_id=${userId}&success_url=${returnUrl}`;
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
        } finally {
            setProcessing(null);
        }
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
        } finally {
            setProcessing(null);
        }
    };

    const btnBase = 'w-full py-3 rounded-none text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2';
    const btnPrimary = `${btnBase} bg-slate-900 text-white hover:bg-slate-800 active:scale-[0.99]`;
    const btnSecondary = `${btnBase} border border-gray-100 text-slate-600 hover:bg-gray-50`;
    const btnDanger = `${btnBase} border border-red-100 text-red-600 hover:bg-red-50`;

    const isDisabled = (key) => processing !== null;
    const label = (key, text) => processing === key ? 'Processing...' : text;

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="grid gap-px bg-gray-100 border border-gray-100">
            {/* Header Cell */}
            <div className="bg-white px-8 py-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                    <h4 className="text-[11px] font-bold uppercase tracking-widest text-slate-400">Subscription</h4>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest border border-current/10 ${meta.badge} rounded-none`}>
                    <TierIcon className="w-3 h-3" />
                    {meta.label}
                </span>
            </div>

            {/* Skeleton or Content Area */}
            {isLoading ? (
                <div className="bg-white p-8"><BillingSkeleton /></div>
            ) : (
                <>
                    {/* Stats Grid Cell (Flush internal) */}
                    <div className="grid grid-cols-3 gap-px bg-gray-100 border-b border-gray-100">
                        <div className="bg-white p-6 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Plan</p>
                            <p className={`text-sm font-black ${meta.color}`}>{meta.label}</p>
                        </div>
                        <div className="bg-white p-6 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Status</p>
                            <p className={`text-sm font-black ${subscriptionStatus === 'ACTIVE' ? 'text-emerald-600' : subscriptionStatus === 'CANCELED' ? 'text-red-500' : 'text-amber-500'}`}>
                                {subscriptionStatus || 'Active'}
                            </p>
                        </div>
                        <div className="bg-white p-6 text-center">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                                {tier === 'TRIAL' ? 'Days Left' : 'Renews'}
                            </p>
                            <p className="text-sm font-black text-slate-900">
                                {tier === 'TRIAL'
                                    ? (trialDaysLeft !== null ? `${trialDaysLeft}d` : '—')
                                    : formattedPeriodEnd}
                            </p>
                        </div>
                    </div>

                    {/* Actions Area */}
                    <div className="bg-white p-8">
                        {/* Trial Countdown Banner */}
                        {tier === 'TRIAL' && trialDaysLeft !== null && (
                            <div className={`flex items-center gap-3 p-4 mb-6 border text-xs font-medium rounded-none
                                ${trialDaysLeft <= 5
                                    ? 'bg-amber-50 border-amber-100 text-amber-700'
                                    : 'bg-slate-50 border-gray-100 text-slate-600'
                                }`}>
                                <Clock className="w-4 h-4 shrink-0" />
                                <span>
                                    {trialDaysLeft > 0
                                        ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} remaining in your free trial.`
                                        : 'Your trial has expired. Upgrade to continue.'}
                                </span>
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-px bg-gray-100 border border-gray-100 mb-6">
                            {tier === 'FREE' && (
                                <>
                                    <div className="bg-white"><button onClick={handleStartTrial} disabled={isDisabled('trial')} className={btnPrimary}>{label('trial', 'Start 30-Day Free Trial')}</button></div>
                                    <div className="bg-white"><button onClick={handleUpgrade('STARTER')} disabled={isDisabled('starter')} className={btnSecondary}>{label('starter', 'Upgrade to Professional — $5/mo')}</button></div>
                                    <div className="bg-white"><button onClick={handleUpgrade('PRO')} disabled={isDisabled('pro')} className={btnSecondary}>{label('pro', 'Upgrade to Enterprise — $10/mo')}</button></div>
                                </>
                            )}
                            {tier === 'TRIAL' && (
                                <>
                                    <div className="bg-white"><button onClick={handleUpgrade('STARTER')} disabled={isDisabled('starter')} className={btnPrimary}>{label('starter', 'Upgrade to Professional — $5/mo')}</button></div>
                                    <div className="bg-white"><button onClick={handleUpgrade('PRO')} disabled={isDisabled('pro')} className={btnSecondary}>{label('pro', 'Upgrade to Enterprise — $10/mo')}</button></div>
                                </>
                            )}
                            {(tier === 'STARTER' || tier === 'PRO') && (
                                <>
                                    <div className="bg-white"><button onClick={handleBillingPortal} disabled={isDisabled('portal')} className={btnPrimary}><ExternalLink className="w-3.5 h-3.5" /> {label('portal', 'Manage Billing')}</button></div>
                                    {subscriptionStatus !== 'CANCELED' && (
                                        <div className="bg-white"><button onClick={handleCancel} disabled={isDisabled('cancel')} className={btnDanger}><AlertCircle className="w-3.5 h-3.5" /> {label('cancel', 'Cancel Subscription')}</button></div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Full Pricing CTA */}
                        {(tier === 'FREE' || tier === 'TRIAL') && (
                            <p className="text-center text-[10px] text-slate-400">
                                View all plans →{' '}
                                <button
                                    onClick={() => navigate('/app/pricing')}
                                    className="text-slate-900 font-bold hover:underline"
                                >
                                    Pricing Page
                                </button>
                            </p>
                        )}
                    </div>
                </>
            )}

            <Alert
                isOpen={alert.open}
                type={alert.type}
                title={alert.title}
                message={alert.msg}
                onClose={() => setAlert(prev => ({ ...prev, open: false }))}
            />
        </div>
    );
};

export default ManageSubscriptions;
