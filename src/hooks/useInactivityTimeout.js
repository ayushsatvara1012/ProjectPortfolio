import { useEffect, useCallback, useRef } from 'react';
import { useClerk } from '@clerk/clerk-react';

/**
 * Custom hook to log out the user after a period of inactivity.
 * @param {number} timeoutInMinutes - Time in minutes before auto-logout.
 */
const useInactivityTimeout = (timeoutInMinutes = 30) => {
  const { signOut, user } = useClerk();
  const timeoutMs = timeoutInMinutes * 60 * 1000;
  const timerRef = useRef(null);

  const handleLogout = useCallback(() => {
    if (user) {
      console.log(`User inactive for ${timeoutInMinutes} minutes. Logging out...`);
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
    // Only set up listeners if the user is signed in
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

    // Initial timer setup
    resetTimer();

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, resetTimer);
    });

    // Cleanup
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      events.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, resetTimer]);

  return null; // This hook doesn't return anything
};

export default useInactivityTimeout;
