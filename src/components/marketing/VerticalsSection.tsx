'use client';

import React, { useEffect, useRef, useState } from 'react';
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

const CARD_ASPECT = 407 / 395;

const DESKTOP_QUERY = '(min-width: 1024px)';
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// Height the heading, the two-line description and their margins take above the
// rail, plus a little breathing room, so the rest of the viewport is what the
// centred card gets to fill. Dividing by the aspect turns that back into width.
const TEXT_BLOCK_H = '200px';

// The deck fans out from the middle. Each step out from the centre slides
// sideways by less than a card so the cards overlap, tips a little further over,
// drops down the arc, shrinks and drops a layer. Deriving the geometry from the
// signed distance to the centre keeps any number of cards working - indexing a
// fixed table by slot used to hand back undefined the moment a fourth card was
// added.
const STEP_X = 0.72;
const STEP_Y = 0.07;
const STEP_ROTATE = 8;
const STEP_SCALE = 0.14;
const CENTRE_Z = 30;

// One card per step has to get from one flank to the other, crossing the whole
// deck. Both flanks sit on the same z-index, so without a layer of its own the
// crosser ties with the outgoing centre card and DOM order decides - it slides
// over the top of it. This puts it under everything until it arrives.
const CROSSING_Z = 1;

// Tilting and dropping the flanks pushes them past the centred card's box, so
// the rail carries extra height to keep the arc from being clipped.
const RAIL_H = 1.16;

// What is left of the viewport once the text block and the arc's overhang are
// paid for, converted back into a card width.
const CARD_WIDTH = `min(clamp(260px, 44vw, 720px), calc((100vh - ${TEXT_BLOCK_H}) / ${CARD_ASPECT * RAIL_H}))`;

// Below lg the cards stack full-bleed, so each one is the container width minus
// the section padding (px-6 below sm, sm:px-8 above). At lg and up the card is
// the rail's --cw, which tops out at 44vw.
const CARD_SIZES =
  '(min-width: 1024px) 44vw, (min-width: 640px) calc(100vw - 4rem), calc(100vw - 3rem)';

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

// Signed ring distance from the centre: 0 is centred, +1 the first slot to the
// right, -1 the first to the left, wrapping the long way round for the rest.
function signedOffset(slot: number, total: number) {
  return slot > total / 2 ? slot - total : slot;
}

function slotTransform(offset: number) {
  const depth = Math.abs(offset);
  const x = offset * STEP_X;
  const y = depth * STEP_Y;
  const rotate = offset * STEP_ROTATE;
  const scale = Math.max(0.4, 1 - depth * STEP_SCALE);
  return [
    `translate(calc(50cqw - 0.5 * var(--cw) + ${x} * var(--cw)), calc(${y} * var(--ch)))`,
    `rotate(${rotate}deg)`,
    `scale(${scale})`,
  ].join(' ');
}

