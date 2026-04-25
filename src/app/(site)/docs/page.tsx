import type { Metadata } from 'next';
import BotIntegrationDocs from '@/src/app/components/BotIntegrationDocs';

export const metadata: Metadata = {
  title: 'Documentation | Sapybase',
  description: 'Step-by-step guide to integrating, training, and customizing your Sapybase AI chatbot.',
  alternates: { canonical: '/docs' },
};

export default function DocsPage() {
  return <BotIntegrationDocs standalone={true} />;
}
