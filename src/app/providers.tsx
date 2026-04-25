'use client';

import { useEffect, useState } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProvider } from '@/src/lib/context/UserContext';
import { BotSettingsProvider } from '@/src/lib/context/BotSettingsContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  // One QueryClient per client tree. useState ensures it survives re-renders
  // but is not shared across requests during SSR.
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
      })
  );

  // Global fetch interceptor: emit a custom event on 402 so the app can show
  // an upgrade modal. Lives in useEffect so it never runs during SSR.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const originalFetch = window.fetch.bind(window);
    const patched: typeof window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        if (response.status === 402) {
          const cloned = response.clone();
          cloned
            .json()
            .then((data) => {
              if (data?.detail?.code) {
                window.dispatchEvent(
                  new CustomEvent('sapybase:upgrade-required', {
                    detail: data.detail,
                  })
                );
              }
            })
            .catch(() => {});
        }
      } catch {
        // Network errors (e.g. backend unreachable) — let caller handle
      }
      return response;
    };
    window.fetch = patched;
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <ClerkProvider
      appearance={{
        layout: {
          socialButtonsVariant: 'iconButton',
          shimmer: true,
        },
        variables: {
          colorPrimary: '#4f46e5',
          colorTextOnPrimaryBackground: 'white',
          fontFamily: '"Poppins", sans-serif',
          fontSize: '1rem',
        },
      }}
    >
      <UserProvider>
        <BotSettingsProvider>
          <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
        </BotSettingsProvider>
      </UserProvider>
    </ClerkProvider>
  );
}
