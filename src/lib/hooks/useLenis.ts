'use client';

import { useEffect } from "react";
import Lenis from "lenis";

let lenisInstance: Lenis | null = null;

export function getLenis() {
  return lenisInstance;
}

function isScrollableY(el: HTMLElement) {
  if (!el || el === document.documentElement) return false;
  const style = window.getComputedStyle(el);
  const overflow = style.overflowY;
  const canScroll = overflow === "auto" || overflow === "scroll";
  return canScroll && el.scrollHeight > el.clientHeight;
}

function shouldPrevent(node: any) {
  let el = node;
  while (el && el !== document.body) {
    if (el.hasAttribute?.("data-lenis-prevent")) return true;
    if (el instanceof HTMLElement && isScrollableY(el)) return true;
    el = el.parentElement;
  }
  return false;
}

export default function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      infinite: false,
      prevent: shouldPrevent,
    });

    lenisInstance = lenis;

    let rafId: number;
    function raf(time: number) {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    }
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisInstance = null;
    };
  }, []);
}
