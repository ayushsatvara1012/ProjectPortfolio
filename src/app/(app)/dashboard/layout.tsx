import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AppLayout from '@/src/app/components/AppLayout';
import UserSeed from '@/src/app/components/UserSeed';
import DashboardProviders from './DashboardProviders';


export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Server-side gate: middleware also protects /dashboard, but resolving auth
  // here means unauthenticated users redirect before any client JS ships,
  // and the rendered HTML is never the logged-out shell.
  const { userId, getToken } = await auth();
  if (!userId) redirect('/sign-in');

  // SSR-seed role/tier from /api/me using the Clerk JWT, so the first paint
  // already knows the user's tier/role (avoids tier-badge flicker and a redundant
  // client-side fetch on every dashboard mount).
  let role: string | null = null;
  let tier: string | null = null;
  let customPlanFeatures: unknown = null;
  try {
    const token = await getToken();
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || '';
    const res = await fetch(`${baseUrl}/api/me`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    if (res.ok) {
      const data = await res.json();
      role = data.role || 'USER';
      tier = data.tier || 'FREE';
      customPlanFeatures = data.custom_plan_features ?? null;
    }
  } catch {
    // fall through; client-side refreshUser will retry.
  }

  return (
    <DashboardProviders>
      <UserSeed role={role} tier={tier} customPlanFeatures={customPlanFeatures} />

      <AppLayout>{children}</AppLayout>
    </DashboardProviders>
  );
}
