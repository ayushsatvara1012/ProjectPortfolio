"""Phase 4.2 test gate: BYOD insight cache (Redis) + invalidation.

Exit criteria (RFC docs/rfc-byod.md §13 Phase 4.2):
    "Cache hit/miss correct; new data invalidates; GDPR erasure clears cache."

These are pure unit tests over ``byod_insight_cache`` with an in-memory fake
Redis client injected (no live Redis, no Postgres) — so they run in the no-DB
engine-regression suite. They prove:

* hit/miss semantics (set → get round-trips; different params / kind → miss),
* keys carry a short TTL (§7.4),
* ``invalidate_company`` clears every cached kind for one tenant and leaves
  other tenants untouched — the mechanism behind both "new data invalidates"
  and "GDPR erasure clears cache" (§16.8),
* fail-soft: a broken backend degrades to miss / drop / 0, never raises,
* the NullInsightCache (Redis unset) is a clean no-op.
"""
from __future__ import annotations

import fnmatch
import json

import pytest

import byod_insight_cache
from byod_insight_cache import (
    InsightCache,
    NullInsightCache,
    from_env,
    get_insight_cache,
    reset_insight_cache,
    set_insight_cache,
)


class FakeRedis:
    """Minimal in-memory stand-in for the sync redis client subset we use."""

    def __init__(self):
        self.store: dict[str, bytes] = {}
        self.ttls: dict[str, int] = {}

    def get(self, name):
        return self.store.get(name)

    def setex(self, name, time, value):
        self.store[name] = value
        self.ttls[name] = time
        return True

    def scan_iter(self, match=None, count=None):
        for k in list(self.store.keys()):
            if match is None or fnmatch.fnmatch(k, match):
                yield k

    def delete(self, *names):
        n = 0
        for name in names:
            if name in self.store:
                del self.store[name]
                self.ttls.pop(name, None)
                n += 1
        return n


class BrokenRedis:
    """Every op raises — exercises fail-soft degradation."""

    def get(self, name):
        raise RuntimeError("redis down")

    def setex(self, name, time, value):
        raise RuntimeError("redis down")

    def scan_iter(self, match=None, count=None):
        raise RuntimeError("redis down")

    def delete(self, *names):
        raise RuntimeError("redis down")


CID = "11111111-1111-1111-1111-111111111111"
CID2 = "22222222-2222-2222-2222-222222222222"


# ── key construction ─────────────────────────────────────────────────────────
def test_keys_are_namespaced_and_param_sensitive():
    cache = InsightCache(FakeRedis())
    k_funnel_30 = cache.key(CID, "funnel", window_days=30)
    k_funnel_7 = cache.key(CID, "funnel", window_days=7)
    k_roi = cache.key(CID, "roi")
    k_other_company = cache.key(CID2, "funnel", window_days=30)

    assert k_funnel_30.startswith(f"byod:insight:{CID}:funnel:")
    assert k_funnel_30 != k_funnel_7        # params distinguish variants
    assert k_funnel_30 != k_roi             # kind distinguishes
    assert k_funnel_30 != k_other_company   # company distinguishes


def test_key_is_param_order_independent():
    cache = InsightCache(FakeRedis())
    assert cache.key(CID, "attribution", window_days=30, limit=8) == \
        cache.key(CID, "attribution", limit=8, window_days=30)


# ── hit / miss ───────────────────────────────────────────────────────────────
def test_set_then_get_round_trips():
    cache = InsightCache(FakeRedis())
    value = {"funnel": {"top": 5}, "won_value": 1500.0, "window_days": 30}
    assert cache.get(CID, "funnel", window_days=30) is None  # cold miss
    assert cache.set(CID, "funnel", value, window_days=30) is True
    assert cache.get(CID, "funnel", window_days=30) == value  # hit


def test_miss_on_different_params():
    cache = InsightCache(FakeRedis())
    cache.set(CID, "funnel", {"x": 1}, window_days=30)
    assert cache.get(CID, "funnel", window_days=7) is None   # different window
    assert cache.get(CID, "roi") is None                      # different kind
    assert cache.get(CID2, "funnel", window_days=30) is None  # different company


def test_set_applies_ttl():
    client = FakeRedis()
    cache = InsightCache(client, ttl_seconds=123)
    cache.set(CID, "roi", {"a": 1})
    (key,) = list(client.store.keys())
    assert client.ttls[key] == 123


