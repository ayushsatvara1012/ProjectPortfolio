import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';

const UserContext = createContext();

export const UserProvider = ({ children }) => {
    const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
    const [userData, setUserData] = useState({
        role: null,
        tier: null,
        subscriptionStatus: 'active',
        trialEndDate: null,
        messagesUsed: 0,
        messageLimit: 0,
        totalDocuments: 0,
        totalMessages: 0,
        billingPeriodEnd: null
    });
    const [isLoading, setIsLoading] = useState(true);

    const refreshUser = async () => {
        if (!isAuthLoaded || !isSignedIn) {
            setIsLoading(false);
            return;
        }
        try {
            const token = await getToken();
            const baseUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${baseUrl}/api/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUserData({
                    role: data.role || 'USER',
                    tier: data.tier || 'FREE',
                    subscriptionStatus: data.subscription_status || 'active',
                    trialEndDate: data.trial_end_date,
                    messagesUsed: data.messages_used || 0,
                    messageLimit: data.message_limit || 0,
                    totalDocuments: data.total_documents || 0,
                    totalMessages: data.total_messages || 0,
                    billingPeriodEnd: data.billing_period_end
                });
            }
        } catch (error) {
            console.error("UserProvider: Fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        refreshUser();
    }, [isAuthLoaded, isSignedIn]);

    return (
        <UserContext.Provider value={{ ...userData, userRole: userData.role, userTier: userData.tier, isLoading, refreshUser }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUserRole = () => {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUserRole must be used within a UserProvider');
    }
    return context;
};
