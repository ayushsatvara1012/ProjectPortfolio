"""Monthly usage-period reset logic (Explore plan, decision D2) — pure helpers.

No I/O, no DB, no side effects — mirrors the other pure-helper modules in this
engine (lead_scoring, funnel, …) so the decision logic is unit-testable in
isolation. The DB write that applies a reset lives in main.py.

WHY THIS EXISTS
---------------
`usage_tracking.messages_used` is a monthly counter, but nothing in the codebase
ever zeroed it — it was a per-row 30-day window seeded at row creation and then
incremented forever. On a lifetime-free Explore bot (hard 200-message cap, no
billing event to rotate the window) that means the bot hits 200 once and "rests"
permanently. This module provides the reset decision; the reset is applied
"self-healing on read" (no cron), the same pattern as the grace-period downgrade
in main.get_current_user.

ANCHOR (revised from the original D2 wording)
---------------------------------------------
The message quota is defined PER MONTH (e.g. Starter 1500/mo), independent of
whether the customer is billed monthly or annually. So the reset cadence is a
fixed ~monthly window — NOT the Polar `billing_period_end`, which for an annual
plan is up to a year out and would (wrongly) stretch the monthly quota across the
whole year. For a monthly subscription the two coincide; for an annual one this
keeps the quota correctly monthly.

Trade-off accepted: the reset day can drift by a few days because a new window is
opened at the moment of the first read AFTER expiry (traffic-dependent), rather
than being pinned to a calendar anniversary. For a usage quota this is standard
and acceptable; a future refinement could pin it to the subscription start day.
"""

from datetime import datetime, timedelta

from dateutil.relativedelta import relativedelta

# One usage period. "month" == 30 days, matching the existing
# `period_end = now() + interval '30 days'` convention already in the schema.
USAGE_PERIOD = timedelta(days=30)


def should_reset_usage(now: datetime, period_end) -> bool:
    """True when the current usage period has elapsed and the counter must reset.

    Resets at/after the boundary (``now >= period_end``). A missing period_end
    (no usage row yet, or a NULL) is never resettable — there is nothing to roll.
    """
    if period_end is None:
        return False
    return now >= period_end


def fresh_period(now: datetime, period: timedelta = USAGE_PERIOD) -> tuple[datetime, datetime]:
    """Return ``(period_start, period_end)`` for a brand-new usage window.

    The window always ends strictly in the future (``period_end > now``), which
    guarantees the reset is not immediately re-triggered on the next read — the
    bug that a naive "set period_end to billing_period_end" could cause when the
    renewal webhook lags and billing_period_end is momentarily in the past.
    """
    return now, now + period


# How far out a billing_period_end may be and still be treated as "this monthly
# cycle". Guards against anchoring to an ANNUAL plan's period_end (up to a year
# out), which would wrongly stretch the monthly quota across the whole year.
MAX_BILLING_ANCHOR = timedelta(days=31)


def next_period_for_subscription(
    now: datetime,
    billing_period_end,
    period: timedelta = USAGE_PERIOD,
    max_anchor: timedelta = MAX_BILLING_ANCHOR,
) -> tuple[datetime, datetime]:
    """``(period_start, period_end)`` for a reset window ANCHORED to Polar's billing cycle.

    When ``billing_period_end`` falls within the next ~month (a monthly sub such as
    Explore), the reset window is pinned to it, so the counter rolls on the real
    Polar renewal date — i.e. "monthly reset calculated through Polar".

    Falls back to a rolling ``period`` window (``fresh_period``) when billing_period_end is:
      • missing / None,
      • already in the past (renewal webhook lagging, or a $0 sub that emits no
        renewal event — so the counter never gets stuck), or
      • far in the future (an ANNUAL plan — anchoring there would stretch the
        monthly quota across the year; D2's original concern).
    """
    if billing_period_end is not None and now < billing_period_end <= now + max_anchor:
        return now, billing_period_end
    return fresh_period(now, period)


def next_explore_billing_anchor(created_at: datetime, now: datetime) -> datetime:
    """Next calendar-month renewal date for the $0 Explore plan, anchored to the
    day-of-month the account was created (e.g. created May 12 -> renews June 12
    -> July 12, ...).

    Explore's $0 Polar checkout does not reliably keep ``users.billing_period_end``
    current the way a paid subscription's renewal webhooks do — it can be left
    NULL from signup, or simply never advance. This computes the same "renews on"
    date a real monthly Polar cycle would have produced, so it can be written back
    self-healing-on-read (see main.get_current_user), same pattern as the
    grace-period downgrade and _reset_elapsed_usage_periods.

    ``relativedelta`` clamps month-end overflow (Jan 31 + 1 month -> Feb 28/29),
    so the anchor day only shifts in months too short to contain it — it never
    drifts earlier the way repeated fixed-day timedelta arithmetic would.
    """
    anchor = created_at
    while anchor <= now:
        anchor = anchor + relativedelta(months=1)
    return anchor
