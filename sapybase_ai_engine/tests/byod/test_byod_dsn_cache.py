"""Unit tests for the decrypted-DSN cache (byod_dsn_cache) — Phase 8.2 / §16.5.

Pure, no DB, deterministic via an injected clock. Validates the two horizons
(fresh TTL reuse + stale outage-fallback bound), LRU bounding, invalidation, and
the process singleton.
"""
from __future__ import annotations

from db import byod_dsn_cache
from db.byod_dsn_cache import DecryptedDsnCache


class _Clock:
    def __init__(self):
        self.t = 1000.0

    def __call__(self):
        return self.t


def _cache(clock, *, ttl=10.0, max_stale=100.0, max_entries=3):
    return DecryptedDsnCache(
        ttl_seconds=ttl, max_stale_seconds=max_stale, max_entries=max_entries, clock=clock
    )


def test_get_fresh_within_ttl_then_misses_after():
    clk = _Clock()
    c = _cache(clk)
    c.put("a", "dsn-a")
    assert c.get_fresh("a") == "dsn-a"
    clk.t += 10.0  # exactly ttl → still fresh
    assert c.get_fresh("a") == "dsn-a"
    clk.t += 0.1  # past ttl
    assert c.get_fresh("a") is None


def test_get_stale_serves_past_ttl_until_max_stale():
    clk = _Clock()
    c = _cache(clk)
    c.put("a", "dsn-a")
    clk.t += 50.0  # past ttl(10), within max_stale(100)
    assert c.get_fresh("a") is None        # not fresh
    assert c.get_stale("a") == "dsn-a"     # but still serviceable in an outage
    clk.t += 60.0  # now past max_stale(100 from put)
    assert c.get_stale("a") is None        # too old → dropped
    assert len(c) == 0


def test_get_stale_missing_is_none():
    assert _cache(_Clock()).get_stale("nope") is None


def test_lru_eviction_bounds_entries():
    clk = _Clock()
    c = _cache(clk, max_entries=3)
    for k in ("a", "b", "c"):
        c.put(k, f"dsn-{k}")
    c.get_fresh("a")          # touch a → most-recently-used
    c.put("d", "dsn-d")        # over cap → evict LRU (b)
    assert len(c) == 3
    assert c.get_stale("b") is None
    assert c.get_stale("a") == "dsn-a"
    assert c.get_stale("d") == "dsn-d"


def test_invalidate_and_clear():
    c = _cache(_Clock())
    c.put("a", "dsn-a")
    c.put("b", "dsn-b")
    c.invalidate("a")
    assert c.get_stale("a") is None
    assert c.get_stale("b") == "dsn-b"
    c.clear()
    assert len(c) == 0


def test_from_env_reads_settings(monkeypatch):
    monkeypatch.setenv("BYOD_DSN_CACHE_TTL_SECONDS", "42")
    monkeypatch.setenv("BYOD_DSN_CACHE_MAX_STALE_SECONDS", "999")
    monkeypatch.setenv("BYOD_DSN_CACHE_MAX_ENTRIES", "7")
    c = byod_dsn_cache.from_env()
    assert c._ttl == 42 and c._max_stale == 999 and c._max_entries == 7


def test_from_env_invalid_falls_back_to_defaults(monkeypatch):
    monkeypatch.setenv("BYOD_DSN_CACHE_TTL_SECONDS", "nonsense")
    monkeypatch.setenv("BYOD_DSN_CACHE_MAX_ENTRIES", "-5")
    c = byod_dsn_cache.from_env()
    assert c._ttl == byod_dsn_cache.DEFAULT_TTL_SECONDS
    assert c._max_entries == byod_dsn_cache.DEFAULT_MAX_ENTRIES


def test_singleton_get_set_reset():
    byod_dsn_cache.reset_dsn_cache()
    first = byod_dsn_cache.get_dsn_cache()
    assert byod_dsn_cache.get_dsn_cache() is first  # stable singleton
    injected = _cache(_Clock())
    byod_dsn_cache.set_dsn_cache(injected)
    assert byod_dsn_cache.get_dsn_cache() is injected
    byod_dsn_cache.reset_dsn_cache()
    assert byod_dsn_cache.get_dsn_cache() is not injected
