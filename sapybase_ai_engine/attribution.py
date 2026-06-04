"""Lead source attribution (pure, no I/O).

Answers "where do my best leads come from?" by deriving a human source label
for each lead (UTM source > referrer host > 'Direct') and aggregating leads and
won revenue per source.

The endpoint in main.py loads leads (referrer, utm_source, status, value_usd)
and calls summarize_attribution(); all parsing/normalization/aggregation lives
here so it is deterministic and unit-tested.
"""
from urllib.parse import urlparse, parse_qs

_UTM_KEYS = ("utm_source", "utm_medium", "utm_campaign")


def _money(value) -> float:
    try:
        n = float(value)
    except (TypeError, ValueError):
        return 0.0
    return n if n > 0 else 0.0


def parse_utm(url) -> dict:
    """Extract utm_source/medium/campaign from a URL's query string.

    Returns a dict with those three keys (value or None). Case-insensitive on
    the key; takes the first value; tolerant of malformed/empty input.
    """
    out = {k: None for k in _UTM_KEYS}
    if not url or not isinstance(url, str):
        return out
    try:
        qs = parse_qs(urlparse(url).query)
    except Exception:
        return out
    lowered = {k.lower(): v for k, v in qs.items()}
    for key in _UTM_KEYS:
        vals = lowered.get(key)
        if vals and vals[0].strip():
            out[key] = vals[0].strip()
    return out


def normalize_source(referrer, utm_source) -> str:
    """Human source label: explicit utm_source wins, else the referrer host
    (sans 'www.'), else 'Direct'."""
    if utm_source and str(utm_source).strip():
        return str(utm_source).strip().lower()
    if referrer and isinstance(referrer, str) and referrer.strip():
        try:
            host = urlparse(referrer.strip()).netloc.lower()
        except Exception:
            host = ""
        if host.startswith("www."):
            host = host[4:]
        if host:
            return host
    return "Direct"


def summarize_attribution(leads, limit=None) -> dict:
    """Aggregate leads by source.

    leads: dicts with referrer, utm_source, status, value_usd.
    Returns {sources: [{source, leads, won, won_value, win_rate}], total_leads,
    total_sources} sorted by lead volume (won revenue as tiebreak).
    """
    buckets = {}
    total_leads = 0
    for ld in leads or []:
        total_leads += 1
        src = normalize_source(ld.get("referrer"), ld.get("utm_source"))
        b = buckets.setdefault(src, {"source": src, "leads": 0, "won": 0, "won_value": 0.0})
        b["leads"] += 1
        if (ld.get("status") or "") == "won":
            b["won"] += 1
            b["won_value"] += _money(ld.get("value_usd"))

    rows = []
    for b in buckets.values():
        b["won_value"] = round(b["won_value"], 2)
        b["win_rate"] = round(b["won"] / b["leads"], 4) if b["leads"] else 0.0
        rows.append(b)
    rows.sort(key=lambda x: (x["leads"], x["won_value"]), reverse=True)

    total_sources = len(buckets)
    if limit is not None:
        rows = rows[:limit]
    return {"sources": rows, "total_leads": total_leads, "total_sources": total_sources}
