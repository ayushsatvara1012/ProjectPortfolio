import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

/* ─────────────────────────────────────────────────────────────────────────────
   SHARED UI ATOMS
 ───────────────────────────────────────────────────────────────────────────── */

export const Cell = ({ children, className = '', onClick }: { children: React.ReactNode, className?: string, onClick?: () => void }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-slate-950 p-8 lg:p-12 flex flex-col transition-colors duration-200 ${className}`}
  >
    {children}
  </div>
);

export const Label = ({ icon, children }: { icon?: string, children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-xs uppercase tracking-widest font-bold text-slate-400 dark:text-slate-500 font-google mb-6">
    {icon && <span className="material-symbols-outlined text-[14px]">{icon}</span>}
    {children}
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   SERVER COMPONENTS
 ───────────────────────────────────────────────────────────────────────────── */

export const HeroCell = () => (
  <div className="lg:col-span-2 min-h-[420px] sm:min-h-[500px] lg:min-h-[480px] relative overflow-hidden flex flex-col justify-between group">
    <div className="absolute inset-0 bg-linear-to-b from-white/85 via-white/75 to-white/95 dark:from-slate-950/85 dark:via-slate-950/75 dark:to-slate-950/95 transition-colors duration-500" />
    <div className="absolute -top-65 -right-60 w-lg h-lg sm:w-160 sm:h-160 md:w-3xl md:h-3xl lg:w-4xl lg:h-4xl opacity-20 dark:opacity-20 pointer-events-none select-none translate-x-20 translate-y-20 sm:translate-x-28 sm:translate-y-28">
      <Image
        src="/globe.svg"
        alt="Decorative globe"
        aria-hidden="true"
        fill
        className="object-contain"
      />
    </div>
    <div className="relative z-10 flex flex-col justify-between flex-1 p-8 lg:p-12">
      <div>
        <Label icon="person">Founder · Lead Engineer</Label>
        <h1 className="text-5xl md:text-7xl font-google font-semibold tracking-tight leading-none text-slate-900 dark:text-slate-100 mb-6">
          Built by One<br />
          <span className="text-blue-600">Scaled for</span><br />
          the World.
        </h1>
        <p className="text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">
          I'm <strong className="text-slate-900 dark:text-slate-200 font-bold">Ayush Satvara</strong> — the solo architect, engineer, and founder
          behind Sapybase. Every line of infrastructure, from the RAG pipeline to the
          React UI, was designed and shipped by one person.
        </p>
      </div>
    </div>
  </div>
);

export const ProfileCell = () => (
  <Cell className="items-center justify-center min-h-[360px] lg:min-h-0 p-0 overflow-hidden relative bg-slate-50 dark:bg-slate-900">
    <Image
      src="/IMG_9145.webp"
      alt="Ayush Satvara"
      fill
      sizes="(max-width: 1024px) 100vw, 50vw"
      className="object-cover transition-all duration-700 min-h-[300px] lg:min-h-full"
      style={{ objectPosition: 'center top' }}
    />
    <div className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-950/90 border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between">
      <div>
        <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-400">MS Computer Science</p>
        <p className="text-sm font-google font-bold text-slate-900 dark:text-slate-200">NYIT · GPA 3.26</p>
      </div>
      <span className="material-symbols-outlined text-[18px] text-slate-300 dark:text-slate-700">school</span>
    </div>
  </Cell>
);

export const MetricsStrip = () => (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 dark:bg-slate-800 border-x border-b border-slate-200 dark:border-slate-800 transition-colors duration-500">
    {[
      { eyebrow: 'Bot Response Time', value: '<2s', icon: 'bolt', accent: 'text-blue-500' },
      { eyebrow: 'Chatbot Uptime', value: '99.9%', icon: 'verified_user', accent: 'text-green-500' },
      { eyebrow: 'Deploy Time', value: '< 10 min', icon: 'rocket_launch', accent: 'text-blue-500' },
      { eyebrow: 'Platforms Supported', value: 'Any HTML', icon: 'devices', accent: 'text-green-500' },
    ].map((m, i) => (
      <div key={i} className="bg-white dark:bg-slate-950 p-8 lg:p-10 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs tracking-widest font-medium text-slate-400 dark:text-slate-500 font-google">
          <span className={`material-symbols-outlined text-base ${m.accent}`}>{m.icon}</span>
          {m.eyebrow}
        </div>
        <div className="text-3xl md:text-4xl font-google font-semibold tracking-wider text-slate-900 dark:text-slate-100 tabular-nums leading-none group-hover/cell:translate-x-0.5 transition-transform duration-200">
          {m.value}
        </div>
      </div>
    ))}
  </div>
);

export const TechStackCell = ({ stack }: { stack: { name: string, note: string }[] }) => (
  <Cell>
    <Label icon="memory">Core Stack</Label>
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
      {stack.map((t, i) => (
        <div key={i} className="flex items-center justify-between py-2.5 group/row">
          <span className="text-sm font-google font-bold text-slate-800 dark:text-slate-200 group-hover/row:text-blue-600 dark:group-hover/row:text-blue-400 transition-colors duration-150">
            {t.name}
          </span>
          <span className="text-xs font-google text-slate-400 dark:text-slate-600 uppercase tracking-wider">
            {t.note}
          </span>
        </div>
      ))}
    </div>
  </Cell>
);

export const EducationCell = () => (
  <Cell>
    <Label icon="school">Education</Label>
    <div className="flex flex-col gap-6">
      <div className="border-l-2 border-blue-500 pl-4">
        <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-400 mb-1">2023 – 2025</p>
        <h3 className="text-lg font-google font-bold text-slate-900 dark:text-slate-100 leading-tight">
          MS Computer Science
        </h3>
        <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-1">
          New York Institute of Technology
        </p>
        <div className="inline-flex items-center gap-1.5 mt-3 px-2 py-0.5 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <span className="text-xs font-google font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">GPA 3.26 / 4.0</span>
        </div>
      </div>
      <div className="border-l-2 border-slate-200 dark:border-slate-800 pl-4">
        <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-400 mb-1">2019 – 2023</p>
        <h3 className="text-lg font-google font-bold text-slate-900 dark:text-slate-100 leading-tight">
          BTech Information Technology
        </h3>
        <p className="text-sm font-google text-slate-500 dark:text-slate-400 mt-1">
          KSV University
        </p>
        <div className="inline-flex items-center gap-1.5 mt-3 px-2 py-0.5 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20">
          <span className="text-xs font-google font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">CGPA 7.52 / 10</span>
        </div>
      </div>
    </div>
  </Cell>
);

export const CertificationsCell = ({ certifications }: { certifications: { name: string, issuer: string }[] }) => (
  <Cell >
    <Label icon="workspace_premium">Certifications</Label>
    <div className="flex flex-col divide-y divide-slate-100 dark:divide-slate-800">
      {certifications.map((c, i) => (
        <div key={i} className="flex flex-col gap-0.5 py-3 group/row">
          <span className="text-base font-google font-bold text-slate-800 dark:text-slate-200 group-hover/row:text-blue-600 dark:group-hover/row:text-blue-400 transition-colors duration-150 leading-snug pb-3">
            {c.name}
          </span>
          <span className="text-sm font-google text-slate-400 dark:text-slate-600 uppercase tracking-wider">
            {c.issuer}
          </span>
        </div>
      ))}
    </div>
  </Cell>
);

export const DeliverablesCell = () => (
  <Cell >
    <Label icon="lightbulb">What We Deliver</Label>
    <div className="flex flex-col gap-5">
      {[
        {
          heading: 'AI Chatbot on Your Website',
          body: 'We build a custom AI assistant trained on your own content — your FAQs, product pages, and docs. Your visitors get instant, accurate answers 24/7 without you lifting a finger.',
          icon: 'smart_toy',
          accent: 'text-blue-500',
        },
        {
          heading: 'Trained on Your Data, Not the Internet',
          body: 'Unlike generic AI tools, your bot only knows what you teach it. Upload a PDF, paste a URL, or type your policies — the bot sticks to your information and never makes things up.',
          icon: 'database',
          accent: 'text-green-500',
        },
        {
          heading: 'Embed in 60 Seconds',
          body: 'One script tag. Paste it into any website — Shopify, Webflow, WordPress, or plain HTML — and your chatbot is live. No developer needed after the initial setup.',
          icon: 'code',
          accent: 'text-blue-500',
        },
        {
          heading: 'Full Control from a Dashboard',
          body: "Retrain the bot when your content changes, adjust its tone and name, and watch real conversations in the dashboard. You own every setting — no black box.",
          icon: 'tune',
          accent: 'text-green-500',
        },
      ].map((p, i) => (
        <div key={i} className="flex gap-3">
          <span className={`material-symbols-outlined text-[18px] mt-0.5 shrink-0 ${p.accent}`}>{p.icon}</span>
          <div>
            <p className="text-base font-google font-semibold text-slate-900 dark:text-slate-100 leading-none mb-1">{p.heading}</p>
            <p className="text-sm font-google text-slate-500 dark:text-slate-400 leading-relaxed">{p.body}</p>
          </div>
        </div>
      ))}
    </div>
  </Cell>
);

export const CTAStrip = () => (
  <div className="border-x border-b border-slate-200 dark:border-slate-800 bg-slate-950 dark:bg-slate-950 p-12 md:p-20 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-8 transition-colors duration-500">
    <div>
      <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-500 mb-4">
        Deployment Status · <span className="text-green-500">Optimal</span>
      </p>
      <h2 className="text-4xl md:text-6xl font-google font-black tracking-tight text-white leading-none">
        Performance-First.<br />
        <span className="text-blue-500">Always.</span>
      </h2>
    </div>
    <div className="flex flex-col sm:flex-row gap-3 shrink-0">
      <Link
        href="/contact"
        className="inline-flex items-center gap-2 px-7 py-4 bg-blue-600 hover:bg-blue-500 text-white text-base font-google font-medium tracking-wider transition-colors duration-150 rounded-full"
      >
        Start Building
        <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
      </Link>
      <Link
        href="/services"
        className="inline-flex items-center gap-2 px-7 py-4 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-base font-google font-medium tracking-wider transition-colors duration-150 rounded-full"
      >
        View Services
      </Link>
    </div>
  </div>
);
