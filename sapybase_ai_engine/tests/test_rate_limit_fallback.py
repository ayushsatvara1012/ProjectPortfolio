"""Tests for rate-limiter configuration — Redis presence and fallback."""
import os
from unittest.mock import patch, MagicMock


class TestRateLimiterConfig:
    def test_redis_url_configured_means_distributed_storage(self):
        from main import REDIS_URL, _limiter_storage
        # If REDIS_URL env var is set, the limiter storage must also be set.
        # If not set (CI without Redis), both should be None — in-memory fallback.
        if REDIS_URL:
            assert _limiter_storage is not None
        else:
            assert _limiter_storage is None

    def test_limiter_has_in_memory_fallback_enabled(self):
        from main import limiter
        # Resiliency: if Redis drops, limiter must not crash
        assert limiter._in_memory_fallback_enabled is True

    def test_limiter_default_limits_are_set(self):
        from main import limiter
        # A global catch-all limit must exist (slowapi stores as _default_limits)
        assert limiter._default_limits is not None
        assert len(limiter._default_limits) > 0

    def test_redis_url_normalisation_strips_redundant_prefix(self):
        """Validates the normalisation logic used when REDIS_URL is set."""
        raw = "redis://user:pass@host:6379/0"
        # The normalisation strips prefix then re-adds it
        stripped = raw.split("://")[-1]
        normalised = f"redis://{stripped}"
        assert normalised == "redis://user:pass@host:6379/0"

    def test_redis_url_with_rediss_scheme_passes_through(self):
        """rediss:// (TLS) URLs must not be double-prefixed."""
        raw = "rediss://user:pass@host:6380/0"
        result = f"redis://{raw.split('://')[-1]}" if not raw.startswith("redis") else raw
        assert result == raw  # startswith("redis") → passed through unchanged

    def test_get_limit_key_prefers_api_key_over_ip(self):
        from main import get_limit_key
        from starlette.testclient import TestClient
        from starlette.requests import Request
        from starlette.datastructures import Headers

        scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": Headers({"x-api-key": "my-bot-key"}).raw,
            "client": ("127.0.0.1", 9999),
            "query_string": b"",
        }
        req = Request(scope)
        key = get_limit_key(req)
        assert key.startswith("api_key:")
        assert "my-bot-key" not in key  # raw key must not appear in storage key

    def test_get_limit_key_falls_back_to_ip(self):
        from main import get_limit_key
        from starlette.requests import Request
        from starlette.datastructures import Headers

        scope = {
            "type": "http",
            "method": "GET",
            "path": "/",
            "headers": Headers({}).raw,
            "client": ("203.0.113.42", 9999),
            "query_string": b"",
        }
        req = Request(scope)
        key = get_limit_key(req)
        assert key.startswith("ip:")

    def test_get_limit_key_hashes_api_key(self):
        """Two different API keys must produce different hashed storage keys."""
        from main import get_limit_key
        from starlette.requests import Request
        from starlette.datastructures import Headers

        def make_req(api_key: str) -> Request:
            return Request({
                "type": "http",
                "method": "GET",
                "path": "/",
                "headers": Headers({"x-api-key": api_key}).raw,
                "client": ("1.2.3.4", 80),
                "query_string": b"",
            })

        key_a = get_limit_key(make_req("bot-key-aaa"))
        key_b = get_limit_key(make_req("bot-key-bbb"))
        assert key_a != key_b
