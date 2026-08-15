import React from 'react';
import Link from 'next/link';
import { PRODUCT } from '@/src/lib/brand';
import { GetStartedButton } from './HeroClient';
import { HERO_BUTTON } from './heroButtonStyle';
import HeroSpiral from './HeroSpiral';
import HeroHorizonField from './HeroHorizonField';

interface HeroSectionProps {
  hideHorizon?: boolean;
  hideWash?: boolean;
}

export default function HeroSection({ hideHorizon = false, hideWash = false }: HeroSectionProps = {}) {
  return (
    <section id="home" className={`relative min-h-dvh pt-16 lg:pt-20 overflow-x-clip transition-colors duration-500 text-slate-100 ${hideWash ? 'bg-transparent' : 'bg-slate-950'}`}>
      {/* Blurred, Faded Background Layer. The radial vignette mask is
          desktop-only — on a narrow viewport the ellipse crops into the
          image's corners instead of softening them, so mobile gets the
          plain faded wash with no mask. */}
      {!hideWash && (
        <div className="absolute inset-0 z-0 pointer-events-none sm:[mask-image:radial-gradient(ellipse,black_50%,transparent_100%)]">
          <div className="absolute inset-0 bg-[url('/image%201.svg')] bg-cover bg-center bg-no-repeat opacity-40 blur-[3px] scale-[1.15]" />
        </div>
      )}

      {/* Full-bleed decorative plane, over the wash. */}
      {!hideHorizon && (
        <HeroHorizonField className="pointer-events-none absolute inset-0 z-0 hidden sm:block h-full w-full text-white" />
      )}

      <div className="max-w-8xl mx-auto w-full min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-5rem)] bg-transparent relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-12 transition-colors duration-500 border-none shadow-none">
        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="max-w-xl flex flex-col justify-center items-center text-center">
            <h1 className="font-newsreader font-light tracking-tight leading-[1.08] text-5xl sm:text-6xl md:text-7xl text-slate-100 mb-6 transition-colors">
              Meet Vaayu <br /> An AI assistant.
            </h1>

            <p className="text-base md:text-lg font-google text-slate-200 leading-relaxed max-w-xl mb-10 transition-colors">
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

            {/* Mobile-only spiral: the horizon field above is hidden below sm */}
            <HeroSpiral className="relative sm:hidden mx-auto mt-10 w-56 opacity-90 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" />
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
    <Link href="/demo/train" className={`${HERO_BUTTON} rounded-4xl cursor-pointer`}>
      Try Demo
    </Link>
  );
}

function TrustedByStrip() {
  return (
    <div className="relative z-10 w-full mt-16 lg:mt-20">
      <p className="text-center text-xs font-google font-semibold uppercase tracking-[0.18em] text-slate-300">
        Businesses building with {PRODUCT.name}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-x-14">
        {TRUSTED_BY.map((name) => (
          <span
            key={name}
            className="text-base sm:text-lg md:text-xl font-google font-semibold tracking-tight text-slate-300 select-none"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
