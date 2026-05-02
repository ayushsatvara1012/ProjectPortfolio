import ChatWidget from '@/src/app/components/ChatWidget';
import EmbedBootstrapper from '@/src/app/components/EmbedBootstrapper';

export const runtime = 'edge';

export default async function EmbedPage({ params }: { params: Promise<{ botId: string }> }) {
  const { botId } = await params;

  return (
    <main style={{ width: '100%', height: '100%', margin: 0, padding: 0, background: 'transparent' }}>
      <EmbedBootstrapper />
      <ChatWidget apiKey={botId} isEmbed={true} />
    </main>
  );
}
