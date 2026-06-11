/**
 * Dashboard access-gate decision (Explore plan, decisions D3 + D5).
 *
 * MIRROR of sapybase_ai_engine/access_gate.py — keep the two in sync. Pure UI
 * gating: every dashboard route is ALSO enforced server-side by
 * require_premium_tier(). Under the hybrid model (D1) every user needs a real
 * plan to use the dashboard — Explore ($0) or paid. No plan yet → blocked,
 * routed to /pricing.
 *
 * Denylist semantics: block an explicit "no real plan" set, allow everything
 * else (preserves existing behaviour; won't lock out a future tier).
 */

// "No real plan yet" → blocked from the dashboard.
//   FREE    = legacy inactive / pre-activation tier (retired from signup).
//   PENDING = signed up, no plan selected yet (Phase B). A brand-new user also
//             has a null/empty tier, which is blocked too — so new users are
//             covered regardless of how PENDING is recorded.
export const DASHBOARD_BLOCKED_TIERS = new Set(['FREE', 'PENDING']);

export function isDashboardAccessAllowed(
  role: string | null,
  tier: string | null,
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  const normalized = (tier ?? '').trim().toUpperCase();
  if (!normalized || DASHBOARD_BLOCKED_TIERS.has(normalized)) return false;
  return true;
}
