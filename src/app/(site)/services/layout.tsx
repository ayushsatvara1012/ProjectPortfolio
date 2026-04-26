import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Services — SaPyBase',
  description: 'Custom AI chatbot deployment, training, embedding, and white-label services from SaPyBase.',
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
