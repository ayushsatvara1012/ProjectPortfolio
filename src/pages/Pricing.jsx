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
            price: "$49",
            period: "/month",
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
            price: "Custom",
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
            if (tier === 'FREE') {
                // Call local backend to set tier to FREE
                const token = await getToken();
                const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/user/subscription`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ tier: 'FREE' })
                });

                if (response.ok) {
                    if (onPlanSelected) {
                        onPlanSelected('FREE');
                    } else {
                        navigate('/register');
                    }
                    return;
                } else {
                    const err = await response.json();
                    throw new Error(err.detail || "Failed to set Free tier");
                }
            }

            // Mapping tiers to Polar checkout URLs (Paid Tiers)
            // ADDING success_url to ensure they return to /register after paying
            const returnUrl = `${window.location.origin}/register`;
            const polarCheckoutURLs = {
                'STARTER': `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_2W2DB1CYYV7L8oPkX1pMEaHbHKsWT13gJ5CS02yH7PQ/redirect?customer_external_id=${user.id}&success_url=${returnUrl}`,
                'PRO': `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_GlcO80t9NECvnxk7aDYxvYC9UhXw3NUnASYTr4gXE3f/redirect?customer_external_id=${user.id}&success_url=${returnUrl}`
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
                        className="mb-8 flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors shadow-sm cursor-pointer"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        Back to Dashboard
                    </motion.button>
                )}
                <div className="text-center mb-16">
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
                        Scaling as you <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600 dark:from-red-400 dark:to-indigo-500">grow</span>.
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
                        <div className="flex items-center bg-slate-100 dark:bg-[#111] p-1 rounded-full border border-slate-200 dark:border-slate-800">
                            <button className="px-6 py-1.5 text-xs font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-800 shadow-sm rounded-full transition-all">
                                Monthly
                            </button>
                            <button className="px-6 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300 transition-all">
                                Yearly
                            </button>
                        </div>
                    </motion.div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * (index + 3) }}
                            className={`relative group bg-white dark:bg-[#0A0A0A] border transition-all duration-300 hover:-translate-y-1 ${
                                plan.highlight 
                                ? 'border-indigo-500 ring-2 ring-indigo-500 dark:ring-indigo-500 shadow-[0_0_40px_-15px_rgba(99,102,241,0.4)]' 
                                : 'border-slate-200 dark:border-slate-800'
                            } rounded-2xl p-6 flex flex-col`}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-full z-20 shadow-lg shadow-indigo-500/20 whitespace-nowrap">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-6">
                                <div className={`w-12 h-12 rounded-xl border ${plan.highlight ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'} flex items-center justify-center mb-5 transition-transform group-hover:scale-110 duration-500`}>
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
                                        <Check className="w-4 h-4 text-indigo-500 group-hover:text-indigo-400 transition-colors shrink-0" />
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-400">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => handleSelectPlan(plan.id)}
                                disabled={isLoading}
                                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 group/btn relative overflow-hidden ${
                                    plan.highlight 
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20 active:scale-[0.98]' 
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