function useMatchMedia(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    const sync = () => setMatches(list.matches);
    sync();
    list.addEventListener('change', sync);
    return () => list.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

export default function VerticalsSection() {
  // The card being left behind is tracked alongside the current one so the card
  // crossing the deck can be spotted on the very render that starts its move.
  const [{ active, previous }, setDeck] = useState({ active: 0, previous: 0 });
  const [hoverPaused, setHoverPaused] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  // Off screen or in a background tab the deck has nothing to say, so the timer
  // and the compositor layers it needs are both stood down.
  const [onScreen, setOnScreen] = useState(false);
  const railRef = useRef<HTMLDivElement>(null);

  const isDesktop = useMatchMedia(DESKTOP_QUERY);
  const reducedMotion = useMatchMedia(REDUCED_MOTION_QUERY);

  const goTo = (next: number) =>
    setDeck((current) =>
      current.active === next
        ? current
        : { active: next, previous: current.active },
    );

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    let intersecting = false;
    const sync = () => setOnScreen(intersecting && !document.hidden);

    const observer = new IntersectionObserver(
      (entries) => {
        intersecting = entries[entries.length - 1].isIntersecting;
        sync();
      },
      { threshold: 0.15 },
    );
    observer.observe(rail);
    document.addEventListener('visibilitychange', sync);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  const advancing =
    isDesktop && onScreen && !hoverPaused && !userPaused && !reducedMotion;

  // A click still glides the deck while it is paused, so the cards keep their
  // compositor layers for as long as the deck is on screen and animatable.
  const promoted = isDesktop && onScreen && !reducedMotion;

  useEffect(() => {
    if (!advancing) return;
    const timer = window.setInterval(
      () =>
        setDeck((current) => ({
          active: (current.active + 1) % CHEMICAL_CARDS.length,
          previous: current.active,
        })),
      SLIDE_MS,
    );
    return () => window.clearInterval(timer);
  }, [advancing]);

  const activeCard = CHEMICAL_CARDS[active];
  const total = CHEMICAL_CARDS.length;

  return (
    <div
      className="w-full pt-8 sm:pt-12"
      onMouseEnter={() => setHoverPaused(true)}
      onMouseLeave={() => setHoverPaused(false)}
      onFocusCapture={() => setHoverPaused(true)}
      onBlurCapture={() => setHoverPaused(false)}
    >
      <h3 className="text-center lg:text-left font-google font-semibold tracking-tight lg:leading-[1.1] text-3xl sm:text-4xl xl:text-[2.5rem] text-slate-900 dark:text-white">
        {SECTION_TITLE}
      </h3>

      {/* The blurb tracks the centred card, so it only exists where the deck
          does. It is deliberately not a live region: it would re-announce every
          five seconds and talk over whatever the reader was on. */}
      <div className="hidden lg:flex mt-4 items-start gap-4">
        <p className="max-w-5xl font-google text-lg xl:text-xl leading-[1.6] text-slate-600 dark:text-slate-300 line-clamp-2 min-h-[3.2em]">
          {activeCard.description}
        </p>

        {!reducedMotion && (
          <button
            type="button"
            onClick={() => setUserPaused((current) => !current)}
            className="shrink-0 mt-1 inline-flex items-center justify-center h-9 w-9 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]" aria-hidden>
              {userPaused ? 'play_arrow' : 'pause'}
            </span>
            <span className="sr-only">
              {userPaused
                ? 'Resume the tools carousel'
                : 'Pause the tools carousel'}
            </span>
          </button>
        )}
      </div>

      {/* One tree for both layouts. Below lg it is a plain stack; at lg the same
          cards become the deck, breaking out of the section's padded column so
          the rail reaches both screen edges and the slivers are cropped by the
          window rather than by a gutter sitting inside the page. Rendering the
          two layouts as separate subtrees meant every card's artwork - a large
          inline SVG and a bitmap - was in the DOM twice, and the SVGs' mask ids
          collided. */}
      <div
        ref={railRef}
        className="mt-10 sm:mt-14 lg:mt-10 grid grid-cols-1 gap-6 lg:block lg:relative lg:overflow-hidden lg:w-screen lg:ml-[calc(50%-50vw)] lg:h-[calc(var(--rail-h)*var(--ch))] lg:[container-type:inline-size]"
        style={{
          ['--cw' as string]: CARD_WIDTH,
          ['--ch' as string]: `calc(${CARD_ASPECT} * var(--cw))`,
          ['--rail-h' as string]: String(RAIL_H),
          // Promoting the cards costs a compositor layer each, so they are only
          // promoted while the deck is actually on screen and moving.
          ['--card-will-change' as string]: promoted ? 'transform' : 'auto',
        }}
      >
        {CHEMICAL_CARDS.map((card, index) => {
          const slot = signedOffset((index - active + total) % total, total);
          const from = signedOffset((index - previous + total) % total, total);
          const isCentred = slot === 0;
          const isCrossing =
            slot !== 0 && from !== 0 && Math.sign(slot) !== Math.sign(from);

          return (
            <article
              key={card.id}
              className={`${CARD_SHELL} lg:absolute lg:left-0 lg:top-0 lg:w-[var(--cw)] lg:rounded-[18px] lg:shadow-[0_18px_50px_-12px_rgba(15,23,42,0.28)] lg:[transform:var(--slot-transform)] lg:[z-index:var(--slot-z)] lg:[will-change:var(--card-will-change)] lg:[backface-visibility:hidden] lg:transition-transform lg:duration-[900ms] lg:ease-[cubic-bezier(0.45,0,0.25,1)] lg:motion-reduce:transition-none`}
              style={{
                ['--slot-transform' as string]: slotTransform(slot),
                ['--slot-z' as string]: String(
                  isCrossing ? CROSSING_Z : CENTRE_Z - Math.abs(slot) * 10,
                ),
              }}
            >
              <div className={CARD_ART_FRAME}>
                <NextImage
                  src={card.bg}
                  alt=""
                  fill
                  unoptimized
                  sizes={CARD_SIZES}
                  className="object-cover"
                />
                <card.Art />

                {/* Only the deck is clickable. Below lg this is display:none, so
                    it never reaches the accessibility tree there. The centred
                    card is disabled rather than unlabelled: a button whose only
                    content is aria-hidden artwork has no accessible name. */}
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  disabled={isCentred}
                  className={`hidden lg:block absolute inset-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                    isCentred ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <span className="sr-only">Show {card.title}</span>
                </button>
              </div>

              {/* At lg the deck shows artwork only, so the wording stays in the
                  tree for assistive tech instead of disappearing with it. */}
              <div className="p-5 sm:p-6 text-left flex flex-col flex-grow lg:sr-only lg:p-0">
                <span className="self-start px-2.5 py-1 text-xs font-medium font-google rounded-full bg-indigo-100/80 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 mb-2">
                  {card.tag}
                </span>
                <h4 className="font-google font-semibold tracking-tight text-lg sm:text-xl text-slate-900 dark:text-white mb-2">
                  {card.title}
                </h4>
                <p className="font-google text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
