import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Pricing — SaPyBase',
  description: 'Simple, scalable pricing for AI chatbots. Free, Basic, Starter, Pro, and Enterprise plans with per-bot message and knowledge limits.',
  openGraph: {
    title: 'Pricing — SaPyBase',
    description: 'Plans built for indie hackers and growing teams. Compare features and choose the tier that fits.',
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
