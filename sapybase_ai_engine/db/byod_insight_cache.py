"""BYOD insight cache: a control-plane Redis cache for computed dashboard
analytics (RFC docs/rfc-byod.md Phase 4.2 — §7.4, §9, §16.8).

Why (§9): for a BYOD tenant the heavy analytics aggregations (funnel, ROI,
attribution, the fixes-needed worklist) run on the **client's** Postgres. Running
them on every dashboard load would hammer a remote DB we don't control. So the
**computed result** is cached on the control plane (Redis), with a short TTL and
**explicit invalidation** when new data lands (§7.4) — the dashboard stays snappy
and the tenant DB is spared. The usage bar is unaffected: it reads the
control-plane ``usage_tracking`` counter directly, never this cache.

Trust boundary (§6): only **derived display numbers** live here, never billing /
entitlement state. The cache is a pure optimization — every read still passes the
ownership + tier gate on the live request before a cached value is returned, and a
Redis outage degrades to a recompute (fail-soft), never an error.

Design:

  * Keys are namespaced ``byod:insight:{company_id}:{kind}:{params_hash}`` so a
    single ``invalidate_company`` can SCAN+DELETE everything for one tenant — which
    is also exactly what GDPR erasure needs (§16.8: deleting an end-user must reach
    derived caches).
  * The backend client is **injected** (any object exposing ``get`` / ``setex`` /
    ``scan_iter`` / ``delete``), so the whole module is unit-testable against a
    fake in-memory client with no live Redis. :class:`NullInsightCache` is the
    no-op used when ``REDIS_URL`` is unset, so callers never branch on ``None``.
  * Every operation is **fail-soft**: any backend error is swallowed (logged at
    debug) so the cache can never break a request — a get returns ``None`` (miss),
    a set is dropped, an invalidate reports 0.

This module is import-light (stdlib only; the sync ``redis`` client is imported
lazily in :func:`from_env`). It owns no DB and no engine state.
"""
from __future__ import annotations

import hashlib
import json
import logging
import os
from typing import Any, Optional, Protocol

logger = logging.getLogger("byod.insight_cache")

# Key namespace. company_id and kind are kept human-readable in the key (not
# hashed) so per-company invalidation can match `PREFIX:{company_id}:*`.
KEY_PREFIX = "byod:insight"

DEFAULT_TTL_SECONDS = 300  # §7.4 "short TTL"; override via env below.
_SCAN_BATCH = 256


def _ttl_from_env() -> int:
    raw = os.getenv("BYOD_INSIGHT_CACHE_TTL_SECONDS")
    if not raw:
        return DEFAULT_TTL_SECONDS
    try:
        ttl = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_TTL_SECONDS
    return ttl if ttl > 0 else DEFAULT_TTL_SECONDS


class CacheBackend(Protocol):  # pragma: no cover - typing only
    """The subset of the sync ``redis.Redis`` API this cache uses."""

    def get(self, name: str) -> Optional[bytes]: ...
    def setex(self, name: str, time: int, value: Any) -> Any: ...
    def scan_iter(self, match: Optional[str] = ..., count: Optional[int] = ...): ...
    def delete(self, *names: str) -> Any: ...


def _params_hash(params: dict) -> str:
    """Stable short hash of the query params that distinguish one cached variant
    from another (e.g. window_days, limit). Canonical JSON → sha256 → 16 hex."""
    canonical = json.dumps(params or {}, sort_keys=True, separators=(",", ":"),
                           default=str)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


