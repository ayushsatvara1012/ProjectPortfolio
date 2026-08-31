'use client';

// Phase 5 (customise) — per-client editor for the chemical agent's sample-request
// FORM. Every client's form differs (one needs "application", another "delivery
// site"), and each client's submissions land in THEIR own sheet — so this edits the
// field list + the data destination, persisted as companies.pack_overrides and
// merged over the pack default at runtime. Only mounted for a vertical (pack) bot.

import React, { useMemo, useState } from 'react';
import type { SampleFormField } from '@/src/lib/context/BotSettingsContext';

// The only columns that aren't the owner's own fields. These three are transport
// metadata every sink payload carries whatever the vertical — a timestamp, the
// dedupe key and the test-row marker — so they are not vertical logic. Anything a
// PACK sends that the form doesn't declare (the chemical `cas_number` prefill, say)
// is deliberately NOT listed: hardcoding it would put a dead column in the sheet of
// every client whose bot never sends it. Those keys self-heal into a column the
// first time one actually arrives.
const LEADING_COLUMNS: [string, string][] = [['submitted_at', 'Submitted']];
const TRAILING_COLUMNS: [string, string][] = [
  ['idempotency_key', 'Request ID'],
  ['test', 'Test'],
];

/** JS string literal for generated code — labels are owner text and may hold quotes. */
const lit = (value: string): string => JSON.stringify(value);

/**
 * The [key, heading] column plan the generated script pins, in sheet order.
 *
 * Deduped by key (a form field named `cas_number` must not also get the meta one)
 * and then by heading, because two fields may carry distinct keys under the same
 * label and a heading is what the script matches a column on — colliding headings
 * would silently write both values into one column.
 */
export function buildColumnPlan(fields: SampleFormField[]): [string, string][] {
  const formColumns: [string, string][] = (Array.isArray(fields) ? fields : []).map((f) => {
    const key = slugifyFieldName(f?.name || f?.label || '');
    const label = (f?.label || '').trim();
    return [key, label || key.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())] as [string, string];
  }).filter(([key]) => key);

  const plan: [string, string][] = [];
  const keys = new Set<string>();
  const headings = new Set<string>();
  for (const [key, heading] of [...LEADING_COLUMNS, ...formColumns, ...TRAILING_COLUMNS]) {
    if (keys.has(key)) continue;
    keys.add(key);
    let unique = heading;
    if (headings.has(unique)) unique = `${heading} (${key})`;
    headings.add(unique);
    plan.push([key, unique]);
  }
  return plan;
}

/**
 * The copy-paste Apps Script, generated from THIS bot's sample form.
 *
 * Pinning the columns is what makes the sheet trustworthy: the sink's payload
 * carries only the fields a visitor actually filled (empties are dropped server-side
 * in sanitize_visitor_fields), so writing values positionally shifted every column
 * left whenever an optional field was blank. Here each value is placed under its own
 * heading, and a key the sheet has never seen appends a column on the right — so a
 * field added in the dashboard later shows up without the owner re-pasting anything.
 */
