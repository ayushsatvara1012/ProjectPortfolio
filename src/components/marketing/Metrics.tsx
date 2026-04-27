'use client';

import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';

const PerformanceMetrics = () => {
  const gridRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: gridRef,
    offset: ["start center", "end center"]
  });

  // Snake 1: Indigo — traces top horizontal then drops down col 2
  const snake1Length = useTransform(scrollYProgress, [0, 0.6], [0, 1]);
  const snake1Opacity = useTransform(scrollYProgress, [0, 0.05, 0.6], [0, 1, 1]);

  // Snake 2: Fuchsia — starts later, traces col 1 down then sweeps right
  const snake2Length = useTransform(scrollYProgress, [0.15, 0.75], [0, 1]);
  const snake2Opacity = useTransform(scrollYProgress, [0.15, 0.2, 0.75], [0, 1, 1]);

  // Snake 3: Cyan — starts last, sweeps bottom row
  const snake3Length = useTransform(scrollYProgress, [0.3, 1], [0, 1]);
  const snake3Opacity = useTransform(scrollYProgress, [0.3, 0.35, 1], [0, 1, 1]);

  // Snake 4: Emerald — right border of first cell (col1 | x=100, y=0→100)
  const snake4Length = useTransform(scrollYProgress, [0, 0.35], [0, 1]);
  const snake4Opacity = useTransform(scrollYProgress, [0, 0.05, 0.35], [0, 1, 1]);

  const gridData = [
    {
      type: "metric",
      eyebrow: "BOT RESPONSE TIME",
      value: "< 2s",
      subtext: "Your visitors get answers instantly — faster than any human support agent.",
      icon: <span className="material-symbols-outlined text-[14px]">bolt</span>
    },
    {
      type: "text",
      heading: "Trained on Your Content",
      body: "Upload your PDFs, paste your website URL, or type your FAQs directly. Sapybase reads everything and turns it into a smart knowledge base — no coding, no manual Q&A pairs needed."
    },
    {
      type: "metric",
      eyebrow: "DEPLOY TIME",
      value: "< 10 min",
      subtext: "From zero to a live chatbot on your website in under ten minutes.",
      icon: <span className="material-symbols-outlined text-[14px]">rocket_launch</span>
    },
    {
      type: "text",
      heading: "Works on Any Website",
      body: "One script tag is all it takes. Paste it into Shopify, Webflow, WordPress, Next.js, or plain HTML — the bot appears instantly, styled to match your brand colors and name."
    },
    {
      type: "metric",
      eyebrow: "CHATBOT UPTIME",
      value: "99.9%",
      subtext: "Your AI support agent never sleeps, never calls in sick, never goes on holiday.",
      icon: <span className="material-symbols-outlined text-[14px]">verified_user</span>
    },
    {
      type: "text",
      heading: "Answers Stay Accurate",
      body: "The bot only uses the content you provide — it never invents answers. When something is outside its knowledge, it says so and hands the conversation to you instead of guessing."
    },
    {
      type: "metric",
      eyebrow: "PLATFORMS SUPPORTED",
      value: "Any HTML",
      subtext: "React, Next.js, Webflow, Shopify, WordPress — if it renders HTML, it works.",
      icon: <span className="material-symbols-outlined text-[14px]">devices</span>
    },
    {
      type: "text",
      heading: "You Stay in Control",
      body: "Retrain the bot any time your content changes. Adjust its tone, name, and brand color from your dashboard. Watch live conversations, see what questions customers are asking, and improve over time."
    },
    {
      type: "metric",
      eyebrow: "KNOWLEDGE SOURCES",
      value: "PDF · URL · Text",
      subtext: "Three ways to feed your bot — whichever fits your workflow best.",
      icon: <span className="material-symbols-outlined text-[14px]">database</span>
    }
  ];

  return (
    <section id="metrics" className="w-full bg-white dark:bg-slate-950 py-2 transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 md:px-10">

        {/* 9-Cell Checkerboard Extended Grid Archivecture */}
        <div className="relative group/grid overflow-hidden">

          {/* Responsive Vertical Extended Lines */}
          <div className="hidden lg:block absolute left-[33.33%] top-[-100vh] bottom-[-100vh] w-px bg-slate-200 dark:bg-slate-800 transition-colors duration-500 group-hover/grid:bg-indigo-100 dark:group-hover/grid:bg-indigo-900/40" />
          <div className="hidden lg:block absolute left-[66.66%] top-[-100vh] bottom-[-100vh] w-px bg-slate-200 dark:bg-slate-800 transition-colors duration-500 group-hover/grid:bg-indigo-100 dark:group-hover/grid:bg-indigo-900/40" />
          <div className="hidden md:block lg:hidden absolute left-[50%] top-[-100vh] bottom-[-100vh] w-px bg-slate-200 dark:bg-slate-800 transition-colors duration-500 group-hover/grid:bg-indigo-100 dark:group-hover/grid:bg-indigo-900/40" />

          {/* Responsive Horizontal Extended Lines */}
          <div className="absolute top-0 left-[-100vw] right-[-100vw] h-px bg-slate-200 dark:bg-slate-800 transition-colors duration-500 group-hover/grid:bg-indigo-100 dark:group-hover/grid:bg-indigo-900/40" />
          <div className="hidden lg:block absolute top-[33.33%] left-[-100vw] right-[-100vw] h-px bg-slate-200 dark:bg-slate-800 transition-colors duration-500 group-hover/grid:bg-indigo-100 dark:group-hover/grid:bg-indigo-900/40" />
          <div className="hidden lg:block absolute top-[66.66%] left-[-100vw] right-[-100vw] h-px bg-slate-200 dark:bg-slate-800 transition-colors duration-500 group-hover/grid:bg-indigo-100 dark:group-hover/grid:bg-indigo-900/40" />
          <div className="absolute bottom-0 left-[-100vw] right-[-100vw] h-px bg-slate-200 dark:bg-slate-800 transition-colors duration-500 group-hover/grid:bg-indigo-100 dark:group-hover/grid:bg-indigo-900/40" />

          {/* 1/2/3 Column Checkerboard Grid Architecture */}
          <div ref={gridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[1fr] gap-px bg-slate-200 dark:bg-slate-800 relative z-10 border-x border-slate-200 dark:border-slate-800 transition-colors duration-500">
            {/* Glowing Snake Overlay (Desktop Only) */}
            <div className="absolute inset-0 pointer-events-none z-20 hidden lg:block">
              <svg className="w-full h-full" viewBox="0 0 300 300" preserveAspectRatio="none">
                <defs>
                  {/* Snake 1: Indigo → Purple */}
                  <linearGradient id="snake1Gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#818cf8" />
                    <stop offset="100%" stopColor="#a855f7" />
                  </linearGradient>
                  {/* Snake 2: Fuchsia → Pink */}
                  <linearGradient id="snake2Gradient" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#e879f9" />
                    <stop offset="100%" stopColor="#f43f5e" />
                  </linearGradient>
                  {/* Snake 3: Cyan → Teal */}
                  <linearGradient id="snake3Gradient" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                  {/* Snake 4: Emerald — right border of cell 1 */}
                  <linearGradient id="snake4Gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#34d399" />
                    <stop offset="100%" stopColor="#059669" />
                  </linearGradient>
                </defs>

                {/* Path 1: Start top-left → go right to col2 → drop to row2 → go left to col1 → exit bottom */}
                <motion.path
                  d="M 0 100 L 200 100 L 200 200 L 100 200 L 100 300"
                  fill="none"
                  stroke="url(#snake1Gradient)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  style={{ pathLength: snake1Length, opacity: snake1Opacity }}
                />

                {/* Path 2: Start top-right corner → drop down col3 → sweep left at row2 → drop to bottom */}
                <motion.path
                  d="M 300 0 L 300 100 L 100 100 L 100 200 L 0 200 L 0 300"
                  fill="none"
                  stroke="url(#snake2Gradient)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  style={{ pathLength: snake2Length, opacity: snake2Opacity }}
                />

                {/* Path 3: Start at mid-left → cross to col3 → drop to bottom-right */}
                <motion.path
                  d="M 0 200 L 200 200 L 200 300 L 300 300"
                  fill="none"
                  stroke="url(#snake3Gradient)"
                  strokeWidth="1.5"
                  vectorEffect="non-scaling-stroke"
                  style={{ pathLength: snake3Length, opacity: snake3Opacity }}
                />

                {/* Path 4: Right border of first container — x=100, top to row1 gap */}
                <motion.path
                  d="M 100 0 L 100 100"
                  fill="none"
                  stroke="url(#snake4Gradient)"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                  style={{ pathLength: snake4Length, opacity: snake4Opacity }}
                />
              </svg>
            </div>
            {gridData.map((cell: any, index: number) => (
              <div
                key={index}
                className={`
                  p-8 lg:p-12 flex flex-col gap-6 group/cell transition-colors duration-500
                  ${index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50/50 dark:bg-slate-900'}
                  ${index === gridData.length - 1 ? 'md:col-span-2 lg:col-span-1' : ''}
                `}
              >
                {cell.type === "metric" ? (
                  <>
                    {/* Eyebrow Label */}
                    <div className="flex items-center gap-2 text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans transition-colors duration-500">
                      <span className="text-indigo-500 transition-colors">{cell.icon}</span>
                      <span>{cell.eyebrow}</span>
                    </div>

                    {/* Primary Metric */}
                    <div className="space-y-4">
                      <div className="text-3xl md:text-5xl font-display tracking-tight text-slate-900 dark:text-slate-200 tabular-nums leading-[0.8] transition-all duration-500 group-hover/cell:translate-x-1">
                        {cell.value}
                      </div>

                      {/* Subtext */}
                      <div className="flex items-start gap-1.5 text-md uppercase tracking-widest text-slate-700 dark:text-slate-400 font-sans font-semibold leading-relaxed transition-colors duration-500">
                        <span className="material-symbols-outlined text-[20px] text-emerald-500 shrink-0">north_east</span>
                        <span>{cell.subtext}</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Heading for Text Cells */}
                    <div className="flex items-center gap-2 text-md uppercase tracking-widest font-bold text-slate-600 dark:text-slate-400 font-sans transition-colors duration-500">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-300" />
                      <span>{cell.heading}</span>
                    </div>

                    {/* Body Text */}
                    <p className="text-base text-md font-display text-slate-500 dark:text-slate-400 leading-relaxed max-w-[280px] transition-colors duration-500">
                      {cell.body}
                    </p>

                    {/* Technical ID */}
                    <div className="mt-auto pt-8 border-t border-slate-100/50 dark:border-slate-800 flex items-center justify-between opacity-40 transition-colors duration-500">
                      <span className="text-md font-mono text-slate-500 dark:text-slate-400 uppercase tracking-widest transition-colors duration-500">SY_SYS_ARCH_0{index + 1}</span>
                      <div className="flex gap-1">
                        {[40, 60, 80].map(op => (
                          <div key={op} className={`h-1 w-1 bg-slate-900 dark:bg-slate-200 opacity-${op / 100} transition-colors duration-500`} />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
};

export default PerformanceMetrics;
