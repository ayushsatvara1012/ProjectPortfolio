"""Tests for instant-booking helpers (pure helpers in booking.py)."""
from booking import QUALIFIED_BANDS, should_offer_booking, is_valid_booking_url


class TestShouldOfferBooking:
    def test_qualified_bands(self):
        for band in QUALIFIED_BANDS:
            assert should_offer_booking(band) is True

    def test_case_insensitive(self):
        assert should_offer_booking("hot") is True
        assert should_offer_booking("  Warm ") is True

    def test_cold_and_unknown(self):
        assert should_offer_booking("COLD") is False
        assert should_offer_booking("nonsense") is False

    def test_empty_and_none(self):
        assert should_offer_booking(None) is False
        assert should_offer_booking("") is False
        assert should_offer_booking(0) is False


class TestIsValidBookingUrl:
    def test_https_ok(self):
        assert is_valid_booking_url("https://calendly.com/acme/30min") is True
        assert is_valid_booking_url("  https://cal.com/acme  ") is True
        assert is_valid_booking_url("HTTPS://hubspot.com/meetings/x") is True

    def test_rejects_non_https(self):
        assert is_valid_booking_url("http://calendly.com/acme") is False
        assert is_valid_booking_url("ftp://x") is False
        assert is_valid_booking_url("calendly.com/acme") is False

    def test_rejects_non_string_and_empty(self):
        assert is_valid_booking_url("") is False
        assert is_valid_booking_url(None) is False
        assert is_valid_booking_url(123) is False
