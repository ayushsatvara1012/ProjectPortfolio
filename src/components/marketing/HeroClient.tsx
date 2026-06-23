'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { AntigravityBackgroundProps } from './AntigravityBackground';

const AntigravityBackground = dynamic<AntigravityBackgroundProps>(
  () => import('./AntigravityBackground'),
  { ssr: false },
);

export function HeroBackground() {
  const [isMobile, setIsMobile] = useState(true);
  const [mount, setMount] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    setIsMobile(!mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
    mq.addEventListener('change', handler, { passive: true } as AddEventListenerOptions);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const ric = window.requestIdleCallback;
    if (typeof ric === 'function') {
      const id = ric(() => setMount(true), { timeout: 2000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setMount(true), 200);
    return () => window.clearTimeout(id);
  }, []);

  if (isMobile || !mount) return null;

  return (
    <AntigravityBackground
      particleCount={50}
      particleType="capsule"
      particleSeparation={4}
      effectStyle="classic"
      interactive
    />
  );
}

export function DemoButton() {
  return (
    <Link
      href="/demo/train"
      className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-8 py-4 text-lg font-google text-yellow-500 dark:text-yellow-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors rounded-full flex items-center justify-center gap-1"
    >
      <span className="material-symbols-outlined text-lg">experiment</span>
      Try Demo
    </Link>
  );
}
