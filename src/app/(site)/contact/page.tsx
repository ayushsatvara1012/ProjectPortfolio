import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import ContactClient from './ContactClient';

export const metadata: Metadata = buildMetadata('contact');

export default function ContactPage() {
  return <ContactClient />;
}
