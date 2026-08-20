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

      {/* Full-bleed decorative plane, over the wash. */}
      {!hideHorizon && (
        <HeroHorizonField className="pointer-events-none absolute inset-0 z-0 hidden sm:block h-full w-full text-white" />
      )}

      <div className="max-w-8xl mx-auto w-full min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-5rem)] bg-transparent relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-12 transition-colors duration-500 border-none shadow-none">
        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="max-w-2xl flex flex-col justify-center items-center text-center space-y-6 sm:space-y-7">
            {/* Element 1: Eyebrow */}
            <span className="text-base sm:text-lg font-google font-normal text-slate-200 tracking-tight leading-none">
              An AI Chatbot
            </span>

            {/* Element 2: Main Title */}
            <h1 className="font-gloock font-normal text-4xl sm:text-5xl md:text-6xl lg:text-7xl text-white leading-tight tracking-normal transition-colors">
              Meet Vaayu
            </h1>

            {/* Element 3: Description */}
            <p className="text-base sm:text-lg font-google text-slate-200 leading-relaxed max-w-xl transition-colors">
              Your businesses’s everyday sales representative.
              <br className="hidden sm:block" />
              Lives on your website and capture genuine lead
            </p>

            {/* Element 4: Buttons */}
            <div className="flex flex-row justify-center items-center gap-3 sm:gap-4 w-full transition-colors">
              <GetStartedButton />

              <DemoButton />
            </div>

            {/* Mobile-only spiral: the horizon field above is hidden below sm */}
            <HeroSpiral className="relative sm:hidden mx-auto w-56 opacity-90 drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" />
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
