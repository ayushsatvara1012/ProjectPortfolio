'use client';

import React, { useRef, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const AntigravityBackground = dynamic(() => import('./AntigravityBackground'), {
  ssr: false,
});
import FeatureIllustration from './FeatureIllustration';
import NewSection from './NewSection';

export default function ScrollTravelSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const featureRef = useRef<HTMLDivElement>(null);
  const bgRef      = useRef<HTMLDivElement>(null);  // 200vw canvas container
  const maskRef    = useRef<HTMLDivElement>(null);  // viewport-sized clip + mask
  const [isVisible, setIsVisible] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const rafIdRef = useRef<number | null>(null);

  // Written every rAF frame, read inside Three.js useFrame — zero React re-renders.
  const morphProgressRef = useRef(0);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    setIsDesktop(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    if (!isDesktop) return;

    const spring = { p: 0, vp: 0 };

    const tick = () => {
      const wrapper = wrapperRef.current;
      const feature = featureRef.current;
      const bg      = bgRef.current;
      const mask    = maskRef.current;

      if (wrapper && feature && bg && mask) {
        const scrollY    = window.scrollY;
        const wrapperTop = wrapper.getBoundingClientRect().top + scrollY;
        const vh         = window.innerHeight;

        // Scroll window: starts when FeatureIllustration's bottom exits the viewport.
        const start = wrapperTop + feature.offsetHeight - vh;
        const end   = start + vh;

        const target = Math.max(0, Math.min(1, (scrollY - start) / (end - start)));

        // Spring — same stiffness/damping as before for the wave-cadence feel.
        spring.vp += (target - spring.p) * 0.055;
        spring.vp *= 0.78;
        spring.p  += spring.vp;

        const p = spring.p;

        // ── Canvas center translation ─────────────────────────────────────────
        // +25vw = ripple origin at right quarter  (start — FeatureIllustration)
        // -30vw = droplet center at 20vw from left (center of the 40% left column)
        bg.style.transform = `translateX(${25 - p * 55}vw)`;

        // ── Morph progress ────────────────────────────────────────────────────
        // Starts 5% into the animation (canvas moves first, then scatter begins)
        // so particles don't jump before the mask has had a moment to open.
        morphProgressRef.current = Math.max(0, Math.min(1, (p - 0.05) / 0.95));

        // ── Mask ──────────────────────────────────────────────────────────────
        // Opens the left clip from 50% → 0% in the first 30% of progress so
        // scattered particles are immediately visible flowing across the full screen.
        // Once scatter is underway (p > 0.3) the left edge is fully open.
        // Right edge always has a soft 10% fade so particles don't hard-clip.
        const maskStop = Math.max(0, (1 - p / 0.3) * 50);
        const fadeEnd  = maskStop;
        const fadeSt   = Math.max(-1, maskStop - 4);

        const gradient = `linear-gradient(to right, transparent ${fadeSt}%, black ${fadeEnd}%, black 90%, transparent 100%)`;
        mask.style.maskImage       = gradient;
        mask.style.webkitMaskImage = gradient;
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);

      if (entry.isIntersecting) {
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(tick);
        }
        if (bgRef.current) {
          bgRef.current.style.display = 'block';
        }
      } else {
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        if (bgRef.current) {
          bgRef.current.style.display = 'none';
        }
      }
    }, {
      rootMargin: '200px 0px 200px 0px',
      threshold: 0
    });

    if (wrapperRef.current) {
      observer.observe(wrapperRef.current);
    }

    return () => {
      observer.disconnect();
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [isDesktop]);

  return (
    <div ref={wrapperRef} className="relative bg-white dark:bg-slate-950 transition-colors duration-500">

      {/* ── Sticky background (desktop only) ──────────────────────────────────
          h-screen keeps it pinned while sections scroll beneath it.
      ────────────────────────────────────────────────────────────────────────── */}
      <div className="hidden lg:block sticky top-0 h-screen w-full z-0 pointer-events-none overflow-hidden">

        {/* Viewport-sized mask wrapper — mask % is relative to this box (100vw) */}
        <div
          ref={maskRef}
          className="absolute inset-0 overflow-hidden"
          style={{
            // Initial state: right half visible, left half masked (p = 0)
            maskImage:       'linear-gradient(to right, transparent 46%, black 50%, black 90%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(to right, transparent 46%, black 50%, black 90%, transparent 100%)',
          }}
        >
          {/* 200vw canvas — left/right -50% extends equally off both edges of viewport.
              translateX(+25vw) places the ripple origin at the right quarter to start. */}
          <div
            ref={bgRef}
            className="absolute top-0 bottom-0"
            style={{
              left: '-50%',
              right: '-50%',
              transform: 'translateX(25vw)',
              willChange: 'transform',
              display: 'none',
            }}
          >
            {isDesktop && isVisible && (
              <AntigravityBackground
                particleCount={100}
                particleType="dot"
                effectStyle="ripples"
                colorPalette={['#0303FF']}
                particleSeparation={0.5}
                speed={0.4}
                fog={{ color: '#0f172a', near: 15, far: 50 }}
                morphProgressRef={morphProgressRef}
                containerClassName="absolute inset-0 pointer-events-none"
                interactive={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Content — lg:-mt-[100vh] overlaps the sticky bg ──────────────────── */}
      <div className="relative z-10 lg:-mt-[100vh]">
        <div ref={featureRef}>
          <FeatureIllustration />
        </div>
        <NewSection />
      </div>

    </div>
  );
}
