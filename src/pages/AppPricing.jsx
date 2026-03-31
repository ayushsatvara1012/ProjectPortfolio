import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Zap, Rocket, Building2, Sparkles } from 'lucide-react';
import { useAuth, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

const POLAR_URLS = {
    FREE: `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_qvVDFbLIJZjAyayYqbcuhhlyHOVbE6wmfYzCv4RE0wq/redirect`,
    STARTER: `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_ohwJA87iVQyjKgqyQsTcx4yJuWNg5VK907DuI4ZdmGd/redirect`,
    PRO: `https://sandbox-api.polar.sh/v1/checkout-links/polar_cl_uXNpB5PduaGrEORwhlkn1rELOCqepPiNXJGG917fccl/redirect`,
};

const cellCls = 'bg-white dark:bg-slate-950 transition-colors duration-500';

const AppPricing = () => {
    const { user } = useUser();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [selectedTier, setSelectedTier] = useState(null);
    const [billingCycle, setBillingCycle] = useState('monthly');

    const plans = [
        {
            name: 'Trial', id: 'FREE', price: 'Free Trial',
            description: 'Explore SaPyBase with 1 bot for 30 days.',
            features: [
                '1 AI Bot',
                '200 messages / month',
                '50 knowledge chunks',
                'Standard response speed',
                'SaPyBase branding',
                'Community support',
            ],
            icon: Zap, highlight: false,
        },
        {
            name: 'Professional', id: 'STARTER',
            price: billingCycle === 'monthly' ? '$5' : '$4.5',
            period: billingCycle === 'monthly' ? '/mo' : '/mo billed annually',
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
            price: billingCycle === 'monthly' ? '$10' : '$9',
            period: billingCycle === 'monthly' ? '/mo' : '/mo billed annually',
            description: 'Up to 5 bots for scaling operations.',
            features: [
                '5 AI Bots',
                'Unlimited messages',
                '5,000 knowledge chunks per bot',
                'Dedicated response speed',
                'Full white-label',
                'SLA & dedicated support',
            ],
            icon: Building2, highlight: false,
        },
    ];

    const handleSelectPlan = async (tier) => {
        if (!user) { window.location.href = '/sign-in'; return; }
        setIsLoading(true); setSelectedTier(tier);
        try {
            const returnUrl = `${window.location.origin}/app/register?payment=success`;
            const url = `${POLAR_URLS[tier]}?customer_external_id=${user.id}&success_url=${returnUrl}`;
            window.location.href = url;
        } catch { setIsLoading(false); }
    };

    return (
        <div className="flex flex-col h-full bg-[#E8EBF0] dark:bg-slate-900 overflow-hidden transition-colors duration-500">
            {/* Header */}
            <div className="bg-white dark:bg-slate-950 px-8 py-6 shrink-0 border-b border-gray-100 dark:border-slate-800 flex flex-row justify-between transition-colors duration-500">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-slate-400 dark:text-slate-500 transition-colors" />
                        <h1 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 transition-colors">Plans &amp; Pricing</h1>
                    </div>
                    <p className="text-md font-display text-slate-600 dark:text-slate-400 leading-relaxed transition-colors">Choose the plan that fits your stage. Upgrade anytime.</p>
                </div>
                {/* Billing Toggle */}
                <div className={`${cellCls} px-8 py-5 border-b border-gray-100 dark:border-slate-800`}>
                    <div className="flex border border-gray-100 dark:border-slate-800 w-fit h-10 transition-colors">
                        {['monthly', 'yearly'].map(cycle => (
                            <button key={cycle} onClick={() => setBillingCycle(cycle)}
                                className={`relative px-8 py-2 text-md uppercase tracking-widest font-bold font-sans transition-colors ${billingCycle === cycle ? 'bg-slate-900 dark:bg-indigo-600 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-[#FAFAFA] dark:hover:bg-slate-800'
                                    }`}>
                                {cycle}
                                {cycle === 'yearly' && billingCycle !== 'yearly' && (
                                    <span className="absolute -top-2 -right-1 bg-blue-600 dark:bg-indigo-500 text-white text-md uppercase tracking-widest font-bold font-sans px-1.5 py-0.5">-20%</span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
            </div>


            {/* Plan Cards — gap-px tic-tac-toe grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#E8EBF0] dark:bg-slate-800 flex-1 overflow-y-auto custom-scrollbar transition-colors duration-500">
                {plans.map((plan, i) => (
                    <motion.div key={plan.id}
                        className={`${cellCls} flex flex-col p-10 relative border-t-2 ${plan.highlight ? 'border-blue-600 dark:border-indigo-500' : 'border-transparent'
                            }`}
                    >
                        {plan.highlight && (
                            <div className="absolute top-0 right-0 px-4 py-1.5 bg-blue-600 dark:bg-indigo-600 text-white text-md uppercase tracking-widest font-bold font-sans transition-colors">
                                Most Popular
                            </div>
                        )}

                        <div className={`w-12 h-12 border flex items-center justify-center mb-6 transition-colors ${plan.highlight ? 'bg-blue-600 dark:bg-indigo-600 border-blue-400 dark:border-indigo-400 text-white' : 'bg-[#FAFAFA] dark:bg-slate-900 border-gray-100 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                            }`}>
                            <plan.icon className="w-5 h-5" />
                        </div>

                        <h3 className="text-xl md:text-2xl font-display font-bold text-slate-900 dark:text-slate-200 mb-1.5 transition-colors">{plan.name}</h3>
                        <div className="flex items-baseline gap-1 mb-2">
                            <span className="text-4xl md:text-5xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-200 transition-colors">
                                {plan.price.startsWith('$') ? plan.price.substring(1) : plan.price}
                            </span>
                            {plan.period && <span className="text-sm text-slate-400 dark:text-slate-500 font-display italic mb-1 transition-colors">{plan.period}</span>}
                            {!plan.period && plan.id === 'FREE' && <span className="text-sm text-slate-400 dark:text-slate-500 font-medium italic mb-1 transition-colors">30 days</span>}
                        </div>
                        <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed mb-8 transition-colors">{plan.description}</p>

                        <div className="space-y-4 flex-1 mb-8">
                            {plan.features.map((f, j) => (
                                <div key={j} className="flex items-center gap-3">
                                    <div className="w-4 h-4 rounded-full bg-blue-50 dark:bg-indigo-900/40 flex items-center justify-center transition-colors">
                                        <Check className="w-2.5 h-2.5 text-blue-500 dark:text-indigo-400 shrink-0 transition-colors" />
                                    </div>
                                    <span className="text-md text-slate-600 dark:text-slate-400 font-sans transition-colors">{f}</span>
                                </div>
                            ))}
                        </div>

                        <button onClick={() => handleSelectPlan(plan.id)} disabled={isLoading}
                            className={`w-full py-3.5 min-h-[44px] text-md uppercase tracking-widest font-bold font-sans transition-all flex items-center justify-center gap-2 active:scale-95 ${plan.highlight
                                ? 'bg-blue-600 dark:bg-indigo-600 text-white hover:bg-blue-700 dark:hover:bg-indigo-500 shadow-lg shadow-blue-500/20 dark:shadow-indigo-500/20'
                                : 'bg-transparent border border-gray-100 dark:border-slate-700 text-slate-900 dark:text-slate-300 hover:bg-[#FAFAFA] dark:hover:bg-slate-800'
                                } ${isLoading && selectedTier === plan.id ? 'opacity-60' : ''}`}>
                            {isLoading && selectedTier === plan.id
                                ? <><div className="w-3 h-3 border-2 border-current/30 border-t-current animate-spin" /> Processing...</>
                                : plan.id === 'FREE' ? 'Start Free Trial' : `Select ${plan.name}`
                            }
                        </button>
                    </motion.div>
                ))}
            </div>
        </div>
    );
};

export default AppPricing;
