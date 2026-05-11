'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import { usePathname, useSearchParams } from 'next/navigation';

export default function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Initialize Lenis manually instead of using the React wrapper
    const lenis = new Lenis({
      lerp: 0.1,
      duration: 1.5,
      smoothWheel: true,
    });

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    // Clean up on unmount
    return () => {
      lenis.destroy();
    };
  }, []);

  // Reset scroll on route changes (Next.js specific implementation)
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, searchParams]);

  return <>{children}</>;
}
