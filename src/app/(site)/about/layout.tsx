import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About — SaPyBase',
  description: 'The story, mission, and team behind SaPyBase — purpose-built AI chatbots that actually answer your customers.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
