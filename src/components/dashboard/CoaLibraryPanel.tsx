'use client';

import React from 'react';
import DriveLibraryPanel from './DriveLibraryPanel';
import { COA_LIBRARY } from './driveLibrary';

/**
 * COA finder Phase 4 — the certificate library's health panel.
 *
 * The panel moved to `DriveLibraryPanel` when the spec finder needed the same report
 * for a second folder (spec-finder-plan Phase 2). This keeps the certificate config
 * bound to a name, including `showFailedLookups` — the guessing tripwire is the
 * confidential library's alone, and it must not follow the panel to a public one.
 */

type Props = {
  botId?: string;
  authFetch?: (path: string, init?: any) => Promise<any>;
  /** The folder ID the BACKEND has saved. Unsaved edits must not be described here. */
  savedFolderId: string;
  /** Bumped by a successful Test Connection, which has just refreshed the listing. */
  reloadKey?: number;
};

export default function CoaLibraryPanel(props: Props) {
  return <DriveLibraryPanel library={COA_LIBRARY} {...props} />;
}
