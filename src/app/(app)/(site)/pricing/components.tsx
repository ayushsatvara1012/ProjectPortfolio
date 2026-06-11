import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown, Rocket, Building2, Globe } from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────────────────
   DATA
 ───────────────────────────────────────────────────────────────────────────── */

export const PRICE_MATRIX = {
  STARTER: { USD: 19, INR: 1599 },
  PRO: { USD: 49, INR: 3999 },
  BUSINESS: { USD: 99, INR: 7999 },
};

export const CURRENCIES = {
  USD: { symbol: '$', label: 'USD', locale: 'en-US' },
  INR: { symbol: '₹', label: 'INR', locale: 'en-IN' },
};

export const PLANS = [
  {
    id: 'STARTER',
    name: 'Starter',
    icon: 'rocket_launch',
    LucideIcon: Rocket,
    description: 'A smart AI chatbot on your site, fully on-brand.',
    badge: null,
    accent: 'slate',
    features: [
      '1 AI Bot',
      '1,500 messages / month',
      '300 knowledge chunks',
      'Custom branding & colors',
      'Custom prompt & tone',
      'Email support',
    ],
  },
  {
    id: 'PRO',
    name: 'Growth',
    icon: 'trending_up',
    LucideIcon: Building2,
    description: 'Turn visitors into leads — capture, score & act.',
    badge: 'Most Popular',
    accent: 'blue',
    features: [
      '3 AI Bots',
      '5,000 messages / month',
      '1,500 knowledge chunks',
      'Everything in Starter, plus:',
      'Lead capture & scoring (HOT/WARM/COLD)',
      'Instant hot-lead alerts + booking CTA',
      'Action Center (prioritized worklist)',
      'Weekly results email',
      'Priority support',
    ],
  },
  {
    id: 'BUSINESS',
    name: 'Scale',
    icon: 'insights',
    LucideIcon: Globe,
    description: 'See what drives revenue, then scale it.',
    badge: 'Full Platform',
    accent: 'emerald',
    features: [
      '5 AI Bots',
      '15,000 messages / month',
      '5,000 knowledge chunks',
      'Everything in Growth, plus:',
      'ROI dashboard + Conversion funnel',
      'Lead source attribution',
      'Slack handoff + Webhooks',
      'Human handoff',
      'Full white-label + custom logo',
      'Dedicated support',
    ],
  },
];

export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  'AI Bots': 'Number of independent AI chatbot instances you can create and deploy across different websites or use cases.',
  'Messages / bot / month': 'Monthly message quota per chatbot. Each customer message to your bot counts as one message. Resets monthly.',
  'Knowledge chunks / bot': 'Units of text (≈512 tokens each) your bot stores from documents, URLs, and FAQs. More chunks = richer knowledge base.',
  'Response speed': 'Latency and priority for generating responses. Ultra = <1s average, Dedicated = <2s, Priority = <3s, Standard = <5s.',
  'Custom branding & colors': 'Customize the chat widget color scheme, fonts, and styling to match your brand guidelines.',
  'White-label (remove Vaayu badge)': 'Remove the “Powered by Vaayu Intelligence” badge and all platform branding from the chat widget. Display your brand exclusively.',
  'Human handoff': 'Enable bot-to-agent handoff. The bot can transfer conversations to live agents with full transcript context.',
  'Lead capture / CRM': 'Capture visitor contact info from chat. Basic = name/email only. Full CRM = integrations with Zapier, webhooks, etc.',
  'Webhooks & Zapier': 'Connect your bot to 10,000+ apps via Zapier, or send custom data to your backend via webhooks.',
  'Analytics & exports': 'Track bot performance. Basic = dashboard views. Advanced = CSV exports. Full = ROI reports & custom metrics.',
  'Support channel': 'Community = public forum. Priority = email within 24h. SLA = guaranteed response time. Dedicated = direct contact.',
  'Onboarding call': 'Scheduled onboarding call with our team to set up your bot, integrate data sources, and configure features.',
  'Guaranteed uptime SLA': '99.9% uptime guarantee with service level agreement (SLA). Applies to Pro and Business plans only.',
};

