/**
 * The generated Google Apps Script sink (SampleFormEditor.buildAppsScript).
 *
 * The script is the artifact an owner pastes into their own spreadsheet, so these
 * tests EXECUTE it against a fake Sheets API rather than string-matching it. The
 * regression that drove it: the sink payload carries only the fields a visitor
 * actually filled (empties are dropped in sanitize_visitor_fields), so the old
 * template's positional `Object.values(fields)` write shifted every column left
 * whenever an optional field was blank — a phone number landing under Address.
 */
import { describe, it, expect } from 'vitest';
import { buildAppsScript, buildColumnPlan } from '@/src/components/dashboard/SampleFormEditor';
import type { SampleFormField } from '@/src/lib/context/BotSettingsContext';

const field = (name: string, label: string, required = false): SampleFormField =>
  ({ name, label, type: 'text', required });

const FORM: SampleFormField[] = [
  field('product', 'Product', true),
  field('quantity', 'Quantity (units)', true),
  field('contact_name', 'Full name', true),
  field('contact_phone', 'Phone'),
  field('notes', 'Additional notes'),
];

// ── A fake of just enough of the Sheets API for the script to run against ──

type Sheet = ReturnType<typeof makeSheet>;

function makeSheet() {
  const rows: any[][] = [];
  const range = (r: number, c: number, numRows: number, numCols: number) => ({
    getValues: () => {
      const out: any[][] = [];
      for (let i = 0; i < numRows; i++) {
        const row = rows[r - 1 + i] || [];
        const slice: any[] = [];
        for (let j = 0; j < numCols; j++) slice.push(row[c - 1 + j] ?? '');
        out.push(slice);
      }
      return out;
    },
    setValues: (values: any[][]) => {
      values.forEach((v, i) => { rows[r - 1 + i] = v.slice(); });
      return { setFontWeight: () => undefined };
    },
  });
  return {
    rows,
    getLastRow: () => rows.length,
    getLastColumn: () => rows.reduce((m, r) => Math.max(m, r.length), 0),
    getRange: range,
    setFrozenRows: () => undefined,
    appendRow: (row: any[]) => { rows.push(row.slice()); },
  };
}

/** Load the generated script and hand back its doPost plus the fake spreadsheet. */
function loadScript(fields: SampleFormField[] = FORM) {
  const tabs: Record<string, Sheet> = {};
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
      getSheetByName: (name: string) => tabs[name] || null,
      insertSheet: (name: string) => (tabs[name] = makeSheet()),
    }),
  };
  const LockService = {
    getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }),
  };
  const ContentService = {
    createTextOutput: (text: string) => ({ setMimeType: () => text }),
    MimeType: { JSON: 'json', TEXT: 'text' },
  };

  const factory = new Function(
    'SpreadsheetApp', 'LockService', 'ContentService',
    `${buildAppsScript(fields)}\nreturn doPost;`,
  );
  const doPost = factory(SpreadsheetApp, LockService, ContentService);

  const submit = (body: Record<string, any>) =>
    doPost({ postData: { contents: JSON.stringify(body) } });

  return { submit, tabs, sheet: () => tabs['Sample requests'] };
}

const submission = (fields: Record<string, string>, extra: Record<string, any> = {}) => ({
  event: 'sample_request',
  submitted_at: '2026-08-30T10:00:00+00:00',
  idempotency_key: 'idem-1',
  fields,
  ...extra,
});

// ── the column plan ──────────────────────────────────────────────────────────

describe('buildColumnPlan', () => {
  it('leads with the timestamp, keeps the form in dashboard order, trails the meta', () => {
    expect(buildColumnPlan(FORM).map(([, heading]) => heading)).toEqual([
      'Submitted', 'Product', 'Quantity (units)', 'Full name', 'Phone',
      'Additional notes', 'Request ID', 'Test',
    ]);
  });

  it('uses the owner label as the heading and the slug as the key', () => {
    const plan = buildColumnPlan([field('Quantity (units)', 'Quantity (units)')]);
    expect(plan).toContainEqual(['quantity_units', 'Quantity (units)']);
  });

  it('falls back to a readable heading when a field has no label', () => {
    expect(buildColumnPlan([field('delivery_site', '')])).toContainEqual(
      ['delivery_site', 'Delivery site'],
    );
  });

  it('disambiguates two fields that share a label', () => {
    // Distinct keys, same label: the script matches a column BY HEADING, so
    // leaving both as "Notes" would silently merge them into one column.
    const plan = buildColumnPlan([field('notes', 'Notes'), field('internal_notes', 'Notes')]);
    expect(plan).toContainEqual(['notes', 'Notes']);
    expect(plan).toContainEqual(['internal_notes', 'Notes (internal_notes)']);
  });

  it('lets an owner field own a key the meta columns also use', () => {
    const plan = buildColumnPlan([field('test', 'Test batch?')]);
    expect(plan.filter(([key]) => key === 'test')).toEqual([['test', 'Test batch?']]);
  });

  it('invents no column the form did not ask for beyond the three meta ones', () => {
    // A pack's hidden prefill (chemical's cas_number) must NOT be baked in here —
    // that would put a dead column in every non-chemical client's sheet.
    expect(buildColumnPlan([field('fabric_type', 'Fabric type')])).toEqual([
      ['submitted_at', 'Submitted'],
      ['fabric_type', 'Fabric type'],
      ['idempotency_key', 'Request ID'],
      ['test', 'Test'],
    ]);
  });

  it('drops a field whose name cannot yield a key', () => {
    expect(buildColumnPlan([field('***', '***')]).map(([key]) => key)).not.toContain('');
  });

  it('survives a missing or malformed field list', () => {
    expect(buildColumnPlan([]).length).toBe(3);
    // @ts-expect-error guard non-array
    expect(buildColumnPlan(undefined).length).toBe(3);
  });
});

