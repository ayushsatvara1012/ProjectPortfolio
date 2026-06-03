"""Small, pure parsing helpers (no I/O, no DB).

Extracted verbatim from main.py (no logic changes) so they can be reused and
unit-tested in isolation without importing the whole app.
"""

import json


def safe_json_loads(val):
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return []
    return val or []


def normalize_quick_questions(raw):
    """Convert stored quick_questions (old {label,prompt} or new plain string) to list[str]."""
    items = safe_json_loads(raw)
    result = []
    for item in items:
        if isinstance(item, dict):
            result.append(item.get("label") or item.get("prompt") or "")
        elif isinstance(item, str):
            result.append(item)
    return [q for q in result if q]
