"""Specification finder - Drive-backed spec-sheet search for the chemical pack.

Plan `docs/spec-finder-plan.md` Phase 1.

A separate module from `services/coa_drive.py` by decision (D4), not by accident.
Certificates are confidential and resolve to one document or nothing; specifications
are public and are meant to be browsed, so the two share plumbing and nothing else.
What is imported below is policy-free: the tokenizer, the folder walk, the cache
codec, the report builders. What is NOT imported is the confidentiality design -
`lookup`, the throttle, the single refusal.

This module owns its own breaker, forced-walk gate and memo. That is what makes a
revoked spec folder unable to fast-fail COA lookups, consume COA's re-walk
allowance, or evict COA's cached listing (§9.1).
"""
from __future__ import annotations

import logging
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

import httpx

from byod_breaker import BreakerConfig, BreakerOpen, BreakerRegistry
from services.coa_drive import (
    _EXTENSION_SUFFIX,
    CACHE_TTL_SECONDS,
    CoaDocument as DriveDocument,
    CoaDriveError as SpecDriveError,
    WalkResult,
    decode_payload,
    deserialize_index,
    encode_index,
    folder_report,
    numeric_key,
    scrub,
    to_payload as _drive_payload,
    tokenize,
    walk_folder,
)

logger = logging.getLogger("spec_drive")

__all__ = [
    "DriveDocument", "SpecDriveError", "SearchResult", "WalkResult",
    "search", "resolve", "load_index", "cache_key", "forced_walk_key",
    "folder_report", "to_payload",
    "reset_index_memo", "reset_breakers", "reset_forced_walk_gate", "breaker_state",
    "RESULT_LIMIT", "MIN_QUERY_CHARS", "BROAD_MATCH_RATIO", "BROAD_GUARD_MIN_LIBRARY",
]


# ─────────────────────────────── pure: search ───────────────────────────────

# Ordered strongest-first so an exact hit anywhere beats a prefix hit anywhere.
MATCH_EXACT = 4
MATCH_PREFIX = 3
MATCH_SUBSTRING = 2
MATCH_NUMERIC = 1

# One token is a legitimate specification query - "acetone" is the whole point of
# this feature - so COA's two-token floor is deliberately not carried over (§4.1).
# The character floor stays: it costs nothing and keeps a stray keystroke off Drive.
MIN_QUERY_CHARS = 2

# Sized for a typeahead list a visitor scans without scrolling, not for a results
# page. COA's old cap was 50.
RESULT_LIMIT = 8

# The selectivity guard (§4.1). `SPEC` appears in 1,028 of the client's 1,086
# filenames, so `spec` alone matches 94% of the library and `LR` matches 20% - both
# would otherwise return an arbitrary eight rows. A query that fails to select is
# answered with "keep typing" instead of a slice.
#
# Measured against the real folder: `isopropyl alcohol`, the widest legitimate
# product query, matches 41 of 1,086 (3.8%) and passes with a wide margin; `LR`
# (20.2%) trips. Deliberately NOT inverse-document-frequency weighting, which would
# silently reorder results tuned against a real 1,781-file folder to solve a problem
# that only appears at this one point.
BROAD_MATCH_RATIO = 0.15

# The floor risk 4 asks for. In a library of twelve documents a real product query
# legitimately matches most of it, so the guard must not exist there at all.
BROAD_GUARD_MIN_LIBRARY = 100


@dataclass(frozen=True)
class SearchResult:
    """What one query did. `status` is what the panel renders, not `documents` alone.

    `empty` and `too_broad` are deliberately distinguishable, which is the exact
    opposite of COA's C3 and correct here: a visitor who typed too little must be
    told to type more, and one who named a product we do not stock must be told we
    have nothing. Collapsing them would give both the wrong instruction.
    """

    status: str                              # ok | empty | too_broad | too_short
    documents: Tuple[DriveDocument, ...] = ()
    total_matched: int = 0

    @property
    def truncated(self) -> bool:
        return self.total_matched > len(self.documents)


def _token_score(query_token: str, tokens: Sequence[str],
                 numeric_tokens: Sequence[str]) -> int:
    """How strongly one query token hits a file, 0 for not at all."""
    if query_token in tokens:
        return MATCH_EXACT
    if any(t.startswith(query_token) for t in tokens):
        return MATCH_PREFIX
    if any(query_token in t for t in tokens):
        return MATCH_SUBSTRING
    if numeric_key(query_token) in numeric_tokens:
        return MATCH_NUMERIC
    return 0


