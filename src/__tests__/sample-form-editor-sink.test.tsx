import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SampleFormEditor from '@/src/components/dashboard/SampleFormEditor';

// Phase 3.4 — "Send test row" button + Apps Script template. The field-editing
// behaviour is exercised elsewhere; here we only cover the sink-onboarding UI.

describe('SampleFormEditor sink onboarding (Phase 3.4)', () => {
  const baseProps = {
    fields: [],
    onChange: vi.fn(),
    sinkUrl: 'https://script.google.com/macros/s/AK/exec',
    onSinkUrlChange: vi.fn(),
    sinkSecret: '',
    onSinkSecretChange: vi.fn(),
  };

  beforeEach(() => vi.clearAllMocks());

  it('hides the test button when botId/authFetch are absent', () => {
    render(<SampleFormEditor {...baseProps} />);
    expect(screen.queryByText('Send test row')).not.toBeInTheDocument();
  });

  it('POSTs to the sink-test endpoint and shows a Delivered status', async () => {
    const authFetch = vi.fn(() => Promise.resolve({ ok: true, detail: 'HTTP 200', at: '2026-07-04T10:00:00Z' }));
    render(<SampleFormEditor {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Send test row'));
    expect(authFetch).toHaveBeenCalledWith('/api/companies/bot-1/sample-sink/test', { method: 'POST' });
    await waitFor(() => expect(screen.getByText(/Delivered/)).toBeInTheDocument());
  });

  it('shows a Failed status when the test fails', async () => {
    const authFetch = vi.fn(() => Promise.resolve({ ok: false, detail: 'HTTP 500' }));
    render(<SampleFormEditor {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Send test row'));
    await waitFor(() => expect(screen.getByText(/Failed/)).toBeInTheDocument());
  });

  it('surfaces the persisted sinkStatus before any test is run', () => {
    render(<SampleFormEditor {...baseProps} botId="bot-1" authFetch={vi.fn()} sinkStatus={{ ok: true, detail: 'HTTP 200' }} />);
    expect(screen.getByText(/Delivered/)).toBeInTheDocument();
  });

  it('reveals the Apps Script template on toggle', () => {
    render(<SampleFormEditor {...baseProps} />);
    fireEvent.click(screen.getByText(/Apps Script template/));
    expect(screen.getByText(/function doPost/)).toBeInTheDocument();
  });
});
