"""In-memory routing-decision cache for the BYOD hot path (UI plan §2.1, Phase 3).

``byod_engine.routing_active`` runs on EVERY chat request — for every company, not
just BYOD ones — so once BYOD is globally enabled it cannot read the control plane
per request. This cache holds the two routing inputs per company:

    company_id -> (status, routing_enabled)

with a short TTL. A cache MISS reads the control plane once and stores the result;
subsequent requests within the TTL are answered from memory. Crucially, the
**negative** result (no BYOD row → not a tenant) is cached too, so the ~99% of
companies that are not BYOD tenants do not hammer the control plane.

Correctness model (deliberately simpler than the DSN cache — no stale fallback):
  * The flag is an on/off *intent*, not a credential, so there is nothing to
    degrade-serve. On a control-plane error the engine fails CLOSED to the shared
    path (treats the tenant as not-routed) — fail-safe, never fail-open.
  * Every mutation that changes routing (provision, health, enable/disable,
    offboard, switch-out/in) calls :func:`get_routing_cache().invalidate` so a
    toggle takes effect immediately; the short TTL is only the self-healing
    backstop if an invalidation is ever missed.

A cached entry distinguishes "no row" (``status=None``) from a cache miss
(``get`` returns ``None``), so a negative is a real, cacheable decision.
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


# Short by design: a toggle is invalidated explicitly, so the TTL only bounds the
# window after a *missed* invalidation. Long enough to absorb chat bursts.
DEFAULT_TTL_SECONDS = 45
DEFAULT_MAX_ENTRIES = 4096


@dataclass(frozen=True)
class RoutingDecision:
    """The cached routing inputs for a company. ``status`` is the lifecycle status
    or ``None`` when the company has no BYOD row (a cacheable negative)."""

    status: Optional[str]
    routing_enabled: bool


@dataclass
class _Entry:
    decision: RoutingDecision
    stored_at: float


class RoutingDecisionCache:
    """Thread-safe, bounded, TTL'd cache of per-company routing decisions."""

    def __init__(
        self,
        *,
        ttl_seconds: float = DEFAULT_TTL_SECONDS,
        max_entries: int = DEFAULT_MAX_ENTRIES,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        self._ttl = ttl_seconds
        self._max_entries = max_entries
        self._clock = clock
        self._lock = threading.Lock()
        self._entries: "OrderedDict[str, _Entry]" = OrderedDict()

    def get(self, company_id: str) -> Optional[RoutingDecision]:
        """The cached decision if within the TTL, else ``None`` (a miss). A cached
        negative is returned as ``RoutingDecision(None, False)`` — distinct from a
        miss."""
        with self._lock:
            entry = self._entries.get(company_id)
            if entry is None:
                return None
            if self._clock() - entry.stored_at <= self._ttl:
                self._entries.move_to_end(company_id)
                return entry.decision
            del self._entries[company_id]
            return None

    def put(self, company_id: str, decision: RoutingDecision) -> None:
        with self._lock:
            self._entries[company_id] = _Entry(decision, self._clock())
            self._entries.move_to_end(company_id)
            while len(self._entries) > self._max_entries:
                self._entries.popitem(last=False)  # LRU eviction

    def invalidate(self, company_id: str) -> None:
        """Drop a tenant's entry — call after any routing-affecting mutation so the
        change is visible immediately rather than after the TTL."""
        with self._lock:
            self._entries.pop(company_id, None)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)


def from_env() -> RoutingDecisionCache:
    return RoutingDecisionCache(
        ttl_seconds=_env_int("BYOD_ROUTING_CACHE_TTL_SECONDS", DEFAULT_TTL_SECONDS),
        max_entries=_env_int("BYOD_ROUTING_CACHE_MAX_ENTRIES", DEFAULT_MAX_ENTRIES),
    )


# ── Process singleton ────────────────────────────────────────────────────────────
_cache: Optional[RoutingDecisionCache] = None
_cache_lock = threading.Lock()


def get_routing_cache() -> RoutingDecisionCache:
    global _cache
    if _cache is None:
        with _cache_lock:
            if _cache is None:
                _cache = from_env()
    return _cache


def set_routing_cache(cache: RoutingDecisionCache) -> None:
    """Inject a cache (tests)."""
    global _cache
    with _cache_lock:
        _cache = cache


def reset_routing_cache() -> None:
    global _cache
    with _cache_lock:
        _cache = None
