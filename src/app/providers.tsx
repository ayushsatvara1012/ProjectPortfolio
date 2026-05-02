'use client';

import { useEffect } from 'react';

import { ClerkProvider } from '@clerk/nextjs';
import { ToastProvider } from '@/src/lib/context/ToastContext';

export default function Providers({ children }: { children: React.ReactNode }) {
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
    window.addEventListener('Sapybase:auth-required', onAuthRequired);
    window.addEventListener('Sapybase:forbidden', onForbidden);
    return () => {
      window.removeEventListener('Sapybase:auth-required', onAuthRequired);
      window.removeEventListener('Sapybase:forbidden', onForbidden);
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
                  new CustomEvent('Sapybase:upgrade-required', {
                    detail: data.detail,
                  })
                );
              }
            })
            .catch(() => { });
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
      <ToastProvider>
        {children}
      </ToastProvider>
    </ClerkProvider>
  );
}
