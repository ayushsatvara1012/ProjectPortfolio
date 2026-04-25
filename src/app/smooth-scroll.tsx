'use client';

import { useEffect } from 'react';

/**
 * Lenis smooth-scroll mount. Imported dynamically so SSR never touches the
 * Lenis module (which references window/document at import time in some
 * builds). The hook logic mirrors src/hooks/useLenis.js (Vite).
 */
export default function SmoothScroll() {
  useEffect(() => {
    let rafId: number | undefined;
    let cancelled = false;

    (async () => {
      const { default: Lenis } = await import('lenis');
      if (cancelled) return;

      const isScrollableY = (el: Element | null) => {
        if (!el || el === document.documentElement) return false;
        const style = window.getComputedStyle(el as HTMLElement);
        const overflow = style.overflowY;
        const canScroll = overflow === 'auto' || overflow === 'scroll';
        return canScroll && (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight;
      };

      const shouldPrevent = (node: Node) => {
        let el: HTMLElement | null = node as HTMLElement;
        while (el && el !== document.body) {
          if (el.hasAttribute?.('data-lenis-prevent')) return true;
          if (isScrollableY(el)) return true;
          el = el.parentElement;
        }
        return false;
      };

      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
        wheelMultiplier: 1,
        touchMultiplier: 1.5,
        infinite: false,
        prevent: shouldPrevent,
      });

      const raf = (time: number) => {
        lenis.raf(time);
        rafId = requestAnimationFrame(raf);
      };
      rafId = requestAnimationFrame(raf);

      return () => {
        if (rafId) cancelAnimationFrame(rafId);
        lenis.destroy();
      };
    })();

    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return null;
}
