import React from 'react';
import Link from 'next/link';
import { GetStartedButton } from './HeroClient';
import { HERO_BUTTON } from './heroButtonStyle';
import HeroBackdrop from './hero/HeroBackdrop';
import ScaledDashboard from './hero/ScaledDashboard';

interface HeroSectionProps {
  hideWash?: boolean;
}

export default function HeroSection({ hideWash = false }: HeroSectionProps = {}) {
  return (
    <section
      id="home"
      className={`relative min-h-dvh overflow-x-clip pt-16 text-slate-900 transition-colors duration-500 dark:text-slate-100 lg:pt-20 ${hideWash ? 'bg-transparent' : 'bg-[#FAFAFC] dark:bg-black'
        }`}
    >
      <HeroBackdrop />

      <div className="relative z-10 mx-auto flex w-full max-w-8xl flex-col items-center px-6 pt-14 sm:px-12 sm:pt-20 lg:px-20">
        <div className="flex max-w-3xl flex-col items-center space-y-6 text-center sm:space-y-7">
          <h1 className="font-gloock text-4xl font-normal leading-tight tracking-normal text-slate-900 transition-colors dark:text-white sm:text-5xl md:text-6xl lg:text-7xl">
            Meet Vaayu
          </h1>

          <p className="max-w-xl font-google text-base leading-relaxed text-slate-600 transition-colors dark:text-slate-300 sm:text-lg">
            Your business&rsquo;s everyday sales representative. It lives on your website,
            answers from your own documents, captures genuine leads, and shows you every
            question it could not yet answer.
          </p>

          <div className="flex w-full flex-row items-center justify-center gap-3 transition-colors sm:gap-4">
            <GetStartedButton />
            <DemoButton />
          </div>
        </div>
      </div>

      {/* Sits outside the copy's container so it keeps its own narrow gutter and
          reads as wide as the screen allows, rather than inheriting lg:px-20. */}
      <div className="relative z-10 mt-14 w-full px-4 sm:mt-20 sm:px-6">
        <ScaledDashboard />
      </div>
    </section>
  );
}

function DemoButton() {
  return (
    <Link href="/demo/train" className={`${HERO_BUTTON} cursor-pointer rounded-4xl`}>
      Try Demo
    </Link>
  );
}
