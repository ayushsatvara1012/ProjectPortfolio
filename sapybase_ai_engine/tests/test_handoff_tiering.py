"""Phase 3.3 — owner-notification tiering + per-session dedup.

Instant Slack/email pings are reserved for high-intent events: price-on-request
quotes that captured an email, and sample submits. Priced quotes and bare
price-checks stay in the dashboard. A given session pings at most once per kind
per hour. All of this degrades OPEN (notify) when Redis is unavailable.
"""
import asyncio

import main


def _run(coro):
    return asyncio.run(coro)


class _FakeRedis:
    def __init__(self):
        self.store = {}

    async def set(self, key, val, ex=None, nx=False):
        if nx and key in self.store:
            return None
        self.store[key] = val
        return True


# ── tiering (pure) ───────────────────────────────────────────────────────────

def test_tier_por_with_email_notifies():
    assert main._handoff_meets_tier(
        {"kind": "quote", "is_por": True, "contact_email": "a@b.com"}) is True


def test_tier_por_without_email_suppressed():
    assert main._handoff_meets_tier(
        {"kind": "quote", "is_por": True, "contact_email": None}) is False
    assert main._handoff_meets_tier(
        {"kind": "quote", "is_por": True, "contact_email": "not-an-email"}) is False


def test_tier_priced_quote_suppressed():
    # A real price with contact is a dashboard record, not a phone interrupt.
    assert main._handoff_meets_tier(
        {"kind": "quote", "is_por": False, "contact_email": "a@b.com"}) is False


def test_tier_sample_always_notifies():
    assert main._handoff_meets_tier({"kind": "sample"}) is True


# ── dedup (async) ────────────────────────────────────────────────────────────

def test_dedup_first_notifies_second_suppressed(monkeypatch):
    monkeypatch.setattr(main, "r", _FakeRedis())
    assert _run(main._handoff_dedup_ok("c1", "s1", "quote")) is True
    assert _run(main._handoff_dedup_ok("c1", "s1", "quote")) is False
    # A different kind in the same session is still allowed through.
    assert _run(main._handoff_dedup_ok("c1", "s1", "sample")) is True


def test_dedup_degrades_open_without_redis(monkeypatch):
    monkeypatch.setattr(main, "r", None)
    assert _run(main._handoff_dedup_ok("c1", "s1", "quote")) is True


def test_dedup_degrades_open_without_session(monkeypatch):
    monkeypatch.setattr(main, "r", _FakeRedis())
    assert _run(main._handoff_dedup_ok("c1", None, "quote")) is True


# ── end-to-end gating of _fire_agent_handoff ─────────────────────────────────

def _capture_email(monkeypatch):
    sent = []
    monkeypatch.setattr(main, "send_transactional_email",
                        lambda *a, **k: sent.append(a))
    return sent


def test_fire_skips_priced_quote(monkeypatch):
    monkeypatch.setattr(main, "r", None)
    sent = _capture_email(monkeypatch)
    _run(main._fire_agent_handoff(
        None, "owner@x.com", "Bot",
        {"kind": "quote", "is_por": False, "contact_email": "a@b.com", "product": "Acetone"},
        "c1", "s1"))
    assert sent == []


def test_fire_sends_por_with_email_once(monkeypatch):
    monkeypatch.setattr(main, "r", _FakeRedis())
    sent = _capture_email(monkeypatch)
    req = {"kind": "quote", "is_por": True, "contact_email": "a@b.com", "product": "Acetone"}
    _run(main._fire_agent_handoff(None, "owner@x.com", "Bot", req, "c1", "s1"))
    _run(main._fire_agent_handoff(None, "owner@x.com", "Bot", req, "c1", "s1"))
    assert len(sent) == 1  # per-session dedup suppressed the second ping
