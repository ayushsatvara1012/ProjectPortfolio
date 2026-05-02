import type { Metadata } from 'next';
import Script from 'next/script';
import Providers from '../providers';

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  '@id': 'https://www.sapybase.com/#organization',
  name: 'Sapybase',
  url: 'https://www.sapybase.com',
  logo: {
    '@type': 'ImageObject',
    url: 'https://www.sapybase.com/SB_Brand-removebg.png',
  },
  sameAs: [],
};

export const metadata: Metadata = {
  title: 'Sapybase | Autonomous AI Chatbots for Modern Business',
  description:
    'Automate your customer support and sales with Sapybase AI agents. Connect your documents and databases to deploy custom AI chatbots in minutes. Built for modern businesses seeking intelligent automation.',
  authors: [{ name: 'Sapybase Engineering' }],
  keywords: ['AI chatbot', 'autonomous AI agents', 'customer support automation', 'Sapybase', 'LLM integration'],
  robots: 'index, follow',
  formatDetection: { telephone: false },
  metadataBase: new URL('https://www.sapybase.com'),
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: 'Sapybase',
    url: 'https://www.sapybase.com',
    title: 'Sapybase | Autonomous AI Chatbots for Modern Business',
    description:
      'Automate your customer support and sales with Sapybase AI agents. Connect your documents and databases to deploy custom AI chatbots in minutes.',
    images: [
      {
        url: 'https://www.sapybase.com/SB_Brand-removebg.png',
        width: 1200,
        height: 630,
        alt: 'Sapybase — Autonomous AI Chatbots',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sapybase | Autonomous AI Chatbots for Modern Business',
    description:
      'Automate your customer support and sales with Sapybase AI agents. Connect your documents and databases to deploy custom AI chatbots in minutes.',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
  verification: {
    google: 'S8as-_oCchRHJndxzd8KPrTXfEfjWoL2U6Rpanr5HIA',
  },
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        id="schema-org"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Providers>{children}</Providers>
      {process.env.NEXT_PUBLIC_SAPYBASE_API_KEY && (
        <>
          <Script 
            id="sapybase-config" 
            strategy="beforeInteractive"
            dangerouslySetInnerHTML={{ __html: `window.SapybaseConfig = { themeColor: '#5730F5' };` }}
          />
          <Script
            src="/sapybase-loader@1.js"
            data-bot-id={process.env.NEXT_PUBLIC_SAPYBASE_API_KEY}
            strategy="lazyOnload"
          />
        </>
      )}
    </>
  );
}
