import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import CoaFolderField from '@/src/components/dashboard/CoaFolderField';
import CoaLibraryPanel from '@/src/components/dashboard/CoaLibraryPanel';

/**
 * COA finder Phase 4 — the library panel's wiring, as opposed to its arithmetic
 * (which `coa-report.test.ts` covers against the pure module).
 *
 * Every assertion here is the class of defect the Phase 3 browser pass found and a
 * green unit suite did not: a component that fetches the wrong path, describes a
 * folder that is not the saved one, or renders an error as an empty library.
 */

const FOLDER_ID = '1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U';
const OTHER_FOLDER_ID = '2x-tFH8yLr3OqS5wUaC0dZeMnI1bRgK4V';
const url = (id: string) => `https://drive.google.com/drive/folders/${id}`;

const REPORT = {
  status: 'ok', from_cache: true, indexed: 1781, folders: 8, files_seen: 2240,
  ignored_non_pdf: 2, unindexable: 0, duplicates_collapsed: 457,
  duplicate_samples: [{ name: '100MC3_100.26P001_ACETONE USP-NF PH.EUR BP.pdf', copies: 2 }],
  hard_to_find: 1, hard_to_find_samples: ['129LR'], capped: [],
  walked_at: new Date().toISOString(),
};

const fieldProps = {
  value: url(FOLDER_ID),
  onChange: vi.fn(),
  inputCls: 'input',
  labelCls: 'label',
  helpCls: 'help',
};

describe('CoaLibraryPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads the report endpoint for the bot it was given', async () => {
    const authFetch = vi.fn(() => Promise.resolve(REPORT));
    render(<CoaLibraryPanel botId="bot-1" authFetch={authFetch} savedFolderId={FOLDER_ID} />);
    await waitFor(() => expect(screen.getByText('Certificate library')).toBeInTheDocument());
    expect(authFetch).toHaveBeenCalledWith('/api/companies/bot-1/coa/report');
  });

  it('renders the counts the search actually runs against', async () => {
    const authFetch = vi.fn(() => Promise.resolve(REPORT));
    render(<CoaLibraryPanel botId="bot-1" authFetch={authFetch} savedFolderId={FOLDER_ID} />);
    await waitFor(() => expect(screen.getByText('1,781')).toBeInTheDocument());
    expect(screen.getByText('2,240')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('does not fetch at all without a saved folder', () => {
    const authFetch = vi.fn(() => Promise.resolve(REPORT));
    const { container } = render(
      <CoaLibraryPanel botId="bot-1" authFetch={authFetch} savedFolderId="" />);
    expect(authFetch).not.toHaveBeenCalled();
    expect(container.textContent).toBe('');
  });

  it('shows an unreachable folder as an error, never as an empty library', async () => {
    // The distinction that matters: "we could not read your folder" and "your folder
    // has no certificates in it" send the owner to completely different fixes.
    const authFetch = vi.fn(() => Promise.reject({
      body: { detail: { message: 'Drive refused access. Share the folder as "Anyone with the link" and try again.' } },
    }));
    render(<CoaLibraryPanel botId="bot-1" authFetch={authFetch} savedFolderId={FOLDER_ID} />);
    await waitFor(() => expect(screen.getByText(/Anyone with the link/)).toBeInTheDocument());
    expect(screen.queryByText('Certificate library')).not.toBeInTheDocument();
    expect(screen.queryByText(/searchable/)).not.toBeInTheDocument();
  });

  it('never renders the folder ID it was given (H11)', async () => {
    const authFetch = vi.fn(() => Promise.resolve(REPORT));
    const { container } = render(
      <CoaLibraryPanel botId="bot-1" authFetch={authFetch} savedFolderId={FOLDER_ID} />);
    await waitFor(() => expect(screen.getByText('Certificate library')).toBeInTheDocument());
    expect(container.textContent).not.toContain(FOLDER_ID);
  });

  it('hides the duplicate filenames behind a disclosure, then shows them', async () => {
    const authFetch = vi.fn(() => Promise.resolve(REPORT));
    render(<CoaLibraryPanel botId="bot-1" authFetch={authFetch} savedFolderId={FOLDER_ID} />);
    await waitFor(() => expect(screen.getByText(/457 duplicate copies merged/)).toBeInTheDocument());
    expect(screen.queryByText(/100MC3_100\.26P001/)).not.toBeInTheDocument();
    // Each notice discloses its own filenames, so scope to the duplicates one.
    const notice = screen.getByText(/457 duplicate copies merged/).closest('li')!;
    fireEvent.click(within(notice).getByText('Show filenames (1)'));
    expect(within(notice).getByText(/100MC3_100\.26P001.*\(2 copies\)/)).toBeInTheDocument();
    // …and only its own: opening one must not expand the other.
    const thin = screen.getByText(/1 certificate is hard to find/).closest('li')!;
    expect(within(thin).queryByText('129LR')).not.toBeInTheDocument();
  });

  it('confirms a clean folder rather than staying silent', async () => {
    const authFetch = vi.fn(() => Promise.resolve({
      ...REPORT, ignored_non_pdf: 0, duplicates_collapsed: 0, duplicate_samples: [],
      hard_to_find: 0, hard_to_find_samples: [],
    }));
    render(<CoaLibraryPanel botId="bot-1" authFetch={authFetch} savedFolderId={FOLDER_ID} />);
    await waitFor(() => expect(screen.getByText(/Every certificate in this folder is searchable/))
      .toBeInTheDocument());
  });

  it('refetches when the reload key changes, which is what a Test Connection bumps', async () => {
    const authFetch = vi.fn(() => Promise.resolve(REPORT));
    const { rerender } = render(
      <CoaLibraryPanel botId="bot-1" authFetch={authFetch} savedFolderId={FOLDER_ID} reloadKey={0} />);
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(1));
    rerender(
      <CoaLibraryPanel botId="bot-1" authFetch={authFetch} savedFolderId={FOLDER_ID} reloadKey={1} />);
    await waitFor(() => expect(authFetch).toHaveBeenCalledTimes(2));
  });
});

