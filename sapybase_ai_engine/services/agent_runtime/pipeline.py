"""One vertical turn, end to end - the orchestrator Phases 1-5 were built for.

docs/agent-runtime-restructure-plan.md §2, Phase 6. This used to be a ~350-line
closure inside a 4,000-line request handler, which is why the loop's own boundary
bugs (B1, B2) survived unnoticed: there was no seam to test the turn at. The
handler now supplies the model, the prompt and the tool executor, and frames what
comes back; everything between the first tool round and the settled outcome lives
here.

The generator yields, in order: any number of ``ping`` and ``status`` events while
the loop runs, then exactly one ``result`` event carrying the ``TurnResult``. Pings
are yielded rather than written directly because the caller owns the wire format -
the pipeline knows a heartbeat is due, not what a heartbeat looks like.

No business logic of its own: it routes into loop/compose/escalation/memory and
persists what they decided.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Callable, Dict, List, Optional

from services import qualification, sales_funnel, session_store
from services.lead_scoring import _score_lead

from . import compose as compose_mod
from . import escalation as escalation_mod
from . import sources as sources_mod
from .loop import AGENT_FALLBACK_TEXT, stream_agent_loop
from .tools.records import insert_agent_request, session_has_capture
from .turn import TurnEvent, TurnResult

logger = logging.getLogger(__name__)

#: How long the caller may sit without hearing anything before we emit a heartbeat.
HEARTBEAT_SECONDS = 15

#: Capture keys that are client-renderable cards; ``handoff`` is deliberately absent
#: - it is the owner's alert, never a frame the visitor sees.
CARD_KEYS = ("sds", "quote", "form", "grade_selector", "pack_selector", "coa")

#: What gets replayed to the model as this turn's actions on the next turn.
_ACTION_KEYS = CARD_KEYS + ("handoff",)


@dataclass
class TurnInputs:
    """Everything about this turn the handler already resolved.

    Deliberately plain data: the pipeline never reaches back into the request, the
    company row or the DB pool for anything that isn't here.
    """

    company: Dict[str, Any]
    message: str
    pack: Any = None
    session_id: Optional[str] = None
    visitor_id: Optional[str] = None
    session_active: bool = False
    session_summary: Optional[str] = None
    prior_messages: List[Any] = field(default_factory=list)
    prior_state: Dict[str, Any] = field(default_factory=dict)
    prior_lead_profile: Dict[str, Any] = field(default_factory=dict)
    retrieved_doc_count: int = 0
    kb_sources: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def company_id(self) -> Any:
        return self.company.get("id")


async def run_agent_turn(
    inputs: TurnInputs,
    *,
    model,
    messages: List[Any],
    tool_executor: Callable,
    captured: Dict[str, Any],
    cursor,
    commit: Callable[[], None],
    rollback: Callable[[], None],
    deadline_s: float,
    compose_model=None,
    usage_out: Optional[Dict[str, Any]] = None,
    sanitize: Callable[[str], str] = lambda t: t,
    on_summary_needed: Optional[Callable[[], None]] = None,
    heartbeat_s: float = HEARTBEAT_SECONDS,
) -> AsyncIterator[Dict[str, Any]]:
    """Drive one vertical-agent turn and settle it.

    ``captured`` is the dict the caller's tool executor writes into; it is read
    back here for the cards, the sources and the funnel, and left for the caller to
    read for the owner alert.
    """
    tool_trace: List[Any] = []
    text = AGENT_FALLBACK_TEXT
    timed_out = False

    async for event in _drive_loop(
        model=model, messages=messages, tool_executor=tool_executor,
        compose_model=compose_model, usage_out=usage_out if usage_out is not None else {},
        tool_trace=tool_trace, deadline_s=deadline_s, heartbeat_s=heartbeat_s,
    ):
        if event["type"] == "final":
            text = event["text"]
        elif event["type"] == "timeout":
            timed_out = True
        else:
            yield event

    text = sanitize(text)

    # Slice A (agent-conversation-gaps plan §3): a visitor who types a phone/email
    # mid-chat reaches nobody unless a tool already fired a handoff this turn.
    _capture_volunteered_contact(inputs, captured, cursor)

    turn_sources = list(inputs.kb_sources) + sources_mod.tool_sources(captured)

    # ── SETTLE (Phase 5) ──────────────────────────────────────────────────────
    # One place decides what this turn was, and the server writes the refusal when
    # there is nothing underneath the model's wording. The SSE text, the session
    # store, escalation, the cache gate and the analytics columns all read this
    # instead of re-deriving it three different ways.
    turn = compose_mod.settle(
        text=text,
        tool_trace=tool_trace,
        retrieved_doc_count=inputs.retrieved_doc_count,
        sources=turn_sources,
        context={"product_name": _subject_product(captured)},
        attempt=1 if escalation_mod.prior_turn_refused(inputs.prior_messages) else 0,
        # The loop's own give-up text is a system failure, not a data gap - outcome
        # 6 is never presented as outcome 4.
        system_error=timed_out or text == AGENT_FALLBACK_TEXT,
        small_talk=len(inputs.message.strip()) < 4,
    )

    for key in CARD_KEYS:
        payload = captured.get(key)
        if payload:
            # Built directly rather than through ``add_event(**payload)``: a card
            # payload is tool-shaped data, and a key named ``type`` in it would
            # collide with the event's own field.
            turn.events.append(TurnEvent(type=key, payload=dict(payload)))

    # Capture-then-connect (plan §1.6): one server-owned decision, vertical bots
    # included - they used to be excluded outright.
    frame = escalation_mod.frame(
        message=inputs.message,
        state=turn.state,
        prior_messages=inputs.prior_messages,
        human_handoff_enabled=bool(inputs.company.get("human_handoff_enabled")),
        lead_capture_enabled=bool(inputs.company.get("lead_capture_enabled")),
        tool_answered=bool(captured),
        tool_trace=tuple(tool_trace),
        # A grade/pack selector last turn means the visitor has already answered a
        # clarifying question; a dead end after that is one.
        disambiguated=bool((inputs.prior_state or {}).get("missing")),
    )
    if frame:
        turn.add_event("escalate", **frame["escalate"])

    # Ordering matters: the caller frames the answer on this event, and only when
    # it comes back for the next one does the session write run - so the visitor
    # reads the reply before the commit, exactly as the handler used to do it.
    # A caller that breaks out of the loop here skips the write on purpose.
    yield {"type": "result", "turn": turn}

    _persist_session(inputs, turn, captured, cursor, commit, rollback, on_summary_needed)


async def _drive_loop(
    *, model, messages, tool_executor, compose_model, usage_out, tool_trace,
    deadline_s: float, heartbeat_s: float,
) -> AsyncIterator[Dict[str, Any]]:
    """The ReAct loop under a whole-turn deadline, with heartbeats.

    Each event is pulled as its own task so a heartbeat timeout does NOT cancel the
    in-flight round: on timeout we emit a ping and keep awaiting the SAME task. Only
    the total deadline cancels it. (``asyncio.wait_for`` would tear the generator
    down - this plain async generator, unlike LangChain's queued astream, cannot
    survive a mid-round cancellation.)
    """
    clock = asyncio.get_running_loop()
    deadline = clock.time() + deadline_s
    text = AGENT_FALLBACK_TEXT
    agent_iter = stream_agent_loop(
        model, messages, tool_executor, usage_out=usage_out,
        # Round exhaustion composes over the tool results already in hand rather
        # than discarding them; the unbound model makes that round genuinely
        # tool-free.
        compose_model=compose_model,
        trace_out=tool_trace,
    ).__aiter__()
    pending = None
    try:
        while True:
            remaining = deadline - clock.time()
            if remaining <= 0:
                logger.warning("agent stream exceeded %ss budget; using fallback", deadline_s)
                yield {"type": "timeout"}
                text = AGENT_FALLBACK_TEXT
                break
            if pending is None:
                pending = asyncio.ensure_future(agent_iter.__anext__())
            done, _ = await asyncio.wait({pending}, timeout=min(heartbeat_s, remaining))
            if not done:
                # Nothing yet this window: keep proxies alive, keep the same round
                # running.
                yield {"type": "ping"}
                continue
            try:
                event = pending.result()
            except StopAsyncIteration:
                pending = None
                break
            pending = None
            if event.get("type") == "status":
                yield {"type": "status", "label": event.get("label")}
            elif event.get("type") == "final":
                text = event.get("text") or AGENT_FALLBACK_TEXT
    except Exception:
        logger.exception("agent stream failed; using fallback")
        yield {"type": "timeout"}
        text = AGENT_FALLBACK_TEXT
    finally:
        # Deadline hit or error mid-round: cancel the in-flight task and drain it so
        # it never leaks or logs "Task was destroyed".
        if pending is not None and not pending.done():
            pending.cancel()
            try:
                await pending
            except BaseException:
                pass

    yield {"type": "final", "text": text}


def _subject_product(captured: Dict[str, Any]) -> Optional[str]:
    """Whichever product this turn was actually about, for the refusal's wording."""
    for key in ("quote", "spec", "sds"):
        product = (captured.get(key) or {}).get("product")
        if product:
            return product
    return None


