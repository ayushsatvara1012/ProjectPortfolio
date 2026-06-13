'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

// ─────────────────────────────────────────────────────────────────────────────
// Vaayu — Product Documentation
//
// A complete, non-technical product manual for Vaayu by Sapybase. Three columns
// on desktop: grouped topic navigation (left), the explanation (middle), and an
// "On This Page" rail (right). All product visuals are real screenshots captured
// from the live demo workspace (see /public/docs). No videos.
// ─────────────────────────────────────────────────────────────────────────────

// ── Section model ────────────────────────────────────────────────────────────
// One flat, ordered list drives the left nav (grouped), the right rail
// ("On This Page"), and the scroll-spy. Keep `id`s in sync with the <section>s.

type NavItem = { id: string; label: string };
type NavGroup = { group: string; icon: string; items: NavItem[] };

const NAV: NavGroup[] = [
  {
    group: 'Getting Started',
    icon: 'rocket_launch',
    items: [
      { id: 'introduction', label: 'What is Vaayu?' },
      { id: 'account', label: 'Create your account' },
      { id: 'plans', label: 'Choose your plan' },
    ],
  },
  {
    group: 'My Bots',
    icon: 'smart_toy',
    items: [
      { id: 'my-bots', label: 'The My Bots screen' },
      { id: 'create-bot', label: 'Create a bot' },
      { id: 'install', label: 'Install on your site' },
      { id: 'csp', label: 'Security (CSP)' },
    ],
  },
  {
    group: 'Train & Customize',
    icon: 'auto_awesome',
    items: [
      { id: 'training', label: 'Train your AI' },
      { id: 'customize', label: 'Customize the widget' },
    ],
  },
  {
    group: 'Insights Dashboard',
    icon: 'insights',
    items: [
      { id: 'insights', label: 'Overview & Action Center' },
      { id: 'leads', label: 'Leads CRM' },
      { id: 'funnel', label: 'Conversion Funnel' },
      { id: 'roi', label: 'ROI & Revenue' },
      { id: 'conversations', label: 'Conversations' },
      { id: 'analytics', label: 'Analytics' },
    ],
  },
  {
    group: 'Account & Help',
    icon: 'support_agent',
    items: [
      { id: 'billing', label: 'Settings & Billing' },
      { id: 'support', label: 'Getting help' },
    ],
  },
];

const FLAT: NavItem[] = NAV.flatMap((g) => g.items);

// ── Image dimensions (intrinsic px of the 2× screenshots) ────────────────────

const SHOTS: Record<string, { w: number; h: number }> = {
  'my-bots': { w: 2880, h: 1464 },
  'create-bot': { w: 2880, h: 1522 },
  train: { w: 2880, h: 2008 },
  customize: { w: 2880, h: 1464 },
  chat: { w: 2880, h: 1576 },
  'insights-overview': { w: 2880, h: 1464 },
  'insights-leads': { w: 2880, h: 2044 },
  'insights-funnel': { w: 2880, h: 2630 },
  'insights-roi': { w: 2880, h: 2338 },
  'insights-conversations': { w: 2880, h: 1464 },
  'insights-analytics': { w: 2880, h: 3902 },
};

