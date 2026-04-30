import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Chatbot Solutions & Custom Integration | Sapybase',
  description: 'Custom AI chatbot deployment, RAG training, embedding, and white-label services from Sapybase. Intelligent systems that grow with your business.',
  alternates: { canonical: 'https://www.sapybase.com/services' },
  openGraph: {
    title: 'AI Chatbot Solutions & Custom Integration | Sapybase',
    description: 'Custom AI chatbot deployment, RAG training, embedding, and white-label services from Sapybase.',
    url: 'https://www.sapybase.com/services',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Chatbot Solutions & Custom Integration | Sapybase',
    description: 'Custom AI chatbot deployment, RAG training, embedding, and white-label services from Sapybase.',
    images: ['https://www.sapybase.com/SB_Brand-removebg.png'],
  },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
