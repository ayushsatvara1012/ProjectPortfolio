'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import Button from './Button';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

import type { AntigravityBackgroundProps } from './AntigravityBackground';

const AntigravityBackground = dynamic<AntigravityBackgroundProps>(() => import('./AntigravityBackground'), {
  ssr: false,
});
import { PRODUCT } from '@/src/lib/brand';

const HeroSection = () => {
  const router = useRouter();
  const { isSignedIn } = useUser();
  const [, startTransition] = useTransition();

  const [isMobile, setIsMobile] = useState(false);
  // Defer mounting the WebGL background until the browser is idle. The Three.js
  // chunk (~880 kB) is heavy to parse/execute; mounting it during hydration is
  // the single biggest contributor to mobile TBT. Gating the mount to idle moves
  // that work out of the critical path. The animation is unchanged — the scene's
  // built-in staggered reveal fades it in once mounted.
  const [mountBackground, setMountBackground] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener('resize', handleResize, { passive: true });
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // requestIdleCallback isn't available in Safari/iOS — fall back to a short
    // timeout. The `timeout` option guarantees the scene still mounts promptly
    // even if the main thread stays busy.
    const ric = window.requestIdleCallback;
    if (typeof ric === 'function') {
      const id = ric(() => setMountBackground(true), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setMountBackground(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <section id="home" className="relative min-h-screen bg-white dark:bg-slate-950 pt-16 lg:pt-20 overflow-x-clip transition-colors duration-500">

      {/* ── HERO BACKGROUND ──────────────────────────────
          Mobile (<768px): a static SVG mesh-gradient. Zero JS, SSR'd, paints
          instantly, and never loads the ~880kB three.js chunk or runs a render
          loop — the biggest mobile INP/LCP/TBT saving. Soft blue/indigo glows sit
          toward the edges over the section's bg so the centered headline stays
          readable in both light and dark mode. No animated filters (would jank). */}
      <div className="absolute inset-0 md:hidden pointer-events-none overflow-hidden" aria-hidden="true">
        <svg
          className="w-full h-full"
          viewBox="0 0 400 800"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <radialGradient id="hero-mob-1" cx="80" cy="130" r="280" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4F46E5" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hero-mob-2" cx="360" cy="70" r="300" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0066FF" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#0066FF" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="hero-mob-3" cx="210" cy="760" r="340" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#0088FF" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#0088FF" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="400" height="800" fill="url(#hero-mob-1)" />
          <rect width="400" height="800" fill="url(#hero-mob-2)" />
          <rect width="400" height="800" fill="url(#hero-mob-3)" />
        </svg>
      </div>

      {/* Desktop (≥768px): the WebGL particle scene, mounted at idle. The
          !isMobile guard means it never mounts on phones. */}
      {!isMobile && mountBackground && (
        <AntigravityBackground
          particleCount={50}
          particleType="capsule"
          particleSeparation={4}
          effectStyle="classic"
          interactive
        />
      )}
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
            {/* Primary CTA is a prefetched <Link>, not a Clerk-gated onClick. The
                tap navigates natively (no JS on the main thread) so it stays
                instant even before Clerk hydrates. href upgrades to /dashboard
                once useUser() resolves a signed-in session. */}
            <Link
              href={isSignedIn ? '/dashboard' : '/sign-up'}
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
            </Link>


            <Button onClick={() => startTransition(() => router.push('/demo/train'))} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-8 py-4 text-lg font-google text-yellow-500 dark:text-yellow-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors rounded-full flex items-center justify-center gap-1">
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
