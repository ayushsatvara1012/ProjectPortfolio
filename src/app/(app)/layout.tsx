import type { Metadata } from 'next';
import Script from 'next/script';
import Providers from '../providers';
import { COMPANY, PRODUCT, SAME_AS, FOUNDER, KNOWS_ABOUT } from '@/src/lib/brand';

const BASE = 'https://www.sapybase.com';

// Site-wide entity graph: the company (Organization), the site (WebSite), and
// the product (Vaayu) explicitly linked. This is the structured "fact sheet"
// Google and AI answer engines read to understand who/what we are.
const entityGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${BASE}/#organization`,
      name: COMPANY.name,
      legalName: COMPANY.legalName,
      url: COMPANY.url,
      logo: { '@type': 'ImageObject', url: `${BASE}/logo2.svg` },
      description:
        'Sapybase is the company behind Vaayu — a Business Intelligence chat that captures and scores leads, maps conversion funnels, and attributes revenue and ROI to every customer conversation.',
      slogan: PRODUCT.tagline,
      founder: {
        '@type': 'Person',
        '@id': `${BASE}/#founder`,
        name: FOUNDER.name,
        jobTitle: FOUNDER.jobTitle,
        url: FOUNDER.url,
        sameAs: [...FOUNDER.sameAs],
      },
      knowsAbout: [...KNOWS_ABOUT],
      brand: { '@type': 'Brand', name: PRODUCT.name },
      ...(SAME_AS.length ? { sameAs: SAME_AS } : {}),
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE}/#website`,
      url: COMPANY.url,
      name: PRODUCT.lockup, // "Vaayu by Sapybase"
      description:
        'Vaayu by Sapybase — a Business Intelligence chat for your website that answers customers 24/7, captures and scores leads, and proves ROI.',
      publisher: { '@id': `${BASE}/#organization` },
      inLanguage: 'en-US',
    },
  ],
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
    // og:image is supplied by the file-based opengraph-image route.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Sapybase | Autonomous AI Chatbots for Modern Business',
    description:
      'Automate your customer support and sales with Sapybase AI agents. Connect your documents and databases to deploy custom AI chatbots in minutes.',
    // twitter:image is supplied by the file-based twitter-image route.
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(entityGraph) }}
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