const VaayuDocs = () => {
  const [activeId, setActiveId] = useState<string>('introduction');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [installTab, setInstallTab] = useState('html');
  const menuRef = useRef<HTMLDivElement>(null);

  // ── Copy helper ────────────────────────────────────────────────────────────

  const handleCopy = useCallback((text: string, id: string) => {
    const done = () => { setCopied(id); setTimeout(() => setCopied(null), 2000); };
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta); return ok;
    };
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(done).catch(() => { if (fallback()) done(); });
      } else if (fallback()) done();
    } catch { fallback(); }
  }, []);

  // ── Scroll-spy ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const ids = FLAT.map((s) => s.id);
    const handleScroll = () => {
      const pos = window.scrollY + 140;
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && pos >= el.offsetTop) { setActiveId(ids[i]); break; }
      }
    };
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 96, behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  // ── Close mobile menu on outside click ───────────────────────────────────────

  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMenuOpen]);

  const activeLabel = FLAT.find((s) => s.id === activeId)?.label ?? 'Contents';

  // ── Browser-framed screenshot ────────────────────────────────────────────────

  const Figure = ({ name, alt, caption }: { name: keyof typeof SHOTS | string; alt: string; caption?: string }) => {
    const dim = SHOTS[name] ?? { w: 2880, h: 1600 };
    return (
      <figure className="my-6">
        <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-white/[0.02] shadow-sm">
          <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-200 dark:border-white/[0.06] bg-white/70 dark:bg-white/[0.03]">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300 dark:bg-slate-600" />
            <span className="ml-3 text-[11px] font-medium tracking-wide text-slate-400 dark:text-slate-500 truncate">app.sapybase.com</span>
          </div>
          <Image
            src={`/docs/${name}.webp`}
            alt={alt}
            width={dim.w}
            height={dim.h}
            sizes="(max-width: 1024px) 100vw, 760px"
            className="w-full h-auto block"
          />
        </div>
        {caption && (
          <figcaption className="mt-2.5 text-xs lg:text-sm text-slate-400 dark:text-slate-500 text-center px-4 leading-relaxed">
            {caption}
          </figcaption>
        )}
      </figure>
    );
  };

  // ── Syntax-highlighted code block ────────────────────────────────────────────

  const CodeBlock = ({ code, id }: { code: string; id: string }) => {
    const tokens = [
      { regex: /(&lt;!--[\s\S]*?--&gt;|\{\/\*[\s\S]*?\*\/\}|\/\/.*)/g, color: 'text-slate-500 italic' },
      { regex: /(&quot;.*?&quot;|&#39;.*?&#39;|".*?"|'.*?'|`[\s\S]*?`)/g, color: 'text-emerald-400' },
      { regex: /(&lt;\/?[a-zA-Z0-9]+)/g, color: 'text-rose-400' },
      { regex: /\b(lang|src|defer|href|rel|target|id|strategy|type|data-bot-id|className|key|value|source|headers)\b(?==|:|\s|&gt;)/g, color: 'text-amber-300' },
      { regex: /\b(window|document|Script|import|export|default|function|return|const|let|var|from|async|await)\b/g, color: 'text-blue-400' },
      { regex: /(&lt;!DOCTYPE html&gt;)/gi, color: 'text-blue-300' },
    ];
    let segments: { text: string; raw: boolean }[] = [{ text: code.replace(/</g, '&lt;').replace(/>/g, '&gt;'), raw: true }];
    tokens.forEach((tk) => {
      const next: typeof segments = [];
      segments.forEach((seg) => {
        if (!seg.raw) { next.push(seg); return; }
        let last = 0; let m; tk.regex.lastIndex = 0;
        while ((m = tk.regex.exec(seg.text)) !== null) {
          if (m.index > last) next.push({ text: seg.text.slice(last, m.index), raw: true });
          next.push({ text: `<span class="${tk.color}">${m[0]}</span>`, raw: false });
          last = tk.regex.lastIndex;
        }
        if (last < seg.text.length) next.push({ text: seg.text.slice(last), raw: true });
      });
      segments = next;
    });
    const html = segments.map((s) => s.text).join('');
    const isCopied = copied === id;
    return (
      <div className="relative mt-4">
        <div className="rounded-2xl overflow-hidden bg-slate-900 dark:bg-slate-950 border border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            </div>
            <button
              onClick={() => handleCopy(code, id)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium tracking-wider uppercase text-slate-400 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">{isCopied ? 'check' : 'content_copy'}</span>
              {isCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-4 overflow-x-auto custom-scrollbar">
            <pre className="m-0 text-[12px] sm:text-[13px] leading-relaxed font-mono text-slate-300">
              <code dangerouslySetInnerHTML={{ __html: html }} />
            </pre>
          </div>
        </div>
      </div>
    );
  };

  // ── Small presentational helpers ─────────────────────────────────────────────

  const StepBadge = ({ n, icon }: { n?: number | string; icon?: string }) => (
    <span className="shrink-0 w-7 h-7 bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-xs font-semibold font-google rounded-xl select-none">
      {icon ? <span className="material-symbols-outlined text-[14px]">{icon}</span> : n}
    </span>
  );

  const H2 = ({ children, badge, icon }: { children: React.ReactNode; badge?: number | string; icon?: string }) => (
    <div className="flex items-center gap-3">
      {(badge !== undefined || icon) && <StepBadge n={badge} icon={icon} />}
      <h2 className="text-xl md:text-2xl lg:text-[1.7rem] font-medium tracking-tight text-slate-900 dark:text-slate-100">{children}</h2>
    </div>
  );

  const Lead = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[15px] lg:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{children}</p>
  );

  const Bullet = ({ icon = 'check_circle', children }: { icon?: string; children: React.ReactNode }) => (
    <li className="flex items-start gap-2.5">
      <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500 mt-0.5 shrink-0">{icon}</span>
      <span className="text-[15px] lg:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{children}</span>
    </li>
  );

  const Strong = ({ children }: { children: React.ReactNode }) => (
    <strong className="font-semibold text-slate-800 dark:text-slate-100">{children}</strong>
  );

  type CalloutTone = 'tip' | 'info' | 'warn' | 'danger';
  const Callout = ({ tone = 'tip', title, children }: { tone?: CalloutTone; title?: string; children: React.ReactNode }) => {
    const map: Record<CalloutTone, { box: string; icon: string; ic: string; tx: string }> = {
      tip: { box: 'bg-slate-50 dark:bg-white/[0.03] border-slate-200 dark:border-white/[0.06]', icon: 'lightbulb', ic: 'text-slate-500 dark:text-slate-400', tx: 'text-slate-600 dark:text-slate-300' },
      info: { box: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800/30', icon: 'info', ic: 'text-blue-600 dark:text-blue-400', tx: 'text-blue-800 dark:text-blue-300' },
      warn: { box: 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30', icon: 'warning', ic: 'text-amber-600 dark:text-amber-400', tx: 'text-amber-800 dark:text-amber-300' },
      danger: { box: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/20', icon: 'report', ic: 'text-red-500 dark:text-red-400', tx: 'text-red-700 dark:text-red-400' },
    };
    const c = map[tone];
    return (
      <div className={`flex items-start gap-3 p-4 rounded-2xl border ${c.box}`}>
        <span className={`material-symbols-outlined text-[18px] shrink-0 mt-0.5 ${c.ic}`}>{c.icon}</span>
        <div className={`text-[14px] lg:text-[15px] leading-relaxed ${c.tx}`}>
          {title && <p className="font-semibold mb-1">{title}</p>}
          {children}
        </div>
      </div>
    );
  };

  const Pill = ({ children }: { children: React.ReactNode }) => (
    <span className="inline-block ml-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 align-middle">{children}</span>
  );

  const installTabs = [
    { id: 'html', label: 'HTML' },
    { id: 'react', label: 'React' },
    { id: 'nextjs', label: 'Next.js' },
    { id: 'wordpress', label: 'WordPress' },
    { id: 'shopify', label: 'Shopify' },
  ];

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-transparent font-google">

      {/* ── Mobile sticky contents bar ── */}
      <div ref={menuRef} className="lg:hidden sticky top-16 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-100 dark:border-white/[0.05] px-4 py-3">
        <button onClick={() => setIsMenuOpen((p) => !p)} className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">menu_book</span>
            <span className="text-[15px] font-semibold text-slate-700 dark:text-slate-200">{activeLabel}</span>
          </div>
          <span className="material-symbols-outlined text-[20px] text-slate-400 transition-transform" style={{ transform: isMenuOpen ? 'rotate(180deg)' : 'none' }}>expand_more</span>
        </button>
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-[calc(100%+4px)] left-3 right-3 z-40 max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/[0.05] shadow-xl rounded-2xl p-2"
            >
              {NAV.map((grp) => (
                <div key={grp.group} className="mb-1.5 last:mb-0">
                  <p className="flex items-center gap-2 px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    <span className="material-symbols-outlined text-[15px]">{grp.icon}</span>{grp.group}
                  </p>
                  {grp.items.map((it) => (
                    <button
                      key={it.id}
                      onClick={() => scrollTo(it.id)}
                      className={`block w-full text-left px-3 py-2.5 rounded-xl text-[15px] transition-colors ${activeId === it.id ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 font-semibold' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Page body ── */}
      <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[230px_1fr_190px] lg:gap-10 xl:gap-14">

          {/* ── Left: grouped topic nav ── */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-2 custom-scrollbar space-y-5">
              {NAV.map((grp) => (
                <div key={grp.group}>
                  <p className="flex items-center gap-2 px-3 mb-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    <span className="material-symbols-outlined text-[15px]">{grp.icon}</span>{grp.group}
                  </p>
                  <div className="space-y-0.5">
                    {grp.items.map((it) => (
                      <button
                        key={it.id}
                        onClick={() => scrollTo(it.id)}
                        className={`block w-full text-left pl-5 pr-3 py-1.5 rounded-lg text-[14px] border-l-2 transition-colors ${
                          activeId === it.id
                            ? 'border-slate-900 dark:border-white text-slate-900 dark:text-slate-100 font-semibold bg-slate-50 dark:bg-white/[0.04]'
                            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'
                        }`}
                      >
                        {it.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          {/* ── Middle: content ── */}
          <main className="min-w-0 mt-4 lg:mt-0">

            {/* Hero */}
            <header className="space-y-4 mb-12">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] rounded-full text-xs font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500">
                <span className="material-symbols-outlined text-[13px]">menu_book</span>
                Documentation
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-[2.9rem] font-normal tracking-tight text-slate-900 dark:text-slate-100 leading-[1.1]">
                The Vaayu Handbook
              </h1>
              <Lead>
                Vaayu by <Strong>Sapybase</Strong> is a business-intelligence chat assistant that lives on your website.
                It answers your customers 24/7, captures and scores every lead, and turns conversations into revenue you can measure.
                This guide walks you through everything — step by step, no technical knowledge required.
              </Lead>
              <div className="flex flex-wrap gap-2 pt-1">
                <button onClick={() => scrollTo('account')} className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98]">
                  <span className="material-symbols-outlined text-[16px]">play_arrow</span>Start the walkthrough
                </button>
                <Link href="/demo/bots" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors">
                  <span className="material-symbols-outlined text-[16px]">explore</span>Try the live demo
                </Link>
              </div>
            </header>

            <div className="space-y-14">

              {/* ════════ GETTING STARTED ════════ */}

              {/* Introduction */}
              <section id="introduction" className="scroll-mt-24 space-y-4">
                <H2 icon="auto_awesome">What is Vaayu?</H2>
                <Lead>
                  Think of Vaayu as a tireless team member who knows your business by heart. You feed it your content —
                  brochures, FAQs, your website — and it instantly becomes a smart assistant that chats with visitors,
                  answers their questions accurately, and quietly does the work of a sales and support team in the background.
                </Lead>
                <div className="grid sm:grid-cols-2 gap-3 pt-1">
                  {[
                    { icon: 'forum', t: 'Answers 24/7', d: 'Replies instantly to every visitor using only your own approved content — no made-up answers.' },
                    { icon: 'person_search', t: 'Captures & scores leads', d: 'Spots interested visitors, collects their details, and ranks them Hot, Warm or Cold by buying intent.' },
                    { icon: 'trending_up', t: 'Maps your funnel', d: 'Shows how conversations turn into leads, contacts and closed deals — and where people drop off.' },
                    { icon: 'payments', t: 'Proves ROI', d: 'Attributes real revenue back to the chat, so you can see exactly what Vaayu is worth.' },
                  ].map((f) => (
                    <div key={f.t} className="p-4 rounded-2xl bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.05]">
                      <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">{f.icon}</span>
                      <p className="mt-2 font-semibold text-slate-800 dark:text-slate-100">{f.t}</p>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{f.d}</p>
                    </div>
                  ))}
                </div>
                <Callout tone="info" title="The five-minute path to live">
                  <ol className="list-decimal list-inside space-y-0.5">
                    <li>Create your account and pick a plan.</li>
                    <li>Create a bot with your company details.</li>
                    <li>Paste one line of code on your website.</li>
                    <li>Train it on your content and customize the look.</li>
                    <li>Watch the leads and insights roll in.</li>
                  </ol>
                </Callout>
              </section>

              {/* Account */}
              <section id="account" className="scroll-mt-24 space-y-4">
                <H2 badge={1}>Create your account</H2>
                <Lead>Getting started takes under a minute. You only need an email address.</Lead>
                <ul className="space-y-2.5">
                  <Bullet><Strong>Sign up</Strong> with your email or your Google account — whichever is easier.</Bullet>
                  <Bullet>Vaayu automatically creates a private, isolated workspace for you, so your data is never mixed with anyone else’s.</Bullet>
                  <Bullet>Once you’re in, you land on your <Strong>dashboard</Strong> — your home base for everything that follows.</Bullet>
                </ul>
                <Callout tone="tip">
                  Already curious? You can explore the entire product without signing up using the{' '}
                  <Link href="/demo/bots" className="font-semibold underline underline-offset-2">interactive demo</Link>. Nothing you do there is saved.
                </Callout>
              </section>

              {/* Plans */}
              <section id="plans" className="scroll-mt-24 space-y-4">
                <H2 badge={2}>Choose your plan</H2>
                <Lead>
                  Pick the plan that fits where you are today — you can upgrade or downgrade at any time. Higher plans unlock
                  more bots, more monthly messages, a larger knowledge base, and the full Insights Dashboard.
                </Lead>
                <ul className="space-y-2.5">
                  <Bullet icon="bolt"><Strong>Free</Strong> — perfect for trying Vaayu on a single site with a starter message allowance.</Bullet>
                  <Bullet icon="workspace_premium"><Strong>Pro</Strong> — unlocks automatic lead scoring, the full Insights Dashboard, and revenue attribution.</Bullet>
                  <Bullet icon="hub"><Strong>Business</Strong> — for agencies and larger teams: run multiple bots from one workspace.</Bullet>
                </ul>
                <Callout tone="info">
                  Compare features and prices on the{' '}
                  <Link href="/pricing" className="font-semibold underline underline-offset-2">pricing page</Link>. Billing is handled securely — see{' '}
                  <button onClick={() => scrollTo('billing')} className="font-semibold underline underline-offset-2">Settings &amp; Billing</button> below.
                </Callout>
              </section>

              {/* ════════ MY BOTS ════════ */}

              {/* My Bots */}
              <section id="my-bots" className="scroll-mt-24 space-y-4">
                <H2 icon="smart_toy">The My Bots screen</H2>
                <Lead>
                  <Strong>My Bots</Strong> is the first thing you see after signing in. Every AI assistant you create lives here as a card.
                  At a glance you can see your plan, how many messages and words of knowledge you’ve used, and the status of each bot.
                </Lead>
                <Figure name="my-bots" alt="The My Bots dashboard showing a bot card with usage and quick actions" caption="My Bots — your home base. Each card shows usage and gives you Train, Settings and Chat shortcuts." />
                <ul className="space-y-2.5">
                  <Bullet icon="model_training"><Strong>Train</Strong> — add or update the knowledge your bot answers from.</Bullet>
                  <Bullet icon="settings"><Strong>Settings</Strong> — rename the bot, change its look, or grab the install snippet.</Bullet>
                  <Bullet icon="chat"><Strong>Chat</Strong> — open a live preview to test how your bot replies.</Bullet>
                </ul>
              </section>

              {/* Create a bot */}
              <section id="create-bot" className="scroll-mt-24 space-y-4">
                <H2 badge={3}>Create a bot</H2>
                <Lead>
                  A “bot” is one AI assistant tied to one website. Creating it tells Vaayu who you are and locks the assistant
                  to your domain for security. You’ll fill in a short form — no code involved.
                </Lead>
                <Figure name="create-bot" alt="The Create Bot screen with company name, allowed origin, theme color and tone fields" caption="Create Bot — your company name, website, brand color and tone of voice in one short form." />
                <ul className="space-y-2.5">
                  <Bullet><Strong>Company name</Strong> — how your bot refers to your business in conversations.</Bullet>
                  <Bullet><Strong>Allowed origin</Strong> — the website address where the bot is allowed to appear. This keeps your bot from being used on other sites.</Bullet>
                  <Bullet><Strong>Theme color</Strong> — your brand color, used for the chat bubble and buttons.</Bullet>
                  <Bullet><Strong>Tone</Strong> — pick how your bot should sound, e.g. professional, friendly or playful.</Bullet>
                </ul>
                <Callout tone="tip" title="What you get back">
                  When you create the bot, Vaayu gives you a unique <Strong>Bot ID</Strong> and a one-line install snippet. That snippet is all you need to go live — covered next.
                </Callout>
              </section>

              {/* Install */}
              <section id="install" className="scroll-mt-24 space-y-4">
                <H2 badge={4}>Install on your website</H2>
                <Lead>
                  Adding Vaayu to your site is a copy-and-paste job. You paste one small snippet just before the closing
                  <code className="mx-1 px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.04] rounded text-xs font-mono">&lt;/body&gt;</code> tag on
                  every page. Choose your platform below for exact instructions.
                </Lead>

                <div className="flex flex-wrap gap-1.5 pb-3 border-b border-slate-100 dark:border-white/[0.05]">
                  {installTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setInstallTab(tab.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        installTab === tab.id
                          ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                          : 'bg-white dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-white/[0.06] hover:text-slate-900 dark:hover:text-slate-100'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="bg-white dark:bg-white/[0.02] rounded-2xl p-5 border border-slate-100 dark:border-white/[0.05]">
                  {installTab === 'html' && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Plain HTML / static websites</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Paste this just before <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.04] rounded text-xs font-mono">&lt;/body&gt;</code>:</p>
                      <CodeBlock id="i-html" code={`<!DOCTYPE html>\n<html lang="en">\n<body>\n    <!-- Vaayu AI Chat Widget -->\n    <script src="https://www.sapybase.com/sapybase-loader@1.js"\n            data-bot-id="YOUR_BOT_ID"\n            defer></script>\n</body>\n</html>`} />
                    </div>
                  )}
                  {installTab === 'react' && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">React (Vite or Create React App)</p>
                      <CodeBlock id="i-react" code={`<body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n\n    <!-- Vaayu AI Chat Widget -->\n    <script src="https://www.sapybase.com/sapybase-loader@1.js"\n            data-bot-id="YOUR_BOT_ID"\n            defer></script>\n</body>`} />
                    </div>
                  )}
                  {installTab === 'nextjs' && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Next.js (App Router)</p>
                      <CodeBlock id="i-next" code={`import Script from 'next/script';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        {/* Vaayu AI Chat Widget */}\n        <Script\n          src="https://www.sapybase.com/sapybase-loader@1.js"\n          data-bot-id="YOUR_BOT_ID"\n          strategy="lazyOnload"\n        />\n      </body>\n    </html>\n  );\n}`} />
                    </div>
                  )}
                  {installTab === 'wordpress' && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">WordPress</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Appearance → Theme File Editor → <span className="font-mono">footer.php</span>, just before <code className="px-1 py-0.5 bg-slate-100 dark:bg-white/[0.04] rounded text-xs font-mono">&lt;/body&gt;</code>. Or use any “insert header/footer code” plugin.</p>
                      <CodeBlock id="i-wp" code={`<!-- Before </body> in footer.php -->\n<script src="https://www.sapybase.com/sapybase-loader@1.js"\n        data-bot-id="YOUR_BOT_ID"\n        defer></script>`} />
                    </div>
                  )}
                  {installTab === 'shopify' && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Shopify</p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Online Store → Themes → Edit code → <span className="font-mono">theme.liquid</span>, just before <code className="px-1 py-0.5 bg-slate-100 dark:bg-white/[0.04] rounded text-xs font-mono">&lt;/body&gt;</code>.</p>
                      <CodeBlock id="i-shopify" code={`<!-- Before </body> in theme.liquid -->\n<script src="https://www.sapybase.com/sapybase-loader@1.js"\n        data-bot-id="YOUR_BOT_ID"\n        defer></script>`} />
                    </div>
                  )}
                </div>
                <Callout tone="tip">
                  Replace <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.04] rounded text-xs font-mono">YOUR_BOT_ID</code> with the Bot ID from your dashboard.
                  Once saved, refresh your site — the chat bubble appears in the corner automatically. Changes you make later in the dashboard go live instantly, with no need to touch this code again.
                </Callout>
              </section>

              {/* CSP */}
              <section id="csp" className="scroll-mt-24 space-y-4">
                <H2 icon="shield">Security: Content Security Policy</H2>
                <Callout tone="warn">
                  Most websites can skip this section. You only need it if your site already sends a{' '}
                  <code className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded text-xs font-mono">Content-Security-Policy</code> header — a stricter security setting some developers add.
                </Callout>
                <Lead>If you do use a CSP, add Sapybase to the following rules so the widget can load and connect. Extend your existing policy — don’t replace it.</Lead>
                <CodeBlock id="csp-min" code={`Content-Security-Policy:\n  script-src   'self' https://www.sapybase.com;\n  frame-src    https://www.sapybase.com;\n  connect-src  'self' https://www.sapybase.com;\n  img-src      'self' data: blob: https://www.sapybase.com;`} />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 pt-1">Next.js — next.config.mjs</p>
                <CodeBlock id="csp-next" code={`async headers() {\n  return [{\n    source: '/:path*',\n    headers: [{\n      key: 'Content-Security-Policy',\n      value: [\n        "default-src 'self'",\n        "script-src 'self' 'unsafe-inline' https://www.sapybase.com",\n        "frame-src https://www.sapybase.com",\n        "connect-src 'self' https://www.sapybase.com",\n        "img-src 'self' data: blob: https://www.sapybase.com",\n      ].join('; '),\n    }],\n  }];\n}`} />
              </section>

              {/* ════════ TRAIN & CUSTOMIZE ════════ */}

              {/* Training */}
              <section id="training" className="scroll-mt-24 space-y-4">
                <H2 badge={5}>Train your AI</H2>
                <Lead>
                  Training is how your bot learns about your business. The more relevant content you give it, the smarter and
                  more accurate its answers become. Vaayu only ever answers from the material you provide — it won’t invent facts.
                </Lead>
                <Figure name="train" alt="The Train AI screen showing PDF, CSV and Text upload tabs and a knowledge manager" caption="Train AI — upload PDFs, spreadsheets or paste text. Your content is indexed and stored as searchable knowledge." />
                <ul className="space-y-2.5">
                  <Bullet icon="description"><Strong>PDF upload</Strong> — drop in brochures, manuals, policies or FAQs. Vaayu reads every page.</Bullet>
                  <Bullet icon="table_chart"><Strong>CSV / Excel</Strong> — great for product lists, price tables or structured data.</Bullet>
                  <Bullet icon="notes"><Strong>Text</Strong> — paste answers, talking points, or anything else directly.</Bullet>
                </ul>
                <Callout tone="info" title="How knowledge is stored">
                  Each source is indexed and stored as searchable knowledge (measured in words). When a visitor asks something, Vaayu finds the most relevant content and answers from it. You can review and delete entries any time from the knowledge manager.
                </Callout>
                <Callout tone="danger">
                  Deleting knowledge is permanent — the bot will immediately forget that piece of information.
                </Callout>
              </section>

              {/* Customize */}
              <section id="customize" className="scroll-mt-24 space-y-4">
                <H2 badge={6}>Customize the widget</H2>
                <Lead>
                  Make the chat feel like a natural part of your brand. Everything here updates the live preview as you type,
                  and once saved it appears on your website instantly — no redeploy needed.
                </Lead>
                <Figure name="customize" alt="The Customize Bot screen with appearance controls and a live chat preview" caption="Customize — edit the name, greeting, colors and avatar on the left and watch the live preview on the right." />
                <ul className="space-y-2.5">
                  <Bullet><Strong>Bot name &amp; greeting</Strong> — the first message visitors see when they open the chat.</Bullet>
                  <Bullet><Strong>Theme color</Strong> — match the bubble and buttons to your brand.</Bullet>
                  <Bullet><Strong>Logo &amp; avatar shape</Strong> — upload your logo and choose a shape (circle, squircle, and more).</Bullet>
                  <Bullet><Strong>Remove branding</Strong> — on paid plans, hide the “Vaayu Intelligence” footer for a fully white-label widget.</Bullet>
                </ul>
                <Callout tone="tip">
                  Use the light/dark toggle in the preview to check your colors read well in both modes before you publish.
                </Callout>
              </section>

              {/* ════════ INSIGHTS DASHBOARD ════════ */}

              {/* Insights overview */}
              <section id="insights" className="scroll-mt-24 space-y-4">
                <H2 icon="insights">Insights Dashboard</H2>
                <Lead>
                  This is where Vaayu goes beyond a normal chatbot. Every conversation becomes data you can act on. The dashboard
                  is organized into tabs — we’ll walk through each one. The first tab, <Strong>Action Center</Strong>, is your
                  daily to-do list: the hottest leads, ranked, with one-click actions.
                </Lead>
                <Figure name="insights-overview" alt="The Insights Action Center listing the highest-intent leads with act-now actions" caption="Action Center — your most valuable leads, ranked by intent, with Won / Lost / email actions." />
                <ul className="space-y-2.5">
                  <Bullet icon="priority_high"><Strong>Ranked actions</Strong> — the leads most likely to buy float to the top so you act on them first.</Bullet>
                  <Bullet icon="mark_email_read"><Strong>One-click follow-up</Strong> — email a lead or mark a deal Won or Lost without leaving the page.</Bullet>
                </ul>
              </section>

              {/* Leads */}
              <section id="leads" className="scroll-mt-24 space-y-4">
                <H2 icon="contacts">Leads CRM</H2>
                <Lead>
                  Every visitor who shows buying interest is captured here automatically, complete with a score and the context of
                  what they asked. No more digging through chat logs — your pipeline builds itself.
                </Lead>
                <Figure name="insights-leads" alt="The Leads CRM table with contact info, intent scores, status and captured context" caption="Leads CRM — each lead with an intent score, Hot/Warm/Cold band, status and the question that captured them. Export to CSV any time." />
                <ul className="space-y-2.5">
                  <Bullet><Strong>Intent score &amp; band</Strong> — every lead is scored 0–100 and labelled <span className="text-rose-500 font-semibold">Hot</span>, <span className="text-amber-500 font-semibold">Warm</span> or <span className="text-sky-500 font-semibold">Cold</span>.</Bullet>
                  <Bullet><Strong>Status</Strong> — track each lead through New → Contacted → Won / Lost.</Bullet>
                  <Bullet><Strong>Context</Strong> — see the exact question that turned a visitor into a lead, so your follow-up is relevant.</Bullet>
                  <Bullet icon="download"><Strong>Export CSV</Strong> — pull your leads into any spreadsheet or external CRM.</Bullet>
                </ul>
              </section>

              {/* Funnel */}
              <section id="funnel" className="scroll-mt-24 space-y-4">
                <H2 icon="filter_alt">Conversion Funnel</H2>
                <Lead>
                  The funnel shows the journey from a casual conversation all the way to a closed deal, and exactly where people
                  drop off. It’s the fastest way to understand what’s working and what to fix.
                </Lead>
                <Figure name="insights-funnel" alt="The conversion funnel from conversations to leads to contacted to won, with drop-off and lead quality" caption="Conversion Funnel — Conversations → Leads → Contacted → Won, with drop-off at each stage, overall conversion, revenue won, and lead quality." />
                <ul className="space-y-2.5">
                  <Bullet><Strong>Stage-by-stage drop-off</Strong> — see what percentage continues from one stage to the next.</Bullet>
                  <Bullet><Strong>Overall conversion &amp; revenue</Strong> — the headline numbers for the period you choose (7, 30, 90 days, or all time).</Bullet>
                  <Bullet><Strong>Lead quality</Strong> — the Hot / Warm / Cold split of your captured leads.</Bullet>
                  <Bullet><Strong>Lead sources</Strong> — which pages (chat widget, pricing, docs…) bring the most leads and revenue.</Bullet>
                </ul>
              </section>

              {/* ROI */}
              <section id="roi" className="scroll-mt-24 space-y-4">
                <H2 icon="savings">ROI &amp; Revenue</H2>
                <Lead>
                  This tab answers the question every owner asks: “Is it worth it?” Vaayu adds up the support time it saves and the
                  revenue it helps generate, then shows your return in plain dollars.
                </Lead>
                <Figure name="insights-roi" alt="The ROI dashboard showing support cost saved, potential revenue, total ROI and proven closed-won revenue" caption="ROI dashboard — support cost saved, potential revenue, total ROI and your proven closed-won revenue. Calibrate the numbers to your own business." />
                <ul className="space-y-2.5">
                  <Bullet><Strong>Support cost saved</Strong> — based on how many questions the bot answered for you.</Bullet>
                  <Bullet><Strong>Potential &amp; proven revenue</Strong> — pipeline value plus the real revenue from leads you marked Won.</Bullet>
                  <Bullet icon="tune"><Strong>Calibrate benchmarks</Strong> — set your own cost-per-ticket and average lead value so every figure reflects your business.</Bullet>
                </ul>
              </section>

              {/* Conversations */}
              <section id="conversations" className="scroll-mt-24 space-y-4">
                <H2 icon="forum">Conversations</H2>
                <Lead>
                  Read back every chat your visitors had. Vaayu flags conversations where it couldn’t answer well — labelled{' '}
                  <Strong>Has gaps</Strong> — so you know exactly what content to add next.
                </Lead>
                <Figure name="insights-conversations" alt="The Conversations list with message counts and a Has Gaps indicator" caption="Conversations — browse every chat, filter to Unanswered, and spot “Has gaps” so you can close knowledge holes." />
                <ul className="space-y-2.5">
                  <Bullet><Strong>Full transcripts</Strong> — expand any conversation to read the whole exchange.</Bullet>
                  <Bullet icon="filter_list"><Strong>Unanswered filter</Strong> — jump straight to chats the bot struggled with.</Bullet>
                  <Bullet icon="auto_fix_high"><Strong>Close the loop</Strong> — add the missing answer in Train AI and the gap disappears.</Bullet>
                </ul>
              </section>

              {/* Analytics */}
              <section id="analytics" className="scroll-mt-24 space-y-4">
                <H2 icon="monitoring">Analytics</H2>
                <Lead>
                  A bird’s-eye view of trends over time — conversation volume, lead flow and the questions customers ask most.
                  Use it to spot patterns and decide where to focus.
                </Lead>
                <Figure name="insights-analytics" alt="The Analytics tab with trend charts and top customer questions" caption="Analytics — volume and lead trends over time, plus the topics your customers ask about most." />
              </section>

              {/* ════════ ACCOUNT & HELP ════════ */}

              {/* Billing */}
              <section id="billing" className="scroll-mt-24 space-y-4">
                <H2 icon="credit_card">Settings &amp; Billing</H2>
                <Lead>
                  Manage your workspace, plan and payment details from <Strong>Settings</Strong>. Upgrades take effect immediately,
                  and downgrades apply at the end of your current billing period.
                </Lead>
                <ul className="space-y-2.5">
                  <Bullet icon="manage_accounts"><Strong>Account</Strong> — update your name, email and workspace details.</Bullet>
                  <Bullet icon="receipt_long"><Strong>Billing</Strong> — view your plan, change it, and access invoices via the secure checkout.</Bullet>
                  <Bullet icon="palette"><Strong>Customize</Strong> — the same look-and-feel controls covered above, reachable from Settings.</Bullet>
                </ul>
                <Callout tone="info">
                  Need to change plans? Open the{' '}
                  <Link href="/pricing" className="font-semibold underline underline-offset-2">pricing page</Link> or your dashboard billing settings — payment is processed securely and your features update right away.
                </Callout>
              </section>

              {/* Support */}
              <section id="support" className="scroll-mt-24">
                <div className="rounded-2xl p-6 sm:p-8 bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.05] text-center">
                  <span className="material-symbols-outlined text-[36px] text-slate-300 dark:text-slate-600 mb-3 block">support_agent</span>
                  <h2 className="text-xl md:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-100 mb-2">Getting help</h2>
                  <p className="text-[15px] text-slate-600 dark:text-slate-300 leading-relaxed mb-6 max-w-md mx-auto">
                    Stuck on something, or want a hand getting set up? Our team is one message away and happy to walk you through any step in this guide.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <Link href="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity active:scale-[0.98]">
                      <span className="material-symbols-outlined text-[16px]">mail</span>Message support
                    </Link>
                    <Link href="/demo/bots" className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-slate-700 dark:text-slate-200 text-sm font-semibold rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors">
                      <span className="material-symbols-outlined text-[16px]">explore</span>Open the live demo
                    </Link>
                  </div>
                </div>
              </section>

              {/* CTA */}
              <section className="rounded-2xl p-6 sm:p-10 text-center relative overflow-hidden bg-slate-900 dark:bg-white/[0.04]">
                <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(ellipse_at_top_right,white,transparent_70%)] pointer-events-none" />
                <div className="relative z-10 space-y-4">
                  <h2 className="text-xl md:text-2xl font-medium tracking-tight text-white dark:text-slate-100">Ready to put Vaayu to work?</h2>
                  <p className="text-[15px] text-slate-200 dark:text-slate-300 max-w-sm mx-auto leading-relaxed">
                    Create your bot, paste one line of code, and start turning conversations into measurable revenue.
                  </p>
                  <div className="pt-1">
                    <Link href="/dashboard/pricing" className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-100 text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-100 transition-colors active:scale-[0.98]">
                      Get started free<span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </Link>
                  </div>
                </div>
              </section>

            </div>
          </main>

          {/* ── Right: On This Page ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto custom-scrollbar">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 px-3 mb-3">
                <span className="material-symbols-outlined text-[14px]">toc</span>On this page
              </p>
              <div className="space-y-0.5">
                {FLAT.map((it) => (
                  <button
                    key={it.id}
                    onClick={() => scrollTo(it.id)}
                    className={`block w-full text-left px-3 py-1.5 rounded-lg text-[13px] leading-snug transition-colors ${
                      activeId === it.id
                        ? 'text-slate-900 dark:text-slate-100 font-semibold'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                  >
                    {it.label}
                  </button>
                ))}
              </div>
              <Link href="/" className="flex items-center gap-2 px-3 mt-5 pt-4 border-t border-slate-100 dark:border-white/[0.05] text-[13px] text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                <span className="material-symbols-outlined text-[15px]">arrow_back</span>Back to home
              </Link>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
};

export default VaayuDocs;
