import React, { useState, useEffect, useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, Zap, Rocket, Building2, Globe, Mail, ChevronDown } from 'lucide-react';
import SEO from '../components/Seo';

// ─── Data ────────────────────────────────────────────────────────────────────

const PRICE_MATRIX = {
  BASIC:    { USD: 9,  INR: 749 },
  STARTER:  { USD: 19, INR: 1599 },
  PRO:      { USD: 49, INR: 3999 },
  BUSINESS: { USD: 99, INR: 7999 },
};

const BASIC_COUPON = 'SAPYAI2026';

const CURRENCIES = {
  USD: { symbol: '$', label: 'USD', locale: 'en-US' },
  INR: { symbol: '₹', label: 'INR', locale: 'en-IN' },
};

const PLANS = [
  {
    id: 'BASIC',
    name: 'Basic',
    icon: 'bolt',
    LucideIcon: Zap,
    description: 'Start free. No credit card required.',
    badge: null,
    accent: 'slate',
    features: [
      '1 AI Bot',
      '500 messages / month',
      '100 knowledge chunks',
      'Standard response speed',
      'SaPyBase branding',
      'Basic analytics',
      'Community support',
    ],
  },
  {
    id: 'STARTER',
    name: 'Starter',
    icon: 'rocket_launch',
    LucideIcon: Rocket,
    description: 'For growing businesses deploying 2 bots.',
    badge: 'Most Popular',
    accent: 'blue',
    features: [
      '2 AI Bots',
      '2,000 messages / bot / month',
      '500 knowledge chunks per bot',
      'Priority response speed',
      'Custom branding & colors',
      'Lead capture (CRM-ready)',
      'Standard analytics',
      'Priority email support',
    ],
  },
  {
    id: 'PRO',
    name: 'Pro',
    icon: 'corporate_fare',
    LucideIcon: Building2,
    description: 'Scale to 5 bots with full white-label.',
    badge: null,
    accent: 'indigo',
    features: [
      '5 AI Bots',
      '5,000 messages / bot / month',
      '2,000 knowledge chunks per bot',
      'Dedicated response speed',
      'Full white-label',
      'Webhooks & Zapier',
      'Advanced analytics & exports',
      'Lead capture (full CRM)',
      'SLA & dedicated support',
    ],
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    icon: 'domain',
    LucideIcon: Globe,
    description: 'Full platform for high-growth teams & enterprises.',
    badge: 'Full Platform',
    accent: 'emerald',
    features: [
      '15 AI Bots',
      '15,000 messages / bot / month',
      '10,000 knowledge chunks per bot',
      'Ultra response speed',
      'Full white-label',
      'Human handoff (transcript + URL)',
      'Full CRM lead capture',
      'Webhooks & Zapier',
      'Full analytics & ROI reports',
      'Dedicated SLA support',
    ],
  },
];

// Full feature comparison table rows
const COMPARISON_FEATURES = [
  { category: 'Bots & Capacity', rows: [
    { label: 'AI Bots', basic: '1', starter: '2', pro: '5', business: '15' },
    { label: 'Messages / bot / month', basic: '500', starter: '2,000', pro: '5,000', business: '15,000' },
    { label: 'Knowledge chunks / bot', basic: '100', starter: '500', pro: '2,000', business: '10,000' },
    { label: 'Response speed', basic: 'Standard', starter: 'Priority', pro: 'Dedicated', business: 'Ultra' },
  ]},
  { category: 'Branding & Customization', rows: [
    { label: 'Custom branding & colors', basic: false, starter: true, pro: true, business: true },
    { label: 'White-label (remove SaPyBase)', basic: false, starter: false, pro: true, business: true },
    { label: 'Human handoff', basic: false, starter: false, pro: false, business: true },
  ]},
  { category: 'Integrations', rows: [
    { label: 'Lead capture / CRM', basic: false, starter: 'Basic', pro: 'Full CRM', business: 'Full CRM' },
    { label: 'Webhooks & Zapier', basic: false, starter: false, pro: true, business: true },
    { label: 'Analytics & exports', basic: 'Basic', starter: 'Standard', pro: 'Advanced + CSV', business: 'Full + ROI' },
  ]},
  { category: 'Support & SLA', rows: [
    { label: 'Support channel', basic: 'Community', starter: 'Priority email', pro: 'SLA email', business: 'Dedicated SLA' },
    { label: 'Onboarding call', basic: false, starter: false, pro: false, business: true },
    { label: 'Guaranteed uptime SLA', basic: false, starter: false, pro: true, business: true },
  ]},
];

