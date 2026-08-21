'use client';

import React, { useRef, useState } from 'react';
import NextImage from 'next/image';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type VerticalType = 'generic' | 'chemical';

interface TabOption {
  id: VerticalType;
  label: string;
  shortLabel: string;
}

// Both full labels side by side need ~383px, more than a 375px phone has after
// page padding, and the pills cannot wrap - so narrow screens get the short form.
const TABS: TabOption[] = [
  { id: 'generic', label: 'Generic Vertical', shortLabel: 'Generic' },
  { id: 'chemical', label: 'Chemical Industry Vertical', shortLabel: 'Chemical' },
];

const CHEMICAL_CARDS = [
  {
    id: 'sds',
    tag: 'Google Drive Search',
    title: 'Safety Data Sheets (SDS)',
    description:
      'Advanced search technique that queries your secure Google Drive repository to instantly retrieve precise, compliant Safety Data Sheets with granular file security.',
    src: '/SDS_card1.webp',
    width: 1314,
    height: 1389,
    alt: 'Safety Data Sheet (SDS) Search',
  },
  {
    id: 'coa',
    tag: 'Batch & Lot Indexing',
    title: 'Certificates of Analysis (COA)',
    description:
      'Intelligently indexes batch and lot numbers across Google Drive to deliver authenticated COA documents in seconds with role-based access control.',
    src: '/COA_card2.webp',
    width: 1314,
    height: 1383,
    alt: 'Certificate of Analysis (COA) Search',
  },
  {
    id: 'spec',
    tag: 'Deep Doc Parsing',
    title: 'Technical Specifications (SPEC)',
    description:
      'Leverages deep document parsing to locate exact chemical specs and lab reports in Google Drive, maintaining strict security permissions for customer sharing.',
    src: '/Specs_card3.webp',
    width: 1314,
    height: 1383,
    alt: 'Technical Specifications (SPEC) Search',
  },
];

// Grid is max-w-7xl (1280px) with lg padding 48px/side and 32px gaps, so each
// card settles at ~373px once the container caps out. Below lg the grid stacks
// full-bleed, so the card is the container width minus the section padding
// (px-6 below sm, sm:px-8 above).
const CARD_SIZES =
  '(min-width: 1280px) 373px, (min-width: 1024px) 30vw, (min-width: 640px) calc(100vw - 4rem), calc(100vw - 3rem)';

const CARD_SHELL =
  'w-full min-w-0 rounded-xl bg-slate-100/60 dark:bg-slate-900/50 backdrop-blur-xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden flex flex-col';

export default function VerticalsSection() {
  const [activeTab, setActiveTab] = useState<VerticalType>('generic');
  const prefersReducedMotion = useReducedMotion();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const onTabKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const next = (index + (event.key === 'ArrowRight' ? 1 : -1) + TABS.length) % TABS.length;
    setActiveTab(TABS[next].id);
    tabRefs.current[next]?.focus();
  };

  const transition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 400, damping: 30 };

  return (
    <div className="w-full pt-8 sm:pt-12">
      {/* Sliding Pill Navbar */}
      <div className="flex items-center justify-center">
        <div
          role="tablist"
          aria-label="Choose a vertical"
          className="relative inline-flex p-1.5 rounded-full bg-slate-200/70 dark:bg-slate-800/70 backdrop-blur-md border border-slate-300/60 dark:border-slate-700/60 shadow-inner"
        >
          {TABS.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`vertical-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls="vertical-tabpanel"
                tabIndex={isActive ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                onKeyDown={(event) => onTabKeyDown(event, index)}
                className={`relative px-5 sm:px-6 py-3 sm:py-2.5 text-sm sm:text-base font-google font-medium rounded-full transition-colors duration-200 z-10 select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-200 dark:focus-visible:ring-offset-slate-800 ${
                  isActive
                    ? 'text-slate-900 dark:text-white font-semibold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="activeVerticalTab"
                    className="absolute inset-0 rounded-full bg-white dark:bg-slate-900 shadow-md border border-slate-200/80 dark:border-slate-700/80 -z-10"
                    transition={transition}
                  />
                )}
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="vertical-tabpanel"
        role="tabpanel"
        aria-labelledby={`vertical-tab-${activeTab}`}
        className="mt-10 sm:mt-14"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -12 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.25 }}
            className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8"
          >
            {activeTab === 'chemical'
              ? CHEMICAL_CARDS.map((card) => (
                  <article key={card.id} className={CARD_SHELL}>
                    <NextImage
                      src={card.src}
                      alt={card.alt}
                      width={card.width}
                      height={card.height}
                      sizes={CARD_SIZES}
                      className="w-full h-auto block"
                    />

                    <div className="p-5 sm:p-6 lg:p-5 xl:p-6 text-left flex flex-col flex-grow">
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
                ))
              : CHEMICAL_CARDS.map((card) => (
                  <div key={card.id} className={CARD_SHELL} aria-hidden="true">
                    {/* Mirrors the real card so the height tracks it at every width:
                        image aspect box + a text block the size of tag/title/copy. */}
                    <div className="w-full aspect-[1314/1389]" />
                    <div className="p-5 sm:p-6 lg:p-5 xl:p-6 h-44 sm:h-48" />
                  </div>
                ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
