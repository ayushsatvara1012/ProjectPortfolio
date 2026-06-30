"""Session-level business intelligence (Phase 3 — pure, no I/O).

Reads pre-computed JSONB columns written by Phase 2 (agent_sessions.state +
agent_sessions.lead_profile) and turns them into owner-facing BI signal:

    product_demand  — what products/grades visitors asked about (most→least)
    stage_funnel    — how many sessions reached each funnel stage
    lost_sales      — POR escalations + sessions that dropped before capture
    lead_quality    — HOT/WARM/COLD breakdown from lead_profile.band

No I/O here — callers (main.py endpoint) run the SQL and pass raw rows.
Same discipline as funnel.py / lead_scoring.py.
"""

from typing import Any, Dict, List, Optional

# ── Constants ─────────────────────────────────────────────────────────────────

STAGE_ORDER = [
    "browsing",
    "qualifying",
    "recommended",
    "quoted",
    "captured",
    "handed_off",
]

QUALITY_BANDS = ["hot", "warm", "cold"]


# ── Product demand ─────────────────────────────────────────────────────────────

def build_demand_signal(
    rows: List[Dict[str, Any]],
    top_n: int = 10,
) -> List[Dict[str, Any]]:
    """Count (product, grade) pairs across sessions.

    rows: list of dicts with keys 'product_name' (str), 'grade' (str | None),
          'session_count' (int). Typically the result of a GROUP BY JSONB unnest.
    Returns sorted list (most-demanded first), capped to top_n.
    """
    from collections import defaultdict

    counts: Dict[tuple, int] = defaultdict(int)
    for r in (rows or []):
        name = (r.get("product_name") or "").strip()
        grade = (r.get("grade") or "").strip() or None
        n = int(r.get("session_count") or 0)
        if name:
            counts[(name, grade)] += n

    ranked = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
    return [
        {"product": name, "grade": grade, "sessions": count}
        for (name, grade), count in ranked
    ]


# ── Stage funnel ───────────────────────────────────────────────────────────────

def _safe_int(v: Any) -> int:
    try:
        n = int(v)
        return max(n, 0)
    except (TypeError, ValueError):
        return 0


def build_stage_funnel(stage_counts: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Convert raw stage counts to an ordered funnel list.

    stage_counts: dict of {stage_name: count} (missing stages → 0).
    Returns STAGE_ORDER entries with count and pct_of_top (clamped 0–100).
    """
    counts = {s: _safe_int((stage_counts or {}).get(s, 0)) for s in STAGE_ORDER}

    # Group handed_off into captured for display (both = "conversion").
    counts["captured"] = counts.get("captured", 0) + counts.pop("handed_off", 0)

    display_order = [s for s in STAGE_ORDER if s != "handed_off"]
    top = max((_safe_int(counts.get(s, 0)) for s in display_order), default=0)

    result = []
    for stage in display_order:
        count = _safe_int(counts.get(stage, 0))
        pct = round(100.0 * count / top, 1) if top > 0 else 0.0
        result.append({
            "stage": stage,
            "label": _stage_label(stage),
            "count": count,
            "pct_of_top": min(pct, 100.0),
        })
    return result


def _stage_label(stage: str) -> str:
    return {
        "browsing": "Browsing",
        "qualifying": "Qualifying",
        "recommended": "Product shown",
        "quoted": "Quoted",
        "captured": "Lead captured",
    }.get(stage, stage.capitalize())


# ── Lost sales ────────────────────────────────────────────────────────────────

def build_lost_sales(
    por_count: int,
    quoted_not_captured: int,
) -> Dict[str, Any]:
    """Summarise signals where a sale did not complete.

    por_count             — sessions that received a "price on request" quote
                            (product exists but is not priced in the catalog)
    quoted_not_captured   — sessions that reached 'quoted' stage but never
                            provided contact details (buyer left without capture)
    """
    total = _safe_int(por_count) + _safe_int(quoted_not_captured)
    return {
        "total": total,
        "por_escalations": _safe_int(por_count),
        "quoted_not_captured": _safe_int(quoted_not_captured),
    }


# ── Lead quality ──────────────────────────────────────────────────────────────

def build_lead_quality(band_counts: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize HOT/WARM/COLD counts into shares.

    band_counts: dict possibly with any-case band keys. Unknown bands ignored.
    Returns bands list + total_scored (unscored sessions not included).
    """
    norm: Dict[str, int] = {}
    for raw, n in (band_counts or {}).items():
        b = str(raw or "").strip().lower()
        if b in QUALITY_BANDS:
            norm[b] = norm.get(b, 0) + _safe_int(n)

    total = sum(norm.get(b, 0) for b in QUALITY_BANDS)
    return {
        "total_scored": total,
        "bands": [
            {
                "band": b,
                "count": norm.get(b, 0),
                "pct": round(100.0 * norm.get(b, 0) / total, 1) if total > 0 else 0.0,
            }
            for b in QUALITY_BANDS
        ],
    }
