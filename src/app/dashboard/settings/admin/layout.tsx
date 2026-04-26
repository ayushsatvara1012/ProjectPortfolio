import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Server-side role gate. Resolves /api/me with the Clerk JWT before any client
// JS ships, so non-SUPER_ADMIN users redirect rather than briefly rendering the
// admin shell and falling through to a client-side "Unauthorized" message.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');

  const token = await getToken();
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
  let role: string | null = null;
  try {
    const res = await fetch(`${baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      role = data.role || null;
    }
  } catch {
    // fall through; treat as unauthorized
  }

  if (role !== 'SUPER_ADMIN') redirect('/dashboard');

  return <>{children}</>;
}