// ── the script, executed ─────────────────────────────────────────────────────

describe('the generated script', () => {
  it('is syntactically valid JavaScript', () => {
    expect(() => new Function(buildAppsScript(FORM))).not.toThrow();
  });

  it('creates the tab and lays out every configured column up front', () => {
    const { submit, sheet } = loadScript();
    submit(submission({ product: 'Acetone' }));
    expect(sheet().rows[0]).toEqual([
      'Submitted', 'Product', 'Quantity (units)', 'Full name', 'Phone',
      'Additional notes', 'Request ID', 'Test',
    ]);
  });

  it('keeps a blank optional field as a blank CELL instead of shifting the row', () => {
    // The regression. `fields` omits contact_phone entirely; "call me" must still
    // land under Additional notes, not under Phone.
    const { submit, sheet } = loadScript();
    submit(submission({
      product: 'Acetone', quantity: '2', contact_name: 'Asha', notes: 'call me',
    }));
    const [headers, row] = sheet().rows;
    expect(row[headers.indexOf('Phone')]).toBe('');
    expect(row[headers.indexOf('Additional notes')]).toBe('call me');
    expect(row[headers.indexOf('Full name')]).toBe('Asha');
    expect(row[headers.indexOf('Submitted')]).toBe('2026-08-30T10:00:00+00:00');
  });

  it('holds each value under its own heading across differently-shaped submissions', () => {
    const { submit, sheet } = loadScript();
    submit(submission({ product: 'Acetone', contact_phone: '+911', notes: 'first' }));
    submit(submission({ product: 'Toluene', notes: 'second' }, { idempotency_key: 'idem-2' }));
    const [headers, first, second] = sheet().rows;
    const at = (row: any[], heading: string) => row[headers.indexOf(heading)];
    expect([at(first, 'Phone'), at(first, 'Additional notes')]).toEqual(['+911', 'first']);
    expect([at(second, 'Phone'), at(second, 'Additional notes')]).toEqual(['', 'second']);
  });

  it('adds a column for a field the owner added after pasting, leaving the rest put', () => {
    const { submit, sheet } = loadScript();
    submit(submission({ product: 'Acetone' }));
    const before = sheet().rows[0].slice();

    submit(submission({ product: 'Toluene', delivery_site: 'Pune' },
                      { idempotency_key: 'idem-2' }));
    const headers = sheet().rows[0];
    expect(headers.slice(0, before.length)).toEqual(before);   // nothing moved
    expect(headers[headers.length - 1]).toBe('Delivery site'); // appended, readable
    expect(sheet().rows[2][headers.indexOf('Delivery site')]).toBe('Pune');
    expect(sheet().rows[1][headers.indexOf('Product')]).toBe('Acetone');
  });

  it('grows a column for a pack prefill key the form never declared', () => {
    // cas_number reaches the sink for a chemical bot without being a form field.
    // It is not hardcoded anywhere, so it arrives through the same self-heal path.
    const { submit, sheet } = loadScript();
    submit(submission({ product: 'Acetone', cas_number: '67-64-1' }));
    const [headers, row] = sheet().rows;
    expect(headers[headers.length - 1]).toBe('Cas number');
    expect(row[headers.indexOf('Cas number')]).toBe('67-64-1');
  });

  it('marks a dashboard test row so it never reads as a real lead', () => {
    const { submit, sheet } = loadScript();
    submit({ event: 'sample_request_test', submitted_at: '2026-08-30T10:00:00+00:00',
             test: true, fields: { product: 'Test row' } });
    const [headers, row] = sheet().rows;
    expect(row[headers.indexOf('Test')]).toBe('TEST');
  });

  it('leaves the Test column blank for a real submission', () => {
    const { submit, sheet } = loadScript();
    submit(submission({ product: 'Acetone' }));
    const [headers, row] = sheet().rows;
    expect(row[headers.indexOf('Test')]).toBe('');
  });

  it('records the request id and refuses to write the same one twice', () => {
    const { submit, sheet } = loadScript();
    submit(submission({ product: 'Acetone' }));
    submit(submission({ product: 'Acetone' }));           // same idempotency_key
    const [headers, row] = sheet().rows;
    expect(row[headers.indexOf('Request ID')]).toBe('idem-1');
    expect(sheet().rows.length).toBe(2);                  // header + one row
  });

  it('still writes a submission that carries no request id', () => {
    const { submit, sheet } = loadScript();
    submit(submission({ product: 'Acetone' }, { idempotency_key: '' }));
    submit(submission({ product: 'Toluene' }, { idempotency_key: '' }));
    expect(sheet().rows.length).toBe(3);
  });

  it('writes to its own tab, not whichever sheet happens to be active', () => {
    const { submit, tabs } = loadScript();
    submit(submission({ product: 'Acetone' }));
    expect(Object.keys(tabs)).toEqual(['Sample requests']);
  });

  it('escapes an owner label that contains quotes', () => {
    const { submit, sheet } = loadScript([field('grade', 'Grade ("purity")')]);
    submit(submission({ grade: 'AR' }));
    const [headers, row] = sheet().rows;
    expect(headers).toContain('Grade ("purity")');
    expect(row[headers.indexOf('Grade ("purity")')]).toBe('AR');
  });
});
