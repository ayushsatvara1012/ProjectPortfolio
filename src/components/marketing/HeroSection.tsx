'use client';

import React, { useState, useEffect } from 'react';
import Button from './Button';
import { useUser, useClerk } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import AntigravityBackground from './AntigravityBackground';
import { PRODUCT } from '@/src/lib/brand';

const HeroSection = () => {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const { openSignUp } = useClerk();

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <section id="home" className="relative min-h-screen bg-white dark:bg-slate-950 pt-16 lg:pt-20 overflow-x-clip transition-colors duration-500">

      {/* ── UNIFIED SINGLE HERO CONTAINER ──────────────── */}
      <AntigravityBackground
        particleCount={isMobile ? 100 : 50}
        particleType={isMobile ? 'dot' : 'capsule'}
        particleSeparation={isMobile ? 2 : 4}
      />
      <div className="max-w-8xl mx-auto w-full min-h-[calc(100vh-4rem)] lg:min-h-[calc(100vh-5rem)] bg-transparent relative overflow-hidden flex flex-col items-center justify-center px-6 sm:px-12 lg:px-20 py-12 lg:py-12 transition-colors duration-500 border-none shadow-none">

        {/* Text and controls centered */}
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
                  decoding="async"
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
            <button
              onClick={() => isSignedIn ? router.push('/dashboard') : openSignUp()}
              className="overflow-hidden relative bg-slate-900 dark:bg-slate-900 text-lg font-google text-white border-none font-medium cursor-pointer z-10 group flex items-center justify-center px-8 py-4 rounded-full border border-slate-200/50 dark:border-slate-800"
            >
              Get {PRODUCT.name}<span className='material-symbols-outlined ml-2'>arrow_forward</span>
              <span
                className="absolute w-40 h-32 -top-14 -left-2 bg-blue-200 rotate-12 transform scale-x-0 group-hover:scale-x-150 transition-transform group-hover:duration-500 duration-1000 origin-left"
              ></span>
              <span
                className="absolute w-40 h-36 -top-15 -left-2 bg-blue-600 rotate-12 transform scale-x-0 group-hover:scale-x-[120%] transition-transform group-hover:duration-700 duration-700 origin-left"
              ></span>
              <span
                className="absolute w-36 h-32 -top-8 -left-2 bg-blue-800 rotate-12 transform scale-x-0 group-hover:scale-x-75 transition-transform group-hover:duration-1000 duration-500 origin-left"
              ></span>
              <span
                className="group-hover:opacity-100 group-hover:duration-1000 duration-100 opacity-0 absolute left-6 z-10 whitespace-nowrap"
              >Explore Now!</span>
            </button>


            <Button onClick={() => router.push('/demo/train')} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-8 py-4 text-lg font-google text-yellow-500 dark:text-yellow-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors rounded-full flex items-center justify-center gap-1">
              <span className="material-symbols-outlined text-lg">
                experiment
              </span>
              Try Demo
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