def _capture_volunteered_contact(inputs: TurnInputs, captured: Dict[str, Any], cursor) -> None:
    """Record a phone/email the visitor typed in passing (Slice A, §3).

    Opportunistic and best-effort: it never blocks the reply, and it yields to a
    handoff a tool already captured this turn (e.g. a priced quote) rather than
    overwriting it. Writing ``captured["handoff"]`` is what makes the caller's
    real-time owner ping fire unchanged.
    """
    if not inputs.session_id or captured.get("handoff"):
        return
    try:
        contact = qualification.extract_contact(inputs.message)
    except Exception:
        contact = {}
    if not contact or session_has_capture(cursor, inputs.company_id, inputs.session_id):
        return
    product = _subject_product(captured) or (
        ((inputs.prior_state or {}).get("products") or [{}])[-1] or {}
    ).get("name")
    if insert_agent_request(
            cursor, inputs.company_id, kind="contact",
            product=product, cas=None, grade=None, pack_size=None, qty=None,
            note=inputs.message, name=None, email=contact.get("email"),
            phone=contact.get("phone"), session_id=inputs.session_id):
        captured["handoff"] = {
            "kind": "contact",
            "product": product,
            "contact_email": contact.get("email"),
            "contact_phone": contact.get("phone"),
            "note": inputs.message,
        }


