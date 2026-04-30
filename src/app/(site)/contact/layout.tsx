import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Build Your AI Bot | Contact Sapybase',
  description: 'Get in touch with the Sapybase team for sales, support, partnerships, or general questions.',
  alternates: { canonical: 'https://www.sapybase.com/contact' },
  openGraph: {
    title: 'Build Your AI Bot | Contact Sapybase',
    description: 'Get in touch with the Sapybase team for sales, support, partnerships, or general questions.',
    url: 'https://www.sapybase.com/contact',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Build Your AI Bot | Contact Sapybase',
    description: 'Get in touch with the Sapybase team for sales, support, partnerships, or general questions.',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
