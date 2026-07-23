'use client';

import { useEffect, useId, useState } from 'react';
import type { FeatureArchitecture } from '@/src/content/architecture/types';
import DiagramSkeleton from './DiagramSkeleton';

// Mermaid behavior diagram. Renders a skeleton on first paint, then calls
// mermaid.render() in a browser-only effect and swaps in the SVG. No server HTML
// for the SVG => no hydration mismatch by construction (see plan, Stack verification).
export default function MermaidDiagram({
  mermaid: spec,
}: {
  mermaid: NonNullable<FeatureArchitecture['mermaid']>;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // mermaid.render needs a DOM-id-safe string; useId() contains colons, strip them.
  const renderId = `mmd-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
        const { svg: rendered } = await mermaid.render(renderId, spec.code);
        if (!cancelled) setSvg(rendered);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spec.code, renderId]);

  if (failed) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        {spec.summary}
      </p>
    );
  }

  if (!svg) return <DiagramSkeleton label="Rendering behavior diagram" />;

  return (
    <figure
      className="overflow-x-auto"
      aria-label={spec.summary}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
