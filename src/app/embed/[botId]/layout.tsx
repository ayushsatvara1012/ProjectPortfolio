import type { Metadata } from 'next';

export const metadata: Metadata = {
  // noindex prevents the standalone /embed/[botId] URL from being indexed;
  // indexifembedded permits Google to attribute this iframe's content to the
  // host page's ranking when embedded via <iframe>. This is the explicit
  // Google-supported pattern for embeddable third-party widgets.
  // https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag#indexifembedded
  robots: 'noindex, indexifembedded',
};

// IMPORTANT: do NOT render <html>/<body> here. App Router only allows one
// pair per page. The root layout (src/app/layout.tsx) renders them; this
// nested layout only contributes route-specific metadata and a wrapper div.
export default function EmbedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div data-sapybase-embed="true" style={{ width: '100%', height: '100dvh', background: '#ffffff' }}>
      {children}
    </div>
  );
}