def search(documents: Sequence[DriveDocument], query: Any,
           limit: Optional[int] = None) -> SearchResult:
    """Rank specification sheets against a free-text query (§4).

    Restored from the COA finder's original `search()` (`c0162cea`), which was
    deleted when certificates became confidential and was tuned against 1,781 real
    files. Two passes. **Strict**: every query token must hit something, which is
    what makes `acetone USP` narrow 20 candidates to 4. **Fallback**, only when
    strict found nothing: the documents matching the MOST query tokens, so a typo or
    a filler word degrades into close suggestions instead of a dead end.
    """
    query_tokens = tokenize(query)
    # H6 - "every query token must match" is VACUOUSLY TRUE for zero tokens, so a
    # query of "___" would return the entire folder. Both checks run AFTER
    # tokenizing, because "___" is three characters and no tokens.
    if not query_tokens or sum(len(t) for t in query_tokens) < MIN_QUERY_CHARS:
        return SearchResult("too_short")

    strict: List[Tuple[int, int, DriveDocument, int]] = []
    loose: List[Tuple[int, int, DriveDocument, int]] = []
    for doc in documents:
        scores = [_token_score(t, doc.tokens, doc.numeric_tokens) for t in query_tokens]
        matched = sum(1 for s in scores if s)
        if not matched:
            continue
        entry = (matched, sum(scores), doc, max(scores))
        (strict if matched == len(query_tokens) else loose).append(entry)

    ranked = strict
    from_fallback = False
    if not ranked and loose:
        # A substring-only hit is too weak to carry a fallback result on its own:
        # short filler words match half the corpus that way ("ME" inside "METHANOL").
        # Require at least one token at prefix strength, then keep only the documents
        # that matched the MOST tokens.
        strong = [e for e in loose if e[3] >= MATCH_PREFIX]
        if strong:
            best = max(e[0] for e in strong)
            ranked = [e for e in strong if e[0] == best]
            from_fallback = True

    if not ranked:
        return SearchResult("empty")
    if _is_too_broad(len(ranked), len(documents)):
        # WHICH pass produced the broad set decides what to tell the visitor, and
        # getting this backwards hands them the one instruction that cannot work.
        #
        # A broad STRICT result means every word they typed matched and together
        # failed to select - "acetone USP" against a library where most sheets are
        # acetone. More typing is exactly what helps.
        #
        # A broad FALLBACK result means their words did NOT all match, and what is
        # left is every file sharing whichever common word did. "Benzene USP" on a
        # library with no benzene degrades to every USP sheet there is. Telling them
        # to keep typing is false - no amount of typing conjures a product we do not
        # stock - and "we have nothing for that" is the true answer.
        if from_fallback:
            return SearchResult("empty")
        return SearchResult("too_broad", total_matched=len(ranked))

    # Three stable sorts, least significant first - the readable way to express
    # "matched count, then score, then newest, then file ID" when the recency key is
    # a string that sorts DESCENDING while everything after it sorts ascending.
    ranked.sort(key=lambda e: e[2].file_id)
    ranked.sort(key=lambda e: e[2].modified_time or "", reverse=True)
    ranked.sort(key=lambda e: (-e[0], -e[1]))

    # Resolved here rather than as a default argument, which would bind RESULT_LIMIT
    # once at import and quietly ignore any later change to it.
    limit = max(1, RESULT_LIMIT if limit is None else limit)
    return SearchResult(
        "ok",
        documents=tuple(e[2] for e in ranked[:limit]),
        total_matched=len(ranked),
    )


def _is_too_broad(matched: int, library_size: int) -> bool:
    """Did the query fail to select anything, rather than select too much?"""
    if library_size < BROAD_GUARD_MIN_LIBRARY:
        return False
    return matched >= library_size * BROAD_MATCH_RATIO


def to_payload(doc: DriveDocument) -> Dict[str, Any]:
    """One result row for the panel - the Drive row and nothing else (D5).

    The COA payload plus ``ext``, which §15 asks for and the certificate panel does
    not need: it serves one document and hardcodes ``.pdf``. A browsable library may
    hold a ``.docx`` specification, and saving that under a ``.pdf`` name hands the
    customer a file their reader refuses - the same corrupt-download failure as H8,
    from the other direction. The widget has no other way to know: ``display`` has
    the extension stripped and the download URL carries a file ID, not a name.
    """
    return {**_drive_payload(doc), "ext": _extension(doc.name)}


