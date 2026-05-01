import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';

// Server-side role gate. Resolves /api/me with the Clerk JWT before any client
// JS ships, so non-SUPER_ADMIN users redirect rather than briefly rendering the
// admin shell and falling through to a client-side "Unauthorized" message.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');

  // Fail fast at request time if the API URL is missing — an empty baseUrl
  // would cause fetch() to call a relative path on the Next.js server, which
  // silently returns 404 and falls through to redirect('/dashboard') instead
  // of throwing, hiding the misconfiguration.
  const baseUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!baseUrl) throw new Error('NEXT_PUBLIC_API_URL is not set');

  const token = await getToken();
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
