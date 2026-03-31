import { useUser, useAuth } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { AppPageSkeleton } from "./SkeletonLoader";

/**
 * Higher-Order Component to enforce the SaPyBase onboarding flow:
 * Signed In -> Select Tier (/pricing) -> Register Company (/register) -> Dashboard
 */
const ProtectedRoute = ({ children, adminOnly = false }) => {
    const { isLoaded: isUserLoaded, isSignedIn, user } = useUser();
    const { getToken, isLoaded: isAuthLoaded } = useAuth();
    const location = useLocation();

    const [isLoading, setIsLoading] = useState(true);
    const [onboardingState, setOnboardingState] = useState({
        tier: null,
        hasCompany: false,
        role: 'USER'
    });

    useEffect(() => {
        const timer = setTimeout(() => setIsLoading(false), 8000); // safety timeout
        
        const checkOnboardingStatus = async () => {
            if (!isUserLoaded || !isAuthLoaded || !isSignedIn) {
                if (isUserLoaded && isAuthLoaded) setIsLoading(false);
                return;
            }

            const searchParams = new URLSearchParams(window.location.search);
            const justPaid = searchParams.get('payment') === 'success';
            const maxAttempts = justPaid ? 5 : 1;

            try {
                const baseUrl = import.meta.env.VITE_API_URL || '';
                let meData = null;
                let companyData = null;

                // Poll /api/me to handle race conditions with Polar webhooks
                for (let i = 0; i < maxAttempts; i++) {
                    const token = await getToken();
                    const meRes = await fetch(`${baseUrl}/api/me`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    meData = meRes.ok ? await meRes.json() : null;
                    
                    if (meData?.tier) break; // tier is set, stop polling
                    if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, 1000));
                }

                // Final check for company details
                const token = await getToken();
                const companyRes = await fetch(`${baseUrl}/api/company/details`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                companyData = companyRes.ok ? await companyRes.json() : null;

                setOnboardingState({
                    tier: meData?.tier || null,
                    role: meData?.role || 'USER',
                    hasCompany: companyData?.status === 'success'
                });
            } catch (err) {
                console.error("Onboarding check failed:", err);
            } finally {
                setIsLoading(false);
                clearTimeout(timer);
            }
        };

        checkOnboardingStatus();
        return () => clearTimeout(timer);
    }, [isUserLoaded, isAuthLoaded, isSignedIn, getToken]);

    // 1. Wait for BOTH Clerk and your backend/state to finish loading
    if (!isUserLoaded || !isAuthLoaded || (isSignedIn && isLoading)) {
        return (
            <div className="min-h-screen bg-white dark:bg-slate-950 p-8 flex items-center justify-center transition-colors duration-500">
                <AppPageSkeleton />
            </div>
        );
    }

    if (!isSignedIn) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    const { tier, hasCompany, role } = onboardingState;

    // --- ENFORCEMENT LOGIC ---
    // Only enforce redirects once we have finished the onboarding check (isLoading is false)
    if (!isLoading) {
        // 0. SUPER ADMIN PROTECTION (Highest priority)
        if (role === 'SUPER_ADMIN') {
            return children;
        }

        // 1. ADMIN PROTECTION (For /admin route)
        if (adminOnly && role !== 'SUPER_ADMIN') {
            console.warn("Access Denied: Admin route requires SUPER_ADMIN role.");
            return <Navigate to="/app" replace />;
        }

        // 2. TENANT ADMIN PROTECTION (For /dashboard and /register)
        if (role === 'ADMIN') {
            return children;
        }

        // 3. ONBOARDING REDIRECTS (For USERS/GUESTS)
        // If trying to access Dashboard/Register but no Tier selected
        if ((location.pathname === '/app' || location.pathname === '/app/register') && !tier) {
            return <Navigate to="/app/pricing" replace />;
        }

        // /app/bots handles the empty state gracefully — no redirect needed
    }

    return children;
};

export default ProtectedRoute;
