import React from 'react';
import Link from 'next/link';
import { PRODUCT } from '@/src/lib/brand';
import { GetStartedButton } from './HeroClient';
import { HERO_BUTTON } from './heroButtonStyle';
import HeroSpiral from './HeroSpiral';

export default function HeroSection() {
  return (
    <section id="home" className="relative min-h-dvh pt-16 lg:pt-20 overflow-x-clip transition-colors duration-500">
      {/* Blurred, Faded, and Vignetted Background Layer */}
      <div className="absolute inset-0 z-0 pointer-events-none [mask-image:radial-gradient(ellipse,black_50%,transparent_100%)]">
        <div className="absolute inset-0 bg-[url('/image%201.svg')] bg-cover bg-center bg-no-repeat opacity-40 blur-[3px] scale-[1.15]" />
      </div>
      {/* Decorative — hugs the viewport's right wall and bleeds past it; the
          section's overflow-x-clip does the trimming. */}
      {/* <HeroSpiral className="pointer-events-none absolute z-0 top-1/2 right-0 -translate-y-1/2 translate-x-[30%] hidden sm:block w-[min(120vw,1000px)] opacity-[0.18] dark:opacity-[0.12]" /> */}

      <div className="max-w-8xl mx-auto w-full min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-5rem)] bg-transparent relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-12 transition-colors duration-500 border-none shadow-none">
        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="max-w-xl flex flex-col justify-center items-center text-center">
          <h1 className="font-newsreader font-light tracking-tight leading-[1.08] text-5xl sm:text-6xl md:text-7xl text-slate-900 dark:text-slate-100 mb-6 transition-colors">
            Meet Vaayu <br /> An AI assistant.
          </h1>

          <p className="text-base md:text-lg font-google text-slate-600 dark:text-slate-200 leading-relaxed max-w-xl mb-10 transition-colors">
            Built on your own content. Powered by {PRODUCT.name}.
            <br className="hidden sm:block" />
            Answering 24/7, capturing every lead, proving the revenue it earned.
          </p>

          {/* Row on every breakpoint, gap tightened on mobile to fit — the
              mirrored corners only read as one unit when the buttons sit close. */}
          <div className="flex flex-row justify-center items-center gap-3 sm:gap-4 w-full transition-colors">
            <GetStartedButton />

            <DemoButton />
          </div>

          {/* Mobile-only spiral: the desktop version is a huge absolute
              background wash hidden below sm; here it's a small, in-flow
              decorative mark under the CTAs instead of being hidden outright. */}
          <HeroSpiral className="relative sm:hidden mx-auto mt-10 w-56 opacity-[0.27] dark:opacity-[0.18]" />
          </div>
        </div>

        <TrustedByStrip />
      </div>
    </section>
  );
}

/* ⚠️ PLACEHOLDER wordmarks — swap for real customer logos before launch. */
const TRUSTED_BY = ['Gyanesha Institute', 'Expresolv Ltd.', 'SP Designs'];

function DemoButton() {
  return (
    <Link href="/demo/train" className={`${HERO_BUTTON} rounded-full cursor-pointer`}>
      Try Demo
    </Link>
  );
}

function TrustedByStrip() {
  return (
    <div className="relative z-10 w-full mt-16 lg:mt-20">
      <p className="text-center text-xs font-google font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        Businesses building with {PRODUCT.name}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14">
        {TRUSTED_BY.map((name) => (
          <span
            key={name}
            className="text-lg sm:text-xl font-google font-bold tracking-tight text-slate-400 dark:text-slate-600 select-none"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
