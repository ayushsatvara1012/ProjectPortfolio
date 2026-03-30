import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Zap, BarChart3, Cpu, ArrowUpRight, ShieldCheck, Database, Globe, Layers, Activity } from 'lucide-react';

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
      eyebrow: "GLOBAL EDGE LATENCY",
      value: "< 50ms",
      subtext: "Average response time across CDN nodes.",
      icon: <Globe className="w-3.5 h-3.5" />
    },
    {
      type: "text",
      heading: "Autonomous RAG",
      body: "Upload documentation; our pipeline generates semantic embeddings instantly. Deploy context-aware agents sans manual pipelines."
    },
    {
      type: "metric",
      eyebrow: "CORE WEB VITALS",
      value: "100/100",
      subtext: "Perfect Lighthouse performance benchmarks.",
      icon: <Activity className="w-3.5 h-3.5" />
    },
    {
      type: "text",
      heading: "Modern Stacks",
      body: "Engineered with React 19 + Tailwind v4 for max speed. Atomic components ensure zero redundant CSS and fast paint cycles."
    },
    {
      type: "metric",
      eyebrow: "DATABASE READ-WRITE",
      value: "10x",
      subtext: "Accelerated ingestion via Supabase indexing.",
      icon: <Database className="w-3.5 h-3.5" />
    },
    {
      type: "text",
      heading: "Scalable Infrastructure",
      body: "FastAPI backends optimized for high-concurrency. Seamless Supabase integration ensures real-time sync at scale."
    },
    {
      type: "metric",
      eyebrow: "AUTHENTICATION UPTIME",
      value: "99.9%",
      subtext: "Resilient Clerk-managed identity layer.",
      icon: <ShieldCheck className="w-3.5 h-3.5" />
    },
    {
      type: "text",
      heading: "Enterprise Security",
      body: "End-to-end encryption for data-at-rest. Strict CORS policies and origin validation prevent unauthorized access."
    },
    {
      type: "metric",
      eyebrow: "JAVASCRIPT BUNDLE",
      value: "< 12KB",
      subtext: "Minified production footprint per route.",
      icon: <Layers className="w-3.5 h-3.5" />
    }
  ];

  return (
    <section id="metrics" className="w-full bg-white dark:bg-slate-950 py-2 overflow-hidden transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 md:px-12">
        
        {/* 9-Cell Checkerboard Extended Grid Archivecture */}
        <div className="relative group/grid">
          
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
            {gridData.map((cell, index) => (
              <div 
                key={index} 
                className={`
                  p-12 md:p-14 flex flex-col gap-6 group/cell transition-colors duration-500
                  ${index % 2 === 0 ? 'bg-white dark:bg-slate-950' : 'bg-slate-50/50 dark:bg-slate-900'}
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
                      <div className="text-4xl md:text-6xl font-display tracking-tight text-slate-900 dark:text-slate-200 tabular-nums leading-[0.8] transition-all duration-500 group-hover/cell:translate-x-1">
                        {cell.value}
                      </div>
                      
                      {/* Subtext */}
                      <div className="flex items-start gap-1.5 text-md uppercase tracking-widest text-slate-600 dark:text-slate-400 font-sans leading-relaxed opacity-80 transition-colors duration-500">
                        <ArrowUpRight className="w-5 h-5 text-emerald-500 shrink-0" strokeWidth={3} />
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