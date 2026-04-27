'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useClerk } from '@clerk/nextjs';

/**
 * Custom hook to log out the user after a period of inactivity.
 * @param {number} timeoutInMinutes - Time in minutes before auto-logout.
 */
const useInactivityTimeout = (timeoutInMinutes = 30) => {
  const { signOut, user } = useClerk();
  const timeoutMs = timeoutInMinutes * 60 * 1000;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(() => {
    if (user) {
      if (process.env.NODE_ENV === 'development') console.log(`User inactive for ${timeoutInMinutes} minutes. Logging out...`);
      signOut();
    }
  }, [signOut, user, timeoutInMinutes]);

  const resetTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    if (user) {
      timerRef.current = setTimeout(handleLogout, timeoutMs);
    }
  }, [handleLogout, timeoutMs, user]);

  useEffect(() => {
    if (!user) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      return;
    }

    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click'
    ];

    resetTimer();

    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, resetTimer]);

  return null;
};

export default useInactivityTimeout;
