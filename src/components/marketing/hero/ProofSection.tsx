import React from 'react';
import Link from 'next/link';
import { PRODUCT } from '@/src/lib/brand';
import PixelField, { PIXEL } from './PixelField';

const BRAND_LOGOS = [
  { name: 'Expresolv Ltd.', src: '/Brand_expresolv.svg', heightClass: 'h-8 sm:h-10' },
  { name: 'SP Designs', src: '/Brand_SPdesigns.svg', heightClass: 'h-10 sm:h-12' },
];

/* Claims about what the product does, not outcomes we have not measured.
   Swap any entry for a real workspace number once it is worth standing behind. */
const STATS = [
  { value: '24/7', label: 'Answering, with no one on shift' },
  { value: '3', label: 'Source types: PDFs, URLs, pasted text' },
  { value: '1 line', label: 'Of JavaScript to go live anywhere' },
  { value: '0', label: 'Answers invented outside your documents' },
];

/* The hero's field runs off the top of this section, so its own copy fades in
   from both edges rather than starting hard. */
const FIELD_FADE =
  'linear-gradient(to bottom, transparent 0%, #000 18%, #000 78%, transparent 100%)';

/* Kept out of the stat row and the CTA panel, where a warm square behind
   translucent glass reads as a smudge rather than a pixel. */
const ACCENTS = [
  { x: 2 * PIXEL.CELL, y: 2 * PIXEL.CELL },
  { x: 27 * PIXEL.CELL, y: 1 * PIXEL.CELL },
  { x: 44 * PIXEL.CELL, y: 5 * PIXEL.CELL },
];

/* One lattice square, at the field's exact metrics, used as each stat's marker.
   The row steps the tone down left to right the way the field's own cells vary,
   so four identical markers do not read as a checklist. */
const MARKER_TONE = ['', 'opacity-70', 'opacity-45', 'opacity-25'];

function LatticeSquare({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block bg-[#EE6C1F] ${className}`}
      style={{
        width: PIXEL.SQUARE,
        height: PIXEL.SQUARE,
        borderRadius: PIXEL.RADIUS,
      }}
    />
  );
}

export default function ProofSection() {
  return (
    <section className="relative overflow-hidden bg-[#FAFAFC] py-20 text-slate-900 transition-colors duration-500 dark:bg-black dark:text-slate-100 sm:py-28">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
        <div style={{ maskImage: FIELD_FADE, WebkitMaskImage: FIELD_FADE }} className="absolute inset-0">
          <PixelField className="absolute inset-0" id="proof-field" accents={ACCENTS} />
        </div>

        {/* The warm counterpart to the hero's blue glow: enough to tint the
            white ground toward the accent without lifting off the page. */}
        <div
          className="absolute left-1/2 top-1/3 h-[34rem] w-[64rem] -translate-x-1/2 rounded-full blur-3xl opacity-[0.07] dark:opacity-[0.12]"
          style={{
            background:
              'radial-gradient(closest-side, #EE6C1F 0%, #F59E0B 50%, transparent 100%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-8xl px-6 sm:px-12 lg:px-20">
        <div className="flex items-center justify-center gap-3">
          <LatticeSquare />
          <p className="font-google text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Businesses building with {PRODUCT.name}
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-8 sm:gap-x-20">
          {BRAND_LOGOS.map((brand) => (
            <img
              key={brand.name}
              src={brand.src}
              alt={brand.name}
              className={`${brand.heightClass} w-auto select-none object-contain opacity-85 transition-all duration-300 hover:opacity-100 invert dark:invert-0`}
            />
          ))}
        </div>

        <dl className="mt-16 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              className="group relative flex flex-col rounded-2xl border border-slate-900/[0.07] bg-white/70 p-6 backdrop-blur-sm transition-colors duration-300 hover:border-[#EE6C1F]/45 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-[#EE6C1F]/45 sm:p-7"
            >
              <LatticeSquare className={`${MARKER_TONE[i]} transition-opacity duration-300 group-hover:opacity-100`} />
              <dt className="mt-6 font-gloock text-3xl font-normal leading-none text-slate-900 dark:text-white sm:text-[2.5rem]">
                {stat.value}
              </dt>
              <dd className="mt-3 font-google text-sm leading-snug text-slate-600 dark:text-slate-400">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>

        <div className="relative mt-4 flex flex-col items-start gap-6 overflow-hidden rounded-2xl border border-slate-900/[0.07] bg-white/70 p-6 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.035] sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          {/* Reads as the field showing through the panel's left edge rather
              than as a border treatment of its own. */}
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1 bg-[#EE6C1F]"
          />

          <div className="max-w-xl pl-2 sm:pl-3">
            <h2 className="font-google text-xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              Point it at your own website and watch it learn
            </h2>
            <p className="mt-2 font-google text-sm leading-relaxed text-slate-600 dark:text-slate-300 sm:text-base">
              The demo trains on a URL you give it, then answers your questions from what
              it found. Nothing to install, and no card.
            </p>
          </div>

          <Link
            href="/demo/train"
            className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-[#EE6C1F] px-6 py-3 font-google text-sm font-medium text-white transition-colors duration-200 hover:bg-[#D45C13]"
          >
            Try the live demo
            <span className="material-symbols-outlined text-[18px] transition-transform duration-200 group-hover:translate-x-0.5">
              arrow_forward
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
