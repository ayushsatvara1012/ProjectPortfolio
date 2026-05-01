'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useClerk } from '@clerk/nextjs';

const EVENTS = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'] as const;

const useInactivityTimeout = (timeoutInMinutes = 30) => {
  const { signOut, user } = useClerk();
  const timeoutMs = timeoutInMinutes * 60 * 1000;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Keep latest values accessible inside the stable listener without re-registering.
  const userRef = useRef(user);
  const timeoutMsRef = useRef(timeoutMs);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { timeoutMsRef.current = timeoutMs; }, [timeoutMs]);

  const signOutRef = useRef(signOut);
  useEffect(() => { signOutRef.current = signOut; }, [signOut]);

  // Stable reset function — identity never changes, so addEventListener only runs once.
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (userRef.current) {
      timerRef.current = setTimeout(() => {
        if (userRef.current) {
          if (process.env.NODE_ENV === 'development') {
            console.log(`User inactive for ${timeoutInMinutes} minutes. Logging out...`);
          }
          signOutRef.current();
        }
      }, timeoutMsRef.current);
    }
  }, [timeoutInMinutes]);

  useEffect(() => {
    if (!user) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    resetTimer();
    EVENTS.forEach(e => window.addEventListener(e, resetTimer));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [user, resetTimer]);

  return null;
};

export default useInactivityTimeout;
