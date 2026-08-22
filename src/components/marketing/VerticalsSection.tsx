'use client';

import React, { useCallback, useEffect, useState } from 'react';
import NextImage from 'next/image';
import SdsCardArt from './verticals/SdsCardArt';
import CoaCardArt from './verticals/CoaCardArt';
import SpecCardArt from './verticals/SpecCardArt';

const SECTION_TITLE = 'Chemical Industry Custom Tools :';

const CHEMICAL_CARDS = [
  {
    id: 'sds',
    tag: 'Google Drive Search',
    title: 'Safety Data Sheets (SDS)',
    description:
      'Advanced search that queries your secure Google Drive repository to instantly retrieve precise, compliant Safety Data Sheets with granular security.',
    bg: '/card-bg-sds.webp',
    Art: SdsCardArt,
  },
  {
    id: 'coa',
    tag: 'Batch & Lot Indexing',
    title: 'Certificates of Analysis (COA)',
    description:
      'Intelligently indexes batch and lot numbers across Google Drive to deliver authenticated COA documents in seconds with role-based access control.',
    bg: '/card-bg-coa.webp',
    Art: CoaCardArt,
  },
  {
    id: 'spec',
    tag: 'Deep Doc Parsing',
    title: 'Technical Specifications (SPEC)',
    description:
      'Leverages deep document parsing to locate exact chemical specs and lab reports in Google Drive, with strict permissions for customer sharing.',
    bg: '/card-bg-spec.webp',
    Art: SpecCardArt,
  },
];

const SLIDE_MS = 5000;

// Carousel geometry, all expressed as multiples of the card width w.
// The centred card is fully visible, its two neighbours are cropped to a 30%
// sliver by the rail, and a 0.07w gutter sits between them. That fixes the rail
// at 2 * (0.5 + 0.07 + 0.3) = 1.74w, which in turn fixes each slot's offset.
const RAIL_W = 1.74;
const POS_CENTER = 0.37; // (RAIL_W - 1) / 2
const POS_PREV = -0.7; // peek - 1
const POS_NEXT = 1.44; // RAIL_W - peek
const CARD_ASPECT = 407 / 395;
const SLOT_OFFSET = [POS_CENTER, POS_NEXT, POS_PREV];

// The card is sized off the viewport height so the centred art lands at ~60vh,
// then capped by the rail so a short, narrow window shrinks it instead of
// cropping the neighbours further. 57.47cqw is 100 / RAIL_W.
const CARD_WIDTH = 'min(clamp(300px, 58.23vh, 640px), 57.47cqw)';

// Grid is max-w-8xl with lg padding 48px/side and 32px gaps, so each card
// settles at ~373px once the container caps out. Below lg the grid stacks
// full-bleed, so the card is the container width minus the section padding
// (px-6 below sm, sm:px-8 above).
const CARD_SIZES =
  '(min-width: 1280px) 373px, (min-width: 1024px) 30vw, (min-width: 640px) calc(100vw - 4rem), calc(100vw - 3rem)';

const CARD_SHELL = 'w-full min-w-0 overflow-hidden flex flex-col';

// The artwork is a mesh gradient with the UI drawn over it. The gradient stays a
// bitmap because it is pure smooth colour; the UI is vector so its text and
// hairlines stay sharp at any resolution. unoptimized keeps Next from
// re-encoding an already-minimal gradient.
// 18px matches the r=18 the artwork draws its own panel with. Keeping the CSS
// clip at or above that radius stops a sliver of bare gradient showing outside
// the panel arc at the corners.
const CARD_ART_FRAME =
  'relative w-full aspect-[395/407] overflow-hidden rounded-[18px]';

interface CarouselState {
  active: number;
  /** Card teleporting between the two edge slots, so it must not animate. */
  instantId: string | null;
}

function wrappingCardId(from: number, to: number): string | null {
  const total = CHEMICAL_CARDS.length;
  // A card moving straight between the left and right slivers would sweep the
  // whole rail. Flag it so it jumps and fades in at its new edge instead.
  const card = CHEMICAL_CARDS.find((_, index) => {
    const before = (index - from + total) % total;
    const after = (index - to + total) % total;
    return (before === 2 && after === 1) || (before === 1 && after === 2);
  });
  return card ? card.id : null;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);
  return reduced;
}

