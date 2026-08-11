# Agent Runtime Restructure - Behaviour Model + File Split

Date: 2026-08-11.
Branch: MainV2.
Status: Phases 1-5 DONE, Phase 6 not started.
Nothing committed yet; suite green at backend 2311 passed / 134 skipped, vitest 581, tsc clean, lint 0 errors.
Browser verification of the merged connect form is still owed.
Migration 0037 APPLIED DARK to the prod control DB `tticllabbbqwnhsmggfo` on 2026-08-11 (deploy gate cleared - see the Phase 5 entry).

## Implementation log

**Phase 1 - DONE.** `services/agent_runtime/{__init__,states,turn}.py`, `tests/test_agent_runtime_states.py` (36 tests).
`TurnState` (6 outcomes), `RefusalCause`, `is_legal_transition` / `next_legal_states` implementing rule 8 as a table, `TurnResult` / `ToolCall` / `TurnEvent`.
Invariants enforced in `__post_init__`: ANSWERED requires a source, NO_DATA/SYSTEM_ERROR require a cause.
`TurnResult.sources` is a `list[dict]` deliberately - the same shape `chat_logs.sources` already persists, so nothing has to be re-modelled at the storage boundary.

**Phase 2 - DONE.** `registry.py` + `tools/{get_sds,get_product_spec,request_quote,request_sample,get_coa}.py` + `contact.py`, `tests/test_agent_runtime_registry.py` (24 tests).
The runtime object is `RuntimeTool`, **not** `ToolSpec` - that name was already taken by the pack-side declaration in `packs/schema.py`, and the two are different halves of the same tool.
`assert_registry_covers_packs()` wired into `startup_event`; B10 fixed via `RuntimeTool.available` filtering `build_schemas`.
Capture keys are declared per tool and enforced (`_apply_capture` raises on an undeclared key), which is what stops one tool quietly driving another's card.
`_`-prefixed observation keys are stripped before the model sees them - that is how COA's raw rows reach the capture without reaching the prompt.
Fully replaced the old dispatch rather than running alongside it: `execute_tool` and `build_tool_schemas` are deleted from `services/agent.py`, `_tool_executor` and `_get_coa_observation` deleted from `main.py`, and `_valid_reply_to`/`_captured_contact_echo` moved to `contact.py` (re-imported into `main.py` under the same private names, so `test_handoff_email.py` is untouched).
`main.py` injects `runners={"get_coa": _run_get_coa}` - the COA throttle wiring stays in `main.py` and the runtime never imports it.

**Phase 3 - DONE.** `loop.py`, `tests/test_agent_runtime_loop.py` (17 tests) + updated exhaustion tests in `test_agent.py`.
B1: every advertised tool call now gets a `ToolMessage`; the ones past `max_calls_per_round` get an explicit `not_run` observation instead of silence.
B2: exhaustion spends one tool-free compose round over the observations already gathered before falling back; `main.py` passes the unbound `chat_model` as `compose_model` so that round is genuinely tool-free.
No compose round is spent when no tool ever ran - there is nothing to compose over.
`services/agent.py` re-exports the loop for existing importers until Phase 6.

**Trap found in Phase 3:** `agent_runtime.loop` -> `registry` -> `tools/*` -> `services.agent` -> `agent_runtime.loop` is a real import cycle, because the tool bodies still live in `services/agent.py`.
Both `loop._status_phrase` and `agent._tool_status_phrase` therefore import the registry *inside the function*.
Phase 6 dissolves this by moving the tool bodies into `tools/`; do not "tidy" those lazy imports up to module level before then.

**Phase 4 - HALF DONE.** `memory.py` + `escalation.py` + `tests/test_agent_runtime_memory.py` (35 tests) are built and green.
`memory.py`: closed `SLOTS` set, `remember` (empty never erases known), `harvest_tool_args` / `harvest_capture`, and `backfill` - which is where rule 6 actually bites, since the real-world failure is the model dropping a slot from the next tool call, the tool answering `needs_grade`, and the visitor being re-asked something they answered two turns ago.
`escalation.py`: the four §1.5 triggers in priority order (person request > promise request > repeat refusal > dead end after clarify), `apply()` attaching one idempotent `escalate` event, and `handoff_payload()` carrying identity + conversation context.
The person/promise matchers are deterministic and server-side - they are the replacement for the widget's `userHumanIntent` / `userBuyingIntent` lists.

