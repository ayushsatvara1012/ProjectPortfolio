import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import BreadcrumbJsonLd from '@/src/components/seo/BreadcrumbJsonLd';
import ContactClient from './ContactClient';

export const metadata: Metadata = buildMetadata('contact');

export default function ContactPage() {
  return (
    <>
      <BreadcrumbJsonLd trail={[{ name: 'Contact', path: '/contact' }]} />
      <ContactClient />
    </>
  );
}
