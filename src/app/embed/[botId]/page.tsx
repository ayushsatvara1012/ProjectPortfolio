'use client';

import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import ChatWidget from '@/src/app/components/ChatWidget';

export default function EmbedPage() {
  const params = useParams();
  const botId = params.botId as string;

  useEffect(() => {
    const parentOrigin = document.referrer ? new URL(document.referrer).origin : '*';
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        window.parent.postMessage(
          { type: 'sapybase:resize', height: entry.contentRect.height },
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
