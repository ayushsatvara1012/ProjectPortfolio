import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing Plans | Sapybase AI Chatbots',
  description: 'Simple, scalable pricing for AI chatbots. Free, Starter, Growth, Scale, and Enterprise plans with per-bot message and knowledge limits.',
  alternates: { canonical: 'https://www.sapybase.com/pricing' },
  openGraph: {
    title: 'Pricing Plans | Sapybase AI Chatbots',
    description: 'Plans built for indie hackers and growing teams. Compare features and choose the tier that fits.',
    url: 'https://www.sapybase.com/pricing',
    // og:image is supplied by the file-based opengraph-image route.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing Plans | Sapybase AI Chatbots',
    description: 'Plans built for indie hackers and growing teams. Compare features and choose the tier that fits.',
    // twitter:image is supplied by the file-based twitter-image route.
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
