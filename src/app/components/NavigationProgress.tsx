'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

export default function NavigationProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathname = useRef(pathname);

  const clear = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    if (pathname === prevPathname.current) return;
    prevPathname.current = pathname;

    clear();
    setProgress(0);
    setVisible(true);

    // Tick from 0 → 85 over ~600ms in small increments to feel responsive
    let current = 0;
    intervalRef.current = setInterval(() => {
      current += Math.random() * 12 + 4; // 4–16% per tick
      if (current >= 85) {
        current = 85;
        clearInterval(intervalRef.current!);
      }
      setProgress(current);
    }, 80);

    // After a short settle, complete and hide
    timerRef.current = setTimeout(() => {
      clear();
      setProgress(100);
      // Brief pause at 100 then fade out
      timerRef.current = setTimeout(() => setVisible(false), 300);
    }, 700);

    return clear;
  }, [pathname]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nav-progress"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed top-12 left-0 right-0 z-50 h-[3px] bg-transparent pointer-events-none"
        >
          <motion.div
            className="h-full bg-slate-900 dark:bg-slate-100 origin-left"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.12, ease: 'easeOut' }}
          />
          {/* Glowing tip */}
          <motion.div
            className="absolute top-0 right-0 h-[3px] w-16 bg-gradient-to-l from-slate-900/0 via-slate-600/40 to-transparent dark:from-slate-100/0 dark:via-slate-300/40"
            style={{ right: `${100 - progress}%` }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
