import { AppPageSkeleton } from '@/src/app/components/SkeletonLoader';

export default function AboutLoading() {
  return <AppPageSkeleton messages={['Loading our story…', 'Preparing content…', 'Almost ready…']} />;
}
