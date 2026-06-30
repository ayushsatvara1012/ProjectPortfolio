"""Phase 2 — deterministic sales-funnel state machine."""

from services import sales_funnel as sf


# ── derive_stage: monotonic advancement ──────────────────────────────────────

def test_browsing_when_nothing_captured():
    assert sf.derive_stage(None, {}) == "browsing"


def test_selectors_advance_to_qualifying():
    cap = {"grade_selector": {"product": "Ethanol", "grades": ["Absolute"]}}
    assert sf.derive_stage("browsing", cap) == "qualifying"


def test_sds_advances_to_recommended():
    assert sf.derive_stage("browsing", {"sds": {"product": "Toluene"}}) == "recommended"


def test_quote_advances_to_quoted():
    cap = {"quote": {"product": "Ethanol", "status": "quoted"}}
    assert sf.derive_stage("recommended", cap) == "quoted"


def test_quote_with_contact_advances_to_captured():
    cap = {
        "quote": {"product": "Ethanol", "status": "quoted"},
        "handoff": {"kind": "quote", "contact_email": "a@acme.com"},
    }
    assert sf.derive_stage("recommended", cap) == "captured"


def test_spec_advances_to_recommended_and_records_product():
    cap = {"spec": {"product": "IPA", "grade": "AR", "packaging": "500 ml, 2.5 Ltr"}}
    st = sf.derive_state({}, cap)
    assert st["stage"] == "recommended"
    assert st["products"] == [{"name": "IPA", "grade": "AR", "pack": None}]
    assert st["next_action"] == "offer_quote"


def test_human_handoff_is_terminal_stage():
    assert sf.derive_stage("quoted", {"handoff": {"kind": "human"}}) == "handed_off"


def test_stage_never_regresses():
    # A late clarifying selector must not pull a quoted lead back.
    cap = {"grade_selector": {"product": "Ethanol", "grades": ["Absolute"]}}
    assert sf.derive_stage("quoted", cap) == "quoted"


def test_stage_holds_when_turn_has_no_signal():
    assert sf.derive_stage("recommended", {}) == "recommended"


# ── next_best_action ─────────────────────────────────────────────────────────

def test_action_browsing_recommends():
    assert sf.next_best_action("browsing", {}) == "recommend_product"


def test_action_recommended_offers_quote():
    assert sf.next_best_action("recommended", {}) == "offer_quote"


def test_action_quoted_asks_for_email_when_unknown():
    assert sf.next_best_action("quoted", {}) == "ask_for_email"


def test_action_quoted_offers_handoff_when_email_known():
    assert sf.next_best_action("quoted", {"email": "a@acme.com"}) == "offer_handoff"


def test_action_captured_offers_booking_for_qualified_band():
    prof = {"email": "a@acme.com", "band": "WARM"}
    assert sf.next_best_action("captured", prof) == "offer_booking"


def test_action_captured_cold_falls_back_to_handoff():
    prof = {"email": "a@acme.com", "band": "COLD"}
    assert sf.next_best_action("captured", prof) == "offer_handoff"


def test_action_handed_off_awaits_owner():
    assert sf.next_best_action("handed_off", {}) == "await_owner"


def test_every_action_has_a_directive():
    for stage in sf.STAGES:
        action = sf.next_best_action(stage, {})
        assert sf.action_directive(action)  # non-empty


# ── derive_state: accumulation ───────────────────────────────────────────────

def test_state_accumulates_products_and_quotes():
    cap = {
        "quote": {"product": "Ethanol", "grade": "Absolute",
                  "pack_size": "5 Ltr", "status": "quoted", "subtotal": 1450},
    }
    st = sf.derive_state({"stage": "recommended"}, cap)
    assert st["stage"] == "quoted"
    assert st["products"] == [{"name": "Ethanol", "grade": "Absolute", "pack": "5 Ltr"}]
    assert st["quotes"][0]["amount"] == 1450
    assert st["quotes"][0]["por"] is False
    assert st["next_action"] == "ask_for_email"


def test_state_dedupes_repeated_product():
    cap = {"sds": {"product": "Toluene"}}
    st1 = sf.derive_state({}, cap)
    st2 = sf.derive_state(st1, cap)
    assert len(st2["products"]) == 1


def test_state_records_missing_for_selectors():
    cap = {"pack_selector": {"product": "Ethanol", "grade": "Absolute",
                             "pack_sizes": ["5 Ltr"]}}
    st = sf.derive_state({}, cap)
    assert "pack_size" in st["missing"]


def test_por_quote_flagged():
    cap = {"quote": {"product": "Caustic", "status": "price_on_request"}}
    st = sf.derive_state({}, cap)
    assert st["quotes"][0]["por"] is True


# ── build_lead_profile ───────────────────────────────────────────────────────

def test_profile_captures_contact_from_handoff():
    cap = {"handoff": {"kind": "quote", "contact_name": "Rahul",
                       "contact_email": "rahul@acme.com"}}
    prof = sf.build_lead_profile({}, cap, {"score": 70, "band": "WARM"})
    assert prof["name"] == "Rahul"
    assert prof["email"] == "rahul@acme.com"
    assert prof["band"] == "WARM"
    assert prof["score"] == 70


def test_profile_never_wipes_known_email():
    prev = {"email": "rahul@acme.com"}
    prof = sf.build_lead_profile(prev, {"sds": {"product": "X"}}, None)
    assert prof["email"] == "rahul@acme.com"


def test_profile_captures_from_form_prefill():
    cap = {"form": {"prefill": {"email": "buyer@corp.com", "name": "Sam"}}}
    prof = sf.build_lead_profile({}, cap, None)
    assert prof["email"] == "buyer@corp.com"
    assert prof["name"] == "Sam"
