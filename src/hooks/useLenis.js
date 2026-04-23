import { useEffect } from "react";
import Lenis from "@studio-freight/lenis";

let lenisInstance = null;

export function getLenis() {
  return lenisInstance;
}

/**
 * Returns true if the element itself is scrollable on the Y axis.
 * Checks computed overflow-y and whether there is actually overflow content.
 */
function isScrollableY(el) {
  if (!el || el === document.documentElement) return false;
  const style = window.getComputedStyle(el);
  const overflow = style.overflowY;
  const canScroll = overflow === "auto" || overflow === "scroll";
  return canScroll && el.scrollHeight > el.clientHeight;
}

/**
 * Walks up the DOM from `node` and returns true if any ancestor
 * (including the node itself) is a scrollable container or has
 * data-lenis-prevent. This tells Lenis to leave that subtree alone
 * so the browser handles native scrolling there instead.
 */
function shouldPrevent(node) {
  let el = node;
  while (el && el !== document.body) {
    if (el.hasAttribute?.("data-lenis-prevent")) return true;
    if (isScrollableY(el)) return true;
    el = el.parentElement;
  }
  return false;
}

export default function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
      mouseMultiplier: 1,
      touchMultiplier: 1.5,
      infinite: false,
      prevent: shouldPrevent,
    });

    lenisInstance = lenis;

    let rafId;
    function raf(time) {
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
