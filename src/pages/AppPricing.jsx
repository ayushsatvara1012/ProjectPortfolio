import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '../context/UserContext';
import Alert from '../components/alert';

const POLAR_URLS = {
    BASIC:    import.meta.env.VITE_POLAR_BASIC_URL,
    STARTER:  import.meta.env.VITE_POLAR_STARTER_URL,
    PRO:      import.meta.env.VITE_POLAR_PRO_URL,
    BUSINESS: import.meta.env.VITE_POLAR_BUSINESS_URL,
};

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

const CheckIcon = () => (
    <div className="w-4 h-4 rounded-none bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center shrink-0 transition-colors group-hover:bg-blue-100 dark:group-hover:bg-blue-900/60">
        <span className="material-symbols-outlined text-[10px] text-blue-500 dark:text-blue-400 transition-colors">check</span>
    </div>
);

const AppPricing = () => {
    const { user } = useUser();
    const navigate = useNavigate();
    const { userTier } = useUserRole();

    const [isLoading, setIsLoading] = useState(false);
    const [selectedTier, setSelectedTier] = useState(null);
    const [currency, setCurrency] = useState('USD');
    const [isDetecting, setIsDetecting] = useState(true);
    const [alert, setAlert] = useState({ open: false, type: 'success', msg: '' });

    const showAlert = (type, msg) => {
        setAlert({ open: true, type, msg });
        setTimeout(() => setAlert(p => ({ ...p, open: false })), 8000);
    };

    const CURRENCIES = {
        USD: { symbol: '$', label: 'USD', locale: 'en-US' },
        INR: { symbol: '₹', label: 'INR', locale: 'en-IN' },
    };

    const PRICE_MATRIX = {
        BASIC:    { USD: 9,  INR: 749  },
        STARTER:  { USD: 19, INR: 1599 },
        PRO:      { USD: 49, INR: 3999 },
        BUSINESS: { USD: 99, INR: 7999 },
    };

    const formatPrice = (val) =>
        new Intl.NumberFormat(CURRENCIES[currency].locale, {
            style: 'currency',
            currency,
            minimumFractionDigits: val % 1 === 0 ? 0 : 1,
        }).format(val);

    // ── LOCATION DETECTION ───────────────────────────────────────────────────
    useEffect(() => {
        const detectCurrency = async () => {
            try {
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (tz.includes('India') || tz.includes('Calcutta')) {
                    setCurrency('INR');
                    setIsDetecting(false);
                    return;
                }
                const res = await fetch('https://ipapi.co/json/');
                const data = await res.json();
                setCurrency(data.currency === 'INR' ? 'INR' : 'USD');
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
            navigate('/app/register');
        }
    }, [userTier, navigate]);

    // Feature def: locked = minimum tier required to access it (null = always shown)
    const plans = [
        {
            name: 'Basic', id: 'BASIC',
            price: PRICE_MATRIX.BASIC[currency],
            period: '/mo',
            description: 'Essential AI for small projects and solo founders.',
            icon: 'bolt',
            highlight: false,
            features: [
                { label: '1 AI Bot' },
                { label: '500 messages / month' },
                { label: '100 knowledge chunks' },
                { label: 'Standard response speed' },
                { label: 'SaPyBase branding' },
                { label: 'Basic analytics' },
                { label: 'Community support' },
            ],
        },
        {
            name: 'Starter', id: 'STARTER',
            price: PRICE_MATRIX.STARTER[currency],
            period: '/mo',
            description: 'Up to 2 bots for growing businesses.',
            icon: 'rocket_launch',
            highlight: true,
            features: [
                { label: '2 AI Bots' },
                { label: '2,000 messages / bot / month' },
                { label: '500 knowledge chunks per bot' },
                { label: 'Priority response speed' },
                { label: 'Custom branding & colors' },
                { label: 'Lead capture (CRM-ready)' },
                { label: 'Standard analytics' },
                { label: 'Priority email support' },
            ],
        },
        {
            name: 'Pro', id: 'PRO',
            price: PRICE_MATRIX.PRO[currency],
            period: '/mo',
            description: 'Up to 5 bots for scaling operations.',
            icon: 'corporate_fare',
            highlight: false,
            features: [
                { label: '5 AI Bots' },
                { label: '5,000 messages / bot / month' },
                { label: '2,000 knowledge chunks per bot' },
                { label: 'Dedicated response speed' },
                { label: 'Full white-label' },
                { label: 'Webhooks & Zapier' },
                { label: 'Advanced analytics & exports' },
                { label: 'Lead capture (full CRM)' },
                { label: 'SLA & dedicated support' },
            ],
        },
        {
            name: 'Business', id: 'BUSINESS',
            price: PRICE_MATRIX.BUSINESS[currency],
            period: '/mo',
            description: 'Up to 15 bots — the full platform for high-growth teams.',
            icon: 'domain',
            highlight: false,
            badge: 'Full Platform',
            features: [
                { label: '15 AI Bots' },
                { label: '15,000 messages / bot / month' },
                { label: '10,000 knowledge chunks per bot' },
                { label: 'Ultra response speed' },
                { label: 'Full white-label' },
                { label: 'Human handoff (transcript + URL)' },
                { label: 'Full CRM lead capture' },
                { label: 'Webhooks & Zapier' },
                { label: 'Full analytics & ROI reports' },
                { label: 'Dedicated SLA support' },
            ],
        },
    ];

    const handleSelectPlan = (tier) => {
        if (!user) { window.location.href = '/sign-in'; return; }
        if (tier === userTier) return;

        const checkoutUrl = POLAR_URLS[tier];
        if (!checkoutUrl) {
            console.error(`Missing Polar Checkout URL for tier: ${tier}`);
            showAlert('error', 'Billing system is currently unavailable. Please try again later.');
            return;
        }

        setIsLoading(true);
        setSelectedTier(tier);
        showAlert('development', `Redirecting to checkout for ${tier} plan...`);

        const returnUrl = `${window.location.origin}/app/register?payment=success`;
        setTimeout(() => {
            const base = `${checkoutUrl}?success_url=${encodeURIComponent(returnUrl)}`;
            window.location.href = user?.id ? `${base}&customer_external_id=${user.id}` : base;
        }, 800);
    };

    const handleContactCustom = () => {
        window.location.href = `mailto:ayushsatvara2002@gmail.com?subject=Custom%20Plan%20Enquiry&body=Hi%20Ayush%2C%0A%0AI'm%20interested%20in%20a%20custom%20plan%20for%20my%20agency%2Fbusiness.%0A%0AOrganisation%3A%0AExpected%20bots%3A%0AExpected%20monthly%20messages%3A%0AKey%20features%20needed%3A%0A`;
    };

    const renderFeature = (f) => (
        <div key={f.label} className="flex items-center gap-3 group">
            <CheckIcon />
            <span className="text-sm text-slate-600 font-semibold dark:text-slate-400 font-sans transition-colors group-hover:text-slate-900 dark:group-hover:text-slate-200">{f.label}</span>
        </div>
    );

    return (
        <>
            <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-x-hidden transition-colors duration-500">

                {/* ── Header ── */}
                <div className="bg-white dark:bg-slate-950 px-4 py-5 sm:px-6 sm:py-6 md:px-8 md:py-8 shrink-0 border-b border-gray-100 dark:border-slate-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-colors duration-500">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="material-symbols-outlined text-[16px] text-blue-500">auto_awesome</span>
                            <h1 className="text-lg sm:text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">Plans &amp; Pricing</h1>
                        </div>
                        <p className="text-sm font-display text-slate-600 dark:text-slate-400 leading-relaxed transition-colors max-w-sm">Choose the plan that fits your stage. Fast &amp; simple setup.</p>
                        <div className="mt-3 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 flex items-center gap-2 w-fit">
                            <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[16px]">verified</span>
                            <p className="text-[10px] font-google font-bold text-blue-700 dark:text-blue-300 uppercase tracking-widest">
                                Beta: Basic plan free until next version · Email for Starter promo code
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 self-start sm:self-auto">
                        {isDetecting ? (
                            <div className="flex items-center gap-2 text-[10px] font-sans font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                                <span className="material-symbols-outlined text-[12px]">public</span>
                                Detecting...
                            </div>
                        ) : (
                            <div className="flex border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 h-9 overflow-hidden shadow-sm">
                                {Object.keys(CURRENCIES).map(curr => (
                                    <button key={curr} onClick={() => setCurrency(curr)}
                                        className={`px-3 py-1 text-sm font-sans font-bold tracking-widest uppercase transition-all ${currency === curr
                                            ? 'bg-slate-900 dark:bg-blue-600 text-white'
                                            : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                                        {curr}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Plan Cards ── mobile: single col → sm: 2 col → lg: 4 col */}
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#E8EBF0] dark:bg-slate-800 transition-colors duration-500">
                        {plans.map((plan, i) => (
                            <motion.div
                                key={plan.id}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.08 }}
                                className={`${cellCls} flex flex-col p-5 sm:p-6 md:p-8 relative border-t-2 ${plan.highlight ? 'border-blue-500 dark:border-blue-400' : plan.id === 'BUSINESS' ? 'border-emerald-500 dark:border-emerald-400' : 'border-transparent'}`}
                            >
                                {/* Badge */}
                                {(plan.highlight || plan.badge) && (
                                    <div className={`absolute top-0 right-0 px-3 py-1 text-white text-[9px] uppercase tracking-widest font-bold font-sans ${plan.highlight ? 'bg-linear-to-r from-blue-600 to-green-600' : 'bg-linear-to-r from-emerald-600 to-teal-600'}`}>
                                        {plan.badge ?? 'Recommended'}
                                    </div>
                                )}

                                {/* Icon */}
                                <div className={`w-10 h-10 border flex items-center justify-center mb-5 shrink-0 transition-colors ${plan.highlight
                                    ? 'bg-linear-to-br from-blue-600 to-green-600 border-blue-400 text-white shadow-lg shadow-blue-500/20'
                                    : plan.id === 'BUSINESS'
                                        ? 'bg-linear-to-br from-emerald-600 to-teal-600 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
                                        : 'bg-[#FAFAFA] dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'}`}>
                                    <span className="material-symbols-outlined text-[18px]">{plan.icon}</span>
                                </div>

                                {/* Name */}
                                <h3 className="text-lg sm:text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-1 uppercase tracking-tight transition-colors">{plan.name}</h3>

                                {/* Price */}
                                <div className="flex flex-col gap-0.5 mb-4">
                                    <div className="flex items-baseline gap-1">
                                        {plan.id === 'BASIC' ? (
                                            <span className="text-2xl sm:text-3xl font-display font-black tracking-tight text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-0.5 border-l-4 border-blue-500">
                                                FREE
                                            </span>
                                        ) : (
                                            <>
                                                <span className="text-3xl sm:text-4xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">
                                                    {formatPrice(plan.price)}
                                                </span>
                                                <span className="text-xs text-slate-400 dark:text-slate-500 font-display italic mb-1">{plan.period}</span>
                                            </>
                                        )}
                                    </div>
                                    <span className="text-[9px] uppercase tracking-widest font-bold text-blue-600 dark:text-blue-400 font-sans">
                                        {plan.id === 'BASIC' ? 'No credit card required' : 'Local taxes handled at checkout'}
                                    </span>
                                </div>

                                <p className="text-xs font-google text-slate-500 dark:text-slate-300 leading-relaxed mb-5 transition-colors">{plan.description}</p>

                                {/* Features */}
                                <div className="space-y-3 flex-1 mb-6">
                                    {plan.features.map(f => renderFeature(f))}
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={() => handleSelectPlan(plan.id)}
                                    disabled={isLoading || plan.id === userTier}
                                    className={`w-full py-3 min-h-[44px] text-xs font-sans uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${plan.highlight
                                        ? 'bg-linear-to-r from-blue-600 to-green-600 text-white hover:opacity-90 shadow-xl shadow-blue-500/10'
                                        : plan.id === 'BUSINESS'
                                            ? 'bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 shadow-xl shadow-emerald-500/10'
                                            : 'bg-transparent border border-gray-200 dark:border-slate-800 text-slate-900 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                                        } ${(isLoading && selectedTier === plan.id) || plan.id === userTier ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}
                                >
                                    {plan.id === userTier ? 'ACTIVE_PLAN' : (
                                        isLoading && selectedTier === plan.id
                                            ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current animate-spin rounded-full" /> PROVISIONING...</>
                                            : `ACTIVATE_${plan.name.toUpperCase()}`
                                    )}
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    {/* ── Custom / Agency Plan ── */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: plans.length * 0.08 }}
                        className="bg-white dark:bg-slate-950 border-t-2 border-blue-500 dark:border-blue-400 relative transition-colors duration-500"
                    >
                        <div className="flex w-fit px-3 py-1 bg-linear-to-r from-blue-600 to-teal-600 text-white text-[9px] uppercase tracking-widest font-bold font-sans">
                            For Agencies
                        </div>

                        <div className="flex flex-col lg:flex-row divide-y divide-gray-100 dark:divide-slate-800 lg:divide-y-0 lg:divide-x">

                            {/* Identity */}
                            <div className="flex-1 p-5 sm:p-6 md:p-8">
                                <div className="w-10 h-10 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                                    <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">build</span>
                                </div>
                                <h3 className="text-lg sm:text-xl font-display font-bold text-slate-900 dark:text-slate-200 mb-2 uppercase tracking-tight">Custom</h3>
                                <div className="mb-2">
                                    <span className="text-2xl sm:text-3xl font-display font-black tracking-tight text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-0.5 border-l-4 border-blue-500 inline-block">
                                        Let's Talk
                                    </span>
                                </div>
                                <span className="text-[9px] uppercase tracking-widest font-bold text-blue-600 dark:text-blue-400 font-sans">Tailored pricing · monthly or annual</span>
                                <p className="text-xs font-google text-slate-500 dark:text-slate-300 leading-relaxed mt-3">
                                    Built for agencies, resellers, and high-growth businesses that need full control over bots, data, models, and features. Configured from our admin panel.
                                </p>
                            </div>

                            {/* Add-ons grid */}
                            <div className="flex-1 p-5 sm:p-6 md:p-8">
                                <p className="text-[9px] uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-sans mb-4">Fully configurable add-ons</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                                    {[
                                        { icon: 'smart_toy',          label: 'Custom bot count',      sub: 'From 1 to unlimited' },
                                        { icon: 'forum',              label: 'Custom message quota',  sub: 'Per-month cap you choose' },
                                        { icon: 'storage',            label: 'Knowledge chunks',      sub: 'Scale your data store' },
                                        { icon: 'auto_awesome',       label: 'Gemini model choice',   sub: 'Flash-Lite → Pro Preview' },
                                        { icon: 'support_agent',      label: 'Human handoff',         sub: 'Transcript + redirect URL' },
                                        { icon: 'contact_mail',       label: 'Lead capture',          sub: 'CRM-ready visitor data' },
                                        { icon: 'branding_watermark', label: 'White label',           sub: 'Remove SaPyBase branding' },
                                        { icon: 'webhook',            label: 'Webhook / Zapier',      sub: 'Connect any platform' },
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-start gap-2.5">
                                            <div className="w-6 h-6 shrink-0 mt-0.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-[12px] text-blue-600 dark:text-blue-400">{f.icon}</span>
                                            </div>
                                            <div>
                                                <p className="text-xs font-google font-bold text-slate-800 dark:text-slate-200 leading-tight">{f.label}</p>
                                                <p className="text-[10px] font-google text-slate-400 dark:text-slate-500 mt-0.5">{f.sub}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Perks + CTA */}
                            <div className="p-5 sm:p-6 md:p-8 flex flex-col gap-5 lg:w-60 xl:w-68">
                                <div className="space-y-2.5">
                                    {[
                                        'Dedicated onboarding call',
                                        'SLA & priority support',
                                        'Monthly or annual billing',
                                        'Admin-managed config changes',
                                        'Analytics & ROI reports',
                                    ].map((f, i) => (
                                        <div key={i} className="flex items-center gap-2">
                                            <div className="w-4 h-4 shrink-0 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                                                <span className="material-symbols-outlined text-[10px] text-blue-500">check</span>
                                            </div>
                                            <span className="text-[11px] font-google font-semibold text-slate-600 dark:text-slate-400">{f}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-auto space-y-2">
                                    <button
                                        onClick={handleContactCustom}
                                        className="w-full py-3 text-xs font-sans uppercase tracking-widest font-bold transition-all bg-linear-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                                    >
                                        <span className="material-symbols-outlined text-[14px]">mail</span>
                                        Contact Us
                                    </button>
                                    <p className="text-[9px] font-google text-slate-400 dark:text-slate-500 text-center">
                                        Reply within 24 hours · No contracts required
                                    </p>
                                </div>
                            </div>

                        </div>
                    </motion.div>
                </div>

            </div>

            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </>
    );
};

export default AppPricing;
