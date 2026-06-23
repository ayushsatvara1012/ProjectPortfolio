'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import ScrollReveal from '@/src/components/marketing/ScrollReveal';

// Each step's visual fires a single one-shot animation when it scrolls into
// view (framer-motion `whileInView` + `once: true`) and then rests in its final
// state — no infinite loops, no setInterval. That's the deliberate difference
// from the homepage version: nothing keeps animating in the background, which
// is what made the original heavy on mobile. `useReducedMotion` short-circuits
// every entrance so reduced-motion users get the final composition instantly.

const VIEWPORT = { once: true, margin: '-80px' } as const;

type StepId = 'ingest' | 'understand' | 'deploy';

const STEPS: {
  step: string;
  label: string;
  title: string;
  description: string;
  bullets: string[];
  visual: StepId;
}[] = [
  {
    step: '01',
    label: 'Ingest',
    title: 'Connect your data',
    description:
      'Vaayu crawls your website or accepts PDF, CSV, and raw-text uploads, then extracts every meaningful sentence — products, FAQs, pricing, policies — without you copying a single line.',
    bullets: [
      'Auto-sync when your website content changes',
      'Upload PDFs, CSVs, or paste raw text',
      'No manual database configuration',
    ],
    visual: 'ingest',
  },
  {
    step: '02',
    label: 'Understand',
    title: 'It reads intent, not keywords',
    description:
      'Keyword search breaks when a customer types “what does it cost?” instead of “pricing”. Vaayu turns every sentence into an AI fingerprint and matches on meaning — so it answers correctly instead of guessing.',
    bullets: [
      'Semantic, meaning-aware matching',
      'Guards against chatbot hallucination',
      'Context-aware conversation memory',
    ],
    visual: 'understand',
  },
  {
    step: '03',
    label: 'Deploy',
    title: 'Live in 60 seconds',
    description:
      'No backend, no servers. Copy one script tag into any HTML page — React, Next.js, Webflow, Shopify, WordPress — and your agent starts streaming answers to visitors immediately.',
    bullets: [
      'Works anywhere that accepts HTML',
      'Customize colors & avatar from the dashboard',
      'Real-time WebSocket answer streaming',
    ],
    visual: 'deploy',
  },
];

