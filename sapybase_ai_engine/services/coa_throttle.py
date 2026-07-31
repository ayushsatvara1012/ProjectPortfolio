"""COA lookup throttle — plan `docs/coa-confidential-access-plan.md` §5 (C4, C7, C8).

Someone entering wrong values repeatedly is exploring, not shopping. Three misses in
five minutes disables the lookup for fifteen, and the lockout is *visible* (§5.1): it
describes our rate limit, which says nothing about any certificate, so it is the one
outcome deliberately distinguishable from C3's single refusal.

**Bound to the visitor, not the session, and not primarily to the IP.** ``sessionId``
rotates on "New conversation" — one click — so a session-bound counter would be no
throttle at all. ``visitorId`` is device-local and already sent to the backend. Per-IP
is the *backstop*, never the primary axis: corporate NAT and CGNAT put many people
behind one address, so a tight per-IP rule punishes exactly the bystanders it is meant
to protect while the person it targets rotates addresses for free.

A separate module from ``coa_drive`` because none of this is about Drive: it counts
refusals and holds a cooldown, and it is called by both visitor paths (the panel
endpoint and the ``get_coa`` tool) so a conversation cannot be the bypass (C6).

**The disabled field is presentation, never the control.** Every gate here runs on the
server, before the lookup, whatever the interface is showing.
"""
from __future__ import annotations

import hashlib
import logging
import time
from collections import OrderedDict
from datetime import date, datetime, timedelta, timezone
from typing import Any, List, Optional, Tuple

logger = logging.getLogger("coa_throttle")

# The tripwire for random typing (C4). Small on purpose: a customer holding a drum
# reads the code off the label, and three failures is already the point at which a
# human should be talking to a human rather than typing.
MISS_LIMIT = 3
MISS_WINDOW_SECONDS = 300
LOCKOUT_SECONDS = 900

# The backstop, for a script that clears its `visitorId` between attempts. Loose
# enough that a shared office never reaches it — twenty *failed* lookups in an hour
# from one address is not a floor of colleagues checking their own certificates.
IP_MISS_LIMIT = 20
IP_MISS_WINDOW_SECONDS = 3600

# The owner's tripwire (§8). Probing is completely invisible today, and a count the
# owner can see is worth more than another control: someone walking the batch sequence
# shows up here as a number no ordinary week produces. A day key rather than a table,
# per D9 — and one extra day of TTL so the oldest day in the window is still readable
# on the day it is last counted.
MISS_LEDGER_DAYS = 7
LEDGER_TTL_SECONDS = (MISS_LEDGER_DAYS + 1) * 86400

# Identifiers are hashed into the key rather than embedded. `visitor_id` arrives from
# the browser, so it is attacker-controlled: raw, it could carry a megabyte, or a `:`
# that walks into another company's key space. Hashing fixes the length, removes the
# separator problem, and keeps a raw IP out of Redis for free.
_KEY_HASH_LEN = 32

# The in-process half (C8). Bounded, because these are keyed by visitor and a busy
# tenant would otherwise grow them without limit; entries are tiny and expire, so this
# only ever bites under a flood, where dropping the oldest is the right loss.
MAX_LOCAL_ENTRIES = 20000
_local_misses: "OrderedDict[str, Tuple[int, float]]" = OrderedDict()
_local_locks: "OrderedDict[str, float]" = OrderedDict()


def reset_local_state() -> None:
    """Drop the in-process counters. For tests."""
    _local_misses.clear()
    _local_locks.clear()


def _digest(value: Any) -> str:
    return hashlib.sha256(str(value).encode("utf-8", "replace")).hexdigest()[:_KEY_HASH_LEN]


def miss_key(company_id: Any, identity: Any, *, ip: bool = False) -> str:
    """Company-scoped so one tenant's traffic can never lock out another's visitor."""
    scope = "ip" if ip else "v"
    return f"coa:miss:{scope}:{company_id}:{_digest(identity)}"


def lock_key(company_id: Any, identity: Any, *, ip: bool = False) -> str:
    scope = "ip" if ip else "v"
    return f"coa:lock:{scope}:{company_id}:{_digest(identity)}"


