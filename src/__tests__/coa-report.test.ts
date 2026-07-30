/**
 * COA finder Phase 4 — the owner's certificate-library panel.
 *
 * Imports the real helpers out of components/dashboard/coaReport.ts rather than
 * mirroring them, for the reason the Phase 3 panel tests give: a mirrored copy keeps
 * passing after the component stops agreeing with it.
 *
 * The panel exists because the owner cannot otherwise see which of their own files
 * the search will never find, so what is asserted here is that each blind spot
 * produces a distinct, actionable message — and, above all, that a folder with
 * problems never renders as healthy.
 */
import { describe, it, expect } from 'vitest';

import {
  CoaReport,
  coaNotices,
  formatWalkAge,
  parseCoaReport,
} from '@/src/components/dashboard/coaReport';

const RAW = {
  status: 'ok',
  from_cache: true,
  indexed: 1781,
  folders: 8,
  files_seen: 2240,
  ignored_non_pdf: 2,
  unindexable: 0,
  duplicates_collapsed: 457,
  duplicate_samples: [{ name: '100MC3_100.26P001_ACETONE USP-NF PH.EUR BP.pdf', copies: 2 }],
  hard_to_find: 1,
  hard_to_find_samples: ['129LR'],
  capped: [],
  walked_at: '2026-07-29T10:00:00.000Z',
};

const report = (over: Partial<CoaReport> = {}): CoaReport => ({
  ...(parseCoaReport(RAW) as CoaReport),
  ...over,
});

const keys = (r: CoaReport) => coaNotices(r).map((n) => n.key);

describe('parseCoaReport', () => {
  it('reads the real payload the endpoint sends', () => {
    // The client's measured folder: 2,240 files, 1,781 certificates, 457 copies merged.
    const parsed = parseCoaReport(RAW)!;
    expect(parsed.indexed).toBe(1781);
    expect(parsed.filesSeen).toBe(2240);
    expect(parsed.duplicatesCollapsed).toBe(457);
    expect(parsed.duplicateSamples).toEqual([
      { name: '100MC3_100.26P001_ACETONE USP-NF PH.EUR BP.pdf', copies: 2 },
    ]);
    expect(parsed.hardToFindSamples).toEqual(['129LR']);
    expect(parsed.fromCache).toBe(true);
  });

  it('is null for a non-object, so a failed fetch cannot render as an empty library', () => {
    expect(parseCoaReport(null)).toBeNull();
    expect(parseCoaReport('nope')).toBeNull();
    expect(parseCoaReport(undefined)).toBeNull();
  });

  it('coerces a payload with everything missing to zeros rather than NaN', () => {
    const parsed = parseCoaReport({})!;
    expect(parsed.indexed).toBe(0);
    expect(parsed.duplicateSamples).toEqual([]);
    expect(parsed.capped).toEqual([]);
    expect(parsed.walkedAt).toBeNull();
  });

  it('drops junk sample entries instead of rendering blanks', () => {
    const parsed = parseCoaReport({
      duplicate_samples: [{ name: 'ok.pdf', copies: 2 }, { name: 'once.pdf', copies: 1 }, null, 3],
      hard_to_find_samples: ['129LR', '', null, 7],
    })!;
    expect(parsed.duplicateSamples).toEqual([{ name: 'ok.pdf', copies: 2 }]);
    expect(parsed.hardToFindSamples).toEqual(['129LR']);
  });
});