def _extension(raw_name: str) -> str:
    match = _EXTENSION_SUFFIX.search((raw_name or "").strip())
    return match.group(1).lower() if match else "pdf"


# ─────────────────────────────── I/O: cache ─────────────────────────────────

def cache_key(company_id: Any, folder_id: str) -> str:
    """`spec:folder:{company_id}:{folder_id}` - a different prefix from COA's.

    The folder ID is in the key so re-pointing the dashboard abandons the old
    listing for free, and the prefix is what keeps two libraries from colliding even
    when an owner pastes the same folder into both fields.
    """
    return f"spec:folder:{company_id}:{folder_id}"


async def _cache_get(redis_client: Any, key: str) -> Optional[WalkResult]:
    """H13 - a Redis outage degrades to walking: slower, still correct, never a 500."""
    if redis_client is None:
        return None
    try:
        return deserialize_index(decode_payload(await redis_client.get(key)))
    except Exception as exc:
        logger.warning("Spec cache read failed (%s)", scrub(exc))
        return None


async def _cache_put(redis_client: Any, key: str, result: WalkResult) -> None:
    if redis_client is None:
        return
    try:
        await redis_client.setex(key, CACHE_TTL_SECONDS, encode_index(result))
    except Exception as exc:
        logger.warning("Spec cache write failed (%s)", scrub(exc))


# The parsed listing, so a warm worker searches without touching Redis or JSON. Own
# dict and own cap (§9.1): sharing COA's would mean two libraries evicting each
# other. One real spec listing is ~1,086 documents, so 8 entries is roughly 10 MB
# worst case, on the same order as COA's own memo.
INDEX_MEMO_MAX_ENTRIES = 8
_index_memo: "OrderedDict[str, Tuple[float, WalkResult]]" = OrderedDict()


def reset_index_memo() -> None:
    """Drop every memoized listing. For tests and for a folder re-point."""
    _index_memo.clear()


def _memo_get(key: str, now: Optional[float] = None) -> Optional[WalkResult]:
    entry = _index_memo.get(key)
    if entry is None:
        return None
    expires_at, result = entry
    if (time.monotonic() if now is None else now) >= expires_at:
        _index_memo.pop(key, None)
        return None
    _index_memo.move_to_end(key)
    return result


def _memo_put(key: str, result: WalkResult, now: Optional[float] = None) -> None:
    now = time.monotonic() if now is None else now
    _index_memo[key] = (now + CACHE_TTL_SECONDS, result)
    _index_memo.move_to_end(key)
    while len(_index_memo) > INDEX_MEMO_MAX_ENTRIES:
        _index_memo.popitem(last=False)


# ────────────────────────── I/O: circuit breaker (H15) ──────────────────────────

# Same shape as COA's and a separate registry, which is the whole point: a spec
# folder whose sharing is revoked must not fast-fail that company's certificate
# lookups for the cooldown.
SPEC_BREAKER_CONFIG = BreakerConfig(
    failure_threshold=3,
    reset_timeout_seconds=60.0,
    success_threshold=1,
    half_open_max_probes=1,
)
_breakers = BreakerRegistry(SPEC_BREAKER_CONFIG)


def reset_breakers() -> None:
    """Drop every breaker. For tests, and for a folder re-point."""
    global _breakers
    _breakers = BreakerRegistry(SPEC_BREAKER_CONFIG)


def breaker_state(company_id: Any) -> str:
    return _breakers.state_of(str(company_id)).value


