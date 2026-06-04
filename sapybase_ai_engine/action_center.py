"""Action Center — prioritized 'leads needing attention' worklist (pure, no I/O).

Turns the dashboard from measurement into action. Open leads (new/contacted)
are ranked so the owner always knows the single most valuable thing to do next:
HOT leads first, uncontacted first, oldest-going-cold first.

The endpoint in main.py loads open leads from the DB and calls build_action_queue();
all ranking/urgency/age math lives here so it is unit-tested and deterministic.
"""
from datetime import datetime, timezone

OPEN_STATUSES = ("new", "contacted")

# Band base weights — the dominant ranking term (HOT always outranks WARM, etc.).
_BAND_BASE = {"HOT": 300, "WARM": 200, "COLD": 100}


def _band_norm(band) -> str:
    return str(band).strip().upper() if band else ""


def reference_age_hours(created_at, status_updated_at, status, now) -> float:
    """Hours a lead has waited for action.

    For 'contacted' leads we measure from the last status change (how long since
    you followed up); otherwise from creation (how long uncontacted). Returns 0
    for missing/future timestamps so the math never goes negative.
    """
    ref = status_updated_at if (status == "contacted" and status_updated_at) else created_at
    if ref is None:
        return 0.0
    try:
        delta = now - ref
    except TypeError:
        return 0.0
    return max(delta.total_seconds() / 3600.0, 0.0)


def attention_priority(band, status, age_hours, score=0) -> float:
    """Sortable urgency score (higher = act sooner).

    base(band) + new-bonus + age pressure (capped at 1 week) + a small tiebreak
    from the raw lead score.
    """
    base = _BAND_BASE.get(_band_norm(band), 50)
    new_bonus = 40 if status == "new" else 0
    age_component = min(max(age_hours, 0.0), 168.0)
    score_tiebreak = (score or 0) / 10.0
    return round(base + new_bonus + age_component + score_tiebreak, 2)


def urgency_level(band, status, age_hours) -> str:
    """Coarse urgency bucket ('high' | 'medium' | 'low') driving UI emphasis."""
    b = _band_norm(band)
    if b == "HOT":
        if status == "new":
            return "high"
        return "high" if age_hours >= 48 else "medium"
    if b == "WARM":
        if status == "new":
            return "high" if age_hours >= 24 else "medium"
        return "medium" if age_hours >= 72 else "low"
    # COLD (or unknown) — kept on the list but never escalated.
    return "low"


def _humanize_age(hours: float) -> str:
    if hours < 1:
        return "just now"
    if hours < 24:
        return f"{int(hours)}h"
    return f"{int(hours // 24)}d"


def attention_reason(band, status, age_hours) -> str:
    label = _band_norm(band).title() or "Lead"
    age = _humanize_age(age_hours)
    if status == "new":
        return f"{label} lead · uncontacted for {age}"
    return f"{label} lead · contacted {age} ago"


def build_action_queue(leads, now=None, limit=None) -> dict:
    """Rank open leads into an action worklist.

    leads: dicts with id, email, name, context, score, band, status,
           created_at, status_updated_at.
    Returns {"queue": [...sorted...], "counts": {high, medium, low, total}}.
    Closed leads (won/lost) and unknown statuses are excluded.
    """
    now = now or datetime.now(timezone.utc)
    queue = []
    counts = {"high": 0, "medium": 0, "low": 0, "total": 0}

    for ld in leads or []:
        status = (ld.get("status") or "new")
        if status not in OPEN_STATUSES:
            continue
        band = ld.get("band") or ld.get("score_band")
        score = ld.get("score") or 0
        age = reference_age_hours(
            ld.get("created_at"), ld.get("status_updated_at"), status, now
        )
        urgency = urgency_level(band, status, age)
        queue.append({
            "id": ld.get("id"),
            "email": ld.get("email"),
            "name": ld.get("name"),
            "context": ld.get("context"),
            "score": score,
            "band": _band_norm(band) or None,
            "status": status,
            "age_hours": round(age, 2),
            "priority": attention_priority(band, status, age, score),
            "urgency": urgency,
            "reason": attention_reason(band, status, age),
        })
        counts[urgency] += 1
        counts["total"] += 1

    queue.sort(key=lambda x: x["priority"], reverse=True)
    if limit is not None:
        queue = queue[:limit]
    return {"queue": queue, "counts": counts}
