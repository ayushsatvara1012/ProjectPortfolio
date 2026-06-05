import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '@clerk/nextjs';
import { useAuthenticatedFetch, useIsAuthReady } from '@/src/lib/hooks/useAuthenticatedFetch';
import { UpgradeError } from '@/src/lib/errors';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // Reset to default signed-in state
  mockUseAuth.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue('mock-token'),
    userId: 'user_test123',
  });
});

describe('useIsAuthReady', () => {
  it('returns true when Clerk is loaded and signed in', () => {
    const { result } = renderHook(() => useIsAuthReady());
    expect(result.current).toBe(true);
  });

  it('returns false when not loaded', () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false, getToken: vi.fn(), userId: null });
    const { result } = renderHook(() => useIsAuthReady());
    expect(result.current).toBe(false);
  });

  it('returns false when loaded but not signed in', () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false, getToken: vi.fn(), userId: null });
    const { result } = renderHook(() => useIsAuthReady());
    expect(result.current).toBe(false);
  });
});

describe('useAuthenticatedFetch', () => {
  it('throws AUTH_NOT_READY when Clerk not loaded', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: false, isSignedIn: false, getToken: vi.fn(), userId: null });
    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/test')).rejects.toThrow('AUTH_NOT_READY');
  });

  it('throws AUTH_NOT_READY when not signed in', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false, getToken: vi.fn(), userId: null });
    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/test')).rejects.toThrow('AUTH_NOT_READY');
  });

  it('throws AUTH_NOT_READY when getToken returns null', async () => {
    mockUseAuth.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue(null),
      userId: 'user_test123',
    });
    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/test')).rejects.toThrow('AUTH_NOT_READY');
  });

  it('attaches Authorization header to request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useAuthenticatedFetch());
    await result.current('/api/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/test'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
      })
    );
    vi.unstubAllGlobals();
  });

  it('throws AUTH_REQUIRED on 401 and dispatches event', async () => {
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Unauthorized' }),
    }));

    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/test')).rejects.toThrow('AUTH_REQUIRED');
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'Sapybase:auth-required' }));
    vi.unstubAllGlobals();
  });

  it('throws FORBIDDEN on 403', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Forbidden' }),
    }));

    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/test')).rejects.toThrow('FORBIDDEN');
    vi.unstubAllGlobals();
  });

  it('throws UpgradeError on 402', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: { code: 'MSG_LIMIT', message: 'Message limit reached', tier: 'STARTER', current: 500, limit: 500 } }),
    }));

    const { result } = renderHook(() => useAuthenticatedFetch());
    const err = await result.current('/api/test').catch(e => e);
    expect(err).toBeInstanceOf(UpgradeError);
    expect(err.code).toBe('MSG_LIMIT');
    expect(err.tier).toBe('STARTER');
    vi.unstubAllGlobals();
  });

  it('returns parsed JSON data on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ user: 'alice' }),
    }));

    const { result } = renderHook(() => useAuthenticatedFetch());
    const data = await result.current<{ user: string }>('/api/me');
    expect(data.user).toBe('alice');
    vi.unstubAllGlobals();
  });
});
