'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useUserRole } from '@/src/lib/context/UserContext';
import Alert from '@/src/app/components/Alert';

const POLAR_URLS: Record<string, string | undefined> = {
    BASIC: process.env.NEXT_PUBLIC_POLAR_BASIC_URL,
    STARTER: process.env.NEXT_PUBLIC_POLAR_STARTER_URL,
    PRO: process.env.NEXT_PUBLIC_POLAR_PRO_URL,
    BUSINESS: process.env.NEXT_PUBLIC_POLAR_BUSINESS_URL,
};

const cellCls = 'bg-white dark:bg-white/[0.02] rounded-2xl transition-colors duration-500';

const BASIC_COUPON = 'SAPYAI2026';

const CURRENCIES = {
    USD: { symbol: '$', label: 'USD', locale: 'en-US' },
    INR: { symbol: '₹', label: 'INR', locale: 'en-IN' },
};

const PRICE_MATRIX = {
    BASIC: { USD: 9, INR: 749 },
    STARTER: { USD: 19, INR: 1599 },
    PRO: { USD: 49, INR: 3999 },
    BUSINESS: { USD: 99, INR: 7999 },
};

const AppPricing = () => {
    const { user } = useUser();
    const router = useRouter();
    const { userTier } = useUserRole();

    const [isLoading, setIsLoading] = useState(false);
    const [selectedTier, setSelectedTier] = useState<string | null>(null);
    const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
    const [isDetecting, setIsDetecting] = useState(true);
    const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'development', msg: '' });

    const showAlert = (type: 'success' | 'error' | 'development', msg: string) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 8000);
    };

    const formatPrice = (val: number) =>
        new Intl.NumberFormat(CURRENCIES[currency].locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: val % 1 === 0 ? 0 : 1,
        }).format(val);

    useEffect(() => {
        const CACHE_KEY = 'sb_currency';
        const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

        const detectCurrency = async () => {
            try {
                if (typeof window !== 'undefined') {
                    const cached = window.sessionStorage.getItem(CACHE_KEY);
                    if (cached) {
                        const { value, ts } = JSON.parse(cached) as { value: string; ts: number };
                        if (value && Date.now() - ts < CACHE_TTL_MS) {
                            setCurrency(value === 'INR' ? 'INR' : 'USD');
                            setIsDetecting(false);
                            return;
                        }
                    }
                }
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (tz.includes('India') || tz.includes('Calcutta')) {
                    setCurrency('INR');
                    if (typeof window !== 'undefined') {
                        window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ value: 'INR', ts: Date.now() }));
                    }
                    setIsDetecting(false);
                    return;
                }
                const res = await fetch('https://ipapi.co/json/');
                const data = await res.json();
                const resolved = data.currency === 'INR' ? 'INR' : 'USD';
                setCurrency(resolved);
                if (typeof window !== 'undefined') {
                    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ value: resolved, ts: Date.now() }));
                }
            } catch {
                setCurrency('USD');
            } finally {
                setIsDetecting(false);
            }
        };
        detectCurrency();
    }, []);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('payment') === 'success' && userTier && userTier !== 'FREE') {
            router.push('/dashboard/register');
        }
    }, [userTier, router]);

    const plans = [
        {
            name: 'Basic', id: 'BASIC',
            price: PRICE_MATRIX.BASIC[currency],
            description: 'For solo founders and small projects.',
            icon: 'bolt',
            highlight: false,
            features: ['1 AI bot', '500 messages / mo', 'Basic analytics'],
        },
        {
            name: 'Starter', id: 'STARTER',
            price: PRICE_MATRIX.STARTER[currency],
            description: 'For growing businesses with real traction.',
            icon: 'rocket_launch',
            highlight: true,
            badge: 'Most popular',
            features: ['2 AI bots', '2,000 messages / bot / mo', 'Lead capture'],
        },
        {
            name: 'Pro', id: 'PRO',
            price: PRICE_MATRIX.PRO[currency],
            description: 'Scale your support and lead ops.',
            icon: 'corporate_fare',
            highlight: false,
            features: ['5 AI bots', '5,000 messages / bot / mo', 'Full white-label'],
        },
        {
            name: 'Business', id: 'BUSINESS',
            price: PRICE_MATRIX.BUSINESS[currency],
            description: 'Full platform for high-growth teams.',
            icon: 'domain',
            highlight: false,
            badge: 'Full platform',
            features: ['15 AI bots', '15,000 messages / bot / mo', 'Human handoff'],
        },
    ];

    const handleSelectPlan = (tier: string) => {
        if (!user) { window.location.href = '/sign-in'; return; }
        if (tier === userTier) return;

        const checkoutUrl = POLAR_URLS[tier];
        if (!checkoutUrl) {
            showAlert('error', 'Billing system is currently unavailable. Please try again later.');
            return;
        }

        setIsLoading(true);
        setSelectedTier(tier);
        showAlert('development', `Redirecting to checkout for ${tier} plan...`);

        const returnUrl = `${window.location.origin}/dashboard/register?payment=success`;
        setTimeout(() => {
            const base = `${checkoutUrl}?success_url=${encodeURIComponent(returnUrl)}`;
            window.location.href = user?.id ? `${base}&customer_external_id=${user.id}` : base;
        }, 800);
    };

    const handleContactCustom = () => {
        window.location.href = `mailto:ayushsatvara2002@gmail.com?subject=Custom%20Plan%20Enquiry&body=Hi%20Ayush%2C%0A%0AI'm%20interested%20in%20a%20custom%20plan%20for%20my%20agency%2Fbusiness.%0A%0AOrganisation%3A%0AExpected%20bots%3A%0AExpected%20monthly%20messages%3A%0AKey%20features%20needed%3A%0A`;
    };

    return (
        <>
            <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-900 transition-colors duration-500 overflow-x-hidden">

                {/* ── Header ── */}
                <div className="px-6 md:px-8 pt-8 pb-6 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-semibold font-google text-slate-900 dark:text-slate-200 transition-colors">
                                Plans &amp; pricing
                            </h1>
                            <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-1">
                                Choose the plan that fits your stage. Upgrade or downgrade anytime.
                            </p>

                            {/* Coupon badge */}
                            <div className="mt-4 inline-flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 rounded-xl">
                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[14px]">local_offer</span>
                                <p className="text-xs font-medium font-google text-emerald-700 dark:text-emerald-300">
                                    Basic plan is free — use coupon{' '}
                                    <span className="font-mono bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 rounded-md">{BASIC_COUPON}</span>
                                    {' '}at checkout
                                </p>
                            </div>
                        </div>

                        {/* Currency toggle */}
                        <div className="shrink-0">
                            {isDetecting ? (
                                <div className="flex items-center gap-1.5 text-xs font-google text-slate-400 animate-pulse">
                                    <span className="material-symbols-outlined text-[14px]">public</span>
                                    Detecting…
                                </div>
                            ) : (
                                <div className="flex items-center bg-slate-100 dark:bg-white/[0.04] rounded-xl p-1">
                                    {(Object.keys(CURRENCIES) as Array<keyof typeof CURRENCIES>).map(curr => (
                                        <button
                                            key={curr}
                                            onClick={() => setCurrency(curr)}
                                            className={`px-4 py-2 text-sm font-medium font-google rounded-lg transition-all ${currency === curr
                                                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm'
                                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                        >
                                            {curr}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Plan Cards ── */}
                <div className="px-6 md:px-8 pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                        {plans.map((plan, i) => {
                            const isCurrent = plan.id === userTier;
                            return (
                                <motion.div
                                    key={plan.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.06 }}
                                    className={`${cellCls} flex flex-col p-6 relative`}
                                >
                                    {/* Badge */}
                                    {(plan as any).badge && (
                                        <span className="absolute top-4 right-4 text-xs font-medium font-google bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full">
                                            {(plan as any).badge}
                                        </span>
                                    )}

                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-5 shrink-0">
                                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">{plan.icon}</span>
                                    </div>

                                    {/* Name */}
                                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200 mb-1">{plan.name}</h3>
                                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">{plan.description}</p>

                                    {/* Price */}
                                    <div className="mb-5">
                                        {plan.id === 'BASIC' ? (
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-baseline gap-2">
                                                    <span className="text-2xl font-google font-bold text-slate-400 dark:text-slate-500 line-through">
                                                        {formatPrice(plan.price)}
                                                    </span>
                                                    <span className="text-2xl font-google font-bold text-emerald-600 dark:text-emerald-400">Free</span>
                                                </div>
                                                <span className="text-xs font-google text-slate-400">with coupon at checkout</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-2xl font-google font-bold text-slate-900 dark:text-slate-200">
                                                    {formatPrice(plan.price)}
                                                </span>
                                                <span className="text-xs font-google text-slate-400 dark:text-slate-500">/mo</span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Key features */}
                                    <div className="space-y-2.5 flex-1 mb-6">
                                        {plan.features.map(f => (
                                            <div key={f} className="flex items-center gap-2.5">
                                                <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                                                    <span className="material-symbols-outlined text-[10px] text-slate-500 dark:text-slate-400">check</span>
                                                </div>
                                                <span className="text-sm font-google text-slate-600 dark:text-slate-400">{f}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* CTA */}
                                    <button
                                        onClick={() => handleSelectPlan(plan.id)}
                                        disabled={isLoading || isCurrent}
                                        className={`w-full py-3 min-h-[44px] text-sm font-semibold font-google rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${
                                            isCurrent
                                                ? 'bg-slate-100 dark:bg-white/[0.04] text-slate-400 dark:text-slate-500'
                                                : plan.highlight
                                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-700 dark:hover:bg-slate-200'
                                                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/[0.10]'
                                        }`}
                                    >
                                        {isCurrent ? (
                                            'Current plan'
                                        ) : isLoading && selectedTier === plan.id ? (
                                            <><div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" /> Redirecting…</>
                                        ) : (
                                            `Get ${plan.name}`
                                        )}
                                    </button>
                                </motion.div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Custom / Agency Plan ── */}
                <div className="px-6 md:px-8 pb-8">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: plans.length * 0.06 }}
                        className={`${cellCls} p-6 md:p-8 flex flex-col sm:flex-row items-start sm:items-center gap-6`}
                    >
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">build</span>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Custom plan</h3>
                                <span className="text-xs font-medium font-google bg-slate-100 dark:bg-white/[0.06] text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-full">For agencies</span>
                            </div>
                            <p className="text-sm font-google text-slate-500 dark:text-slate-400">
                                Need unlimited bots, custom quotas, full white-label, or admin-managed config? We'll build a plan around your needs.
                            </p>
                        </div>

                        <button
                            onClick={handleContactCustom}
                            className="shrink-0 px-6 py-3 text-sm font-semibold font-google rounded-xl bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors active:scale-[0.98] flex items-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[14px]">mail</span>
                            Contact us
                        </button>
                    </motion.div>
                </div>

            </div>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </>
    );
};

export default AppPricing;
