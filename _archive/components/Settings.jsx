import React, { useState, useEffect } from 'react';
import { ShieldCheck, CreditCard, XCircle, Settings as SettingsIcon } from 'lucide-react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import Alert from './alert';

const Settings = () => {
    const { isLoaded: isUserLoaded } = useUser();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const navigate = useNavigate();

    const [isLoading, setIsLoading] = useState(true);
    const [userRole, setUserRole] = useState(null);
    const [userTier, setUserTier] = useState(null);
    const [subscriptionStatus, setSubscriptionStatus] = useState('active');
    const [alertConfig, setAlertConfig] = useState({ open: false, type: 'success', msg: '' });
    const [isActionLoading, setIsActionLoading] = useState(false);

    useEffect(() => {
        const fetchUserData = async () => {
            if (!isAuthLoaded) return;
            try {
                const token = await getToken();
                const baseUrl = import.meta.env.VITE_API_URL || '';
                const response = await fetch(`${baseUrl}/api/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (response.ok) {
                    const data = await response.json();
                    setUserRole(data.role);
                    setUserTier(data.tier);
                    setSubscriptionStatus(data.subscription_status || 'active');
                }
                setIsLoading(false);
            } catch (err) {
                console.error("Settings: Failed to fetch user data:", err);
                setIsLoading(false);
            }
        };

        fetchUserData();
    }, [isAuthLoaded, getToken]);

    const showAlert = (type, msg) => {
        setAlertConfig({ open: true, type, msg });
        setTimeout(() => setAlertConfig(prev => ({ ...prev, open: false })), 5000);
    };

    const handleBillingPortal = async () => {
        setIsActionLoading(true);
        try {
            const token = await getToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/billing/portal`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.url) {
                window.open(data.url, '_blank');
            } else {
                showAlert('error', data.detail || "Could not generate billing portal link.");
            }
        } catch (err) {
            console.error("Billing portal error:", err);
            showAlert('error', "Failed to connect to billing portal.");
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleCancelSubscription = async () => {
        if (!window.confirm("Are you sure you want to cancel? You will keep access until the end of the billing period.")) return;
        setIsActionLoading(true);
        try {
            const token = await getToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/user/subscription/cancel`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                showAlert('success', 'Cancellation requested. Your account will remain active until the period ends.');
                setSubscriptionStatus('cancelling');
            } else {
                showAlert('error', data.detail || 'Failed to cancel subscription.');
            }
        } catch (err) {
            showAlert('error', 'Network error during cancellation.');
        } finally {
            setIsActionLoading(false);
        }
    };

    if (isLoading || !isUserLoaded) return null;

    return (
        <div className="w-full mt-12 py-8 border-t border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex items-center gap-3 mb-8">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg text-indigo-600 dark:text-indigo-400">
                    <SettingsIcon size={20} />
                </div>
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 uppercase tracking-tight">Account Control Center</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-500 font-medium">Manage your subscription, billing, and administrative access.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Admin Panel Button */}
                {userRole === 'SUPER_ADMIN' && (
                    <button
                        onClick={() => navigate('/admin')}
                        className="flex flex-col items-center justify-center gap-3 p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all group min-h-[140px]"
                    >
                        <ShieldCheck className="text-orange-500 transition-transform group-hover:scale-110" size={28} />
                        <div className="text-center">
                            <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">Super Admin</span>
                            <span className="block text-[10px] text-slate-400 uppercase font-mono mt-1">Platform Control</span>
                        </div>
                    </button>
                )}

                {/* Billing Portal Button */}
                <button
                    disabled={isActionLoading}
                    onClick={handleBillingPortal}
                    className="flex flex-col items-center justify-center gap-3 p-6 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 group min-h-[140px] relative transition-all active:scale-[0.98]"
                >
                    <CreditCard className={`text-indigo-600 transition-transform group-hover:scale-110 ${isActionLoading ? 'opacity-50' : ''}`} size={28} />
                    <div className="text-center">
                        <span className="block text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest">
                            {isActionLoading ? 'Connecting...' : 'Billing Portal'}
                        </span>
                        <span className="block text-[10px] text-slate-400 uppercase font-mono mt-1">Invoices & Payment</span>
                    </div>
                </button>

                {/* Subscription Management Button */}
                {userTier && userTier !== 'FREE' && (
                    <button
                        disabled={isActionLoading || subscriptionStatus === 'cancelling'}
                        onClick={handleCancelSubscription}
                        className={`flex flex-col items-center justify-center gap-3 p-6 border rounded-2xl transition-all group min-h-[140px] relative active:scale-[0.98] ${subscriptionStatus === 'cancelling'
                                ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/40 text-amber-600 cursor-not-allowed'
                                : 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:border-red-500/50 hover:bg-red-50 dark:hover:bg-red-900/10'
                            }`}
                    >
                        <XCircle className={`transition-transform group-hover:scale-110 ${subscriptionStatus === 'cancelling' ? 'text-amber-500' : 'text-red-500'} ${isActionLoading ? 'opacity-50' : ''}`} size={28} />
                        <div className="text-center">
                            <span className={`block text-sm font-bold uppercase tracking-widest ${subscriptionStatus === 'cancelling' ? 'text-amber-600' : 'text-slate-900 dark:text-slate-100'}`}>
                                {isActionLoading ? 'Processing...' : (subscriptionStatus === 'cancelling' ? 'Stop Pending' : 'Cancel Plan')}
                            </span>
                            <span className="block text-[10px] text-slate-400 uppercase font-mono mt-1">
                                {subscriptionStatus === 'cancelling' ? 'Expires at period end' : 'Terminate Subscription'}
                            </span>
                        </div>
                    </button>
                )}
            </div>

            <Alert
                isOpen={alertConfig.open}
                type={alertConfig.type}
                message={alertConfig.msg}
                onClose={() => setAlertConfig(prev => ({ ...prev, open: false }))}
            />
        </div>
    );
};

export default Settings;