# ── invalidation: new data + GDPR erasure (§16.8) ────────────────────────────
def test_invalidate_company_clears_all_kinds_for_that_company_only():
    client = FakeRedis()
    cache = InsightCache(client)
    # Several cached kinds/variants for CID, plus an unrelated company.
    cache.set(CID, "funnel", {"a": 1}, window_days=30)
    cache.set(CID, "funnel", {"a": 2}, window_days=7)
    cache.set(CID, "roi", {"b": 1})
    cache.set(CID, "attribution", {"c": 1}, window_days=30, limit=8)
    cache.set(CID2, "funnel", {"z": 9}, window_days=30)

    removed = cache.invalidate_company(CID)
    assert removed == 4
    # All of CID's insights gone…
    assert cache.get(CID, "funnel", window_days=30) is None
    assert cache.get(CID, "funnel", window_days=7) is None
    assert cache.get(CID, "roi") is None
    assert cache.get(CID, "attribution", window_days=30, limit=8) is None
    # …but the other company's cache survives.
    assert cache.get(CID2, "funnel", window_days=30) == {"z": 9}


def test_new_data_invalidation_forces_recompute():
    """Simulates the endpoint flow: cache a result, then 'new data' invalidates,
    so the next read is a miss (would recompute)."""
    cache = InsightCache(FakeRedis())
    cache.set(CID, "funnel", {"leads": 1}, window_days=30)
    assert cache.get(CID, "funnel", window_days=30) == {"leads": 1}
    cache.invalidate_company(CID)  # e.g. a lead was just captured
    assert cache.get(CID, "funnel", window_days=30) is None


def test_invalidate_empty_namespace_is_zero():
    cache = InsightCache(FakeRedis())
    assert cache.invalidate_company(CID) == 0


def test_invalidate_handles_many_keys_across_scan_batches():
    client = FakeRedis()
    cache = InsightCache(client)
    for i in range(600):  # > _SCAN_BATCH (256) to exercise batched delete
        cache.set(CID, "fixes", {"i": i}, window_days=30, limit=i)
    removed = cache.invalidate_company(CID)
    assert removed == 600
    assert not client.store


# ── fail-soft ────────────────────────────────────────────────────────────────
def test_fail_soft_get_set_invalidate_never_raise():
    cache = InsightCache(BrokenRedis())
    assert cache.get(CID, "funnel", window_days=30) is None  # miss, no raise
    assert cache.set(CID, "funnel", {"a": 1}, window_days=30) is False
    assert cache.invalidate_company(CID) == 0


def test_get_tolerates_corrupt_payload():
    client = FakeRedis()
    cache = InsightCache(client)
    client.store[cache.key(CID, "roi")] = b"not-json{"
    assert cache.get(CID, "roi") is None  # bad payload → clean miss


# ── NullInsightCache (Redis unset) ───────────────────────────────────────────
def test_null_cache_is_a_clean_noop():
    cache = NullInsightCache()
    assert cache.get(CID, "funnel", window_days=30) is None
    assert cache.set(CID, "funnel", {"a": 1}, window_days=30) is False
    assert cache.invalidate_company(CID) == 0


def test_from_env_without_redis_url_is_null(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    assert isinstance(from_env(), NullInsightCache)


# ── singleton accessors ──────────────────────────────────────────────────────
def test_singleton_get_set_reset(monkeypatch):
    monkeypatch.delenv("REDIS_URL", raising=False)
    reset_insight_cache()
    first = get_insight_cache()
    assert isinstance(first, NullInsightCache)
    assert get_insight_cache() is first  # cached singleton

    injected = InsightCache(FakeRedis())
    set_insight_cache(injected)
    assert get_insight_cache() is injected

    reset_insight_cache()
    assert get_insight_cache() is not injected


def test_ttl_env_override(monkeypatch):
    monkeypatch.setenv("BYOD_INSIGHT_CACHE_TTL_SECONDS", "42")
    cache = InsightCache(FakeRedis())
    assert cache.ttl_seconds == 42


def test_ttl_env_invalid_falls_back_to_default(monkeypatch):
    monkeypatch.setenv("BYOD_INSIGHT_CACHE_TTL_SECONDS", "nonsense")
    cache = InsightCache(FakeRedis())
    assert cache.ttl_seconds == byod_insight_cache.DEFAULT_TTL_SECONDS
