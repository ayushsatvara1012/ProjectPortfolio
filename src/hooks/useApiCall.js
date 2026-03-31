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