def ledger_key(company_id: Any, day: date) -> str:
    """No visitor in this key: the owner gets a count, never an identity.

    Surfacing who missed would turn a tripwire into a record of individual customers'
    failed attempts, which is the privacy decision L1 declines to make in passing.
    """
    return f"coa:missday:{company_id}:{day.isoformat()}"


def _today(day: Optional[date]) -> date:
    """UTC, so every worker agrees on where a day starts.

    The panel reads a rolling window rather than "today", so the owner never sees a
    boundary that disagrees with their own clock.
    """
    return day if day is not None else datetime.now(timezone.utc).date()


# ────────────────────────────── the in-process half ──────────────────────────────

def _prune(store: "OrderedDict[str, Any]") -> None:
    while len(store) > MAX_LOCAL_ENTRIES:
        store.popitem(last=False)


def _local_lock_ttl(key: str, now: float) -> int:
    expires_at = _local_locks.get(key)
    if expires_at is None:
        return 0
    if now >= expires_at:
        _local_locks.pop(key, None)
        return 0
    return max(1, int(expires_at - now))


def _local_record(key: str, lock: str, limit: int, window: int, now: float) -> int:
    """Count one miss locally and return the lockout it just earned, or 0.

    The window is fixed from the FIRST miss rather than sliding with each one, which
    matches what Redis does below with a TTL set on the first `INCR` — two
    implementations of one rule have to agree on where the window starts or a Redis
    outage silently changes the behaviour.
    """
    count, expires_at = _local_misses.get(key, (0, 0.0))
    if now >= expires_at:
        count, expires_at = 0, now + window
    count += 1
    _local_misses[key] = (count, expires_at)
    _local_misses.move_to_end(key)
    _prune(_local_misses)
    if count < limit:
        return 0
    _local_misses.pop(key, None)
    _local_locks[lock] = now + LOCKOUT_SECONDS
    _local_locks.move_to_end(lock)
    _prune(_local_locks)
    return LOCKOUT_SECONDS


# ───────────────────────────────── the Redis half ─────────────────────────────────

async def _redis_lock_ttl(redis_client: Any, key: str) -> int:
    """Seconds left on a lock, 0 if there is none.

    A Redis failure answers 0 — C8, counters degrade OPEN. This is a soft control on a
    feature whose real security property is uniqueness (C2), so an outage must cost a
    throttle, never a customer their certificate.
    """
    try:
        ttl = await redis_client.ttl(key)
    except Exception as exc:
        logger.warning("COA throttle unavailable (%s)", exc)
        return 0
    try:
        ttl = int(ttl)
    except (TypeError, ValueError):
        return 0
    # -1 is "no expiry", -2 is "no key". Neither should exist here; both mean "not
    # locked" rather than "locked forever", which is the safe reading of a key we
    # always write with a TTL.
    return ttl if ttl > 0 else 0


async def _redis_record(redis_client: Any, key: str, lock: str, limit: int, window: int) -> int:
    try:
        count = int(await redis_client.incr(key))
        if count == 1:
            await redis_client.expire(key, window)
        if count < limit:
            return 0
        await redis_client.set(lock, b"1", ex=LOCKOUT_SECONDS)
        await redis_client.delete(key)
        return LOCKOUT_SECONDS
    except Exception as exc:
        logger.warning("COA throttle counter unavailable (%s)", exc)
        return 0


# ─────────────────────────── the owner's ledger (§8) ───────────────────────────

async def _record_ledger(redis_client: Any, company_id: Any, day: Optional[date]) -> None:
    """Count one refused lookup for the owner's report.

    Redis only, with no in-process fallback, and that is the point: this number is
    written by every worker and read by one, so a per-worker counter would report a
    fraction of the truth *as if it were the whole of it*. Losing an outage's worth of
    counts is the honest failure; reporting a sixth of them as a total is not.
    """
    key = ledger_key(company_id, _today(day))
    try:
        if int(await redis_client.incr(key)) == 1:
            await redis_client.expire(key, LEDGER_TTL_SECONDS)
    except Exception as exc:
        logger.warning("COA miss ledger unavailable (%s)", exc)


