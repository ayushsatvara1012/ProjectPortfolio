'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { resolveEntitlements, type Entitlements } from '@/src/lib/auth/entitlements';

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
  entitlements: Entitlements;
  refreshUser: () => Promise<void>;
  hydrateFromServer: (seed: { role?: string | null; tier?: string | null }) => void;
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

type InitialUserSeed = Partial<Pick<UserData, 'role' | 'tier'>> | null;

const ME_QUERY_KEY = ['me'] as const;

const mapMe = (data: Record<string, unknown>): UserData => ({
  role: (data.role as string) || 'USER',
  tier: (data.tier as string) || 'FREE',
  subscriptionStatus: (data.subscription_status as string) || 'active',
  trialEndDate: (data.trial_end_date as string) ?? null,
  messagesUsed: (data.messages_used as number) || 0,
  messageLimit: (data.message_limit as number) || 0,
  totalDocuments: (data.total_documents as number) || 0,
  totalMessages: (data.total_messages as number) || 0,
  billingPeriodEnd: (data.billing_period_end as string) ?? null,
  customPlanName: (data.custom_plan_name as string) ?? null,
  customPlanFeatures: data.custom_plan_features ?? null,
});

export const UserProvider = ({
  children,
  initialUser = null,
}: {
  children: React.ReactNode;
  initialUser?: InitialUserSeed;
}) => {
  const { getToken, isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  // SSR seed for role/tier: rendered into the cache so first paint matches the
  // dashboard nav (tier badge, role gate) without a client /api/me round-trip.
  const [seed, setSeed] = useState<UserData | null>(() =>
    initialUser
      ? { ...INITIAL, role: initialUser.role ?? null, tier: initialUser.tier ?? null }
      : null
  );

  const { data, isLoading: queryLoading, refetch } = useQuery<UserData>({
    queryKey: ME_QUERY_KEY,
    enabled: isAuthLoaded && isSignedIn,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const token = await getToken();
      const baseUrl = (typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL?.trim() || ''));
      const res = await fetch(`${baseUrl}/api/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`/api/me failed: ${res.status}`);
      return mapMe(await res.json());
    },
    initialData: seed ?? undefined,
  });

  const userData: UserData = data ?? seed ?? INITIAL;

  const hydrateFromServer = useCallback(
    (s: { role?: string | null; tier?: string | null }) => {
      setSeed((prev) => ({
        ...(prev ?? INITIAL),
        role: s.role ?? prev?.role ?? null,
        tier: s.tier ?? prev?.tier ?? null,
      }));
      // Merge into the query cache so consumers reading via useQuery see the seed
      // immediately, before /api/me resolves.
      queryClient.setQueryData<UserData>(ME_QUERY_KEY, (prev) => ({
        ...(prev ?? INITIAL),
        role: s.role ?? prev?.role ?? null,
        tier: s.tier ?? prev?.tier ?? null,
      }));
    },
    [queryClient]
  );

  const refreshUser = useCallback(async () => {
    await refetch();
  }, [refetch]);

  // Post-checkout global sync: when landing with ?payment=success, sync the
  // subscription from Polar once, then clean the URL.
  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('payment') !== 'success') return;

    (async () => {
      try {
        const token = await getToken();
        const baseUrl = (typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL?.trim() || ''));
        const res = await fetch(`${baseUrl}/api/user/sync-subscription`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          await refetch();
          const url = new URL(window.location.href);
          url.searchParams.delete('payment');
          window.history.replaceState({}, '', url.pathname);
        }
      } catch (err) {
        console.error('Global Sync Error:', err);
      }
    })();
  }, [isAuthLoaded, isSignedIn, getToken, refetch]);

  const isLoading = !isAuthLoaded || (isSignedIn && queryLoading && !seed);

  const entitlements = useMemo(
    () => resolveEntitlements(userData.role, userData.tier, userData.customPlanFeatures),
    [userData.role, userData.tier, userData.customPlanFeatures]
  );

  const value = useMemo<UserContextValue>(
    () => ({
      ...userData,
      userRole: userData.role,
      userTier: userData.tier,
      isLoading,
      entitlements,
      refreshUser,
      hydrateFromServer,
    }),
    [userData, isLoading, entitlements, refreshUser, hydrateFromServer]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUserRole = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUserRole must be used within a UserProvider');
  }
  return context;
};
