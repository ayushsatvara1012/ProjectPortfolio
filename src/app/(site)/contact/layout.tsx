import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact — Sapybase',
  description: 'Get in touch with the Sapybase team for sales, support, partnerships, or general questions.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
