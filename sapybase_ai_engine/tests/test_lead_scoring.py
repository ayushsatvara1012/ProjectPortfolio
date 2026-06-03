"""
Tests for deterministic lead scoring (Track 3 item 12).

_score_lead is a pure function: (context, email, name) -> {score, band, reasons}.
No I/O, no LLM, so every edge case is exercised directly.
"""
import main


def score(ctx=None, email=None, name=None):
    return main._score_lead(ctx, email, name)


# ── Band thresholds & clamping ───────────────────────────────────────────────

class TestBandsAndRange:
    def test_score_always_in_0_100(self):
        for ctx in ("", "quote pricing cost buy demo subscribe upgrade order", None):
            r = score(ctx, "a@acme.io", "Jane")
            assert 0 <= r["score"] <= 100

    def test_empty_everything_is_cold_zero(self):
        r = score(None, None, None)
        assert r["score"] == 0
        assert r["band"] == "COLD"
        assert r["reasons"] == ["no strong signals"]

    def test_band_boundaries(self):
        assert main._score_lead("", "x@y", None)["band"] == "COLD"           # 0
        # WARM lower edge: business email (25) + name (5) + buying 1 (20) = 50
        r_warm = score("pricing", "a@acme.io", "Jane")
        assert r_warm["score"] == 50 and r_warm["band"] == "WARM"
        # HOT: business + 3 buying + contact + engaged
        r_hot = score("quote pricing cost || talk to sales || get in touch", "a@acme.io", "Jane")
        assert r_hot["score"] >= 70 and r_hot["band"] == "HOT"

    def test_score_cannot_exceed_100(self):
        ctx = ("quote pricing cost buy demo subscribe upgrade || "
               "talk to sales contact us reach out || "
               "i still want to buy more and get a quote")
        r = score(ctx, "ceo@bigcorp.com", "The Boss")
        assert r["score"] == 100
        assert r["band"] == "HOT"


# ── Buying intent ────────────────────────────────────────────────────────────

class TestBuyingIntent:
    def test_single_buying_keyword(self):
        r = score("what is the pricing", "x@gmail.com", None)
        assert r["score"] == 20  # 1 buying hit only
        assert any("buying intent" in s for s in r["reasons"])

    def test_more_keywords_score_higher_but_capped(self):
        one = score("pricing", "x@gmail.com", None)["score"]
        two = score("pricing and cost", "x@gmail.com", None)["score"]
        many = score("pricing cost buy demo quote purchase", "x@gmail.com", None)["score"]
        assert one == 20 and two == 30 and many == 40  # capped at 40

    def test_no_buying_keyword_no_points(self):
        r = score("what are your office hours", "x@gmail.com", None)
        assert not any("buying intent" in s for s in r["reasons"])


# ── Contact / human intent ───────────────────────────────────────────────────

class TestContactIntent:
    def test_contact_intent_adds_points(self):
        r = score("can i talk to sales", "x@gmail.com", None)
        assert r["score"] == 12
        assert any("talk to sales/human" in s for s in r["reasons"])


# ── Email domain ─────────────────────────────────────────────────────────────

class TestEmailDomain:
    def test_business_email_adds_points(self):
        r = score("hello", "jane@acme.io", None)
        assert r["score"] == 25
        assert any("business email" in s for s in r["reasons"])

    def test_free_email_no_points_but_noted(self):
        r = score("hello", "jane@gmail.com", None)
        assert r["score"] == 0
        assert "personal email" in r["reasons"]

    def test_free_domains_are_case_insensitive(self):
        assert score("hi", "X@GMAIL.COM", None)["score"] == 0

    def test_malformed_email_no_domain_points(self):
        r = score("hi", "not-an-email", None)
        assert r["score"] == 0
        # No domain -> neither business nor personal note
        assert not any("email" in s for s in r["reasons"])

    def test_none_email(self):
        assert score("hi", None, None)["score"] == 0

    def test_email_domain_helper(self):
        assert main._email_domain("a@b.com") == "b.com"
        assert main._email_domain("bad") == ""
        assert main._email_domain(None) == ""
        assert main._email_domain("UP@CASE.COM") == "case.com"


# ── Name & engagement ────────────────────────────────────────────────────────

class TestNameAndEngagement:
    def test_name_adds_small_points(self):
        with_name = score("hi", "x@gmail.com", "Jane")["score"]
        no_name = score("hi", "x@gmail.com", None)["score"]
        assert with_name - no_name == 5

    def test_blank_name_does_not_count(self):
        assert score("hi", "x@gmail.com", "   ")["score"] == 0

    def test_engagement_two_messages(self):
        r = score("tell me more || how does this work", "x@gmail.com", None)
        assert any("engaged (2 messages)" in s for s in r["reasons"])

    def test_engagement_three_plus_messages(self):
        r = score("first question || second question || third question", "x@gmail.com", None)
        assert any("engaged (3+ messages)" in s for s in r["reasons"])

    def test_short_fragments_do_not_count_as_turns(self):
        # Fragments under 8 chars are ignored, so "hi || ok || yo" is not "engaged".
        r = score("hi || ok || yo", "x@gmail.com", None)
        assert not any("engaged" in s for s in r["reasons"])


# ── Reason explainability & shape ────────────────────────────────────────────

class TestShape:
    def test_returns_expected_keys(self):
        r = score("pricing", "a@acme.io", "Jane")
        assert set(r.keys()) == {"score", "band", "reasons"}
        assert isinstance(r["reasons"], list)

    def test_reasons_never_empty(self):
        assert score(None, None, None)["reasons"]
