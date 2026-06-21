"""Phase 3 gate: the routing-decision cache (byod_routing_cache).

No database; runs everywhere. Covers the TTL window, the negative-caching
behaviour that keeps non-BYOD companies off the control plane, explicit
invalidation (so a toggle is visible immediately), and LRU bounding.
"""
from __future__ import annotations

import byod_routing_cache
from byod_routing_cache import RoutingDecision, RoutingDecisionCache


class _Clock:
    def __init__(self) -> None:
        self.t = 1000.0

    def __call__(self) -> float:
        return self.t

    def advance(self, dt: float) -> None:
        self.t += dt


def test_miss_returns_none():
    cache = RoutingDecisionCache()
    assert cache.get("c1") is None


def test_put_then_get_within_ttl():
    clock = _Clock()
    cache = RoutingDecisionCache(ttl_seconds=45, clock=clock)
    cache.put("c1", RoutingDecision("LIVE", True))
    clock.advance(44)
    got = cache.get("c1")
    assert got == RoutingDecision("LIVE", True)


def test_entry_expires_after_ttl():
    clock = _Clock()
    cache = RoutingDecisionCache(ttl_seconds=45, clock=clock)
    cache.put("c1", RoutingDecision("LIVE", True))
    clock.advance(46)
    assert cache.get("c1") is None  # expired → miss


def test_negative_decision_is_cacheable_and_distinct_from_miss():
    # A "no BYOD row" decision (status=None) is a real cached value, NOT a miss —
    # this is what keeps the 99% non-BYOD companies off the control plane.
    cache = RoutingDecisionCache()
    cache.put("c1", RoutingDecision(None, False))
    got = cache.get("c1")
    assert got is not None
    assert got == RoutingDecision(None, False)


def test_invalidate_drops_entry():
    cache = RoutingDecisionCache()
    cache.put("c1", RoutingDecision("LIVE", True))
    cache.invalidate("c1")
    assert cache.get("c1") is None


def test_lru_eviction_bounds_size():
    cache = RoutingDecisionCache(max_entries=2)
    cache.put("a", RoutingDecision("LIVE", True))
    cache.put("b", RoutingDecision("LIVE", True))
    cache.put("c", RoutingDecision("LIVE", True))  # evicts "a" (LRU)
    assert len(cache) == 2
    assert cache.get("a") is None
    assert cache.get("b") is not None
    assert cache.get("c") is not None


def test_from_env_reads_ttl(monkeypatch):
    monkeypatch.setenv("BYOD_ROUTING_CACHE_TTL_SECONDS", "30")
    cache = byod_routing_cache.from_env()
    clock = _Clock()
    cache._clock = clock  # type: ignore[attr-defined]
    cache.put("c1", RoutingDecision("LIVE", True))
    clock.advance(31)
    assert cache.get("c1") is None


def test_singleton_set_and_reset():
    custom = RoutingDecisionCache()
    byod_routing_cache.set_routing_cache(custom)
    assert byod_routing_cache.get_routing_cache() is custom
    byod_routing_cache.reset_routing_cache()
    assert byod_routing_cache.get_routing_cache() is not custom
