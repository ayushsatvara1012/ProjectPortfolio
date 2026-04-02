import { useEffect } from 'react';
import { useUser, useClerk, useSession } from '@clerk/clerk-react';

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

        const SESSION_KEY = 'sapybase_session_active';
        const isSessionActive = sessionStorage.getItem(SESSION_KEY);

        if (isSignedIn && session) {
            if (!isSessionActive) {
                // Determine if this is a fresh login or a restored session
                const now = new Date();
                const sessionCreated = new Date(session.createdAt);
                const ageInSeconds = (now - sessionCreated) / 1000;

                // ── GOOGLE OAUTH FIX ──────────────────────────────────────────────
                // 1. Google OAuth flows (choosing account, 2-factor) often take > 60s. 
                //    Adjusting to 600s (10 min) to allow humans to log in.
                // 2. Skip this entire check if we are currently on the SSO callback route.
                const isSsoCallback = window.location.href.includes('sso-callback');

                if (ageInSeconds > 600 && !isSsoCallback) {
                    console.log("Automatic persistent login detected. Forcing logout for security...");
                    signOut();
                } else {
                    // Fresh login! Mark session as active.
                    sessionStorage.setItem(SESSION_KEY, 'true');
                }
            }
        } else if (!isSignedIn) {
            // Ensure flag is cleared if user signs out manually
            sessionStorage.removeItem(SESSION_KEY);
        }
    }, [isUserLoaded, isSessionLoaded, isSignedIn, session, signOut]);

    return null;
};

export default useSessionManager;
