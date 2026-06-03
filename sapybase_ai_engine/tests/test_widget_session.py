"""
Edge-case tests for the widget session-token anti-quota-drain feature.

Covers _mint_widget_session / _verify_widget_session across every reason code
and boundary condition, so the feature can't silently break the live chat path.

The helpers read module globals (WIDGET_SESSION_SECRET / _TTL) at call time, so
tests patch those on the imported `main` module and restore them afterward.
"""
import base64
import hashlib
import hmac
import json
import time

import pytest

import main


SECRET = "unit-test-secret-do-not-use-in-prod"
OTHER_SECRET = "a-different-secret"


@pytest.fixture
def with_secret(monkeypatch):
    """Enable token minting with a known secret + default TTL/budget."""
    monkeypatch.setattr(main, "WIDGET_SESSION_SECRET", SECRET)
    monkeypatch.setattr(main, "WIDGET_SESSION_TTL", 1800)
    monkeypatch.setattr(main, "WIDGET_SESSION_MSG_BUDGET", 30)
    return SECRET


def _make_token(payload: dict, secret: str) -> str:
    """Replicate main's signing so tests can craft arbitrary payloads."""
    raw = base64.urlsafe_b64encode(
        json.dumps(payload, separators=(",", ":")).encode()
    ).decode().rstrip("=")
    sig = hmac.new(secret.encode(), raw.encode(), hashlib.sha256).hexdigest()
    return f"{raw}.{sig}"


# ── Happy path ────────────────────────────────────────────────────────────────

class TestRoundTrip:
    def test_mint_then_verify_is_valid(self, with_secret):
        minted = main._mint_widget_session("company-123", "https://shop.example.com")
        ok, info = main._verify_widget_session(
            minted["token"], "company-123", "https://shop.example.com"
        )
        assert ok is True
        # info is the nonce on success — used as the per-token budget key.
        assert info == minted["nonce"]
        assert info  # non-empty

    def test_mint_returns_future_expiry(self, with_secret):
        minted = main._mint_widget_session("c1", "https://a.com")
        assert minted["exp"] > int(time.time())

    def test_each_mint_has_unique_nonce_and_token(self, with_secret):
        a = main._mint_widget_session("c1", "https://a.com")
        b = main._mint_widget_session("c1", "https://a.com")
        assert a["nonce"] != b["nonce"]
        assert a["token"] != b["token"]


# ── Origin handling ─────────────────────────────────────────────────────────--

class TestOriginBinding:
    def test_origin_trailing_slash_and_case_normalized(self, with_secret):
        minted = main._mint_widget_session("c1", "https://Example.com/")
        ok, _ = main._verify_widget_session(minted["token"], "c1", "https://example.com")
        assert ok is True

    def test_origin_mismatch_rejected(self, with_secret):
        minted = main._mint_widget_session("c1", "https://good.com")
        ok, reason = main._verify_widget_session(minted["token"], "c1", "https://evil.com")
        assert ok is False
        assert reason == "origin_mismatch"

    def test_origin_check_skipped_when_token_origin_empty(self, with_secret):
        # Minted without an origin -> po is empty in payload -> binding is best-effort.
        minted = main._mint_widget_session("c1", "")
        ok, _ = main._verify_widget_session(minted["token"], "c1", "https://anything.com")
        assert ok is True

    def test_origin_check_skipped_when_request_origin_empty(self, with_secret):
        minted = main._mint_widget_session("c1", "https://good.com")
        ok, _ = main._verify_widget_session(minted["token"], "c1", "")
        assert ok is True


# ── Failure / tamper cases ───────────────────────────────────────────────────

