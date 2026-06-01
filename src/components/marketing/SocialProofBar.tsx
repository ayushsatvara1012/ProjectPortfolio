import React from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   SOCIAL PROOF / TRUST BAR  —  sits directly below the Hero.

   ⚠️ PLACEHOLDER CONTENT — before launch, replace:
     • PLACEHOLDER_LOGOS  → real customer / beta-tester logos (or wordmarks)
     • the "200+" figure   → a verified number
 ───────────────────────────────────────────────────────────────────────────── */

const PLACEHOLDER_LOGOS = ['Acme Co', 'NorthPeak', 'BrightCart', 'Lumen Labs', 'Vertex', 'Hatch'];

const SocialProofBar = () => {
  return (
    <section className="w-full bg-white dark:bg-slate-950 border-y border-slate-200 dark:border-slate-800 transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20 py-8 flex flex-col lg:flex-row items-center gap-6 lg:gap-12">

        {/* Lead-in stat — PLACEHOLDER number */}
        <p className="shrink-0 text-sm font-google font-medium text-slate-500 dark:text-slate-400 text-center lg:text-left">
          <span className="font-bold text-slate-900 dark:text-slate-200">200+</span> websites already answering customers 24/7
        </p>

        <div className="hidden lg:block h-8 w-px bg-slate-200 dark:bg-slate-800" />

        {/* Placeholder logo row */}
        <div className="flex flex-1 flex-wrap items-center justify-center lg:justify-start gap-x-8 gap-y-4">
          {PLACEHOLDER_LOGOS.map((name) => (
            <span
              key={name}
              className="text-base font-google font-bold tracking-tight text-slate-400 dark:text-slate-600 opacity-70 hover:opacity-100 transition-opacity select-none"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default SocialProofBar;