export const COMPARISON_FEATURES = [
  {
    category: 'Bots & Capacity', rows: [
      { label: 'AI Bots', starter: '1', pro: '3', business: '5' },
      { label: 'Messages / bot / month', starter: '1,500', pro: '5,000', business: '15,000' },
      { label: 'Knowledge chunks / bot', starter: '300', pro: '1,500', business: '5,000' },
      { label: 'Response speed', starter: 'Standard', pro: 'Priority', business: 'Ultra' },
    ]
  },
  {
    category: 'Branding & Customization', rows: [
      { label: 'Custom branding & colors', starter: true, pro: true, business: true },
      { label: 'White-label (remove Vaayu badge)', starter: false, pro: false, business: true },
      { label: 'Human handoff', starter: false, pro: false, business: true },
    ]
  },
  {
    category: 'Conversion engine', rows: [
      { label: 'Lead capture & scoring', starter: false, pro: true, business: true },
      { label: 'Hot-lead alerts + booking CTA', starter: false, pro: true, business: true },
      { label: 'Action Center (worklist)', starter: false, pro: true, business: true },
      { label: 'Weekly results email', starter: false, pro: true, business: true },
    ]
  },
  {
    category: 'Business intelligence & integrations', rows: [
      { label: 'ROI dashboard & Conversion funnel', starter: false, pro: false, business: true },
      { label: 'Lead source attribution', starter: false, pro: false, business: true },
      { label: 'Slack handoff & Webhooks', starter: false, pro: false, business: true },
    ]
  },
  {
    category: 'Support', rows: [
      { label: 'Support channel', starter: 'Email', pro: 'Priority', business: 'Dedicated' },
      { label: 'Onboarding call', starter: false, pro: false, business: true },
    ]
  },
];

