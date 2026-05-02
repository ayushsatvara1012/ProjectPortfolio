'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Mail } from 'lucide-react';
import { 
  PRICE_MATRIX, 
  BASIC_COUPON, 
  CURRENCIES, 
  PLANS, 
  COMPARISON_FEATURES, 
  FAQS, 
  CheckMark, 
  CellValue, 
  FaqItem, 
  accentMap 
} from './components';

export default function PricingClient() {
  const [currency, setCurrency] = useState<'USD' | 'INR'>('USD');
  const [isDetecting, setIsDetecting] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

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

  const formatPrice = (val: number) =>
    val === 0
      ? 'Free'
      : new Intl.NumberFormat(CURRENCIES[currency].locale, {
        style: 'currency', currency,
        minimumFractionDigits: val % 1 === 0 ? 0 : 1,
      }).format(billingPeriod === 'annual' ? Math.round(val * 0.9) : val);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 overflow-x-hidden overflow-y-visible">

      {/* HERO SECTION */}
      <section ref={heroRef} className="relative min-h-[85vh] sm:min-h-[80vh] md:min-h-screen flex flex-col border-b border-gray-100 dark:border-slate-800 overflow-hidden [clip-path:inset(0)]">
        <Image src="/robo_nature.webp" alt="Hero background" fill className="object-cover object-top !fixed -z-10" priority />
        <div className="!fixed inset-0 bg-linear-to-b from-slate-950/70 via-slate-950/60 to-slate-950/90 sm:bg-linear-to-r sm:from-slate-950/85 sm:via-slate-950/70 sm:to-slate-950/30 z-0" />

        <div className="relative z-10 flex-1 flex flex-col justify-end sm:justify-center max-w-7xl mx-auto w-full px-4 pt-28 pb-12">
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
              <Link href="/dashboard/pricing" className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 text-xs font-display font-bold uppercase tracking-widest hover:opacity-90">
                Get Started Free <ArrowRight size={14} />
              </Link>
              <a href="mailto:ayushsatvara2002@gmail.com" className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/10 backdrop-blur-sm text-white px-8 py-4 text-xs font-display font-bold uppercase tracking-widest hover:bg-white/20">
                Talk to Sales <Mail size={14} />
              </a>
            </motion.div>
          </div>
        </div>

        <div className="relative z-10 w-full border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex overflow-x-auto gap-px bg-white/10 scrollbar-hide">
              {[
                { icon: 'smart_toy', label: 'LLM-Powered' },
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
      <section ref={cardsRef} className="py-20 bg-white dark:bg-slate-950">
        <div className="max-w-8xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[14px] text-blue-500">sell</span>
                <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-400">_01 Plans</span>
              </div>
              <h2 className="text-4xl font-display font-black text-slate-900 dark:text-slate-100 tracking-tight">Choose your plan.</h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
                {(['monthly', 'annual'] as const).map(p => (
                  <button key={p} onClick={() => setBillingPeriod(p)} className={`px-4 py-2 text-[11px] font-display font-bold uppercase tracking-widest transition-all ${billingPeriod === p ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                    {p === 'annual' ? 'Annual −10%' : 'Monthly'}
                  </button>
                ))}
              </div>
              {!isDetecting && (
                <div className="flex border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
                  {(['USD', 'INR'] as const).map(c => (
                    <button key={c} onClick={() => setCurrency(c)} className={`px-3 py-2 text-[11px] font-display font-bold uppercase tracking-widest transition-all ${currency === c ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400'}`}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mb-8 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 flex items-center gap-2 w-fit">
            <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[14px]">local_offer</span>
            <p className="text-[10px] font-display font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">
              Basic plan is $9/mo — use coupon <span className="bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 font-mono tracking-normal normal-case">{BASIC_COUPON}</span> at checkout for 100% off
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-gray-100 dark:bg-slate-800">
            {PLANS.map((plan, i) => {
              const a = accentMap[plan.accent as keyof typeof accentMap];
              const price = PRICE_MATRIX[plan.id as keyof typeof PRICE_MATRIX][currency];
              return (
                <motion.div key={plan.id} initial={{ opacity: 0, y: 16 }} animate={cardsInView ? { opacity: 1, y: 0 } : {}} transition={{ delay: i * 0.1 }} className={`bg-white dark:bg-slate-950 flex flex-col p-8 relative border-t-2 ${a.top} hover:bg-slate-50/60 dark:hover:bg-slate-900/60 transition-all`}>
                  {plan.badge && <div className={`absolute top-0 right-0 px-3 py-1 text-white text-[9px] uppercase tracking-widest font-display font-bold ${a.badge}`}>{plan.badge}</div>}
                  <div className={`w-10 h-10 flex items-center justify-center mb-5 ${a.icon}`}><span className="material-symbols-outlined text-[18px]">{plan.icon}</span></div>
                  <h3 className="text-lg font-display font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-1">{plan.name}</h3>
                  <p className="text-xs font-google text-slate-500 dark:text-slate-400 mb-5">{plan.description}</p>
                  <div className="mb-6">
                    {plan.id === 'BASIC' ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-display font-bold text-slate-400 line-through">{formatPrice(price)}/mo</span>
                        <span className="text-3xl font-display font-black text-emerald-600 dark:text-emerald-400">FREE</span>
                      </div>
                    ) : (
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-4xl font-display font-black text-slate-900 dark:text-slate-100">{formatPrice(price)}</span>
                        <span className="text-xs font-display text-slate-400 italic">/mo</span>
                      </div>
                    )}
                  </div>
                  <div className="space-y-2.5 flex-1 mb-6">
                    {plan.features.map(f => (
                      <div key={f} className="flex items-center gap-2.5">
                        <CheckMark /> <span className="text-sm font-google font-medium text-slate-600 dark:text-slate-400">{f}</span>
                      </div>
                    ))}
                  </div>
                  <Link href="/dashboard/pricing" className={`w-full py-4 text-xs font-display font-bold uppercase tracking-widest flex items-center justify-center gap-2 ${a.btn}`}>
                    {plan.id === 'BASIC' ? 'Start Free' : `Get ${plan.name}`} <ArrowRight size={12} />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURE COMPARISON */}
      <section ref={tableRef} className="py-20 bg-slate-50 dark:bg-slate-900 border-y border-gray-100 dark:border-slate-800">
        <div className="max-w-8xl mx-auto px-4">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={tableInView ? { opacity: 1, y: 0 } : {}} className="mb-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="material-symbols-outlined text-[14px] text-blue-500">compare_arrows</span>
              <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-400">_02 Compare</span>
            </div>
            <h2 className="text-4xl font-display font-black text-slate-900 dark:text-slate-100 tracking-tight">Feature comparison.</h2>
          </motion.div>

          <div className="overflow-x-auto">
            <div className="min-w-[800px]">
              <div className="grid grid-cols-5 gap-px bg-gray-200 dark:bg-slate-700">
                <div className="bg-slate-50 dark:bg-slate-900 p-4" />
                {PLANS.map(p => (
                  <div key={p.id} className={`${accentMap[p.accent as keyof typeof accentMap].colBg} p-4 border-t-2 ${accentMap[p.accent as keyof typeof accentMap].top}`}>
                    <p className="text-md font-display font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{p.name}</p>
                    <p className="text-lg font-display font-black text-slate-800 dark:text-slate-200 mt-1">{formatPrice(PRICE_MATRIX[p.id as keyof typeof PRICE_MATRIX][currency])}/mo</p>
                  </div>
                ))}
              </div>
              {COMPARISON_FEATURES.map(section => (
                <div key={section.category} className="mt-px">
                  <div className="bg-slate-100 dark:bg-slate-800 px-4 py-2.5">
                    <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-500">{section.category}</span>
                  </div>
                  {section.rows.map(row => (
                    <div key={row.label} className="grid grid-cols-5 gap-px bg-gray-200 dark:bg-slate-700">
                      <div className="bg-white dark:bg-slate-950 p-4 flex items-center">
                        <span className="text-sm font-google font-medium text-slate-600 dark:text-slate-400">{row.label}</span>
                      </div>
                      {PLANS.map(plan => (
                        <div key={plan.id} className={`${accentMap[plan.accent as keyof typeof accentMap].colBg} p-4 flex items-center justify-center`}>
                          <CellValue val={row[plan.id.toLowerCase() as keyof typeof row] as string | boolean} />
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
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
