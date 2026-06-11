'use client';

/**
 * Client helper for the "Get Explore" CTA (Explore A0).
 *
 * The business-vs-personal decision is made server-side (`GET /api/explore/route`,
 * single source of truth for the domain lists). The frontend then either forwards
 * to the Polar $0 checkout (business), the enquiry form (personal), the dashboard
 * (already has access), or shows a message (disposable/invalid).
 */
import { buildPolarCheckoutUrl } from './checkout';

export type ExploreRoute = 'active' | 'checkout' | 'enquiry' | 'blocked';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

/** Ask the backend which route applies to the signed-in user. */
export async function fetchExploreRoute(token: string): Promise<ExploreRoute> {
  const res = await fetch(`${API_BASE}/api/explore/route`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`explore route failed (${res.status})`);
  const data = (await res.json()) as { route?: ExploreRoute };
  return (data.route as ExploreRoute) || 'enquiry';
}

export type ExploreDestination =
  | { kind: 'external'; url: string } // hard redirect (Polar checkout)
  | { kind: 'navigate'; path: string } // in-app route
  | { kind: 'message'; text: string }; // blocked / not eligible

export const EXPLORE_BLOCKED_MESSAGE =
  'Explore requires a valid business or personal email. Disposable addresses aren’t supported — please use a real email.';

/** Map a route to a concrete destination the caller can act on. */
export function exploreDestination(
  route: ExploreRoute,
  opts: { userId?: string | null; origin: string },
): ExploreDestination {
  switch (route) {
    case 'checkout': {
      const url = buildPolarCheckoutUrl('EXPLORE', 'monthly', {
        userId: opts.userId ?? null,
        origin: opts.origin,
      });
      // If the Explore checkout link isn't configured yet, fall back to the
      // enquiry form rather than dead-ending the click.
      return url ? { kind: 'external', url } : { kind: 'navigate', path: '/explore/enquiry' };
    }
    case 'enquiry':
      return { kind: 'navigate', path: '/explore/enquiry' };
    case 'active':
      return { kind: 'navigate', path: '/dashboard' };
    case 'blocked':
    default:
      return { kind: 'message', text: EXPLORE_BLOCKED_MESSAGE };
  }
}
