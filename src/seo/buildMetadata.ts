import type { Metadata } from 'next';
import { seoConfig, type SeoKey } from './seoConfig';
import type { BlogPost } from '@/src/content/blog/types';

const SITE_URL = 'https://www.sapybase.com';

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

/** Build per-article Metadata for a blog post (canonical, article OG, dates). */
export function buildPostMetadata(post: BlogPost): Metadata {
  const url = `${SITE_URL}/blog/${post.slug}`;
  return {
    title: post.title,
    description: post.description,
    keywords: [...post.keywords],
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      siteName: 'Sapybase',
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.datePublished,
      modifiedTime: post.dateModified,
      authors: [post.author],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}
