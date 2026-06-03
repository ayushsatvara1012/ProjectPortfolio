"""Fixes-Needed worklist construction.

Pure function — no I/O, no DB, no external state. Turns aggregated chat_logs
rows into a ranked gap worklist. Extracted verbatim from main.py (no logic
changes) so it can be unit tested in isolation.
"""

# ── FIXES NEEDED (gap worklist) ─────────────────────────────────────────────

def _build_fixes_list(rows, min_confidence: float = 0.4, limit: int = 50):
    """Pure: turn aggregated chat_logs rows into a ranked 'fixes needed' worklist.

    Each input row is a sequence:
        (representative_query, ask_count, last_asked_iso, group_confidence, has_unanswered)
    where group_confidence is the AVG grounding for the question (None if unknown).

    Classification per question group:
      * 'unanswered'     -> bot fell back at least once  (highest priority)
      * 'low_confidence' -> always answered, but typical grounding was weak
                            (group_confidence is not None AND < threshold)
      * excluded         -> answered well, OR grounding unknown (NULL: cache hits /
                            pre-migration rows are never falsely flagged)

    Ordering: unanswered first, then ask_count desc, then last_asked desc.
    """
    items = []
    for row in rows:
        query, ask_count, last_asked, group_conf, has_unanswered = row
        q = (query or "").strip()
        if not q:
            continue
        if has_unanswered:
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
    items.sort(key=lambda it: 0 if it["category"] == "unanswered" else 1)
    return items[:limit]
