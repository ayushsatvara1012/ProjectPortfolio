# Intelligent Sales Agent — Memory, Orchestration & BI Plan

> **Status: DESIGN / LIVING DOC.** Captures the north star, the current-state
> diagnosis, and a phased path. Nothing here is built yet — this is the plan we
> will iterate on and implement in slices. Update this doc as decisions lock.

## North star

A vertical AI agent that is not a stateless FAQ bot but an **intelligent
salesperson + business-intelligence layer** for the owner:

- **Works for the client** — remembers the whole conversation, never re-asks what
  it already knows, and pushes the buyer forward (qualify → recommend → quote →
  capture → handoff).
- **Automates the owner's work** — collects leads, prices, escalates POR, books
  samples, and routes to a human at the right moment, without the owner touching it.
- **Professional business intelligence** — every conversation becomes structured
  signal (demand, lost sales, drop-off, intent) the owner can act on.
- **Secure & private by construction** — strict tenant isolation, prompt-injection
  defenses, PII retention limits, and a real deletion path.

## Current-state diagnosis (why it feels un-intelligent today)

The agent is a **stateless RAG chatbot with a thin tool layer**. The memory was
never designed for reasoning — it was a cache key.

1. **4-message cache window, applied twice.** Client slices `.slice(-4)` and keeps
   only `m.content` text ([ChatWidget.tsx:1498](../src/components/chat/ChatWidget.tsx)); server
   re-caps `history[-4:]` ([main.py:3032](../sapybase_ai_engine/main.py)). The `history` field is
   documented as "Last N chat messages for **context-aware caching**"
   ([models.py:35](../sapybase_ai_engine/db/models.py)) — its original purpose, not agent memory.
2. **Tool results evaporate between turns.** The ReAct loop holds full tool
   context within a turn ([agent.py run_agent_loop](../sapybase_ai_engine/services/agent.py)), but only
   the final TEXT reply is persisted. Structured facts it discovered (resolved
   product/grade, quote, SDS) are discarded; next turn it re-derives from 4 lines.
3. **Structured actions stripped from history.** The widget keeps only `content`
   strings, so the SDS button / quote card / sample form it already produced are
   invisible to the model on the next turn — it can't see it already answered.
