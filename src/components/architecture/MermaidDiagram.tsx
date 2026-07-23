'use client';

import { useEffect, useId, useState } from 'react';
import type { FeatureArchitecture } from '@/src/content/architecture/types';
import DiagramSkeleton from './DiagramSkeleton';

// Mermaid behavior diagram. Renders a skeleton on first paint, then calls
// mermaid.render() in a browser-only effect and swaps in the SVG. No server HTML
// for the SVG => no hydration mismatch by construction (see plan, Stack verification).
// Theme follows the system color scheme (the immersive page inherits site/system
// theme); it re-renders when the scheme changes so the diagram never looks like a
// light card dropped onto the dark canvas.
export default function MermaidDiagram({
  mermaid: spec,
}: {
  mermaid: NonNullable<FeatureArchitecture['mermaid']>;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [dark, setDark] = useState(false);
  // mermaid.render needs a DOM-id-safe string; useId() contains colons, strip them.
  const renderId = `mmd-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: dark ? 'dark' : 'neutral',
        });
        const { svg: rendered } = await mermaid.render(renderId, spec.code);
        if (!cancelled) {
          setSvg(rendered);
          setFailed(false);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [spec.code, renderId, dark]);

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
      role="img"
      aria-label={spec.summary}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
