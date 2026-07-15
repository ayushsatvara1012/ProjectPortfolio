"""Unit tests for the Origin-check branch of verify_api_key_and_origin.

Regression coverage for the ALLOWED_DEV_ORIGINS gap: a dev origin that isn't
one of the fixed ports hardcoded in ALLOWED_ORIGINS used to hit
`if is_dev and actual_client_origin in ALLOWED_DEV_ORIGINS` while that name
was undefined, raising a NameError instead of a clean 403. The DB is faked
(scripted cursor) so only the origin-matching logic is under test.
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost/test")
os.environ.setdefault("GEMINI_API_KEY", "test-key")
os.environ.setdefault("CLERK_JWT_ISSUER", "https://test.clerk.accounts.dev")
os.environ.setdefault("CLERK_WEBHOOK_SECRET", "whsec_test")
os.environ.setdefault("ADMIN_SECRET", "test-admin-secret")
os.environ.setdefault("ENV", "test")

import pytest  # noqa: E402
from fastapi import HTTPException  # noqa: E402
from starlette.requests import Request  # noqa: E402


# A full companies-JOIN-users row matching the SELECT in verify_api_key_and_origin.
# allowed_origin (index 4) is a real merchant site, so any dev localhost origin
# below always falls through to the ALLOWED_ORIGINS / ALLOWED_DEV_ORIGINS checks.
COMPANY_ROW = (
    "comp-1", "Acme", "Professional", "#5730F5", "https://acme.example.com",
    "You are helpful.", "Acme Bot", None, "Hi!", None,
    "circle", None, "none", "FREE", "OWNER", None,
    "owner@acme.example.com", None, False,
    "user-1", None, None,
    None, None, None,
    None, None, None, None,
)


class FakeCursor:
    def __init__(self, row):
        self._row = row

    def execute(self, sql, params=None):
        pass

    def fetchone(self):
        return self._row

    def close(self):
        pass


class FakeConn:
    def __init__(self, row):
        self._cursor = FakeCursor(row)

    def cursor(self):
        return self._cursor


@pytest.fixture
def main_mod():
    import main
    return main


def _request_with_origin(origin: str) -> Request:
    scope = {
        "type": "http",
        "headers": [(b"origin", origin.encode())] if origin else [],
    }
    return Request(scope)


class TestDevOriginFallback:
    def test_dev_origin_outside_fixed_allowlist_is_accepted_in_dev(self, main_mod, monkeypatch):
        """A localhost port that's only in ALLOWED_DEV_ORIGINS (not ALLOWED_ORIGINS)
        must be accepted when ENV=development - this is the exact branch that used
        to NameError before ALLOWED_DEV_ORIGINS was defined."""
        dev_origin = "http://localhost:5177"
        assert dev_origin not in main_mod.ALLOWED_ORIGINS
        assert dev_origin in main_mod.ALLOWED_DEV_ORIGINS

        monkeypatch.setattr(main_mod, "get_db_connection", lambda: FakeConn(COMPANY_ROW))
        monkeypatch.setattr(main_mod, "release_db_connection", lambda c: None)
        monkeypatch.setattr(main_mod.os, "getenv", lambda k, d=None: "development" if k == "ENV" else d)

        company = main_mod.verify_api_key_and_origin(
            _request_with_origin(dev_origin), api_key="whatever"
        )
        assert company["id"] == "comp-1"

    def test_dev_origin_rejected_outside_dev_mode(self, main_mod, monkeypatch):
        """The same origin must NOT be granted a pass when ENV isn't development -
        ALLOWED_DEV_ORIGINS is a dev-only carve-out, not a general allowlist."""
        dev_origin = "http://localhost:5177"

        monkeypatch.setattr(main_mod, "get_db_connection", lambda: FakeConn(COMPANY_ROW))
        monkeypatch.setattr(main_mod, "release_db_connection", lambda c: None)
        monkeypatch.setattr(main_mod.os, "getenv", lambda k, d=None: "production" if k == "ENV" else d)

        with pytest.raises(HTTPException) as exc_info:
            main_mod.verify_api_key_and_origin(
                _request_with_origin(dev_origin), api_key="whatever"
            )
        assert exc_info.value.status_code == 403

    def test_origin_outside_both_allowlists_rejected_in_dev(self, main_mod, monkeypatch):
        """A totally unrecognized origin must still 403 even in dev mode - the
        dev carve-out is scoped to ALLOWED_DEV_ORIGINS, not "anything local"."""
        monkeypatch.setattr(main_mod, "get_db_connection", lambda: FakeConn(COMPANY_ROW))
        monkeypatch.setattr(main_mod, "release_db_connection", lambda c: None)
        monkeypatch.setattr(main_mod.os, "getenv", lambda k, d=None: "development" if k == "ENV" else d)

        with pytest.raises(HTTPException) as exc_info:
            main_mod.verify_api_key_and_origin(
                _request_with_origin("https://evil.example.com"), api_key="whatever"
            )
        assert exc_info.value.status_code == 403
