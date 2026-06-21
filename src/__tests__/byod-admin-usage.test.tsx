import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// ── Mocks ───────────────────────────────────────────────────────────────────────
// The usage panel reads GET /api/admin/users/{clerk_id}/byod/usage through the
// shared authed fetch + react-query. We mock react-query's useQuery so the panel
// renders against a fixed ByodUsage payload (no real network).
const mockAuthedFetch = vi.fn();
vi.mock('@/src/lib/hooks/useAuthenticatedFetch', () => ({
  useAuthenticatedFetch: () => mockAuthedFetch,
  useIsAuthReady: () => true,
}));

// useFreshAdminFetch (elsewhere in the module) calls Clerk's useAuth at import —
// stub it so importing ByodTab doesn't require the Clerk provider.
vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ getToken: vi.fn() }),
}));

const refetch = vi.fn();
type QueryShape = {
  data?: unknown;
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  refetch: () => void;
};
let mockQuery: QueryShape = { data: undefined, isLoading: true, isError: false, isFetching: false, refetch };
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => mockQuery),
  useMutation: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

import { UsagePanel } from '@/src/app/(app)/dashboard/settings/admin/ByodTab';

const USAGE = {
  company_id: 'co-1',
  messages_used: 1234,
  period_start: '2026-06-01T00:00:00Z',
  period_end: '2026-07-01T00:00:00Z',
  ledger_total: 1180,
  last_24h: 12,
  last_7d: 96,
  last_30d: 410,
  last_metered_at: '2026-06-20T19:50:06Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockQuery = { data: undefined, isLoading: true, isError: false, isFetching: false, refetch };
});

describe('BYOD admin usage panel (Phase 6)', () => {
  it('shows a loading state while usage is fetching', () => {
    render(<UsagePanel clerkId="user_1" />);
    expect(screen.getByText(/Loading usage/i)).toBeInTheDocument();
  });

  it('renders the billing counter, ledger total, and trailing windows', () => {
    mockQuery = { data: USAGE, isLoading: false, isError: false, isFetching: false, refetch };
    render(<UsagePanel clerkId="user_1" />);

    // Authoritative billing counter (thousands-formatted) + the ledger total.
    expect(screen.getByText('1,234')).toBeInTheDocument();
    expect(screen.getByText('1,180')).toBeInTheDocument();
    // Trailing-window message counts.
    expect(screen.getByText('Last 24h')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('96')).toBeInTheDocument();
    expect(screen.getByText('410')).toBeInTheDocument();
    // Tile labels distinguish the billed counter from per-message metering
    // (exact match — the explanatory caption also mentions these terms).
    expect(screen.getByText('Messages billed')).toBeInTheDocument();
    expect(screen.getByText('Metered (all time)')).toBeInTheDocument();
  });

  it('surfaces an error state with a Retry that refetches', () => {
    mockQuery = { data: undefined, isLoading: false, isError: true, isFetching: false, refetch };
    render(<UsagePanel clerkId="user_1" />);

    expect(screen.getByText(/Couldn’t load usage/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Retry/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it('exposes an accessible Refresh control', () => {
    mockQuery = { data: USAGE, isLoading: false, isError: false, isFetching: false, refetch };
    render(<UsagePanel clerkId="user_1" />);
    fireEvent.click(screen.getByRole('button', { name: /Refresh usage/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
