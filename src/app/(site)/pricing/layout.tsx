import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing Plans | Sapybase AI Chatbots',
  description: 'Simple, scalable pricing for AI chatbots. Free, Basic, Starter, Pro, and Enterprise plans with per-bot message and knowledge limits.',
  alternates: { canonical: 'https://www.sapybase.com/pricing' },
  openGraph: {
    title: 'Pricing Plans | Sapybase AI Chatbots',
    description: 'Plans built for indie hackers and growing teams. Compare features and choose the tier that fits.',
    url: 'https://www.sapybase.com/pricing',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing Plans | Sapybase AI Chatbots',
    description: 'Plans built for indie hackers and growing teams. Compare features and choose the tier that fits.',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