// ─── Sub-components ──────────────────────────────────────────────────────────

const CheckMark = () => (
  <div className="w-4 h-4 rounded-none bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
    <span className="material-symbols-outlined text-[10px] text-blue-500 dark:text-blue-400">check</span>
  </div>
);

const XMark = () => (
  <div className="w-4 h-4 rounded-none bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
    <span className="material-symbols-outlined text-[10px] text-slate-300 dark:text-slate-600">remove</span>
  </div>
);

const CellValue = ({ val }) => {
  if (val === true) return <CheckMark />;
  if (val === false) return <XMark />;
  return <span className="text-sm font-google font-semibold text-slate-700 dark:text-slate-300">{val}</span>;
};

// ─── FAQ data ────────────────────────────────────────────────────────────────

const FAQS = [
  { q: 'Can I switch plans at any time?', a: 'Yes. Upgrades take effect immediately. Downgrades take effect at the end of your current billing cycle.' },
  { q: 'Is the Basic plan really free ?', a: 'Yes — Basic is free using the coupon code SAPYAI2026 at checkout with no credit card required. We may add new features to paid plans but will never remove Basic features.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit/debit cards and UPI (India) via our Polar checkout. Invoices available for Business plans.' },
  { q: 'What are "knowledge chunks"?', a: 'Knowledge chunks are the units of text (approximately 512 tokens each) your bot stores from your documents, URLs, or FAQs. More chunks = richer, more accurate answers.' },
  { q: 'Do you offer annual billing?', a: 'Annual billing with a 10% discount is available on Starter, Pro, and Business. Contact us to set it up.' },
  { q: 'What is human handoff?', a: 'Human handoff lets your bot transfer a conversation to a live agent — passing the full transcript and optionally redirecting to a support URL you configure.' },
];

