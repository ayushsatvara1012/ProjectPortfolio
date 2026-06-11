'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';

// ── Media block ───────────────────────────────────────────────────────────────

const DocMedia = ({ alt, placeholderText, src }: { alt: string; placeholderText?: string; src?: string }) => {
  const isVideo = src && /\.(mp4|webm|ogg|mov)$/i.test(src);
  // Videos only start downloading once the block nears the viewport — the docs
  // page embeds ~15 MB of autoplay recordings that would otherwise all fetch on load.
  const containerRef = useRef<HTMLDivElement>(null);
  const [videoVisible, setVideoVisible] = useState(false);
  useEffect(() => {
    if (!isVideo || videoVisible || !containerRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setVideoVisible(true);
      },
      { rootMargin: '400px' }
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [isVideo, videoVisible]);
  return (
    <div ref={containerRef} className="group relative aspect-video w-full rounded-2xl overflow-hidden my-5 bg-slate-100 dark:bg-white/[0.04] transition-colors duration-500">
      {src ? (
        isVideo ? (
          videoVisible ? (
            <video src={src} autoPlay loop muted playsInline preload="metadata" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full" aria-label={alt} />
          )
        ) : (
          <Image src={src} alt={alt} fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" />
        )
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center border-2 border-dashed border-slate-200 dark:border-white/[0.06] rounded-2xl">
          <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-600 mb-3 select-none">
            {placeholderText?.toLowerCase().includes('video') || placeholderText?.toLowerCase().includes('recording') ? 'videocam' : 'image'}
          </span>
          <p className="text-xs font-semibold font-google text-slate-400 dark:text-slate-600 uppercase tracking-widest leading-snug max-w-[240px]">
            {placeholderText || 'Media Placeholder'}
          </p>
        </div>
      )}
      <div className="absolute bottom-3 right-3 px-2.5 py-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-lg border border-slate-100 dark:border-white/[0.06] opacity-0 group-hover:opacity-100 transition-opacity">
        <span className="text-xs font-medium tracking-wider uppercase text-slate-450 dark:text-slate-500">{alt}</span>
      </div>
    </div>
  );
};

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = { apiKey?: string; apiUrl?: string; standalone?: boolean };

// ── Main component ────────────────────────────────────────────────────────────

const BotIntegrationDocs = ({ apiKey = 'YOUR_API_KEY', apiUrl = 'https://www.sapybase.com', standalone = false }: Props) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('setup');
  const [copied, setCopied] = useState<string | null>(null);
  const [integrationTab, setIntegrationTab] = useState('html');
  const menuRef = useRef<HTMLDivElement>(null);

  const handleCopy = (text: string, id: string) => {
    const fallback = () => {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    };
    try {
      if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(id);
          setTimeout(() => setCopied(null), 2000);
        }).catch(() => { if (fallback()) { setCopied(id); setTimeout(() => setCopied(null), 2000); } });
      } else {
        if (fallback()) { setCopied(id); setTimeout(() => setCopied(null), 2000); }
      }
    } catch { fallback(); }
  };

  // ── Syntax-highlighted code block ──────────────────────────────────────────

  const CodeBlock = ({ code, id }: { code: string; id: string }) => {
    const tokens = [
      { name: 'comment', regex: /(&lt;!--[\s\S]*?--&gt;|\{\/\*[\s\S]*?\*\/\}|\/\/.*)/g, color: 'text-slate-500 italic' },
      { name: 'string', regex: /(&quot;.*?&quot;|&#39;.*?&#39;|".*?"|'.*?'|`[\s\S]*?`)/g, color: 'text-emerald-400' },
      { name: 'tag', regex: /(&lt;\/?[a-zA-Z0-9]+)/g, color: 'text-rose-400' },
      { name: 'attr', regex: /\b(lang|src|defer|href|rel|target|id|strategy|type|apiKey|apiUrl|className|key|value|source|headers)\b(?==|:|\s|&gt;)/g, color: 'text-amber-300' },
      { name: 'keyword', regex: /\b(window|SapybaseConfig|document|console|Script|import|export|default|function|return|const|let|var|from|async|await)\b/g, color: 'text-blue-400' },
      { name: 'doctype', regex: /(&lt;!DOCTYPE html&gt;)/gi, color: 'text-blue-300' },
    ];

    let escaped = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    let segments: { text: string; isRaw: boolean }[] = [{ text: escaped, isRaw: true }];

    tokens.forEach(token => {
      const newSegments: { text: string; isRaw: boolean }[] = [];
      segments.forEach(seg => {
        if (!seg.isRaw) { newSegments.push(seg); return; }
        let lastIndex = 0;
        let match;
        token.regex.lastIndex = 0;
        while ((match = token.regex.exec(seg.text)) !== null) {
          if (match.index > lastIndex) newSegments.push({ text: seg.text.substring(lastIndex, match.index), isRaw: true });
          newSegments.push({ text: `<span class="${token.color}">${match[0]}</span>`, isRaw: false });
          lastIndex = token.regex.lastIndex;
          if (!token.regex.global) break;
        }
        if (lastIndex < seg.text.length) newSegments.push({ text: seg.text.substring(lastIndex), isRaw: true });
      });
      segments = newSegments;
    });

    const finalHtml = segments.map(s => s.text).join('');
    const isCopied = copied === id;

    return (
      <div className="relative group mt-4">
        <div className="rounded-2xl overflow-hidden bg-slate-900 dark:bg-slate-950 border border-white/[0.06]">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
              <span className="w-2.5 h-2.5 rounded-full bg-slate-700" />
            </div>
            <button
              onClick={() => handleCopy(code, id)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500 hover:text-slate-200 bg-white/[0.04] hover:bg-white/[0.08] rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[13px]">{isCopied ? 'check' : 'content_copy'}</span>
              {isCopied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <div className="p-4 overflow-x-auto custom-scrollbar">
            <pre className="m-0 text-[12px] sm:text-[13px] leading-relaxed font-mono text-slate-300">
              <code dangerouslySetInnerHTML={{ __html: finalHtml }} />
            </pre>
          </div>
        </div>
      </div>
    );
  };

  // ── Section badge ──────────────────────────────────────────────────────────

  const StepBadge = ({ n, icon }: { n?: number | string; icon?: string }) => (
    <span className="shrink-0 w-7 h-7 bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center text-xs font-semibold font-google rounded-xl select-none transition-colors">
      {icon ? <span className="material-symbols-outlined text-[14px]">{icon}</span> : n}
    </span>
  );

  // ── Nav links ──────────────────────────────────────────────────────────────

  const navLinks = [
    { id: 'setup',        label: 'Account Setup',    icon: 'person_add' },
    { id: 'integration',  label: 'Integration',      icon: 'code' },
    { id: 'csp',          label: 'CSP / Security',   icon: 'shield' },
    { id: 'customization',label: 'Customization',    icon: 'palette' },
    { id: 'training',     label: 'Training AI',      icon: 'model_training' },
    { id: 'knowledge',    label: 'Knowledge Base',   icon: 'database' },
    { id: 'multiple-bots',label: 'Managing Bots',    icon: 'hub' },
    { id: 'support',      label: 'Getting Help',     icon: 'support_agent' },
  ];

  // ── Scroll tracking ────────────────────────────────────────────────────────

  useEffect(() => {
    const handleScroll = () => {
      const ids = navLinks.map(l => l.id);
      const scrollPos = window.scrollY + 130;
      for (let i = ids.length - 1; i >= 0; i--) {
        const el = document.getElementById(ids[i]);
        if (el && scrollPos >= el.offsetTop) { setActiveSection(ids[i]); break; }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
    setIsMenuOpen(false);
  };

  // ── Close mobile menu on outside click ────────────────────────────────────

  useEffect(() => {
    if (!isMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isMenuOpen]);

  // ── Non-standalone (embedded) mode ────────────────────────────────────────

  if (!standalone) {
    return (
      <div className="bg-white dark:bg-white/[0.02] rounded-2xl border border-slate-100 dark:border-white/[0.04] p-6 transition-colors duration-500">
        <div className="flex items-center gap-2.5 mb-4">
          <span className="material-symbols-outlined text-[20px] text-slate-500 dark:text-slate-400">rocket_launch</span>
          <h3 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200">Final Step: Integration</h3>
        </div>
        <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed mb-4">
          Copy the snippet below and paste it before <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.04] rounded-lg text-xs font-mono">&lt;/body&gt;</code> on every page. Need help?{' '}
          <Link href="/docs" className="font-semibold text-slate-700 dark:text-slate-300 underline underline-offset-4 hover:text-slate-900 dark:hover:text-slate-100 transition-colors">Full guide →</Link>
        </p>
        <CodeBlock id="embed-snippet" code={`<!-- Paste before </body> on every page -->\n<script src="https://www.sapybase.com/sapybase-loader@1.js"\n        data-bot-id="${apiKey}"\n        defer></script>`} />
      </div>
    );
  }

  // ── Standalone (full page) mode ───────────────────────────────────────────

  const integrationTabs = [
    { id: 'html',      label: 'HTML' },
    { id: 'react',     label: 'React' },
    { id: 'nextjs',    label: 'Next.js' },
    { id: 'wordpress', label: 'WordPress' },
    { id: 'shopify',   label: 'Shopify' },
  ];

  const quickLinks = [
    { href: '/',                    label: 'Home',        icon: 'home' },
    { href: '/dashboard',           label: 'Dashboard',   icon: 'dashboard' },
    { href: '/pricing',             label: 'Pricing',     icon: 'payments' },
    { href: '/dashboard/train',     label: 'Train AI',    icon: 'model_training' },
    { href: '/dashboard/bots',      label: 'My Bots',     icon: 'smart_toy' },
    { href: '/about',               label: 'About',       icon: 'info' },
    { href: '/contact',             label: 'Contact',     icon: 'mail' },
  ];

  return (
    <div className="min-h-screen bg-transparent font-google transition-colors duration-500">

      {/* ── Mobile sticky nav ── */}
      <div ref={menuRef} className="lg:hidden sticky top-20 z-30 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md border-b border-slate-100 dark:border-white/[0.04] px-4 py-3 transition-colors duration-500">
        <button
          onClick={() => setIsMenuOpen(p => !p)}
          className="flex items-center justify-between w-full"
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400">menu_book</span>
            <span className="text-base font-semibold font-google text-slate-700 dark:text-slate-300">
              {navLinks.find(l => l.id === activeSection)?.label ?? 'Contents'}
            </span>
          </div>
          <span className="material-symbols-outlined text-[20px] text-slate-400 transition-transform duration-200" style={{ transform: isMenuOpen ? 'rotate(180deg)' : 'none' }}>
            expand_more
          </span>
        </button>

        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute top-[calc(100%+4px)] left-3 right-3 z-40 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/[0.04] shadow-xl rounded-2xl overflow-hidden transition-colors"
            >
              <nav className="p-2 space-y-0.5">
                {navLinks.map(link => (
                  <button
                    key={link.id}
                    onClick={() => scrollTo(link.id)}
                    className={`flex items-center gap-3 w-full text-left px-4 py-3 rounded-xl transition-colors text-base font-google ${
                      activeSection === link.id
                        ? 'bg-slate-100 dark:bg-white/[0.06] text-slate-900 dark:text-slate-100 font-semibold'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.02] hover:text-slate-900 dark:hover:text-slate-100'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[17px] shrink-0 ${activeSection === link.id ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
                      {link.icon}
                    </span>
                    {link.label}
                  </button>
                ))}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Page body ── */}
      <div className="max-w-8xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
        <div className="lg:grid lg:grid-cols-[220px_1fr_180px] lg:gap-10 xl:gap-14">

          {/* ── Left sidebar ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500 px-3 mb-3">Contents</p>
              {navLinks.map(link => (
                <button
                  key={link.id}
                  onClick={() => scrollTo(link.id)}
                  className={`flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-xl transition-colors text-base font-google group ${
                    activeSection === link.id
                      ? 'bg-white dark:bg-white/[0.04] text-slate-900 dark:text-slate-100 font-semibold shadow-sm'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-white/[0.02]'
                  }`}
                >
                  <span className={`material-symbols-outlined text-[17px] shrink-0 transition-colors ${
                    activeSection === link.id ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300'
                  }`}>
                    {link.icon}
                  </span>
                  {link.label}
                </button>
              ))}
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="min-w-0 space-y-10 mt-6 lg:mt-0">

            {/* Hero */}
            <div className="space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] rounded-full text-xs font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500 transition-colors mt-10">
                <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
                Integration Guide
              </span>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-normal tracking-tight text-slate-900 dark:text-slate-200 leading-snug transition-colors">
                Sapybase AI Chat<br className="hidden sm:block" /> Integration Manual
              </h1>
              <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed max-w-xl">
                Everything you need to build and launch your custom AI chatbot — from account setup to going live on your website.
              </p>
            </div>

            {/* ── 1. Account Setup ── */}
            <section id="setup" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge n={1} />
                <h2 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200 transition-colors">Account Setup &amp; Registration</h2>
              </div>
              <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed">
                First things first — create your account and tell us about your business.
              </p>
              <ul className="space-y-2.5 text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[15px] text-slate-400 mt-0.5 shrink-0">check_circle</span><span><strong className="font-semibold text-slate-700 dark:text-slate-300">Sign up</strong> using your email or Google account.</span></li>
                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[15px] text-slate-400 mt-0.5 shrink-0">check_circle</span><span><strong className="font-semibold text-slate-700 dark:text-slate-300">Chatbot ID</strong> — we automatically provision isolated storage so your data stays secure.</span></li>
              </ul>
              <DocMedia alt="Registration Screen" placeholderText="Screen Recording: Walking through the Registration Screen showing the Business Name input and account setup fields." src="/videos/registration_sapybase.mp4" />
              <ul className="space-y-2.5 text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[15px] text-slate-400 mt-0.5 shrink-0">check_circle</span><span>After registration you'll be redirected to the dashboard.</span></li>
                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[15px] text-slate-400 mt-0.5 shrink-0">check_circle</span><span><strong className="font-semibold text-slate-700 dark:text-slate-300">Subscribe</strong> — choose the plan that suits your needs.</span></li>
                <li className="flex items-start gap-2"><span className="material-symbols-outlined text-[15px] text-slate-400 mt-0.5 shrink-0">check_circle</span><span><strong className="font-semibold text-slate-700 dark:text-slate-300">Business profile</strong> — give your bot a company name and website URL.</span></li>
              </ul>
              <DocMedia alt="Bot Creation" placeholderText="Screen Recording: Walking through the Bot Creation screen." src="/videos/Bot_Creation.mp4" />
            </section>

            {/* ── 2. Integration ── */}
            <section id="integration" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge n={2} />
                <h2 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200 transition-colors">Integrating the Chatbot</h2>
              </div>
              <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed">
                Adding the chatbot is as simple as copying and pasting a single snippet.
              </p>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1.5 pb-3 border-b border-slate-100 dark:border-white/[0.04]">
                {integrationTabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setIntegrationTab(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold font-google rounded-lg transition-colors ${
                      integrationTab === tab.id
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                        : 'bg-white dark:bg-white/[0.04] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 border border-slate-200 dark:border-white/[0.06]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="bg-white dark:bg-white/[0.02] rounded-2xl p-5 border border-slate-100 dark:border-white/[0.04] transition-colors duration-500">
                {integrationTab === 'html' && (
                  <div className="space-y-3">
                    <p className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-300">Plain HTML / Static Websites</p>
                    <CodeBlock id="code-html" code={`<!DOCTYPE html>\n<html lang="en">\n<head>\n    <title>My Website</title>\n</head>\n<body>\n    <h1>Welcome to my business</h1>\n\n    <!-- Sapybase AI Chat Widget -->\n    <script src="https://www.sapybase.com/sapybase-loader@1.js"\n            data-bot-id="YOUR_API_KEY"\n            defer></script>\n</body>\n</html>`} />
                  </div>
                )}
                {integrationTab === 'react' && (
                  <div className="space-y-3">
                    <p className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-300">React (Vite or CRA)</p>
                    <CodeBlock id="code-react" code={`<body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n\n    <!-- Sapybase AI Chat Widget -->\n    <script src="https://www.sapybase.com/sapybase-loader@1.js"\n            data-bot-id="YOUR_API_KEY"\n            defer></script>\n</body>`} />
                  </div>
                )}
                {integrationTab === 'nextjs' && (
                  <div className="space-y-3">
                    <p className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-300">Next.js (App Router)</p>
                    <CodeBlock id="code-nextjs" code={`import Script from 'next/script';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>\n        {children}\n        {/* Sapybase AI Chat Widget */}\n        <Script\n          src="https://www.sapybase.com/sapybase-loader@1.js"\n          data-bot-id="YOUR_API_KEY"\n          strategy="lazyOnload"\n        />\n      </body>\n    </html>\n  );\n}`} />
                  </div>
                )}
                {integrationTab === 'wordpress' && (
                  <div className="space-y-3">
                    <p className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-300">WordPress</p>
                    <CodeBlock id="code-wordpress" code={`<!-- Appearance > Theme Editor > theme.liquid, before </body> -->\n<script src="https://www.sapybase.com/sapybase-loader@1.js"\n        data-bot-id="YOUR_API_KEY"\n        defer></script>`} />
                  </div>
                )}
                {integrationTab === 'shopify' && (
                  <div className="space-y-3">
                    <p className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-300">Shopify</p>
                    <CodeBlock id="code-shopify" code={`<!-- Online Store > Themes > Edit Code > theme.liquid, before </body> -->\n<script src="https://www.sapybase.com/sapybase-loader@1.js"\n        data-bot-id="YOUR_API_KEY"\n        defer></script>`} />
                  </div>
                )}
              </div>

              <DocMedia alt="Dashboard Snippet Copy" placeholderText="Screen Recording: Showing how to copy the Snippet and find the API Key in the Dashboard." src="/videos/Integrate_Bot.mp4" />
            </section>

            {/* ── 2b. CSP ── */}
            <section id="csp" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge icon="shield" />
                <h2 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200 transition-colors">Content Security Policy (CSP)</h2>
              </div>
              <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed">
                If your site sends a <strong className="font-semibold text-slate-600 dark:text-slate-300">Content-Security-Policy</strong> header, you need to whitelist Sapybase so the widget can load and the chat iframe can connect to our servers.
              </p>

              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-2xl">
                <span className="material-symbols-outlined text-[18px] text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">info</span>
                <p className="text-sm lg:text-base font-normal leading-relaxed text-amber-800 dark:text-amber-300">
                  Most static HTML sites do <strong>not</strong> set a CSP header and can skip this section. You only need this if you already have a <code className="px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-xs font-mono">Content-Security-Policy</code> header.
                </p>
              </div>

              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-300">Minimum required directives</p>
                  <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed">Add these to your existing CSP — extend it, don't replace it:</p>
                  <CodeBlock id="code-csp-min" code={`Content-Security-Policy:\n  script-src   'self' https://www.sapybase.com;\n  frame-src    https://www.sapybase.com;\n  connect-src  'self' https://www.sapybase.com;\n  img-src      'self' data: blob: https://www.sapybase.com;`} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-300">Next.js — next.config.mjs</p>
                  <CodeBlock id="code-csp-next" code={`// next.config.mjs\nasync headers() {\n  return [\n    {\n      source: '/:path*',\n      headers: [\n        {\n          key: 'Content-Security-Policy',\n          value: [\n            "default-src 'self'",\n            "script-src 'self' 'unsafe-inline' https://www.sapybase.com",\n            "frame-src https://www.sapybase.com",\n            "connect-src 'self' https://www.sapybase.com",\n            "img-src 'self' data: blob: https://www.sapybase.com",\n          ].join('; '),\n        },\n      ],\n    },\n  ];\n}`} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-300">Nginx</p>
                  <CodeBlock id="code-csp-nginx" code={`add_header Content-Security-Policy\n  "default-src 'self'; script-src 'self' https://www.sapybase.com; frame-src https://www.sapybase.com; connect-src 'self' https://www.sapybase.com; img-src 'self' data: blob: https://www.sapybase.com"\n  always;`} />
                </div>

                <div className="space-y-2">
                  <p className="text-sm lg:text-base font-semibold text-slate-700 dark:text-slate-300">Apache (.htaccess)</p>
                  <CodeBlock id="code-csp-apache" code={`Header always set Content-Security-Policy \\\n  "default-src 'self'; script-src 'self' https://www.sapybase.com; frame-src https://www.sapybase.com; connect-src 'self' https://www.sapybase.com; img-src 'self' data: blob: https://www.sapybase.com"`} />
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-white dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] rounded-2xl transition-colors">
                <span className="material-symbols-outlined text-[18px] text-slate-500 dark:text-slate-400 shrink-0 mt-0.5">lightbulb</span>
                <div className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed space-y-1">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Why <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.04] rounded-lg text-xs font-mono">connect-src</code> needs Sapybase</p>
                  <p>The loader and the AI backend are both served through <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-white/[0.04] rounded-lg text-xs font-mono">www.sapybase.com</code>. This domain must be whitelisted for the chat to function.</p>
                </div>
              </div>
            </section>

            {/* ── 3. Customization ── */}
            <section id="customization" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge n={3} />
                <h2 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200 transition-colors">Customizing Look &amp; Feel</h2>
              </div>
              <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed">
                Every change you make in the dashboard updates your website <strong className="font-semibold text-slate-600 dark:text-slate-300">instantly</strong> — no redeploy needed.
              </p>
              <DocMedia alt="Customization Settings" placeholderText="Screen Recording: Moving through the Settings tab, changing colors, and uploading a logo with instant preview." src="/videos/Customise_Bot.mp4" />
            </section>

            {/* ── 4. Training ── */}
            <section id="training" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge n={4} />
                <h2 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200 transition-colors">Training the AI</h2>
              </div>
              <ul className="space-y-2.5 text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed">
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[15px] text-slate-400 mt-0.5 shrink-0">upload_file</span>
                  <span><strong className="font-semibold text-slate-700 dark:text-slate-300">Upload files</strong> — drop in PDFs, Word docs, or manuals. The AI reads every page.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="material-symbols-outlined text-[15px] text-slate-400 mt-0.5 shrink-0">language</span>
                  <span><strong className="font-semibold text-slate-700 dark:text-slate-300">Website sync</strong> — paste your URL and the AI will crawl it to learn your latest content.</span>
                </li>
              </ul>
              <DocMedia alt="Training Interface" placeholderText="Screen Recording: How to use the URL crawler and drag-and-drop file upload for training the AI." src="/videos/Train_Bot.mp4" />
            </section>

            {/* ── 5. Knowledge ── */}
            <section id="knowledge" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge n={5} />
                <h2 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200 transition-colors">Managing Knowledge</h2>
              </div>
              <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/20 rounded-2xl">
                <span className="material-symbols-outlined text-[18px] text-red-500 dark:text-red-400 shrink-0 mt-0.5">warning</span>
                <p className="text-sm lg:text-base font-normal leading-relaxed text-red-700 dark:text-red-400">
                  Deleting a knowledge chunk means the AI will forget that specific piece of information permanently.
                </p>
              </div>
              <DocMedia alt="Knowledge Base Management" placeholderText="Screen Recording: Managing the Knowledge Base, reviewing chunks, and deleting outdated information." />
            </section>

            {/* ── 6. Multiple Bots ── */}
            <section id="multiple-bots" className="scroll-mt-28 space-y-4">
              <div className="flex items-center gap-3">
                <StepBadge n={6} />
                <h2 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200 transition-colors">Managing Multiple Bots <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1">Pro</span></h2>
              </div>
              <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed">
                Our Pro plan lets you create and switch between entirely separate bots from a single dashboard.
              </p>
              <DocMedia alt="Agency Bot Manager" placeholderText="Screen Recording: Switching between multiple bots and creating a new bot instance in Agency Mode." src="/Manage_Bot.webp" />
            </section>

            {/* ── Support ── */}
            <section id="support" className="scroll-mt-28">
              <div className="bg-white dark:bg-white/[0.02] rounded-2xl p-6 sm:p-8 border border-slate-100 dark:border-white/[0.04] text-center transition-colors duration-500">
                <span className="material-symbols-outlined text-[36px] text-slate-300 dark:text-slate-600 mb-4 block select-none">support_agent</span>
                <h3 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-slate-900 dark:text-slate-200 mb-2">Need a hand getting started?</h3>
                <p className="text-sm lg:text-base font-normal text-slate-600 dark:text-slate-400 lg:text-slate-700 lg:dark:text-slate-300 leading-relaxed mb-6 max-w-sm mx-auto">
                  If you get stuck or just want someone to walk you through it, our team is always just a message away.
                </p>
                <Link
                  href="/contact"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-base font-semibold font-google rounded-xl hover:bg-slate-700 dark:hover:bg-slate-200 transition-colors active:scale-[0.98]"
                >
                  <span className="material-symbols-outlined text-[16px]">mail</span>
                  Message Support
                </Link>
              </div>
            </section>

            {/* ── CTA ── */}
            <section className="bg-slate-900 dark:bg-white/[0.04] rounded-2xl p-6 sm:p-10 text-center overflow-hidden relative transition-colors duration-500">
              <div className="absolute inset-0 opacity-[0.04] bg-[radial-gradient(ellipse_at_top_right,white,transparent_70%)] pointer-events-none" />
              <div className="relative z-10 space-y-4">
                <h2 className="text-lg md:text-xl lg:text-2xl font-medium tracking-tight text-white dark:text-slate-200 leading-snug">
                  Ready to automate your customer support?
                </h2>
                <p className="text-base font-normal text-slate-100 lg:text-slate-400 lg:dark:text-slate-300 leading-relaxed max-w-xs mx-auto">
                  Set up your AI chatbot in minutes — no code required on most platforms.
                </p>
                <div className="pt-2">
                  <Link
                    href="/dashboard/pricing"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white dark:bg-slate-200 text-slate-900 text-base font-semibold font-google rounded-xl hover:bg-slate-100 dark:hover:bg-white transition-colors active:scale-[0.98]"
                  >
                    Get your AI chatbot
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </Link>
                </div>
              </div>
            </section>

          </main>

          {/* ── Right sidebar ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-24 space-y-1">
              <p className="text-xs font-medium tracking-wider uppercase text-slate-400 dark:text-slate-500 px-3 mb-3">Quick links</p>
              {quickLinks.map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-2.5 px-3 py-2 text-sm lg:text-base font-normal text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-white/60 dark:hover:bg-white/[0.02] rounded-xl transition-colors group"
                >
                  <span className="material-symbols-outlined text-[16px] text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-colors shrink-0">{link.icon}</span>
                  {link.label}
                </Link>
              ))}
            </div>
          </aside>

        </div>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-100 dark:border-white/[0.04] bg-[#f8f9fa] dark:bg-slate-900/50 py-8 mt-8 transition-colors duration-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-base font-google text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back to home
          </Link>
        </div>
      </footer>

    </div>
  );
};

export default BotIntegrationDocs;
