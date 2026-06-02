import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI Chatbot Solutions & Custom Integration | Sapybase',
  description: 'Custom AI chatbot deployment, RAG training, embedding, and white-label services from Sapybase. Intelligent systems that grow with your business.',
  alternates: { canonical: 'https://www.sapybase.com/services' },
  openGraph: {
    title: 'AI Chatbot Solutions & Custom Integration | Sapybase',
    description: 'Custom AI chatbot deployment, RAG training, embedding, and white-label services from Sapybase.',
    url: 'https://www.sapybase.com/services',
    // og:image is supplied by the file-based opengraph-image route.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Chatbot Solutions & Custom Integration | Sapybase',
    description: 'Custom AI chatbot deployment, RAG training, embedding, and white-label services from Sapybase.',
    // twitter:image is supplied by the file-based twitter-image route.
  },
};

export default function ServicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
