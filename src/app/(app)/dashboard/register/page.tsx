'use client';

import React, { useState, useEffect } from 'react';
import { SignUp, useUser, useAuth } from '@clerk/nextjs';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Alert from '@/src/app/components/Alert';
import { useUserRole } from '@/src/lib/context/UserContext';
import UpgradePrompt from '@/src/app/components/UpgradePrompt';
import BotIntegrationDocs from '@/src/app/components/BotIntegrationDocs';
import { useAuthenticatedFetch, UpgradeError } from '@/src/lib/hooks/useAuthenticatedFetch';

const inputCls = "w-full text-sm font-google px-4 py-3 bg-slate-100 dark:bg-white/[0.04] focus:bg-slate-200 dark:focus:bg-white/[0.08] focus:outline-none text-slate-900 dark:text-slate-200 transition-colors rounded-xl";
const labelCls = "block text-sm font-medium font-google text-slate-600 dark:text-slate-400 mb-2 transition-colors";
const cardCls = "bg-white dark:bg-white/[0.02] rounded-2xl transition-colors duration-500";

const AppRegistration = () => {
    const { user, isLoaded, isSignedIn } = useUser();
    const { getToken } = useAuth();
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const { userTier, refreshUser } = useUserRole();
    const authFetch = useAuthenticatedFetch();

    const [formData, setFormData] = useState({
        companyName: '', allowedOrigin: '',
        themeColor: '#5730F5', companyTone: 'Professional and helpful'
    });
    const [registrationData, setRegistrationData] = useState<any>(null);
    const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'development', msg: '' });
    const [copied, setCopied] = useState<string | null>(null);
    const [upgradeError, setUpgradeError] = useState<any>(null);
    const [isSyncing, setIsSyncing] = useState(false);

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

    const isLocked = !userTier || userTier === 'FREE' || String(userTier) === 'null';

    const showAlert = (type: 'success' | 'error' | 'development', msg: string) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 8000);
    };

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopied(key);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setFormData({ ...formData, [e.target.name]: e.target.value });

    const registerMutation = useMutation({
        mutationFn: (payload) =>
            authFetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            }),
        onSuccess: (data: any) => {
            queryClient.invalidateQueries({ queryKey: ['bots'] });
            setRegistrationData({
                apiKey: data.api_key,
                companyName: formData.companyName,
                allowedOrigin: data.allowed_origin,
            });
            showAlert('success', data.message || 'Registration successful!');
        },
        onError: (err: any) => {
            if (err instanceof UpgradeError) {
                setUpgradeError(err);
            } else {
                showAlert('error', err.message);
            }
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.companyName.trim() || !formData.allowedOrigin.trim()) {
            showAlert('error', 'Company name and allowed origin are required.');
            return;
        }
        (registerMutation.mutate as any)({
            company_name: formData.companyName,
            allowed_origin: formData.allowedOrigin,
            theme_color: formData.themeColor,
            company_tone: formData.companyTone,
        });
    };

    const isLoading = registerMutation.isPending;

    const handleReset = () => {
        setRegistrationData(null);
        setFormData({ companyName: '', allowedOrigin: '', themeColor: '#5730F5', companyTone: 'Professional and helpful' });
    };

    const frontendUrl = typeof window !== 'undefined' ? window.location.origin : '';

    if (!isLoaded) return (
        <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-500">
            <div className="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-slate-700 dark:border-t-slate-300 rounded-full animate-spin" />
        </div>
    );

    if (!isSignedIn) {
        return (
            <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-500 items-center justify-center p-8">
                <div className={`${cardCls} p-8 w-full max-w-md text-center`}>
                    <span className="material-symbols-outlined text-[40px] text-slate-300 dark:text-slate-600 mb-4 block">account_circle</span>
                    <h2 className="text-xl font-semibold font-google text-slate-900 dark:text-slate-200 mb-2">Sign in required</h2>
                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed mb-6">Please sign in to create and manage your AI chatbots.</p>
                    <div className="flex justify-center">
                        <SignUp routing="hash" signInUrl="/sign-in" />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-500">

            {/* Header */}
            <div className="px-6 md:px-8 pt-8 pb-6 shrink-0">
                <div className="flex items-center gap-2.5 mb-1.5">
                    <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">domain</span>
                    <h1 className="text-2xl md:text-3xl font-semibold font-google text-slate-900 dark:text-slate-200 transition-colors">Create Bot</h1>
                </div>
                <p className="text-sm font-google text-slate-500 dark:text-slate-400">
                    Configure your AI bot identity and receive integration credentials.
                </p>
            </div>

            <AnimatePresence mode="wait" initial={false}>

                {/* ── Form view ── */}
                {!registrationData ? (
                    <motion.div key="form"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 px-6 md:px-8 pb-8"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

                            {/* Left: info panel */}
                            <div className={`${cardCls} p-6 md:p-8 flex flex-col`}>
                                <h2 className="text-lg font-semibold font-google text-slate-900 dark:text-slate-200 mb-2 transition-colors">
                                    Identity &amp; deployment
                                </h2>
                                <p className="text-sm font-google text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
                                    Provision your bot, get your API key, and go live in minutes.
                                </p>

                                <div className="space-y-3">
                                    {[
                                        { icon: 'bolt', label: 'Instant creation', sub: 'Active immediately after provisioning' },
                                        { icon: 'verified_user', label: 'Domain-locked security', sub: 'API key is bound to your allowed origin' },
                                        { icon: 'code', label: 'Zero-config embed', sub: 'One script tag is all you need' },
                                    ].map((f, i) => (
                                        <motion.div key={i}
                                            initial={{ opacity: 0, x: -8 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.05 + i * 0.07 }}
                                            className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] transition-colors"
                                        >
                                            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                                                <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">{f.icon}</span>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium font-google text-slate-800 dark:text-slate-200 transition-colors">{f.label}</p>
                                                <p className="text-xs font-google text-slate-400 dark:text-slate-500 mt-0.5">{f.sub}</p>
                                            </div>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>

                            {/* Right: form */}
                            <div className={`${cardCls} p-6 md:p-8 relative`}>
                                {isLocked && (
                                    <div className="absolute inset-0 z-50 bg-white/80 dark:bg-white/[0.02]/80 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center rounded-2xl transition-colors">
                                        <span className="material-symbols-outlined text-[32px] text-slate-400 dark:text-slate-500 mb-4">lock</span>
                                        <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200 mb-2">Upgrade required</h3>
                                        <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed max-w-[260px] mb-6">
                                            Provisioning a new bot requires an active subscription.
                                        </p>
                                        <Link href="/dashboard/pricing"
                                            className="px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors active:scale-[0.98]">
                                            View plans
                                        </Link>
                                    </div>
                                )}

                                <div className={isLocked ? 'opacity-30 pointer-events-none' : ''}>
                                    <h3 className="text-lg font-semibold font-google text-slate-900 dark:text-slate-200 mb-2 transition-colors">Bot configuration</h3>
                                    <p className="text-sm font-google text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">Fill in the details to generate your unique credentials.</p>

                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        <div>
                                            <label className={labelCls}>Company name</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">corporate_fare</span>
                                                <input type="text" name="companyName" required value={formData.companyName}
                                                    onChange={handleChange}
                                                    className={inputCls + ' pl-10'}
                                                    placeholder="Acme Inc." />
                                            </div>
                                        </div>

                                        <div>
                                            <label className={labelCls}>Allowed origin</label>
                                            <div className="relative">
                                                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">public</span>
                                                <input type="url" name="allowedOrigin" required value={formData.allowedOrigin}
                                                    onChange={handleChange}
                                                    className={inputCls + ' pl-10'}
                                                    placeholder="https://example.com" />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className={labelCls}>Theme color</label>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">palette</span>
                                                    <input type="text" name="themeColor" value={formData.themeColor}
                                                        onChange={handleChange}
                                                        className={inputCls + ' pl-10 pr-12 font-mono uppercase'} />
                                                    <div className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg overflow-hidden border border-slate-200 dark:border-white/[0.08]">
                                                        <input type="color" name="themeColor" value={formData.themeColor}
                                                            onChange={handleChange}
                                                            className="absolute inset-[-6px] w-[calc(100%+12px)] h-[calc(100%+12px)] cursor-pointer" />
                                                    </div>
                                                </div>
                                            </div>
                                            <div>
                                                <label className={labelCls}>Tone</label>
                                                <div className="relative">
                                                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[16px] text-slate-400 dark:text-slate-500 pointer-events-none">forum</span>
                                                    <select name="companyTone" value={formData.companyTone} onChange={handleChange}
                                                        className={inputCls + ' pl-10 appearance-none'}>
                                                        <option value="Professional and helpful">Professional</option>
                                                        <option value="Friendly and casual">Friendly</option>
                                                        <option value="Technical and concise">Technical</option>
                                                    </select>
                                                    <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-slate-400 dark:text-slate-500 pointer-events-none">expand_more</span>
                                                </div>
                                            </div>
                                        </div>

                                        <button type="submit" disabled={isLoading}
                                            className="w-full py-3.5 min-h-[48px] bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50">
                                            {isLoading
                                                ? <><div className="w-3.5 h-3.5 border-2 border-white/30 dark:border-black/30 border-t-white dark:border-t-black rounded-full animate-spin" /> Provisioning…</>
                                                : <>Create bot <span className="material-symbols-outlined text-[16px]">arrow_forward</span></>
                                            }
                                        </button>
                                    </form>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                ) : (

                    /* ── Success view ── */
                    <motion.div key="success"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="flex-1 px-6 md:px-8 pb-8 space-y-5"
                    >
                        {/* Success header card */}
                        <div className={`${cardCls} p-6 md:p-8 flex flex-col sm:flex-row sm:items-center gap-4 md:gap-6`}>
                            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                                <span className="material-symbols-outlined text-[24px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-xl md:text-2xl font-semibold font-google text-slate-900 dark:text-slate-200 transition-colors">
                                    {registrationData.companyName}
                                </h2>
                                <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-0.5">Provision successful — credentials are active.</p>
                            </div>
                            <div className="flex flex-wrap gap-3 shrink-0">
                                <button onClick={() => router.push('/dashboard/train')}
                                    className="px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-black text-sm font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors flex items-center gap-2 active:scale-[0.98]">
                                    Train AI <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                                </button>
                                <button onClick={handleReset}
                                    className="px-5 py-2.5 bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 text-sm font-semibold font-google rounded-xl hover:bg-slate-200 dark:hover:bg-white/[0.08] transition-colors active:scale-[0.98]">
                                    New bot
                                </button>
                            </div>
                        </div>

                        {/* Credentials grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

                            {/* API key */}
                            <div className={`${cardCls} p-6`}>
                                <div className="flex items-center gap-2 mb-4">
                                    <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">vpn_key</span>
                                    <p className="text-sm font-medium font-google text-slate-600 dark:text-slate-400">Secure API key</p>
                                </div>
                                <div className="flex items-center gap-3 p-3.5 bg-slate-50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/[0.04]">
                                    <span className="flex-1 truncate text-sm font-mono text-slate-900 dark:text-slate-200">{registrationData.apiKey}</span>
                                    <button onClick={() => handleCopy(registrationData.apiKey, 'key')}
                                        className="p-2 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200 dark:hover:bg-white/[0.10] transition-colors shrink-0">
                                        <span className="material-symbols-outlined text-[16px]">
                                            {copied === 'key' ? 'check' : 'content_copy'}
                                        </span>
                                    </button>
                                </div>
                            </div>

                            {/* Embed snippet */}
                            <div className={`${cardCls} p-6`}>
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500">code</span>
                                        <p className="text-sm font-medium font-google text-slate-600 dark:text-slate-400">Quick embed</p>
                                    </div>
                                    <button onClick={() => handleCopy(`<script src="${frontendUrl}/widget.js" data-api-key="${registrationData.apiKey}" defer></script>`, 'snippet')}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06] transition-colors">
                                        <span className="material-symbols-outlined text-[15px]">
                                            {copied === 'snippet' ? 'check' : 'content_copy'}
                                        </span>
                                    </button>
                                </div>
                                <pre className="p-3.5 bg-slate-900 dark:bg-slate-950 rounded-xl text-blue-300 text-xs font-mono overflow-x-auto leading-relaxed">
                                    <code>{`<script src="${frontendUrl}/widget.js"\n  data-api-key="${registrationData.apiKey}"\n  defer></script>`}</code>
                                </pre>
                            </div>
                        </div>

                        {/* Integration docs */}
                        <div className={cardCls}>
                            <BotIntegrationDocs
                                apiKey={registrationData.apiKey}
                                apiUrl=""
                            />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />

            {upgradeError && (
                <UpgradePrompt
                    mode="modal"
                    code={upgradeError.code}
                    tier={upgradeError.tier}
                    current={upgradeError.current}
                    limit={upgradeError.limit}
                    onDismiss={() => setUpgradeError(null)}
                />
            )}
        </div>
    );
};

export default AppRegistration;
