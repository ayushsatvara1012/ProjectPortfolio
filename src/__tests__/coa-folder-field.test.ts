/**
 * COA finder Phase 0 — the client-side Drive folder-link parser.
 *
 * This mirrors `extract_folder_id` in packs/overrides.py. The backend is
 * authoritative (it re-validates and 400s), so the job here is to agree with it:
 * accept the same URL shapes and refuse the same hostile ones, so the owner never
 * sees a field that looks valid and then fails on save, or vice versa.
 */
import { describe, it, expect } from 'vitest';

import { extractDriveFolderId, isCoaFolderInvalid } from '@/src/components/dashboard/CoaFolderField';

const FOLDER_ID = '1w-sEG7xKq2NpR4vTzB9cYdLmH0aQfJ3U';

describe('extractDriveFolderId', () => {
  it.each([
    `https://drive.google.com/drive/folders/${FOLDER_ID}`,
    `https://drive.google.com/drive/folders/${FOLDER_ID}?usp=sharing`,
    `https://drive.google.com/drive/folders/${FOLDER_ID}?usp=drive_link`,
    `https://drive.google.com/drive/u/0/folders/${FOLDER_ID}`,
    `https://drive.google.com/drive/u/2/folders/${FOLDER_ID}?usp=sharing`,
    `https://drive.google.com/open?id=${FOLDER_ID}`,
    `https://drive.google.com/drive/folders/${FOLDER_ID}#anchor`,
    FOLDER_ID,
    `  ${FOLDER_ID}  `,
  ])('accepts %s', (input) => {
    expect(extractDriveFolderId(input)).toBe(FOLDER_ID);
  });

  it.each([
    '',
    '   ',
    'not a url',
    'https://drive.google.com/drive/folders/',
    'https://drive.google.com/',
    'short',
    'x'.repeat(201),
  ])('rejects %s', (input) => {
    expect(extractDriveFolderId(input)).toBe('');
  });

  it('rejects an oversized paste', () => {
    expect(extractDriveFolderId('https://drive.google.com/drive/folders/' + 'a'.repeat(4000))).toBe('');
  });

  // H1 — these would break out of Drive's quoted `q` string server-side. The
  // frontend must not present them as valid.
  it.each([
    "abc'def'ghi'jkl",
    "1w-sEG7xKq2NpR4' or '1'='1",
    '1w-sEG7xKq2 NpR4vTzB9',
    '1w-sEG7xKq2&NpR4vTzB9',
    '1w-sEG7xKq2NpR4vTzB9%27',
  ])('rejects hostile id %s, bare and inside a url', (hostile) => {
    expect(extractDriveFolderId(hostile)).toBe('');
    expect(extractDriveFolderId(`https://drive.google.com/drive/folders/${hostile}`)).toBe('');
  });
});

describe('isCoaFolderInvalid', () => {
  it('treats blank as valid — blank means the feature is off, not a mistake', () => {
    expect(isCoaFolderInvalid('')).toBe(false);
    expect(isCoaFolderInvalid('   ')).toBe(false);
  });

  it('flags a non-blank paste that yields no folder id', () => {
    expect(isCoaFolderInvalid('https://example.com/whatever')).toBe(true);
    expect(isCoaFolderInvalid("abc'def'ghi'jkl")).toBe(true);
  });

  it('accepts a real folder link', () => {
    expect(isCoaFolderInvalid(`https://drive.google.com/drive/folders/${FOLDER_ID}`)).toBe(false);
  });
});
