import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CoaFolderField from '@/src/components/dashboard/CoaFolderField';

/**
 * COA finder Phase 1 — the Test Connection button.
 *
 * The one behaviour worth protecting: "connected, 0 files" must NOT render as a
 * success (H2). A folder that lives in a Google Shared Drive returns zero files
 * with HTTP 200, so a green tick on an empty result is how an owner ships a bot
 * that says "no certificates on file" forever while nothing looks broken.
 */

const FOLDER_ID = '1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U';
const FOLDER_URL = `https://drive.google.com/drive/folders/${FOLDER_ID}`;

const baseProps = {
  value: FOLDER_URL,
  onChange: vi.fn(),
  inputCls: 'input',
  labelCls: 'label',
  helpCls: 'help',
};

// The field hosts the Phase 4 library panel, which fetches its own report on mount.
// Mocks are therefore routed by path — a bare `vi.fn()` would let the panel consume
// the response written for Test Connection, which is the kind of coupling that makes
// a passing test meaningless.
const HEALTHY_REPORT = {
  status: 'ok', from_cache: false, indexed: 3, folders: 1, files_seen: 3,
  ignored_non_pdf: 0, unindexable: 0, duplicates_collapsed: 0, duplicate_samples: [],
  hard_to_find: 0, hard_to_find_samples: [], capped: [], walked_at: '2026-07-29T10:00:00.000Z',
};

function routed(onTest: () => Promise<any>) {
  return vi.fn((path: string) =>
    path.endsWith('/coa/report') ? Promise.resolve(HEALTHY_REPORT) : onTest());
}

describe('CoaFolderField Test Connection', () => {
  beforeEach(() => vi.clearAllMocks());

  it('hides the button until a valid folder is entered', () => {
    render(<CoaFolderField {...baseProps} value="" botId="bot-1" authFetch={vi.fn()} />);
    expect(screen.queryByText('Test connection')).not.toBeInTheDocument();
  });

  it('hides the button when botId/authFetch are absent', () => {
    render(<CoaFolderField {...baseProps} />);
    expect(screen.queryByText('Test connection')).not.toBeInTheDocument();
  });

  it('POSTs to the test-connection endpoint', async () => {
    const authFetch = routed(() => Promise.resolve({ indexed: 3, files_seen: 3, message: 'Connected. Indexed 3 certificates across 2 folders.' }));
    render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Test connection'));
    expect(authFetch).toHaveBeenCalledWith('/api/companies/bot-1/coa/test-connection', { method: 'POST' });
    await waitFor(() => expect(screen.getByText(/Indexed 3 certificates/)).toBeInTheDocument());
  });

  it('shows a success state when certificates were indexed', async () => {
    const authFetch = routed(() => Promise.resolve({ indexed: 3, files_seen: 3, message: 'Connected. Indexed 3 certificates across 2 folders.' }));
    const { container } = render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status').className).toMatch(/emerald/);
    expect(container.textContent).toContain('check_circle');
  });

  it('H2 — an empty folder is a warning, never a green tick', async () => {
    const authFetch = routed(() => Promise.resolve({
      indexed: 0,
      files_seen: 0,
      message: 'Connected, but the folder is empty. If your certificates are in a Shared Drive, check the link points at the folder itself.',
    }));
    const { container } = render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument());
    expect(screen.getByRole('status').className).not.toMatch(/emerald/);
    expect(screen.getByRole('status').className).toMatch(/amber/);
    expect(container.textContent).toContain('warning');
    expect(container.textContent).toMatch(/Shared Drive/);
  });

  it('a folder of non-PDFs is also not a success', async () => {
    const authFetch = routed(() => Promise.resolve({
      indexed: 0, files_seen: 4, message: 'Connected, but none of the 4 files here are PDFs.',
    }));
    render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByRole('status').className).toMatch(/amber/));
  });

  it('surfaces the backend message when the folder is unreachable', async () => {
    const authFetch = routed(() => Promise.reject({
      body: { detail: { code: 'COA_UNREACHABLE', message: 'Drive refused access. Share the folder as "Anyone with the link" and try again.' } },
    }));
    render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByText(/Anyone with the link/)).toBeInTheDocument());
    expect(screen.getByRole('status').className).toMatch(/amber/);
  });

  it('falls back to a generic message when the error carries none', async () => {
    const authFetch = routed(() => Promise.reject(new Error('')));
    render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByText(/couldn't reach the folder/)).toBeInTheDocument());
  });

  it('disables the button while the walk is in flight', async () => {
    let resolve: (v: any) => void = () => {};
    const authFetch = routed(() => new Promise((r) => { resolve = r; }));
    render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByText('Checking…')).toBeInTheDocument());
    expect(screen.getByRole('button')).toBeDisabled();
    resolve({ indexed: 1, files_seen: 1, message: 'Connected.' });
    await waitFor(() => expect(screen.getByText('Test connection')).toBeInTheDocument());
  });

  it('clears the previous result when a new test starts', async () => {
    const queue = [
      { indexed: 0, files_seen: 0, message: 'Connected, but the folder is empty.' },
      { indexed: 2, files_seen: 2, message: 'Connected. Indexed 2 certificates across 1 folder.' },
    ];
    const authFetch = routed(() => Promise.resolve(queue.shift()));
    render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByText(/folder is empty/)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByText(/Indexed 2 certificates/)).toBeInTheDocument());
    expect(screen.queryByText(/folder is empty/)).not.toBeInTheDocument();
  });

  it('never renders a folder id it was not given', () => {
    const { container } = render(<CoaFolderField {...baseProps} value="" botId="bot-1" authFetch={vi.fn()} />);
    expect(container.textContent).not.toContain(FOLDER_ID);
  });
});
