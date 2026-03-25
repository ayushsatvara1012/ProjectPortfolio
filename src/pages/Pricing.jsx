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
        <div className="w-full min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center py-20 px-4 relative overflow-hidden">
            {/* Background Orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 dark:bg-purple-500/5 blur-[100px]"></div>
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
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold uppercase tracking-wider mb-6"
                    >
                        <Sparkles className="w-4 h-4" />
                        <span>Select Your Power Level</span>
                    </motion.div>
                    <motion.h1 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-6xl font-black tracking-tight text-slate-900 dark:text-white mb-6"
                    >
                        Choose Your <span className="text-transparent bg-clip-text bg-linear-to-r from-red-600 to-indigo-600 dark:from-red-400 dark:to-indigo-500">Subscription</span>
                    </motion.h1>
                    <motion.p 
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium"
                    >
                        Scale your AI capabilities as you grow. Every plan includes our core RAG engine and domain-specific training.
                    </motion.p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {plans.map((plan, index) => (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 * (index + 3) }}
                            className={`relative group bg-white/60 dark:bg-slate-900/40 backdrop-blur-2xl border ${plan.highlight ? 'border-indigo-500 shadow-2xl shadow-indigo-500/10' : 'border-slate-200 dark:border-slate-800/60'} rounded-[2.5rem] p-8 flex flex-col transition-all hover:scale-[1.02]`}
                        >
                            {plan.highlight && (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <div className={`w-14 h-14 rounded-2xl ${plan.highlight ? 'bg-indigo-600 text-white' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400'} flex items-center justify-center mb-6`}>
                                    <plan.icon className="w-7 h-7" />
                                </div>
                                <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-4xl font-black text-slate-900 dark:text-white">{plan.price}</span>
                                    {plan.period && <span className="text-slate-500 font-bold">{plan.period}</span>}
                                </div>
                                <p className="text-slate-500 dark:text-slate-400 text-sm mt-4 font-medium leading-relaxed">
                                    {plan.description}
                                </p>
                            </div>

                            <div className="space-y-4 mb-10 flex-1">
                                {plan.features.map((feature, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                                            <Check className="w-3 h-3 text-green-600 dark:text-green-400" />
                                        </div>
                                        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => handleSelectPlan(plan.id)}
                                disabled={isLoading}
                                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all ${
                                    plan.highlight 
                                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20' 
                                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90'
                                } active:scale-95 flex items-center justify-center gap-2`}
                            >
                                {isLoading && selectedTier === plan.id ? (
                                    <Logo className="w-8 h-4" />
                                ) : (
                                    <>
                                        {plan.id === 'FREE' ? 'Start 30-Day Free Trial' : `Select ${plan.name}`}
                                        <Rocket className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
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