export default function VerticalsSection() {
  const [{ active, instantId }, setState] = useState<CarouselState>({
    active: 0,
    instantId: null,
  });
  const [paused, setPaused] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  const goTo = useCallback((next: number) => {
    setState((current) =>
      current.active === next
        ? current
        : { active: next, instantId: wrappingCardId(current.active, next) },
    );
  }, []);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setState((current) => {
        const next = (current.active + 1) % CHEMICAL_CARDS.length;
        return { active: next, instantId: wrappingCardId(current.active, next) };
      });
    }, SLIDE_MS);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion]);

  // Clear the no-transition flag only once the browser has painted the card at
  // its new slot, otherwise it animates the jump we just suppressed.
  useEffect(() => {
    if (!instantId) return;
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() =>
        setState((current) => ({ ...current, instantId: null })),
      );
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, [instantId]);

  const activeCard = CHEMICAL_CARDS[active];

  return (
    <div className="w-full pt-8 sm:pt-12">
      {/* Phones and small tablets keep the plain stack. */}
      <div className="lg:hidden">
        <h3 className="text-center font-google font-semibold tracking-tight text-3xl sm:text-4xl text-slate-900 dark:text-white mb-10 sm:mb-14">
          {SECTION_TITLE}
        </h3>

        <div className="grid grid-cols-1 gap-6">
          {CHEMICAL_CARDS.map(({ id, tag, title, description, bg, Art }) => (
            <article key={id} className={CARD_SHELL}>
              <div className={CARD_ART_FRAME}>
                <NextImage
                  src={bg}
                  alt=""
                  fill
                  unoptimized
                  sizes={CARD_SIZES}
                  className="object-cover"
                />
                <Art />
              </div>

              <div className="p-5 sm:p-6 text-left flex flex-col flex-grow">
                <span className="self-start px-2.5 py-1 text-xs font-medium font-google rounded-full bg-indigo-100/80 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 mb-2">
                  {tag}
                </span>
                <h4 className="font-google font-semibold tracking-tight text-lg sm:text-xl text-slate-900 dark:text-white mb-2">
                  {title}
                </h4>
                <p className="font-google text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>

      {/* Laptops and large tablets get the carousel. */}
      <div
        className="hidden lg:block"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocusCapture={() => setPaused(true)}
        onBlurCapture={() => setPaused(false)}
        style={{ containerType: 'inline-size' }}
      >
        <h3 className="font-google font-semibold tracking-tight leading-[1.1] text-4xl xl:text-[2.5rem] text-slate-900 dark:text-white">
          {SECTION_TITLE}
        </h3>

        <p
          aria-live="polite"
          className="mt-4 max-w-5xl font-google text-lg xl:text-xl leading-[1.6] text-slate-600 dark:text-slate-300 line-clamp-2 min-h-[3.2em]"
        >
          {activeCard.description}
        </p>

        <div
          className="relative mt-10 mx-auto overflow-hidden"
          style={{
            ['--cw' as string]: CARD_WIDTH,
            width: `calc(${RAIL_W} * var(--cw))`,
            height: `calc(${CARD_ASPECT} * var(--cw))`,
          }}
        >
          {CHEMICAL_CARDS.map((card, index) => {
            const slot =
              (index - active + CHEMICAL_CARDS.length) % CHEMICAL_CARDS.length;
            const isCentred = slot === 0;
            const isTeleporting = card.id === instantId;

            return (
              <button
                key={card.id}
                type="button"
                aria-label={isCentred ? undefined : `Show ${card.title}`}
                aria-current={isCentred}
                tabIndex={isCentred ? -1 : 0}
                onClick={() => goTo(index)}
                className={`absolute left-0 top-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isCentred ? 'cursor-default' : 'cursor-pointer'
                }`}
                style={{
                  width: 'var(--cw)',
                  transform: `translateX(calc(${SLOT_OFFSET[slot]} * var(--cw)))`,
                  opacity: isTeleporting ? 0 : 1,
                  transition:
                    isTeleporting || reducedMotion
                      ? 'none'
                      : 'transform 700ms cubic-bezier(0.22, 1, 0.36, 1), opacity 500ms ease-out',
                }}
              >
                <div className={CARD_ART_FRAME}>
                  <NextImage
                    src={card.bg}
                    alt=""
                    fill
                    unoptimized
                    sizes="(min-width: 1024px) 60vh, 60vw"
                    className="object-cover"
                  />
                  <card.Art />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
