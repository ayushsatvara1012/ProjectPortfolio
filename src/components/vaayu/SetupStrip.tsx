import React from 'react';

/**
 * SetupStrip — 3-step "how you set it up" reassurance row for /vaayu.
 * Minimal 24px-grid stroke icons, numbered step cards connected by a rail.
 */

const ICON_STROKE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function TrainIcon() {
  // Document with content flowing in (upload arrow).
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...ICON_STROKE}>
      <path d="M13 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9l-6-6Z" />
      <path d="M13 3v4a2 2 0 0 0 2 2h4" />
      <path d="M12 17.5V12M9.5 14.5 12 12l2.5 2.5" />
    </svg>
  );
}

function EmbedIcon() {
  // Code brackets with a slash — one line of code.
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...ICON_STROKE}>
      <path d="m8.5 8-4 4 4 4" />
      <path d="m15.5 8 4 4-4 4" />
      <path d="m13.5 5.5-3 13" />
    </svg>
  );
}

function LiveIcon() {
  // Chat bubble with a check — answering from minute one.
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true" {...ICON_STROKE}>
      <path d="M12 3.5a8.5 8.5 0 0 1 8.5 8.5 8.5 8.5 0 0 1-8.5 8.5c-1.4 0-2.72-.34-3.89-.94L3.5 20.5l1.44-4.11A8.46 8.46 0 0 1 3.5 12 8.5 8.5 0 0 1 12 3.5Z" />
      <path d="m9 12.2 2.1 2.1L15.3 10" />
    </svg>
  );
}

const STEPS = [
  {
    n: '1',
    Icon: TrainIcon,
    title: 'Add your content',
    desc: 'Upload PDFs, paste URLs, or type it in. Vaayu learns your products, pricing, and policies automatically.',
    meta: 'Takes about 5 minutes',
  },
  {
    n: '2',
    Icon: EmbedIcon,
    title: 'Paste one line of code',
    desc: 'Drop a single script tag into your site — WordPress, Shopify, Webflow, or fully custom.',
    meta: 'No developer needed',
  },
  {
    n: '3',
    Icon: LiveIcon,
    title: 'Go live instantly',
    desc: 'Vaayu starts answering visitors, capturing leads, and scoring them from the very first chat.',
    meta: 'Answering 24/7',
  },
];

export default function SetupStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`relative grid gap-4 lg:gap-6 sm:grid-cols-3 ${className}`}>
      {/* connecting rail (desktop) */}
      <div
        className="hidden sm:block absolute top-10 left-[18%] right-[18%] h-px bg-gradient-to-r from-transparent via-slate-300 dark:via-slate-700 to-transparent"
        aria-hidden="true"
      />
      {STEPS.map(({ n, Icon, title, desc, meta }) => (
        <div
          key={n}
          className="group relative flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 shadow-sm transition-shadow hover:shadow-md hover:shadow-slate-900/5 dark:hover:shadow-black/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#004DE8]/[0.07] text-[#004DE8] ring-1 ring-inset ring-[#004DE8]/10">
              <Icon />
            </div>
            <span className="font-google text-xs font-medium tracking-wide text-slate-400 dark:text-slate-500">
              Step {n} of 3
            </span>
          </div>
          <h3 className="mt-5 font-google text-base font-semibold text-slate-900 dark:text-white">
            {title}
          </h3>
          <p className="mt-2 font-google text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            {desc}
          </p>
          <p className="mt-4 flex items-center gap-1.5 font-google text-xs font-medium text-[#004DE8]">
            <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
              <path
                d="M2.5 6.5 5 9l4.5-5.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {meta}
          </p>
        </div>
      ))}
    </div>
  );
}
