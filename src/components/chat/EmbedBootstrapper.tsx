'use client';

import { useEffect } from 'react';

export default function EmbedBootstrapper() {
  useEffect(() => {
    const parentOrigin = (() => {
      const m = window.location.hash.match(/parentOrigin=([^&]+)/);
      if (!m) return null;
      try { return new URL(decodeURIComponent(m[1])).origin; } catch { return null; }
    })();
    if (!parentOrigin) return;

    // Expose to ChatWidget so backend requests can carry x-Sapybase-parent-origin.
    (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin = parentOrigin;
  }, []);

  return null;
}
