"""Deterministic sales-funnel state machine (Phase 2).

Pure functions — no I/O, no LLM, no external state. Mirrors the discipline of
`lead_scoring.py` and `funnel.py`: the funnel STAGE is *derived* from what a turn
produced (the `_captured` dict main.py already builds), never classified by the
model. The model receives the current stage + a single "next best action"
directive and decides only how to phrase the push.

Stage is monotonic — a conversation only ever moves forward, never regresses, so
a late clarifying question can't drag a quoted lead back to "browsing".

Phase 2 reuses existing infrastructure rather than rebuilding it:
  * lead score/band → `lead_scoring._score_lead`
  * booking CTA gate → `booking.should_offer_booking`
  * owner notify     → `agent_handoff`
This module only owns the session-level stage + next-action derivation.
"""

from typing import Any, Dict, List, Optional

# ── Funnel stages, ordered (rank = list index) ───────────────────────────────
STAGES = [
    "browsing",      # 0 — visitor is exploring, nothing resolved yet
    "qualifying",    # 1 — narrowing grade/pack, product not finalised
    "recommended",   # 2 — a product/SDS surfaced; ready to quote
    "quoted",        # 3 — a price (or POR) was returned
    "captured",      # 4 — we hold the lead's contact (email/phone)
    "handed_off",    # 5 — explicit human handoff requested
]
_RANK = {s: i for i, s in enumerate(STAGES)}


def _rank(stage: Optional[str]) -> int:
    return _RANK.get(stage or "browsing", 0)


def _candidate_stage(captured: Dict[str, Any]) -> str:
    """Highest stage justified by THIS turn's captured actions (pre-monotonic)."""
    captured = captured or {}

    handoff = captured.get("handoff") or {}
    if handoff.get("kind") == "human":
        return "handed_off"

    quote = captured.get("quote")
    if quote:
        # A quote with contact details in hand means we captured the lead too.
        if handoff.get("contact_email") or handoff.get("contact_phone"):
            return "captured"
        return "quoted"

    if captured.get("sds") or captured.get("form") or captured.get("spec"):
        return "recommended"

    if captured.get("grade_selector") or captured.get("pack_selector"):
        return "qualifying"

    return "browsing"


def derive_stage(prev_stage: Optional[str], captured: Dict[str, Any]) -> str:
    """Advance the funnel stage. Monotonic — returns max(prev, candidate)."""
    cand = _candidate_stage(captured)
    return STAGES[max(_rank(prev_stage), _rank(cand))]


# ── Next best action ─────────────────────────────────────────────────────────
# One directive per stage. `offer_booking` is conditional on lead quality (the
# same gate `booking.should_offer_booking` uses), so we only emit it when the
# band qualifies; otherwise we fall back to a human handoff offer.

def next_best_action(stage: Optional[str], lead_profile: Optional[Dict[str, Any]]) -> str:
    profile = lead_profile or {}
    has_email = bool((profile.get("email") or "").strip())
    band = str(profile.get("band") or "").strip().upper()

    s = stage or "browsing"
    if s == "browsing":
        return "recommend_product"
    if s == "qualifying":
        return "recommend_product"
    if s == "recommended":
        return "offer_quote"
    if s == "quoted":
        return "ask_for_email" if not has_email else "offer_handoff"
    if s == "captured":
        return "offer_booking" if band in ("HOT", "WARM") else "offer_handoff"
    if s == "handed_off":
        return "await_owner"
    return "recommend_product"


# Human-readable directive injected into the agent's system context.
_ACTION_DIRECTIVE = {
    "recommend_product": (
        "Help the visitor pinpoint the right product and grade, then move them "
        "toward a quote. Do not wait to be asked — proactively suggest the next step."
    ),
    "offer_quote": (
        "The product is identified. Proactively offer to prepare a price quote "
        "(use the quote tool); do not wait for the visitor to ask for pricing."
    ),
    "ask_for_email": (
        "A quote has been given. Ask for the visitor's work email so the owner can "
        "follow up with a formal quotation — frame it as a benefit to the buyer."
    ),
    "offer_booking": (
        "This is a qualified lead with contact details. Offer to book a call with "
        "the owner if a booking option is available."
    ),
    "offer_handoff": (
        "Offer to connect the visitor with a human from the team for next steps."
    ),
    "await_owner": (
        "A human handoff is already in progress. Reassure the visitor the team will "
        "be in touch and answer any remaining questions; do not re-offer a handoff."
    ),
}


