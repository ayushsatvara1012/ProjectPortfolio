import React from 'react';

/**
 * SetupStrip — slim 3-step "how you set it up" reassurance row for /vaayu.
 * Three bespoke outlined icons (ingest / embed / live), each drawn uniquely so
 * none repeats another illustration on the site. Connected by a dashed rail.
 */

function IngestIcon() {
  // Stacked sources (PDF / URL / text) flowing down into a tray.
  return (
    <svg viewBox="0 0 56 56" className="w-7 h-7" aria-hidden="true">
      <rect x="10" y="6" width="24" height="13" rx="3" className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.6" />
      <rect x="16" y="11" width="13" height="2" rx="1" className="fill-slate-300 dark:fill-slate-600" />
      <rect x="14" y="14" width="34" height="13" rx="3" fill="#004DE8" opacity="0.1" />
      <rect x="14" y="14" width="34" height="13" rx="3" fill="none" stroke="#004DE8" strokeWidth="1.6" />
      <text x="19" y="23" fill="#004DE8" fontSize="6.5" fontWeight="700" fontFamily="sans-serif">PDF · URL</text>
      <path d="M28 30 v8" stroke="#004DE8" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2 3" />
      <path d="M24 35 l4 4 l4 -4" fill="none" stroke="#004DE8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 42 h32 a3 3 0 0 1 3 3 v4 a3 3 0 0 1 -3 3 H12 a3 3 0 0 1 -3 -3 v-4 a3 3 0 0 1 3 -3 Z"
        className="fill-slate-50 dark:fill-slate-800 stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.6" />
      <circle cx="40" cy="48" r="2" fill="#004DE8" />
    </svg>
  );
}

function EmbedIcon() {
  // A code snippet card with a single highlighted <script> line.
  return (
    <svg viewBox="0 0 56 56" className="w-7 h-7" aria-hidden="true">
      <rect x="6" y="11" width="44" height="34" rx="5" className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.6" />
      <line x1="6" y1="20" x2="50" y2="20" className="stroke-slate-200 dark:stroke-slate-700" strokeWidth="1.4" />
      <circle cx="11" cy="15.5" r="1.6" className="fill-slate-300 dark:fill-slate-600" />
      <circle cx="16" cy="15.5" r="1.6" className="fill-slate-300 dark:fill-slate-600" />
      <rect x="11" y="25" width="14" height="2.4" rx="1.2" className="fill-slate-300 dark:fill-slate-600" />
      <rect x="11" y="31" width="32" height="3.2" rx="1.6" fill="#004DE8" opacity="0.14" />
      <path d="M14 38 l-3 2.5 l3 2.5 M42 38 l3 2.5 l-3 2.5 M27 36 l-4 9"
        fill="none" stroke="#004DE8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LiveIcon() {
  // A chat bubble going live with broadcast waves.
  return (
    <svg viewBox="0 0 56 56" className="w-7 h-7" aria-hidden="true">
      <path d="M14 14 h22 a6 6 0 0 1 6 6 v10 a6 6 0 0 1 -6 6 H26 l-7 6 v-6 h-5 a6 6 0 0 1 -6 -6 V20 a6 6 0 0 1 6 -6 Z"
        className="fill-white dark:fill-slate-900 stroke-slate-300 dark:stroke-slate-600" strokeWidth="1.6" />
      <circle cx="20" cy="25" r="2" fill="#004DE8" />
      <circle cx="28" cy="25" r="2" className="fill-slate-300 dark:fill-slate-600" />
      <circle cx="36" cy="25" r="2" className="fill-slate-300 dark:fill-slate-600" />
      <path d="M42 18 a8 8 0 0 1 0 18 M46 14 a14 14 0 0 1 0 26"
        fill="none" stroke="#004DE8" strokeWidth="1.6" strokeLinecap="round" opacity="0.65" />
    </svg>
  );
}

const STEPS = [
  { n: '01', Icon: IngestIcon, title: 'Train on your content', desc: 'Drop in PDFs, paste URLs or text — Vaayu learns your business.' },
  { n: '02', Icon: EmbedIcon, title: 'Embed one line', desc: 'Copy a single script tag into any site — WordPress, Shopify, anything.' },
  { n: '03', Icon: LiveIcon, title: 'Goes live instantly', desc: 'Vaayu starts answering, capturing and scoring — from minute one.' },
];

export default function SetupStrip({ className = '' }: { className?: string }) {
  return (
    <div className={`relative grid gap-6 sm:grid-cols-3 ${className}`}>
      {/* connecting rail (desktop) */}
      <div className="hidden sm:block absolute top-9 left-[16%] right-[16%] h-px border-t border-dashed border-slate-200 dark:border-slate-800" aria-hidden="true" />
      {STEPS.map(({ n, Icon, title, desc }) => (
        <div key={n} className="relative flex flex-col items-start gap-3 rounded-2xl bg-white/60 dark:bg-slate-900/40 sm:bg-transparent sm:dark:bg-transparent p-4 sm:p-0">
          <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
            <Icon />
            <span className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#004DE8] text-[10px] font-semibold text-white font-google">{n}</span>
          </div>
          <h3 className="font-google text-base font-medium text-slate-900 dark:text-white">{title}</h3>
          <p className="font-google text-sm leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
      ))}
    </div>
  );
}