class InsightCache:
    """Read-through-ready insight cache over an injected Redis-like client.

    The caller does the read-through itself (get → on miss compute → set); this
    class only owns key construction, (de)serialization, TTL, and fail-soft
    per-company invalidation.
    """

    def __init__(self, client: CacheBackend, *, ttl_seconds: Optional[int] = None,
                 key_prefix: str = KEY_PREFIX):
        self._client = client
        self.ttl_seconds = ttl_seconds if (ttl_seconds and ttl_seconds > 0) else _ttl_from_env()
        self._prefix = key_prefix

    # ── key construction ────────────────────────────────────────────────────
    def _company_prefix(self, company_id: str) -> str:
        return f"{self._prefix}:{company_id}:"

    def key(self, company_id: str, kind: str, **params) -> str:
        return f"{self._company_prefix(company_id)}{kind}:{_params_hash(params)}"

    # ── read-through primitives (all fail-soft) ─────────────────────────────
    def get(self, company_id: str, kind: str, **params) -> Optional[dict]:
        """Return the cached result dict, or ``None`` on miss / any backend error."""
        try:
            raw = self._client.get(self.key(company_id, kind, **params))
            if raw is None:
                return None
            if isinstance(raw, (bytes, bytearray)):
                raw = raw.decode("utf-8")
            return json.loads(raw)
        except Exception as exc:  # fail-soft: a cache problem must never break a read
            logger.debug("insight cache get failed (company=%s kind=%s): %s",
                         company_id, kind, type(exc).__name__)
            return None

    def set(self, company_id: str, kind: str, value: dict, **params) -> bool:
        """Store ``value`` (JSON-serializable) under a TTL. Returns True on success,
        False on any backend / serialization error (dropped silently)."""
        try:
            payload = json.dumps(value, default=str).encode("utf-8")
            self._client.setex(self.key(company_id, kind, **params),
                               self.ttl_seconds, payload)
            return True
        except Exception as exc:
            logger.debug("insight cache set failed (company=%s kind=%s): %s",
                         company_id, kind, type(exc).__name__)
            return False

    # ── invalidation (new data + GDPR erasure, §16.8) ───────────────────────
    def invalidate_company(self, company_id: str) -> int:
        """Delete every cached insight for ``company_id`` (all kinds / params).

        Called when new data lands (lead capture/outcome, benchmark change,
        training) and on GDPR erasure. Returns the number of keys removed; 0 on
        an empty namespace or any backend error (fail-soft)."""
        pattern = f"{self._company_prefix(company_id)}*"
        removed = 0
        try:
            batch: list[str] = []
            for key in self._client.scan_iter(match=pattern, count=_SCAN_BATCH):
                batch.append(key)
                if len(batch) >= _SCAN_BATCH:
                    removed += int(self._client.delete(*batch) or 0)
                    batch = []
            if batch:
                removed += int(self._client.delete(*batch) or 0)
        except Exception as exc:
            logger.debug("insight cache invalidate failed (company=%s): %s",
                         company_id, type(exc).__name__)
            return removed
        return removed


class NullInsightCache(InsightCache):
    """No-op cache used when Redis is not configured. Every op is a clean miss /
    drop so callers need no ``None`` checks and behavior is byte-for-byte the
    same as 'no caching at all'."""

    def __init__(self):  # noqa: D401 - intentionally bypasses client wiring
        self._client = None
        self.ttl_seconds = DEFAULT_TTL_SECONDS
        self._prefix = KEY_PREFIX

    def get(self, company_id: str, kind: str, **params) -> Optional[dict]:
        return None

    def set(self, company_id: str, kind: str, value: dict, **params) -> bool:
        return False

    def invalidate_company(self, company_id: str) -> int:
        return 0


def from_env() -> InsightCache:
    """Build an :class:`InsightCache` from ``REDIS_URL`` using the **sync** redis
    client (the engine's global client is ``redis.asyncio``; the analytics
    endpoints are sync ``def`` handlers run in a threadpool, so they need a sync
    client). Returns :class:`NullInsightCache` when Redis is unset or unavailable
    — analytics then simply always recompute (fail-soft)."""
    redis_url = os.getenv("REDIS_URL")
    if not redis_url:
        return NullInsightCache()
    try:
        import redis as _redis_sync  # sync client; redis.asyncio is the async variant
    except Exception:
        logger.warning("insight cache: redis package unavailable; caching disabled")
        return NullInsightCache()
    try:
        # Short timeouts so a Redis blip fails fast to a recompute rather than
        # stalling a dashboard request. decode_responses=True → get() yields str
        # and scan_iter yields str keys; our get() tolerates both str and bytes.
        client = _redis_sync.Redis.from_url(
            redis_url,
            decode_responses=True,
            socket_timeout=1.5,
            socket_connect_timeout=1.5,
        )
        return InsightCache(client)
    except Exception as exc:
        logger.warning("insight cache: client init failed (%s); caching disabled",
                       type(exc).__name__)
        return NullInsightCache()


# ── process singleton (lazy), mirroring byod_engine's registry accessors ─────
_INSIGHT_CACHE: Optional[InsightCache] = None


def get_insight_cache() -> InsightCache:
    """Return the lazily-built process-wide insight cache."""
    global _INSIGHT_CACHE
    if _INSIGHT_CACHE is None:
        _INSIGHT_CACHE = from_env()
    return _INSIGHT_CACHE


def set_insight_cache(cache: InsightCache) -> None:
    """Install an explicit cache (used by tests to inject a fake client)."""
    global _INSIGHT_CACHE
    _INSIGHT_CACHE = cache


def reset_insight_cache() -> None:
    """Drop the singleton so the next :func:`get_insight_cache` rebuilds it."""
    global _INSIGHT_CACHE
    _INSIGHT_CACHE = None
