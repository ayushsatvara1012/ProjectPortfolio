import { AppPageSkeleton } from '@/src/app/components/SkeletonLoader';

export default function ContactLoading() {
  return <AppPageSkeleton messages={['Setting up the form…', 'Preparing contact details…', 'Almost ready…']} />;
}
