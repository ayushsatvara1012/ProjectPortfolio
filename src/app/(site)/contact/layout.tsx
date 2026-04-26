import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact — SaPyBase',
  description: 'Get in touch with the SaPyBase team for sales, support, partnerships, or general questions.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
