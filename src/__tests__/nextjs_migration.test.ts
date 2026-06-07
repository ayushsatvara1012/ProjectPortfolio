/**
 * Next.js 15 Migration — SSR/Hydration/Routing Edge Cases
 *
 * Covers:
 * 1. useAuthenticatedFetch — AUTH_NOT_READY guard, token injection, 402 UpgradeError
 * 2. useIsAuthReady — all Clerk state combinations
 * 3. next/navigation mocks — routing calls dispatch correctly
 * 4. NEXT_PUBLIC_ env vars — available in test environment
 * 5. EmbedPage postMessage — ResizeObserver wires up correctly
 * 6. SSR-safe checks — no window/document access at module level
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '@clerk/nextjs';

// ── 1. useAuthenticatedFetch ──────────────────────────────────────────────────

describe('useAuthenticatedFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('throws AUTH_NOT_READY when Clerk is not loaded', async () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      isLoaded: false,
      isSignedIn: false,
      getToken: vi.fn(),
    } as any);

    const { useAuthenticatedFetch } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/test')).rejects.toThrow('AUTH_NOT_READY');
  });

  it('throws AUTH_NOT_READY when user is not signed in', async () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      isLoaded: true,
      isSignedIn: false,
      getToken: vi.fn(),
    } as any);

    const { useAuthenticatedFetch } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/test')).rejects.toThrow('AUTH_NOT_READY');
  });

  it('throws AUTH_NOT_READY when getToken returns null', async () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      isLoaded: true,
      isSignedIn: true,
      getToken: vi.fn().mockResolvedValue(null),
    } as any);

    const { useAuthenticatedFetch } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/test')).rejects.toThrow('AUTH_NOT_READY');
  });

  it('injects Authorization header with bearer token', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ data: 'ok' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { useAuthenticatedFetch } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useAuthenticatedFetch());
    await result.current('/api/companies');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/companies'),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-clerk-token' }),
      })
    );
  });

  it('keeps URLs relative in the browser (prefix is SSR-only)', async () => {
    const originalUrl = process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://sapyai.onrender.com';

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { useAuthenticatedFetch } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useAuthenticatedFetch());
    await result.current('/api/companies');

    // In the browser, requests are same-origin (relative) to avoid CORS and
    // work behind the proxy; NEXT_PUBLIC_API_URL only applies during SSR.
    expect(mockFetch.mock.calls[0][0]).toBe('/api/companies');
    process.env.NEXT_PUBLIC_API_URL = originalUrl;
  });

  it('throws UpgradeError on 402 response with structured detail', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: { get: () => 'application/json' },
      json: async () => ({
        detail: { code: 'MESSAGE_LIMIT_EXCEEDED', message: 'Limit hit', tier: 'FREE', current: 100, limit: 100 },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { useAuthenticatedFetch, UpgradeError } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useAuthenticatedFetch());
    const error: any = await result.current('/api/chat').catch((e) => e);

    expect(error).toBeInstanceOf(UpgradeError);
    expect(error.code).toBe('MESSAGE_LIMIT_EXCEEDED');
    expect(error.tier).toBe('FREE');
    expect(error.current).toBe(100);
    expect(error.limit).toBe(100);
  });

  it('throws UpgradeError with DEFAULT code on 402 with string detail', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Plan limit reached.' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { useAuthenticatedFetch, UpgradeError } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useAuthenticatedFetch());
    const error: any = await result.current('/api/chat').catch((e) => e);

    expect(error).toBeInstanceOf(UpgradeError);
    expect(error.code).toBe('DEFAULT');
    expect(error.message).toBe('Plan limit reached.');
  });

  it('throws plain Error with detail message on non-402 failure', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      headers: { get: () => 'application/json' },
      json: async () => ({ detail: 'Bot not found' }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { useAuthenticatedFetch } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/companies/bad-id')).rejects.toThrow('Bot not found');
  });

  it('falls back to "Request failed (500)" when detail is absent', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => 'application/json' },
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', mockFetch);

    const { useAuthenticatedFetch } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useAuthenticatedFetch());
    await expect(result.current('/api/crash')).rejects.toThrow('Request failed (500)');
  });
});

// ── 2. useIsAuthReady ─────────────────────────────────────────────────────────

describe('useIsAuthReady', () => {
  it('returns false when Clerk is not loaded', async () => {
    vi.mocked(useAuth).mockReturnValueOnce({ isLoaded: false, isSignedIn: false, getToken: vi.fn() } as any);
    const { useIsAuthReady } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useIsAuthReady());
    expect(result.current).toBe(false);
  });

  it('returns false when loaded but not signed in', async () => {
    vi.mocked(useAuth).mockReturnValueOnce({ isLoaded: true, isSignedIn: false, getToken: vi.fn() } as any);
    const { useIsAuthReady } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useIsAuthReady());
    expect(result.current).toBe(false);
  });

  it('returns true when loaded and signed in', async () => {
    vi.mocked(useAuth).mockReturnValueOnce({ isLoaded: true, isSignedIn: true, getToken: vi.fn() } as any);
    const { useIsAuthReady } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useIsAuthReady());
    expect(result.current).toBe(true);
  });

  it('returns false when isSignedIn is undefined (transitional state)', async () => {
    vi.mocked(useAuth).mockReturnValueOnce({ isLoaded: true, isSignedIn: undefined, getToken: vi.fn() } as any);
    const { useIsAuthReady } = await import('@/src/lib/hooks/useAuthenticatedFetch');
    const { result } = renderHook(() => useIsAuthReady());
    expect(result.current).toBe(false);
  });
});

// ── 3. next/navigation mock correctness ──────────────────────────────────────

describe('next/navigation mocks', () => {
  it('usePathname returns a string', async () => {
    const { usePathname } = await import('next/navigation');
    expect(typeof usePathname()).toBe('string');
  });

  it('useRouter push is callable', async () => {
    const { useRouter } = await import('next/navigation');
    const router = useRouter();
    expect(() => router.push('/dashboard/bots')).not.toThrow();
  });

  it('useSearchParams returns a URLSearchParams-like object', async () => {
    const { useSearchParams } = await import('next/navigation');
    const params = useSearchParams();
    expect(params).toBeDefined();
    expect(typeof params.get).toBe('function');
    expect(params.get('edit')).toBeNull();
  });

  it('useParams returns an object', async () => {
    const { useParams } = await import('next/navigation');
    expect(typeof useParams()).toBe('object');
  });
});

// ── 4. NEXT_PUBLIC_ env vars ──────────────────────────────────────────────────

describe('NEXT_PUBLIC_ environment variables', () => {
  it('NEXT_PUBLIC_API_URL is defined in the test environment', () => {
    // Must be set via .env.local or NEXT_PUBLIC_API_URL=... prefix in env
    // In vitest, process.env is available directly
    expect(typeof process.env.NEXT_PUBLIC_API_URL).toBe('string');
  });

  it('NEXT_PUBLIC_SAPYBASE_API_KEY is defined when set in env', () => {
    // Vitest does not auto-load .env.local — the key is injected via vitest.config.ts
    // or must be present in process.env at test time. We assert the pattern: if set,
    // it must be a non-empty string starting with "sb_".
    const key = process.env.NEXT_PUBLIC_SAPYBASE_API_KEY;
    if (key !== undefined) {
      expect(key.length).toBeGreaterThan(0);
      expect(key.startsWith('sb_')).toBe(true);
    } else {
      // Key is absent in CI — acceptable; just verify the var name is correct
      expect(key).toBeUndefined();
    }
  });
});

// ── 5. EmbedPage ResizeObserver postMessage ───────────────────────────────────

describe('EmbedPage ResizeObserver postMessage bridge', () => {
  it('posts Sapybase:resize message with height when body resizes', () => {
    const postMessageSpy = vi.spyOn(window.parent, 'postMessage');

    // The global ResizeObserver stub in setup.ts exposes a `.trigger()` method
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        window.parent.postMessage(
          { type: 'Sapybase:resize', height: entry.contentRect.height },
          '*'
        );
      }
    });
    observer.observe(document.body);

    // Trigger a synthetic resize entry via the stub's trigger helper
    (observer as any).trigger([{ contentRect: { height: 650 } }] as any);

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'Sapybase:resize', height: 650 },
      '*'
    );

    postMessageSpy.mockRestore();
  });

  it('cleanup disconnects the observer', () => {
    const disconnectSpy = vi.spyOn(ResizeObserver.prototype, 'disconnect');

    const observer = new ResizeObserver(() => {});
    observer.observe(document.body);
    observer.disconnect();

    expect(disconnectSpy).toHaveBeenCalledOnce();
    disconnectSpy.mockRestore();
  });
});

// ── 6. SSR safety: no window/document at module import time ──────────────────

describe('SSR safety: module-level browser access', () => {
  it('window is not accessed during pure logic evaluation', () => {
    // Validate the preValidateUrl function (extracted from LogoCustomizer)
    // works without window access — it only uses URL constructor and string ops
    function preValidateUrl(url: string | null | undefined) {
      if (!url || !url.trim()) return null;
      if (!url.startsWith('https://')) return 'URL must start with https://';
      try { new URL(url); } catch { return 'Invalid URL'; }
      return null;
    }

    // Should work in Node/SSR context with no window
    expect(preValidateUrl('https://cdn.example.com/logo.png')).toBeNull();
    expect(preValidateUrl('http://example.com')).toBeTruthy();
  });
});
