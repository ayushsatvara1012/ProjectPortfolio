"""Conversion-funnel analytics (pure, no I/O).

The endpoint in main.py runs the SQL COUNT(*) queries; this module turns the
raw stage counts into a funnel with per-stage conversion and drop-off, plus a
lead-quality breakdown.

Design note — why these four stages: scoring band (HOT/WARM/COLD) and pipeline
status (new/contacted/won/lost) are *orthogonal*, so a "scored -> contacted"
chain is NOT a nested funnel and would produce negative drop-offs. We use a
strictly nested chain instead, where each stage is a subset of the one above:

    conversations  >=  leads  >=  contacted (status != 'new')  >=  won

Lead quality is reported separately (it is a property of leads, not a funnel
stage). Real data can still violate conversations >= leads (e.g. legacy
chat_logs rows with a NULL session_id), so conversion is clamped to <=100% and
drop-off floored at 0 — the funnel never renders nonsense.
"""

# (key, human label) in funnel order, top first.
FUNNEL_STAGES = [
    ("conversations", "Conversations"),
    ("leads", "Leads captured"),
    ("contacted", "Contacted"),
    ("won", "Won"),
]

QUALITY_BANDS = ("hot", "warm", "cold")


def _safe_int(value) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        return 0
    return n if n > 0 else 0


def _pct(num: int, den: int) -> float:
    if den <= 0:
        return 0.0
    return round(100.0 * num / den, 1)


def build_funnel(counts: dict) -> dict:
    """Turn raw stage counts into a funnel.

    counts: dict keyed by FUNNEL_STAGES keys (missing/invalid -> 0).
    Returns {stages, top, won, overall_conversion} where each stage carries
    count, pct_of_top, pct_of_prev (clamped <=100) and dropoff_pct (floored 0).
    """
    ordered = [(k, label, _safe_int((counts or {}).get(k))) for k, label in FUNNEL_STAGES]
    top = ordered[0][2]

    stages = []
    prev = None
    for key, label, count in ordered:
        if prev is None:
            # Top stage: 100% if anyone entered the funnel at all, else 0.
            pct_prev = 100.0 if count > 0 else 0.0
            dropoff = 0.0
        elif prev <= 0:
            # Nothing in the stage above -> no flow to convert or drop.
            pct_prev = 0.0
            dropoff = 0.0
        else:
            pct_prev = min(_pct(count, prev), 100.0)
            dropoff = max(round(100.0 - pct_prev, 1), 0.0)
        stages.append({
            "key": key,
            "label": label,
            "count": count,
            "pct_of_top": min(_pct(count, top), 100.0),
            "pct_of_prev": pct_prev,
            "dropoff_pct": dropoff,
        })
        prev = count

    won = ordered[-1][2]
    return {
        "stages": stages,
        "top": top,
        "won": won,
        "overall_conversion": min(_pct(won, top), 100.0),
    }


def build_quality_breakdown(counts: dict) -> dict:
    """Normalize HOT/WARM/COLD lead counts into a breakdown with shares.

    counts: dict possibly keyed by any-case band names; unknown/None bands are
    ignored (unscored leads simply don't appear). Returns per-band count + share
    of all scored leads, plus the scored total.
    """
    norm = {}
    for raw, n in (counts or {}).items():
        band = (str(raw).strip().lower() if raw is not None else "")
        if band in QUALITY_BANDS:
            norm[band] = norm.get(band, 0) + _safe_int(n)

    total = sum(norm.get(b, 0) for b in QUALITY_BANDS)
    return {
        "total_scored": total,
        "bands": [
            {"band": b, "count": norm.get(b, 0), "pct": _pct(norm.get(b, 0), total)}
            for b in QUALITY_BANDS
        ],
    }
