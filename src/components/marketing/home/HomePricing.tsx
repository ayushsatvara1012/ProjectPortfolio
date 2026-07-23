import React from 'react';
import Link from 'next/link';
import { PLANS, PRICE_MATRIX } from '@/src/app/(app)/(site)/pricing/components';

/* Pricing preview — warm-styled, but tiers/prices come from the canonical
   PLANS + PRICE_MATRIX so this never drifts from the /pricing page. */

const PREVIEW_PLAN_IDS = ['STARTER', 'PRO', 'BUSINESS'];
const PREVIEW_FEATURE_COUNT = 3;

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#004DE8] dark:text-[#6E97FF]" aria-hidden="true">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function HomePricing() {
  return (
    <section id="pricing" className="bg-[#FAFAFC] dark:bg-[#0B0F19] py-28 lg:py-32 transition-colors duration-500">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-[640px] text-center">
          <span className="text-[12.5px] font-semibold uppercase tracking-[0.14em] text-[#004DE8] dark:text-[#6E97FF]">Pricing</span>
          <h2 className="mt-4 font-google text-[29px] font-bold leading-[1.08] tracking-[-0.035em] text-[#0F172A] dark:text-[#F8FAFC] sm:text-4xl lg:text-[44px]">
            Start free. Upgrade when it pays for itself.
          </h2>
          <p className="mt-4 font-google text-lg leading-relaxed text-[#475569] dark:text-[#94A3B8]">
            Every plan includes the full console — training, answers, lead capture, and ROI.
          </p>
        </div>

        {/* Explore — lifetime-free teaser */}
        <div className="mx-auto mt-14 flex max-w-[860px] flex-col gap-4 rounded-2xl border border-[#E2E8F0] dark:border-[#1E293B] bg-white/60 dark:bg-[#111827]/60 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-google text-base font-bold text-[#0F172A] dark:text-[#F8FAFC]">Explore</span>
              <span className="rounded-full border border-[#D3E0FD] dark:border-[#27375E] bg-[#EAF0FE] dark:bg-[#17203A] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#004DE8] dark:text-[#6E97FF]">Free forever</span>
            </div>
            <p className="mt-1 font-google text-sm text-[#475569] dark:text-[#94A3B8]">The full Vaayu Intelligence platform — free, forever. 1 bot · 1,000 messages / month.</p>
          </div>
          <Link
            href="/pricing"
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-[#CBD5E1] dark:border-[#1E293B] px-6 py-3 font-google text-sm font-semibold text-[#0F172A] dark:text-[#F8FAFC] transition-colors hover:border-[#94A3B8] dark:hover:border-[#475569]"
          >
            Learn more
          </Link>
        </div>

        {/* Paid tiers */}
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {PLANS.filter((p) => PREVIEW_PLAN_IDS.includes(p.id)).map((plan) => {
            const price = PRICE_MATRIX[plan.id as keyof typeof PRICE_MATRIX].USD;
            const featured = plan.badge === 'Most Popular';
            return (
              <div
                key={plan.id}
                className={`flex flex-col rounded-[22px] bg-white dark:bg-[#111827] p-8 shadow-[0_1px_1px_rgba(26,25,20,0.04),0_6px_16px_-10px_rgba(26,25,20,0.14)] dark:shadow-[0_1px_1px_rgba(0,0,0,0.5),0_8px_20px_-12px_rgba(0,0,0,0.6)] ${
                  featured
                    ? 'border-2 border-[#004DE8] dark:border-[#6E97FF]'
                    : 'border border-[#E2E8F0] dark:border-[#1E293B]'
                }`}
              >
                {plan.badge && (
                  <span className="mb-4 self-start rounded-full border border-[#D3E0FD] dark:border-[#27375E] bg-[#EAF0FE] dark:bg-[#17203A] px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest text-[#004DE8] dark:text-[#6E97FF]">
                    {plan.badge}
                  </span>
                )}
                <div className="font-google text-[15px] font-semibold text-[#475569] dark:text-[#94A3B8]">{plan.name}</div>
                <div className="mt-3 font-google text-[42px] font-bold tracking-[-0.035em] text-[#0F172A] dark:text-[#F8FAFC]">
                  ${price}
                  <span className="font-google text-[15px] font-medium text-[#64748B] dark:text-[#64748B]"> / month</span>
                </div>
                <p className="mt-2.5 min-h-[44px] font-google text-[14.5px] leading-[1.5] text-[#475569] dark:text-[#94A3B8]">{plan.description}</p>
                <ul className="my-7 flex flex-1 flex-col gap-3">
                  {plan.features.slice(0, PREVIEW_FEATURE_COUNT).map((f) => (
                    <li key={f} className="flex items-start gap-2.5 font-google text-[14.5px] text-[#0F172A] dark:text-[#F8FAFC]">
                      <Check />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/pricing"
                  className={`inline-flex w-full items-center justify-center rounded-full px-6 py-3 font-google text-sm font-semibold transition-all duration-200 ${
                    featured
                      ? 'bg-[#004DE8] dark:bg-[#3E6BE0] text-white hover:bg-[#002B82] dark:hover:bg-[#2E5FD6]'
                      : 'border border-[#CBD5E1] dark:border-[#1E293B] text-[#0F172A] dark:text-[#F8FAFC] hover:border-[#94A3B8] dark:hover:border-[#475569]'
                  }`}
                >
                  Get {plan.name}
                </Link>
              </div>
            );
          })}
        </div>

        <div className="mt-12 flex justify-center">
          <Link
            href="/pricing"
            className="inline-flex items-center gap-2 rounded-full border border-[#CBD5E1] dark:border-[#1E293B] px-8 py-3.5 font-google text-base font-semibold text-[#0F172A] dark:text-[#F8FAFC] transition-colors hover:border-[#94A3B8] dark:hover:border-[#475569]"
          >
            See full pricing
          </Link>
        </div>
      </div>
    </section>
  );
}