**Phase 4 §1.6 wiring - DONE.** `tests/test_agent_runtime_capture_connect.py` (16), plus `TestBuyingIntent`/`TestDestination` in `test_agent_runtime_memory.py`, `TestToolTrace` in `test_agent_runtime_loop.py`, and rewritten `src/__tests__/chatwidget_handoff.test.ts` + an `escalate` block in `chatwidget_streaming.test.ts`.

Four owner decisions taken before writing any of it (2026-08-11):

1. **Entitlement routes the form, the trigger does not.** `/api/handoff` 402s without the `human_handoff` entitlement, and a lead-capture tier has `/api/leads/capture` instead - so `escalation.destination()` returns `"handoff"` / `"lead_capture"` / `None`, and the event carries it. A bot entitled to neither emits no event at all rather than showing a form whose POST would fail. This also fixed a live bug: the ⋮ "Talk to a human" button was gated on `lead_capture_enabled` while its POST needed `human_handoff_enabled`, so a lead-capture-only plan offered a button that 402'd.
2. **Buying intent kept as a fifth trigger** (`EscalationCause.BUYING_INTENT`). The four §1.5 triggers don't cover it, but `userBuyingIntent` is what actually fired the old form; retiring it with no replacement would have quietly stopped most generic bots capturing anyone. Lowest priority of the five, and suppressed on a turn a tool already answered (`include_buying_intent=False`) - a form bolted under a priced quote card is the nagging the client-side list was guilty of.
3. **Declining still redirects.** `onDismiss` opens the configured link, so the visitor never loses the instant hop; the owner only gets an unidentified handoff when the visitor actively refuses to be identified.
4. **Refusal state is a proxy until Phase 5.** `TurnResult.state` doesn't reach `main.py` yet, so `_turn_reads_as_refusal` derives it. It is deliberately NOT the same as the `is_un_final` analytics flag beside it: that one counts "zero documents retrieved" as unanswered, which is wrong for a tool-answered vertical turn (audit D3) and would have escalated on every successful one. A tool result vetoes the proxy. Both collapse into `TurnResult.state` in Phase 5 - delete `_turn_reads_as_refusal`, `_reply_reads_as_refusal` and `_prior_turn_refused` then.

Implementation notes:
- `loop.py` gained `trace_out`, an out-param on the `usage_out` precedent, so escalation reads a real `not_found` instead of inferring one from the reply's wording. Over-budget calls trace as `not_run`, a raising tool as `error`.
- "Second refusal on the **same topic**" has no topic model yet, so `_prior_turn_refused` uses adjacency: two refusals back to back are overwhelmingly the visitor rephrasing. It reads whichever transcript the caller has - `_prior_session_messages` (role `assistant`) for vertical bots, `chat_req.history` (role `bot`) for generic ones - so no new storage was involved.
- `disambiguated` comes from `_prior_state["missing"]`: `sales_funnel.derive_state` already records that last turn asked for a grade or pack size.
- Once-per-conversation dedupe stayed client-side (`leadFormShownRef` / `leadCapturedRef`), where it already lived; the server emits freely.
- `HandoffRequest.cause` is new and optional, and the owner email now says *why* the visitor is being handed over instead of always "requested to speak with a human".
- `submitLeadCapture` also sets `handoffSent`, so the ⋮ menu can't put a second form under a visitor who just filled one in.

**Trap:** the generic branch computes its escalation just before its own `[DONE]`, not in the shared `finally` - `full_reply` is only complete once the token loop ends, and the `finally` runs after the stream has closed, too late to emit a frame.

**Phase 5 - DONE.** `gate.py` + `refusal.py` + `compose.py`, `tests/test_agent_runtime_compose.py` (44), migration `0037_chat_logs_turn_state.py`, rewritten guards in `test_prompt_injection.py`, an `error`-frame block in `chatwidget_streaming.test.ts`.

Three owner decisions taken first (2026-08-11):

