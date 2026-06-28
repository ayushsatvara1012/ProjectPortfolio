"""In-memory decrypted-DSN cache for KMS-outage resilience (RFC docs/rfc-byod.md
§16.5, Phase 8.2 chaos).

A KMS outage would otherwise take down EVERY BYOD bot at once: the engine decrypts
each tenant's runtime DSN at connect time, so if KMS can't unwrap the data key, no
tenant database can be opened. §16.5's fix is a short-lived, bounded in-memory
cache of already-decrypted DSNs: during a brief KMS blip the engine serves a
recently-decrypted DSN from memory (degraded — logged + alertable), and only a
tenant that has never been decrypted (cold) fails — and only that tenant, isolated.
When KMS recovers, fresh decrypts repopulate the cache automatically.

Security (§5.1): the cache holds PLAINTEXT DSNs in process memory ONLY — never
logged, serialized, or persisted — bounded by a short TTL and an LRU cap so the
plaintext footprint stays small and short-lived.

Two horizons:
  * ``ttl_seconds`` — the "reuse without calling KMS" window. Within it the engine
    serves the cached DSN directly (which also makes sub-TTL KMS blips invisible).
    Keep short.
  * ``max_stale_seconds`` — the OUTAGE fallback bound. When a fresh decrypt FAILS
    (KMS/control down), the engine may fall back to a cached DSN up to this age;
    beyond it the entry is considered too stale to trust and the tenant fails cold.
"""
from __future__ import annotations

import os
import threading
import time
from collections import OrderedDict
from dataclasses import dataclass
from typing import Callable, Optional


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return default
    return value if value > 0 else default


DEFAULT_TTL_SECONDS = 300
DEFAULT_MAX_STALE_SECONDS = 3600
DEFAULT_MAX_ENTRIES = 1024


@dataclass
class _Entry:
    dsn: str
    stored_at: float


class DecryptedDsnCache:
    """Thread-safe, bounded, TTL'd cache of decrypted runtime DSNs."""

    def __init__(
        self,
        *,
        ttl_seconds: float = DEFAULT_TTL_SECONDS,
        max_stale_seconds: float = DEFAULT_MAX_STALE_SECONDS,
        max_entries: int = DEFAULT_MAX_ENTRIES,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._ttl = ttl_seconds
        self._max_stale = max_stale_seconds
        self._max_entries = max_entries
        self._clock = clock
        self._lock = threading.Lock()
        self._entries: "OrderedDict[str, _Entry]" = OrderedDict()

    def get_fresh(self, company_id: str) -> Optional[str]:
        """The cached DSN if it is within ``ttl_seconds`` — the normal-path reuse
        that avoids a KMS round-trip (and hides sub-TTL blips). None otherwise."""
        with self._lock:
            entry = self._entries.get(company_id)
            if entry is None:
                return None
            if self._clock() - entry.stored_at <= self._ttl:
                self._entries.move_to_end(company_id)
                return entry.dsn
            return None

    def get_stale(self, company_id: str) -> Optional[str]:
        """The cached DSN if it is within ``max_stale_seconds`` (even past the TTL)
        — the KMS-OUTAGE fallback. Drops + returns None if too old to trust."""
        with self._lock:
            entry = self._entries.get(company_id)
            if entry is None:
                return None
            if self._clock() - entry.stored_at <= self._max_stale:
                self._entries.move_to_end(company_id)
                return entry.dsn
            del self._entries[company_id]
            return None

    def put(self, company_id: str, dsn: str) -> None:
        with self._lock:
            self._entries[company_id] = _Entry(dsn, self._clock())
            self._entries.move_to_end(company_id)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)  # LRU eviction

    def invalidate(self, company_id: str) -> None:
        """Drop a tenant's entry (call on a DSN rotation / re-provision so the new
        credential is used immediately, not after the TTL)."""
        with self._lock:
            self._entries.pop(company_id, None)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)


def from_env() -> DecryptedDsnCache:
    return DecryptedDsnCache(
        ttl_seconds=_env_int("BYOD_DSN_CACHE_TTL_SECONDS", DEFAULT_TTL_SECONDS),
        max_stale_seconds=_env_int("BYOD_DSN_CACHE_MAX_STALE_SECONDS", DEFAULT_MAX_STALE_SECONDS),
        max_entries=_env_int("BYOD_DSN_CACHE_MAX_ENTRIES", DEFAULT_MAX_ENTRIES),
    )


# ── Process singleton ────────────────────────────────────────────────────────────
_cache: Optional[DecryptedDsnCache] = None
_cache_lock = threading.Lock()


def get_dsn_cache() -> DecryptedDsnCache:
    global _cache
    if _cache is None:
        with _cache_lock:
            if _cache is None:
                _cache = from_env()
    return _cache


def set_dsn_cache(cache: DecryptedDsnCache) -> None:
    """Inject a cache (tests)."""
    global _cache
    with _cache_lock:
        _cache = cache


def reset_dsn_cache() -> None:
    global _cache
    with _cache_lock:
        _cache = None
