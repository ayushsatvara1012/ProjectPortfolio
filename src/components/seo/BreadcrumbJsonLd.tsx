import React from 'react';

type Crumb = { name: string; path: string };

const BASE = 'https://www.sapybase.com';

/**
 * Renders BreadcrumbList structured data (schema.org).
 * Home is prepended implicitly — pass only the trail after Home.
 * Example: <BreadcrumbJsonLd trail={[{ name: 'Pricing', path: '/pricing' }]} />
 */
export default function BreadcrumbJsonLd({ trail }: { trail: Crumb[] }) {
  const items: Crumb[] = [{ name: 'Home', path: '/' }, ...trail];

  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((crumb, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumb.name,
      item: `${BASE}${crumb.path === '/' ? '' : crumb.path}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
