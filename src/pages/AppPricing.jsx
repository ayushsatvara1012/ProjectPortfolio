import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Rocket, Building2, Sparkles, Globe } from 'lucide-react';
import { useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useUserRole } from '../context/UserContext';
import Alert from '../components/alert';

const POLAR_URLS = {
    BASIC: import.meta.env.VITE_POLAR_BASIC_URL,
    STARTER: import.meta.env.VITE_POLAR_STARTER_URL,
    PRO: import.meta.env.VITE_POLAR_PRO_URL,
};

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

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
        BASIC: { USD: 5, INR: 450 },
        STARTER: { USD: 10, INR: 900 },
        PRO: { USD: 20, INR: 1800 }
    };

    const formatPrice = (val) => {
        return new Intl.NumberFormat(CURRENCIES[currency].locale, {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: val % 1 === 0 ? 0 : 1,
        }).format(val);
    };

    // ── LOCATION DETECTION ───────────────────────────────────────────────────
    useEffect(() => {
        const detectCurrency = async () => {
            try {
                // Try 1: Timezone check (fastest, no network)
                const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
                if (tz.includes('India') || tz.includes('Calcutta')) {
                    setCurrency('INR');
                    setIsDetecting(false);
                    return;
                }

                // Try 2: Network IP API (more reliable)
                const res = await fetch('https://ipapi.co/json/');
                const data = await res.json();
                if (data.currency === 'INR') {
                    setCurrency('INR');
                } else {
                    setCurrency('USD');
                }
            } catch (err) {
                console.error("Location detection failed:", err);
                setCurrency('USD'); // Default fallback
            } finally {
                setIsDetecting(false);
            }
        };

        detectCurrency();
    }, []);

    // ── AUTO-REDIRECT ON SUCCESS ─────────────────────────────────────────────
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('payment') === 'success' && userTier && userTier !== 'FREE') {
            navigate('/app/register');
        }
    }, [userTier, navigate]);

    const plans = [
        {
            name: 'Basic', id: 'BASIC',
            price: PRICE_MATRIX.BASIC[currency],
            period: '/mo',
            description: 'Essential AI for small projects.',
            features: [
                '1 AI Bot',
                '500 messages / month',
                '100 knowledge chunks',
                'Standard response speed',
                'SaPyBase branding',
                'Community support',
            ],
            icon: Zap, highlight: false,
        },
        {
            name: 'Professional', id: 'STARTER',
            price: PRICE_MATRIX.STARTER[currency],
            period: '/mo',
            description: 'Up to 2 bots for growing businesses.',
            features: [
                '2 AI Bots',
                '2,000 messages / bot / month',
                '500 knowledge chunks per bot',
                'Priority response speed',
                'Custom branding & colors',
                'Priority email support',
            ],
            icon: Rocket, highlight: true,
        },
        {
            name: 'Enterprise', id: 'PRO',
            price: PRICE_MATRIX.PRO[currency],
            period: '/mo',
            description: 'Up to 5 bots for scaling operations.',
            features: [
                '5 AI Bots',
                '5,000 messages / month',
                '2,000 knowledge chunks per bot',
                'Dedicated response speed',
                'Full white-label',
                'SLA & dedicated support',
            ],
            icon: Building2, highlight: false,
        },
    ];

    const handleSelectPlan = (tier) => {
        if (!user) { window.location.href = '/sign-in'; return; }
        if (tier === userTier) return;

        const checkoutUrl = POLAR_URLS[tier];

        // SAFETY CATCH: If the .env variable is missing, stop the checkout!
        if (!checkoutUrl) {
            console.error(`🚨 CRITICAL: Missing Polar Checkout URL for tier: ${tier}`);
            showAlert('error', 'Billing system is currently down for maintenance. Please try again later.');
            return;
        }

        setIsLoading(true); setSelectedTier(tier);
        showAlert('development', `Redirecting to Polar for ${tier} activation...`);

        const returnUrl = `${window.location.origin}/app/register?payment=success`;

        setTimeout(() => {
            if (user?.id) {
                window.location.href = `${checkoutUrl}?customer_external_id=${user.id}&success_url=${encodeURIComponent(returnUrl)}`;
            } else {
                window.location.href = `${checkoutUrl}?success_url=${encodeURIComponent(returnUrl)}`;
            }
        }, 800);
    };

    return (
        <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-x-hidden transition-colors duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-slate-950 px-6 py-6 md:px-8 md:py-8 shrink-0 border-b border-gray-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-6 transition-colors duration-500">
                <div className="text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-indigo-500 transition-colors" />
                        <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">Plans &amp; Pricing</h1>
                    </div>
                    <p className="text-md font-display text-slate-600 dark:text-slate-400 leading-relaxed transition-colors max-w-sm md:max-w-none">Choose the plan that fits your stage. Fast & simple setup.</p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                    {/* Detection Indicator */}
                    {isDetecting && (
                        <div className="flex items-center gap-2 text-xs font-sans font-bold text-slate-400 uppercase tracking-widest animate-pulse">
                            <Globe className="w-3 h-3" />
                            Detecting Location...
                        </div>
                    )}
                    {/* Currency Switcher */}
                    {!isDetecting && (
                        <div className="flex border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 h-10 transition-colors rounded-none overflow-hidden shadow-sm">
                            {Object.keys(CURRENCIES).map(curr => (
                                <button key={curr} onClick={() => setCurrency(curr)}
                                    className={`px-4 py-1.5 text-lg font-sans font-bold tracking-widest uppercase transition-all ${currency === curr
                                        ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-md'
                                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'
                                        }`}>
                                    {curr}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Plan Cards — grid: 1 col on mobile, 3 cols on medium+ */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E8EBF0] dark:bg-slate-800 flex-1 overflow-y-auto custom-scrollbar transition-colors duration-500 pb-10">
                {plans.map((plan, i) => (
                    <motion.div 
                        key={plan.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`${cellCls} flex flex-col p-8 md:p-10 relative border-t-2 ${plan.highlight ? 'border-indigo-600 dark:border-indigo-500' : 'border-transparent'
                            }`}
                    >
                        {plan.highlight && (
                            <div className="absolute top-0 right-0 px-4 py-1.5 bg-indigo-600 text-white text-[10px] uppercase tracking-widest font-bold font-sans transition-colors">
                                Recommended
                            </div>
                        )}

                        <div className={`w-12 h-12 border flex items-center justify-center mb-6 transition-colors ${plan.highlight ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-500/20' : 'bg-[#FAFAFA] dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                            <plan.icon className="w-5 h-5" />
                        </div>

                        <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-1.5 transition-colors uppercase tracking-tight">{plan.name}</h3>
                        <div className="flex flex-col gap-1 mb-6">
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">
                                    {formatPrice(plan.price)}
                                </span>
                                {plan.period && <span className="text-xs text-slate-400 dark:text-slate-500 font-display italic mb-1 transition-colors">{plan.period}</span>}
                            </div>
                            <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-600 dark:text-indigo-400 font-sans mt-1">
                                Local taxes handled at checkout
                            </span>
                        </div>
                        <p className="text-lg font-sans text-slate-500 dark:text-slate-400 leading-relaxed mb-8 transition-colors">{plan.description}</p>

                        <div className="space-y-4 flex-1 mb-8">
                            {plan.features.map((f, j) => (
                                <div key={j} className="flex items-center gap-3 group">
                                    <div className="w-4 h-4 rounded-none bg-indigo-50 dark:bg-indigo-900/40 flex items-center justify-center transition-colors group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/60">
                                        <Check className="w-2.5 h-2.5 text-indigo-500 dark:text-indigo-400 shrink-0 transition-colors" />
                                    </div>
                                    <span className="text-lg text-slate-600 dark:text-slate-400 font-sans transition-colors group-hover:text-slate-900 dark:group-hover:text-slate-200">{f}</span>
                                </div>
                            ))}
                        </div>

                        <button onClick={() => handleSelectPlan(plan.id)} disabled={isLoading || plan.id === userTier}
                            className={`w-full py-4 min-h-[48px] text-lg font-sans uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${plan.highlight
                                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-500/10'
                                : 'bg-transparent border border-gray-200 dark:border-slate-800 text-slate-900 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900'
                                } ${(isLoading && selectedTier === plan.id) || plan.id === userTier ? 'opacity-50 cursor-not-allowed grayscale' : ''}`}>
                            {plan.id === userTier ? 'ACTIVE_PLAN' : (
                                isLoading && selectedTier === plan.id
                                    ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current animate-spin" /> PROVISIONING...</>
                                    : `ACTIVATE_${plan.name.toUpperCase()}`
                            )}
                        </button>
                    </motion.div>
                ))}
            </div>
            <Alert isOpen={alert.open} type={alert.type} message={alert.msg} onClose={() => setAlert(p => ({ ...p, open: false }))} />
        </div>
    );
};

export default AppPricing;
