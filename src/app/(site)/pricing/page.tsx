import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import PricingClient from './PricingClient';

export const metadata: Metadata = buildMetadata('pricing');

export default function PricingPage() {
  return <PricingClient />;
}
