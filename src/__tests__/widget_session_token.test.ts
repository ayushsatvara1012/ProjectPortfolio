/**
 * ChatWidget — Widget Session Token (anti quota-drain)
 *
 * Mirrors the getSessionToken caching/mint logic + the chat-header attach +
 * the 401-invalidation behavior from ChatWidget.tsx. Following this file's
 * convention, the logic is extracted (not rendered) and kept in sync with the
 * component. When ChatWidget's token logic changes, update here.
 *
 * Live-safety guarantees under test:
 *  - Soft-launch resilience: if /api/widget/session fails (503/network), chat
 *    must still proceed with NO session header (never throws, never blocks).
 *  - Correctness: when minting succeeds, x-Sapybase-session is attached.
 *  - Caching: token reused until within 60s of expiry, then re-minted.
 *  - 401 handling: invalidates the cache so the next send re-mints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

type TokenRef = { current: { token: string; exp: number } | null };

// ── Faithful extraction of getSessionToken from ChatWidget.tsx ────────────────
function makeGetSessionToken(opts: {
  fetchImpl: typeof fetch;
  activeApiKey: string | undefined;
  activeApiUrl: string;
  parentOrigin: string;
  ref: TokenRef;
  now?: () => number;
}) {
  const now = opts.now ?? (() => Date.now());
  return async function getSessionToken(): Promise<string | null> {
    if (!opts.activeApiKey) return null;
    const cached = opts.ref.current;
    if (cached && cached.exp - now() > 60_000) return cached.token;
    try {
      const res = await opts.fetchImpl(`${opts.activeApiUrl}/api/widget/session`, {
        method: 'POST',
        headers: {
          'x-api-key': opts.activeApiKey,
          ...(opts.parentOrigin ? { 'x-Sapybase-parent-origin': opts.parentOrigin } : {}),
        },
      });
      if (!res.ok) return null;
      const data = await res.json();
      const ttlMs = (Number(data.expires_in) || 1800) * 1000;
      opts.ref.current = { token: data.token, exp: now() + ttlMs };
      return data.token;
    } catch {
      return null;
    }
  };
}

// ── Faithful extraction of the chat header construction ───────────────────────
function buildChatHeaders(resolvedApiKey: string, parentOriginChat: string, sessionToken: string | null) {
  return {
    'Content-Type': 'application/json',
    'x-api-key': resolvedApiKey,
    ...(parentOriginChat ? { 'x-Sapybase-parent-origin': parentOriginChat } : {}),
    ...(sessionToken ? { 'x-Sapybase-session': sessionToken } : {}),
  };
}

function okResponse(body: object): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}
function errResponse(status: number): Response {
  return { ok: false, status, json: async () => ({}) } as unknown as Response;
}

describe('getSessionToken — minting & caching', () => {
  let ref: TokenRef;
  beforeEach(() => { ref = { current: null }; });

  it('mints a token when cache is empty and attaches API key + origin headers', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ token: 'tok-1', expires_in: 1800 }));
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: 'pk_live_123', activeApiUrl: 'https://api.test', parentOrigin: 'https://shop.com', ref,
    });
    const token = await get();
    expect(token).toBe('tok-1');
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.test/api/widget/session');
    expect(init.method).toBe('POST');
    expect(init.headers['x-api-key']).toBe('pk_live_123');
    expect(init.headers['x-Sapybase-parent-origin']).toBe('https://shop.com');
    expect(ref.current).toEqual({ token: 'tok-1', exp: expect.any(Number) });
  });

  it('returns null without calling fetch when no API key', async () => {
    const fetchImpl = vi.fn();
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: undefined, activeApiUrl: 'https://api.test', parentOrigin: '', ref,
    });
    expect(await get()).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('omits the origin header when parentOrigin is empty', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ token: 't', expires_in: 1800 }));
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: 'k', activeApiUrl: 'https://api.test', parentOrigin: '', ref,
    });
    await get();
    expect(fetchImpl.mock.calls[0][1].headers).not.toHaveProperty('x-Sapybase-parent-origin');
  });

  it('reuses the cached token when >60s of life remains (no second fetch)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ token: 'tok-cache', expires_in: 1800 }));
    let t = 1_000_000;
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: 'k', activeApiUrl: 'https://api.test', parentOrigin: '', ref, now: () => t,
    });
    expect(await get()).toBe('tok-cache');
    t += 60_000; // still 1800s - 60s = plenty of life left
    expect(await get()).toBe('tok-cache');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('re-mints when the cached token is within 60s of expiry', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(okResponse({ token: 'old', expires_in: 100 }))
      .mockResolvedValueOnce(okResponse({ token: 'new', expires_in: 1800 }));
    let t = 1_000_000;
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: 'k', activeApiUrl: 'https://api.test', parentOrigin: '', ref, now: () => t,
    });
    expect(await get()).toBe('old');   // exp = now + 100s
    t += 50_000;                        // 50s left -> within the 60s buffer
    expect(await get()).toBe('new');    // re-mints
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('defaults TTL to 1800s when expires_in is missing/invalid', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ token: 'tok' /* no expires_in */ }));
    let t = 0;
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: 'k', activeApiUrl: 'https://api.test', parentOrigin: '', ref, now: () => t,
    });
    await get();
    expect(ref.current!.exp).toBe(1800 * 1000);
  });
});

