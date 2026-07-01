"""Tests for the Explore enquiry request model (Explore §3, Phase B2)."""
import pytest
from pydantic import ValidationError


def _model():
    from db.models import ExploreEnquiryRequest
    return ExploreEnquiryRequest


class TestExploreEnquiryRequest:
    def test_minimal_valid(self):
        M = _model()
        m = M(email="Jane@Gmail.com")
        assert m.email == "jane@gmail.com"   # normalized
        assert m.name is None
        assert m.website is None             # honeypot defaults empty

    def test_full_payload(self):
        M = _model()
        m = M(email="a@b.com", name="  Jane  ", company_name=" Acme ",
              use_case="  build a bot  ")
        assert m.name == "Jane"
        assert m.company_name == "Acme"
        assert m.use_case == "build a bot"

    def test_blank_fields_become_none(self):
        M = _model()
        m = M(email="a@b.com", name="   ", company_name="", use_case="  ")
        assert m.name is None
        assert m.company_name is None
        assert m.use_case is None

    @pytest.mark.parametrize("bad", ["notanemail", "no@domain", "@nope.com", "a@b"])
    def test_invalid_email_rejected(self, bad):
        M = _model()
        with pytest.raises(ValidationError):
            M(email=bad)

    def test_honeypot_field_accepts_value(self):
        # The field must exist so bots can fill it; the endpoint decides what to do.
        M = _model()
        m = M(email="a@b.com", website="http://spam.example")
        assert m.website == "http://spam.example"

    def test_length_caps_enforced(self):
        M = _model()
        with pytest.raises(ValidationError):
            M(email="a@b.com", use_case="x" * 1001)


class TestEnquiryDeclineRequest:
    def _model(self):
        from db.models import EnquiryDeclineRequest
        return EnquiryDeclineRequest

    def test_valid_reason_trimmed(self):
        m = self._model()(reason="  spammy signup  ")
        assert m.reason == "spammy signup"

    @pytest.mark.parametrize("bad", ["", "  ", "ab", "  x "])
    def test_reason_required_min_length(self, bad):
        with pytest.raises(ValidationError):
            self._model()(reason=bad)

    def test_reason_max_length(self):
        with pytest.raises(ValidationError):
            self._model()(reason="x" * 501)
