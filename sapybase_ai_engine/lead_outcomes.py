"""Lead outcome & pipeline analytics — pure, testable helpers (no I/O).

Closes the conversion loop: a captured lead moves through a simple sales
pipeline (new → contacted → won/lost) and, when won, carries a deal value.
That turns the ROI dashboard from *potential* revenue (leads × assumed value)
into *realized* revenue (sum of actual won deals).

The DB writes/reads live in main; these functions are pure so the status
validation and the pipeline/ROI math can be unit-tested without a database.
"""

# Canonical pipeline states. 'new' is the default at capture time.
LEAD_STATUSES = ("new", "contacted", "won", "lost")
OPEN_STATUSES = ("new", "contacted")
CLOSED_STATUSES = ("won", "lost")


def normalize_status(status):
    """Return the canonical lowercase status, or None if not a valid state.
    Case-insensitive and whitespace-tolerant; safe on None/non-str."""
    s = str(status or "").strip().lower()
    return s if s in LEAD_STATUSES else None


def is_valid_status(status) -> bool:
    return normalize_status(status) is not None


def _money(value) -> float:
    """Coerce a possibly-Decimal/None/str value to a non-negative float."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return 0.0
    return f if f > 0 else 0.0


def resolve_outcome_value(status, value_usd):
    """A deal value only makes sense for a won lead. For any other status the
    stored value is cleared (None) so realized-revenue math stays honest."""
    if normalize_status(status) == "won":
        v = _money(value_usd)
        return round(v, 2) if v > 0 else 0.0
    return None


def summarize_pipeline(leads) -> dict:
    """Summarize a set of leads into pipeline counts and realized-revenue stats.

    `leads` is an iterable of dicts with keys: status, value_usd.
    Unknown/blank statuses are bucketed as 'new' (the capture-time default).
    """
    counts = {s: 0 for s in LEAD_STATUSES}
    realized_revenue = 0.0
    for lead in (leads or []):
        status = normalize_status(lead.get("status")) or "new"
        counts[status] += 1
        if status == "won":
            realized_revenue += _money(lead.get("value_usd"))

    total = sum(counts.values())
    won = counts["won"]
    closed = won + counts["lost"]
    open_count = counts["new"] + counts["contacted"]

    win_rate = (won / closed) if closed else 0.0          # of decided deals
    conversion_rate = (won / total) if total else 0.0     # of all leads
    avg_deal_value = (realized_revenue / won) if won else 0.0

    return {
        "total": total,
        "new": counts["new"],
        "contacted": counts["contacted"],
        "won": won,
        "lost": counts["lost"],
        "open": open_count,
        "closed": closed,
        "realized_revenue": round(realized_revenue, 2),
        "avg_deal_value": round(avg_deal_value, 2),
        "win_rate": round(win_rate, 4),
        "conversion_rate": round(conversion_rate, 4),
    }
