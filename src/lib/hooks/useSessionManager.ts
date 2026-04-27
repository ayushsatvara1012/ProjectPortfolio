'use client';

import { useEffect } from 'react';
import { useUser, useClerk, useSession } from '@clerk/nextjs';

/**
 * Custom hook to manage session persistence.
 * Distinguishes between a fresh login and an 'automatic login' from a previous instance.
 */
const useSessionManager = () => {
    const { isLoaded: isUserLoaded, isSignedIn } = useUser();
    const { session, isLoaded: isSessionLoaded } = useSession();
    const { signOut } = useClerk();

    useEffect(() => {
        if (!isUserLoaded || !isSessionLoaded) return;

        const SESSION_KEY = 'Sapybase_session_active';
        const isSessionActive = sessionStorage.getItem(SESSION_KEY);

        if (isSignedIn && session) {
            if (!isSessionActive) {
                const now = new Date();
                const sessionCreated = new Date(session.createdAt);
                const ageInSeconds = (now.getTime() - sessionCreated.getTime()) / 1000;

                const isSsoCallback = window.location.href.includes('sso-callback');

                if (ageInSeconds > 600 && !isSsoCallback) {
                    if (process.env.NODE_ENV === 'development') console.log("Automatic persistent login detected. Forcing logout for security...");
                    signOut();
                } else {
                    sessionStorage.setItem(SESSION_KEY, 'true');
                }
            }
        } else if (!isSignedIn) {
            sessionStorage.removeItem(SESSION_KEY);
        }
    }, [isUserLoaded, isSessionLoaded, isSignedIn, session, signOut]);

    return null;
};

export default useSessionManager;