export function buildAppsScript(fields: SampleFormField[]): string {
  const plan = buildColumnPlan(fields);
  const rows = plan.map(([key, heading]) => `  [${lit(key)}, ${lit(heading)}]`).join(',\n');
  return `/**
 * Sapybase sample requests -> this spreadsheet.
 * Generated from your form. Paste over EVERYTHING in Code.gs, then:
 *   Deploy -> New deployment -> Web app
 *   Execute as: Me   |   Who has access: Anyone
 * and put the /exec URL into Sapybase's "Data destination".
 *
 * Add a field in Sapybase later and a column appears here automatically -
 * you only need to re-paste this if you want the new column's exact heading.
 */
var TAB_NAME = 'Sample requests';

// Your form, in dashboard order: [payload key, column heading].
var COLUMNS = [
${rows}
];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);  // two submissions at once must not each add a header
  try {
    var data = JSON.parse(e.postData.contents);
    var fields = data.fields || {};
    var row = {
      submitted_at: data.submitted_at || new Date().toISOString(),
      idempotency_key: data.idempotency_key || '',
      test: data.test ? 'TEST' : ''
    };
    for (var key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) row[key] = fields[key];
    }

    var sheet = getSheet_();
    if (!isDuplicate_(sheet, row.idempotency_key)) writeRow_(sheet, row);
    return ok_();
  } catch (err) {
    return ContentService.createTextOutput('error: ' + err).setMimeType(ContentService.MimeType.TEXT);
  } finally {
    lock.releaseLock();
  }
}

/** The destination tab, created on first use so a brand-new sheet just works. */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(TAB_NAME) || ss.insertSheet(TAB_NAME);
}

/** Row 1 as it stands. Empty on a fresh tab. */
function readHeaders_(sheet) {
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() === 0) return [];
  return sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim(); });
}

/** The heading for a key: yours if the form declares it, else the key made readable. */
function heading_(key) {
  for (var i = 0; i < COLUMNS.length; i++) {
    if (COLUMNS[i][0] === key) return COLUMNS[i][1];
  }
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

/** Known columns first, in your form's order; anything unrecognised after them. */
function orderedKeys_(row) {
  var keys = [], seen = {};
  for (var i = 0; i < COLUMNS.length; i++) {
    var key = COLUMNS[i][0];
    if (Object.prototype.hasOwnProperty.call(row, key)) { keys.push(key); seen[key] = true; }
  }
  for (var other in row) {
    if (Object.prototype.hasOwnProperty.call(row, other) && !seen[other]) keys.push(other);
  }
  return keys;
}

/**
 * Append one submission, every value under its own heading.
 *
 * A fresh tab is laid out with your whole form up front, so the columns match the
 * dashboard even when the first submission leaves optional fields blank. After
 * that row 1 is the authority: an unknown key adds a column on the right and
 * existing columns never move.
 */
function writeRow_(sheet, row) {
  var headers = readHeaders_(sheet);
  if (headers.length === 0) {
    for (var i = 0; i < COLUMNS.length; i++) headers.push(COLUMNS[i][1]);
  }
  var keys = orderedKeys_(row);
  for (var j = 0; j < keys.length; j++) {
    if (headers.indexOf(heading_(keys[j])) === -1) headers.push(heading_(keys[j]));
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
  sheet.setFrozenRows(1);

  var out = [];
  for (var c = 0; c < headers.length; c++) out.push('');
  for (var k = 0; k < keys.length; k++) {
    out[headers.indexOf(heading_(keys[k]))] = row[keys[k]];
  }
  sheet.appendRow(out);
}

/** Skip a request id already in the sheet. Recent rows only - this stays fast. */
function isDuplicate_(sheet, requestId) {
  if (!requestId) return false;
  var headers = readHeaders_(sheet);
  var col = headers.indexOf(heading_('idempotency_key')) + 1;
  if (col === 0 || sheet.getLastRow() < 2) return false;
  var first = Math.max(2, sheet.getLastRow() - 199);
  var seen = sheet.getRange(first, col, sheet.getLastRow() - first + 1, 1).getValues();
  for (var i = 0; i < seen.length; i++) {
    if (String(seen[i][0]) === String(requestId)) return true;
  }
  return false;
}

function ok_() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}`;
}

// Mirrors packs/overrides.ALLOWED_FIELD_TYPES (the server is the source of truth;
// this is the friendly UI label for each).
export const FIELD_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'email', label: 'Email' },
  { value: 'tel', label: 'Phone' },
  { value: 'number', label: 'Number' },
  { value: 'product', label: 'Product (catalog picker)' },
  { value: 'grade', label: 'Grade (from product)' },
];
const VALID_TYPES = new Set(FIELD_TYPE_OPTIONS.map((o) => o.value));

/** Mirror of backend `_slug_name`: a safe submission key. Empty if unusable. */
export function slugifyFieldName(value: string): string {
  if (typeof value !== 'string') return '';
  const out: string[] = [];
  for (const ch of value.trim().toLowerCase()) {
    if (/[a-z0-9]/.test(ch)) out.push(ch);
    else if (ch === ' ' || ch === '-' || ch === '_') out.push('_');
  }
  return out.join('').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 64);
}

export interface FormValidation {
  valid: boolean;
  duplicateNames: string[];   // keys used by more than one field
  emptyKeyRows: number[];     // indices whose key didn't slugify to anything
}

/** Pure validation mirrored from the backend sanitiser — drives inline UI + save gate. */
export function validateSampleForm(fields: SampleFormField[]): FormValidation {
  const seen = new Map<string, number>();
  const duplicateNames = new Set<string>();
  const emptyKeyRows: number[] = [];
  (Array.isArray(fields) ? fields : []).forEach((f, i) => {
    const key = slugifyFieldName(f?.name || '');
    if (!key) { emptyKeyRows.push(i); return; }
    if (seen.has(key)) duplicateNames.add(key);
    else seen.set(key, i);
  });
  return {
    valid: duplicateNames.size === 0 && emptyKeyRows.length === 0,
    duplicateNames: [...duplicateNames],
    emptyKeyRows,
  };
}

const inputCls = 'w-full text-sm font-google px-3 py-2 bg-slate-100 dark:bg-slate-800 focus:bg-slate-200 dark:focus:bg-slate-700 focus:outline-none text-slate-900 dark:text-slate-200 transition-colors rounded-lg';

type SinkStatus = { ok: boolean; detail?: string; at?: string } | null;

