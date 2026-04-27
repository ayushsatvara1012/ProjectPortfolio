import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About — Sapybase',
  description: 'The story, mission, and team behind Sapybase — purpose-built AI chatbots that actually answer your customers.',
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
