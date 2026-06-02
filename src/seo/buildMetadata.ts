import type { Metadata } from 'next';
import { seoConfig, type SeoKey } from './seoConfig';

export function buildMetadata(key: SeoKey): Metadata {
  const entry = seoConfig[key];
  return {
    title: entry.title,
    description: entry.description,
    keywords: [...entry.keywords],
    alternates: { canonical: entry.canonical },
    openGraph: {
      type: 'website',
      siteName: 'Sapybase',
      url: entry.canonical,
      title: entry.title,
      description: entry.description,
      // og:image is supplied by the file-based opengraph-image route.
    },
    twitter: {
      card: 'summary_large_image',
      title: entry.title,
      description: entry.description,
      // twitter:image is supplied by the file-based twitter-image route.
    },
  };
}
