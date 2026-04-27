import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services — Sapybase',
  description: 'Custom AI chatbot deployment, training, embedding, and white-label services from Sapybase.',
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
