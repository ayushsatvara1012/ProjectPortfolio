import type { Metadata } from 'next';

export const metadata: Metadata = {
  // noindex prevents the standalone /embed/[botId] URL from being indexed;
  // indexifembedded permits Google to attribute this iframe's content to the
  // host page's ranking when embedded via <iframe>. This is the explicit
  // Google-supported pattern for embeddable third-party widgets.
  // https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#indexifembedded
  robots: 'noindex, indexifembedded',
};

export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <body style={{ margin: 0, padding: 0, height: '100%', overflow: 'hidden', background: '#ffffff' }}>
        {children}
      </body>
    </html>
  );
}