def action_directive(action: str) -> str:
    """The system-prompt line for a next-best-action key."""
    return _ACTION_DIRECTIVE.get(action, _ACTION_DIRECTIVE["recommend_product"])


# ── State assembly ───────────────────────────────────────────────────────────

def _product_from_captured(captured: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """Extract a {name, grade, pack} product descriptor from a turn, if any."""
    quote = captured.get("quote")
    if quote and quote.get("product"):
        return {
            "name": quote.get("product"),
            "grade": quote.get("grade"),
            "pack": quote.get("pack_size"),
        }
    sds = captured.get("sds")
    if sds and sds.get("product"):
        return {"name": sds.get("product"), "grade": None, "pack": None}
    spec = captured.get("spec")
    if spec and spec.get("product"):
        return {"name": spec.get("product"), "grade": spec.get("grade"), "pack": None}
    form = captured.get("form")
    if form:
        prefill = form.get("prefill") or {}
        if prefill.get("product"):
            return {
                "name": prefill.get("product"),
                "grade": prefill.get("grade"),
                "pack": prefill.get("pack_size"),
            }
    for key in ("grade_selector", "pack_selector"):
        sel = captured.get(key)
        if sel and sel.get("product"):
            return {"name": sel.get("product"), "grade": sel.get("grade"), "pack": None}
    return None


def _dedupe_append(items: List[Dict], new: Dict, keys) -> List[Dict]:
    sig = tuple(new.get(k) for k in keys)
    for it in items:
        if tuple(it.get(k) for k in keys) == sig:
            return items
    return items + [new]


def derive_state(
    prev_state: Optional[Dict[str, Any]],
    captured: Dict[str, Any],
    lead_profile: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Return the updated `agent_sessions.state` JSON for this turn.

    Accumulates resolved products + quotes, advances the stage monotonically, and
    computes the next best action. Pure — callers persist the result.
    """
    prev_state = dict(prev_state or {})
    captured = captured or {}

    stage = derive_stage(prev_state.get("stage"), captured)

    products = list(prev_state.get("products") or [])
    prod = _product_from_captured(captured)
    if prod:
        products = _dedupe_append(products, prod, ("name", "grade", "pack"))

    quotes = list(prev_state.get("quotes") or [])
    quote = captured.get("quote")
    if quote:
        quotes = _dedupe_append(
            quotes,
            {
                "product": quote.get("product"),
                "grade": quote.get("grade"),
                "pack": quote.get("pack_size"),
                "amount": quote.get("subtotal"),
                "por": quote.get("status") == "price_on_request",
            },
            ("product", "grade", "pack"),
        )

    # What the next funnel step still needs (drives the text fallback / nudges).
    missing: List[str] = []
    if captured.get("grade_selector"):
        missing.append("grade")
    if captured.get("pack_selector"):
        missing.append("pack_size")

    return {
        "stage": stage,
        "products": products,
        "quotes": quotes,
        "missing": missing,
        "next_action": next_best_action(stage, lead_profile),
    }


# ── Lead profile assembly ────────────────────────────────────────────────────

def build_lead_profile(
    prev_profile: Optional[Dict[str, Any]],
    captured: Dict[str, Any],
    score_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Merge identity/intent/score into the rolling `lead_profile`.

    Never clears a previously-known field (a later turn without contact info must
    not wipe an email captured earlier). `score_result` is the dict returned by
    `lead_scoring._score_lead` (score/band/reasons) when available.
    """
    profile = dict(prev_profile or {})
    captured = captured or {}

    handoff = captured.get("handoff") or {}
    form_prefill = (captured.get("form") or {}).get("prefill") or {}

    def _set(field, *candidates):
        for c in candidates:
            if c and str(c).strip():
                profile[field] = str(c).strip()
                return

    _set("name", handoff.get("contact_name"), form_prefill.get("name"))
    _set("email", handoff.get("contact_email"), form_prefill.get("email"))
    _set("phone", handoff.get("contact_phone"), form_prefill.get("phone"))

    if score_result:
        if score_result.get("score") is not None:
            profile["score"] = score_result["score"]
        if score_result.get("band"):
            profile["band"] = score_result["band"]

    return profile
