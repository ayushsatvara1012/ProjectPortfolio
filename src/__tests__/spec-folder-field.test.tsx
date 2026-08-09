import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import SpecFolderField, { isSpecFolderInvalid } from '@/src/components/dashboard/SpecFolderField';
import CoaFolderField from '@/src/components/dashboard/CoaFolderField';
import { COA_LIBRARY, SPEC_LIBRARY } from '@/src/components/dashboard/driveLibrary';

/**
 * Spec finder Phase 2 — the second Drive folder field.
 *
 * `CoaFolderField` and `SpecFolderField` are now the same component with different
 * config, so the risk this file covers is not "does it render" — it is that the two
 * configurations get crossed. A field that posts to the certificate endpoint, or a
 * specification panel showing the confidential library's guessing tripwire, would
 * both look perfectly fine on screen.
 *
 * §8.3's copy requirement is asserted here too, because it is the whole mitigation
 * for the corpus decision (§3.1): the owner must be told, in the field itself, that
 * everything in the folder becomes searchable.
 */

const FOLDER_ID = '1KCRfrRQ9pLmXt4vB2nHy7WqZs3EdCa6T';
const FOLDER_URL = `https://drive.google.com/drive/folders/${FOLDER_ID}`;

const REPORT = {
  status: 'ok', from_cache: true, indexed: 1086, folders: 4, files_seen: 1086,
  ignored_non_pdf: 0, unindexable: 0, duplicates_collapsed: 0, duplicate_samples: [],
  hard_to_find: 0, hard_to_find_samples: [], capped: [],
  walked_at: new Date().toISOString(),
};

const baseProps = {
  value: FOLDER_URL,
  onChange: vi.fn(),
  inputCls: 'input',
  labelCls: 'label',
  helpCls: 'help',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('isSpecFolderInvalid', () => {
  it('accepts a Drive folder URL and a bare ID', () => {
    expect(isSpecFolderInvalid(FOLDER_URL)).toBe(false);
    expect(isSpecFolderInvalid(FOLDER_ID)).toBe(false);
  });

  it('treats blank as "feature off" rather than as an error', () => {
    expect(isSpecFolderInvalid('')).toBe(false);
    expect(isSpecFolderInvalid('   ')).toBe(false);
  });

  it('rejects a paste that is not a Drive folder link', () => {
    expect(isSpecFolderInvalid('not a url')).toBe(true);
    expect(isSpecFolderInvalid('https://drive.google.com/drive/folders/')).toBe(true);
  });
});

describe('the two fields do not get crossed', () => {
  it('posts Test Connection to the spec endpoint, never the certificate one', async () => {
    const authFetch = vi.fn((path: string) =>
      path.endsWith('/spec/report') ? Promise.resolve(REPORT) : Promise.resolve({ indexed: 1086 }));

    render(<SpecFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    await waitFor(() => expect(authFetch).toHaveBeenCalled());

    const paths = authFetch.mock.calls.map((c) => c[0] as string);
    expect(paths.every((p) => p.includes('/spec/'))).toBe(true);
    expect(paths.some((p) => p.includes('/coa/'))).toBe(false);
  });

  it('reads its library report from the spec endpoint', async () => {
    const authFetch = vi.fn(() => Promise.resolve(REPORT));
    render(<SpecFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    await waitFor(() =>
      expect(authFetch).toHaveBeenCalledWith('/api/companies/bot-1/spec/report'));
  });

  it('still routes the certificate field to the certificate endpoint', async () => {
    // The generalization must not have moved COA. Cheap, and the failure it catches
    // is a silent one: both fields would still render perfectly.
    const authFetch = vi.fn(() => Promise.resolve(REPORT));
    render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);
    await waitFor(() =>
      expect(authFetch).toHaveBeenCalledWith('/api/companies/bot-1/coa/report'));
  });

  it('gives the two fields different input ids so both can render on one page', () => {
    expect(SPEC_LIBRARY.fieldId).not.toBe(COA_LIBRARY.fieldId);
  });
});

describe('the panel wording follows the library', () => {
  it('labels the count as specification sheets, not certificates', async () => {
    const authFetch = vi.fn(() => Promise.resolve(REPORT));
    render(<SpecFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);

    expect(await screen.findByText('Specification library')).toBeTruthy();
    expect(screen.getByText('specification sheets')).toBeTruthy();
    expect(screen.queryByText('Certificate library')).toBeNull();
  });

  it('never shows the guessing tripwire on the public library', async () => {
    // "Failed lookups" is the confidential library's alarm. On a browsable public
    // search a miss is a typo, and presenting it as suspicious would be wrong even
    // if the backend started sending the number.
    const authFetch = vi.fn(() =>
      Promise.resolve({ ...REPORT, failed_lookups: 12, failed_lookups_days: 7 }));
    render(<SpecFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);

    await screen.findByText('Specification library');
    expect(screen.queryByText('Failed lookups')).toBeNull();
  });

  it('keeps the tripwire on the certificate library', async () => {
    const authFetch = vi.fn(() =>
      Promise.resolve({ ...REPORT, failed_lookups: 12, failed_lookups_days: 7 }));
    render(<CoaFolderField {...baseProps} botId="bot-1" authFetch={authFetch} />);

    expect(await screen.findByText('Failed lookups')).toBeTruthy();
  });
});

describe('the owner is told what pasting a folder means (§8.3)', () => {
  it('says every PDF becomes searchable by anyone who can use the widget', () => {
    render(<SpecFolderField {...baseProps} />);
    expect(
      screen.getByText(/every PDF in this folder becomes searchable by anyone/i),
    ).toBeTruthy();
  });

  it('shows the invalid-paste help instead when the link is unusable', () => {
    render(<SpecFolderField {...baseProps} value="not a url" />);
    expect(screen.getByText(/doesn't look like a Drive folder link/i)).toBeTruthy();
    expect(screen.queryByText(/every PDF in this folder/i)).toBeNull();
  });

  it('marks the input invalid so the page can block the save', () => {
    render(<SpecFolderField {...baseProps} value="not a url" />);
    expect(screen.getByRole('textbox').getAttribute('aria-invalid')).toBe('true');
  });
});
