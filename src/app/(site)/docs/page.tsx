import type { Metadata } from 'next';
import BotIntegrationDocs from '@/src/app/components/BotIntegrationDocs';

export const metadata: Metadata = {
  title: 'Documentation | Sapybase',
  description: 'Step-by-step guide to integrating, training, and customizing your Sapybase AI chatbot.',
  alternates: { canonical: 'https://www.sapybase.com/docs' },
  openGraph: {
    title: 'Documentation | Sapybase',
    description: 'Step-by-step guide to integrating, training, and customizing your Sapybase AI chatbot.',
    url: 'https://www.sapybase.com/docs',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Documentation | Sapybase',
    description: 'Step-by-step guide to integrating, training, and customizing your Sapybase AI chatbot.',
  },
};

export default function DocsPage() {
  return <BotIntegrationDocs standalone={true} />;
}
