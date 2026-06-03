import React from 'react';
import type { BlogPost } from '@/src/content/blog/types';

const BASE = 'https://www.sapybase.com';

/** Pure builder for the BlogPosting structured-data object (testable). */
export function buildBlogPostingLd(post: BlogPost, base: string = BASE) {
  const url = `${base}/blog/${post.slug}`;
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.description,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    keywords: post.keywords.join(', '),
    author: { '@type': 'Person', name: post.author },
    publisher: {
      '@type': 'Organization',
      name: 'Sapybase',
      url: base,
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
  };
}

/**
 * Renders BlogPosting structured data (schema.org) for an article page.
 * Example: <BlogPostingJsonLd post={post} />
 */
export default function BlogPostingJsonLd({ post }: { post: BlogPost }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(buildBlogPostingLd(post)) }}
    />
  );
}
