import pytest
import sys
import os

# Make sapybase_ai_engine importable without installing
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

# Stub heavy env vars so importing main.py doesn't crash in test env
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("CLERK_JWT_ISSUER", "https://test.clerk.accounts.dev")
os.environ.setdefault("CLERK_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("POLAR_WEBHOOK_SECRET", "test-polar-secret")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")
os.environ.setdefault("ENV", "test")


@pytest.fixture(autouse=True, scope="session")
def _disable_slowapi_limiter():
    """Turn off slowapi's per-IP/per-key limits for the whole run.

    The limiter is backed by REDIS, so its counters outlive the process: a file that
    passes on its own fails when the suite re-runs it inside the same minute, and
    whether you get a 429 depends on how recently you last ran the tests. That is
    pure flakiness — every endpoint here is exercised from one IP with one key.

    The app's OWN rate limits (tier chat caps, the sample daily cap) use separate
    Redis counters and are unaffected, so the tests that assert a 429 still do.
    """
    import main

    limiter = getattr(main, "limiter", None)
    previous = getattr(limiter, "enabled", None)
    if limiter is not None:
        limiter.enabled = False
    yield
    if limiter is not None and previous is not None:
        limiter.enabled = previous


@pytest.fixture(autouse=True)
def _reset_coa_index_memo():
    """Drop the COA in-process index memo around every test.

    `coa_drive` memoizes the parsed Drive listing for the cache TTL so a warm worker
    never re-parses it. That memo is module-global, so without this a listing walked
    by one test is silently served to the next — which would hide exactly the walk
    counts and cache misses these tests exist to assert.
    """
    from services import coa_drive

    coa_drive.reset_index_memo()
    yield
    coa_drive.reset_index_memo()
