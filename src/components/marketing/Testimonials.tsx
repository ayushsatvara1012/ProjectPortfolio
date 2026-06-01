import React from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   TESTIMONIALS  —  homepage social proof.

   ⚠️ PLACEHOLDER CONTENT — swap in real quotes, names, companies, and results.
   The quotes below are representative examples, not real customer statements.
 ───────────────────────────────────────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    quote:
      'Set it up in 20 minutes, no developer needed. It handles our FAQ questions all day so my team can focus on real issues.',
    name: '[Name]',
    role: 'E-commerce Store Owner',
    initials: 'NA',
  },
  {
    quote:
      "The ROI dashboard showed us our bot handled 300 conversations in the first month — that's hours we didn't have to pay for.",
    name: '[Name]',
    role: 'SaaS Founder',
    initials: 'NA',
  },
  {
    quote:
      "I embedded it on our agency's client sites. Clients love seeing it capture leads they would have missed.",
    name: '[Name]',
    role: 'Marketing Agency Owner',
    initials: 'NA',
  },
];

const Testimonials = () => {
  return (
    <section className="w-full bg-white dark:bg-slate-950 py-10 sm:py-12 transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <div className="flex items-center gap-2 text-sm uppercase tracking-widest font-bold font-google text-slate-400 dark:text-slate-500 mb-4">
            <span className="material-symbols-outlined text-[16px] text-blue-500">format_quote</span>
            <span>What our early users say</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-medium tracking-tight leading-tight text-slate-900 dark:text-white">
            Real results from real businesses.
          </h2>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {TESTIMONIALS.map((t, i) => (
            <figure
              key={i}
              className="flex flex-col justify-between gap-8 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 rounded-3xl p-8 lg:p-10 transition-colors duration-500"
            >
              <blockquote className="text-lg font-google text-slate-700 dark:text-slate-300 leading-relaxed">
                &ldquo;{t.quote}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-4">
                <div className="shrink-0 w-11 h-11 rounded-full bg-blue-500/10 dark:bg-blue-500/20 flex items-center justify-center text-sm font-google font-bold text-blue-600 dark:text-blue-400">
                  {t.initials}
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-google font-bold text-slate-900 dark:text-slate-200">{t.name}</span>
                  <span className="text-xs font-google text-slate-500 dark:text-slate-500">{t.role}</span>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
