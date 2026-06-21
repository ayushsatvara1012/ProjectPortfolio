import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MyDatabasePage from '@/src/app/(app)/dashboard/database/page';

// ── Mocks ───────────────────────────────────────────────────────────────────────
const mockAuthedFetch = vi.fn();
vi.mock('@/src/lib/hooks/useAuthenticatedFetch', () => ({
  useAuthenticatedFetch: () => mockAuthedFetch,
  useIsAuthReady: () => true,
}));

let mockEntitled = true;
vi.mock('@/src/lib/context/UserContext', () => ({
  useUserRole: () => ({
    entitlements: { canUseByoDatabase: mockEntitled },
    isLoading: false,
  }),
}));

// react-query: useQuery returns the view under test; useMutation is idle (the
// onSuccess-driven flows are covered by the backend gate — here we assert the
// rendering/gating branches that don't depend on a mutation resolving).
let mockView: unknown = null;
const mutate = vi.fn();
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(() => ({ data: mockView, isLoading: false, isError: false })),
  useMutation: vi.fn(() => ({ mutate, isPending: false, isError: false, reset: vi.fn() })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

const REQUIREMENTS = {
  egress_ip_ranges: ['74.220.48.0/24', '74.220.56.0/24'],
  tls_required: true,
  min_pgvector_version: '0.5.0',
  embedding_dimensions: 768,
  dsn_format: 'postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require',
  checklist: ['Allowlist the egress IP ranges.', 'pgvector >= 0.5.0 available.'],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEntitled = true;
  mockView = null;
});

describe('My Database (BYOD client onboarding)', () => {
  it('locks the page for users without the byo_database entitlement', () => {
    mockEntitled = false;
    render(<MyDatabasePage />);
    expect(screen.getByText('Bring Your Own Database')).toBeInTheDocument();
    expect(screen.queryByText('Test connection')).not.toBeInTheDocument();
  });

  it('shows the onboarding wizard (requirements + egress IPs) when not started', () => {
    mockView = {
      company_id: 'co-1',
      status: null,
      can_edit_connection: true,
      connection: null,
      requirements: REQUIREMENTS,
    };
    render(<MyDatabasePage />);

    expect(screen.getByText('Not started')).toBeInTheDocument();
    // Egress IPs surfaced for the client to allowlist.
    expect(screen.getByText('74.220.48.0/24')).toBeInTheDocument();
    expect(screen.getByText('74.220.56.0/24')).toBeInTheDocument();
    // Submit is disabled until a successful Test.
    expect(screen.getByRole('button', { name: /Submit for review/i })).toBeDisabled();
  });

  it('Test connection sends the entered DSN', () => {
    mockView = {
      company_id: 'co-1',
      status: 'PENDING',
      can_edit_connection: true,
      connection: { masked_url: 'postgresql://••••@••••', status: 'PENDING', is_live: false, provisioned: false, schema_version: null, created_at: null, updated_at: null },
      requirements: REQUIREMENTS,
    };
    render(<MyDatabasePage />);

    const input = screen.getByPlaceholderText(/postgresql:\/\/user:password/i);
    fireEvent.change(input, { target: { value: 'postgresql://a:b@h:5432/d?sslmode=require' } });
    fireEvent.click(screen.getByRole('button', { name: /Test connection/i }));
    expect(mutate).toHaveBeenCalledWith('postgresql://a:b@h:5432/d?sslmode=require');
  });

  it('shows the manage panel (reconnect / leave) when the connection is frozen (LIVE)', () => {
    mockView = {
      company_id: 'co-1',
      status: 'LIVE',
      can_edit_connection: false,
      connection: { masked_url: 'postgresql://••••@••••', status: 'LIVE', is_live: true, provisioned: true, schema_version: '0001', created_at: null, updated_at: null },
      requirements: REQUIREMENTS,
    };
    render(<MyDatabasePage />);

    expect(screen.getByRole('button', { name: /Request reconnect/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Request to leave/i })).toBeInTheDocument();
    // No DSN entry while frozen.
    expect(screen.queryByText('Test connection')).not.toBeInTheDocument();
  });
});
