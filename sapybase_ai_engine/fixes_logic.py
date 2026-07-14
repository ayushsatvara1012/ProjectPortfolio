"""Fixes-Needed worklist construction.

Pure function — no I/O, no DB, no external state. Turns aggregated chat_logs
rows into a ranked gap worklist. Extracted verbatim from main.py (no logic
changes) so it can be unit tested in isolation.
"""
from typing import Optional, Set

# ── FIXES NEEDED (gap worklist) ─────────────────────────────────────────────

def _build_fixes_list(
    rows,
    min_confidence: float = 0.4,
    limit: int = 50,
    downvoted_queries: Optional[Set[str]] = None,
):
    """Pure: turn aggregated chat_logs rows into a ranked 'fixes needed' worklist.

    Each input row is a sequence:
        (representative_query, ask_count, last_asked_iso, group_confidence, has_unanswered)
    where group_confidence is the AVG grounding for the question (None if unknown).

    `downvoted_queries` (Phase 2b, vertical intelligence plan) is an optional
    set of normalized (lowercased, trimmed) queries that received an explicit
    thumbs-down (chat_logs.feedback = -1, control-plane only for now). A
    downvote is a direct visitor signal — stronger than the implicit
    is_unanswered/confidence heuristics — so it outranks both AND includes the
    question even if it would otherwise be excluded (well-answered by
    confidence, but the visitor still said it was wrong).

    Classification per question group:
      * 'downvoted'      -> a visitor thumbs-downed this answer at least once
                            (highest priority)
      * 'unanswered'     -> bot fell back at least once
      * 'low_confidence' -> always answered, but typical grounding was weak
                            (group_confidence is not None AND < threshold)
      * excluded         -> answered well, OR grounding unknown (NULL: cache hits /
                            pre-migration rows are never falsely flagged)

    Ordering: downvoted first, then unanswered, then ask_count desc, then
    last_asked desc.
    """
    downvoted_queries = downvoted_queries or set()
    priority = {"downvoted": 0, "unanswered": 1, "low_confidence": 2}
    items = []
    for row in rows:
        query, ask_count, last_asked, group_conf, has_unanswered = row
        q = (query or "").strip()
        if not q:
            continue
        if q.lower() in downvoted_queries:
            category = "downvoted"
        elif has_unanswered:
            category = "unanswered"
        elif group_conf is not None and group_conf < min_confidence:
            category = "low_confidence"
        else:
            continue
        items.append({
            "query": q,
            "ask_count": int(ask_count or 0),
            "last_asked": last_asked,
            "confidence": (round(float(group_conf), 2) if group_conf is not None else None),
            "category": category,
        })

    # Stable multi-key sort (apply least-significant key first).
    items.sort(key=lambda it: it["last_asked"] or "", reverse=True)
    items.sort(key=lambda it: it["ask_count"], reverse=True)
    items.sort(key=lambda it: priority[it["category"]])
    return items[:limit]
