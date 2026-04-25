'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

type UserData = {
  role: string | null;
  tier: string | null;
  subscriptionStatus: string;
  trialEndDate: string | null;
  messagesUsed: number;
  messageLimit: number;
  totalDocuments: number;
  totalMessages: number;
  billingPeriodEnd: string | null;
  customPlanName: string | null;
  customPlanFeatures: unknown;
};

type UserContextValue = UserData & {
  userRole: string | null;
  userTier: string | null;
  isLoading: boolean;
  refreshUser: () => Promise<void>;
};

const UserContext = createContext<UserContextValue | undefined>(undefined);

const INITIAL: UserData = {
  role: null,
  tier: null,
  subscriptionStatus: 'active',
  trialEndDate: null,
  messagesUsed: 0,
  messageLimit: 0,
  totalDocuments: 0,
  totalMessages: 0,
  billingPeriodEnd: null,
  customPlanName: null,
  customPlanFeatures: null,
};

export const UserProvider = ({ children }: { children: React.ReactNode }) => {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const [userData, setUserData] = useState<UserData>(INITIAL);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!isAuthLoaded || !isSignedIn) {
      setIsLoading(false);
      return;
    }
    try {
      const token = await getToken();
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${baseUrl}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
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
          billingPeriodEnd: data.billing_period_end,
          customPlanName: data.custom_plan_name || null,
          customPlanFeatures: data.custom_plan_features || null,
        });
      }
    } catch (error) {
      console.error('UserProvider: Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthLoaded, isSignedIn, getToken]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Post-checkout global sync: when landing with ?payment=success, poll the
  // backend once to sync the subscription from Polar, then clean the URL.
  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;

    const syncSubscription = async () => {
      setIsLoading(true);
      try {
        const token = await getToken();
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
        const res = await fetch(`${baseUrl}/api/user/sync-subscription`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          await refreshUser();
          const url = new URL(window.location.href);
          url.searchParams.delete('payment');
          window.history.replaceState({}, '', url.pathname);
        }
      } catch (err) {
        console.error('Global Sync Error:', err);
      }
    };
    syncSubscription();
  }, [isAuthLoaded, isSignedIn, getToken, refreshUser]);

  return (
    <UserContext.Provider
      value={{
        ...userData,
        userRole: userData.role,
        userTier: userData.tier,
        isLoading,
        refreshUser,
      }}
    >
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
