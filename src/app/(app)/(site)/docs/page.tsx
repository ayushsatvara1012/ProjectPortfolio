import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import BreadcrumbJsonLd from '@/src/components/seo/BreadcrumbJsonLd';
import BotIntegrationDocs from '@/src/app/components/BotIntegrationDocs';

export const metadata: Metadata = buildMetadata('docs');

export default function DocsPage() {
  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 min-h-screen transition-colors duration-500">
      <BreadcrumbJsonLd trail={[{ name: 'Docs', path: '/docs' }]} />
      <BotIntegrationDocs standalone={true} />
    </div>
  );
}