def _as_int(value: Any) -> int:
    if isinstance(value, bytes):
        value = value.decode("utf-8", "replace")
    try:
        return int(value)
    except (TypeError, ValueError):
        return 0


async def recent_misses(
    company_id: Any,
    *,
    redis_client: Any = None,
    days: int = MISS_LEDGER_DAYS,
    today: Optional[date] = None,
) -> Optional[int]:
    """Refused lookups across the last ``days`` UTC days, or ``None`` if unknown.

    **``None`` is not zero.** A tripwire that reports 0 while it cannot see is worse
    than one that says nothing: it tells the owner nobody is guessing at their batch
    numbers, which is exactly the assurance §8 exists to avoid giving falsely. Redis
    absent or failing therefore reads as "unknown" and the panel omits the row.
    """
    if redis_client is None:
        return None
    day = _today(today)
    keys: List[str] = [ledger_key(company_id, day - timedelta(days=i)) for i in range(max(1, days))]
    try:
        values = await redis_client.mget(keys)
    except Exception as exc:
        logger.warning("COA miss ledger unavailable (%s)", exc)
        return None
    return sum(_as_int(v) for v in (values or []))


# ─────────────────────────────────── the API ────────────────────────────────────

async def lockout_seconds(
    company_id: Any,
    visitor_id: Optional[str],
    ip: Optional[str],
    *,
    redis_client: Any = None,
    now: Optional[float] = None,
) -> int:
    """Seconds this visitor must wait, or 0 if the lookup is open to them.

    Both identities are consulted and the longer wait wins. They are separate gates
    on purpose: clearing `visitorId` escapes the first and lands on the second.
    """
    now = time.monotonic() if now is None else now
    longest = 0
    for identity, is_ip in ((visitor_id, False), (ip, True)):
        if not identity:
            continue
        key = lock_key(company_id, identity, ip=is_ip)
        longest = max(longest, _local_lock_ttl(key, now))
        if redis_client is not None:
            longest = max(longest, await _redis_lock_ttl(redis_client, key))
    return longest


async def record_miss(
    company_id: Any,
    visitor_id: Optional[str],
    ip: Optional[str],
    *,
    redis_client: Any = None,
    now: Optional[float] = None,
    today: Optional[date] = None,
) -> int:
    """Count one refused lookup. Returns the lockout it just earned, or 0.

    Called only when a lookup released nothing, and only on an explicit submission
    (C7) — the panel has no search-as-you-type left, so a customer correcting a typo
    mid-entry cannot burn their allowance.

    **A release does NOT clear the counter**, and that is deliberate. Anyone probing
    this library holds at least one certificate they know exists — that is how they
    learned the batch format — so a counter reset by a success would be reset by
    alternating one known-good query with each guess, which is the entire attack §11
    residual 3 describes.

    A miss that trips the limit returns the lockout immediately, so the visitor is told
    on the attempt that earned it rather than on the next one they waste.

    Both counters are maintained whether or not Redis answers. They enforce the same
    rule, so the local one can only ever trip *later* than the shared one (its window
    is per worker) — it can never manufacture a lockout the shared counter would not
    have reached, and it is the whole gate when Redis is gone.

    The owner's ledger (§8) is written from here rather than from the two endpoints, so
    what the owner sees counted and what the throttle counts cannot drift: outages,
    lockouts and the model's own blank calls never reach this function, and so are
    never reported as someone guessing.
    """
    now = time.monotonic() if now is None else now
    if redis_client is not None:
        await _record_ledger(redis_client, company_id, today)
    locked = 0
    for identity, is_ip in ((visitor_id, False), (ip, True)):
        if not identity:
            continue
        limit = IP_MISS_LIMIT if is_ip else MISS_LIMIT
        window = IP_MISS_WINDOW_SECONDS if is_ip else MISS_WINDOW_SECONDS
        key = miss_key(company_id, identity, ip=is_ip)
        lock = lock_key(company_id, identity, ip=is_ip)
        locked = max(locked, _local_record(key, lock, limit, window, now))
        if redis_client is not None:
            locked = max(locked, await _redis_record(redis_client, key, lock, limit, window))
    return locked