class TestRejections:
    def test_secret_unset_rejects(self, monkeypatch):
        monkeypatch.setattr(main, "WIDGET_SESSION_SECRET", None)
        ok, reason = main._verify_widget_session("anything.sig", "c1", "https://a.com")
        assert ok is False
        assert reason == "secret_unset"

    def test_empty_token_rejected(self, with_secret):
        ok, reason = main._verify_widget_session("", "c1", "https://a.com")
        assert ok is False
        assert reason == "malformed"

    def test_token_without_separator_rejected(self, with_secret):
        ok, reason = main._verify_widget_session("no-dot-here", "c1", "https://a.com")
        assert ok is False
        assert reason == "malformed"

    def test_bad_signature_rejected(self, with_secret):
        minted = main._mint_widget_session("c1", "https://a.com")
        raw, _, _sig = minted["token"].rpartition(".")
        tampered = f"{raw}.{'0' * 64}"
        ok, reason = main._verify_widget_session(tampered, "c1", "https://a.com")
        assert ok is False
        assert reason == "bad_sig"

    def test_token_signed_with_wrong_secret_rejected(self, with_secret):
        # Attacker forges a payload but signs with a secret they don't have.
        payload = {
            "cid": "c1", "po": "https://a.com",
            "iat": int(time.time()), "exp": int(time.time()) + 1800, "n": "abc",
        }
        forged = _make_token(payload, OTHER_SECRET)
        ok, reason = main._verify_widget_session(forged, "c1", "https://a.com")
        assert ok is False
        assert reason == "bad_sig"

    def test_tampered_payload_breaks_signature(self, with_secret):
        # Flipping any payload byte invalidates the HMAC -> bad_sig.
        minted = main._mint_widget_session("c1", "https://a.com")
        raw, _, sig = minted["token"].rpartition(".")
        flipped = ("A" if raw[0] != "A" else "B") + raw[1:]
        ok, reason = main._verify_widget_session(f"{flipped}.{sig}", "c1", "https://a.com")
        assert ok is False
        assert reason == "bad_sig"

    def test_valid_signature_but_non_json_payload_is_bad_payload(self, with_secret):
        # Correctly-signed but the decoded body isn't JSON -> bad_payload branch.
        raw = base64.urlsafe_b64encode(b"this-is-not-json").decode().rstrip("=")
        sig = hmac.new(SECRET.encode(), raw.encode(), hashlib.sha256).hexdigest()
        ok, reason = main._verify_widget_session(f"{raw}.{sig}", "c1", "https://a.com")
        assert ok is False
        assert reason == "bad_payload"

    def test_expired_token_rejected(self, with_secret):
        payload = {
            "cid": "c1", "po": "https://a.com",
            "iat": int(time.time()) - 4000, "exp": int(time.time()) - 100, "n": "abc",
        }
        token = _make_token(payload, SECRET)
        ok, reason = main._verify_widget_session(token, "c1", "https://a.com")
        assert ok is False
        assert reason == "expired"

    def test_company_id_mismatch_rejected(self, with_secret):
        minted = main._mint_widget_session("company-A", "https://a.com")
        ok, reason = main._verify_widget_session(minted["token"], "company-B", "https://a.com")
        assert ok is False
        assert reason == "cid_mismatch"


# ── Boundary conditions ──────────────────────────────────────────────────────

class TestBoundaries:
    def test_token_at_exact_expiry_boundary(self, with_secret):
        # exp == now should be treated as expired (strict <  -> exp < now is False
        # when equal, so it is NOT expired at exactly now; one second past is).
        now = int(time.time())
        not_yet = _make_token(
            {"cid": "c1", "po": "", "iat": now, "exp": now + 1, "n": "x"}, SECRET
        )
        ok, _ = main._verify_widget_session(not_yet, "c1", "")
        assert ok is True

        just_expired = _make_token(
            {"cid": "c1", "po": "", "iat": now - 10, "exp": now - 1, "n": "x"}, SECRET
        )
        ok2, reason2 = main._verify_widget_session(just_expired, "c1", "")
        assert ok2 is False
        assert reason2 == "expired"

    def test_missing_nonce_yields_empty_info_but_still_valid(self, with_secret):
        # Defensive: a token without "n" verifies but returns empty info, which
        # the chat path treats as "skip per-token budget" (elif r and _sess_info).
        now = int(time.time())
        token = _make_token(
            {"cid": "c1", "po": "", "iat": now, "exp": now + 1800}, SECRET
        )
        ok, info = main._verify_widget_session(token, "c1", "")
        assert ok is True
        assert info == ""


# ── Config defaults / safety ─────────────────────────────────────────────────

class TestConfigDefaults:
    def test_enforce_defaults_off(self):
        # Live-safety: out of the box, enforcement must be OFF so existing chat
        # traffic (no token yet) is never blocked until explicitly enabled.
        assert main.WIDGET_SESSION_ENFORCE is False

    def test_ttl_and_budget_are_positive_ints(self):
        assert isinstance(main.WIDGET_SESSION_TTL, int) and main.WIDGET_SESSION_TTL > 0
        assert isinstance(main.WIDGET_SESSION_MSG_BUDGET, int) and main.WIDGET_SESSION_MSG_BUDGET > 0