describe('coaNotices — the owner is told what the search cannot find', () => {
  it('says nothing to fix for a clean folder', () => {
    expect(
      coaNotices(report({
        indexed: 12, filesSeen: 12, ignoredNonPdf: 0, unindexable: 0,
        duplicatesCollapsed: 0, duplicateSamples: [], hardToFind: 0, hardToFindSamples: [],
      })),
    ).toEqual([]);
  });

  it('puts the partial-index warning first, because it is the only one about the search itself', () => {
    // Every other notice is about specific files. A cap means the walk served
    // partial results, so certificates that exist are simply not in the index.
    const notices = coaNotices(report({ capped: ['files'], unindexable: 3, hardToFind: 2 }));
    expect(notices[0].key).toBe('capped');
    expect(notices[0].level).toBe('warn');
  });

  it('reports duplicates as the H16 safety net, and asks rather than assumes', () => {
    const notice = coaNotices(report()).find((n) => n.key === 'duplicates')!;
    expect(notice.title).toContain('457');
    // D6 is an assumption about this client, not a law — the copy has to invite a
    // correction, because a client filing repeated names per customer loses documents.
    expect(notice.detail.toLowerCase()).toContain('different documents');
    expect(notice.samples).toEqual([
      '100MC3_100.26P001_ACETONE USP-NF PH.EUR BP.pdf (2 copies)',
    ]);
  });

  it('does not mention duplicates when nothing was merged', () => {
    expect(keys(report({ duplicatesCollapsed: 0, duplicateSamples: [] }))).not.toContain('duplicates');
  });

  it('flags a hard-to-find certificate with the filenames to fix', () => {
    const notice = coaNotices(report())!.find((n) => n.key === 'hard-to-find')!;
    expect(notice.level).toBe('warn');
    expect(notice.samples).toEqual(['129LR']);
  });

  it('tells the owner unindexable PDFs are a filename problem, not a sharing problem', () => {
    const notice = coaNotices(report({ unindexable: 4 }))!.find((n) => n.key === 'unindexable')!;
    expect(notice.title).toContain('4 PDFs');
    expect(notice.detail.toLowerCase()).toContain('rename');
  });

  it('distinguishes an empty folder from a folder of unusable files (H2)', () => {
    // A Shared Drive read without the allDrives flags returns zero files with HTTP
    // 200, so "we read it and it is empty" has to point at the sharing setting.
    const empty = coaNotices(report({ indexed: 0, filesSeen: 0 })).find((n) => n.key === 'empty')!;
    const unusable = coaNotices(report({ indexed: 0, filesSeen: 40 })).find((n) => n.key === 'empty')!;
    expect(empty.detail.toLowerCase()).toContain('shared drive');
    expect(unusable.detail).not.toEqual(empty.detail);
  });

  it('never reports an empty library as healthy', () => {
    expect(keys(report({ indexed: 0, filesSeen: 0, duplicatesCollapsed: 0, hardToFind: 0 })))
      .toContain('empty');
  });

  it('singular and plural read correctly, since these numbers are usually 1', () => {
    const one = coaNotices(report({ unindexable: 1, duplicatesCollapsed: 1, hardToFind: 1 }));
    const titles = one.map((n) => n.title).join(' | ');
    expect(titles).toContain('1 PDF could not');
    expect(titles).toContain('1 certificate is hard to find');
    expect(titles).toContain('1 duplicate copy merged');
  });

  it('marks handled things as info and unfindable things as warnings', () => {
    const levels = Object.fromEntries(
      coaNotices(report({ unindexable: 2, ignoredNonPdf: 2 })).map((n) => [n.key, n.level]),
    );
    expect(levels['unindexable']).toBe('warn');
    expect(levels['hard-to-find']).toBe('warn');
    expect(levels['duplicates']).toBe('info');
    expect(levels['non-pdf']).toBe('info');
  });
});

describe('formatWalkAge — the age of the answer, at minute granularity', () => {
  const now = new Date('2026-07-29T12:00:00.000Z').getTime();
  const at = (iso: string) => formatWalkAge(iso, now);

  it('resolves inside the ten-minute cache TTL, which a day-granularity helper cannot', () => {
    // The widget's formatRelativeDate would label every one of these "Today".
    expect(at('2026-07-29T11:59:30.000Z')).toBe('just now');
    expect(at('2026-07-29T11:59:00.000Z')).toBe('1 minute ago');
    expect(at('2026-07-29T11:52:00.000Z')).toBe('8 minutes ago');
  });

  it('scales up to hours and days', () => {
    expect(at('2026-07-29T11:00:00.000Z')).toBe('1 hour ago');
    expect(at('2026-07-29T04:00:00.000Z')).toBe('8 hours ago');
    expect(at('2026-07-28T12:00:00.000Z')).toBe('1 day ago');
    expect(at('2026-07-26T12:00:00.000Z')).toBe('3 days ago');
  });

  it('never renders NaN for a missing, junk, or future timestamp', () => {
    expect(formatWalkAge(null, now)).toBe('unknown');
    expect(at('not a date')).toBe('unknown');
    expect(at('2026-07-29T12:05:00.000Z')).toBe('just now');
  });
});
