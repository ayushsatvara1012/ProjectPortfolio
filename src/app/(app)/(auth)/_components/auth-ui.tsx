'use client';

/**
 * Shared building blocks for the custom Clerk Elements auth flows.
 *
 * The visual language is lifted straight from the insights dashboard design
 * system (`src/app/components/insights/ui.tsx`):
 *   - Font: Plus Jakarta Sans (inherited `font-sans`).
 *   - Surfaces: rounded-2xl white / slate-900 cards, border-slate-200/80,
 *     subtle shadow-slate-900/[0.03].
 *   - Text hierarchy: slate-900 headings, slate-600/500 body, slate-400 muted.
 *   - Accent: blue-600 interactive, focus-visible ring blue-500.
 */

import Image from 'next/image';
import React from 'react';

/* ── Class tokens ─────────────────────────────────────────────────────────── */

export const card =
  'w-full rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm shadow-slate-900/[0.03] p-7 sm:p-8';

export const labelCls =
  'block text-[12.5px] font-medium text-slate-600 dark:text-slate-300';

export const inputCls =
  'w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ' +
  'px-3.5 py-2.5 text-[14px] text-slate-900 dark:text-slate-100 placeholder:text-slate-400 ' +
  'outline-none transition-colors ' +
  'focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 ' +
  'data-[invalid]:border-rose-400 data-[invalid]:focus:border-rose-400 data-[invalid]:focus:ring-rose-500/25';

export const fieldErrorCls =
  'text-[12px] font-medium text-rose-600 dark:text-rose-400';

export const btnPrimary =
  'w-full inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 ' +
  'text-white text-[14px] font-semibold px-4 py-2.5 shadow-sm transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ' +
  'focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export const btnSocial =
  'w-full inline-flex items-center justify-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 ' +
  'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 ' +
  'text-[14px] font-semibold text-slate-700 dark:text-slate-200 px-4 py-2.5 transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ' +
  'disabled:opacity-60 disabled:cursor-not-allowed';

export const linkCls =
  'font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors';

/* ── Pieces ───────────────────────────────────────────────────────────────── */

export function BrandHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex flex-col items-center text-center mb-6">
      <Image
        src="/logo2.svg"
        alt="Sapybase"
        width={40}
        height={40}
        priority
        className="h-10 w-10 mb-4"
      />
      <h1 className="text-[20px] font-bold text-slate-900 dark:text-slate-100 tracking-[-0.01em] leading-tight">
        {title}
      </h1>
      <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`h-4 w-4 animate-spin motion-reduce:animate-none ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 0 1 8-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export function GoogleIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

/** Reusable "or" separator between social and credentials. */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-5" aria-hidden>
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
      <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        or
      </span>
      <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
    </div>
  );
}
