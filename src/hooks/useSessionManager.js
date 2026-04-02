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

                // If session was created more than 60 seconds ago and no flag is set,
                // it means the browser was likely restarted and Clerk 'auto-logged' us in.
                if (ageInSeconds > 60) {
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
