'use client';

import { useState } from 'react';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { UserProvider } from '@/src/lib/context/UserContext';
import { BotSettingsProvider } from '@/src/lib/context/BotSettingsContext';
import { UpgradeError } from '@/src/lib/hooks/useAuthenticatedFetch';

export default function DashboardProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
        mutationCache: new MutationCache({
          onError: (error) => {
            if (typeof window === 'undefined') return;
            if (error instanceof UpgradeError) return;
            const msg = (error as Error)?.message || '';
            if (msg === 'AUTH_REQUIRED' || msg === 'FORBIDDEN' || msg === 'AUTH_NOT_READY') return;
            window.dispatchEvent(
              new CustomEvent('Sapybase:toast', {
                detail: { kind: 'error', message: msg || 'Something went wrong.' },
              })
            );
          },
        }),
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <UserProvider>
        <BotSettingsProvider>{children}</BotSettingsProvider>
      </UserProvider>
    </QueryClientProvider>
  );
}
