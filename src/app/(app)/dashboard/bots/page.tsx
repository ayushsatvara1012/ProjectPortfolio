import { auth } from '@clerk/nextjs/server';
import BotsClient from './BotsClient';

export default async function BotsPage() {
  const { getToken } = await auth();
  
  let initialData = null;
  try {
    const token = await getToken();
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${baseUrl}/api/companies`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store', // Always fresh for dashboard
    });
    if (res.ok) {
      initialData = await res.json();
    }
  } catch (error) {
    console.error('[dashboard:bots-seed]', error);
  }

  return <BotsClient initialData={initialData} />;
}
