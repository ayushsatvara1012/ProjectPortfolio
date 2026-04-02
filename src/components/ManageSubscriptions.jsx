import React, { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, Zap, Rocket, Shield, AlertCircle, ExternalLink } from 'lucide-react';
import { useUserRole } from '../context/UserContext';
import { SkeletonBase } from './SkeletonLoader';
import Alert from './alert';

// ─── Skeleton Loader ───────────────────────────────────────────────────────────
const BillingSkeleton = () => (
    <div className="animate-pulse space-y-4">
        <div className="h-6 w-1/3 bg-slate-200 dark:bg-slate-800 rounded-none transition-colors" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-gray-100 dark:bg-slate-800">
            {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-slate-200 dark:bg-slate-800 rounded-none transition-colors" />
            ))}
        </div>
        <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-none transition-colors" />
        <div className="h-12 bg-slate-200 dark:bg-slate-800 rounded-none transition-colors" />
    </div>
);

// ─── Tier metadata ─────────────────────────────────────────────────────────────
const TIER_META = {
    FREE:    { label: 'Free',         color: 'text-slate-500',   badge: 'bg-slate-100 dark:bg-slate-800 text-slate-500',    icon: Shield },
    BASIC:   { label: 'Basic',        color: 'text-indigo-600',  badge: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600', icon: Zap },
    STARTER: { label: 'Professional', color: 'text-blue-600',    badge: 'bg-blue-50 dark:bg-blue-900/30 text-blue-600',     icon: Rocket },
    PRO:     { label: 'Enterprise',   color: 'text-violet-600',  badge: 'bg-violet-50 dark:bg-violet-900/30 text-violet-600', icon: Shield },
};

const POLAR_URLS = {
    BASIC:   `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_uyCgRv3VKICQ1RfDnEI1ywQvgxlx9BR9Ri2442Sf3xF/redirect`,
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
    const [processing, setProcessing] = useState(null); // 'portal' | 'cancel' | 'basic' | 'starter' | 'pro'

    // Resolve tier safely
    const tier = userTier || 'FREE';
    const meta = TIER_META[tier] || TIER_META.FREE;
    const TierIcon = meta.icon;

    // ── Computed values ────────────────────────────────────────────────────────
    const formattedPeriodEnd = billingPeriodEnd
        ? new Date(billingPeriodEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : '—';

    // ── Helpers ────────────────────────────────────────────────────────────────
    const showAlert = useCallback((type, title, msg) => {
        setAlert({ open: true, type, title, msg });
        setTimeout(() => setAlert(prev => ({ ...prev, open: false })), 8000);
    }, []);

    const baseUrl = import.meta.env.VITE_API_URL || '';

    const handleUpgrade = (targetTier) => async () => {
        setProcessing(targetTier.toLowerCase());
        try {
            const token = await getToken();
            // Get the current Clerk user ID from the token payload
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

    const btnBase = 'w-full py-3 rounded-none text-sm uppercase tracking-widest font-bold font-display transition-all flex items-center justify-center gap-2';
    const btnPrimary = `${btnBase} bg-slate-900 dark:bg-indigo-600 text-white hover:bg-slate-800 dark:hover:bg-indigo-500 active:scale-[0.99]`;
    const btnSecondary = `${btnBase} border border-gray-100 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-800`;
    const btnDanger = `${btnBase} border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`;

    const isDisabled = (key) => processing !== null;
    const label = (key, text) => processing === key ? 'Processing...' : text;

    // ── Render ─────────────────────────────────────────────────────────────────
    if (isLoading) return (
        <div className="p-8 space-y-4">
            <SkeletonBase className="h-6 w-1/3" />
            <SkeletonBase className="h-24 w-full" />
        </div>
    );
    return (
        <div className="grid gap-px bg-gray-100 dark:bg-slate-800 border border-gray-100 dark:border-slate-800 transition-colors duration-500">
            {/* Header Cell */}
            <div className="bg-white dark:bg-slate-950 px-8 py-6 flex items-center justify-between transition-colors">
                <div className="flex items-center gap-2">
                    <CreditCard className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                    <h4 className="text-sm uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display">Subscription</h4>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-sm uppercase tracking-widest font-bold font-display border border-current/10 ${meta.badge} rounded-none transition-colors`}>
                    <TierIcon className="w-3 h-3" />
                    {meta.label}
                </span>
            </div>

            {/* Skeleton or Content Area */}
            {isLoading ? (
                <div className="bg-white dark:bg-slate-950 p-8 transition-colors"><BillingSkeleton /></div>
            ) : (
                <>
                    {/* Stats Grid Cell (Flush internal) */}
                    <div className="grid grid-cols-3 gap-px bg-gray-100 dark:bg-slate-800 border-b border-gray-100 dark:border-slate-800 transition-colors">
                        <div className="bg-white dark:bg-slate-950 p-6 text-center transition-colors">
                            <p className="text-sm  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display mb-1.5">Plan</p>
                            <p className={`text-xl md:text-2xl font-display font-bold ${meta.color}`}>{meta.label}</p>
                        </div>
                        <div className="bg-white dark:bg-slate-950 p-6 text-center transition-colors">
                            <p className="text-sm  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display mb-1.5">Status</p>
                            <p className={`text-xl md:text-2xl font-display font-bold ${subscriptionStatus === 'ACTIVE' ? 'text-emerald-600 dark:text-emerald-400' : subscriptionStatus === 'CANCELED' ? 'text-red-500 dark:text-red-400' : 'text-amber-500 dark:text-amber-400'}`}>
                                {subscriptionStatus || 'Active'}
                            </p>
                        </div>
                        <div className="bg-white dark:bg-slate-950 p-6 text-center transition-colors">
                            <p className="text-sm  uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display mb-1.5">
                                {tier === 'FREE' ? '-' : 'Renews'}
                            </p>
                            <p className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-100">
                                {tier === 'FREE' ? 'N/A' : formattedPeriodEnd}
                            </p>
                        </div>
                    </div>

                    {/* Actions Area */}
                    <div className="bg-white dark:bg-slate-950 p-8 transition-colors">

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-px bg-gray-100 dark:bg-slate-800 border border-gray-100 dark:border-slate-800 mb-6 transition-colors">
                            {tier === 'FREE' && (
                                <>
                                    <div className="bg-white dark:bg-slate-950 transition-colors"><button onClick={handleUpgrade('BASIC')} disabled={isDisabled('basic')} className={btnPrimary}>{label('basic', 'Upgrade to Basic — $5/mo')}</button></div>
                                    <div className="bg-white dark:bg-slate-950 transition-colors"><button onClick={handleUpgrade('STARTER')} disabled={isDisabled('starter')} className={btnSecondary}>{label('starter', 'Upgrade to Professional — $10/mo')}</button></div>
                                    <div className="bg-white dark:bg-slate-950 transition-colors"><button onClick={handleUpgrade('PRO')} disabled={isDisabled('pro')} className={btnSecondary}>{label('pro', 'Upgrade to Enterprise — $20/mo')}</button></div>
                                </>
                            )}
                            {tier === 'BASIC' && (
                                <>
                                    <div className="bg-white dark:bg-slate-950 transition-colors"><button onClick={handleBillingPortal} disabled={isDisabled('portal')} className={btnPrimary}><ExternalLink className="w-3.5 h-3.5" /> {label('portal', 'Manage Billing')}</button></div>
                                    <div className="bg-white dark:bg-slate-950 transition-colors"><button onClick={handleUpgrade('STARTER')} disabled={isDisabled('starter')} className={btnSecondary}>{label('starter', 'Upgrade to Professional — $10/mo')}</button></div>
                                    <div className="bg-white dark:bg-slate-950 transition-colors"><button onClick={handleUpgrade('PRO')} disabled={isDisabled('pro')} className={btnSecondary}>{label('pro', 'Upgrade to Enterprise — $20/mo')}</button></div>
                                    {subscriptionStatus !== 'CANCELED' && (
                                        <div className="bg-white dark:bg-slate-950 transition-colors"><button onClick={handleCancel} disabled={isDisabled('cancel')} className={btnDanger}><AlertCircle className="w-3.5 h-3.5" /> {label('cancel', 'Cancel Subscription')}</button></div>
                                    )}
                                </>
                            )}
                            {(tier === 'STARTER' || tier === 'PRO') && (
                                <>
                                    <div className="bg-white dark:bg-slate-950 transition-colors"><button onClick={handleBillingPortal} disabled={isDisabled('portal')} className={btnPrimary}><ExternalLink className="w-3.5 h-3.5" /> {label('portal', 'Manage Billing')}</button></div>
                                    {subscriptionStatus !== 'CANCELED' && (
                                        <div className="bg-white dark:bg-slate-950 transition-colors"><button onClick={handleCancel} disabled={isDisabled('cancel')} className={btnDanger}><AlertCircle className="w-3.5 h-3.5" /> {label('cancel', 'Cancel Subscription')}</button></div>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Full Pricing CTA */}
                        {tier === 'FREE' && (
                            <p className="text-center text-sm uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-display transition-colors">
                                View all plans →{' '}
                                <button
                                    onClick={() => navigate('/app/pricing')}
                                    className="text-slate-900 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
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
