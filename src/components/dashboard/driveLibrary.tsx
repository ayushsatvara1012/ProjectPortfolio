'use client';

import React from 'react';
import { COA_COPY, LibraryCopy, SPEC_COPY } from './coaReport';

/**
 * The two Drive libraries an owner can point a chemical bot at, as config.
 *
 * spec-finder-plan D4: two independent folder fields, one component underneath.
 * Everything that differs between certificates and specification sheets is a string
 * in this file — the field's own behaviour (paste, validate, test, report) is
 * identical, because it is behaviour about a Drive folder and not about what is in
 * one.
 *
 * The one genuinely non-cosmetic flag is `showFailedLookups`. That counter is the
 * confidential library's tripwire (coa-confidential-access §8); the specification
 * search returns a visible list by design, so a failed search there is a typo rather
 * than a probe, and the backend does not even compute it.
 */

export type DriveLibraryConfig = {
  /** Path segment of the owner endpoints: `/api/companies/{id}/{id}/report`. */
  id: 'coa' | 'spec';
  fieldId: string;
  label: string;
  help: React.ReactNode;
  /** Shown instead of `help` when the paste is not a Drive folder link. */
  invalidHelp: string;
  panelTitle: string;
  loadingText: string;
  errorFallback: string;
  healthyText: string;
  copy: LibraryCopy;
  showFailedLookups: boolean;
};

const INVALID_HELP =
  "That doesn't look like a Drive folder link. Open the folder in Drive and copy the URL from the address bar.";

export const COA_LIBRARY: DriveLibraryConfig = {
  id: 'coa',
  fieldId: 'coa-folder',
  label: 'Certificate of Analysis — Google Drive folder',
  help: (
    <>
      Customers can look up a certificate by product code or batch number. Share the
      folder as <strong className="font-medium">Anyone with the link</strong> — we read
      filenames only, and never copy your documents. Leave blank to turn the feature off.
    </>
  ),
  invalidHelp: INVALID_HELP,
  panelTitle: 'Certificate library',
  loadingText: 'Reading your certificate folder…',
  errorFallback: "We couldn't read your certificate folder.",
  healthyText:
    'Every certificate in this folder is searchable by product code, batch number or name.',
  copy: COA_COPY,
  showFailedLookups: true,
};

export const SPEC_LIBRARY: DriveLibraryConfig = {
  id: 'spec',
  fieldId: 'spec-folder',
  label: 'Specification sheets — Google Drive folder',
  // §8.3 — the one owner-facing thing §3.1 requires. The first sentence is not
  // decoration: it is the difference between an owner who CHOSE to publish this
  // folder and an owner who was surprised by it, and it costs nothing to say.
  help: (
    <>
      <strong className="font-medium">
        Every PDF in this folder becomes searchable by anyone who can use your widget.
      </strong>{' '}
      Customers type a product name and pick from the matching sheets. Share the folder
      as <strong className="font-medium">Anyone with the link</strong> — we read filenames
      only, and never copy your documents. Leave blank to turn the feature off.
    </>
  ),
  invalidHelp: INVALID_HELP,
  panelTitle: 'Specification library',
  loadingText: 'Reading your specification folder…',
  errorFallback: "We couldn't read your specification folder.",
  healthyText: 'Every specification sheet in this folder is searchable by product name.',
  copy: SPEC_COPY,
  showFailedLookups: false,
};