def _persist_session(inputs: TurnInputs, turn: TurnResult, captured: Dict[str, Any],
                     cursor, commit, rollback, on_summary_needed) -> None:
    """Write the turn to the session store, then re-derive funnel state and lead
    profile from what the tools captured. Never raises into the visitor's turn."""
    if not (inputs.session_active and turn.text):
        return
    try:
        actions = {k: captured[k] for k in _ACTION_KEYS if k in captured} or None
        session_store.append_message(
            cursor, inputs.session_id, inputs.company_id, "user", inputs.message,
        )
        session_store.append_message(
            cursor, inputs.session_id, inputs.company_id, "assistant", turn.text,
            actions=actions,
        )
        title = session_store.derive_title(captured)
        if title:
            session_store.set_session_title(cursor, inputs.session_id, title)
        # Score the lead deterministically so the band drives next-turn
        # booking/handoff offers.
        context = " ".join(filter(None, [inputs.session_summary, inputs.message]))
        profile = sales_funnel.build_lead_profile(
            inputs.prior_lead_profile, captured,
            _score_lead(context,
                        (inputs.prior_lead_profile or {}).get("email"),
                        (inputs.prior_lead_profile or {}).get("name")),
        )
        if inputs.pack is not None and inputs.pack.qualification_slots:
            profile = qualification.merge_qualification(
                profile,
                qualification.extract_facts(
                    inputs.message, inputs.pack.qualification_slot_names()),
            )
        state = sales_funnel.derive_state(inputs.prior_state, captured, profile)
        session_store.update_session_state(
            cursor, inputs.session_id, inputs.company_id, state)
        session_store.update_lead_profile(
            cursor, inputs.session_id, inputs.company_id, profile)
        commit()
        count = session_store.count_messages(cursor, inputs.session_id, inputs.company_id)
        if count > session_store.SUMMARY_THRESHOLD and on_summary_needed is not None:
            on_summary_needed()
    except Exception:
        try:
            rollback()
        except Exception:
            pass
        logger.exception(
            "session_store: failed to persist turn session=%s", inputs.session_id)


def settle_prose_turn(
    *,
    text: str,
    message: str,
    retrieved_doc_count: int,
    sources: List[Dict[str, Any]],
    company: Dict[str, Any],
    prior_messages: List[Any],
) -> TurnResult:
    """The generic (no pack) bot's turn, settled after its tokens have shipped.

    ``allow_rewrite=False``: the visitor has already read this answer, so the turn
    can be classified, not replaced. The refusal's one voice reaches this path
    through RULE 6's wording instead, and rule 9's next step is appended by the
    caller as one more token.
    """
    turn = compose_mod.settle(
        text=text,
        retrieved_doc_count=retrieved_doc_count,
        sources=sources,
        small_talk=len(message.strip()) < 4,
        allow_rewrite=False,
    )
    frame = escalation_mod.frame(
        message=message,
        state=turn.state,
        prior_messages=prior_messages,
        human_handoff_enabled=bool(company.get("human_handoff_enabled")),
        lead_capture_enabled=bool(company.get("lead_capture_enabled")),
    )
    if frame:
        turn.add_event("escalate", **frame["escalate"])
    return turn


__all__ = [
    "CARD_KEYS",
    "HEARTBEAT_SECONDS",
    "TurnInputs",
    "run_agent_turn",
    "settle_prose_turn",
]