// ── Shared engine disc ───────────────────────────────────────────────────────
function EngineDisc({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md flex items-center justify-center ${className}`}
    >
      <img src="/logo2.svg" alt="Vaayu engine" className="w-[58%] h-[58%] object-contain" />
    </div>
  );
}

// ── Step 01 · Ingest ─────────────────────────────────────────────────────────
function IngestVisual({ reduced }: { reduced: boolean }) {
  const sources = [
    { icon: 'language', label: 'Website', top: '18%' },
    { icon: 'description', label: 'PDF', top: '50%' },
    { icon: 'table_chart', label: 'CSV', top: '82%' },
  ];

  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/10]">
      <svg viewBox="0 0 400 300" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden="true">
        <defs>
          <linearGradient id="vhiw-ingest" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
            <stop offset="100%" stopColor="#004DE8" stopOpacity="1" />
          </linearGradient>
        </defs>
        {[54, 150, 246].map((y, i) => {
          const d = `M 92 ${y} C 200 ${y}, 200 150, 300 150`;
          return (
            <g key={y}>
              <path
                d={d}
                stroke="#E2E8F0"
                strokeWidth="1.5"
                fill="none"
                className="dark:stroke-slate-800"
                strokeDasharray="4 4"
              />
              <motion.path
                d={d}
                stroke="url(#vhiw-ingest)"
                strokeWidth="2.5"
                fill="none"
                initial={reduced ? false : { pathLength: 0, opacity: 0 }}
                whileInView={reduced ? undefined : { pathLength: 1, opacity: 1 }}
                viewport={VIEWPORT}
                transition={{ duration: 0.8, delay: 0.25 + i * 0.15, ease: 'easeInOut' }}
              />
            </g>
          );
        })}
      </svg>

      {/* Source chips */}
      {sources.map((s, i) => (
        <motion.div
          key={s.label}
          className="absolute left-[4%] w-[34%] -translate-y-1/2"
          style={{ top: s.top }}
          initial={reduced ? false : { opacity: 0, x: -12 }}
          whileInView={reduced ? undefined : { opacity: 1, x: 0 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.45, delay: i * 0.1, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-2.5 py-2 shadow-sm">
            <span className="material-symbols-outlined text-[18px] text-[#004DE8]">{s.icon}</span>
            <span className="font-google text-xs font-medium text-slate-700 dark:text-slate-300">{s.label}</span>
          </div>
        </motion.div>
      ))}

      {/* Engine node */}
      <motion.div
        className="absolute right-[6%] top-1/2 -translate-y-1/2 flex flex-col items-center"
        initial={reduced ? false : { opacity: 0, scale: 0.8 }}
        whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.5, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <EngineDisc className="w-16 h-16 sm:w-20 sm:h-20" />
        <span className="mt-2 font-mono text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Vaayu Engine
        </span>
      </motion.div>
    </div>
  );
}

// ── Step 02 · Understand ─────────────────────────────────────────────────────
function UnderstandVisual({ reduced }: { reduced: boolean }) {
  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] flex flex-col items-center justify-center gap-5 px-4">
      {/* Query pill */}
      <motion.div
        className="w-full max-w-xs flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 shadow-sm"
        initial={reduced ? false : { opacity: 0, y: -10 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <span className="material-symbols-outlined text-[16px] text-[#004DE8] shrink-0">search</span>
        <span className="font-mono text-[11px] text-slate-700 dark:text-slate-200">“what does it cost?”</span>
      </motion.div>

      {/* Connector */}
      <svg viewBox="0 0 100 40" className="w-12 overflow-visible" aria-hidden="true">
        <line x1="50" y1="0" x2="50" y2="34" stroke="#E2E8F0" strokeWidth="2" className="dark:stroke-slate-800" strokeDasharray="3 3" />
        <motion.line
          x1="50" y1="0" x2="50" y2="34"
          stroke="#004DE8" strokeWidth="2.5"
          initial={reduced ? false : { pathLength: 0 }}
          whileInView={reduced ? undefined : { pathLength: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.4, delay: 0.35, ease: 'easeInOut' }}
        />
        <motion.path
          d="M 44 28 L 50 36 L 56 28"
          fill="none" stroke="#004DE8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          initial={reduced ? false : { opacity: 0 }}
          whileInView={reduced ? undefined : { opacity: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.2, delay: 0.7 }}
        />
      </svg>

      {/* Intent match card */}
      <motion.div
        className="w-full max-w-xs flex flex-col gap-2"
        initial={reduced ? false : { opacity: 0, scale: 0.92, y: 10 }}
        whileInView={reduced ? undefined : { opacity: 1, scale: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.45, delay: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-3 py-2 font-mono text-[10px] text-slate-500 dark:text-slate-400">
          Query embedding
          <span className="font-bold text-slate-800 dark:text-slate-200">97% match</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
          <span className="material-symbols-outlined text-[14px] text-emerald-500">check_circle</span>
          Pricing Details
        </div>
      </motion.div>
    </div>
  );
}

// ── Step 03 · Deploy ─────────────────────────────────────────────────────────
function DeployVisual({ reduced }: { reduced: boolean }) {
  return (
    <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] flex flex-col items-center justify-center gap-4 px-4">
      {/* Script snippet */}
      <motion.div
        className="w-full max-w-sm flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 shadow-sm"
        initial={reduced ? false : { opacity: 0, y: -10 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.45, ease: 'easeOut' }}
      >
        <div className="flex gap-1 shrink-0">
          <span className="w-2 h-2 rounded-full bg-rose-400/60" />
          <span className="w-2 h-2 rounded-full bg-amber-400/60" />
          <span className="w-2 h-2 rounded-full bg-emerald-400/60" />
        </div>
        <code className="flex-1 font-mono text-[9px] leading-none text-slate-600 dark:text-slate-400 truncate">
          <span className="text-[#004DE8]">&lt;script</span> src=<span className="text-emerald-600 dark:text-emerald-400">&quot;sapy.js&quot;</span><span className="text-[#004DE8]">&gt;</span>
        </code>
        <motion.span
          className="shrink-0 flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 font-mono text-[8px] font-medium text-emerald-600 dark:text-emerald-400"
          initial={reduced ? false : { opacity: 0, scale: 0.8 }}
          whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
          viewport={VIEWPORT}
          transition={{ duration: 0.3, delay: 0.55 }}
        >
          <span className="material-symbols-outlined text-[10px]">check</span>
          Copied
        </motion.span>
      </motion.div>

      {/* Browser frame */}
      <motion.div
        className="w-full max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg overflow-hidden"
        initial={reduced ? false : { opacity: 0, y: 14 }}
        whileInView={reduced ? undefined : { opacity: 1, y: 0 }}
        viewport={VIEWPORT}
        transition={{ duration: 0.5, delay: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-1.5">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
            <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
          <span className="flex-1 rounded bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800/50 px-2 py-0.5 text-center font-mono text-[8px] text-slate-400 dark:text-slate-500 truncate">
            yourwebsite.com
          </span>
        </div>
        <div className="relative p-3 h-24 bg-slate-50/30 dark:bg-slate-900/30">
          <div className="h-2 w-1/3 rounded-full bg-slate-200 dark:bg-slate-800" />
          <div className="mt-2 h-1.5 w-2/3 rounded-full bg-slate-100 dark:bg-slate-800/60" />
          <div className="mt-2 h-1.5 w-1/2 rounded-full bg-slate-100 dark:bg-slate-800/60" />
          {/* Live chat launcher */}
          <motion.div
            className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5"
            initial={reduced ? false : { opacity: 0, scale: 0 }}
            whileInView={reduced ? undefined : { opacity: 1, scale: 1 }}
            viewport={VIEWPORT}
            transition={{ duration: 0.4, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
            <span className="w-8 h-8 rounded-full bg-[#004DE8] flex items-center justify-center shadow-lg">
              <span className="material-symbols-outlined text-[16px] text-white">chat_bubble</span>
            </span>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}

function StepVisual({ visual, reduced }: { visual: StepId; reduced: boolean }) {
  if (visual === 'ingest') return <IngestVisual reduced={reduced} />;
  if (visual === 'understand') return <UnderstandVisual reduced={reduced} />;
  return <DeployVisual reduced={reduced} />;
}

export default function HowItWorks() {
  const reduced = useReducedMotion() ?? false;

  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 px-6 sm:px-12 lg:px-20 py-16 lg:py-24 border-y border-slate-100 dark:border-slate-900"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <ScrollReveal>
          <p className="font-google text-sm font-medium tracking-wide text-[#004DE8] mb-3">How it works</p>
          <h2 className="font-google font-medium tracking-tight leading-tight text-3xl sm:text-4xl text-slate-900 dark:text-white max-w-2xl">
            From your content to a live AI chat — in three steps.
          </h2>
          <p className="mt-5 max-w-xl font-google text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            No developers, no data scientists, no machine-learning experience. Just your content and a few minutes.
          </p>
        </ScrollReveal>

        {/* Steps */}
        <div className="mt-14 lg:mt-20 flex flex-col gap-16 lg:gap-24">
          {STEPS.map((s, i) => {
            const flip = i % 2 === 1;
            return (
              <div
                key={s.step}
                className="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center"
              >
                {/* Text */}
                <ScrollReveal className={flip ? 'lg:order-2' : ''}>
                  <div className="flex items-center gap-3 mb-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#004DE8]/10 font-mono text-sm font-bold text-[#004DE8]">
                      {s.step}
                    </span>
                    <span className="font-mono text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {s.label}
                    </span>
                  </div>
                  <h3 className="font-google font-medium tracking-tight leading-tight text-2xl sm:text-3xl text-slate-900 dark:text-white max-w-md">
                    {s.title}
                  </h3>
                  <p className="mt-4 max-w-md font-google text-base leading-relaxed text-slate-600 dark:text-slate-300">
                    {s.description}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {s.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-3">
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#004DE8]/10">
                          <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
                            <path d="M2.5 6.5 L5 9 L9.5 3.5" fill="none" stroke="#004DE8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                        <span className="font-google text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">{b}</span>
                      </li>
                    ))}
                  </ul>
                </ScrollReveal>

                {/* Visual */}
                <ScrollReveal delay={0.12} className={flip ? 'lg:order-1' : ''}>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-white to-slate-50 dark:from-slate-950 dark:to-slate-900/50 shadow-xl shadow-slate-900/5 dark:shadow-black/20 p-3 sm:p-5">
                    <StepVisual visual={s.visual} reduced={reduced} />
                  </div>
                </ScrollReveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
