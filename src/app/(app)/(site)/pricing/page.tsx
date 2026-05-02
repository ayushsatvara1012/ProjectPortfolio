import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import PricingClient from './PricingClient';
import { BottomCTA } from './components';

export const metadata: Metadata = buildMetadata('pricing');

export default function PricingPage() {
  return (
    <>
      <PricingClient />
      <BottomCTA />
      <div className="h-px bg-slate-200 dark:bg-slate-800 max-w-8xl mx-auto px-6 md:px-12" />
      <div className="pb-8" />
    </>
  );
}
