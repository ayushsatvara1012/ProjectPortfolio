import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import AppLayout from '@/src/components/layout/AppLayout';
import UserSeed from '@/src/components/features/UserSeed';
import DashboardProviders from './DashboardProviders';
import { isDashboardAccessAllowed } from '@/src/lib/auth/accessGate';


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

  // Dashboard access gate (Explore D5). DORMANT until EXPLORE_DASHBOARD_GATE=true.
  // ⚠️ Do NOT enable until: (1) the $0 Explore Polar product exists (A0),
  // (2) signup routing provisions new users (Phase B), and (3) existing FREE
  // users are migrated to Explore — otherwise this redirects every FREE/new
  // user to /pricing and locks them out. Backend require_premium_tier already
  // enforces the same rule on data routes (always on, additive/safe).
  if (
    process.env.EXPLORE_DASHBOARD_GATE === 'true' &&
    !isDashboardAccessAllowed(role, tier)
  ) {
    redirect('/pricing');
  }

  return (
    <DashboardProviders>
      <UserSeed role={role} tier={tier} customPlanFeatures={customPlanFeatures} />

      <AppLayout>{children}</AppLayout>
    </DashboardProviders>
  );
}
