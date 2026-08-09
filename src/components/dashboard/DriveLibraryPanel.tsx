'use client';

import React, { useEffect, useState } from 'react';
import { CoaNotice, CoaReport, coaNotices, formatWalkAge, parseCoaReport } from './coaReport';
import { DriveLibraryConfig } from './driveLibrary';

/**
 * What one of the owner's Drive libraries looks like to the search.
 *
 * Generalized from the COA finder's Phase 4 panel (spec-finder-plan Phase 2). Reads
 * the folder listing the search itself uses, so the counts here are the counts a
 * customer's query runs against. Cache-first: opening the customise tab must not
 * spend a Drive walk, so "Test connection" is the one action that forces a refresh
 * and this panel reports the age of what it read.
 *
 * `library` decides the endpoint and the wording. Nothing else here branches — the
 * report is the same report whatever the PDFs mean.
 */

type Props = {
  library: DriveLibraryConfig;
  botId?: string;
  authFetch?: (path: string, init?: any) => Promise<any>;
  /** The folder ID the BACKEND has saved. Unsaved edits must not be described here. */
  savedFolderId: string;
  /** Bumped by a successful Test Connection, which has just refreshed the listing. */
  reloadKey?: number;
};

const CARD =
  'mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 p-4';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <p className="text-[19px] font-google font-semibold text-slate-800 dark:text-slate-100 tabular-nums leading-tight">
        {value.toLocaleString()}
      </p>
      <p className="text-[11px] font-google text-slate-500 dark:text-slate-400">{label}</p>
    </div>
  );
}

function Notice({ notice }: { notice: CoaNotice }) {
  const [open, setOpen] = useState(false);
  const warn = notice.level === 'warn';
  const samples = notice.samples || [];
  return (
    <li className="flex items-start gap-2">
      <span
        className={
          'material-symbols-outlined text-[16px] shrink-0 mt-px ' +
          (warn ? 'text-amber-500 dark:text-amber-400' : 'text-slate-400 dark:text-slate-500')
        }
        aria-hidden="true"
      >
        {warn ? 'warning' : 'info'}
      </span>
      <div className="min-w-0">
        <p className="text-[12.5px] font-google font-medium text-slate-700 dark:text-slate-200">
          {notice.title}
        </p>
        <p className="text-[11.5px] font-google text-slate-500 dark:text-slate-400 leading-relaxed">
          {notice.detail}
        </p>
        {samples.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-1 text-[11px] font-google font-medium text-slate-600 dark:text-slate-300 underline underline-offset-2 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {open ? 'Hide filenames' : `Show filenames (${samples.length})`}
            </button>
            {open && (
              <ul className="mt-1.5 space-y-0.5 max-h-40 overflow-y-auto">
                {samples.map((s) => (
                  <li
                    key={s}
                    className="text-[11px] font-google text-slate-500 dark:text-slate-400 break-words"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </li>
  );
}

/** One settled fetch. `null` is "still in flight" — the two are never both true. */
type Loaded = { report: CoaReport | null; error: string | null };

export default function DriveLibraryPanel({
  library, botId, authFetch, savedFolderId, reloadKey = 0,
}: Props) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  // Every setState is behind an await, so the effect body sets no state synchronously
  // (which cascades renders) and a reload keeps the previous numbers on screen
  // instead of flashing the placeholder. `cancelled` is what stops a slow first
  // response from overwriting a newer one after a Test Connection.
  useEffect(() => {
    if (!botId || !authFetch || !savedFolderId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`/api/companies/${botId}/${library.id}/report`);
        const parsed = parseCoaReport(res);
        if (!parsed) throw new Error('Unexpected response.');
        if (!cancelled) setLoaded({ report: parsed, error: null });
      } catch (e: any) {
        // Never a folder ID or a Drive URL in owner-facing text (H11/H3) — the
        // backend scrubs its own messages, and this fallback names nothing either.
        const message = e?.body?.detail?.message || e?.message || library.errorFallback;
        if (!cancelled) setLoaded({ report: null, error: message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [botId, authFetch, savedFolderId, reloadKey, library.id, library.errorFallback]);

  if (!botId || !authFetch || !savedFolderId) return null;

  const report = loaded?.report ?? null;
  const error = loaded?.error ?? null;

  if (!loaded) {
    return (
      // No `role="status"`: the Test Connection result above owns the field's live
      // region, and a second one competes with it for the same announcement.
      <div className={CARD}>
        <p className="text-[12px] font-google text-slate-500 dark:text-slate-400">
          {library.loadingText}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={CARD}>
        <p className="flex items-start gap-1.5 text-[12px] font-google text-amber-600 dark:text-amber-400">
          <span className="material-symbols-outlined text-[15px] shrink-0" aria-hidden="true">
            warning
          </span>
          {error}
        </p>
      </div>
    );
  }

  if (!report) return null;

  const notices = coaNotices(report, library.copy);
  const { one, many } = library.copy.item;

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-[12.5px] font-google font-semibold text-slate-700 dark:text-slate-200">
          {library.panelTitle}
        </p>
        <p className="text-[11px] font-google text-slate-400 dark:text-slate-500">
          Checked {formatWalkAge(report.walkedAt)}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mt-3">
        <Stat value={report.indexed} label={report.indexed === 1 ? one : many} />
        <Stat value={report.folders} label={report.folders === 1 ? 'folder' : 'folders'} />
        <Stat value={report.filesSeen} label="files in Drive" />
      </div>

      {/* The tripwire (coa-confidential-access §8). Separated from the three counts
          above because it describes visitors rather than the folder — and omitted
          entirely when the count is unknown, since "0" would read as "nobody is
          guessing at your batch numbers". The specification library has no such
          counter: its search returns a visible list, so a miss is a typo. */}
      {library.showFailedLookups && report.failedLookups !== null && (
        <div className="mt-3.5 pt-3.5 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[12px] font-google font-medium text-slate-700 dark:text-slate-200">
              Failed lookups
            </p>
            <p className="text-[13px] font-google font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
              {report.failedLookups.toLocaleString()}
            </p>
          </div>
          <p className="text-[11.5px] font-google text-slate-500 dark:text-slate-400 leading-relaxed mt-0.5">
            Customers who entered a product code or batch number we could not match, over the
            last {report.failedLookupsDays} days. A few is normal typing. A run of them is
            someone guessing at batch numbers - tell us if this looks unusual.
          </p>
        </div>
      )}

      {notices.length > 0 ? (
        <ul className="mt-3.5 pt-3.5 border-t border-slate-200 dark:border-slate-800 space-y-3">
          {notices.map((n) => (
            <Notice key={n.key} notice={n} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 text-[11.5px] font-google text-emerald-600 dark:text-emerald-400">
          <span className="material-symbols-outlined text-[15px] shrink-0" aria-hidden="true">
            check_circle
          </span>
          {library.healthyText}
        </p>
      )}
    </div>
  );
}
