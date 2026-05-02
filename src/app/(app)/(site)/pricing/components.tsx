import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Zap, Rocket, Building2, Globe } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   DATA
 ───────────────────────────────────────────────────────────────────────────── */

export const PRICE_MATRIX = {
  BASIC: { USD: 9, INR: 749 },
  STARTER: { USD: 19, INR: 1599 },
  PRO: { USD: 49, INR: 3999 },
  BUSINESS: { USD: 99, INR: 7999 },
};

export const BASIC_COUPON = 'SAPYAI2026';

export const CURRENCIES = {
  USD: { symbol: '$', label: 'USD', locale: 'en-US' },
  INR: { symbol: '₹', label: 'INR', locale: 'en-IN' },
};

export const PLANS = [
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
      'Sapybase branding',
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

export const COMPARISON_FEATURES = [
  {
    category: 'Bots & Capacity', rows: [
      { label: 'AI Bots', basic: '1', starter: '2', pro: '5', business: '15' },
      { label: 'Messages / bot / month', basic: '500', starter: '2,000', pro: '5,000', business: '15,000' },
      { label: 'Knowledge chunks / bot', basic: '100', starter: '500', pro: '2,000', business: '10,000' },
      { label: 'Response speed', basic: 'Standard', starter: 'Priority', pro: 'Dedicated', business: 'Ultra' },
    ]
  },
  {
    category: 'Branding & Customization', rows: [
      { label: 'Custom branding & colors', basic: false, starter: true, pro: true, business: true },
      { label: 'White-label (remove Sapybase)', basic: false, starter: false, pro: true, business: true },
      { label: 'Human handoff', basic: false, starter: false, pro: false, business: true },
    ]
  },
  {
    category: 'Integrations', rows: [
      { label: 'Lead capture / CRM', basic: false, starter: 'Basic', pro: 'Full CRM', business: 'Full CRM' },
      { label: 'Webhooks & Zapier', basic: false, starter: false, pro: true, business: true },
      { label: 'Analytics & exports', basic: 'Basic', starter: 'Standard', pro: 'Advanced + CSV', business: 'Full + ROI' },
    ]
  },
  {
    category: 'Support & SLA', rows: [
      { label: 'Support channel', basic: 'Community', starter: 'Priority email', pro: 'SLA email', business: 'Dedicated SLA' },
      { label: 'Onboarding call', basic: false, starter: false, pro: false, business: true },
      { label: 'Guaranteed uptime SLA', basic: false, starter: false, pro: true, business: true },
    ]
  },
];

export const FAQS = [
  { q: 'Can I switch plans at any time?', a: 'Yes. Upgrades take effect immediately. Downgrades take effect at the end of your current billing cycle.' },
  { q: 'Is the Basic plan really free ?', a: 'Yes — Basic is free using the coupon code SAPYAI2026 at checkout with no credit card required. We may add new features to paid plans but will never remove Basic features.' },
  { q: 'What payment methods do you accept?', a: 'We accept all major credit/debit cards and UPI (India) via our Polar checkout. Invoices available for Business plans.' },
  { q: 'What are "knowledge chunks"?', a: 'Knowledge chunks are the units of text (approximately 512 tokens each) your bot stores from your documents, URLs, or FAQs. More chunks = richer, more accurate answers.' },
  { q: 'Do you offer annual billing?', a: 'Annual billing with a 10% discount is available on Starter, Pro, and Business. Contact us to set it up.' },
  { q: 'What is human handoff?', a: 'Human handoff lets your bot transfer a conversation to a live agent — passing the full transcript and optionally redirecting to a support URL you configure.' },
];

/* ─────────────────────────────────────────────────────────────────────────────
   UI ATOMS
 ───────────────────────────────────────────────────────────────────────────── */

export const CheckMark = () => (
  <div className="w-4 h-4 rounded-none bg-blue-50 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
    <span className="material-symbols-outlined text-[10px] text-blue-500 dark:text-blue-400">check</span>
  </div>
);

export const XMark = () => (
  <div className="w-4 h-4 rounded-none bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
    <span className="material-symbols-outlined text-[10px] text-slate-300 dark:text-slate-600">remove</span>
  </div>
);

export const CellValue = ({ val }: { val: string | boolean }) => {
  if (val === true) return <CheckMark />;
  if (val === false) return <XMark />;
  return <span className="text-sm font-google font-semibold text-slate-700 dark:text-slate-300">{val}</span>;
};

export const FaqItem = ({ q, a, isOpen, onToggle }: { q: string; a: string; isOpen: boolean; onToggle: () => void }) => (
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

export const accentMap = {
  slate: { border: 'border-slate-200 dark:border-slate-700', top: 'border-t-slate-400', icon: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400', badge: '', btn: 'border border-gray-200 dark:border-slate-700 text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900', colBg: 'bg-slate-50/60 dark:bg-slate-800/20' },
  blue: { border: 'border-blue-200 dark:border-blue-800', top: 'border-t-blue-500', icon: 'bg-gradient-to-br from-blue-600 to-green-600 text-white shadow-lg shadow-blue-500/20', badge: 'bg-gradient-to-r from-blue-600 to-green-600', btn: 'bg-gradient-to-r from-blue-600 to-green-600 text-white hover:opacity-90 shadow-lg shadow-blue-500/10', colBg: 'bg-blue-50/60 dark:bg-blue-900/15' },
  indigo: { border: 'border-indigo-200 dark:border-indigo-800', top: 'border-t-indigo-500', icon: 'bg-gradient-to-br from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20', badge: 'bg-gradient-to-r from-indigo-600 to-blue-600', btn: 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:opacity-90 shadow-lg shadow-indigo-500/10', colBg: 'bg-indigo-50/60 dark:bg-indigo-900/15' },
  emerald: { border: 'border-emerald-200 dark:border-emerald-800', top: 'border-t-emerald-500', icon: 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/20', badge: 'bg-gradient-to-r from-emerald-600 to-teal-600', btn: 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-90 shadow-lg shadow-emerald-500/10', colBg: 'bg-emerald-50/60 dark:bg-emerald-900/15' },
};

import { ArrowRight } from 'lucide-react';

export const BottomCTA = () => (
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
              href="/dashboard/pricing"
              className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-green-600 text-white px-8 py-4 text-xs font-display font-bold uppercase tracking-widest hover:opacity-90 transition-all active:scale-[0.98]"
            >
              Get Started Free
              <ArrowRight size={14} />
            </Link>
            <Link
              href="/demo/bots"
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
            { label: 'Uptime', value: '99.9%', icon: 'bolt' },
            { label: 'Regions', value: 'Global', icon: 'public' },
          ].map(s => (
            <div key={s.label} className="bg-slate-950/40 p-6 flex flex-col gap-2">
              <span className="material-symbols-outlined text-blue-400 text-[20px]">{s.icon}</span>
              <div className="text-2xl font-display font-black text-white">{s.value}</div>
              <div className="text-[10px] uppercase tracking-widest font-display font-bold text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
