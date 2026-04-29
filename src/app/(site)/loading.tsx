import { AppPageSkeleton } from '@/src/app/components/SkeletonLoader';

export default function SiteLoading() {
  return <AppPageSkeleton messages={['Welcome to Sapybase…', 'Loading your experience…', 'Almost ready…']} />;
}
