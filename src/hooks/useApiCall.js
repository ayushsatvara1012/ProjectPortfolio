import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

/**
 * useApiCall — wraps fetch with:
 *   - auto Bearer token injection
 *   - structured 402 upgrade error parsing
 *   - generic error normalization
 *
 * Returns: { call, isLoading, error, upgradeError, clearError }
 *
 * upgradeError shape: { code, message, current, limit, tier, upgrade_url }
 * Consumers pass upgradeError directly to <UpgradePrompt code={upgradeError.code} ... />
 */
export const useApiCall = () => {
  const { getToken } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [upgradeError, setUpgradeError] = useState(null);

  const clearError = useCallback(() => {
    setError(null);
    setUpgradeError(null);
  }, []);

  const call = useCallback(async (url, options = {}) => {
    setIsLoading(true);
    clearError();
    try {
      const token = await getToken();
      const baseUrl = import.meta.env.VITE_API_URL || '';
      const res = await fetch(`${baseUrl}${url}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          ...(options.headers || {}),
        },
      });

      let data = null;
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await res.json();
      }

      if (!res.ok) {
        if (res.status === 402) {
          const detail = data?.detail;
          if (detail && typeof detail === 'object' && detail.code) {
            setUpgradeError(detail);
          } else {
            setUpgradeError({
              code: 'DEFAULT',
              message: typeof detail === 'string' ? detail : 'Plan limit reached.',
              tier: '',
              current: null,
              limit: null,
            });
          }
          return null;
        }

        const msg =
          (data?.detail && typeof data.detail === 'string')
            ? data.detail
            : data?.detail?.message || `Request failed (${res.status})`;
        setError(msg);
        return null;
      }

      return data;
    } catch (e) {
      setError('Network error — please try again.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [getToken, clearError]);

  return { call, isLoading, error, upgradeError, clearError };
};

// ────────────────────────────────────────────────────────────────────────────────
// TanStack Query integration layer
// ────────────────────────────────────────────────────────────────────────────────

/**
 * UpgradeError — thrown on 402 responses so TanStack Query's `error` object
 * carries the same shape that <UpgradePrompt /> expects.
 *
 *   catch (err) {
 *     if (err instanceof UpgradeError) {
 *       // err.code, err.tier, err.current, err.limit
 *     }
 *   }
 */
export class UpgradeError extends Error {
  constructor(detail) {
    super(detail.message || 'Plan limit reached.');
    this.name = 'UpgradeError';
    this.code = detail.code || 'DEFAULT';
    this.tier = detail.tier || '';
    this.current = detail.current ?? null;
    this.limit = detail.limit ?? null;
  }
}

/**
 * useAuthenticatedFetch — Clerk Auth Protocol compliant hook.
 *
 * Returns a plain async function (url, options?) → data that:
 *   1. Injects the Clerk Bearer token into every request
 *   2. Parses JSON responses
 *   3. Throws UpgradeError on 402
 *   4. Throws generic Error on other non-2xx responses
 *
 * Designed to be the `queryFn` / `mutationFn` building block for TanStack Query.
 *
 * Usage:
 *   const authFetch = useAuthenticatedFetch();
 *   const { data } = useQuery({
 *     queryKey: ['bots'],
 *     queryFn: () => authFetch('/api/companies'),
 *   });
 */
export const useAuthenticatedFetch = () => {
  const { getToken } = useAuth();
  const baseUrl = import.meta.env.VITE_API_URL || '';

  return useCallback(async (url, options = {}) => {
    const token = await getToken();
    const res = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    let data = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    }

    if (!res.ok) {
      if (res.status === 402) {
        const detail = data?.detail;
        throw new UpgradeError(
          typeof detail === 'object' && detail?.code
            ? detail
            : {
                code: 'DEFAULT',
                message: typeof detail === 'string' ? detail : 'Plan limit reached.',
                tier: '',
                current: null,
                limit: null,
              }
        );
      }

      const msg =
        (data?.detail && typeof data.detail === 'string')
          ? data.detail
          : data?.detail?.message || `Request failed (${res.status})`;
      throw new Error(msg);
    }

    return data;
  }, [getToken, baseUrl]);
};
