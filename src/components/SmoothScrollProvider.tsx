'use client';

import { Suspense, useEffect } from 'react';
import Lenis from 'lenis';
import { usePathname, useSearchParams } from 'next/navigation';

function ScrollResetter() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash) {
      return;
    }
    window.scrollTo(0, 0);
  }, [pathname, searchParams]);

  return null;
}

export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Lenis only smooths WHEEL events here (smoothTouch is off), but its rAF
    // loop runs every frame on every device. On touch devices that's pure
    // overhead with no behavioural benefit — mobile already scrolls natively —
    // so skip Lenis there to cut continuous main-thread work and improve mobile
    // performance. Route-change scroll reset (ScrollResetter) is unaffected.
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(pointer: coarse)').matches
    ) {
      return;
    }

    const lenis = new Lenis({
      lerp: 0.1,
      duration: 1.5,
      smoothWheel: true,
    });

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }

    rafId = requestAnimationFrame(raf);

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lenis.stop();
      } else {
        lenis.start();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      lenis.destroy();
    };
  }, []);

  return (
    <>
      <Suspense fallback={null}>
        <ScrollResetter />
      </Suspense>
      {children}
    </>
  );
}
