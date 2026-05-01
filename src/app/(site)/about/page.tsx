import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import AboutClient from './AboutClient';

export const metadata: Metadata = buildMetadata('about');

export default function AboutPage() {
  return <AboutClient />;
}
