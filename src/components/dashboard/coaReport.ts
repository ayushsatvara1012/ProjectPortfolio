/**
 * COA finder Phase 4 — the pure half of the owner's certificate-library panel.
 *
 * Separate from the component on purpose, and for the same reason Phase 3's panel
 * logic lives in `components/chat/panels.ts`: a file exporting both a component and
 * plain values drops out of Fast Refresh, and tests that mirror a component's logic
 * inside the test file keep passing once the component stops agreeing with them.
 *
 * The panel answers one question the owner cannot answer from Drive: *which of my
 * files will the search never find?* Same spirit as the near-miss warnings
 * `catalog_import.py` gives for a catalog upload.
 */

export type CoaDuplicate = { name: string; copies: number };

export type CoaReport = {
  indexed: number;
  folders: number;
  filesSeen: number;
  ignoredNonPdf: number;
  unindexable: number;
  duplicatesCollapsed: number;
  duplicateSamples: CoaDuplicate[];
  hardToFind: number;
  hardToFindSamples: string[];
  capped: string[];
  walkedAt: string | null;
  fromCache: boolean;
};

const num = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

export function parseCoaReport(raw: any): CoaReport | null {
  if (!raw || typeof raw !== 'object') return null;
  const dups = Array.isArray(raw.duplicate_samples) ? raw.duplicate_samples : [];
  const thin = Array.isArray(raw.hard_to_find_samples) ? raw.hard_to_find_samples : [];
  return {
    indexed: num(raw.indexed),
    folders: num(raw.folders),
    filesSeen: num(raw.files_seen),
    ignoredNonPdf: num(raw.ignored_non_pdf),
    unindexable: num(raw.unindexable),
    duplicatesCollapsed: num(raw.duplicates_collapsed),
    duplicateSamples: dups
      .filter((d: any) => d && typeof d.name === 'string' && num(d.copies) > 1)
      .map((d: any) => ({ name: d.name as string, copies: num(d.copies) })),
    hardToFind: num(raw.hard_to_find),
    hardToFindSamples: thin.filter((s: any) => typeof s === 'string' && s.trim() !== ''),
    capped: Array.isArray(raw.capped) ? raw.capped.filter((c: any) => typeof c === 'string') : [],
    walkedAt: typeof raw.walked_at === 'string' && raw.walked_at ? raw.walked_at : null,
    fromCache: raw.from_cache === true,
  };
}

export type CoaNoticeLevel = 'warn' | 'info';

export type CoaNotice = {
  key: string;
  level: CoaNoticeLevel;
  title: string;
  detail: string;
  samples?: string[];
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Everything worth telling the owner, most serious first.
 *
 * `warn` means a customer will fail to find a certificate that exists; `info` means
 * we handled something and they may want to know. The cap notice outranks all of it
 * because it is the only case where the *search itself* is serving partial results —
 * every other row is about specific files.
 */
export function coaNotices(report: CoaReport): CoaNotice[] {
  const out: CoaNotice[] = [];

  if (report.capped.length > 0) {
    out.push({
      key: 'capped',
      level: 'warn',
      title: 'Only part of this folder is indexed',
      detail:
        'This folder is bigger or deeper than we index in one pass, so some certificates ' +
        'are not searchable. Point the link at a folder holding just the certificates, ' +
        'or contact support so we can raise the limit for your account.',
    });
  }

  if (report.indexed === 0) {
    out.push({
      key: 'empty',
      level: 'warn',
      title: 'Nothing here is searchable yet',
      detail: report.filesSeen
        ? 'We can read the folder, but none of the files in it could be indexed as certificates.'
        : 'We can read the folder, but it is empty. If your certificates live in a Shared Drive, ' +
          'check the link points at the folder itself and that it is shared with "Anyone with the link".',
    });
  }

  if (report.unindexable > 0) {
    out.push({
      key: 'unindexable',
      level: 'warn',
      title: `${plural(report.unindexable, 'PDF', 'PDFs')} could not be indexed`,
      detail:
        'Their filenames contain nothing a customer could search for. Rename them to include ' +
        'the product code or batch number and they will be findable.',
    });
  }

  if (report.hardToFind > 0) {
    out.push({
      key: 'hard-to-find',
      level: 'warn',
      title: `${plural(report.hardToFind, 'certificate is', 'certificates are')} hard to find`,
      detail:
        'These filenames carry only one searchable word, so a customer has to type it exactly. ' +
        'Adding the batch number or product name to the filename fixes it.',
      samples: report.hardToFindSamples,
    });
  }

  if (report.duplicatesCollapsed > 0) {
    // The safety net for D6/H16. Collapsing identical filenames to one certificate is
    // right for a client filing one COA per batch and wrong for a client filing the
    // same name per customer — so this is shown, not silently decided.
    out.push({
      key: 'duplicates',
      level: 'info',
      title: `${plural(report.duplicatesCollapsed, 'duplicate copy', 'duplicate copies')} merged`,
      detail:
        'Files with the same name are treated as one certificate and the newest is served. ' +
        'That is right for the same certificate filed in two months, but if these are ' +
        'different documents that happen to share a name, tell us — customers would only see one.',
      samples: report.duplicateSamples.map((d) => `${d.name} (${d.copies} copies)`),
    });
  }

  if (report.ignoredNonPdf > 0) {
    out.push({
      key: 'non-pdf',
      level: 'info',
      title: `${plural(report.ignoredNonPdf, 'file', 'files')} skipped`,
      detail: 'Only PDFs are indexed. Anything else in the folder is ignored and never shown to customers.',
    });
  }

  return out;
}

/**
 * How old the answer is, at minute granularity.
 *
 * The listing's TTL is ten minutes, so a day-granularity helper (the widget's
 * `formatRelativeDate`) would label every possible value "Today" and tell the owner
 * nothing. An unparseable or future timestamp reads as "just now" rather than
 * rendering "NaN minutes ago".
 */
export function formatWalkAge(iso: string | null, now: number = Date.now()): string {
  if (!iso) return 'unknown';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return 'unknown';
  const mins = Math.floor((now - then) / 60_000);
  if (mins <= 0) return 'just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}