const FaqItem = ({ q, a, isOpen, onToggle }) => (
  <div className="border-b border-white/10 last:border-b-0">
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between px-6 py-5 text-left gap-4 group hover:bg-white/10 transition-colors duration-300"
    >
      <span className="text-sm font-display font-bold text-white group-hover:text-blue-300 transition-colors">{q}</span>
      <ChevronDown size={14} className={`shrink-0 text-white/50 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
    </button>
    <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40' : 'max-h-0'}`}>
      <p className="px-6 pb-5 text-sm font-google text-white/70 leading-relaxed">{a}</p>
    </div>
  </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────

const PricingPage = () => {
  const [currency, setCurrency] = useState('USD');
  const [isDetecting, setIsDetecting] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState('monthly');
  const [openFaq, setOpenFaq] = useState(0);

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

  const formatPrice = (val) =>
    val === 0
      ? 'Free'
      : new Intl.NumberFormat(CURRENCIES[currency].locale, {
          style: 'currency', currency,
          minimumFractionDigits: val % 1 === 0 ? 0 : 1,
        }).format(billingPeriod === 'annual' ? Math.round(val * 0.9) : val);

  const accentMap = {
    slate:   { border: 'border-slate-200 dark:border-slate-700', top: 'border-t-slate-400', icon: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400', badge: '', btn: 'border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900', colBg: 'bg-slate-50/60 dark:bg-slate-800/20' },
    blue:    { border: 'border-blue-200 dark:border-blue-800', top: 'border-t-blue-500', icon: 'bg-gradient-to-br from-blue-600 to-green-600 text-white shadow-lg shadow-blue-500/20', badge: 'bg-gradient-to-r from-blue-600 to-green-600', btn: 'bg-gradient-to-r from-blue-600 to-green-600 text-white hover:opacity-90 shadow-lg shadow-blue-500/10', colBg: 'bg-blue-50/60 dark:bg-blue-900/15' },
    indigo:  { border: 'border-indigo-200 dark:border-indigo-800', top: 'border-t-indigo-500', icon: 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20', badge: 'bg-gradient-to-r from-indigo-600 to-blue-600', btn: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-90 shadow-lg shadow-indigo-500/10', colBg: 'bg-indigo-50/60 dark:bg-indigo-900/15' },
    emerald: { border: 'border-emerald-200 dark:border-emerald-800', top: 'border-t-emerald-500', icon: 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20', badge: 'bg-gradient-to-r from-emerald-600 to-teal-600', btn: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 shadow-lg shadow-emerald-500/10', colBg: 'bg-emerald-50/60 dark:bg-emerald-900/15' },
  };

  return (
    <>
      <SEO
        title="Pricing — SaPyBase AI Chatbot Plans"
        description="Compare SaPyBase AI chatbot plans. Start free, scale to Business. Transparent pricing, no hidden fees."
        canonical="https://www.sapybase.com/pricing"
      />

      <div className="min-h-screen bg-white dark:bg-slate-950 transition-colors duration-500 overflow-x-hidden">

        {/* ── HERO ─────────────────────────────────────────────────────── */}
        <section
          ref={heroRef}
          className="relative min-h-[85vh] sm:min-h-[80vh] md:min-h-screen flex flex-col border-b border-gray-100 dark:border-slate-800 overflow-hidden"
          style={{
            backgroundImage: 'url(/robo_nature.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top',
            backgroundRepeat: 'no-repeat',
          }}
        >
          {/* Scrim — dark gradient over the image, heavier at bottom so text is always readable */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/60 to-slate-950/90 sm:bg-gradient-to-r sm:from-slate-950/85 sm:via-slate-950/70 sm:to-slate-950/30" />

          {/* Content — sits above the scrim */}
          <div className="relative z-10 flex-1 flex flex-col justify-end sm:justify-center max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pt-28 pb-12 sm:py-20 lg:py-28">
            <div className="max-w-xl lg:max-w-2xl">

              {/* Eyebrow */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-2 mb-5"
              >
                <span className="material-symbols-outlined text-[14px] text-blue-400">auto_awesome</span>
                <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-300/80">AI Chatbot Pricing</span>
              </motion.div>

              {/* Headline */}
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.08 }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-black text-white leading-[1.04] tracking-tight mb-5"
              >
                Plans built for<br className="hidden sm:block" /> every&nbsp;
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-green-400">
                  stage of growth.
                </span>
              </motion.h1>

              {/* Sub-copy */}
              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.18 }}
                className="text-sm sm:text-base md:text-lg font-google text-slate-300 leading-relaxed mb-8 max-w-lg"
              >
                Deploy a production-ready AI chatbot in minutes. Start free, upgrade as you grow — transparent pricing with no hidden fees.
              </motion.p>

              {/* Stats strip */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.28 }}
                className="grid grid-cols-3 gap-px bg-white/10 mb-8 w-full max-w-sm"
              >
                {[
                  { label: 'Plans', value: '4+' },
                  { label: 'Setup time', value: '< 5 min' },
                  { label: 'Uptime', value: '99.9%' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-950/50 backdrop-blur-sm px-4 py-3.5">
                    <div className="text-xl sm:text-2xl font-display font-black text-white">{s.value}</div>
                    <div className="text-[9px] uppercase tracking-widest font-display font-bold text-slate-400 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </motion.div>

              {/* CTA row */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={heroInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.36 }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <Link
                  to="/app/pricing"
                  className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 text-xs font-display font-bold uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98]"
                >
                  Get Started Free
                  <ArrowRight size={14} />
                </Link>
                <a
                  href="mailto:ayushsatvara2002@gmail.com?subject=Custom%20Plan%20Inquiry"
                  className="inline-flex items-center justify-center gap-2 border border-white/20 bg-white/10 backdrop-blur-sm text-white px-8 py-4 text-xs font-display font-bold uppercase tracking-widest hover:bg-white/20 transition-all"
                >
                  Talk to Sales
                  <Mail size={14} />
                </a>
              </motion.div>
            </div>
          </div>

          {/* Feature pills — anchored to bottom on all screens */}
          <div className="relative z-10 w-full border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex overflow-x-auto gap-px bg-white/10 scrollbar-hide">
                {[
                  { icon: 'smart_toy', label: 'LLM-Powered' },
                  { icon: 'database', label: 'RAG Knowledge' },
                  { icon: 'contact_mail', label: 'Lead Capture' },
                  { icon: 'analytics', label: 'Analytics' },
                  { icon: 'webhook', label: 'Webhooks' },
                  { icon: 'branding_watermark', label: 'White-Label' },
                ].map((f, i) => (
                  <motion.div
                    key={f.label}
                    initial={{ opacity: 0, y: 8 }}
                    animate={heroInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: 0.45 + i * 0.05 }}
                    className="flex items-center gap-2 bg-slate-950/60 backdrop-blur-sm px-4 sm:px-5 py-3.5 shrink-0"
                  >
                    <span className="material-symbols-outlined text-[13px] text-blue-400">{f.icon}</span>
                    <span className="text-[10px] font-display font-bold uppercase tracking-widest text-slate-300 whitespace-nowrap">{f.label}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── PLAN CARDS ───────────────────────────────────────────────── */}
        <section ref={cardsRef} className="py-16 md:py-24 bg-white dark:bg-slate-950 transition-colors duration-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

            {/* Section header + controls */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 mb-10">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[14px] text-blue-500">sell</span>
                  <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-400 dark:text-slate-500">_01 Plans</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-display font-black text-slate-900 dark:text-slate-100 tracking-tight">
                  Choose your plan.
                </h2>
              </div>

              {/* Controls row */}
              <div className="flex flex-wrap items-center gap-3">
                {/* Billing toggle */}
                <div className="flex border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                  {['monthly', 'annual'].map(p => (
                    <button key={p} onClick={() => setBillingPeriod(p)}
                      className={`px-4 py-2 text-[11px] font-display font-bold uppercase tracking-widest transition-all ${billingPeriod === p ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                      {p === 'annual' ? 'Annual −10%' : 'Monthly'}
                    </button>
                  ))}
                </div>

                {/* Currency toggle */}
                {!isDetecting && (
                  <div className="flex border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
                    {Object.keys(CURRENCIES).map(c => (
                      <button key={c} onClick={() => setCurrency(c)}
                        className={`px-3 py-2 text-[11px] font-display font-bold uppercase tracking-widest transition-all ${currency === c ? 'bg-slate-900 dark:bg-blue-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900'}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Coupon notice */}
            <div className="mb-8 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/20 border-l-4 border-emerald-500 flex items-center gap-2 w-fit">
              <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400 text-[14px]">local_offer</span>
              <p className="text-[10px] font-display font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-widest">
                Basic plan is $9/mo — use coupon <span className="bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 font-mono tracking-normal normal-case">SAPYAI2026</span> at checkout for 100% off
              </p>
            </div>

            {/* Cards grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-px bg-gray-100 dark:bg-slate-800">
              {PLANS.map((plan, i) => {
                const a = accentMap[plan.accent];
                const price = PRICE_MATRIX[plan.id][currency];
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={cardsInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className={`bg-white dark:bg-slate-950 flex flex-col p-6 md:p-8 relative border-t-2 ${a.top} transition-colors duration-500 group/card hover:bg-slate-50/60 dark:hover:bg-slate-900/60`}
                  >
                    {/* Badge */}
                    {plan.badge && (
                      <div className={`absolute top-0 right-0 px-3 py-1 text-white text-[9px] uppercase tracking-widest font-display font-bold ${a.badge}`}>
                        {plan.badge}
                      </div>
                    )}

                    {/* Icon */}
                    <div className={`w-10 h-10 border border-transparent flex items-center justify-center mb-5 shrink-0 ${a.icon}`}>
                      <span className="material-symbols-outlined text-[18px]">{plan.icon}</span>
                    </div>

                    {/* Name */}
                    <h3 className="text-lg font-display font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-1">{plan.name}</h3>
                    <p className="text-xs font-google text-slate-500 dark:text-slate-400 leading-snug mb-5">{plan.description}</p>

                    {/* Price */}
                    <div className="mb-6">
                      {plan.id === 'BASIC' ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-display font-bold tracking-tight text-slate-400 dark:text-slate-500 line-through">
                              {formatPrice(price)}/mo
                            </span>
                            <span className="text-3xl font-display font-black tracking-tight text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-3 py-0.5 border-l-4 border-emerald-500">
                              FREE
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="material-symbols-outlined text-[11px] text-emerald-600 dark:text-emerald-400">local_offer</span>
                            <span className="text-[9px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1.5 py-0.5 tracking-normal">{BASIC_COUPON}</span>
                            <span className="text-[9px] uppercase tracking-widest font-display font-bold text-emerald-600 dark:text-emerald-400">100% off at checkout</span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-4xl font-display font-black tracking-tight text-slate-900 dark:text-slate-100">
                            {formatPrice(price)}
                          </span>
                          <span className="text-xs font-display text-slate-400 dark:text-slate-500 italic">/mo</span>
                        </div>
                      )}
                      {billingPeriod === 'annual' && plan.id !== 'BASIC' && (
                        <p className="text-[10px] font-display font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mt-1">10% annual discount applied</p>
                      )}
                      {plan.id !== 'BASIC' && (
                        <p className="text-[9px] font-google font-medium text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">Local taxes handled at checkout</p>
                      )}
                    </div>

                    {/* Features */}
                    <div className="space-y-2.5 flex-1 mb-6">
                      {plan.features.map(f => (
                        <div key={f} className="flex items-center gap-2.5">
                          <CheckMark />
                          <span className="text-sm font-google font-medium text-slate-600 dark:text-slate-400">{f}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    <Link
                      to="/app/pricing"
                      className={`w-full py-3.5 min-h-[44px] text-xs font-display font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${a.btn}`}
                    >
                      {plan.id === 'BASIC' ? 'Start Free' : `Get ${plan.name}`}
                      <ArrowRight size={12} />
                    </Link>
                  </motion.div>
                );
              })}
            </div>

            {/* Custom / Agency banner */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={cardsInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="mt-px bg-white dark:bg-slate-950 border-t-2 border-blue-500 transition-colors duration-500"
            >
              <div className="flex w-fit px-3 py-1 bg-gradient-to-r from-blue-600 to-teal-600 text-white text-[9px] uppercase tracking-widest font-display font-bold">
                For Agencies
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-100 dark:bg-slate-800">
                <div className="bg-white dark:bg-slate-950 p-6 md:p-8 transition-colors duration-500">
                  <div className="w-10 h-10 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-4">
                    <span className="material-symbols-outlined text-[18px] text-blue-600 dark:text-blue-400">build</span>
                  </div>
                  <h3 className="text-lg font-display font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight mb-2">Custom</h3>
                  <span className="text-2xl font-display font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-0.5 border-l-4 border-blue-500 inline-block mb-3">Let's Talk</span>
                  <p className="text-xs font-google text-slate-500 dark:text-slate-400 leading-relaxed">
                    Built for agencies, resellers, and high-growth teams. Fully configured via admin panel — any bot count, any message quota, any model.
                  </p>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 p-6 md:p-8 transition-colors duration-500">
                  <p className="text-[9px] uppercase tracking-widest font-display font-bold text-slate-400 dark:text-slate-500 mb-4">Configurable add-ons</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { icon: 'smart_toy', label: 'Custom bot count' },
                      { icon: 'forum', label: 'Custom message quota' },
                      { icon: 'storage', label: 'Knowledge chunks' },
                      { icon: 'auto_awesome', label: 'Gemini model choice' },
                      { icon: 'support_agent', label: 'Human handoff' },
                      { icon: 'branding_watermark', label: 'White label' },
                    ].map(f => (
                      <div key={f.label} className="flex items-center gap-2">
                        <div className="w-5 h-5 shrink-0 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[11px] text-blue-600 dark:text-blue-400">{f.icon}</span>
                        </div>
                        <span className="text-xs font-google font-bold text-slate-700 dark:text-slate-300">{f.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-950 p-6 md:p-8 flex flex-col gap-4 transition-colors duration-500">
                  <div className="space-y-2 flex-1">
                    {['Dedicated onboarding call', 'SLA & priority support', 'Monthly or annual billing', 'Admin-managed config changes', 'Analytics & ROI reports'].map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <CheckMark />
                        <span className="text-xs font-google font-semibold text-slate-600 dark:text-slate-400">{f}</span>
                      </div>
                    ))}
                  </div>
                  <a
                    href="mailto:ayushsatvara2002@gmail.com?subject=Custom%20Plan%20Enquiry&body=Hi%20Ayush%2C%0A%0AI'm%20interested%20in%20a%20custom%20plan.%0A%0AOrganisation%3A%0AExpected%20bots%3A%0AKey%20features%20needed%3A%0A"
                    className="w-full py-3.5 text-xs font-display font-bold uppercase tracking-widest transition-all bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[14px]">mail</span>
                    Contact Us
                  </a>
                  <p className="text-[9px] font-google text-slate-400 dark:text-slate-500 text-center">Reply within 24 hours · No contracts required</p>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── FEATURE COMPARISON TABLE ─────────────────────────────────── */}
        <section ref={tableRef} className="py-16 md:py-24 bg-slate-50 dark:bg-slate-900 border-y border-gray-100 dark:border-slate-800 transition-colors duration-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={tableInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.6 }}
              className="mb-10"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[14px] text-blue-500">compare_arrows</span>
                <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-400 dark:text-slate-500">_02 Compare</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-display font-black text-slate-900 dark:text-slate-100 tracking-tight">
                Feature comparison.
              </h2>
            </motion.div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={tableInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.6, delay: 0.15 }}
                className="min-w-[640px]"
              >
                {/* Table header */}
                <div className="grid grid-cols-5 gap-px bg-gray-200 dark:bg-slate-700 mb-px">
                  <div className="bg-slate-50 dark:bg-slate-900 px-4 py-4 transition-colors duration-500" />
                  {PLANS.map(p => (
                    <div key={p.id} className={`${accentMap[p.accent].colBg} px-4 py-4 border-t-2 ${accentMap[p.accent].top} transition-colors duration-500`}>
                      <p className="text-md font-display font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{p.name}</p>
                      {p.id === 'BASIC' ? (
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-display text-slate-400 dark:text-slate-500 line-through">{formatPrice(PRICE_MATRIX.BASIC[currency])}/mo</span>
                            <span className="text-lg font-display font-black text-emerald-600 dark:text-emerald-400">FREE</span>
                          </div>
                          <span className="text-[8px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1 py-0.5 w-fit tracking-normal">{BASIC_COUPON}</span>
                        </div>
                      ) : (
                        <p className="text-lg font-display font-black text-slate-800 dark:text-slate-200 mt-0.5">
                          {formatPrice(PRICE_MATRIX[p.id][currency])}
                          <span className="text-xs font-display text-slate-400 dark:text-slate-500 font-normal ml-0.5">/mo</span>
                        </p>
                      )}
                    </div>
                  ))}
                </div>

                {COMPARISON_FEATURES.map((section, si) => (
                  <div key={section.category} className="mb-px">
                    {/* Category header */}
                    <div className="grid grid-cols-5 gap-px bg-gray-200 dark:bg-slate-700">
                      <div className="col-span-5 bg-slate-100 dark:bg-slate-800 px-4 py-2.5 transition-colors duration-500">
                        <span className="text-md uppercase tracking-widest font-display font-bold text-slate-500 dark:text-slate-400">{section.category}</span>
                      </div>
                    </div>
                    {/* Rows */}
                    {section.rows.map((row, ri) => (
                      <motion.div
                        key={row.label}
                        initial={{ opacity: 0 }}
                        animate={tableInView ? { opacity: 1 } : {}}
                        transition={{ duration: 0.3, delay: 0.3 + si * 0.1 + ri * 0.04 }}
                        className="grid grid-cols-5 gap-px bg-gray-200 dark:bg-slate-700"
                      >
                        <div className="bg-white dark:bg-slate-950 px-4 py-3.5 flex items-center transition-colors duration-500">
                          <span className="text-md font-google font-semibold text-slate-600 dark:text-slate-400">{row.label}</span>
                        </div>
                        {PLANS.map((plan, ci) => (
                          <div key={ci} className={`${accentMap[plan.accent].colBg} px-4 py-3.5 flex items-center justify-center transition-colors duration-500`}>
                            <CellValue val={row[plan.id.toLowerCase()]} />
                          </div>
                        ))}
                      </motion.div>
                    ))}
                  </div>
                ))}
              </motion.div>
            </div>

            {/* Mobile: stacked plan cards for comparison */}
            <div className="md:hidden space-y-6">
              {PLANS.map((plan, i) => {
                const a = accentMap[plan.accent];
                return (
                  <motion.div
                    key={plan.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={tableInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ duration: 0.4, delay: i * 0.08 }}
                    className={`bg-white dark:bg-slate-950 border-t-2 ${a.top} transition-colors duration-500`}
                  >
                    <div className="px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-md font-display font-black uppercase tracking-tight text-slate-900 dark:text-slate-100">{plan.name}</span>
                      {plan.id === 'BASIC' ? (
                        <div className="flex flex-col items-end gap-0.5">
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-xs font-display text-slate-400 dark:text-slate-500 line-through">{formatPrice(PRICE_MATRIX.BASIC[currency])}/mo</span>
                            <span className="text-md font-display font-black text-emerald-600 dark:text-emerald-400">FREE</span>
                          </div>
                          <span className="text-[8px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 px-1 py-0.5 tracking-normal">{BASIC_COUPON}</span>
                        </div>
                      ) : (
                        <span className="text-md font-display font-bold text-slate-700 dark:text-slate-300">
                          {`${formatPrice(PRICE_MATRIX[plan.id][currency])}/mo`}
                        </span>
                      )}
                    </div>
                    {COMPARISON_FEATURES.map(section =>
                      section.rows.map(row => {
                        const val = row[plan.id.toLowerCase()];
                        return (
                          <div key={row.label} className="flex items-center justify-between px-5 py-3 border-b border-gray-50 dark:border-slate-800/60">
                            <span className="text-xs font-display font-semibold text-slate-500 dark:text-slate-400">{row.label}</span>
                            <CellValue val={val} />
                          </div>
                        );
                      })
                    )}
                    <div className="p-4">
                      <Link to="/app/pricing" className={`w-full py-3 text-xs font-display font-bold uppercase tracking-widest flex items-center justify-center gap-2 active:scale-[0.98] transition-all ${a.btn}`}>
                        {plan.id === 'BASIC' ? 'Start Free' : `Get ${plan.name}`}
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section
          ref={faqRef}
          className="relative"
          style={{
            backgroundImage: 'url(/que_vector.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center center',
            backgroundRepeat: 'no-repeat',
            backgroundAttachment: 'fixed',
          }}
        >
          {/* Scrim pinned to section, not content */}
          <div className="absolute inset-0 bg-linear-to-b from-slate-900/85 via-slate-900/80 to-slate-900/92 pointer-events-none" />

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
            <div className="flex flex-col lg:flex-row gap-px items-stretch">

              {/* Left panel — stretches to match right column height */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={faqInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5 }}
                className="lg:w-1/2 shrink-0 bg-white/5 backdrop-blur-sm border border-white/10 p-8 md:p-12 flex flex-col justify-between gap-8"
              >
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[14px] text-blue-400">help</span>
                    <span className="text-[10px] uppercase tracking-widest font-display font-bold text-white/50">_03 FAQ</span>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight mb-4">
                    Questions answered.
                  </h2>
                  <p className="text-sm font-google text-white/60 leading-relaxed">
                    Can't find what you're looking for? Reach out directly and we'll respond within 24 hours.
                  </p>
                </div>
                <div className="space-y-3">
                  <a
                    href="mailto:ayushsatvara2002@gmail.com?subject=Pricing%20Question"
                    className="inline-flex items-center gap-2 bg-white text-slate-900 px-6 py-3.5 text-xs font-display font-bold uppercase tracking-widest hover:opacity-90 transition-all"
                  >
                    <span className="material-symbols-outlined text-[14px]">mail</span>
                    Email Us
                  </a>
                  <p className="text-[10px] font-display font-bold text-white/40 uppercase tracking-widest">
                    Reply within 24 hours guaranteed
                  </p>
                </div>
              </motion.div>

              {/* Right panel — expands freely, left panel and bg are unaffected */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={faqInView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.15 }}
                className="lg:w-1/2 shrink-0 self-start bg-white/5 backdrop-blur-sm border border-white/10 border-l-0 lg:border-l-0"
              >
                {FAQS.map((faq, i) => (
                  <FaqItem
                    key={faq.q}
                    {...faq}
                    isOpen={openFaq === i}
                    onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                  />
                ))}
              </motion.div>

            </div>
          </div>
        </section>

        {/* ── BOTTOM CTA ───────────────────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-slate-950 dark:bg-slate-900 transition-colors duration-500">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-800">
              <div className="bg-slate-950 dark:bg-slate-900 p-8 md:p-12 flex flex-col justify-center transition-colors duration-500">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-[14px] text-emerald-400">verified</span>
                  <span className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-500">Start today</span>
                </div>
                <h2 className="text-3xl sm:text-4xl font-display font-black text-white tracking-tight mb-4">
                  Deploy your first AI bot<br />in under 5 minutes.
                </h2>
                <p className="text-sm font-google text-slate-400 leading-relaxed mb-6 max-w-sm">
                  No credit card required to start. Upgrade whenever you're ready. Cancel anytime.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Link
                    to="/app/pricing"
                    className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 text-xs font-display font-bold uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98]"
                  >
                    Get Started Free
                    <ArrowRight size={14} />
                  </Link>
                  <Link
                    to="/demo/bots"
                    className="inline-flex items-center justify-center gap-2 border border-slate-700 text-slate-300 px-8 py-4 text-xs font-display font-bold uppercase tracking-widest hover:bg-slate-800 transition-all"
                  >
                    Try Demo
                    <span className="material-symbols-outlined text-[14px]">play_arrow</span>
                  </Link>
                </div>
              </div>

              <div className="bg-slate-900 p-8 md:p-12 grid grid-cols-2 gap-px bg-opacity-100 transition-colors duration-500">
                {[
                  { label: 'Active Bots', value: '500+', icon: 'smart_toy' },
                  { label: 'Messages / month', value: '2M+', icon: 'forum' },
                  { label: 'Avg. setup time', value: '4 min', icon: 'schedule' },
                  { label: 'Customer rating', value: '4.9 / 5', icon: 'star' },
                ].map(s => (
                  <div key={s.label} className="bg-slate-950 dark:bg-slate-900 p-6 flex flex-col gap-2 transition-colors duration-500">
                    <span className="material-symbols-outlined text-[18px] text-slate-500">{s.icon}</span>
                    <div className="text-2xl font-display font-black text-white">{s.value}</div>
                    <div className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-500">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

      </div>
    </>
  );
};

export default PricingPage;
