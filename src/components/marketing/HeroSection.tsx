import React from 'react';
import Link from 'next/link';
import { PRODUCT } from '@/src/lib/brand';
import { HeroBackground, DemoButton } from './HeroClient';
import { ArrowRightIcon } from '@/src/components/icons';

export default function HeroSection() {
  return (
    <section id="home" className="relative min-h-screen bg-white dark:bg-slate-950 pt-16 lg:pt-20 overflow-x-clip transition-colors duration-500">
      <HeroBackground />
      <div className="max-w-8xl mx-auto w-full min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)] bg-transparent relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-12 transition-colors duration-500 border-none shadow-none">
        <div className="relative z-10 max-w-xl lg:max-w-3xl flex flex-col justify-center items-center text-center">
          <h1
            className="font-google font-medium tracking-tight leading-[1.05] text-slate-900 dark:text-slate-200 mb-6 transition-colors"
            aria-label={`Introducing ${PRODUCT.name} — A Business Intelligence`}
          >
            <span aria-hidden="true" className="flex flex-col items-center">
              <span className="text-3xl sm:text-4xl md:text-5xl font-normal">Introducing</span>
              <span className="mt-2 flex items-center justify-center gap-3 sm:gap-4">
                <img
                  src={PRODUCT.logo}
                  alt=""
                  width={36}
                  height={23}
                  decoding="async"
                  fetchPriority="high"
                  className="h-14 sm:h-16 md:h-20 w-auto"
                />
                <span className="text-6xl sm:text-7xl md:text-8xl text-transparent bg-clip-text bg-linear-to-r from-blue-700 to-blue-500">
                  {PRODUCT.name}
                </span>
              </span>
              <span className="mt-3 text-3xl sm:text-4xl md:text-5xl font-normal italic text-slate-600 dark:text-slate-300">
                A Business Intelligence
              </span>
            </span>
          </h1>

          <p className="text-base md:text-lg font-google text-slate-600 dark:text-slate-200 leading-relaxed max-w-xl mb-10 transition-colors mx-auto">
            {PRODUCT.name} is the chat that lives on your site, answers every customer question 24/7, captures and scores leads automatically, and shows you the funnel, conversions, and exact ROI it earned you — no code required.
          </p>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-8 w-full transition-colors">
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
              <span className="group-hover:opacity-100 group-hover:duration-1000 duration-100 opacity-0 absolute left-6 z-10 whitespace-nowrap">Explore Now !</span>
            </Link>

            <DemoButton />
          </div>
        </div>
      </div>
    </section>
  );
}
