'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import ChatWidget from '@/src/app/components/ChatWidget';

export default function EmbedPage() {
  const params = useParams();
  const botId = params.botId as string;

  useEffect(() => {
    const parentOrigin = (() => {
      const m = window.location.hash.match(/parentOrigin=([^&]+)/);
      if (!m) return null;
      try { return new URL(decodeURIComponent(m[1])).origin; } catch { return null; }
    })();
    if (!parentOrigin) return;

    // Expose to ChatWidget so backend requests can carry x-Sapybase-parent-origin.
    (window as unknown as { __SapybaseParentOrigin?: string }).__SapybaseParentOrigin = parentOrigin;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        window.parent.postMessage(
          { type: 'Sapybase:resize', height: entry.contentRect.height },
          parentOrigin
        );
      }
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  return (
    <main style={{ width: '100%', height: '100%', margin: 0, padding: 0, background: 'transparent' }}>
      <ChatWidget apiKey={botId} isEmbed={true} />
    </main>
  );
}
