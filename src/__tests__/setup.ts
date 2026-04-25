import '@testing-library/jest-dom';
import { vi } from 'vitest';

// ── next/navigation mock ──────────────────────────────────────────────────────
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/dashboard/bots',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// ── next/link mock ────────────────────────────────────────────────────────────
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: any) => {
    const React = require('react');
    return React.createElement('a', { href, ...props }, children);
  },
}));

// ── Clerk mock ────────────────────────────────────────────────────────────────
// useAuth is a vi.fn() so individual tests can call .mockReturnValueOnce()
vi.mock('@clerk/nextjs', () => ({
  useAuth: vi.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
    getToken: vi.fn().mockResolvedValue('mock-clerk-token'),
    userId: 'user_test123',
  })),
  useUser: vi.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: 'user_test123',
      fullName: 'Test User',
      firstName: 'Test',
      emailAddresses: [{ emailAddress: 'test@example.com' }],
    },
  })),
  ClerkProvider: ({ children }: any) => children,
  UserButton: () => null,
}));

// ── ResizeObserver stub ───────────────────────────────────────────────────────
// Must be a real class (not arrow fn) so `new ResizeObserver(...)` works in tests
global.ResizeObserver = class ResizeObserver {
  private cb: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) { this.cb = cb; }
  observe() {}
  unobserve() {}
  disconnect() {}
  trigger(entries: ResizeObserverEntry[]) { this.cb(entries, this); }
};

// ── matchMedia stub ───────────────────────────────────────────────────────────
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// ── crypto.randomUUID stub ────────────────────────────────────────────────────
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => 'test-uuid-1234-5678-abcd' },
  });
}

// ── fetchEventSource stub — prevents real SSE connections in tests ────────────
vi.mock('@microsoft/fetch-event-source', () => ({
  fetchEventSource: vi.fn(),
}));

// ── framer-motion stub — avoids animation timing issues in jsdom ──────────────
vi.mock('framer-motion', async () => {
  const React = await import('react');
  const createPassthrough = (tag: string) =>
    React.forwardRef(({ children, ...props }: any, ref: any) =>
      React.createElement(tag, { ...props, ref }, children)
    );
  return {
    motion: new Proxy({}, { get: (_, tag: string) => createPassthrough(tag) }),
    AnimatePresence: ({ children }: any) => children,
    useMotionValue: () => ({ set: vi.fn(), get: vi.fn() }),
    useTransform: () => ({}),
  };
});
