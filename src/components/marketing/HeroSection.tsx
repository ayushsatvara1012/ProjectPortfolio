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
    <section id="home" className={`relative min-h-dvh pt-16 lg:pt-20 overflow-x-clip transition-colors duration-500 text-slate-900 dark:text-slate-100 ${hideWash ? 'bg-transparent' : 'bg-[#FAFAFC] dark:bg-black'}`}>

      {/* Background image behind terrain */}
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden sm:block bg-cover bg-center opacity-90 dark:opacity-50"
        style={{ backgroundImage: "url('/hero_coloredBG.webp')" }}
        aria-hidden="true"
      />
      {/* Dark layer over background image for dark theme */}
      <div
        className="pointer-events-none absolute inset-0 z-0 hidden sm:dark:block bg-black/60"
        aria-hidden="true"
      />

      {/* Full-bleed decorative plane, over the wash. */}
      {!hideHorizon && (
        <HeroHorizonField className="pointer-events-none absolute inset-0 z-0 hidden sm:block h-full w-full text-slate-900 dark:text-white" />
      )}

      <div className="max-w-8xl mx-auto w-full min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-5rem)] bg-transparent relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-12 transition-colors duration-500 border-none shadow-none">
        <div className="relative z-10 w-full flex flex-col items-center">
          <div className="max-w-2xl flex flex-col justify-center items-center text-center space-y-6 sm:space-y-7">
            {/* Element 1: Eyebrow */}
            <span className="text-base sm:text-lg font-google font-normal text-slate-600 dark:text-slate-200 tracking-tight leading-none">
              An AI Chatbot
            </span>

            {/* Element 2: Main Title */}
            <h1 className="font-gloock font-normal text-3xl sm:text-4xl md:text-5xl lg:text-6xl text-slate-900 dark:text-white leading-tight tracking-normal transition-colors">
              Meet Vaayu
            </h1>

            {/* Element 3: Description */}
            <p className="text-base sm:text-lg font-google text-slate-600 dark:text-slate-200 leading-relaxed max-w-xl transition-colors">
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
            <HeroSpiral className="relative sm:hidden mx-auto w-56 opacity-80 dark:opacity-90 drop-shadow-[0_0_10px_rgba(0,0,0,0.15)] dark:drop-shadow-[0_0_10px_rgba(255,255,255,0.4)]" />
          </div>
        </div>

        <TrustedByStrip />
      </div>

      {/* Bottom gradient fade dissolve into next section */}
      <div
        className="pointer-events-none absolute bottom-0 inset-x-0 h-32 sm:h-44 lg:h-56 bg-gradient-to-b from-transparent via-[#FAFAFC]/50 to-[#FAFAFC] dark:via-black/50 dark:to-black z-[5] transition-colors duration-500"
        aria-hidden="true"
      />
    </section>
  );
}

const BRAND_LOGOS = [
  {
    name: 'Gyanesha Institute',
    src: '/Brand_Gyanesha.svg',
    heightClass: 'h-10 sm:h-14 lg:h-16',
  },
  {
    name: 'Expresolv Ltd.',
    src: '/Brand_expresolv.svg',
    heightClass: 'h-8 sm:h-11 lg:h-12',
  },
  {
    name: 'SP Designs',
    src: '/Brand_SPdesigns.svg',
    heightClass: 'h-10 sm:h-14 lg:h-16',
  },
];

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
      <p className="text-center text-xs font-google font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        Businesses building with {PRODUCT.name}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-8 sm:gap-x-20">
        {BRAND_LOGOS.map((brand) => (
          <img
            key={brand.name}
            src={brand.src}
            alt={brand.name}
            className={`${brand.heightClass} w-auto object-contain opacity-85 hover:opacity-100 transition-all duration-300 select-none filter invert dark:invert-0`}
          />
        ))}
      </div>
    </div>
  );
}
