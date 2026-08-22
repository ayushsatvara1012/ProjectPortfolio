'use client';

import React, { useState } from 'react';
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

const CARD_ASPECT = 407 / 395;

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

// A card picked from one flank has to reach the other, crossing the whole deck.
// Both flanks sit on the same z-index, so without a layer of its own the crosser
// ties with the outgoing centre card and DOM order decides - it slides over the
// top of it. This puts it under everything until it arrives.
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

// Promoting a card costs a compositor layer, and at a 720px card that is several
// megabytes each. The deck only ever moves in response to a click, so the layers
// are taken out purely in CSS while the rail is hovered or holds focus - which is
// the only moment a move can be coming - and handed straight back afterwards.
// Doing this with a hook would mean state, an effect and a re-render for
// something the compositor can decide on its own.
const CARD_PROMOTION =
  'lg:group-hover:[will-change:transform] lg:group-focus-within:[will-change:transform]';

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

export default function VerticalsSection() {
  // The card being left behind is tracked alongside the current one so the card
  // crossing the deck can be spotted on the very render that starts its move.
  // This is the component's only state: the deck advances on click and nothing
  // else, so there is no timer, no observer and no media query to keep in step.
  const [{ active, previous }, setDeck] = useState({ active: 0, previous: 0 });

  const goTo = (next: number) =>
    setDeck((current) =>
      current.active === next
        ? current
        : { active: next, previous: current.active },
    );

  const activeCard = CHEMICAL_CARDS[active];
  const total = CHEMICAL_CARDS.length;

  return (
    <div className="w-full pt-8 sm:pt-12">
      <h3 className="text-center lg:text-left font-google font-semibold tracking-tight lg:leading-[1.1] text-3xl sm:text-4xl xl:text-[2.5rem] text-slate-900 dark:text-white">
        {SECTION_TITLE}
      </h3>

      {/* The blurb tracks the centred card, so it only exists where the deck
          does. A polite live region is right here because the text now changes
          only when someone picks a card - one announcement per click. It was
          wrong while the deck advanced on a timer, which re-announced every five
          seconds over whatever the reader was on. */}
      <p
        aria-live="polite"
        className="hidden lg:block mt-4 max-w-5xl font-google text-lg xl:text-xl leading-[1.6] text-slate-600 dark:text-slate-300 line-clamp-2 min-h-[3.2em]"
      >
        {activeCard.description}
      </p>

      {/* One tree for both layouts. Below lg it is a plain stack; at lg the same
          cards become the deck, breaking out of the section's padded column so
          the rail reaches both screen edges and the slivers are cropped by the
          window rather than by a gutter sitting inside the page. Rendering the
          two layouts as separate subtrees meant every card's artwork - a large
          inline SVG and a bitmap - was in the DOM twice, and the SVGs' mask ids
          collided. */}
      <div
        className="group mt-10 sm:mt-14 lg:mt-10 grid grid-cols-1 gap-6 lg:block lg:relative lg:overflow-hidden lg:w-screen lg:ml-[calc(50%-50vw)] lg:h-[calc(var(--rail-h)*var(--ch))] lg:[container-type:inline-size]"
        style={{
          ['--cw' as string]: CARD_WIDTH,
          ['--ch' as string]: `calc(${CARD_ASPECT} * var(--cw))`,
          ['--rail-h' as string]: String(RAIL_H),
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
              className={`${CARD_SHELL} ${CARD_PROMOTION} lg:absolute lg:left-0 lg:top-0 lg:w-[var(--cw)] lg:rounded-[18px] lg:shadow-[0_18px_50px_-12px_rgba(15,23,42,0.28)] lg:[transform:var(--slot-transform)] lg:[z-index:var(--slot-z)] lg:[backface-visibility:hidden] lg:transition-transform lg:duration-[900ms] lg:ease-[cubic-bezier(0.45,0,0.25,1)] lg:motion-reduce:transition-none`}
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
                    card stays enabled and focusable on purpose: disabling it
                    would drop focus on the floor the moment a keyboard user
                    picked a card, because the button they just activated is the
                    one that becomes centred. */}
                <button
                  type="button"
                  onClick={() => goTo(index)}
                  aria-current={isCentred}
                  className={`hidden lg:block absolute inset-0 rounded-[18px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                    isCentred ? 'cursor-default' : 'cursor-pointer'
                  }`}
                >
                  <span className="sr-only">
                    {isCentred ? `Showing ${card.title}` : `Show ${card.title}`}
                  </span>
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
