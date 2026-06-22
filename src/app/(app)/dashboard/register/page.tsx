'use client';

import React, { useEffect, useState } from 'react';
import { SignUp, useUser, useAuth } from '@clerk/nextjs';
import { useSearchParams } from 'next/navigation';
import Alert from '@/src/app/components/Alert';
import CreateBotFlow from '@/src/app/components/CreateBotFlow';
import { useUserRole } from '@/src/lib/context/UserContext';
import { Card } from '@/src/app/components/insights/ui';

const AppRegistration = () => {
    const { isLoaded, isSignedIn } = useUser();
    const { getToken } = useAuth();
    const searchParams = useSearchParams();
    const { refreshUser } = useUserRole();

    const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'development', msg: '' });
    const [isSyncing, setIsSyncing] = useState(false);

    const showAlert = (type: 'success' | 'error' | 'development', msg: string) => setAlert({ open: true, type, msg });

    // Post-payment: verify the subscription with Polar exactly once.
    useEffect(() => {
        if (
            searchParams.get('payment') === 'success' &&
            !isSyncing &&
            typeof window !== 'undefined' &&
            !sessionStorage.getItem('sb_sync_attempted')
        ) {
            sessionStorage.setItem('sb_sync_attempted', 'true');
            handleAutoSync();
        }
    }, [searchParams]);

    const handleAutoSync = async () => {
        setIsSyncing(true);
        showAlert('development', 'Payment received! Verifying your subscription with Polar...');
        try {
            const token = await getToken();
            const res = await fetch('/api/user/sync-subscription', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
                showAlert('success', 'Subscription verified! Your dashboard is now unlocked.');
                await refreshUser?.();
                sessionStorage.removeItem('sb_sync_attempted');
                const url = new URL(window.location.href);
                url.searchParams.delete('payment');
                window.history.replaceState({}, '', url.pathname + url.search);
            } else {
                showAlert('error', data.detail || 'Synchronization failed. Your plan might take a few minutes to update.');
            }
        } catch {
            showAlert('error', 'Network error during synchronization. Please refresh the page.');
        } finally {
            setIsSyncing(false);
        }
    };

    if (!isLoaded) return (
        <div className="flex-1 flex items-center justify-center bg-[#f8f9fa] dark:bg-slate-950 transition-colors duration-300">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-slate-700 dark:border-t-slate-300 rounded-full animate-spin" />
        </div>
    );

    if (!isSignedIn) {
        return (
            <div className="flex flex-col min-h-full items-center justify-center bg-[#f8f9fa] dark:bg-slate-950 p-8 transition-colors duration-300">
                <Card className="p-8 w-full max-w-md text-center">
                    <span className="material-symbols-outlined text-[40px] text-slate-300 dark:text-slate-600 mb-4 block">account_circle</span>
                    <h2 className="text-[18px] font-bold text-slate-900 dark:text-slate-100 mb-1.5">Sign in required</h2>
                    <p className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed mb-6">Please sign in to create and manage your AI chatbots.</p>
                    <div className="flex justify-center">
                        <SignUp routing="hash" signInUrl="/sign-in" />
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full w-full min-w-0 bg-[#f8f9fa] dark:bg-slate-950 overflow-hidden transition-colors duration-300">
            <div className="relative shrink-0 z-20 bg-[#f8f9fa]/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/70 dark:border-slate-800/70">
                <div className="px-4 md:px-6 lg:px-8 py-3">
                    <p className="text-[13px] sm:text-[13.5px] text-slate-500 dark:text-slate-400 leading-snug">
                        Configure your AI bot identity and receive integration credentials.
                    </p>
                </div>
            </div>

            <div className="flex-1 w-full min-w-0 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8">
                <div className="mx-auto w-full max-w-3xl">
                    <CreateBotFlow variant="page" />
                </div>
            </div>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
};

export default AppRegistration;
