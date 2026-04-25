'use client';

import { useCallback } from 'react';
import { useAuth } from '@clerk/nextjs';

export class UpgradeError extends Error {
  code: string;
  tier: string;
  current: number | null;
  limit: number | null;

  constructor(detail: { code?: string; message?: string; tier?: string; current?: number | null; limit?: number | null }) {
    super(detail.message || 'Plan limit reached.');
    this.name = 'UpgradeError';
    this.code = detail.code || 'DEFAULT';
    this.tier = detail.tier || '';
    this.current = detail.current ?? null;
    this.limit = detail.limit ?? null;
  }
}

export const useAuthenticatedFetch = () => {
  const { getToken } = useAuth();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '';

  return useCallback(async (url: string, options: RequestInit = {}) => {
    const token = await getToken();
    const res = await fetch(`${baseUrl}${url}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });

    let data: unknown = null;
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      data = await res.json();
    }

    if (!res.ok) {
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

    return data;
  }, [getToken, baseUrl]);
};
