'use client';

import { useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';
import { UpgradeError } from '@/src/lib/errors';

// Re-export so existing import sites don't need to change.
export { UpgradeError } from '@/src/lib/errors';

export const useAuthenticatedFetch = () => {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const baseUrl = (typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_API_URL?.trim() || ''));

  return useCallback(async <T = unknown>(url: string, options: RequestInit = {}): Promise<T> => {
    // Don't fire until Clerk has hydrated — React Query will retry once state changes
    if (!isLoaded || !isSignedIn) {
      throw new Error('AUTH_NOT_READY');
    }

    const token = await getToken();
    if (!token) throw new Error('AUTH_NOT_READY');

    const fullUrl = `${baseUrl.replace(/\/$/, '')}${url}`;
    let res: Response;
    try {
      res = await fetch(fullUrl, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });
    } catch (err) {
      console.error(`Fetch failed for ${fullUrl}:`, err);
      throw err;
    }

    let data: unknown = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    }

    if (!res.ok) {
      if (res.status === 401) {
        // Token rejected — Clerk session is dead or revoked. Surface a global
        // event so a top-level handler can prompt re-auth or redirect to /sign-in,
        // and throw a typed error so callers can stop their flow.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('Sapybase:auth-required'));
        }
        throw new Error('AUTH_REQUIRED');
      }
      if (res.status === 403) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('Sapybase:forbidden'));
        }
        throw new Error('FORBIDDEN');
      }
      if (res.status === 402) {
        const detail = (data as { detail?: unknown })?.detail;
        throw new UpgradeError(
          typeof detail === 'object' && detail !== null && (detail as { code?: string }).code
            ? (detail as { code?: string; message?: string; tier?: string; current?: number | null; limit?: number | null })
            : {
                code: 'DEFAULT',
                message: typeof detail === 'string' ? detail : 'Plan limit reached.',
                tier: '',
                current: null,
                limit: null,
              }
        );
      }

      const d = data as { detail?: string | { message?: string } } | null;
      const msg =
        typeof d?.detail === 'string'
          ? d.detail
          : (d?.detail as { message?: string })?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data as T;
  }, [isLoaded, isSignedIn]);
};

// Convenience hook — use as `enabled` in useQuery to prevent firing before Clerk is ready
export const useIsAuthReady = () => {
  const { isLoaded, isSignedIn } = useAuth();
  return isLoaded && !!isSignedIn;
};
