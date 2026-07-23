'use client';

import dynamic from 'next/dynamic';
import DiagramSkeleton from './DiagramSkeleton';

// next/dynamic with { ssr: false } throws if called from a Server Component, so
// the lazy imports live here in a Client Component. The detail page (a Server
// Component) imports these wrappers; React Flow and Mermaid stay out of the
// server shell and the shared bundle, scoped to /architecture detail routes only.

export const LazyDataFlowCanvas = dynamic(() => import('./DataFlowCanvas'), {
  ssr: false,
  loading: () => <DiagramSkeleton label="Loading data-flow map" />,
});

export const LazyMermaidDiagram = dynamic(() => import('./MermaidDiagram'), {
  ssr: false,
  loading: () => <DiagramSkeleton label="Loading behavior diagram" />,
});
