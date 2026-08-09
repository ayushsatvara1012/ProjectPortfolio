'use client';

import React from 'react';
import DriveFolderField, {
  DriveFolderFieldProps,
  isDriveFolderInvalid,
} from './DriveFolderField';
import { SPEC_LIBRARY } from './driveLibrary';

/**
 * Spec finder — the specification half of the shared Drive folder field.
 *
 * Independent of the certificate field by decision (D4): an owner changes either
 * folder without touching the other, and neither save path rewrites the other's key.
 */

/** Named for the specification field, delegating to the shared rule. */
export function isSpecFolderInvalid(raw: string): boolean {
  return isDriveFolderInvalid(raw);
}

export default function SpecFolderField(props: DriveFolderFieldProps) {
  return <DriveFolderField library={SPEC_LIBRARY} {...props} />;
}
