import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RequestsInboxPanel from '@/src/components/dashboard/RequestsInboxPanel';

// react-query mock: useQuery returns different data per query key; useMutation
// actually invokes the passed mutationFn so we can assert the PATCH call shape.
const QUOTE_ITEMS = [
  {
    id: 'q1', product: 'Acetone', grade: 'AR', pack_size: '5 L', quantity: 2,
    subtotal: 1000, currency: 'INR', is_por: false, contact_name: 'Asha',
    contact_email: 'asha@acme.com', status: 'new',
    created_at: '2026-07-04T10:00:00Z', session_id: 'sess-Q',
  },
];
const AGENT_ITEMS = [
  {
    id: 'a1', kind: 'sample', product: 'Toluene', quantity: 1, status: 'new',
    created_at: '2026-07-03T10:00:00Z', session_id: 'sess-A',
  },
];

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(({ queryKey }: any) => {
    if (queryKey[0] === 'quote-requests') return { data: { items: QUOTE_ITEMS }, isLoading: false };
    if (queryKey[0] === 'agent-requests') return { data: { items: AGENT_ITEMS }, isLoading: false };
    return { data: undefined, isLoading: false };
  }),
  useMutation: vi.fn((cfg: any) => ({
    mutate: (vars: any) => cfg.mutationFn(vars),
    isPending: false,
  })),
  useQueryClient: vi.fn(() => ({ invalidateQueries: vi.fn() })),
}));

describe('RequestsInboxPanel (Phase 3.2 merged inbox)', () => {
  const authFetch = vi.fn(() => Promise.resolve({}));

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderPanel = (onViewSession?: any) =>
    render(
      <RequestsInboxPanel
        selectedBotId="bot-1"
        authFetch={authFetch}
        isAuthorized
        onViewSession={onViewSession}
      />
    );

  it('merges quotes and samples into one table', () => {
    renderPanel();
    expect(screen.getByText('Acetone')).toBeInTheDocument();
    expect(screen.getByText('Toluene')).toBeInTheDocument();
    expect(screen.getByText('Quote')).toBeInTheDocument();
    expect(screen.getByText('Sample')).toBeInTheDocument();
  });

  it('filters to samples when the Samples chip is clicked', () => {
    renderPanel();
    fireEvent.click(screen.getByText('Samples'));
    expect(screen.queryByText('Acetone')).not.toBeInTheDocument();
    expect(screen.getByText('Toluene')).toBeInTheDocument();
  });

  it('quote status select PATCHes the quote-requests endpoint', () => {
    renderPanel();
    const sel = screen.getByLabelText('Change status for Quote Acetone') as HTMLSelectElement;
    fireEvent.change(sel, { target: { value: 'won' } });
    expect(authFetch).toHaveBeenCalledWith(
      '/api/companies/bot-1/quote-requests/q1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'won' }) })
    );
  });

  it('agent status select offers handled (not sent) and PATCHes agent-requests', () => {
    renderPanel();
    const sel = screen.getByLabelText('Change status for Sample Toluene') as HTMLSelectElement;
    const opts = Array.from(sel.querySelectorAll('option')).map((o) => o.value);
    expect(opts).toContain('handled');
    expect(opts).not.toContain('sent');
    fireEvent.change(sel, { target: { value: 'handled' } });
    expect(authFetch).toHaveBeenCalledWith(
      '/api/companies/bot-1/agent-requests/a1',
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ status: 'handled' }) })
    );
  });

  it('View chat calls onViewSession with the request session id', () => {
    const onViewSession = vi.fn();
    renderPanel(onViewSession);
    // Sorted by created_at desc → the quote (Jul 4) is the first "View chat".
    fireEvent.click(screen.getAllByText('View chat')[0]);
    expect(onViewSession).toHaveBeenCalledWith('sess-Q');
  });
});