interface Props {
  fields: SampleFormField[];
  onChange: (fields: SampleFormField[]) => void;
  sinkUrl: string;
  onSinkUrlChange: (v: string) => void;
  sinkSecret: string;
  onSinkSecretChange: (v: string) => void;
  // Phase 3.4 sink onboarding — optional so non-vertical callers can omit them.
  botId?: string;
  authFetch?: (url: string, init?: RequestInit) => Promise<any>;
  sinkStatus?: SinkStatus;
}

function fmtWhen(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const SampleFormEditor = ({ fields, onChange, sinkUrl, onSinkUrlChange, sinkSecret, onSinkSecretChange, botId, authFetch, sinkStatus }: Props) => {
  const validation = validateSampleForm(fields);
  const sinkUrlInvalid = sinkUrl.trim() !== '' && !sinkUrl.trim().toLowerCase().startsWith('https://');

  // "Send test row" state. `result` overrides the persisted `sinkStatus` once the
  // owner runs a fresh test this session.
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<SinkStatus>(null);
  const [showTemplate, setShowTemplate] = useState(false);
  const [copied, setCopied] = useState(false);
  // Regenerated as the owner edits, so the script they copy always carries the
  // columns they are looking at.
  const appsScript = useMemo(() => buildAppsScript(fields), [fields]);
  const status = result ?? sinkStatus ?? null;

  const sendTestRow = async () => {
    if (!botId || !authFetch) return;
    setTesting(true);
    setResult(null);
    try {
      const res = await authFetch(`/api/companies/${botId}/sample-sink/test`, { method: 'POST' });
      setResult({ ok: !!res?.ok, detail: res?.detail, at: res?.at });
    } catch (e: any) {
      const msg = e?.body?.detail?.message || e?.message || 'Test failed — check the URL and try again.';
      setResult({ ok: false, detail: msg });
    } finally {
      setTesting(false);
    }
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(appsScript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable — no-op */ }
  };

  const update = (idx: number, patch: Partial<SampleFormField>) => {
    const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onChange(next);
  };
  const setLabel = (idx: number, label: string) => {
    const f = fields[idx];
    // Auto-derive the key from the label until the user has hand-edited the key.
    const keyWasAuto = !f.name || f.name === slugifyFieldName(f.label || '');
    update(idx, keyWasAuto ? { label, name: slugifyFieldName(label) } : { label });
  };
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange(next);
  };
  const remove = (idx: number) => onChange(fields.filter((_, i) => i !== idx));
  const add = () => onChange([...fields, { name: '', label: '', type: 'text', required: false, placeholder: '' }]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {fields.length === 0 && (
          <p className="text-xs font-google text-slate-400 dark:text-slate-500 italic">
            No fields yet — add the fields your sample-request form should collect.
          </p>
        )}
        {fields.map((f, idx) => {
          const key = slugifyFieldName(f.name || '');
          const dupe = key && validation.duplicateNames.includes(key);
          const emptyKey = validation.emptyKeyRows.includes(idx);
          const safeType = VALID_TYPES.has(f.type) ? f.type : 'text';
          return (
            <div key={idx} className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 pt-1.5 shrink-0">
                  <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0}
                    aria-label="Move field up"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[16px] leading-none">keyboard_arrow_up</span>
                  </button>
                  <button type="button" onClick={() => move(idx, 1)} disabled={idx === fields.length - 1}
                    aria-label="Move field down"
                    className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-25 disabled:cursor-not-allowed">
                    <span className="material-symbols-outlined text-[16px] leading-none">keyboard_arrow_down</span>
                  </button>
                </div>
                {/* Label + key */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input
                    type="text"
                    value={f.label}
                    onChange={(e) => setLabel(idx, e.target.value)}
                    placeholder="Field label (e.g. Delivery address)"
                    className={inputCls}
                    aria-label={`Field ${idx + 1} label`}
                  />
                  <div className="flex items-center gap-1.5 pl-0.5">
                    <span className="text-[10.5px] font-google text-slate-400 dark:text-slate-500 shrink-0">key</span>
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => update(idx, { name: slugifyFieldName(e.target.value) })}
                      placeholder="auto"
                      className={`text-[11px] font-mono px-1.5 py-0.5 rounded bg-transparent border ${emptyKey || dupe ? 'border-red-400 text-red-600 dark:text-red-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'} focus:outline-none w-40`}
                      aria-label={`Field ${idx + 1} key`}
                    />
                    {dupe && <span className="text-[10.5px] text-red-500 dark:text-red-400">duplicate key</span>}
                    {emptyKey && <span className="text-[10.5px] text-red-500 dark:text-red-400">needs a key</span>}
                  </div>
                </div>
                {/* Delete */}
                <button type="button" onClick={() => remove(idx)} aria-label="Remove field"
                  className="p-1.5 text-slate-400 hover:text-red-500 transition-colors shrink-0 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                  <span className="material-symbols-outlined text-[16px]">delete</span>
                </button>
              </div>
              {/* Type + required */}
              <div className="flex items-center gap-2 pl-6">
                <div className="relative">
                  <select
                    value={safeType}
                    onChange={(e) => update(idx, { type: e.target.value })}
                    aria-label={`Field ${idx + 1} type`}
                    className="appearance-none cursor-pointer rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 pl-2.5 pr-7 py-1.5 text-[12px] font-google text-slate-700 dark:text-slate-200 focus:outline-none"
                  >
                    {FIELD_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <span className="material-symbols-outlined absolute right-1.5 top-1/2 -translate-y-1/2 text-[15px] text-slate-400 pointer-events-none">expand_more</span>
                </div>
                <label className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!f.required}
                    onChange={(e) => update(idx, { required: e.target.checked })}
                    className="w-3.5 h-3.5 accent-slate-900 dark:accent-blue-500"
                  />
                  <span className="text-[12px] font-google text-slate-600 dark:text-slate-300">Required</span>
                </label>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={add}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium font-google bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]">add</span>
        Add field
      </button>

      {/* ── Data destination ── */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
        <p className="text-xs font-semibold font-google text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px] text-slate-400">table_view</span>
          Data destination
        </p>
        <p className="text-[11.5px] font-google text-slate-400 dark:text-slate-500 leading-relaxed">
          Each submission is pushed to this webhook (your Google Apps Script / Zapier / Power Automate) so it lands in your own sheet. Leave blank to keep submissions in your dashboard only.
        </p>
        <div>
          <input
            type="url"
            value={sinkUrl}
            onChange={(e) => onSinkUrlChange(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            className={inputCls + (sinkUrlInvalid ? ' ring-1 ring-red-400 dark:ring-red-500' : '')}
            aria-label="Sample data destination webhook URL"
            spellCheck={false}
          />
          {sinkUrlInvalid && (
            <p className="text-[11px] font-google text-red-500 dark:text-red-400 mt-1">Must be a secure link (starts with https://).</p>
          )}
        </div>
        <input
          type="text"
          value={sinkSecret}
          onChange={(e) => onSinkSecretChange(e.target.value)}
          placeholder="Signing secret (optional) — verifies the request is from us"
          className={inputCls}
          aria-label="Sample data destination signing secret"
          spellCheck={false}
          autoComplete="off"
        />

        {/* Test + status (Phase 3.4). Tests the SAVED sink, so nudge a save first. */}
        {botId && authFetch && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={sendTestRow}
              disabled={testing}
              className="inline-flex items-center gap-1.5 text-[12px] font-google font-medium px-2.5 py-1.5 rounded-lg bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 disabled:opacity-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[15px]">{testing ? 'progress_activity' : 'send'}</span>
              {testing ? 'Sending…' : 'Send test row'}
            </button>
            {status && (
              <span
                className={
                  'inline-flex items-center gap-1 text-[11.5px] font-google ' +
                  (status.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400')
                }
              >
                <span className="material-symbols-outlined text-[14px]">{status.ok ? 'check_circle' : 'error'}</span>
                {status.ok ? 'Delivered' : 'Failed'}
                {status.detail ? ` · ${status.detail}` : ''}
                {status.at ? ` · ${fmtWhen(status.at)}` : ''}
              </span>
            )}
            <span className="text-[11px] font-google text-slate-400 dark:text-slate-500">Save your changes before testing.</span>
          </div>
        )}

        {/* Google Apps Script starter — the error-prone part of onboarding. */}
        <div>
          <button
            type="button"
            onClick={() => setShowTemplate((v) => !v)}
            className="inline-flex items-center gap-1 text-[11.5px] font-google font-medium text-blue-600 dark:text-blue-400 hover:underline"
          >
            <span className="material-symbols-outlined text-[14px]">{showTemplate ? 'expand_less' : 'code'}</span>
            {showTemplate ? 'Hide' : 'Show'} Google Apps Script for these columns
          </button>
          {showTemplate && (
            <div className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-[11px] font-google text-slate-500 dark:text-slate-400">
                <span>Replace everything in Code.gs → Deploy as Web app (Execute as Me, access Anyone). Your sheet gets a “Sample requests” tab with these columns.</span>
                <button type="button" onClick={copyTemplate} className="inline-flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white">
                  <span className="material-symbols-outlined text-[13px]">{copied ? 'check' : 'content_copy'}</span>
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="px-3 py-2 text-[11px] leading-relaxed overflow-x-auto bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-mono">{appsScript}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SampleFormEditor;
