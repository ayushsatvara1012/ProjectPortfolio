import React from 'react';
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

/* Kept out of the stat row, where a warm square behind
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

/* Each stat gets its own polygon so the row reads as four distinct markers,
   stepping up in sides from left to right. */
const MARKER_CLIP = [
  'polygon(50% 0%, 100% 100%, 0% 100%)',
  'none',
  'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
  'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
];

function LatticeMarker({ index, className = '' }: { index: number; className?: string }) {
  const clip = MARKER_CLIP[index];
  return (
    <span
      aria-hidden="true"
      className={`block bg-[#EE6C1F] ${className}`}
      style={{
        width: PIXEL.SQUARE,
        height: PIXEL.SQUARE,
        borderRadius: clip === 'none' ? PIXEL.RADIUS : 0,
        clipPath: clip === 'none' ? undefined : clip,
      }}
    />
  );
}

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
              <LatticeMarker index={i} className={`${MARKER_TONE[i]} transition-opacity duration-300 group-hover:opacity-100`} />
              <dt className="mt-6 font-gloock text-3xl font-normal leading-none text-slate-900 dark:text-white sm:text-[2.5rem]">
                {stat.value}
              </dt>
              <dd className="mt-3 font-google text-sm leading-snug text-slate-600 dark:text-slate-400">
                {stat.label}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
