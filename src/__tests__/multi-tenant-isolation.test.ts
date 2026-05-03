import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAuth } from '@clerk/nextjs';
import { useAuthenticatedFetch } from '@/src/lib/hooks/useAuthenticatedFetch';

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

// Multi-tenant isolation: Bot A's data must never bleed into Bot B's requests.
// We verify that every request is scoped to the authenticated user's token,
// and that bot IDs cannot be swapped to access another tenant's data.

const BOT_A = 'bot_aaaa1111';
const BOT_B = 'bot_bbbb2222';

beforeEach(() => {
  vi.clearAllMocks();
  mockUseAuth.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue('token-for-user-a'),
    userId: 'user_aaaa',
  });
});

describe('Multi-tenant isolation — request scoping', () => {
  it('includes auth token in every API request', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: 'ok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { result } = renderHook(() => useAuthenticatedFetch());
    await result.current(`/api/companies/${BOT_A}`);

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer token-for-user-a');
    vi.unstubAllGlobals();
  });

  it('uses different tokens for different user sessions', async () => {
    const tokenA = 'token-for-user-a';
    const tokenB = 'token-for-user-b';

    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchSpy);

    // User A request
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true, getToken: vi.fn().mockResolvedValue(tokenA), userId: 'user_aaaa' });
    const { result: resultA } = renderHook(() => useAuthenticatedFetch());
    await resultA.current(`/api/companies/${BOT_A}`);
    const headerA = fetchSpy.mock.calls[0][1].headers.Authorization;

    fetchSpy.mockClear();

    // User B request
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: true, getToken: vi.fn().mockResolvedValue(tokenB), userId: 'user_bbbb' });
    const { result: resultB } = renderHook(() => useAuthenticatedFetch());
    await resultB.current(`/api/companies/${BOT_B}`);
    const headerB = fetchSpy.mock.calls[0][1].headers.Authorization;

    expect(headerA).not.toBe(headerB);
    vi.unstubAllGlobals();
  });

  it('rejects unauthenticated access attempt to bot endpoint', async () => {
    mockUseAuth.mockReturnValue({ isLoaded: true, isSignedIn: false, getToken: vi.fn(), userId: null });
    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current(`/api/companies/${BOT_A}`)).rejects.toThrow('AUTH_NOT_READY');
  });

  it('throws FORBIDDEN when accessing another tenant bot (403 from backend)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Access denied' }),
    }));

    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current(`/api/companies/${BOT_B}/settings`)).rejects.toThrow('FORBIDDEN');
    vi.unstubAllGlobals();
  });

  it('bot ID is included in request URL without mutation', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchSpy);

    const { result } = renderHook(() => useAuthenticatedFetch());
    await result.current(`/api/companies/${BOT_A}/knowledge`);

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toContain(BOT_A);
    expect(calledUrl).not.toContain(BOT_B);
    vi.unstubAllGlobals();
  });
});
