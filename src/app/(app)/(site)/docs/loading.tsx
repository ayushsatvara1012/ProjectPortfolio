import { AppPageSkeleton } from '@/src/app/components/SkeletonLoader';

export default function DocsLoading() {
  return <AppPageSkeleton messages={['Loading documentation…', 'Indexing content…', 'Almost ready…']} />;
}
