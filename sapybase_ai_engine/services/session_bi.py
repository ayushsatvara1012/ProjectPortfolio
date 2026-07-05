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


# ── Token cost metering (Phase 6, Slice A) ────────────────────────────────────

def build_token_metrics(
    turns: Any,
    cache_hits: Any,
    input_tokens: Any,
    output_tokens: Any,
    metered_turns: Any,
    conversations: Any,
    cached_tokens: Any = 0,
) -> Dict[str, Any]:
    """Shape raw chat_logs aggregates into the owner-facing cost readout.

    Pure — the caller runs the SUM/COUNT query and passes the scalars. This is
    the "measure before you optimize" surface (Phase 6): it tells us the real token
    spend, the cache-hit rate, and cost-per-conversation so we can decide which
    cache tier is worth building. Averages are over METERED turns/conversations
    only (rows that actually reported usage — cache hits and legacy rows are NULL),
    so a partially-metered window isn't diluted toward zero.

    ``cached_tokens`` (Phase 6 Slice B) is the subset of ``input_tokens`` billed
    at Gemini's implicit context-cache discount — distinct from ``cache_hits``,
    which counts the older app-level exact-answer cache (always 0 for the
    vertical agent, since that cache is bypassed for it). ``prompt_cache_hit_rate``
    is the fraction of prompt tokens served from Gemini's cache — the number that
    tells us whether explicit caching would add anything on top of the automatic
    implicit cache.
    """
    turns = _safe_int(turns)
    cache_hits = _safe_int(cache_hits)
    in_tok = _safe_int(input_tokens)
    out_tok = _safe_int(output_tokens)
    metered = _safe_int(metered_turns)
    convos = _safe_int(conversations)
    cached_tok = _safe_int(cached_tokens)
    total = in_tok + out_tok
    return {
        "turns": turns,
        "metered_turns": metered,
        "cache_hits": cache_hits,
        "cache_hit_rate": round(cache_hits / turns, 4) if turns > 0 else 0.0,
        "input_tokens": in_tok,
        "output_tokens": out_tok,
        "total_tokens": total,
        "avg_tokens_per_turn": round(total / metered, 1) if metered > 0 else 0.0,
        "conversations": convos,
        "avg_tokens_per_conversation": round(total / convos, 1) if convos > 0 else 0.0,
        "cached_tokens": cached_tok,
        "prompt_cache_hit_rate": round(cached_tok / in_tok, 4) if in_tok > 0 else 0.0,
    }
