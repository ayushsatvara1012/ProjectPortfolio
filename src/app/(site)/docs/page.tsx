import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import BotIntegrationDocs from '@/src/app/components/BotIntegrationDocs';

export const metadata: Metadata = buildMetadata('docs');

export default function DocsPage() {
  return <BotIntegrationDocs standalone={true} />;
}
