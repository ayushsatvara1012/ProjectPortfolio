import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Sapybase | The Future of Autonomous AI Agents',
  description: 'The story, mission, and team behind Sapybase — purpose-built AI chatbots that actually answer your customers.',
  alternates: { canonical: 'https://www.sapybase.com/about' },
  openGraph: {
    title: 'About Sapybase | The Future of Autonomous AI Agents',
    description: 'The story, mission, and team behind Sapybase — purpose-built AI chatbots that actually answer your customers.',
    url: 'https://www.sapybase.com/about',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Sapybase | The Future of Autonomous AI Agents',
    description: 'The story, mission, and team behind Sapybase — purpose-built AI chatbots that actually answer your customers.',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
