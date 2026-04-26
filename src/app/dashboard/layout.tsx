import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AppLayout from '@/src/app/components/AppLayout';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: middleware also protects /dashboard, but resolving auth
  // here means unauthenticated users redirect before any client JS ships,
  // and the rendered HTML is never the logged-out shell.
  const { userId } = await auth();
  if (!userId) redirect('/sign-in');

  // NOTE: tier/role still hydrate from /api/me client-side (see UserContext).
  // UserProvider accepts `initialUser` for SSR seeding when we're ready to
  // forward the Clerk JWT to FastAPI from a server component; until then the
  // first paint shows neutral placeholders rather than a stale logged-out shell.
  return <AppLayout>{children}</AppLayout>;
}
