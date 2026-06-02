import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Build Your AI Bot | Contact Sapybase',
  description: 'Get in touch with the Sapybase team for sales, support, partnerships, or general questions.',
  alternates: { canonical: 'https://www.sapybase.com/contact' },
  openGraph: {
    title: 'Build Your AI Bot | Contact Sapybase',
    description: 'Get in touch with the Sapybase team for sales, support, partnerships, or general questions.',
    url: 'https://www.sapybase.com/contact',
    // og:image is supplied by the file-based opengraph-image route.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Build Your AI Bot | Contact Sapybase',
    description: 'Get in touch with the Sapybase team for sales, support, partnerships, or general questions.',
    // twitter:image is supplied by the file-based twitter-image route.
  },
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
