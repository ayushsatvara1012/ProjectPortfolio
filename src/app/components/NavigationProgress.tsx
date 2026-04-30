'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';

export default function NavigationProgress() {
  const pathname = usePathname();
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  
  // Real-time busy state
  const isBusy = isFetching > 0 || isMutating > 0;
  
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPathname = useRef<string | null>(null);
  const finishTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (finishTimeoutRef.current) clearTimeout(finishTimeoutRef.current);
  };

  const start = () => {
    clear();
    setProgress(0);
    setVisible(true);

    let current = 0;
    intervalRef.current = setInterval(() => {
      // Fast crawl to 30%, then slow crawl to 95%
      const limit = 95;
      const remaining = limit - current;
      // The further we go, the slower we move (asymptotic)
      const step = current < 30 
        ? Math.random() * 15 + 5 
        : Math.random() * (remaining * 0.1) + 0.5;
      
      current = Math.min(current + step, limit);
      setProgress(current);
      
      if (current >= limit) {
        clearInterval(intervalRef.current!);
      }
    }, 120);
  };

  const finish = () => {
    if (!visible) return;
    clear();
    setProgress(100);
    // Brief delay at 100% then fade out
    finishTimeoutRef.current = setTimeout(() => {
      setVisible(false);
    }, 300);
  };

  // Trigger start on pathname change (Navigation)
  useEffect(() => {
    if (prevPathname.current === null) {
      prevPathname.current = pathname;
      // Don't show on initial static mount to avoid flash if data is already in cache
      return;
    }
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname;
      start();
    }
  }, [pathname]);

  // Synchronize with real-time network state
  useEffect(() => {
    if (visible) {
      if (!isBusy) {
        // If we are visible and network becomes idle, finish the bar
        // We add a tiny delay to ensure we don't snap on micro-fetches
        const t = setTimeout(finish, 100);
        return () => clearTimeout(t);
      }
    } else if (isBusy) {
      // If a fetch starts while we are hidden, show the bar (e.g. background refetch or lazy load)
      // Only show if it's been busy for more than 200ms to avoid flicker on fast cache hits
      const t = setTimeout(start, 200);
      return () => clearTimeout(t);
    }
  }, [isBusy, visible]);

  useEffect(() => {
    return clear;
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="nav-progress"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed top-12 left-0 right-0 z-50 h-[3px] bg-transparent pointer-events-none"
        >
          <motion.div
            className="h-full origin-left"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #001d8a 0%, #0025db 60%, #001aff 100%)',
            }}
            transition={{ 
              duration: progress === 100 ? 0.3 : 0.6, 
              ease: progress === 100 ? 'easeIn' : 'easeOut' 
            }}
          />
          {/* Glowing tip */}
          <div
            className="absolute top-0 h-[3px] w-24 pointer-events-none"
            style={{
              left: `calc(${progress}% - 6rem)`,
              background:
                'linear-gradient(to right, transparent, rgba(87,48,245,0.4), rgba(124,58,237,0.7))',
              filter: 'blur(3px)',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
