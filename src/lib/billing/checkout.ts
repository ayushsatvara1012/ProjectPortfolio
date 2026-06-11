/**
 * Polar checkout-link resolution — single source of truth for every pricing
 * surface (marketing /pricing, the /subscribe continuation route, and the in-app
 * dashboard pricing). Reads the NEXT_PUBLIC_* checkout links so it works in
 * client components.
 */

export type BillingPeriod = 'monthly' | 'annual';

// Monthly Polar checkout links per tier. EXPLORE is the $0 plan — its hosted
// checkout asks only for an email (no card), and the Polar webhook grants the
// EXPLORE tier on subscription.created (its monthly cycle drives the reset).
export const POLAR_URLS: Record<string, string | undefined> = {
  EXPLORE: process.env.NEXT_PUBLIC_POLAR_EXPLORE_URL,
  STARTER: process.env.NEXT_PUBLIC_POLAR_STARTER_URL,
  PRO: process.env.NEXT_PUBLIC_POLAR_PRO_URL,
  BUSINESS: process.env.NEXT_PUBLIC_POLAR_BUSINESS_URL,
};

// Annual checkout links (2 months free). Falls back to monthly if the annual
// product isn't configured yet.
export const POLAR_URLS_ANNUAL: Record<string, string | undefined> = {
  STARTER: process.env.NEXT_PUBLIC_POLAR_STARTER_ANNUAL_URL,
  PRO: process.env.NEXT_PUBLIC_POLAR_PRO_ANNUAL_URL,
  BUSINESS: process.env.NEXT_PUBLIC_POLAR_BUSINESS_ANNUAL_URL,
};

/** The raw Polar checkout link for a tier+period, or null if not configured. */
export function resolveCheckoutUrl(
  tier: string,
  period: BillingPeriod,
): string | null {
  const key = (tier || '').toUpperCase();
  const url =
    period === 'annual' ? POLAR_URLS_ANNUAL[key] || POLAR_URLS[key] : POLAR_URLS[key];
  return url || null;
}

/**
 * The full Polar checkout URL with the post-payment success redirect and (when
 * known) the customer_external_id binding the subscription to the Clerk user —
 * so the Polar webhook can map the resulting subscription back to the account.
 * Returns null if no checkout link is configured for this tier+period.
 */
export function buildPolarCheckoutUrl(
  tier: string,
  period: BillingPeriod,
  opts: { userId?: string | null; origin: string },
): string | null {
  const base = resolveCheckoutUrl(tier, period);
  if (!base) return null;
  const returnUrl = `${opts.origin}/dashboard/register?payment=success`;
  let url = `${base}?success_url=${encodeURIComponent(returnUrl)}`;
  if (opts.userId) url += `&customer_external_id=${opts.userId}`;
  return url;
}
