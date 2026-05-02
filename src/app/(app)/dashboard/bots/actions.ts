'use server';

import { auth } from '@clerk/nextjs/server';
import { revalidatePath } from 'next/cache';

export async function deleteBot(botId: string) {
  const { getToken } = await auth();
  const token = await getToken();
  
  if (!token) {
    throw new Error('Unauthorized');
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  const res = await fetch(`${baseUrl}/api/companies/${botId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: 'Failed to delete bot' }));
    throw new Error(error.detail || 'Failed to delete bot');
  }

  revalidatePath('/dashboard/bots');
  return { success: true };
}