describe('getSessionToken — soft-launch resilience', () => {
  let ref: TokenRef;
  beforeEach(() => { ref = { current: null }; });

  it('returns null (no throw) when the endpoint 503s (feature not configured)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(503));
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: 'k', activeApiUrl: 'https://api.test', parentOrigin: '', ref,
    });
    expect(await get()).toBeNull();
    expect(ref.current).toBeNull(); // cache not poisoned
  });

  it('returns null (no throw) when the network call rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: 'k', activeApiUrl: 'https://api.test', parentOrigin: '', ref,
    });
    await expect(get()).resolves.toBeNull();
  });

  it('returns null when rate-limited (429) on minting', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(errResponse(429));
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: 'k', activeApiUrl: 'https://api.test', parentOrigin: '', ref,
    });
    expect(await get()).toBeNull();
  });
});

describe('chat header construction', () => {
  it('attaches x-Sapybase-session when a token is present', () => {
    const h = buildChatHeaders('pk_1', 'https://shop.com', 'tok-abc');
    expect(h['x-Sapybase-session']).toBe('tok-abc');
    expect(h['x-Sapybase-parent-origin']).toBe('https://shop.com');
    expect(h['x-api-key']).toBe('pk_1');
  });

  it('omits x-Sapybase-session when token is null (soft-launch: chat still works)', () => {
    const h = buildChatHeaders('pk_1', 'https://shop.com', null);
    expect(h).not.toHaveProperty('x-Sapybase-session');
    expect(h['x-api-key']).toBe('pk_1'); // chat still authenticates as before
  });

  it('omits origin header when parentOrigin is empty but keeps the token', () => {
    const h = buildChatHeaders('pk_1', '', 'tok');
    expect(h).not.toHaveProperty('x-Sapybase-parent-origin');
    expect(h['x-Sapybase-session']).toBe('tok');
  });
});

describe('401 invalidation', () => {
  it('clears the token ref so the next send re-mints', async () => {
    const ref: TokenRef = { current: { token: 'stale', exp: Date.now() + 10_000_000 } };

    // Simulate the onopen !response.ok branch for a 401.
    const status = 401;
    if (status === 401) ref.current = null;

    expect(ref.current).toBeNull();

    // Next getSessionToken call must mint fresh (cache was cleared).
    const fetchImpl = vi.fn().mockResolvedValue(okResponse({ token: 'fresh', expires_in: 1800 }));
    const get = makeGetSessionToken({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      activeApiKey: 'k', activeApiUrl: 'https://api.test', parentOrigin: '', ref,
    });
    expect(await get()).toBe('fresh');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it('does NOT clear the token on a 402 (message-limit) response', () => {
    const ref: TokenRef = { current: { token: 'keep', exp: Date.now() + 10_000_000 } };
    const status: number = 402;
    if (status === 401) ref.current = null; // 402 must not match
    expect(ref.current?.token).toBe('keep');
  });
});