1. **Full prompt surgery.** RULE 5's keyword allowlist is deleted rather than tuned again - the model is now forbidden from appending any escalation line, because escalation is a server decision with a real form (Phase 4). The false positive it kept producing (an informational question firing the support line) is structurally impossible instead of one more DO-NOT bullet. RULE 6 no longer dictates a canned paragraph: it asks for one sentence, `refusal.NOTHING_ON_FILE`, read from the runtime constant so the instruction and the detector cannot drift. RULE 2's two anti-denial clauses and RULE 4's handoff offer went with them - both existed only to patch RULE 6's bleed.
2. **The server writes the refusal only where it can.** Tool-gated NO_DATA and canned replies get `refusal.build`; ordinary prose answers pass through untouched (plan §5). The streaming generic path can never be rewritten at all - the tokens are already on screen - so it passes `allow_rewrite=False` and gets its next step appended as one extra token frame instead.
3. **`chat_logs.turn_state`, migration 0037.** `is_unanswered` and `confidence` are now derived from the settled outcome instead of retrieval counts and substring matching, and the outcome itself is stored so the dashboards have a versioned signal to migrate onto (the audit's own instruction under Slice K).

What the three modules do:
- `gate.py` - tool statuses -> outcome, by what the visitor needs to hear rather than call order: any `found` answers the turn (PARTIAL if another lookup in the same turn came back empty), then `needs_input`, then `ambiguous`, then `not_found`, then `system`. An **unrecognised status returns "unknown", never "found"** - a new tool status must not silently log as a success. `locked_out` / `not_configured` are policy refusals: the tool ran correctly and its own message is the answer, so the gate stays silent. `gate_prose` is deliberately just "zero documents or not" - a guessed threshold there would be a worse lie than the honest unknown, and calibration is Slice A.
- `refusal.py` - one builder, three parts, variant rotated by `attempt` so a rephrased question never gets a byte-identical reply. A system failure never says "I don't have" (outcome 6 is not outcome 4), and an ambiguous match becomes one question listing the choices rather than a refusal at all.
- `compose.py` - `settle()`, the single place a turn's outcome is decided, plus the B2 tool-free call moved out of `loop.py` so both paths compose through one function.

Traps found while wiring it:
- **The tool gate must outrank the prose gate**, never `worst()` of the two. A tool-answered turn routinely retrieves zero documents; combining them reproduces audit D3 exactly, which is the bug the phase exists to fix. `gate.worst`'s docstring says so.
- **A greeting retrieves nothing too.** `small_talk` (message under 4 chars, inheriting today's carve-out) suppresses the prose gate, and the turn gets a `{"kind": "conversation"}` source so rule 3 still holds literally - `TurnResult` raises on ANSWERED with no source, and a live turn must degrade to something sayable rather than 500 on the visitor.
- **Rule 3 degrades, it does not raise.** ANSWERED with no nameable source becomes PARTIAL/`NO_SOURCE` inside `settle`, before `TurnResult.__post_init__` can reject it.
- The `finally` also runs on client disconnect, so a turn that never settled is recorded SYSTEM_ERROR rather than a silently "answered" half-sentence - and `_cacheable` therefore rejects it (D2).

Also fixed in passing, as the phase promised: cache writes gated on `_cacheable(state, reply)` (D1/D2) plus a 30-day TTL on the read, since invalidation otherwise only happens when the owner retrains; `is_unanswered` / `confidence` derived from the outcome (D3/D4); and the error path now emits `[DONE]` after its error frame, with the widget rendering that frame, so a server error can no longer leave the bubble typing forever (F2).

**Migration 0037 applied dark, 2026-08-11.** `ALTER TABLE chat_logs ADD COLUMN IF NOT EXISTS turn_state TEXT` on the prod control DB `tticllabbbqwnhsmggfo` via Supabase MCP; column verified present, nullable, 0 rows populated (correct - nothing has been deployed to write it yet). This had to happen before deploy, not after: `log_chat_to_db` now names `turn_state` in its INSERT, and against the old schema every insert would raise into the existing try/except, leaving chat working while all analytics silently stopped.

**`alembic_version` is deliberately left at 0036.** The dark DDL does NOT stamp - same as the 0030 precedent. Stamping ahead of the file would break any `alembic upgrade head` or `alembic current` run from a checkout that doesn't have `0037_chat_logs_turn_state.py` yet, which is every checkout of MainV2 until this branch merges. When Alembic does run 0037, `ADD COLUMN IF NOT EXISTS` is a no-op and it stamps itself. (This was applied and then reverted during the session after the 0030 precedent was checked - do not "fix" the version number by hand.)

## 0. Intent - how this differs from the behaviour audit

`docs/audit-agent-behaviour.md` is a diagnosis: 38 findings, ranked by wrong-answer risk, against the stated goal of a precision RAG platform.
This plan is the opposite direction: a specification for how the bot should behave turn by turn, and the file structure that lets that behaviour be built, tested, and changed without several files needing to move in lockstep.

Do not update the audit doc or its memory from this plan.
This plan **consumes** parts of the audit's Track 2 (Slices G, H, and pieces of B/C/D) but is scoped narrower and organised differently - by conversational outcome, not by finding ID.

**Explicitly out of scope for this plan** (stays in the audit's backlog, to be executed later against the scaffold this plan builds):
- Grounding gate threshold calibration for the prose retrieval path (audit Slice A) - needs shadow-mode score data first.
- Entity-safe chunking / ingestion rework (audit Slice C).
- Structured contacts/FAQ/locations/policies tables and tools (audit Slice E).
- Identifier retrieval path - trigram index, stop stemming CAS numbers (audit Slice D).
- The three one-line prompt fixes (RULE 7 fabrication clause, temperature 0.7 to 0.1, phantom `search_catalog`) - ship separately, unrelated to file structure.

What **is** in scope: every outcome and rule below is pure control flow over data the system already has today (existing tools, existing session store, existing retrieval). None of it requires new data, new tables, or calibration.

## 1. Behaviour model (the spec every module below must satisfy)

### 1.1 Framing

The bot is the front desk of the business it is embedded on.
Every design decision below follows from that: look things up, say "let me check," say "I don't have that, let me get you someone who does" without embarrassment, never invent, remember what was just said, don't recite the manual, know when to stop and hand off.

### 1.2 The six turn outcomes

Every reply is exactly one of:

1. **ANSWERED** - found it, grounded, source known.
2. **PARTIAL** - some of it found; states plainly what's missing.
3. **NEED_ONE_THING** - ambiguous match; ask exactly one clarifying question, offer choices.
4. **NO_DATA** - genuinely not on file; refuse, offer a real next step.
5. **OUT_OF_SCOPE** - not about this business; decline warmly, steer back, never actually answer it.
6. **SYSTEM_ERROR** - the system's own failure; never presented as NO_DATA.

Legal transitions across a conversation move in one direction only: ANSWERED/PARTIAL can always happen; once a topic has produced a NO_DATA or SYSTEM_ERROR, the next turn on that topic may not repeat the same outcome with the same wording - it must escalate, ask a new question, or hand off.
This is rule 8 made literal: a state machine, not a prompt instruction.

### 1.3 The eleven behaviour rules, grouped

**Facts**
1. Look it up, don't recall - any class with a tool or table must go through it, never the model's own knowledge.
2. Never assemble a fact from two places - a fact is only usable if it arrived as one record from one source.
3. If the system can't name the source, it can't say the fact.
4. Hazard/legal/money content is verbatim from the document, never paraphrased.

**Conversation**
5. Ask one question at a time.
6. Never ask for something already given in this conversation.
7. Match reply length to question size.
8. Degrade in one direction only: ANSWERED -> PARTIAL -> NEED_ONE_THING -> NO_DATA -> escalate. Never back up to a weaker state after a stronger one.
9. Volunteer the natural next step, whether the turn succeeded or not.

**Boundaries**
10. Never make a promise the business hasn't authorised (discount, ship date, customisation) - escalate instead.
11. Capture volunteered contact info naturally; never gate an answer behind a form unless real value is being exchanged (quote, sample).

### 1.4 Refusal shape (NO_DATA and SYSTEM_ERROR both use this, different cause)

One builder, one voice, three parts: what's specifically missing, then a real next step, then the conversation's context carried into that next step.
Never the same sentence twice per topic per conversation.

### 1.5 Escalation triggers (existing signals only, no new data required)

- Second refusal on the same topic within one conversation.
- Visitor requests an unpublished price or a promise (rule 10).
- Visitor explicitly asks for a person.
- A tool returns `not_found` after the visitor has already disambiguated once.

### 1.6 Unified capture-then-connect (owner decision, 2026-08-11)

Three overlapping mechanisms exist today and none of them is driven by the escalation triggers above:

- `lead_capture` - client-side keyword sniffing (`userBuyingIntent` / `userHumanIntent` / `fallbackPhrases`, `ChatWidget.tsx:2707-2724`) auto-shows a name/email form. Generic bots only - explicitly excluded for vertical bots (`!isVerticalBotRef.current`).
- `human_handoff` - manual only, reachable via the `⋮` menu or the COA dead-end button (`ChatWidget.tsx:2815`). If `handoff_redirect_url` is configured (e.g. a `wa.me` link), it redirects immediately with **no form, no backend call, no transcript, no name, no email** - the owner gets a message from an unidentified visitor.
- Passive server-side `extract_contact` sniffing (Slice A) - vertical bots only, never shows UI, only logs.

**Decision:** collapse these into one flow, owned by `escalation.py`, for every bot:

1. Any of the section 1.5 triggers fires (including "visitor explicitly asks for a person," which becomes a deterministic server-side signal, not a client keyword match) → `escalation.py` emits an `escalate` event on `TurnResult.events[]`, cause-tagged.
2. The widget renders one form on that event: name (optional) + email, one "Connect me" button. Same component for every bot, generic or vertical.
3. On submit - **capture always happens before connect, even on the redirect path.** `/api/handoff` is called with the captured identity + transcript regardless of whether `handoff_redirect_url` is configured; the redirect (if configured) still opens immediately after, so the visitor experience stays instant, but the owner now always receives an identified handoff.
4. Retire on the client: `userBuyingIntent`, `userHumanIntent`, `fallbackPhrases`, and the `!isVerticalBotRef.current` exclusion. Retire on the server: the silent, form-less branch of `human_handoff` that skips `/api/handoff` entirely.

This lands in **Phase 4** below (`escalation.py`), touches `main.py`'s `/api/handoff` endpoint (accept-and-forward on the redirect path, not skip), and merges `ChatWidget.tsx`'s `lead_capture` and `handoff_form` message roles into one component. It is a small, additive change in scope - no new data source, matches this plan's "existing signals only" scope from section 1.5.

## 2. Target file structure

```
sapybase_ai_engine/services/agent_runtime/
  __init__.py
  turn.py          TurnResult: state, cause, text, sources, tool_trace, events[]
  states.py         the 6 outcomes + refusal-cause enum + the legal-transition table (rule 8)
  pipeline.py       orchestrator - routes into the modules below, no business logic itself
  memory.py          slot-fill tracking: "what has this visitor already told us" (rule 6)
  gate.py             found/ambiguous/not_found for TOOL-based lookups (real, now)
                      pass-through stub for prose-path threshold (deferred to audit Slice A)
  compose.py           tool-free final call; enforces one-record-in-one-answer-out for
                       tool-answered turns (rule 2); best-effort unchanged for prose turns
  refusal.py            the one refusal builder (see 1.4), cause-tagged
  escalation.py          trigger checks (see 1.5) + handoff packaging with carried context
  loop.py                 the ReAct loop itself, extracted from today's services/agent.py,
                          pure function over (registry, conversation) - no capture, no SSE
  registry.py               ToolSpec per tool: schema + executor + capture-shape + funnel
                            contribution + availability predicate; startup assertion that
                            every pack-declared tool has a matching ToolSpec
  tools/
    get_sds.py  get_product_spec.py  request_quote.py  get_coa.py  get_spec.py
```

`main.py`'s `stream_generator` shrinks to: auth/billing/quota gates, `load_pack`, one call into `pipeline.run_turn(...)`, and SSE framing of the returned `TurnResult`.
Today's `services/agent.py` (1,529 lines) is retired once `loop.py` + `registry.py` fully replace it.

## 3. Why this kills the "cross-connect" problem specifically

Today, adding or changing a tool means editing `packs/chemical.py` (schema), `agent.py:1110-1166` (dispatch), the `_tool_executor` closure in `main.py:3813-3939` (capture), and separately `ChatWidget.tsx`, `sales_funnel._candidate_stage`, and `_build_tool_sources` - six places, nothing enforcing agreement.
`get_coa` already drifted (advertised to bots with no Drive folder configured, because availability lives in a seventh place, `main.py:9995`, that the schema builder doesn't check).

`registry.py` collapses schema + dispatch + capture + funnel + availability into one `ToolSpec` object per tool.
The pack still declares *which* tools a vertical gets (unchanged - `load_pack` stays the source of truth per `CLAUDE.md`'s no-hardcoded-vertical rule); the registry supplies *how* each one behaves, in one file, and a startup assertion fails loudly if a pack declares a tool with no matching `ToolSpec` or vice versa.
That assertion is the actual fix for "sync between functions" - it turns a silent drift into a boot-time error.

## 4. Phases

Each phase is behaviour-preserving unless stated, suite green before moving to the next, own commit per phase.

**Phase 1 - Contracts.**
`turn.py`, `states.py`. No wiring yet.
Tests: every legal/illegal transition in the state table (rule 8); `TurnResult` requires `sources` whenever `state == ANSWERED`.

**Phase 2 - Tool registry.**
`registry.py` + `tools/*.py`, migrating the 5 existing chemical tools out of the scattered dispatch.
Startup assertion wired.
Tests: pack/registry agreement; `get_coa` availability now correctly gated at the schema layer (fixes B10).

**Phase 3 - Loop extraction.**
`loop.py`, pulling `services/agent.py:1399-1502` out pure, over the new registry.
Fixed in passing: execute all tool calls in a round instead of silently dropping past 4 (B1); forced tool-free compose round before falling back (B2).
Tests: round-exhaustion and >4-calls boundary cases - currently untested, which is why B1/B2 survived.

**Phase 4 - Memory + escalation.**
`memory.py` formalising slot-fill over the existing session store (rule 6 becomes enforceable); `escalation.py` with the section 1.5 triggers, plus the section 1.6 unified capture-then-connect flow (merges `lead_capture` + `human_handoff` into one server-driven event, capture always precedes redirect, extends to vertical bots, retires the 3 client-side phrase lists).
Touches `main.py`'s `/api/handoff` (must fire on the redirect path too, not skip it) and `ChatWidget.tsx` (`lead_capture` + `handoff_form` merge into one component).
Tests: a fixture conversation that repeats info never gets re-asked; second same-topic refusal escalates; capture-then-connect fires identically for a generic and a vertical bot; the redirect path still calls `/api/handoff` with the captured identity.

**Phase 5 - Compose + refusal.**
`compose.py`, `refusal.py`, replacing the 3-rule prompt fight (RULE 6/2/5) and the `FALLBACK_PHRASES` substring hack with one structured builder.
Fixed in passing: cache gate ties to `state == ANSWERED` (D1/D2); `is_unanswered`/`confidence` replaced by `TurnResult.state` as the source of truth (D3/D4); SYSTEM_ERROR always sends a terminal SSE frame (F2).

**Phase 6 - Pipeline + main.py cutover.**
`pipeline.py` wires phases 1-5 together; `main.py`'s `stream_generator` replaced with the single call; `services/agent.py` deleted.
Client side: `ChatWidget.tsx`'s single-slot pending state and duplicate failure-detection list unified against `TurnResult.state` (F3/F4).

## 5. Explicit non-goals (stated twice so it doesn't get relitigated)

- Not improving prose-path answer *accuracy*. Structural fixes here (states, memory, escalation, refusal, tool sync) do not touch chunking or retrieval quality. The audit's Slice A/C/E remain the actual cure for fabricated prose answers.
- Not a rewrite. `packs/`, `session_store.py`, `catalog_import.py`, and the deterministic tools' internal logic are untouched - only their wiring moves.
- Not touching the three prompt one-liners - kept separate per the owner's decision (2026-08-11).
- Not streaming, voice, or personality work - already demoted in the audit and not reopened here.

## 6. Risks

- A six-way coordinated file move is exactly the kind of change that's easy to half-finish. Phase boundaries above exist to prevent a half-migrated state where some tools go through `registry.py` and others still go through the old closure - Phase 2 must fully replace the old dispatch, not run alongside it.
- `_captured`'s single-slot-per-action-type behaviour (B4) - two quotes in one turn rendering one card - should be fixed as part of Phase 6's `TurnResult` cutover (`events[]` is a list; multiple quote events are just multiple list entries), but verify `ChatWidget.tsx` can actually render multiple cards before assuming this is free.

## 7. Relates to

- `docs/audit-agent-behaviour.md` - source of the findings this plan's phases fix in passing (B1, B2, B4, B10, D1-D4, F2-F4); source of the Slices (A, C, D, E) this plan deliberately defers.
- `docs/codebase-consolidation-plan.md` - same `api/routers/` extraction precedent applies to this restructure.
- `docs/agent-conversation-gaps-plan.md` - the contact-fabrication incident this scaffold is meant to make structurally harder to repeat.
