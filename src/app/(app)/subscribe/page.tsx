'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser, useAuth } from '@clerk/nextjs';
import {
  buildPolarCheckoutUrl,
  resolveCheckoutUrl,
  type BillingPeriod,
} from '@/src/lib/billing/checkout';
import { fetchExploreRoute, exploreDestination } from '@/src/lib/billing/explore';

/**
 * Post-sign-up checkout continuation.
 *
 * A signed-out visitor who clicks "Get <plan>" on /pricing is sent here AFTER
 * sign-up (via Clerk forceRedirectUrl). By now they're authenticated, so we can
 * build the Polar checkout URL with their customer_external_id and forward to
 * Polar — completing "log in first, then subscribe" without a second click.
 *
 * Deliberately NOT under /dashboard: a brand-new user has no plan yet, so the
 * dashboard access gate (D5) would bounce them off any /dashboard route.
 */
function SubscribeRedirector() {
  const router = useRouter();
  const params = useSearchParams();
  const { user, isSignedIn, isLoaded } = useUser();
  const { getToken } = useAuth();

  const plan = (params.get('plan') || '').toUpperCase();
  const period: BillingPeriod = params.get('period') === 'annual' ? 'annual' : 'monthly';

  useEffect(() => {
    if (!isLoaded) return; // wait for Clerk to resolve the session

    // Edge: reached while signed out (e.g. direct link) → restart on /pricing.
    if (!isSignedIn) {
      router.replace('/pricing');
      return;
    }

    // EXPLORE is the $0 plan — its destination depends on the user's email
    // (business → checkout, personal → enquiry, etc.), decided server-side.
    if (plan === 'EXPLORE') {
      (async () => {
        try {
          const token = await getToken();
          if (!token) throw new Error('no token');
          const route = await fetchExploreRoute(token);
          const dest = exploreDestination(route, {
            userId: user?.id ?? null,
            origin: window.location.origin,
          });
          if (dest.kind === 'external') window.location.href = dest.url;
          else if (dest.kind === 'navigate') router.replace(dest.path);
          else router.replace('/explore/enquiry');
        } catch {
          router.replace('/explore/enquiry');
        }
      })();
      return;
    }

    // Paid plans: no / unknown plan, or no checkout link configured → back to pricing.
    if (!plan || !resolveCheckoutUrl(plan, period)) {
      router.replace('/pricing');
      return;
    }

    const url = buildPolarCheckoutUrl(plan, period, {
      userId: user?.id ?? null,
      origin: window.location.origin,
    });
    if (url) window.location.href = url;
    else router.replace('/pricing');
  }, [isLoaded, isSignedIn, plan, period, user, router, getToken]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center dark:bg-slate-950">
      <span className="material-symbols-outlined animate-spin text-[28px] text-blue-600 dark:text-blue-400">
        progress_activity
      </span>
      <p className="font-google text-sm text-slate-600 dark:text-slate-400">
        Taking you to secure checkout…
      </p>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense fallback={null}>
      <SubscribeRedirector />
    </Suspense>
  );
}