export const FAQS = [
  { q: 'How does it work?', a: 'Add your content — website URLs, PDF or document uploads, or pasted text — and we index it into a private, vectorized knowledge base. Your AI bot then answers visitor questions grounded in that content (not guesses), and you embed it on any site with a single line of JavaScript. Works with Next.js, React, WordPress, Shopify, Webflow, and plain HTML.' },
  { q: 'Which plan is right for me?', a: 'Starter gives you an on-brand support bot. Growth adds the conversion engine — lead capture, HOT/WARM/COLD scoring, instant hot-lead alerts, and the Action Center worklist. Scale adds deep business intelligence (ROI dashboard, conversion funnel, lead-source attribution), Slack and webhook integrations, and full white-label. Need higher limits or agency features? Custom plans are built around your volume.' },
  { q: 'Can I try it before paying?', a: 'Yes. Explore the live interactive demo for free, or start a 14-day trial of Growth to experience lead capture and the Action Center on your own data. No long-term commitment, and you can cancel anytime.' },
  { q: 'Can I switch or cancel anytime?', a: 'Absolutely. Upgrades apply instantly and are pro-rated; downgrades take effect at the end of your current billing cycle so you keep what you paid for. Cancel from your dashboard at any time and retain access until the period ends — no further charges.' },
  { q: 'Do you offer annual billing?', a: 'Yes — switch to annual on Starter, Growth, or Scale and get 2 months free versus paying monthly. Use the monthly/annual toggle on this page to see the discounted price.' },
  { q: 'What happens if I hit my monthly message limit?', a: 'Message quotas are counted per bot, per month. When a bot reaches its limit it pauses replies until the next billing cycle resets — you can upgrade anytime for a higher cap. Your knowledge base, configuration, and captured leads are never affected.' },
  { q: 'What are "knowledge chunks"?', a: 'Knowledge chunks are the units of text (about 512 tokens each) your bot stores from your documents, URLs, and FAQs. More chunks means a richer, more accurate knowledge base — each plan includes a per-bot chunk allowance.' },
  { q: 'Is my data private and secure?', a: 'Yes. We never sell your data or your visitors’ data, and your content is never used to train external AI models beyond your own bot. Everything is encrypted in transit (TLS), API keys are hashed and never stored in plaintext, and the embeddable widget is locked to the domains you authorize. See our Privacy Policy for full details.' },
  { q: 'Can I remove your branding?', a: 'Scale and Custom plans include full white-label — upload your own logo, set your brand colors, and remove the platform badge entirely so the widget looks 100% yours.' },
  { q: 'What about integrations and human handoff?', a: 'Growth and above can hand a live conversation to a human agent with the full transcript attached. Scale adds Slack alerts for hot leads and outbound webhooks, so you can push captured leads straight into your CRM or any tool via Zapier.' },
  { q: 'Is Explore really free forever?', a: 'Yes — Explore is a lifetime-free plan, not a trial. You get the full Vaayu Intelligence platform (analytics, lead capture, WhatsApp/human handoff, webhooks, custom branding and the advanced bot) with no time limit and no credit card. Cost-bearing limits are capped — 1 bot, 200 messages/month, 75 knowledge chunks — and every deployed bot keeps the “Powered by Vaayu Intelligence” badge. Upgrade to a paid plan anytime for higher limits, a faster model, and full white-label.' },
  { q: 'Why do I need a business email for Explore?', a: 'Explore is built for businesses and agencies, so we grant instant access to sign-ups from a business or custom domain. Personal-email sign-ups (gmail, yahoo, outlook, etc.) are welcome too — just tell us about your business via a short enquiry and we approve access, usually within 24 hours. This keeps the free platform sustainable and reserved for real use cases.' },
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
    <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
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
              href="/demo/bots"
              className="inline-flex items-center justify-center gap-2 border border-slate-700 text-slate-300 px-8 py-4 text-base font-display font-medium tracking-wider hover:bg-slate-800 transition-all rounded-full"
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

/* ─────────────────────────────────────────────────────────────────────────────
   EXPLORE — "COMING SOON" (lifetime-free top-of-funnel banner)
   Full-width horizontal hero shown ABOVE the Starter / Growth / Scale cards.
   Presentational only (no hooks, no framer-motion) so it's SSR-safe to import
   anywhere. Theme-matched: font-display / font-google, material-symbols icons,
   dark mode, rounded corners, brand gradients. Responsive: stacks on mobile,
   splits identity | features horizontally from lg up.
 ───────────────────────────────────────────────────────────────────────────── */

const EXPLORE_HIGHLIGHTS: { icon: string; label: string }[] = [
  { icon: 'smart_toy', label: '1 AI Bot' },
  { icon: 'forum', label: '200 messages / month' },
  { icon: 'database', label: '75 knowledge chunks' },
  { icon: 'contact_mail', label: 'Lead capture & scoring' },
  { icon: 'analytics', label: 'Full analytics dashboard' },
  { icon: 'support_agent', label: 'WhatsApp & human handoff' },
  { icon: 'webhook', label: 'Webhooks & integrations' },
  { icon: 'palette', label: 'Custom logo & appearance' },
  { icon: 'tune', label: 'Advanced bot — prompt & tone' },
];

export const ExploreComingSoon = ({
  onGetExplore,
  busy = false,
  message = null,
}: {
  onGetExplore?: () => void;
  busy?: boolean;
  message?: string | null;
} = {}) => {
  // "Live" mode (an action handler was passed) flips the card from a passive
  // "Coming Soon" teaser into an actionable "Get Explore — Free" CTA.
  const live = typeof onGetExplore === 'function';
  return (
  <section
    aria-label={live ? 'Explore plan' : 'Explore plan — coming soon'}
    className="relative mb-6 overflow-hidden rounded-2xl border border-gray-200 dark:border-slate-800/60 bg-white dark:bg-white/[0.02] backdrop-blur-sm shadow-sm transition-all duration-300 hover:border-gray-300 dark:hover:border-slate-700 hover:shadow-lg dark:hover:shadow-slate-950/20"
  >
    <div className="flex flex-col lg:flex-row">
      {/* LEFT — identity + price + CTA */}
      <div className="flex flex-col gap-5 p-7 sm:p-8 lg:w-[38%] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-slate-800/60">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06]">
            <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">explore</span>
          </div>
          <div className="flex flex-col items-start gap-1.5">
            <h3 className="text-lg font-display font-bold uppercase tracking-wide text-slate-900 dark:text-slate-100">Explore</h3>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 px-3 py-1">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
              </span>
              <span className="text-[10px] font-display font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">{live ? 'Free Forever' : 'Coming Soon'}</span>
            </span>
          </div>
        </div>

        <p className="text-sm font-google text-slate-600 dark:text-slate-400 leading-relaxed">
          The full Vaayu Intelligence platform — analytics, lead capture, WhatsApp handoff and more —{' '}
          <span className="font-semibold text-slate-800 dark:text-slate-200">free, forever.</span> Built for businesses and agencies.
        </p>

        <div className="flex items-end gap-2">
          <span className="text-4xl sm:text-5xl font-display font-black text-slate-900 dark:text-slate-100">Free</span>
          <span className="mb-1.5 text-sm font-google text-slate-500 dark:text-slate-400">forever · no card</span>
        </div>

        {live ? (
          <button
            type="button"
            onClick={onGetExplore}
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-slate-900 dark:bg-white px-6 py-4 text-sm font-display font-bold uppercase tracking-widest text-white dark:text-slate-900 transition-all duration-200 hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className={`material-symbols-outlined text-[16px] ${busy ? 'animate-spin' : ''}`}>
              {busy ? 'progress_activity' : 'explore'}
            </span>
            {busy ? 'One moment…' : 'Get Explore — Free'}
          </button>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-full bg-slate-100 dark:bg-white/[0.06] border border-gray-200 dark:border-slate-800/60 px-6 py-4 text-sm font-display font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
          >
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            Coming Soon
          </button>
        )}
        {message && (
          <p className="text-xs font-google text-amber-600 dark:text-amber-400 leading-relaxed">{message}</p>
        )}

        <div className="flex items-start gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-500 shrink-0">bolt</span>
          <span className="text-[11px] font-google text-slate-500 dark:text-slate-400 leading-relaxed">
            Every deployed bot keeps the “Powered by Vaayu Intelligence” badge.
          </span>
        </div>
      </div>

      {/* RIGHT — feature highlights */}
      <div className="flex-1 p-7 sm:p-8">
        <div className="mb-5 flex items-center gap-2">
          <span className="material-symbols-outlined text-[14px] text-slate-400 dark:text-slate-500">auto_awesome</span>
          <span className="text-[10px] font-display font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Everything included</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {EXPLORE_HIGHLIGHTS.map(f => (
            <div
              key={f.label}
              className="flex items-center gap-3 rounded-full border border-gray-200 dark:border-slate-800/60 bg-slate-50/60 dark:bg-white/[0.02] px-4 py-2.5 transition-colors hover:border-gray-300 dark:hover:border-slate-700"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-white/[0.06]">
                <span className="material-symbols-outlined text-[15px] text-slate-600 dark:text-slate-400">{f.icon}</span>
              </div>
              <span className="text-sm font-google font-medium text-slate-700 dark:text-slate-300 leading-tight">{f.label}</span>
            </div>
          ))}
          {/* The single honest exclusion */}
          <div className="flex items-center gap-3 rounded-full border border-dashed border-gray-200 dark:border-slate-800/60 px-4 py-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800/50">
              <span className="material-symbols-outlined text-[15px] text-slate-400 dark:text-slate-600">remove</span>
            </div>
            <span className="text-sm font-google font-medium text-slate-400 dark:text-slate-500 leading-tight">White-label — on paid plans</span>
          </div>
        </div>
      </div>
    </div>
  </section>
  );
};
