'use client';

import React, { useState } from 'react';

/**
 * COA finder — the owner points the bot at their Drive folder of certificates.
 * This is the whole configuration: no naming pattern, no per-client regex.
 * Filenames are tokenized server-side, so any convention works.
 *
 * Test Connection (Phase 1) walks the folder for real and reports counts rather
 * than a tick, because H2's failure mode — a Shared Drive folder returning zero
 * files with HTTP 200 — is indistinguishable from an empty folder unless
 * "connected, 0 files" is a visible outcome of its own.
 */

// Mirrors COA_FOLDER_ID_RE in packs/overrides.py. The backend re-validates and is
// authoritative; this copy exists only so a bad paste is caught before a round trip.
const FOLDER_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export function extractDriveFolderId(raw: string): string {
  const value = (raw || '').trim();
  if (!value || value.length > 2048) return '';

  let candidate = '';
  if (FOLDER_ID_RE.test(value)) {
    candidate = value;
  } else {
    const m = value.match(/\/folders\/([^/?#]+)/);
    if (m) {
      candidate = m[1];
    } else {
      try {
        candidate = new URL(value).searchParams.get('id') || '';
      } catch {
        candidate = '';
      }
    }
  }
  candidate = candidate.trim();
  return FOLDER_ID_RE.test(candidate) ? candidate : '';
}

export function isCoaFolderInvalid(raw: string): boolean {
  const trimmed = (raw || '').trim();
  return trimmed !== '' && extractDriveFolderId(trimmed) === '';
}

export type CoaTestResult = {
  ok: boolean;
  message: string;
  indexed?: number;
  filesSeen?: number;
};

type Props = {
  value: string;
  onChange: (v: string) => void;
  inputCls: string;
  labelCls: string;
  helpCls: string;
  botId?: string;
  authFetch?: (path: string, init?: any) => Promise<any>;
};

export default function CoaFolderField({
  value, onChange, inputCls, labelCls, helpCls, botId, authFetch,
}: Props) {
  const invalid = isCoaFolderInvalid(value);
  const folderId = extractDriveFolderId(value);

  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<CoaTestResult | null>(null);

  const testConnection = async () => {
    if (!botId || !authFetch) return;
    setTesting(true);
    setResult(null);
    try {
      const res = await authFetch(`/api/companies/${botId}/coa/test-connection`, { method: 'POST' });
      setResult({
        // "Connected, 0 files" is NOT a success (H2) — a green tick here would
        // ship a bot that says "no certificates on file" forever.
        ok: (res?.indexed ?? 0) > 0,
        message: res?.message || 'Connected.',
        indexed: res?.indexed,
        filesSeen: res?.files_seen,
      });
    } catch (e: any) {
      const msg = e?.body?.detail?.message || e?.message || "We couldn't reach the folder.";
      setResult({ ok: false, message: msg });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
      <label className={labelCls} htmlFor="coa-folder">
        Certificate of Analysis — Google Drive folder
      </label>
      <input
        id="coa-folder"
        type="url"
        spellCheck={false}
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputCls + (invalid ? ' !border-red-400 dark:!border-red-500' : '')}
        placeholder="https://drive.google.com/drive/folders/..."
        aria-invalid={invalid}
        aria-describedby="coa-folder-hint"
      />
      <p id="coa-folder-hint" className={`${helpCls} ${invalid ? '!text-red-500 dark:!text-red-400' : ''}`}>
        {invalid ? (
          "That doesn't look like a Drive folder link. Open the folder in Drive and copy the URL from the address bar."
        ) : (
          <>
            Customers can look up a certificate by product code or batch number. Share the
            folder as <strong className="font-medium">Anyone with the link</strong> — we read
            filenames only, and never copy your documents. Leave blank to turn the feature off.
          </>
        )}
      </p>
      {folderId && (
        <a
          href={`https://drive.google.com/drive/folders/${folderId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-2 text-xs font-google text-slate-500 dark:text-slate-400 underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        >
          <span className="material-symbols-outlined text-[14px]">open_in_new</span>
          Open this folder in Drive to check it&apos;s the right one
        </a>
      )}

      {folderId && botId && authFetch && (
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="button"
            onClick={testConnection}
            disabled={testing}
            className="inline-flex items-center gap-1.5 text-[12px] font-google font-medium px-2.5 py-1.5 rounded-lg bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined text-[15px]">
              {testing ? 'progress_activity' : 'cloud_sync'}
            </span>
            {testing ? 'Checking…' : 'Test connection'}
          </button>
          {result && (
            <span
              role="status"
              className={
                'inline-flex items-start gap-1 text-[11.5px] font-google ' +
                (result.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400')
              }
            >
              <span className="material-symbols-outlined text-[14px] shrink-0">
                {result.ok ? 'check_circle' : 'warning'}
              </span>
              {result.message}
            </span>
          )}
          <span className="text-[11px] font-google text-slate-400 dark:text-slate-500">
            Save your changes before testing.
          </span>
        </div>
      )}
    </div>
  );
}
