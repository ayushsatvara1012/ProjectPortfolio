'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Mail } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useUser, useClerk, useAuth } from '@clerk/nextjs';
import { buildPolarCheckoutUrl } from '@/src/lib/billing/checkout';
import { fetchExploreRoute, exploreDestination } from '@/src/lib/billing/explore';
import {
  PRICE_MATRIX,
  CURRENCIES,
  PLANS,
  COMPARISON_FEATURES,
  FEATURE_DESCRIPTIONS,
  FAQS,
  CheckMark,
  CellValue,
  FaqItem,
  accentMap,
  ExploreComingSoon
} from './components';

export default function PricingClient() {
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [isDetecting, setIsDetecting] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [selectedPlans, setSelectedPlans] = useState<Set<string>>(new Set(['STARTER', 'PRO']));
  const [highlightedPlan, setHighlightedPlan] = useState<string | null>(null);

  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const { openSignUp } = useClerk();
  const router = useRouter();
  const [exploreBusy, setExploreBusy] = useState(false);
  const [exploreMessage, setExploreMessage] = useState<string | null>(null);

  // Plan-card CTA: signed-in users go straight to the Polar checkout for the
  // selected tier; signed-out users get the sign-up/login flow first and are
  // forwarded to checkout afterwards (via the /subscribe continuation route).
  const handleSubscribe = (tier: string) => {
    if (isSignedIn) {
      const url = buildPolarCheckoutUrl(tier, billingPeriod, {
        userId: user?.id ?? null,
        origin: window.location.origin,
      });
      // Fall back to the in-app pricing page if a checkout link isn't configured.
      window.location.href = url ?? '/dashboard/pricing';
      return;
    }
    openSignUp({
      forceRedirectUrl: `/subscribe?plan=${tier}&period=${billingPeriod}`,
    });
  };

  // "Get Explore" CTA. Signed-out → sign up, then the /subscribe?plan=EXPLORE
  // continuation routes them. Signed-in → ask the backend which path applies
  // (business → Polar $0 checkout, personal → enquiry, blocked, or already-active).
  const handleGetExplore = async () => {
    setExploreMessage(null);
    if (!isSignedIn) {
      openSignUp({ forceRedirectUrl: '/subscribe?plan=EXPLORE' });
      return;
    }
    setExploreBusy(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('no token');
      const route = await fetchExploreRoute(token);
      const dest = exploreDestination(route, {
        userId: user?.id ?? null,
        origin: window.location.origin,
      });
      if (dest.kind === 'external') window.location.href = dest.url;
      else if (dest.kind === 'navigate') router.push(dest.path);
      else setExploreMessage(dest.text);
    } catch {
      // Network/auth hiccup — fall back to the enquiry form rather than dead-end.
      router.push('/explore/enquiry');
    } finally {
      setExploreBusy(false);
    }
  };

  const heroRef = useRef(null);
  const cardsRef = useRef(null);
  const tableRef = useRef(null);
  const faqRef = useRef(null);

  const heroInView = useInView(heroRef, { once: true, margin: '-60px' });
  const cardsInView = useInView(cardsRef, { once: true, margin: '-60px' });
  const tableInView = useInView(tableRef, { once: true, margin: '-80px' });
  const faqInView = useInView(faqRef, { once: true, margin: '-60px' });

  useEffect(() => {
    const detect = async () => {
      try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (tz.includes('India') || tz.includes('Calcutta')) { setCurrency('INR'); return; }
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        setCurrency(data.currency === 'INR' ? 'INR' : 'USD');
      } catch { setCurrency('USD'); }
      finally { setIsDetecting(false); }
    };
    detect();
  }, []);

  // Annual = 2 months free → per-month equivalent is monthly × 10 / 12.
  const formatPrice = (val: number) =>
    val === 0
      ? 'Free'
      : new Intl.NumberFormat(CURRENCIES[currency].locale, {
        style: 'currency', currency,
        minimumFractionDigits: 0,
      }).format(billingPeriod === 'annual' ? Math.round((val * 10) / 12) : val);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 overflow-x-hidden overflow-y-visible">

      {/* HERO SECTION */}
      <section ref={heroRef} className="relative min-h-[85vh] sm:min-h-[80vh] md:min-h-screen flex flex-col border-b border-gray-100 dark:border-slate-800 overflow-hidden [clip-path:inset(0)]">
        <Image src="/robo_nature.webp" alt="Hero background" fill className="object-cover object-top !fixed -z-10" priority />
        <div className="!fixed inset-0 bg-linear-to-b from-slate-950/70 via-slate-950/60 to-slate-950/90 sm:bg-linear-to-r sm:from-slate-950/85 sm:via-slate-950/70 sm:to-slate-950/30 z-0" />

        <div className="relative z-10 flex-1 flex flex-col justify-center sm:justify-center max-w-7xl mx-auto w-full px-4 pt-28 pb-12">
          <div className="max-w-xl lg:max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[14px] text-blue-400">auto_awesome</span>
              <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-300/80">AI Chatbot Pricing</span>
            </motion.div>

            <motion.h1 initial={{ opacity: 0, y: 20 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.08 }} className="text-4xl md:text-7xl font-display font-black text-white leading-none tracking-tight mb-5">
              Plans built for<br /> every <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-green-400">stage of growth.</span>
            </motion.h1>

            <motion.p initial={{ opacity: 0, y: 16 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.18 }} className="text-base md:text-lg font-google text-slate-300 leading-relaxed mb-8 max-w-lg">
              Deploy a production-ready AI chatbot in minutes. Start free, upgrade as you grow — transparent pricing with no hidden fees.
            </motion.p>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.28 }} className="grid grid-cols-3 gap-px bg-white/10 mb-8 w-full max-w-sm">
              {[
                { label: 'Plans', value: '4+' },
                { label: 'Setup time', value: '< 5 min' },
                { label: 'Uptime', value: '99.9%' },
              ].map(s => (
                <div key={s.label} className="bg-slate-950/50 backdrop-blur-sm px-4 py-3.5">
                  <div className="text-xl font-display font-black text-white">{s.value}</div>
                  <div className="text-[9px] uppercase tracking-widest font-display font-bold text-slate-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.36 }} className="flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard/pricing" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 text-base font-display font-medium tracking-widest hover:opacity-90 rounded-full">
                Get Started Free <ArrowRight size={14} />
              </Link>
              <a href="mailto:ayushsatvara2002@gmail.com" className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/10 backdrop-blur-sm text-white px-8 py-4 text-base font-display font-medium tracking-widest hover:bg-white/20 rounded-full">
                Talk to Sales <Mail size={14} />
              </a>
            </motion.div>
          </div>
        </div>

        <div className="relative z-10 w-full">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex overflow-x-auto gap-px scrollbar-hide">
              {[
                { icon: 'borg', label: 'LLM-Powered' },
                { icon: 'database', label: 'RAG Knowledge' },
                { icon: 'contact_mail', label: 'Lead Capture' },
                { icon: 'analytics', label: 'Analytics' },
                { icon: 'webhook', label: 'Webhooks' },
                { icon: 'branding_watermark', label: 'White-Label' },
              ].map((f, i) => (
                <motion.div key={f.label} initial={{ opacity: 0, y: 8 }} animate={heroInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.45 + i * 0.05 }} className="flex items-center gap-2 bg-slate-950/60 backdrop-blur-sm px-5 py-3.5 shrink-0">
                  <span className="material-symbols-outlined text-[13px] text-blue-400">{f.icon}</span>
                  <span className="text-[10px] font-display font-bold uppercase tracking-widest text-slate-300 whitespace-nowrap">{f.label}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* PLAN CARDS */}
      <section ref={cardsRef} className="py-20 bg-white dark:bg-slate-950 transition-colors duration-500">
        <div className="max-w-8xl mx-auto px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[14px] text-blue-500">sell</span>
                <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-400">_01 Plans</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-display font-black text-slate-900 dark:text-slate-100 tracking-tight">Choose your plan.</h2>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex border border-gray-200 dark:border-slate-800 bg-white dark:bg-white/[0.02] rounded-xl p-1">
                {(['monthly', 'annual'] as const).map(p => (
                  <button key={p} onClick={() => setBillingPeriod(p)} className={`px-4 py-2 text-[11px] font-display font-bold uppercase tracking-widest transition-all rounded-lg ${billingPeriod === p ? 'bg-slate-900 dark:bg-white text-white dark:text-black' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                    {p === 'annual' ? 'Annual · 2 mo free' : 'Monthly'}
                  </button>
                ))}
              </div>
              {!isDetecting && (
                <div className="flex border border-gray-200 dark:border-slate-800 bg-white dark:bg-white/[0.02] rounded-xl p-1">
                  {(['USD', 'INR'] as const).map(c => (
                    <button key={c} onClick={() => setCurrency(c)} className={`px-4 py-2 text-[11px] font-display font-bold uppercase tracking-widest transition-all rounded-lg ${currency === c ? 'bg-slate-900 dark:bg-white text-white dark:text-black' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Explore — lifetime-free plan, Coming Soon (full-width, above the cards) */}
          <ExploreComingSoon onGetExplore={handleGetExplore} busy={exploreBusy} message={exploreMessage} />

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLANS.map((plan, i) => {
              const price = PRICE_MATRIX[plan.id as keyof typeof PRICE_MATRIX][currency];
              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={cardsInView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: i * 0.08 }}
                  whileHover={{ y: -8, transition: { duration: 0.3 } }}
                  className="relative"
                >
                  <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-gray-200 dark:border-slate-800/60 backdrop-blur-sm flex flex-col p-8 h-full hover:border-gray-300 dark:hover:border-slate-700 transition-all duration-300 shadow-sm hover:shadow-lg dark:hover:shadow-slate-950/20">
                    {/* Badge */}
                    {plan.badge && (
                      <div className="absolute top-6 right-6 inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 px-3 py-1.5 rounded-full">
                        <span className="material-symbols-outlined text-blue-600 dark:text-blue-400 text-[14px]">star</span>
                        <span className="text-xs font-display font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider">{plan.badge}</span>
                      </div>
                    )}

                    {/* Icon */}
                    <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-6 shrink-0">
                      <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">{plan.icon}</span>
                    </div>

                    {/* Plan name & description */}
                    <h3 className="text-lg font-display font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide mb-2">{plan.name}</h3>
                    <p className="text-sm font-google text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">{plan.description}</p>

                    {/* Pricing */}
                    <div className="mb-8 pb-8 border-b border-gray-200 dark:border-slate-800/40">
                      <div className="flex items-baseline gap-1">
                        <span className="text-4xl font-display font-black text-slate-900 dark:text-slate-100">
                          {formatPrice(price)}
                        </span>
                        <span className="text-sm font-google text-slate-500 dark:text-slate-400">/month</span>
                      </div>
                      {billingPeriod === 'annual' && (
                        <span className="text-xs font-google text-emerald-600 dark:text-emerald-400 mt-1 block">
                          billed annually · 2 months free
                        </span>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-3 flex-1 mb-8">
                      {plan.features.map(f => (
                        <div key={f} className="flex items-start gap-3">
                          <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0 mt-0.5">
                            <span className="material-symbols-outlined text-[12px] text-slate-600 dark:text-slate-400">check</span>
                          </div>
                          <span className="text-sm font-google font-medium text-slate-700 dark:text-slate-300 leading-relaxed">{f}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA Button */}
                    <button
                      type="button"
                      onClick={() => handleSubscribe(plan.id)}
                      className={`w-full py-4 text-sm font-display font-bold uppercase tracking-widest flex items-center justify-center gap-2 rounded-xl transition-all active:scale-[0.98] ${plan.badge
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-100 shadow-lg'
                          : 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-slate-200 border border-gray-200 dark:border-slate-800/60 hover:bg-slate-200 dark:hover:bg-white/[0.10]'
                        }`}
                    >
                      {`Get ${plan.name}`}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURE COMPARISON */}
      <section ref={tableRef} className="py-20 bg-white dark:bg-slate-950 border-t border-gray-100 dark:border-slate-800 transition-colors duration-500">
        <div className="max-w-8xl mx-auto px-4">
          {/* Header */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={tableInView ? { opacity: 1, y: 0 } : {}} className="mb-12">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[14px] text-blue-500">compare_arrows</span>
              <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-400">_02 Compare</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-display font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">Feature comparison.</h2>
            <p className="text-base font-google text-slate-600 dark:text-slate-400 lg:block hidden">Click plans to compare side-by-side. Hover over features for more details.</p>
            <p className="text-base font-google text-slate-600 dark:text-slate-400 lg:hidden">Select plans to compare. Tap any feature to learn more.</p>
          </motion.div>

          {/* Plan Selector */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={tableInView ? { opacity: 1, y: 0 } : {}} className="mb-10 flex flex-wrap gap-2">
            {PLANS.map(plan => (
              <button
                key={plan.id}
                onClick={() => {
                  const newSelected = new Set(selectedPlans);
                  if (newSelected.has(plan.id)) {
                    newSelected.delete(plan.id);
                  } else {
                    newSelected.add(plan.id);
                  }
                  setSelectedPlans(newSelected);
                }}
                className={`px-4 sm:px-5 py-3 rounded-xl font-display font-bold uppercase tracking-wide text-xs sm:text-sm transition-all duration-300 border ${selectedPlans.has(plan.id)
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-black border-slate-700 dark:border-slate-200 shadow-lg'
                    : 'bg-slate-50 dark:bg-white/[0.02] text-slate-700 dark:text-slate-300 border-gray-200 dark:border-slate-800 hover:border-gray-300 dark:hover:border-slate-700'
                  }`}
              >
                {plan.name}
              </button>
            ))}
          </motion.div>

          {/* Comparison Content */}
          {selectedPlans.size > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={tableInView ? { opacity: 1 } : {}}>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <div className="min-w-full">
                  {COMPARISON_FEATURES.map(section => (
                    <div key={section.category} className="mb-8 rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                      <div className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-slate-800 px-6 py-4">
                        <h3 className="text-sm font-display font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">{section.category}</h3>
                      </div>

                      {section.rows.map((row) => (
                        <div key={row.label} className="flex group border-t border-gray-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-blue-950/30 transition-all duration-200 relative">
                          {/* Feature Label with Tooltip */}
                          <div className="w-1/3 px-6 py-5 bg-white dark:bg-white/[0.01] group-hover:bg-slate-100 dark:group-hover:bg-slate-900/50 transition-colors duration-200 border-r border-gray-100 dark:border-slate-800/50">
                            <div className="flex items-center gap-2 relative">
                              <p className="text-base font-google font-regular text-slate-900 dark:text-slate-200">{row.label}</p>
                              <div className="relative group/helpicon">
                                <span className="material-symbols-outlined text-xs text-slate-400 dark:text-slate-600 cursor-help transition-colors hover:text-slate-600 dark:hover:text-slate-400">info</span>
                                {/* Tooltip */}
                                <div className="absolute left-0 bottom-full mb-3 opacity-0 pointer-events-none group-hover/helpicon:opacity-100 group-hover/helpicon:pointer-events-auto translate-y-1 group-hover/helpicon:translate-y-0 transition-all duration-200 ease-in-out z-50 bg-slate-900 dark:bg-slate-800 text-white dark:text-slate-100 text-xs rounded-lg p-3 whitespace-normal w-64 shadow-lg border border-slate-700 dark:border-slate-600">
                                  {FEATURE_DESCRIPTIONS[row.label]}
                                  <div className="absolute top-full left-6 -mt-1 border-4 border-transparent border-t-slate-900 dark:border-t-slate-800" />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Plan Values */}
                          <div className="flex-1 flex">
                            {Array.from(selectedPlans).sort((a, b) => PLANS.findIndex(p => p.id === a) - PLANS.findIndex(p => p.id === b)).map((planId, planIdx) => {
                              const val = row[planId.toLowerCase() as keyof typeof row] as string | boolean;
                              const isDimmed = highlightedPlan !== null && highlightedPlan !== planId;

                              return (
                                <div
                                  key={planId}
                                  className={`flex-1 px-6 py-5 flex items-center justify-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-all duration-200 ${planIdx !== 0 ? 'border-l border-gray-100 dark:border-slate-800/50' : ''
                                    } ${isDimmed ? 'opacity-40' : 'opacity-100'}`}
                                  onMouseEnter={() => setHighlightedPlan(planId)}
                                  onMouseLeave={() => setHighlightedPlan(null)}
                                >
                                  <div className="flex items-center justify-center">
                                    {typeof val === 'boolean' ? (
                                      <motion.div initial={false} animate={{ scale: highlightedPlan === planId ? 1.15 : 1 }} transition={{ duration: 0.2 }}>
                                        {val ? (
                                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/40 dark:to-emerald-900/20 flex items-center justify-center shadow-sm border border-emerald-200 dark:border-emerald-800/40">
                                            <span className="material-symbols-outlined text-[16px] text-emerald-600 dark:text-emerald-400 font-bold">check_circle</span>
                                          </div>
                                        ) : (
                                          <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800/50 flex items-center justify-center shadow-sm border border-gray-200 dark:border-slate-700">
                                            <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-600">block</span>
                                          </div>
                                        )}
                                      </motion.div>
                                    ) : (
                                      <span className="text-sm font-google font-bold text-slate-900 dark:text-slate-100">{val}</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mobile Card View */}
              <div className="lg:hidden space-y-6">
                {COMPARISON_FEATURES.map(section => (
                  <div key={section.category} className="rounded-2xl border border-gray-200 dark:border-slate-800 overflow-hidden">
                    <div className="bg-slate-50 dark:bg-white/[0.02] border-b border-gray-200 dark:border-slate-800 px-5 py-3">
                      <h3 className="text-xs font-display font-bold uppercase tracking-widest text-slate-900 dark:text-slate-100">{section.category}</h3>
                    </div>

                    <div className="space-y-1">
                      {section.rows.map((row) => (
                        <motion.div key={row.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border-t border-gray-100 dark:border-slate-800/50 p-5">
                          {/* Feature Name with Help Icon */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1 pr-3">
                              <h4 className="text-sm font-google font-semibold text-slate-900 dark:text-slate-200 mb-1">{row.label}</h4>
                              <p className="text-xs font-google text-slate-600 dark:text-slate-400 leading-relaxed">{FEATURE_DESCRIPTIONS[row.label]}</p>
                            </div>
                            <span className="material-symbols-outlined text-[16px] text-blue-500 dark:text-blue-400 shrink-0">info</span>
                          </div>

                          {/* Plan Availability */}
                          <div className="grid grid-cols-2 gap-2">
                            {Array.from(selectedPlans).sort((a, b) => PLANS.findIndex(p => p.id === a) - PLANS.findIndex(p => p.id === b)).map(planId => {
                              const plan = PLANS.find(p => p.id === planId);
                              const val = row[planId.toLowerCase() as keyof typeof row] as string | boolean;

                              return (
                                <div key={planId} className="flex items-center gap-3 bg-slate-50 dark:bg-white/[0.02] rounded-lg p-3 border border-gray-100 dark:border-slate-800/50">
                                  <div className="flex-shrink-0">
                                    {typeof val === 'boolean' ? (
                                      val ? (
                                        <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                                          <span className="material-symbols-outlined text-[14px] text-emerald-600 dark:text-emerald-400">check_circle</span>
                                        </div>
                                      ) : (
                                        <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                          <span className="material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-600">block</span>
                                        </div>
                                      )
                                    ) : null}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-display font-bold text-slate-700 dark:text-slate-300 uppercase">{plan?.name}</p>
                                    {typeof val === 'string' && (
                                      <p className="text-xs font-google text-slate-600 dark:text-slate-400 truncate">{val}</p>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={tableInView ? { opacity: 1 } : {}} className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-700 py-16 flex flex-col items-center justify-center text-center">
              <span className="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-700 mb-4">compare_arrows</span>
              <p className="text-lg font-google text-slate-500 dark:text-slate-400 mb-2">Select at least one plan to compare</p>
              <p className="text-sm font-google text-slate-400 dark:text-slate-500">Click on plan names above to add them to the comparison</p>
            </motion.div>
          )}
        </div>
      </section>

      {/* FAQ SECTION */}
      <section ref={faqRef} className="relative py-20 overflow-hidden [clip-path:inset(0)]">
        <Image src="/que_vector.webp" alt="FAQ background" fill className="object-cover !fixed -z-10" />
        <div className="!fixed inset-0 bg-slate-950/85 z-0" />
        <div className="relative z-10 max-w-7xl mx-auto px-4 flex flex-col lg:flex-row gap-px ">
          <div className="lg:w-1/2 p-12 bg-white/5 backdrop-blur-sm border-r border-white/10">
            <div className="flex items-center gap-2 mb-4">
              <span className="material-symbols-outlined text-blue-400">help</span>
              <span className="text-[10px] font-google font-bold uppercase tracking-widest text-white">_03 FAQ</span>
            </div>
            <h2 className="text-4xl font-display font-black text-white mb-6">Questions answered.</h2>
            <a href="mailto:ayushsatvara2002@gmail.com" className="inline-flex px-8 py-4 bg-white text-slate-950 text-xs font-display font-bold uppercase tracking-widest transition-transform active:scale-95">Email Us</a>
          </div>
          <div className="lg:w-1/2 bg-white/5 backdrop-blur-sm">
            {FAQS.map((faq, i) => (
              <FaqItem key={faq.q} {...faq} isOpen={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
