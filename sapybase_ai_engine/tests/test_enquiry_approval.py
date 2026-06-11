"""Tests for the Explore enquiry approval brain (Explore §6, Phase C1)."""
import pytest


def _m():
    import enquiry_approval as ea
    return ea


SECRET = "test-secret-please-rotate"
EID = "11111111-2222-3333-4444-555555555555"


class TestTargetStatus:
    def test_approve_maps_to_approved(self):
        ea = _m()
        assert ea.target_status_for(ea.ACTION_APPROVE) == ea.STATUS_APPROVED

    def test_decline_maps_to_rejected(self):
        ea = _m()
        assert ea.target_status_for(ea.ACTION_DECLINE) == ea.STATUS_REJECTED

    def test_unknown_maps_to_none(self):
        ea = _m()
        assert ea.target_status_for("explode") is None


class TestMintVerifyRoundTrip:
    def test_round_trip_approve(self):
        ea = _m()
        tok = ea.mint_action_token(EID, ea.ACTION_APPROVE, SECRET, now=1000)
        ok, info = ea.verify_action_token(tok, SECRET, now=1001)
        assert ok is True
        assert info == {"enquiry_id": EID, "action": ea.ACTION_APPROVE}

    def test_round_trip_decline(self):
        ea = _m()
        tok = ea.mint_action_token(EID, ea.ACTION_DECLINE, SECRET, now=1000)
        ok, info = ea.verify_action_token(tok, SECRET, now=1001)
        assert ok and info["action"] == ea.ACTION_DECLINE

    def test_tokens_are_unique_per_mint(self):
        # Nonce makes each token distinct even for identical (eid, action).
        ea = _m()
        a = ea.mint_action_token(EID, ea.ACTION_APPROVE, SECRET, now=1000)
        b = ea.mint_action_token(EID, ea.ACTION_APPROVE, SECRET, now=1000)
        assert a != b

    def test_mint_rejects_bad_action(self):
        ea = _m()
        with pytest.raises(ValueError):
            ea.mint_action_token(EID, "nuke", SECRET)

    def test_mint_requires_secret_and_id(self):
        ea = _m()
        with pytest.raises(ValueError):
            ea.mint_action_token(EID, ea.ACTION_APPROVE, "")
        with pytest.raises(ValueError):
            ea.mint_action_token("", ea.ACTION_APPROVE, SECRET)


class TestVerifyFailures:
    def test_no_secret(self):
        ea = _m()
        tok = ea.mint_action_token(EID, ea.ACTION_APPROVE, SECRET, now=1000)
        assert ea.verify_action_token(tok, "", now=1001) == (False, "secret_unset")

    @pytest.mark.parametrize("bad", [None, "", "nodot", 12345, "a.b.c.d"])
    def test_malformed(self, bad):
        ea = _m()
        ok, reason = ea.verify_action_token(bad, SECRET, now=1001)
        assert ok is False
        assert reason in {"malformed", "bad_sig", "bad_payload", "bad_action"}

    def test_tampered_signature(self):
        ea = _m()
        tok = ea.mint_action_token(EID, ea.ACTION_APPROVE, SECRET, now=1000)
        raw, _, _ = tok.rpartition(".")
        forged = raw + "." + ("0" * 64)
        assert ea.verify_action_token(forged, SECRET, now=1001) == (False, "bad_sig")

    def test_wrong_secret(self):
        ea = _m()
        tok = ea.mint_action_token(EID, ea.ACTION_APPROVE, SECRET, now=1000)
        ok, reason = ea.verify_action_token(tok, "other-secret", now=1001)
        assert ok is False and reason == "bad_sig"

    def test_expired(self):
        ea = _m()
        tok = ea.mint_action_token(EID, ea.ACTION_APPROVE, SECRET, now=1000, ttl=100)
        assert ea.verify_action_token(tok, SECRET, now=1101) == (False, "expired")

    def test_not_yet_expired_boundary(self):
        ea = _m()
        tok = ea.mint_action_token(EID, ea.ACTION_APPROVE, SECRET, now=1000, ttl=100)
        ok, _ = ea.verify_action_token(tok, SECRET, now=1099)
        assert ok is True


class TestResolveAction:
    def test_pending_applies(self):
        ea = _m()
        assert ea.resolve_action(ea.STATUS_PENDING, ea.ACTION_APPROVE) == ea.OUTCOME_APPLY
        assert ea.resolve_action(ea.STATUS_PENDING, ea.ACTION_DECLINE) == ea.OUTCOME_APPLY

    def test_approved_is_terminal_noop(self):
        ea = _m()
        assert ea.resolve_action(ea.STATUS_APPROVED, ea.ACTION_APPROVE) == ea.OUTCOME_NOOP_APPROVED
        assert ea.resolve_action(ea.STATUS_APPROVED, ea.ACTION_DECLINE) == ea.OUTCOME_NOOP_APPROVED

    def test_rejected_is_terminal_noop(self):
        ea = _m()
        assert ea.resolve_action(ea.STATUS_REJECTED, ea.ACTION_APPROVE) == ea.OUTCOME_NOOP_REJECTED
        assert ea.resolve_action(ea.STATUS_REJECTED, ea.ACTION_DECLINE) == ea.OUTCOME_NOOP_REJECTED

    def test_invalid_action(self):
        ea = _m()
        assert ea.resolve_action(ea.STATUS_PENDING, "explode") == ea.OUTCOME_INVALID

    @pytest.mark.parametrize("weird", [None, "", "PENDING", " Pending "])
    def test_null_or_casey_status_treated_as_pending(self, weird):
        ea = _m()
        assert ea.resolve_action(weird, ea.ACTION_APPROVE) == ea.OUTCOME_APPLY
