'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUser, useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useUserRole } from '@/src/lib/context/UserContext';
import Alert from '@/src/components/ui/Alert';
// Checkout links resolved from the shared single source (also used by the
// marketing /pricing page and the /subscribe continuation route).
import { POLAR_URLS, POLAR_URLS_ANNUAL } from '@/src/lib/billing/checkout';
// "Get Explore" routing — same business-vs-personal decision used on the
// marketing /pricing page (backend is the single source of truth).
import { fetchExploreRoute, exploreDestination } from '@/src/lib/billing/explore';

const cellCls = 'bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/70 dark:border-slate-800 transition-colors duration-500';

const CURRENCIES = {
    USD: { symbol: '$', label: 'USD', locale: 'en-US' },
    INR: { symbol: '₹', label: 'INR', locale: 'en-IN' },
};

const PRICE_MATRIX = {
    STARTER: { USD: 19, INR: 1599 },
    PRO: { USD: 49, INR: 3999 },
    BUSINESS: { USD: 99, INR: 7999 },
};

const AppPricing = () => {
    const { user } = useUser();
    const { getToken } = useAuth();
    const router = useRouter();
    const { userTier } = useUserRole();

    const [isLoading, setIsLoading] = useState(false);
    const [selectedTier, setSelectedTier] = useState<string | null>(null);
    const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
    const [isDetecting, setIsDetecting] = useState(true);
    const [exploreBusy, setExploreBusy] = useState(false);
    const [alert, setAlert] = useState({ open: false, type: 'success' as 'success' | 'error' | 'development', msg: '' });

    const showAlert = (type: 'success' | 'error' | 'development', msg: string) => {
        setAlert({ open: true, type, msg });
    };

    // Annual = 2 months free → per-month equivalent is monthly × 10 / 12.
    const formatPrice = (val: number) =>
        new Intl.NumberFormat(CURRENCIES[currency].locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: 0,
        }).format(billingPeriod === 'annual' ? Math.round((val * 10) / 12) : val);

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
            name: 'Starter', id: 'STARTER',
            price: PRICE_MATRIX.STARTER[currency],
            description: 'A smart AI chatbot on your site, fully on-brand.',
            icon: 'rocket_launch',
            highlight: false,
            features: ['1 AI bot', '5,000 messages / mo', 'Custom branding & prompt'],
        },
        {
            name: 'Growth', id: 'PRO',
            price: PRICE_MATRIX.PRO[currency],
            description: 'Turn visitors into leads — capture, score & act.',
            icon: 'trending_up',
            highlight: true,
            badge: 'Most popular',
            features: ['3 AI bots', '15,000 messages / mo', 'Lead capture + alerts + Action Center'],
        },
        {
            name: 'Scale', id: 'BUSINESS',
            price: PRICE_MATRIX.BUSINESS[currency],
            description: 'See what drives revenue, then scale it.',
            icon: 'insights',
            highlight: false,
            badge: 'Full platform',
            features: ['5 AI bots', '50,000 messages / mo', 'ROI, funnel, attribution + white-label'],
        },
    ];

    const handleSelectPlan = (tier: string) => {
        if (!user) { window.location.href = '/sign-in'; return; }
        if (tier === userTier) return;

        // Prefer the annual checkout link when annual is selected; fall back to
        // monthly if the annual product isn't configured yet.
        const checkoutUrl = billingPeriod === 'annual'
            ? (POLAR_URLS_ANNUAL[tier] || POLAR_URLS[tier])
            : POLAR_URLS[tier];
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

    // "Get Explore" — the lifetime-free plan. Signed-in dashboard users hit the
    // backend to decide the path (business → Polar $0 checkout, personal →
    // enquiry, already-active → dashboard, blocked → message).
    const handleGetExplore = async () => {
        if (!user) { window.location.href = '/sign-in'; return; }
        setExploreBusy(true);
        try {
            const token = await getToken();
            if (!token) throw new Error('no token');
            const route = await fetchExploreRoute(token);
            const dest = exploreDestination(route, { userId: user?.id ?? null, origin: window.location.origin });
            if (dest.kind === 'external') window.location.href = dest.url;
            else if (dest.kind === 'navigate') router.push(dest.path);
            else showAlert('error', dest.text);
        } catch {
            // Network/auth hiccup — fall back to the enquiry form rather than dead-end.
            router.push('/explore/enquiry');
        } finally {
            setExploreBusy(false);
        }
    };

    const handleContactCustom = () => {
        window.location.href = `mailto:ayushsatvara2002@gmail.com?subject=Custom%20Plan%20Enquiry&body=Hi%20Ayush%2C%0A%0AI'm%20interested%20in%20a%20custom%20plan%20for%20my%20agency%2Fbusiness.%0A%0AOrganisation%3A%0AExpected%20bots%3A%0AExpected%20monthly%20messages%3A%0AKey%20features%20needed%3A%0A`;
    };

    return (
        <>
            <div className="flex flex-col min-h-full bg-slate-50 dark:bg-slate-950 transition-colors duration-500 overflow-x-hidden">

                {/* ── Header ── */}
                <div className="px-6 md:px-8 pt-8 pb-6 shrink-0">
                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                        <div>
                            <p className="text-sm font-google text-slate-500 dark:text-slate-400">
                                Choose the plan that fits your stage. Upgrade or downgrade anytime.
                            </p>

                            {/* Billing period toggle */}
                            <div className="mt-4 inline-flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                                {(['monthly', 'annual'] as const).map(period => (
                                    <button
                                        key={period}
                                        onClick={() => setBillingPeriod(period)}
                                        aria-pressed={billingPeriod === period}
                                        className={`px-4 py-2 text-sm font-medium font-google rounded-lg transition-all capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${billingPeriod === period
                                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-sm'
                                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                            }`}
                                    >
                                        {period}
                                        {period === 'annual' && (
                                            <span className="ml-1.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">2 MO FREE</span>
                                        )}
                                    </button>
                                ))}
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
                                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
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
                    {/* Explore — lifetime-free plan, now live (in-app teaser above the tiers) */}
                    <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center gap-4">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
                                <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">explore</span>
                            </div>
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2">
                                    <span className="text-base font-google font-semibold text-slate-900 dark:text-slate-200">Explore</span>
                                    <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5">
                                        <span className="relative flex h-1.5 w-1.5">
                                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                                        </span>
                                        <span className="text-[10px] font-google font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Free Forever</span>
                                    </span>
                                </div>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-400">Lifetime-free — the full Vaayu Intelligence platform. No card required.</p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={handleGetExplore}
                            disabled={exploreBusy}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-slate-900 dark:bg-white px-5 py-2.5 text-sm font-google font-semibold text-white dark:text-black transition-all hover:bg-slate-700 dark:hover:bg-slate-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            <span className={`material-symbols-outlined text-[16px] ${exploreBusy ? 'animate-spin' : ''}`}>
                                {exploreBusy ? 'progress_activity' : 'explore'}
                            </span>
                            {exploreBusy ? 'One moment…' : 'Get Explore — Free'}
                        </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
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
                                        <span className="absolute top-4 right-4 text-xs font-medium font-google bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full">
                                            {(plan as any).badge}
                                        </span>
                                    )}

                                    {/* Icon */}
                                    <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-5 shrink-0">
                                        <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">{plan.icon}</span>
                                    </div>

                                    {/* Name */}
                                    <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200 mb-1">{plan.name}</h3>
                                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-5 leading-relaxed">{plan.description}</p>

                                    {/* Price */}
                                    <div className="mb-5">
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-2xl font-google font-bold text-slate-900 dark:text-slate-200">
                                                {formatPrice(plan.price)}
                                            </span>
                                            <span className="text-xs font-google text-slate-400 dark:text-slate-500">/mo</span>
                                        </div>
                                        {billingPeriod === 'annual' && (
                                            <span className="text-xs font-google text-emerald-600 dark:text-emerald-400 mt-1 block">
                                                billed annually · 2 months free
                                            </span>
                                        )}
                                    </div>

                                    {/* Key features */}
                                    <div className="space-y-2.5 flex-1 mb-6">
                                        {plan.features.map(f => (
                                            <div key={f} className="flex items-center gap-2.5">
                                                <div className="w-4 h-4 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
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
                                        className={`w-full py-3 min-h-[44px] text-sm font-semibold font-google rounded-xl transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${isCurrent
                                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                                                : plan.highlight
                                                    ? 'bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-700 dark:hover:bg-slate-200'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600'
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
                        <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-[18px] text-slate-600 dark:text-slate-400">build</span>
                        </div>

                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-base font-semibold font-google text-slate-900 dark:text-slate-200">Custom plan</h3>
                                <span className="text-xs font-medium font-google bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2.5 py-0.5 rounded-full">For agencies</span>
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
