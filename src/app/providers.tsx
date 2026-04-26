'use client';

import { useEffect, useState } from 'react';
import { ClerkProvider } from '@clerk/nextjs';
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { UserProvider } from '@/src/lib/context/UserContext';
import { BotSettingsProvider } from '@/src/lib/context/BotSettingsContext';
import { ToastProvider } from '@/src/lib/context/ToastContext';
import { UpgradeError } from '@/src/lib/hooks/useAuthenticatedFetch';

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
        // Surface unhandled mutation errors as toasts so individual call sites
        // don't each need to remember to wire up onError. UpgradeError and the
        // typed AUTH_REQUIRED/FORBIDDEN errors are handled by their dedicated
        // global flows and shouldn't double-toast here.
        mutationCache: new MutationCache({
          onError: (error) => {
            if (typeof window === 'undefined') return;
            if (error instanceof UpgradeError) return;
            const msg = (error as Error)?.message || '';
            if (msg === 'AUTH_REQUIRED' || msg === 'FORBIDDEN' || msg === 'AUTH_NOT_READY') return;
            window.dispatchEvent(
              new CustomEvent('sapybase:toast', {
                detail: { kind: 'error', message: msg || 'Something went wrong.' },
              })
            );
          },
        }),
      })
  );

  // Global auth event handlers: 401 → bounce to sign-in (Clerk middleware will
  // re-establish session); 403 → bounce to dashboard. Both are emitted from
  // useAuthenticatedFetch so every API call benefits without per-caller wiring.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onAuthRequired = () => {
      if (!window.location.pathname.startsWith('/sign-in')) {
        window.location.href = '/sign-in';
      }
    };
    const onForbidden = () => {
      if (!window.location.pathname.startsWith('/dashboard') ||
          window.location.pathname.startsWith('/dashboard/settings/admin')) {
        window.location.href = '/dashboard';
      }
    };
    window.addEventListener('sapybase:auth-required', onAuthRequired);
    window.addEventListener('sapybase:forbidden', onForbidden);
    return () => {
      window.removeEventListener('sapybase:auth-required', onAuthRequired);
      window.removeEventListener('sapybase:forbidden', onForbidden);
    };
  }, []);

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
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <UserProvider>
            <BotSettingsProvider>{children}</BotSettingsProvider>
          </UserProvider>
        </ToastProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}
