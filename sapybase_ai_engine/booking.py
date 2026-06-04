"""Instant-booking (speed-to-lead) helpers — pure, no I/O.

When a lead is captured the widget can immediately offer a "Book a call" CTA
that opens the owner's scheduling link (Calendly, Cal.com, etc.). To keep the
booking offer focused on high-intent prospects, only QUALIFIED bands see it.

Distinct from `handoff_redirect_url` (shown after a human-handoff request) — the
booking link is an outcome of *lead scoring*, surfaced the moment a qualified
lead leaves their details.
"""

# Lead-score bands that are offered the instant booking CTA.
QUALIFIED_BANDS = ("HOT", "WARM")


def should_offer_booking(band) -> bool:
    """True if a lead in this score band should see the booking CTA.

    Case-insensitive; unknown/None bands (incl. COLD) return False.
    """
    if not band:
        return False
    return str(band).strip().upper() in QUALIFIED_BANDS


def is_valid_booking_url(url) -> bool:
    """A booking URL must be a non-empty HTTPS link.

    We intentionally do NOT lock this to specific vendors (Calendly, Cal.com,
    HubSpot, SavvyCal, …) — owners use many schedulers. HTTPS-only is the guard.
    """
    if not isinstance(url, str):
        return False
    return url.strip().lower().startswith("https://")