describe('CoaFolderField hosting the panel', () => {
  beforeEach(() => vi.clearAllMocks());

  const routed = (onTest: () => Promise<any> = () => Promise.resolve({ indexed: 1, message: 'Connected.' })) =>
    vi.fn((path: string) => (path.endsWith('/coa/report') ? Promise.resolve(REPORT) : onTest()));

  it('describes the SAVED folder, not an unsaved paste', async () => {
    // Otherwise a freshly pasted link renders 1,781 healthy certificates underneath
    // it and reads as approval of a folder the backend has never seen.
    const authFetch = routed();
    render(
      <CoaFolderField {...fieldProps} value={url(OTHER_FOLDER_ID)} savedValue={url(FOLDER_ID)}
        botId="bot-1" authFetch={authFetch} />);
    await waitFor(() => expect(screen.getByText(/still\s+describes the folder your bot is using/))
      .toBeInTheDocument());
    expect(screen.getByText('1,781')).toBeInTheDocument();
  });

  it('says nothing about unsaved changes when the paste matches what is saved', async () => {
    render(
      <CoaFolderField {...fieldProps} savedValue={url(FOLDER_ID)} botId="bot-1" authFetch={routed()} />);
    await waitFor(() => expect(screen.getByText('Certificate library')).toBeInTheDocument());
    expect(screen.queryByText(/but not saved it/)).not.toBeInTheDocument();
  });

  it('shows no panel for a bot with no folder saved yet', () => {
    const authFetch = routed();
    render(<CoaFolderField {...fieldProps} value="" savedValue="" botId="bot-1" authFetch={authFetch} />);
    expect(authFetch).not.toHaveBeenCalled();
    expect(screen.queryByText('Certificate library')).not.toBeInTheDocument();
  });

  it('refreshes the panel after a successful Test Connection', async () => {
    // Test Connection is the ONE action that forces a walk, so it is also the only
    // thing that can make the panel's cache-first numbers stale.
    const authFetch = routed();
    render(
      <CoaFolderField {...fieldProps} savedValue={url(FOLDER_ID)} botId="bot-1" authFetch={authFetch} />);
    await waitFor(() => expect(screen.getByText('Certificate library')).toBeInTheDocument());
    const before = authFetch.mock.calls.filter((c) => String(c[0]).endsWith('/coa/report')).length;
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => {
      const after = authFetch.mock.calls.filter((c) => String(c[0]).endsWith('/coa/report')).length;
      expect(after).toBe(before + 1);
    });
  });

  it('does not refresh the panel when the test failed, since no walk succeeded', async () => {
    const authFetch = routed(() => Promise.reject(new Error('Drive refused access.')));
    render(
      <CoaFolderField {...fieldProps} savedValue={url(FOLDER_ID)} botId="bot-1" authFetch={authFetch} />);
    await waitFor(() => expect(screen.getByText('Certificate library')).toBeInTheDocument());
    const before = authFetch.mock.calls.filter((c) => String(c[0]).endsWith('/coa/report')).length;
    fireEvent.click(screen.getByText('Test connection'));
    await waitFor(() => expect(screen.getByText(/Drive refused access/)).toBeInTheDocument());
    const after = authFetch.mock.calls.filter((c) => String(c[0]).endsWith('/coa/report')).length;
    expect(after).toBe(before);
  });
});
