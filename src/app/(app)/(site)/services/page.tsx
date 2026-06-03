import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import BreadcrumbJsonLd from '@/src/components/seo/BreadcrumbJsonLd';
import ServicesClient from './ServicesClient';

export const metadata: Metadata = buildMetadata('services');

export default function ServicesPage() {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: 'Services', path: '/services' }]} />
      <ServicesClient />
    </>
  );
}
