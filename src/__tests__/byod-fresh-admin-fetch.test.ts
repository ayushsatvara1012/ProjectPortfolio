import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '@clerk/nextjs';
import { useFreshAdminFetch } from '@/src/app/(app)/dashboard/settings/admin/ByodTab';

// The BYOD lifecycle mutations (Phase 2) use a dedicated fetch that:
//   1. force-mints a fresh JWT (skipCache: true) so a long-idle admin panel still
//      passes require_fresh_admin's iat < 10-min check, and
//   2. retries once on a 401 (a stale step-up token) before surfacing re-auth.
// These are the load-bearing guarantees, so they get direct coverage.

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;
const getToken = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getToken.mockResolvedValue('fresh-token');
  mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true, getToken, userId: 'admin_1' });
});

const jsonRes = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: () => 'application/json' },
  json: async () => body,
});

describe('useFreshAdminFetch', () => {
  it('mints a fresh (uncached) token and attaches it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes(200, { status: 'success' })));
    const { result } = renderHook(() => useFreshAdminFetch());

    await result.current('/api/admin/users/u1/byod/health', { method: 'POST' });

    expect(getToken).toHaveBeenCalledWith({ skipCache: true });
    expect(fetch).toHaveBeenCalledWith(
      '/api/admin/users/u1/byod/health',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
      }),
    );
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes(200, { status: 'success', schema_version: '0007' })));
    const { result } = renderHook(() => useFreshAdminFetch());

    const data = await result.current<{ status: string; schema_version: string }>('/x', { method: 'POST' });
    expect(data.schema_version).toBe('0007');
    vi.unstubAllGlobals();
  });

  it('retries once on a stale-admin 401 and succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonRes(401, { detail: 'Session too old. Please re-authenticate (Step-Up).' }))
      .mockResolvedValueOnce(jsonRes(200, { status: 'success' }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useFreshAdminFetch());

    const data = await result.current<{ status: string }>('/x', { method: 'POST' });

    expect(data.status).toBe('success');
    expect(fetchMock).toHaveBeenCalledTimes(2);   // original + one retry
    expect(getToken).toHaveBeenCalledTimes(2);     // a freshly minted token per attempt
    vi.unstubAllGlobals();
  });

  it('throws a friendly message when the 401 persists after retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes(401, { detail: 'Session too old.' })));
    const { result } = renderHook(() => useFreshAdminFetch());

    await expect(result.current('/x', { method: 'POST' })).rejects.toThrow(/Admin session expired/);
    expect(fetch).toHaveBeenCalledTimes(2);
    vi.unstubAllGlobals();
  });

  it('surfaces the sanitized server detail on a non-401 error (no retry)', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonRes(400, { detail: 'DSN must use sslmode=require' }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useFreshAdminFetch());

    await expect(result.current('/x', { method: 'PUT' })).rejects.toThrow('DSN must use sslmode=require');
    expect(fetchMock).toHaveBeenCalledTimes(1);  // 400 is not retried
    vi.unstubAllGlobals();
  });

  it('throws AUTH_NOT_READY when no token is available', async () => {
    getToken.mockResolvedValue(null);
    vi.stubGlobal('fetch', vi.fn());
    const { result } = renderHook(() => useFreshAdminFetch());

    await expect(result.current('/x', { method: 'POST' })).rejects.toThrow('AUTH_NOT_READY');
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
