import { AppPageSkeleton } from '@/src/app/components/SkeletonLoader';

export default function PricingLoading() {
  return <AppPageSkeleton messages={['Fetching latest plans…', 'Calculating best deals…', 'Almost ready…']} />;
}
