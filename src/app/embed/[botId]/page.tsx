import type { Metadata } from 'next';
import ChatWidget from '@/src/app/components/ChatWidget';
import EmbedBootstrapper from '@/src/app/components/EmbedBootstrapper';

export const runtime = 'edge';

async function getBotConfig(botId: string) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://www.sapybase.com';
    const res = await fetch(`${baseUrl}/api/config`, {
      headers: {
        'x-api-key': botId,
        'Origin': 'https://www.sapybase.com', // fallback origin for SSR
      },
      cache: 'force-cache',
      next: { revalidate: 3600 }, // Cache bot config for 1 hour
    });
    if (res.ok) return await res.json();
  } catch (error) {
    console.error('[embed:metadata-fetch]', error);
  }
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ botId: string }> }): Promise<Metadata> {
  const { botId } = await params;
  const config = await getBotConfig(botId);

  if (!config) {
    return {
      title: 'AI Chat Assistant | Sapybase',
      description: 'Chat with our AI assistant.',
    };
  }

  const botName = config.bot_name || 'AI Assistant';
  const companyName = config.company_name || 'Sapybase';

  return {
    title: `${botName} | ${companyName}`,
    description: `Chat with ${botName}, the official AI assistant for ${companyName}. Powered by Sapybase.`,
    openGraph: {
      title: `${botName} | ${companyName}`,
      description: `Need help? Chat with ${botName} now.`,
      images: config.custom_logo_url ? [config.custom_logo_url] : [],
    },
  };
}

export default async function EmbedPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;

  return (
    <main style={{ width: '100%', height: '100%', margin: 0, padding: 0, background: 'transparent' }}>
      <EmbedBootstrapper />
      <ChatWidget apiKey={botId} isEmbed={true} />
    </main>
  );
}
