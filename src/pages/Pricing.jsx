import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Rocket, Building2, Sparkles, ChevronLeft } from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const Pricing = ({ onPlanSelected, onBack }) => {
    const { getToken } = useAuth();
    const { user } = useUser();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTier, setSelectedTier] = useState(null);
    const [hasExistingCompany, setHasExistingCompany] = useState(false);
    const [billingCycle, setBillingCycle] = useState('monthly');

    React.useEffect(() => {
        const checkCompany = async () => {
            try {
                const token = await getToken();
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/company/details`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.status === 'success') {
                    setHasExistingCompany(true);
                }
            } catch (e) {
                console.error("Pricing Check Error:", e);
            }
        };
        if (user) checkCompany();
    }, [user, getToken]);

    const plans = [
        {
            name: "Starter",
            id: "FREE",
            price: "Free Trial",
            description: "Perfect for exploring SaPyBase capabilities.",
            features: [
                "1 AI Assistant",
                "Up to 50 MB Knowledge base",
                "Basic Analytics",
                "Standard Response Speed",
                "Community Support"
            ],
            icon: Zap,
            highlight: false
        },
        {
            name: "Professional",
            id: "STARTER",
            price: billingCycle === 'monthly' ? "$5" : "$4.5",
            period: billingCycle === 'monthly' ? "/month" : "/mo (billed annually)",
            description: "Advanced AI for growing businesses.",
            features: [
                "Unlimited AI Assistants",
                "2 GB Knowledge base",
                "Advanced Analytics & Insights",
                "Priority Sync Speed",
                "Priority Email Support",
                "Custom Branding"
            ],
            icon: Rocket,
            highlight: true
        },
        {
            name: "Enterprise",
            id: "PRO",
            price: billingCycle === 'monthly' ? "$10" : "$9",
            period: billingCycle === 'monthly' ? "/month" : "/mo (billed annually)",
            description: "Custom solutions for large scale operations.",
            features: [
                "Unlimited Everything",
                "Dedicated Server Capacity",
                "SLA & Guarantees",
                "Dedicated Account Manager",
                "On-premise deployment options",
                "SSO & Custom Security"
            ],
            icon: Building2,
            highlight: false
        }
    ];

    const handleSelectPlan = async (tier) => {
        if (!user) {
            window.location.href = '/sign-in';
            return;
        }

        setIsLoading(true);
        setSelectedTier(tier);

        try {
            // Mapping tiers to Polar checkout URLs
            // ADDING success_url to ensure they return to /register after paying
            const returnUrl = `${window.location.origin}/register`;

            const polarCheckoutURLs = {
                // IMPORTANT: Replace this placeholder with your actual Free Trial Checkout URL from Polar
                'FREE': `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_GlcO80t9NECvnxk7aDYxvYC9UhXw3NUnASYTr4gXE3f/redirect?customer_external_id=${user.id}&success_url=${returnUrl}`,
                'STARTER': `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_a737GpaDGcVAKALFibFjrhyAUb403vA0ABvto3pm67S/redirect?customer_external_id=${user.id}&success_url=${returnUrl}`,
                'PRO': `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_njcI1HUJc7Ux1JSawhnIzLNY8LwfrPzeRsOEJ474xCs/redirect?customer_external_id=${user.id}&success_url=${returnUrl}`
            };

            const checkoutUrl = polarCheckoutURLs[tier];
            if (checkoutUrl) {
                window.location.href = checkoutUrl;
            }
        } catch (error) {
            console.error("Error setting plan:", error);
            alert(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full min-h-screen bg-white dark:bg-[#0A0A0A] flex flex-col items-center py-12 px-4 relative overflow-hidden">
            {/* Background Glows (Subtle) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[60%] h-[40%] rounded-full bg-indigo-500/5 dark:bg-indigo-500/10 blur-[120px]"></div>
            </div>

            <div className="max-w-7xl mx-auto relative z-10 w-full">
                {(onBack || hasExistingCompany) && (
                    <motion.button
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        onClick={onBack || (() => navigate('/dashboard'))}
                        className="absolute top-6 left-2 mb-8 flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Dashboard
                    </motion.button>
                )}
                <div className="text-center my-6">
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-4"
                    >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Select Your Plan</span>
                    </motion.div>
                    <motion.h1
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white mb-3"
                    >
                        Launch your <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600 dark:from-red-400 dark:to-indigo-500">AI Chatbot</span>
                    </motion.h1>
                    <motion.p
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-500 dark:text-slate-400 max-w-lg mx-auto text-sm font-medium"
                    >
                        Choose the plan that fits your current stage. Seamlessly upgrade as your AI knowledge base expands.
                    </motion.p>

                    {/* Tactile Toggle Switch */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="mt-8 mb-4 flex justify-center"
                    >
                        <div className="flex items-center bg-slate-100 dark:bg-[#111] p-1 rounded-full border border-slate-200 dark:border-slate-800 relative">
                            <button
                                onClick={() => setBillingCycle('monthly')}
                                className={`px-6 py-1.5 text-xs font-bold rounded-full transition-all duration-300 relative z-10 ${billingCycle === 'monthly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}
                            >
                                Monthly
                            </button>
                            <button
                                onClick={() => setBillingCycle('yearly')}
                                className={`px-6 py-1.5 text-xs font-bold rounded-full transition-all duration-300 relative z-10 ${billingCycle === 'yearly' ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}
                            >
                                Yearly
                                <span className="absolute -top-4 -right-2 bg-blue-700 text-white text-[4px] px-1.5 py-0.5 rounded-full">
                                    SAVE 20%
                                </span>
                            </button>
                            {/* Animated Background Indicator */}
                            <motion.div
                                className="absolute inset-y-1 bg-white dark:bg-slate-800 rounded-full shadow-sm z-0"
                                initial={false}
                                animate={{
                                    x: billingCycle === 'monthly' ? 0 : '100%',
                                    width: '50%'
                                }}
                                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                style={{
                                    left: '4px',
                                    right: '4px',
                                    width: 'calc(50% - 4px)'
                                }}
                            />
                        </div>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * (index + 3) }}
                            className={`relative group bg-white dark:bg-[#0A0A0A] border transition-all duration-300 hover:-translate-y-1 ${plan.highlight
                                ? 'border-blue-500 ring-1 ring-blue-500 dark:ring-blue-500'
                                : 'border-slate-200 dark:border-slate-800'
                                } rounded-2xl p-6 flex flex-col`}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full z-20 shadow-lg shadow-blue-500/20 whitespace-nowrap">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-6">
                                <div className={`w-12 h-12 rounded-xl border ${plan.highlight ? 'bg-blue-600 border-blue-400 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'} flex items-center justify-center mb-5 transition-transform group-hover:scale-110 duration-500`}>
                                    <plan.icon className="w-6 h-6" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1 tracking-tight">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    {plan.id !== 'FREE' && <span className="text-slate-400 text-sm font-medium">$</span>}
                                    <span className="text-5xl font-black tracking-tighter text-slate-900 dark:text-white">
                                        {plan.price.startsWith('$') ? plan.price.substring(1) : plan.price}
                                    </span>
                                    {plan.period && <span className="text-slate-400 text-sm font-medium tracking-tight">{plan.period}</span>}
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-[13px] mt-3 font-medium leading-normal">
                                    {plan.description}
                                </p>
                            </div>

                            <div className="space-y-3 mb-8 flex-1">
                                {plan.features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <Check className="w-4 h-4 text-blue-500 group-hover:text-blue-400 transition-colors shrink-0" />
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => handleSelectPlan(plan.id)}
                                disabled={isLoading}
                                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn relative overflow-hidden ${plan.highlight
                                    ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                                    : 'bg-transparent border border-slate-300 dark:border-slate-800 text-slate-900 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900 active:scale-[0.98]'
                                    }`}
                            >
                                {isLoading && selectedTier === plan.id ? (
                                    <Logo className="w-8 h-4" />
                                ) : (
                                    <>
                                        <span>{plan.id === 'FREE' ? 'Start Free Trial' : `Select ${plan.name}`}</span>
                                        <Rocket className="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-1 group-hover/btn:-translate-y-1" />
                                    </>
                                )}
                            </button>
                        </motion.div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default Pricing;
