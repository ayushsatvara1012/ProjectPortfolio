'use client';

import React from 'react';
import DriveFolderField, {
  DriveFolderFieldProps,
  DriveTestResult,
  extractDriveFolderId,
  isDriveFolderInvalid,
} from './DriveFolderField';
import { COA_LIBRARY } from './driveLibrary';

/**
 * COA finder — the certificate half of the shared Drive folder field.
 *
 * The field itself moved to `DriveFolderField` when the spec finder needed a second,
 * independent folder (spec-finder-plan Phase 2, D4). This stays a named component
 * rather than a config object at the call site because "the COA field" is a thing the
 * customise page, its validation and its tests all refer to by name.
 */

export { extractDriveFolderId };
export type CoaTestResult = DriveTestResult;

/** Named for the certificate field, delegating to the shared rule. */
export function isCoaFolderInvalid(raw: string): boolean {
  return isDriveFolderInvalid(raw);
}

export default function CoaFolderField(props: DriveFolderFieldProps) {
  return <DriveFolderField library={COA_LIBRARY} {...props} />;
}