4. **A competing generic fallback fights the agent.** The vertical agent inherits
   the generic RULE 6 script ("That's a great question — I don't have specific
   information about that yet", [main.py:2962](../sapybase_ai_engine/main.py)); when mildly stuck it
   grabs that escape instead of pushing through tools or a handoff.

Already strong (the security foundation): every query is `company_id`-scoped
(tenant isolation), prompt-injection defenses (XML-delimited user input, untrusted
knowledge-base rules), the SDS safety guardrail, and BYOD (tenant-owned DB).

## Goals / non-goals

**Goals**: persistent structured memory; carry tool state across turns; funnel-aware
sales orchestration; owner-facing demand/lost-sale BI; PII retention + deletion.

**Non-goals (for now)**: multi-agent frameworks; fine-tuning; voice; cross-tenant
shared models. Keep the "config not fork" pack discipline — no `if vertical ==`.

## Phased plan

### Phase 0 — Foundations & cleanups (no backend schema change needed)

Four contained fixes that ship independently of the Phase 1 memory store.

#### 0a — Interactive grade/pack selector in the widget (ChatWidget.tsx only)

**Problem:** when `request_quote` returns `needs_grade` or `needs_pack`, the bot
writes a plain-text question. Visitors mistype grades, don't know the options, and
drop off.

**Fix:** the widget detects these payloads and renders interactive UI instead of
text — pill chips for grades (2–4 options, tap to select) and a dropdown for pack
sizes (ordered small → large). Tapping a chip auto-sends the clean choice. No
typing, no spelling errors, no drop-off from confusion.

```
needs_grade payload  →  pill chips  (Absolute · Denatured · Rectified)
needs_pack payload   →  dropdown    (500 ml / 2.5 Ltr / 5 Ltr / 35 Kg)
```

Touch target on both is large enough for mobile. A "Get quote" confirm button
submits the combined selection as a single clean message (e.g. "Absolute, 5 Ltr").

**Files changed:** `ChatWidget.tsx` message renderer only — add a new action
type case for `needs_grade` / `needs_pack` alongside the existing `quote_request`,
`sds_card`, and `sample_form` cases. Zero backend change.

#### 0b — RULE 6 generic fallback removed for pack bots

Suppress the generic "That's a great question — I don't have specific information
about that yet" ([main.py:2962](../sapybase_ai_engine/main.py)) for any bot running a vertical
pack. When unsure, the agent must re-tool or offer the human handoff — never this
escape. Same root cause as the SDS grade loop (`a7262269`).

#### 0c — Narrowing tools list options, not just ask

`request_quote`'s `needs_grade` / `needs_pack` messages ([agent.py:~427](../sapybase_ai_engine/services/agent.py))
change from *"ask which grade"* to *"tell the visitor these grades, then ask
which one."* Makes the text fallback (for non-widget embeds) also proactively
informative, not a dead-end re-ask.

#### 0d — Widen history window + stop stripping structured context client-side

- [`ChatWidget.tsx:1498`](../src/components/chat/ChatWidget.tsx) — stop slicing to
  last 4 texts; send the full recent window.
- [`main.py:3032`](../sapybase_ai_engine/main.py) — widen server history from `[-4:]`
  to `[-8:]` as a bridge until the Phase 1 store is live.
- Append a compact "state note" to each history entry (resolved product/grade,
  quote given, action taken) so the next turn has structured context even before
  the full store exists.

**Outcome of Phase 0:** the Ethanol conversation goes from a dead-end re-ask loop
to "Ethanol comes in Absolute · Denatured · Rectified — tap to select, then
choose pack size" — answered from the catalog, in one turn, with no typing errors.

---

### Phase 1 — Persistent session memory + two-screen widget

#### 1a — Server-side session store

Persist the FULL structured transcript per `session_id` (already passed in the
widget today but unused). New Postgres tables (lives in the BYOD tenant DB so
the owner's data stays in their schema):

```sql
agent_sessions(
  session_id      text primary key,
  company_id      text not null,
  title           text,          -- auto-generated (see §1c)
  summary         text,          -- compressed context for resume (see §1b)
  lead_profile    jsonb,         -- visitor identity + intent
  state           jsonb,         -- products resolved, quotes given, what's missing
  created_at      timestamptz,
  last_active_at  timestamptz
)

agent_messages(
  id              bigserial primary key,
  session_id      text references agent_sessions,
  company_id      text not null,
  role            text,          -- user | assistant | tool
  content         text,
  tool_calls      jsonb,
  observations    jsonb,
  actions         jsonb,
  ts              timestamptz
)
```

Feed back a **hybrid context** on every turn:
- Last ~8 turns verbatim (full structured transcript, not stripped text).
- For older turns: the rolling `summary` field — one compressed paragraph
  generated by a cheap Haiku call when the session goes idle. This is the
  **direct API cost saving**: a 20-turn conversation from last week costs the
  same input tokens as a 2-line context note, not the full 20-turn replay.

Tenant-walled: every query scoped to `company_id`; no cross-tenant reads.

#### 1b — Session summary + cost control

When a session goes idle (visitor closes the widget or starts a new conversation):
1. Run one `gemini-2.5-flash-lite` call (cheapest model in the stack, already
   used for background tasks in `main.py`): `"Summarise this chemical sales
   conversation in 3 sentences: what product was discussed, where the
   conversation got to, what the visitor still needs."` → store in
   `agent_sessions.summary`.
2. On next resume: send `summary` as the opening system context instead of
   replaying the full message log. Cost drops from O(turns) to O(1) per resume.
3. Raw `agent_messages` rows are kept for the ROI panel and compliance, but are
   not sent to the model after summarisation.

#### 1c — Auto-title generation

Session title is generated from the first `state` write:
`"{product_name} {action}"` — e.g. "Ethanol quote", "Toluene SDS", "IPA sample".
No user input needed, no LLM call — just reads the first resolved product from
the state object. Falls back to "New conversation" if nothing is resolved yet.

#### 1d — Two-screen widget (no sidebar)

The widget is a small embedded bubble, not a full-page app. A sidebar would
crush the message area. Instead, two screens:

**Screen 1 — history (default on open):**
- List of the visitor's past sessions for this company, newest first.
- Each row: auto-title + one-line preview (last bot message or outcome) + date.
- "New conversation" button pinned to the bottom.
- If the visitor has no past sessions (first visit), skip Screen 1 and go
  directly to Screen 2 with a fresh session.

**Screen 2 — chat:**
- Back arrow (←) top-left returns to Screen 1.
- Header shows the session title so visitor knows which conversation they're in.
- Grade/pack chips render here (Phase 0a) for new turns in this session.

**Visitor identity across visits:**
- `session_id` (current conversation) is stored in `localStorage` keyed by api_key.
- A separate stable `visitor_id` (also `localStorage`, keyed by api_key) survives
  "New conversation" and **scopes the history list** — `GET /api/sessions` filters
  `(company_id, visitor_id)`, so one buyer never sees another buyer's conversations.
  Missing `visitor_id` → empty list (never a company-wide leak). Stored on
  `agent_sessions.visitor_id` (migration `0027`), backfilled onto legacy NULL rows
  on the visitor's next message via `COALESCE`.
- Same device + same browser = sessions persist and resume correctly.
- Different device or cleared browser = treated as a new visitor (no cross-device
  link until email is captured during qualification; Phase 2 will link by email,
  reusing `visitor_id` as the join seam).

**New endpoints needed:**
```
GET  /api/sessions?company_id=…          # list sessions for history screen
POST /api/sessions                        # create new session
GET  /api/sessions/{session_id}/messages  # load messages for a resumed session
```

**Files changed:**
- `ChatWidget.tsx` — new `view` state (`'history' | 'chat'`), history screen
  component, session switcher, back navigation.
- `main.py` — three new endpoints above + summary generation on session idle.
- New Alembic migration for `agent_sessions` + `agent_messages`.

### Phase 2 — Sales orchestration (automating the owner)

> **Revised 2026-06-30 after Phase 1 shipped.** Phase 1 created
> `agent_sessions.state` and `agent_sessions.lead_profile` JSONB columns but
> **nothing writes to them yet** — they are empty. Phase 2's first job is to
> populate them. Phase 2 also must **connect to existing infrastructure, not
> rebuild it**: `lead_scoring.py` (deterministic HOT/WARM/COLD), `funnel.py`
> (conversations→leads→contacted→won BI), `booking.py` (qualified-band CTA), and
> `agent_handoff.py` / `agent_requests` (owner notify) already exist. Phase 2 is
> the **session-level state machine that feeds them**, not a parallel system.

**Guiding principle:** the funnel stage is *derived deterministically* from
session state (no extra LLM call per turn), mirroring the LLM-free
`lead_scoring.py` discipline. The LLM gets the *current stage + next best action*
injected into its prompt and decides how to phrase the push — it does not
classify the stage itself.

#### 2a — Session state machine (populate `state`)

Define an explicit, ordered funnel the agent advances through, stored in
`agent_sessions.state.stage`:

```
browsing → qualifying → recommended → quoted → captured → handed_off
```

After each turn, a pure function `derive_stage(state, captured)` advances the
stage from what the turn produced (product resolved → `recommended`, quote
returned → `quoted`, lead form submitted → `captured`, handoff fired →
`handed_off`). Monotonic — never regresses. This reuses the same `captured`
dict that Phase 1c's `derive_title` already reads, so no new capture plumbing.

`state` shape (locked):
```jsonc
{
  "stage": "quoted",
  "products": [{"name": "Ethanol", "grade": "Absolute", "pack": "5 Ltr"}],
  "quotes":   [{"product": "Ethanol", "amount": 1450, "por": false}],
  "missing":  ["pack_size"],          // what the next step still needs
  "objections": ["price too high"],   // surfaced from the turn (2c)
  "next_action": "ask_for_email"      // computed, see 2b
}
```

#### 2b — Next-best-action injected into the prompt

A pure `next_best_action(stage, lead_profile)` returns one directive
(`recommend_product`, `offer_quote`, `ask_for_email`, `offer_booking`,
`offer_handoff`). It is injected as a single system line each turn — *"The buyer
is at stage `quoted`; your next best action is `ask_for_email` so the owner can
follow up."* This replaces the old reactive behaviour where the agent waits to be
asked. `offer_booking` only fires when `lead_scoring` band ∈ {HOT, WARM} and a
valid booking URL exists (reuse `booking.should_offer_booking`) — Phase 2 does
not duplicate that gate.

#### 2c — Lead profile (populate `lead_profile`, cross-visit seam)

Persist identity + intent + objections to `agent_sessions.lead_profile`:
```jsonc
{
  "name": "Rahul", "email": "rahul@acme.com", "company": "Acme",
  "intent": "recurring supply", "score": 72, "band": "WARM",
  "objections": ["price", "lead time"]
}
```
- `score`/`band` come straight from `lead_scoring._score_lead` (already computed
  in the chat path — just persist it onto the session instead of discarding it).
- **Cross-visit linking is server-side only.** When an email is captured, write
  it to `lead_profile.email`. A `lead_profiles(company_id, email, …)` rollup (or a
  view over sessions) lets the owner-facing BI (Phase 3) see one buyer across
  sessions. **We do NOT auto-merge the visitor's *visible history list* across
  devices/emails** — a typo'd or shared email must never surface another person's
  conversations. The `visitor_id` seam (Phase 1d) stays the history-scoping key;
  email is a BI/CRM join only. *(This is a refinement of the original plan, which
  implied email would link the visible history — that's a privacy risk.)*

#### 2d — Proactive nudges (in-conversation only for Phase 2)

The agent follows the buyer forward *within the live conversation* using
`next_action` (e.g. after a quote with no email, it asks for one; after capture,
it offers booking/handoff). **Outbound buyer email nurture (re-engaging a buyer
who left) is explicitly deferred** — it adds deliverability, consent, and
unsubscribe obligations and belongs with the owner's Resend layer, not the
chat agent. Tracked as Phase 2-later / backlog.

**Files changed (anticipated):**
- New `services/sales_funnel.py` — pure `derive_stage`, `next_best_action`
  (LLM-free, unit-testable like `funnel.py` / `lead_scoring.py`).
- `session_store.py` — `update_session_state` / `update_lead_profile` writers.
- `main.py` chat path — call the writers + inject the next-action system line;
  persist the already-computed lead score onto the session.
- No new migration expected (columns exist from Phase 1; a `lead_profiles`
  rollup table is the only possible addition, decided in 2c).

**Open questions for Phase 2 (need answers before build):** see the new
"Phase 2 open questions" section below.

### Phase 3 — Business intelligence (owner-facing)
- Turn every conversation into structured signal: demand by product/grade, lost
  sales (out-of-stock, POR escalations), drop-off points, intent trends.
- Surface in the dashboard (reuse `agent_requests` / quote-request pipeline tables;
  add the memory-derived analytics layer).

### Phase 4 — Privacy & security hardening
- PII retention limits + per-tenant isolation/encryption for stored conversations.
- Real deletion path (ties to the flagged GDPR-delete gap — `task_9480d244`).
- Memory strictly tenant-walled; injection defenses extended to summarized memory
  (a summary must never carry injected instructions forward).

## Data model (locked for Phase 1)

Tables live in the **BYOD tenant DB** (same Alembic lineage as the control DB
for non-BYOD tenants). All rows are `company_id`-scoped; retention +
delete-by-session/company built in from the start.

```
agent_sessions
  session_id      text PK
  company_id      text NOT NULL
  title           text              -- auto from first product name
  summary         text              -- Haiku-generated on idle; replaces full replay on resume
  lead_profile    jsonb             -- visitor identity, intent, objections
  state           jsonb             -- products resolved, quotes, what's still missing
  created_at      timestamptz
  last_active_at  timestamptz

agent_messages
  id              bigserial PK
  session_id      text → agent_sessions
  company_id      text NOT NULL
  role            text              -- user | assistant | tool
  content         text
  tool_calls      jsonb
  observations    jsonb
  actions         jsonb
  ts              timestamptz
```

Memory store decision: **new tables, not reuse `chat_logs`** — `chat_logs` has
the wrong shape (text-only, no tool calls, no state). Clean schema from the start.

## Decisions (all locked)

- Memory store = new Postgres tables in tenant DB. ✓
- Session identity on same device = `localStorage[company_id]`. ✓
- Summary model = **`gemini-2.5-flash-lite`** — the cheapest model already in
  the stack (`main.py:2093`), used for OCR and other cheap background tasks;
  session summarisation is the same category (text compression, no reasoning). ✓
- Agent loop model = tenant's existing model from `MODEL_MAPPING` per tier
  (flash-lite for FREE, flash for STARTER, pro for PRO/BYOD) — no change. ✓
- First-visit behaviour = skip history screen, go straight to chat. ✓
- Session title = auto from first resolved product name, no user input. ✓
- Cross-device identity = **device-local only for now**; link sessions by captured
  email in Phase 2 when qualification collects it. No extra prompt, no extra work. ✓
- History list = **last 5 sessions** — B2B buyers have 3–4 live enquiries max;
  5 keeps the list clean with no scroll needed. ✓
- Retention = **90 days visible in history list**; raw `agent_messages` rows
  **purged after 1 year** — covers the full B2B sales cycle in the list, keeps
  ROI panel data intact long-term without unbounded DB growth. ✓

## Phase 2 decisions (locked 2026-06-30)
1. **Stage authority = deterministic** `derive_stage` — pure, no per-turn LLM
   call, matches `lead_scoring.py`/`funnel.py`. ✓
2. **Cross-visit = BI rollup only** — email joins sessions server-side for the
   owner; the visitor's visible history stays `visitor_id`-scoped. No email-based
   merge of the visible list (typo/shared-email privacy risk). ✓
3. **Lead rollup = view over `agent_sessions`** — aggregate by
   `(company_id, email)` on read. **Zero migration for Phase 2.** ✓
4. **Nudge scope = in-conversation only** — outbound buyer re-engagement email
   deferred to a later phase (consent/unsubscribe/deliverability). ✓
5. **Reuse, don't rebuild** — Phase 2 calls `booking.should_offer_booking`,
   `lead_scoring._score_lead`, and `agent_handoff`; it adds no parallel gates. ✓

## Status checklist
- [x] Diagnosis written (this doc)
- [x] **Phase 0a** — grade/pack chip + dropdown selector in `ChatWidget.tsx`
- [x] **Phase 0b** — RULE 6 generic fallback removed for pack bots (`main.py:2962`)
- [x] **Phase 0c** — narrowing tools list options not just ask (`agent.py:~427`)
- [x] **Phase 0d** — widen history window 4→8, stop stripping client-side, state note
- [x] **Phase 1a** — `agent_sessions` + `agent_messages` tables + Alembic migration (`0026`)
- [x] **Phase 1b** — hybrid context feed (verbatim recent + flash-lite summary on idle; `services/session_store.py`)
- [x] **Phase 1c** — auto-title generation from session state (`session_store.derive_title`)
- [x] **Phase 1d** — two-screen widget (history screen + chat screen + menu nav)
      + 3 widget session endpoints (`GET/POST /api/sessions`, `GET /api/sessions/{id}/messages`)
      + **per-visitor scoping** via device-local `visitor_id` (migration `0027`) so the
      history list never leaks another visitor's titles/previews. Tests:
      `test_session_store.py` (18) + `test_widget_sessions.py` (9). Committed `5b8c46d0`.
      Migrations 0026+0027 applied dark to control DB (alembic_version left at 0025).
      Live-verified 2026-06-30. **Phase 1 COMPLETE.** Remaining: push/merge to MainV2.
- [x] **Phase 2a** — session state machine: `services/sales_funnel.py` `derive_stage`/`derive_state`
      (monotonic browsing→…→handed_off) populates `agent_sessions.state`
- [x] **Phase 2b** — `next_best_action` + `action_directive` injected as one system line/turn
      (deterministic; reuses `booking.should_offer_booking` band gate)
- [x] **Phase 2c** — `build_lead_profile` populates `agent_sessions.lead_profile` (reuses
      `lead_scoring._score_lead`); email is server-side BI seam only, NOT visible-history merge
- [x] **Phase 2d** — in-conversation nudges via `next_action`; outbound buyer email deferred
- [x] **Phase 2 wiring** — `session_store` getters/writers + `main.py` chat path; no new migration
      (0026 columns existed). Tests `test_sales_funnel.py` (23). Build 2026-06-30, uncommitted.
      Remaining: live-verify → commit → push/merge to MainV2.
- [x] **Phase 3a** — pure analytics module `services/session_bi.py`: `build_demand_signal`,
      `build_stage_funnel`, `build_lost_sales`, `build_lead_quality`. 18 tests in
      `test_session_bi.py`. LLM-free, same discipline as `funnel.py`.
- [x] **Phase 3b** — `GET /api/sessions/bi/{company_id}?window_days=` endpoint in `main.py`:
      product demand (JSONB unnest), stage distribution, POR escalations, lead quality bands.
      Gated on `has_entitlement(user, "analytics")` + company ownership check. 0/7/30/90/all-time windows.
- [x] **Phase 3c** — `SessionBiPanel.tsx`: product demand (`HorizontalBars`), session funnel
      (`FunnelChart`), lost-sales metric cards (POR + quoted-not-captured), lead quality donut.
      Window picker (`Segmented`). Handles 402→UpgradePrompt, empty state, loading skeletons.
- [x] **Phase 3d** — wired into Operations tab (`insights/page.tsx`) for chemical bots only,
      above the existing `FunnelPanel`. tsc clean. Uncommitted — live-verify → commit → push.
- [ ] Phase 4 — privacy/retention/deletion hardening

## Related
- Grade-slot fix (`a7262269`) removed the SDS disambiguation loop — a prerequisite
  symptom of the thin-memory problem. See [[chemical-vertical-agent]].
- [[catalog-auto-import]] populates the structured catalog the agent reasons over.
