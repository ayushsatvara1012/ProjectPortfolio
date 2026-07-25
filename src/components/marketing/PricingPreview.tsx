import React from 'react';
import Link from 'next/link';
import { PLANS, PRICE_MATRIX } from '@/src/app/(app)/(site)/pricing/components';

/* ─────────────────────────────────────────────────────────────────────────────
   PRICING PREVIEW  —  compact homepage snapshot of the real plans.

   Prices and tiers are imported from the canonical /pricing source
   (PLANS + PRICE_MATRIX) so this preview never drifts out of sync. Kept short on
   purpose: only the top few features per tier, with a link to the full page.
 ───────────────────────────────────────────────────────────────────────────── */

const PREVIEW_FEATURE_COUNT = 3; // keep it a preview, not the full feature list
const PREVIEW_PLAN_IDS = ['STARTER', 'PRO', 'BUSINESS']; // the three self-serve tiers

const PricingPreview = () => {
  return (
    <section className="w-full bg-[#FAFAFC] dark:bg-[#0B0F19] py-24 sm:py-32 transition-colors duration-500">
      <div className="max-w-8xl mx-auto px-6 sm:px-12 lg:px-20">

        {/* Header */}
        <div className="max-w-2xl mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-google font-semibold tracking-tight leading-tight text-slate-900 dark:text-white mb-4">
            Simple pricing.{' '}
            <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
              Start free.
            </span>
          </h2>
          <p className="text-base md:text-lg font-google text-slate-500 dark:text-slate-400 leading-relaxed">
            No credit card required. Upgrade only when your bot starts paying for itself.
          </p>
        </div>

        {/* Explore — lifetime-free plan, Coming Soon (slim teaser above the tiers) */}
        <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-900/30 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200/60 dark:border-slate-800/60 bg-white dark:bg-white/[0.06]">
              <span className="material-symbols-outlined text-[20px] text-slate-600 dark:text-slate-400">explore</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-base font-google font-semibold text-slate-900 dark:text-white">Explore</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-800/40 bg-blue-50 dark:bg-blue-900/20 px-2.5 py-0.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                  </span>
                  <span className="text-[10px] font-display font-bold uppercase tracking-widest text-blue-700 dark:text-blue-300">Grab It Now !</span>
                </span>
              </div>
              <p className="text-sm font-google text-slate-500 dark:text-slate-400">The full Vaayu Intelligence platform — free, forever.</p>
            </div>
          </div>
          <Link
            href="/pricing"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-slate-300 dark:border-slate-700 px-6 py-3 text-sm font-google font-medium text-slate-900 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900"
          >
            Learn more
            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
          </Link>
        </div>

        {/* Tiers — compact preview (Starter / Growth / Scale) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PLANS.filter((plan) => PREVIEW_PLAN_IDS.includes(plan.id)).map((plan) => {
            const price = PRICE_MATRIX[plan.id as keyof typeof PRICE_MATRIX].USD;
            const featured = plan.badge === 'Most Popular';
            const cta = `Get ${plan.name}`;

            return (
              <div
                key={plan.id}
                className={`relative overflow-hidden backdrop-blur-xl flex flex-col gap-6 rounded-3xl p-7 lg:p-8 transition-all duration-500 ${
                  featured
                    ? 'bg-slate-900 border border-blue-500/40 shadow-[0_20px_50px_rgba(0,0,0,0.12)]'
                    : 'bg-slate-50/50 dark:bg-slate-900/30 border border-slate-200/60 dark:border-slate-800/60 shadow-[inset_0_1px_1px_rgba(255,255,255,0.45)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                }`}
              >
                {/* Noise texture overlay */}
                <div
                  className="absolute inset-0 opacity-[0.035] dark:opacity-[0.07] pointer-events-none mix-blend-overlay z-0"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                  }}
                />

                {plan.badge && (
                  <span
                    className={`absolute top-5 right-5 z-10 text-[10px] font-google font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                      featured ? 'bg-blue-500/20 text-blue-300' : 'bg-slate-200/80 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {plan.badge}
                  </span>
                )}

                {/* Price block */}
                <div className="relative z-10 flex flex-col gap-1.5">
                  <span
                    className={`text-sm font-google font-bold uppercase tracking-widest ${
                      featured ? 'text-blue-400' : 'text-slate-400 dark:text-slate-500'
                    }`}
                  >
                    {plan.name}
                  </span>
                  <div className="flex items-end gap-1">
                    <span
                      className={`text-4xl font-google tracking-tight tabular-nums ${
                        featured ? 'text-white' : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      ${price}
                    </span>
                    <span className={`text-sm font-google mb-1 ${featured ? 'text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      /mo
                    </span>
                  </div>
                  <p className={`text-xs font-google leading-relaxed ${featured ? 'text-slate-400' : 'text-slate-500 dark:text-slate-400'}`}>
                    {plan.description}
                  </p>
                </div>

                {/* Top features only */}
                <ul className="relative z-10 flex flex-col gap-2.5 flex-1">
                  {plan.features.slice(0, PREVIEW_FEATURE_COUNT).map((f) => (
                    <li
                      key={f}
                      className={`flex items-center gap-2.5 text-sm font-google ${
                        featured ? 'text-slate-300' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] text-emerald-500 shrink-0">check_circle</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <Link
                  href="/pricing"
                  className={`relative z-10 w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full text-sm font-google font-medium transition-colors ${
                    featured
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'bg-slate-900 dark:bg-slate-800 hover:bg-slate-700 dark:hover:bg-slate-700 text-white'
                  }`}
                >
                  {cta}
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </Link>
              </div>
            );
          })}
        </div>

        {/* See more → full pricing page */}
        <div className="mt-12 flex justify-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-slate-300 dark:border-slate-700 text-base font-google font-medium text-slate-900 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
          >
            See more
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PricingPreview;