async def load_index(
    company_id: Any,
    folder_id: str,
    *,
    redis_client: Any = None,
    api_key: str = "",
    client: Optional[httpx.AsyncClient] = None,
    force: bool = False,
    bypass_breaker: bool = False,
) -> Tuple[WalkResult, bool]:
    """The cached folder listing. Returns `(result, from_cache)`.

    Three tiers, cheapest first: the in-process memo, Redis, then Drive.
    `force=True` skips both caches, which is how a sheet uploaded two minutes ago
    becomes findable and why there is no cron job.
    `bypass_breaker=True` is for the owner's own Test Connection, which must reach
    Drive even while the breaker is open - the owner has usually just fixed the
    sharing setting and is clicking to find out whether it worked.
    """
    key = cache_key(company_id, folder_id)
    if not force:
        memoized = _memo_get(key)
        if memoized is not None:
            return memoized, True
        cached = await _cache_get(redis_client, key)
        if cached is not None:
            _memo_put(key, cached)
            return cached, True

    breaker = _breakers.get(str(company_id))
    if not bypass_breaker:
        try:
            breaker.before_request()
        except BreakerOpen:
            logger.warning(
                "Spec walk short-circuited for company %s (breaker open)", company_id)
            raise SpecDriveError("unavailable") from None

    try:
        result = await walk_folder(folder_id, api_key, client=client)
    except SpecDriveError as exc:
        # A folder ID that never passed validation, or a missing platform key, never
        # touched Drive - counting those would trip the breaker on a config mistake
        # and then hide the fix behind a cooldown.
        if exc.reason in ("invalid_folder", "not_configured"):
            breaker.on_ignore()
        else:
            breaker.on_failure()
        raise
    if bypass_breaker:
        _breakers.reset(str(company_id))
    else:
        breaker.on_success()

    # Memoized before the Redis write so a dead Redis still gets the benefit (H13).
    _memo_put(key, result)
    await _cache_put(redis_client, key, result)
    return result, False


# ────────────────────── I/O: forced-walk single flight (H5) ──────────────────────

FORCED_WALK_COOLDOWN_SECONDS = 60
_last_forced_walk: Dict[str, float] = {}


def forced_walk_key(company_id: Any) -> str:
    """`spec:forced:{company_id}` - its own prefix, its own allowance.

    Company-scoped rather than folder-scoped, because the point is to bound Drive
    traffic per tenant and re-pointing the folder must not hand out a fresh
    allowance. The `spec:` prefix is what stops a visitor searching specifications
    from consuming the re-walk that would have found a customer's certificate.
    """
    return f"spec:forced:{company_id}"


def _local_forced_walk_allowed(company_id: Any, now: float) -> bool:
    """The in-process half. Checks without committing, so a Redis refusal does not
    silently consume this worker's allowance too."""
    last = _last_forced_walk.get(str(company_id))
    return last is None or (now - last) >= FORCED_WALK_COOLDOWN_SECONDS


async def forced_walk_allowed(
    company_id: Any,
    redis_client: Any = None,
    *,
    now: Optional[float] = None,
) -> bool:
    """May this request force a re-walk? (H5)

    Two gates, cheap one first. The in-process timestamp is also the WHOLE gate when
    Redis is unavailable: an outage must degrade to "one forced walk per worker per
    minute", never to "no limit at all".
    """
    now = time.monotonic() if now is None else now
    if not _local_forced_walk_allowed(company_id, now):
        return False

    if redis_client is not None:
        try:
            acquired = await redis_client.set(
                forced_walk_key(company_id), b"1", nx=True,
                ex=FORCED_WALK_COOLDOWN_SECONDS)
        except Exception as exc:
            logger.warning("Spec forced-walk gate unavailable (%s)", scrub(exc))
            acquired = True     # degrade to the in-process gate, which just passed
        if not acquired:
            return False

    _last_forced_walk[str(company_id)] = now
    return True


def reset_forced_walk_gate() -> None:
    """Drop the in-process half of the gate. For tests."""
    _last_forced_walk.clear()


# ──────────────────────────────── the resolver ────────────────────────────────

async def resolve(
    company_id: Any,
    folder_id: str,
    query: Any,
    *,
    limit: Optional[int] = None,
    redis_client: Any = None,
    api_key: str = "",
    client: Optional[httpx.AsyncClient] = None,
) -> SearchResult:
    """The specification sheets a query identifies (§4, §6).

    **The one resolver.** The panel endpoint and the chat path both call this, so
    the two can never disagree about what a product name finds.

    A query that matched NOTHING against a CACHED listing triggers one forced
    re-walk, which is what makes a sheet uploaded minutes ago findable. Only that
    case: a `too_broad` query has already found plenty and a re-walk returns the
    same files, so re-walking on anything but an empty result would spend a Drive
    call on every `spec` a visitor types.
    """
    result, from_cache = await load_index(
        company_id, folder_id, redis_client=redis_client, api_key=api_key, client=client)
    found = search(result.documents, query, limit)
    if found.status != "empty" or not from_cache:
        return found

    if not await forced_walk_allowed(company_id, redis_client):
        return found

    refreshed, _ = await load_index(
        company_id, folder_id, redis_client=redis_client, api_key=api_key,
        client=client, force=True)
    return search(refreshed.documents, query, limit)
