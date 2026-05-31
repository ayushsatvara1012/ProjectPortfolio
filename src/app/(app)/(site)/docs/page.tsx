import type { Metadata } from 'next';
import { buildMetadata } from '@/src/seo/buildMetadata';
import BotIntegrationDocs from '@/src/app/components/BotIntegrationDocs';

export const metadata: Metadata = buildMetadata('docs');

export default function DocsPage() {
  return (
    <div className="bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-200 min-h-screen transition-colors duration-500">
      <BotIntegrationDocs standalone={true} />
    </div>
  );
}
