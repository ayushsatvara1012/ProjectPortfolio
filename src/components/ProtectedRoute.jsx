import { useUser, useAuth } from "@clerk/clerk-react";
import { Navigate, useLocation } from "react-router-dom";
import React, { useState, useEffect } from "react";
import Logo from "./Logo";

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
        const checkOnboardingStatus = async () => {
            if (!isUserLoaded || !isAuthLoaded || !isSignedIn) {
                if (isUserLoaded && isAuthLoaded) setIsLoading(false);
                return;
            }

            try {
                const token = await getToken();
                const baseUrl = import.meta.env.VITE_API_URL || '';
                
                // 1. Check Profile (Tier & Role)
                const meRes = await fetch(`${baseUrl}/api/me`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const meData = await meRes.ok ? await meRes.json() : null;

                // 2. Check Company Status
                const companyRes = await fetch(`${baseUrl}/api/company/details`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const companyData = await companyRes.ok ? await companyRes.json() : null;

                setOnboardingState({
                    tier: meData?.tier || null,
                    role: meData?.role || 'USER',
                    hasCompany: companyData?.status === 'success'
                });
            } catch (err) {
                console.error("Onboarding check failed:", err);
            } finally {
                setIsLoading(false);
            }
        };

        checkOnboardingStatus();
    }, [isUserLoaded, isAuthLoaded, isSignedIn, getToken]);

    if (!isUserLoaded || !isAuthLoaded) {
        return (
            <div className="w-full h-[60vh] flex items-center justify-center">
                <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
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
        // 0. ADMIN PROTECTION (Highest priority)
        if (adminOnly && role !== 'ADMIN') {
            return <Navigate to="/dashboard" replace />;
        }

        // 1. If trying to access Dashboard but no Tier selected
        if (location.pathname === '/dashboard' && !tier) {
            return <Navigate to="/pricing" replace />;
        }

        // 2. If trying to access Dashboard but no Company registered
        if (location.pathname === '/dashboard' && !hasCompany) {
            return <Navigate to="/register" replace />;
        }

        // 3. If trying to access Register but no Tier selected
        if (location.pathname === '/register' && !tier) {
            return <Navigate to="/pricing" replace />;
        }
    }

    return children;
};

export default ProtectedRoute;
