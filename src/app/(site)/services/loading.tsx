import { AppPageSkeleton } from '@/src/app/components/SkeletonLoader';

export default function ServicesLoading() {
  return <AppPageSkeleton messages={['Exploring our services…', 'Preparing details…', 'Almost ready…']} />;
}
