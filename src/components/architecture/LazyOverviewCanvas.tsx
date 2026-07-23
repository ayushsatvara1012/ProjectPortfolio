'use client';

import dynamic from 'next/dynamic';
import DiagramSkeleton from './DiagramSkeleton';

// next/dynamic { ssr: false } must live in a Client Component. This keeps React
// Flow out of the server shell and shared bundle; the server page imports this.
const LazyOverviewCanvas = dynamic(() => import('./OverviewCanvas'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center p-8">
      <DiagramSkeleton label="Loading system map" />
    </div>
  ),
});

export default LazyOverviewCanvas;
