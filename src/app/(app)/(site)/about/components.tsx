import React from 'react';
import Link from 'next/link';

/* ─────────────────────────────────────────────────────────────────────────────
   ABOUT PAGE — SECTIONS

   The About page tells a SaaS narrative arc:
     Mission → Belief → Story → Principles → What we build → Proof → Founder → CTA

   Voice is hybrid: company "we" for mission/belief/product/proof, founder "I"
   for the story (StorySection) and the founder block (FounderSection).

   All sections match the new SaaS homepage theme: rounded glass cards
   (`rounded-3xl bg-slate-50/50 dark:bg-slate-900/30`), `font-google font-medium`
   headings with gradient-clipped accents, ambient `blur-[120px]` glows, emerald
   `check_circle` accents, blue-500 eyebrow icons, and `rounded-full` buttons.

   ⚠️ Several strings below are PLACEHOLDER copy for the user to verify/refine —
   they are marked inline. Do not treat them as confirmed facts.
 ───────────────────────────────────────────────────────────────────────────── */

type Quality = { icon: string; title: string; body: string };

/** Section eyebrow — blue icon + uppercase tracked label, matching the homepage. */
export const Eyebrow = ({
  icon,
  children,
  className = '',
}: {
  icon: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`flex items-center gap-2 text-sm uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500 ${className}`}
  >
    <span className="material-symbols-outlined text-[16px] text-blue-500">{icon}</span>
    <span>{children}</span>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   1 · HERO — MISSION  (voice: we)
 ───────────────────────────────────────────────────────────────────────────── */

export const HeroCell = () => (
  <section className="relative w-full min-h-screen bg-white dark:bg-slate-950 pt-28 pb-16 sm:pt-36 sm:pb-24 flex items-center overflow-hidden transition-colors duration-500">
    {/* Tech blueprint background grid */}
    <div className="absolute inset-0 pointer-events-none select-none z-0">
      <svg className="w-full h-full stroke-slate-200/40 dark:stroke-slate-800/45 [mask-image:radial-gradient(100%_100%_at_top_center,white,transparent)]" aria-hidden="true">
        <defs>
          <pattern id="hero-grid" width="240" height="240" patternUnits="userSpaceOnUse" x="50%">
            <path d="
              M 0 0 L 0 96 M 0 144 L 0 240
              M 48 0 L 48 48 M 48 96 L 48 192
              M 96 48 L 96 144 M 96 192 L 96 240
              M 144 0 L 144 96 M 144 144 L 144 240
              M 192 0 L 192 48 M 192 96 L 192 240
              
              M 0 0 L 48 0 M 96 0 L 192 0
              M 0 48 L 96 48 M 144 48 L 240 48
              M 48 96 L 192 96
              M 0 144 L 192 144 M 192 144 L 240 144
              M 0 192 L 48 192 M 96 192 L 240 192
            " fill="none" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-grid)" />
      </svg>
    </div>

    {/* Ambient blur glows */}
    <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none select-none z-0" />
    <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none select-none z-0" />

    {/* Blueprint tech accents & coordinate crosshairs */}
    <div className="absolute inset-0 pointer-events-none select-none z-0 font-mono text-[9px] text-slate-400/60 dark:text-slate-600/60 hidden md:block">
      {/* Top Left */}
      <div className="absolute top-28 left-10 flex items-center gap-2">
        <span className="text-[12px] font-light font-sans">+</span>
        <span>SYS_INIT // OK</span>
      </div>
      {/* Bottom Left */}
      <div className="absolute bottom-10 left-10 flex items-center gap-2">
        <span className="text-[12px] font-light font-sans">+</span>
        <span>RETRIEVAL_LATENCY // &lt;80ms</span>
      </div>
      {/* Top Right */}
      <div className="absolute top-28 right-12 flex items-center gap-2">
        <span>VEC_DIM // 1536</span>
        <span className="text-[12px] font-light font-sans">+</span>
      </div>
      {/* Bottom Right */}
      <div className="absolute bottom-10 right-12 flex items-center gap-2">
        <span>COS_SIM // 0.982</span>
        <span className="text-[12px] font-light font-sans">+</span>
      </div>
    </div>

    {/* Slowly rotating concentric vector circles (AI Semantics) */}
    <div className="absolute right-8 top-1/4 w-64 h-64 lg:w-72 lg:h-72 hidden md:block opacity-65 dark:opacity-45 pointer-events-none select-none z-0">
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <style>{`
          .spin-slow { animation: hero-spin 45s linear infinite; transform-origin: center; }
          .spin-rev-slow { animation: hero-spin-rev 35s linear infinite; transform-origin: center; }
          .pulse-dot { animation: hero-pulse 3s ease-in-out infinite; }
          @keyframes hero-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes hero-spin-rev { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
          @keyframes hero-pulse { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
        `}</style>
        {/* Ring 1 (dashed outer) */}
        <circle cx="100" cy="100" r="85" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="3 6" className="spin-slow text-slate-400/80 dark:text-slate-500/70" />

        {/* Ring 2 (solid intermediate) */}
        <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-300/80 dark:text-slate-700/80" />

        {/* Ring 3 (dashed inner) */}
        <circle cx="100" cy="100" r="35" fill="none" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 3" className="spin-rev-slow text-blue-500/70 dark:text-blue-400/60" />

        {/* Connecting vector nodes on Ring 1 */}
        <g className="spin-slow">
          <circle cx="100" cy="15" r="2" className="fill-blue-500 dark:fill-blue-400" />
          <line x1="100" y1="100" x2="100" y2="15" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="text-slate-300/80 dark:text-slate-700/80" />
          <circle cx="185" cy="100" r="1.5" className="fill-indigo-500 dark:fill-indigo-400" />
          <line x1="100" y1="100" x2="185" y2="100" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 2" className="text-slate-300/80 dark:text-slate-700/80" />
        </g>

        {/* Connecting vector nodes on Ring 3 */}
        <g className="spin-rev-slow">
          <circle cx="100" cy="135" r="1.5" className="fill-emerald-500 dark:fill-emerald-400" />
          <circle cx="65" cy="100" r="2" className="fill-blue-500 dark:fill-blue-400" />
        </g>

        {/* Center node */}
        <circle cx="100" cy="100" r="3.5" className="fill-blue-600 dark:fill-blue-500 pulse-dot" />
      </svg>
    </div>

    <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10 w-full">
      <div className="max-w-3xl mx-auto flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full mb-8">
          <span className="material-symbols-outlined text-[14px] text-blue-600">history_edu</span>
          <span className="text-xs sm:text-sm font-google tracking-widest text-slate-400 dark:text-slate-500">
            About Sapybase
          </span>
        </div>

        {/* ⚠️ PLACEHOLDER mission copy — derived from SEO positioning; refine to taste. */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-google font-medium tracking-tight leading-[1.05] text-slate-900 dark:text-white">
          AI support that{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            every business can trust.
          </span>
        </h1>
        <p className="mt-6 text-base md:text-lg font-google text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
          Sapybase exists to give any business — not just tech companies — an AI agent that knows
          their content, never makes things up, and shows exactly what it earns.
        </p>
      </div>
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────────────────────────────
   2 · WHAT WE BELIEVE  (voice: we)
 ───────────────────────────────────────────────────────────────────────────── */

const BELIEFS = [
  { icon: 'database', text: 'Answers should come from your content — never the open internet.' },
  { icon: 'bolt', text: 'Going live should take minutes, not a developer and a sprint.' },
  { icon: 'monitoring', text: 'You should see exactly what your AI earns you — no black box.' },
];

export const BeliefSection = () => (
  <section className="relative w-full bg-white dark:bg-slate-950 py-24 sm:py-32 overflow-hidden transition-colors duration-500">
    <div className="absolute top-1/4 left-10 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none select-none" />

    <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
        {/* Left: the thesis */}
        <div>
          <Eyebrow icon="flag" className="mb-4">What we believe</Eyebrow>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-medium tracking-tight leading-tight text-slate-900 dark:text-white">
            Businesses shouldn&apos;t lose customers to{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              questions they never answered.
            </span>
          </h2>
          <p className="mt-6 text-base md:text-lg font-google text-slate-500 dark:text-slate-400 leading-relaxed">
            Most chatbots are too generic, too expensive, or need a developer just to get started — and
            many confidently make things up. We believe AI support should be accurate, affordable, and
            live in minutes: an agent that only knows your business and never invents an answer.
          </p>
        </div>

        {/* Right: belief tenets */}
        <div className="flex flex-col gap-4">
          {BELIEFS.map((b, i) => (
            <div
              key={i}
              className="group relative flex items-start gap-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-6 backdrop-blur-xl transition-all duration-500 hover:border-emerald-500/30 dark:hover:border-emerald-500/20"
            >
              {/* Vertical connector line segment behind icon box */}
              <div className="absolute top-0 bottom-0 left-[44px] w-[1px] pointer-events-none select-none z-0">
                <svg className="w-full h-full overflow-visible" fill="none">
                  {i > 0 && (
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="24"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      className="text-slate-200 dark:text-slate-800/60 group-hover:text-emerald-500/40 transition-colors duration-300"
                    />
                  )}
                  {i < BELIEFS.length - 1 && (
                    <line
                      x1="0"
                      y1="64"
                      x2="0"
                      y2="100%"
                      stroke="currentColor"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                      className="text-slate-200 dark:text-slate-800/60 group-hover:text-emerald-500/40 transition-colors duration-300"
                    />
                  )}
                </svg>
              </div>

              {/* Icon box (acts as the node dot) */}
              <span className="relative z-10 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/70 text-blue-500 shrink-0 transition-all duration-300 group-hover:text-emerald-500 group-hover:border-emerald-500/40 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.08)]">
                {/* Subtle emerald glowing pulse ring on hover */}
                <span className="absolute inset-0 rounded-xl bg-emerald-500 opacity-0 group-hover:animate-pulse group-hover:opacity-10 transition-opacity duration-300" />
                <span className="material-symbols-outlined text-[20px]">{b.icon}</span>
              </span>

              <p className="relative z-10 text-base font-google text-slate-700 dark:text-slate-300 leading-relaxed pt-1.5 transition-colors duration-300 group-hover:text-slate-900 dark:group-hover:text-white">
                {b.text}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

export const GeometricDivider = () => (
  <div className="relative w-full max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 py-4 pointer-events-none select-none z-10 overflow-hidden">
    <div className="relative flex items-center justify-center">
      {/* Dashed line on left */}
      <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-800/80 transition-colors duration-500" />

      {/* Central Geometric Element */}
      <div className="flex items-center gap-4 px-4 bg-white dark:bg-slate-950 transition-colors duration-500 shrink-0">
        <span className="font-mono text-[9px] text-slate-400/70 dark:text-slate-500/70 tracking-wider">Better Technology</span>
        <svg width="24" height="24" viewBox="0 0 24 24" className="stroke-slate-300 dark:stroke-slate-700 fill-none transition-colors duration-500">
          {/* Outermost circle */}
          <circle cx="12" cy="12" r="9" strokeWidth="0.75" strokeDasharray="2 1" />
          {/* Diamond inside */}
          <path d="M 12,5 L 19,12 L 12,19 L 5,12 Z" strokeWidth="1" className="stroke-blue-500/50 dark:stroke-blue-400/50" />
          {/* Center dot */}
          <circle cx="12" cy="12" r="1.5" className="fill-emerald-500 stroke-none" />
          {/* Crosshairs */}
          <line x1="12" y1="1" x2="12" y2="4" strokeWidth="0.75" />
          <line x1="12" y1="20" x2="12" y2="23" strokeWidth="0.75" />
          <line x1="1" y1="12" x2="4" y2="12" strokeWidth="0.75" />
          <line x1="20" y1="12" x2="23" y2="12" strokeWidth="0.75" />
        </svg>
        <span className="font-mono text-[9px] text-slate-400/70 dark:text-slate-500/70 tracking-wider">Better Products</span>
      </div>

      {/* Dashed line on right */}
      <div className="flex-1 border-t border-dashed border-slate-200 dark:border-slate-800/80 transition-colors duration-500" />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   3 · OUR STORY  (voice: founder "I")
 ───────────────────────────────────────────────────────────────────────────── */

// ⚠️ PLACEHOLDER milestones — replace the years and details with real history.
const TIMELINE = [
  { year: '2024', title: 'The idea', body: 'Saw too many businesses lose customers to questions no one answered in time.' },
  { year: '2024', title: 'First build', body: 'Built a retrieval engine that answers strictly from a business’s own content.' },
  { year: '2025', title: 'Launch', body: 'Shipped Sapybase: a no-code AI agent live on any website in minutes.' },
  { year: 'Today', title: 'Scaling', body: 'Refining accuracy, ROI visibility, and reach — in the open, with real users.' },
];

const CARD_COLORS = [
  {
    text: 'text-blue-600 dark:text-blue-400',
    blob: 'bg-blue-400/20 dark:bg-blue-500/10',
    node: 'border-blue-500 dark:border-blue-400',
    nodeDot: 'bg-blue-500 dark:bg-blue-400',
  },
  {
    text: 'text-emerald-600 dark:text-emerald-400',
    blob: 'bg-emerald-400/20 dark:bg-emerald-500/10',
    node: 'border-emerald-500 dark:border-emerald-400',
    nodeDot: 'bg-emerald-500 dark:bg-emerald-400',
  },
  {
    text: 'text-violet-600 dark:text-violet-400',
    blob: 'bg-violet-400/20 dark:bg-violet-500/10',
    node: 'border-violet-500 dark:border-violet-400',
    nodeDot: 'bg-violet-500 dark:bg-violet-400',
  },
  {
    text: 'text-amber-600 dark:text-amber-400',
    blob: 'bg-amber-400/20 dark:bg-amber-500/10',
    node: 'border-amber-500 dark:border-amber-400',
    nodeDot: 'bg-amber-500 dark:bg-amber-400',
  },
];

export const StorySection = () => (
  <section className="relative w-full bg-white dark:bg-slate-950 py-24 sm:py-32 overflow-hidden transition-colors duration-500">
    <div className="absolute bottom-1/4 right-10 w-96 h-96 bg-indigo-500/5 dark:bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none select-none" />

    {/* Shared timeline gradients */}
    <svg className="absolute w-0 h-0" aria-hidden="true">
      <defs>
        <linearGradient id="timeline-packet-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="1" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="timeline-packet-grad-vert" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity="0" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="1" />
          <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>

    <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">
      {/* Header container with absolute background globe */}
      <div className="relative mb-14 sm:mb-16">
        {/* Left: header + letter */}
        <div className="max-w-3xl relative z-10">
          <Eyebrow icon="history_edu" className="mb-4">Our story</Eyebrow>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-medium tracking-tight leading-tight text-slate-900 dark:text-white">
            Why I built{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Sapybase.
            </span>
          </h2>
          <div className="mt-6 flex flex-col gap-5 text-base md:text-lg font-google text-slate-600 dark:text-slate-300 leading-relaxed">
            <p>
              I kept seeing businesses lose customers because of not able to cope up with the generative AI trend — and the existing chatbot
              solutions were either too generic, too expensive, or required a developer just to set up.
            </p>
            <p>
              So I built the products I wanted to exist: which actually knows your business,
              never makes things up, and shows you exactly where the leads are coming from and what it&apos;s earning you.
            </p>
          </div>
          <p className="mt-6 text-sm font-google font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
            — Ayush Satvara, Founder
          </p>
        </div>

        {/* Background Globe Graphic */}
        <div className="absolute right-[-20px] lg:right-[-40px] top-1/2 -translate-y-1/2 w-[350px] sm:w-[500px] lg:w-[650px] pointer-events-none select-none z-0 opacity-20 dark:opacity-15 flex justify-end">
          {/* Ambient blur glow behind globe */}
          <div className="absolute inset-0 m-auto w-80 h-80 bg-indigo-500/5 dark:bg-indigo-600/10 rounded-full blur-[90px] pointer-events-none select-none z-0" />
          <img
            src="/globe.svg"
            alt="Global AI Agent Deployment"
            className="relative z-10 w-full h-auto select-none pointer-events-none"
          />
        </div>
      </div>

      {/* Milestone timeline container */}
      <div className="relative mt-14 sm:mt-16 pl-10 lg:pl-0">
        <style>{`
          @keyframes timeline-flow-horiz {
            0% { transform: translateX(-20%); }
            100% { transform: translateX(120%); }
          }
          @keyframes timeline-flow-vert {
            0% { transform: translateY(-20%); }
            100% { transform: translateY(120%); }
          }
          .timeline-packet {
            animation: timeline-flow-horiz 8s linear infinite;
          }
          .timeline-packet-vert {
            animation: timeline-flow-vert 6s linear infinite;
          }
        `}</style>

        {/* Desktop timeline SVG line */}
        <div className="absolute top-0 left-[36px] right-[36px] h-[1px] hidden lg:block pointer-events-none select-none z-0">
          <svg className="w-full h-full overflow-visible" fill="none">
            <line x1="0" y1="0" x2="100%" y2="0" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-slate-200 dark:text-slate-800" />
            <rect x="0" y="-1" width="80" height="2" fill="url(#timeline-packet-grad)" className="timeline-packet" />
          </svg>
        </div>

        {/* Mobile/Tablet vertical timeline line */}
        <div className="absolute top-0 bottom-0 left-[33px] w-[1px] lg:hidden pointer-events-none select-none z-0">
          <svg className="w-full h-full overflow-visible" fill="none">
            <line x1="0" y1="0" x2="0" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-slate-200 dark:text-slate-800" />
            <rect x="-1" y="0" width="2" height="80" fill="url(#timeline-packet-grad-vert)" className="timeline-packet-vert" />
          </svg>
        </div>

        {/* Timeline Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-6 relative z-10">
          {TIMELINE.map((m, i) => {
            const cardColor = CARD_COLORS[i] || CARD_COLORS[0];
            return (
              <div
                key={i}
                className="relative bg-white/70 dark:bg-slate-900/40 border border-slate-200/60 dark:border-slate-800/80 rounded-2xl p-7 backdrop-blur-xl transition-all duration-500 group overflow-hidden"
              >
                {/* Noise overlay */}
                <div
                  className="absolute inset-0 opacity-[0.03] dark:opacity-[0.04] pointer-events-none mix-blend-overlay z-0"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                  }}
                />

                {/* Blurred rounded light (color blob) in the bottom-right corner */}
                <div className={`absolute -right-8 -bottom-8 w-32 h-32 rounded-full blur-2xl opacity-60 dark:opacity-40 pointer-events-none select-none z-0 ${cardColor.blob}`} />

                {/* Desktop Node Circle */}
                <div className={`absolute -top-1.5 left-8 w-3 h-3 rounded-full bg-white dark:bg-slate-950 border-2 ${cardColor.node} hidden lg:flex items-center justify-center z-10`}>
                  <span className={`w-1 h-1 rounded-full ${cardColor.nodeDot} animate-ping`} />
                </div>

                {/* Mobile/Tablet Node Circle */}
                <div className={`absolute top-8 -left-[13px] w-3 h-3 rounded-full bg-white dark:bg-slate-950 border-2 ${cardColor.node} lg:hidden flex items-center justify-center z-10`}>
                  <span className={`w-1 h-1 rounded-full ${cardColor.nodeDot} animate-ping`} />
                </div>

                <div className="relative z-10">
                  <span className={`text-sm font-google font-bold uppercase tracking-widest ${cardColor.text}`}>
                    {m.year}
                  </span>
                  <h3 className="mt-3 text-xl font-google font-semibold text-slate-900 dark:text-slate-100 leading-snug">
                    {m.title}
                  </h3>
                  <p className="mt-2 text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed">
                    {m.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────────────────────────────
   4 · OUR PRINCIPLES  (voice: we)
 ───────────────────────────────────────────────────────────────────────────── */

export const PrinciplesSection = ({ qualities }: { qualities: Quality[] }) => (
  <section className="relative w-full bg-white dark:bg-slate-950 py-24 sm:py-32 overflow-hidden transition-colors duration-500">
    {/* Static Isometric Wireframe Background */}
    <div className="absolute inset-0 pointer-events-none select-none z-0 overflow-hidden opacity-65 dark:opacity-55">
      <svg className="w-full h-full stroke-slate-300/80 dark:stroke-slate-700/90 fill-none" viewBox="0 0 1440 600" preserveAspectRatio="none">
        {/* Left side: Isometric cube with projection lines (shifted above for visibility) */}
        <g transform="translate(60, 20)">
          {/* Cube edges */}
          {/* Top face */}
          <path d="M 60,30 L 95,47.5 L 60,65 L 25,47.5 Z" strokeWidth="0.75" />
          {/* Left face */}
          <path d="M 25,47.5 L 60,65 L 60,100 L 25,82.5 Z" strokeWidth="0.75" />
          {/* Right face */}
          <path d="M 60,65 L 95,47.5 L 95,82.5 L 60,100 Z" strokeWidth="0.75" />
          {/* Internal structure (dashed) */}
          <path d="M 60,30 L 60,100" strokeWidth="0.5" strokeDasharray="2 2" className="stroke-slate-200/80 dark:stroke-slate-800/80" />
          <path d="M 25,82.5 L 60,65 L 95,82.5" strokeWidth="0.5" strokeDasharray="2 2" className="stroke-slate-200/80 dark:stroke-slate-800/80" />

          {/* Projection/Dimension lines */}
          <line x1="95" y1="47.5" x2="135" y2="67.5" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="60" y1="100" x2="60" y2="130" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="25" y1="82.5" x2="-15" y2="102.5" strokeWidth="0.5" strokeDasharray="3 3" />

          {/* Blueprint ticks */}
          <line x1="135" y1="65" x2="135" y2="70" strokeWidth="0.75" />
          <line x1="-15" y1="100" x2="-15" y2="105" strokeWidth="0.75" />


        </g>

        {/* Right side: Overlapping stacked grid planes */}
        <g transform="translate(1200, 240)">
          {/* Top Grid Plane */}
          <path d="M 70,10 L 140,45 L 70,80 L 0,45 Z" strokeWidth="0.75" />
          {/* Grid lines inside top plane */}
          <line x1="35" y1="27.5" x2="105" y2="62.5" strokeWidth="0.5" />
          <line x1="105" y1="27.5" x2="35" y2="62.5" strokeWidth="0.5" />

          {/* Bottom Grid Plane (Offset down) */}
          <path d="M 70,50 L 140,85 L 70,120 L 0,85 Z" strokeWidth="0.75" strokeDasharray="2 2" className="stroke-slate-200/80 dark:stroke-slate-800/80" />

          {/* Vertical connection lines between planes */}
          <line x1="0" y1="45" x2="0" y2="85" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="140" y1="45" x2="140" y2="85" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="70" y1="80" x2="70" y2="120" strokeWidth="0.5" strokeDasharray="3 3" />
          <line x1="70" y1="10" x2="70" y2="50" strokeWidth="0.5" strokeDasharray="3 3" />

          {/* Coordinate ticks and Axes */}
          <line x1="140" y1="45" x2="165" y2="32.5" strokeWidth="0.75" className="stroke-slate-400 dark:stroke-slate-550" />
          <text x="175" y="32" className="font-mono text-[8px] fill-slate-400 dark:fill-slate-500 stroke-none">X</text>

          <line x1="70" y1="120" x2="70" y2="145" strokeWidth="0.75" className="stroke-slate-400 dark:stroke-slate-550" />
          <text x="70" y="155" textAnchor="middle" className="font-mono text-[8px] fill-slate-400 dark:fill-slate-500 stroke-none">Z</text>

          {/* Accent emerald-green vertex node */}
          <circle cx="70" cy="80" r="3" className="fill-emerald-500/30 dark:fill-emerald-500/20 stroke-emerald-500/60 dark:stroke-emerald-500/50 animate-pulse" strokeWidth="0.75" />
        </g>
      </svg>
    </div>

    <div className="absolute top-1/4 left-10 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none select-none z-0" />

    <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">
      <div className="max-w-2xl mb-12 sm:mb-16">
        <Eyebrow icon="auto_awesome" className="mb-4">Our principles</Eyebrow>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-medium tracking-tight leading-tight text-slate-900 dark:text-white">
          What we{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            stand for.
          </span>
        </h2>
      </div>

      <div className="relative grid grid-cols-1 lg:grid-cols-4 gap-12 lg:gap-8 mt-12">
        {/* Connecting Roadmap line (Desktop) */}
        <div className="absolute top-[22px] left-[22px] right-[calc(25%-22px)] h-[1px] hidden lg:block pointer-events-none select-none z-0">
          <svg className="w-full h-full overflow-visible" fill="none">
            <line x1="0" y1="0" x2="100%" y2="0" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-slate-300 dark:text-slate-700" />
          </svg>
        </div>

        {/* Connecting Roadmap line (Mobile/Vertical) */}
        <div className="absolute left-[22px] top-6 bottom-6 w-[1px] lg:hidden pointer-events-none select-none z-0">
          <svg className="w-full h-full overflow-visible" fill="none">
            <line x1="0" y1="0" x2="0" y2="100%" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" className="text-slate-300 dark:text-slate-700" />
          </svg>
        </div>

        {qualities.map((q, i) => {
          // Define custom background geometric SVGs for each node
          const renderBackgroundRings = () => {
            if (i === 0) {
              return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 scale-90 lg:scale-110">
                  <svg className="w-24 h-24 stroke-slate-300 dark:stroke-slate-700/60 opacity-85" fill="none" viewBox="0 0 100 100">
                    <line x1="50" y1="15" x2="50" y2="85" strokeDasharray="3 3" />
                    <line x1="15" y1="50" x2="85" y2="50" strokeDasharray="3 3" />
                    <circle cx="50" cy="50" r="22" />
                    <polygon points="50,38 62,50 50,62 38,50" className="stroke-blue-500/35 dark:stroke-blue-400/30" />
                  </svg>
                </div>
              );
            }
            if (i === 1) {
              return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 scale-90 lg:scale-110">
                  <svg className="w-24 h-24 stroke-slate-300 dark:stroke-slate-700/60 opacity-85" fill="none" viewBox="0 0 100 100">
                    <line x1="50" y1="15" x2="50" y2="85" strokeDasharray="3 3" />
                    <line x1="15" y1="50" x2="85" y2="50" strokeDasharray="3 3" />
                    <circle cx="50" cy="50" r="22" />
                    <rect x="38" y="38" width="24" height="24" className="stroke-blue-500/35 dark:stroke-blue-400/30" />
                  </svg>
                </div>
              );
            }
            if (i === 2) {
              return (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 scale-90 lg:scale-110">
                  <svg className="w-26 h-26 stroke-slate-300 dark:stroke-slate-700/60 opacity-85" fill="none" viewBox="0 0 120 120">
                    <ellipse cx="60" cy="60" rx="35" ry="14" transform="rotate(-30 60 60)" />
                    <ellipse cx="60" cy="60" rx="35" ry="14" transform="rotate(30 60 60)" />
                    <circle cx="60" cy="60" r="8" strokeDasharray="2 2" />
                  </svg>
                </div>
              );
            }
            // Node 3 (Built for trust)
            return (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none z-0 scale-90 lg:scale-110">
                <svg className="w-26 h-26 stroke-slate-300 dark:stroke-slate-700/60 opacity-85" fill="none" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="12" />
                  <line x1="50" y1="38" x2="32" y2="24" />
                  <line x1="50" y1="62" x2="68" y2="76" />
                  <line x1="38" y1="50" x2="20" y2="58" />
                  <line x1="68" y1="50" x2="80" y2="42" />
                  <circle cx="32" cy="24" r="2" className="fill-emerald-500/40 dark:fill-emerald-500/20 stroke-none" />
                  <circle cx="68" cy="76" r="2" className="fill-blue-500/40 dark:fill-blue-500/20 stroke-none" />
                  <circle cx="20" cy="58" r="2" />
                  <circle cx="80" cy="42" r="2" />
                </svg>
              </div>
            );
          };

          return (
            <div
              key={i}
              className="relative flex flex-row lg:flex-col items-start gap-5 lg:gap-6 z-10 group"
            >
              {/* Node Icon Circle & Background Rings */}
              <div className="relative flex items-center justify-center w-11 h-11 shrink-0 z-10">
                {renderBackgroundRings()}
                <span className="relative z-10 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-blue-500 group-hover:text-emerald-500 group-hover:border-emerald-500/40 transition-colors duration-300 shadow-xs">
                  <span className="material-symbols-outlined text-[18px]">{q.icon}</span>
                </span>
              </div>

              {/* Text details */}
              <div className="relative z-10 mt-1 lg:mt-0 flex-1">
                <h3 className="text-lg font-google font-semibold text-slate-900 dark:text-slate-100 leading-snug mb-2 transition-colors duration-300 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                  {q.title}
                </h3>
                <p className="text-sm md:text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed transition-colors duration-300 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                  {q.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────────────────────────────
   5 · WHAT WE BUILD  (voice: we)
 ───────────────────────────────────────────────────────────────────────────── */

const DELIVERABLES = [
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
    accent: 'text-emerald-500',
  },
  {
    heading: 'Embed in 60 Seconds',
    body: 'One script tag. Paste it into any website — Shopify, Webflow, WordPress, or plain HTML — and your chatbot is live. No developer needed after the initial setup.',
    icon: 'code',
    accent: 'text-blue-500',
  },
  {
    heading: 'Full Control from a Dashboard',
    body: 'Retrain the bot when your content changes, adjust its tone and name, and watch real conversations in the dashboard. You own every setting — no black box.',
    icon: 'tune',
    accent: 'text-emerald-500',
  },
];

export const DeliverablesCell = () => (
  <section className="relative w-full bg-white dark:bg-slate-950 py-24 sm:py-32 overflow-hidden transition-colors duration-500">
    <div className="absolute top-1/4 right-10 w-96 h-96 bg-blue-500/5 dark:bg-blue-600/10 rounded-full blur-[120px] pointer-events-none select-none" />

    <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 relative z-10">
      <div className="max-w-2xl mb-12 sm:mb-16">
        <Eyebrow icon="lightbulb" className="mb-4">What we build</Eyebrow>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-medium tracking-tight leading-tight text-slate-900 dark:text-white">
          Everything your bot does{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
            out of the box.
          </span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
        {DELIVERABLES.map((p, i) => (
          <div
            key={i}
            className="flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-7 lg:p-8 backdrop-blur-xl transition-colors duration-500"
          >
            <span
              className={`inline-flex items-center justify-center w-11 h-11 rounded-xl bg-white dark:bg-slate-950 border border-slate-200/70 dark:border-slate-800/70 shrink-0 ${p.accent}`}
            >
              <span className="material-symbols-outlined text-[22px]">{p.icon}</span>
            </span>
            <div>
              <h3 className="text-lg font-google font-semibold text-slate-900 dark:text-slate-100 leading-snug mb-2">
                {p.heading}
              </h3>
              <p className="text-sm md:text-base font-google text-slate-500 dark:text-slate-400 leading-relaxed">
                {p.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────────────────────────────
   6 · PROOF — BY THE NUMBERS  (voice: we)
   (Pairs with the reused Testimonials + SocialProofBar in page.tsx.)
 ───────────────────────────────────────────────────────────────────────────── */

// ⚠️ Verify these figures are accurate before launch.
const METRICS = [
  { eyebrow: 'Bot Response Time', value: '<2s', icon: 'bolt', accent: 'text-blue-500' },
  { eyebrow: 'Chatbot Uptime', value: '99.9%', icon: 'verified_user', accent: 'text-emerald-500' },
  { eyebrow: 'Deploy Time', value: '<10 min', icon: 'rocket_launch', accent: 'text-blue-500' },
  { eyebrow: 'Platforms Supported', value: 'Any HTML', icon: 'devices', accent: 'text-emerald-500' },
];

export const MetricsStrip = () => (
  <section className="w-full bg-white dark:bg-slate-950 py-6 sm:py-8 transition-colors duration-500">
    <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {METRICS.map((m, i) => (
          <div
            key={i}
            className="rounded-2xl sm:rounded-3xl bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 backdrop-blur-xl p-5 sm:p-7 lg:p-8 flex flex-col gap-3 transition-colors duration-500"
          >
            <div className="flex items-center gap-2 text-[11px] sm:text-xs tracking-widest font-medium text-slate-400 dark:text-slate-500 font-google">
              <span className={`material-symbols-outlined text-base ${m.accent}`}>{m.icon}</span>
              <span className="truncate">{m.eyebrow}</span>
            </div>
            <div className="text-2xl sm:text-3xl lg:text-4xl font-google font-semibold tracking-tight text-slate-900 dark:text-slate-100 tabular-nums leading-none">
              {m.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

/* ─────────────────────────────────────────────────────────────────────────────
   8 · CTA  (voice: we)
 ───────────────────────────────────────────────────────────────────────────── */

export const CTAStrip = () => (
  <section className="w-full bg-white dark:bg-slate-950 py-10 sm:py-12 transition-colors duration-500">
    <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20">
      <div className="relative overflow-hidden rounded-3xl bg-slate-900 border border-blue-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.12)] p-10 sm:p-14 lg:p-20 flex flex-col lg:flex-row items-start lg:items-end justify-between gap-10">
        <div
          className="absolute inset-0 opacity-[0.07] pointer-events-none mix-blend-overlay z-0"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          }}
        />
        <div className="absolute -top-24 -right-24 w-96 h-96 bg-blue-500/20 rounded-full blur-[120px] pointer-events-none select-none z-0" />

        <div className="relative z-10">
          <p className="text-xs font-google font-bold uppercase tracking-widest text-slate-500 mb-4">
            Deployment Status · <span className="text-emerald-400">Optimal</span>
          </p>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-google font-medium tracking-tight text-white leading-[1.05]">
            Performance-first.{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-indigo-400">
              Always.
            </span>
          </h2>
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto">
          <Link
            href="/contact"
            className="inline-flex items-center justify-center gap-2 px-7 py-4 bg-blue-600 hover:bg-blue-500 text-white text-base font-google font-medium tracking-wide transition-colors duration-150 rounded-full"
          >
            Start Building
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
          <Link
            href="/services"
            className="inline-flex items-center justify-center gap-2 px-7 py-4 border border-slate-700 hover:border-slate-500 text-slate-300 hover:text-white text-base font-google font-medium tracking-wide transition-colors duration-150 rounded-full"
          >
            View Services
          </Link>
        </div>
      </div>
    </div>
  </section>
);
