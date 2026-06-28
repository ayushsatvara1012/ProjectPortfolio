'use client';

// Phase 5 (customise) — per-client editor for the chemical agent's sample-request
// FORM. Every client's form differs (one needs "application", another "delivery
// site"), and each client's submissions land in THEIR own sheet — so this edits the
// field list + the data destination, persisted as companies.pack_overrides and
// merged over the pack default at runtime. Only mounted for a vertical (pack) bot.

import React from 'react';
import type { SampleFormField } from '@/src/lib/context/BotSettingsContext';

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

interface Props {
  fields: SampleFormField[];
  onChange: (fields: SampleFormField[]) => void;
  sinkUrl: string;
  onSinkUrlChange: (v: string) => void;
  sinkSecret: string;
  onSinkSecretChange: (v: string) => void;
}

const SampleFormEditor = ({ fields, onChange, sinkUrl, onSinkUrlChange, sinkSecret, onSinkSecretChange }: Props) => {
  const validation = validateSampleForm(fields);
  const sinkUrlInvalid = sinkUrl.trim() !== '' && !sinkUrl.trim().toLowerCase().startsWith('https://');

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
      </div>
    </div>
  );
};

export default SampleFormEditor;
