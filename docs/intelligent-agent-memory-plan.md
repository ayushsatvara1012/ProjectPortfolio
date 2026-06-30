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
- `session_id` is stored in browser `localStorage` keyed by `company_id`.
- Same device + same browser = sessions persist and resume correctly.
- Different device or cleared browser = treated as a new visitor (no cross-device
  link until email is captured during qualification; Phase 2 will link by email).

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
- A goal-driven funnel the agent tracks: qualify → recommend → quote → capture →
  handoff, with explicit "next best action" per state.
- Persist a **lead profile** across the conversation (and optionally across visits)
  — identity, intent, objections — so it behaves like a salesperson who remembers.
- Proactive nudges (follow the buyer forward) rather than purely reactive Q&A.

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

## Status checklist
- [x] Diagnosis written (this doc)
- [ ] **Phase 0a** — grade/pack chip + dropdown selector in `ChatWidget.tsx`
- [ ] **Phase 0b** — RULE 6 generic fallback removed for pack bots (`main.py:2962`)
- [ ] **Phase 0c** — narrowing tools list options not just ask (`agent.py:~427`)
- [ ] **Phase 0d** — widen history window 4→8, stop stripping client-side, state note
- [ ] **Phase 1a** — `agent_sessions` + `agent_messages` tables + Alembic migration
- [ ] **Phase 1b** — hybrid context feed (verbatim recent + Haiku summary on idle)
- [ ] **Phase 1c** — auto-title generation from session state
- [ ] **Phase 1d** — two-screen widget (history screen + chat screen + back nav)
- [ ] Phase 2 — funnel orchestration + email-linked cross-visit lead profile
- [ ] Phase 3 — BI / owner analytics
- [ ] Phase 4 — privacy/retention/deletion hardening

## Related
- Grade-slot fix (`a7262269`) removed the SDS disambiguation loop — a prerequisite
  symptom of the thin-memory problem. See [[chemical-vertical-agent]].
- [[catalog-auto-import]] populates the structured catalog the agent reasons over.
