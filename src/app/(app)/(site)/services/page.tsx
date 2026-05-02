import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import ServicesClient from './ServicesClient';

export const metadata: Metadata = buildMetadata('services');

export default function ServicesPage() {
  return <ServicesClient />;
}
