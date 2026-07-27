import React from 'react';
import Link from 'next/link';
import { PRODUCT } from '@/src/lib/brand';
import { DemoButton } from './HeroClient';
import HeroSpiral from './HeroSpiral';
import { ArrowRightIcon } from '@/src/components/icons';

export default function HeroSection() {
  return (
    <section id="home" className="relative min-h-dvh pt-16 lg:pt-20 overflow-x-clip transition-colors duration-500">
      {/* Decorative — hugs the viewport's right wall and bleeds past it; the
          section's overflow-x-clip does the trimming. */}
      <HeroSpiral className="pointer-events-none absolute z-0 top-1/2 right-0 -translate-y-1/2 translate-x-[30%] hidden sm:block w-[min(120vw,1000px)] opacity-[0.12] dark:opacity-[0.08]" />

      <div className="max-w-8xl mx-auto w-full min-h-[calc(100dvh-4rem)] lg:min-h-[calc(100dvh-5rem)] bg-transparent relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-12 transition-colors duration-500 border-none shadow-none">
        <div className="relative z-10 w-full flex flex-col items-start">
          <div className="max-w-xl flex flex-col justify-center items-start text-left">
          <h1 className="font-newsreader font-light tracking-tight leading-[1.08] text-5xl sm:text-6xl md:text-7xl text-slate-900 dark:text-slate-100 mb-6 transition-colors">
            Answers for every customer
          </h1>

          <p className="text-base md:text-lg font-google text-slate-600 dark:text-slate-200 leading-relaxed max-w-xl mb-10 transition-colors">
            Built on your own content. Powered by {PRODUCT.name}.
            <br className="hidden sm:block" />
            Answering 24/7, capturing every lead, proving the revenue it earned.
          </p>

          <div className="flex flex-col sm:flex-row justify-start items-center gap-8 w-full transition-colors">
            <Link
              href="/vaayu"
              className="overflow-hidden relative bg-slate-900 dark:bg-slate-900 text-lg font-google text-white border-none font-medium cursor-pointer z-10 group flex items-center justify-center gap-2 px-8 py-4 rounded-full border border-slate-200/50 dark:border-slate-800"
            >
                Get {PRODUCT.name}
              <span>
                <ArrowRightIcon size={20} className="shrink-0" />
              </span>


              <span className="absolute w-40 h-32 -top-14 -left-2 bg-blue-200 rotate-12 transform scale-x-0 group-hover:scale-x-150 transition-transform group-hover:duration-500 duration-1000 origin-left" />
              <span className="absolute w-40 h-36 -top-15 -left-2 bg-blue-600 rotate-12 transform scale-x-0 group-hover:scale-x-[120%] transition-transform group-hover:duration-700 duration-700 origin-left" />
              <span className="absolute w-36 h-32 -top-8 -left-2 bg-blue-800 rotate-12 transform scale-x-0 group-hover:scale-x-75 transition-transform group-hover:duration-1000 duration-500 origin-left" />
              <span aria-hidden="true" className="group-hover:opacity-100 group-hover:duration-1000 duration-100 opacity-0 absolute left-6 z-10 whitespace-nowrap">Explore Now !</span>
            </Link>

            <DemoButton />
          </div>

          <p className="mt-5 text-sm font-google text-slate-500 dark:text-slate-400 transition-colors">
            No code required.
          </p>
          </div>
        </div>

        <TrustedByStrip />
      </div>
    </section>
  );
}

/* ⚠️ PLACEHOLDER wordmarks — swap for real customer logos before launch. */
const TRUSTED_BY = ['Acme Co', 'NorthPeak', 'BrightCart', 'Lumen Labs', 'Vertex', 'Hatch'];

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
