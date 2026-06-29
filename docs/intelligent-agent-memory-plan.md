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

### Phase 0 — Foundations & cleanups (low risk, high signal)
- Retire/neutralize the generic RULE 6 fallback for pack bots so the agent never
  escapes to the dumb script (drive through tools or explicit handoff).
- Carry the agent's **structured outcome** of a turn (resolved product/grade,
  quote, SDS shown, form opened) forward so the next turn sees it — start by
  appending a compact "state note" to history, before a full store exists.
- Widen the window for agent conversations (4 → ~8–10 recent turns) and stop
  stripping structured context client-side.

### Phase 1 — Persistent session memory (the core)
- Server-side conversation store keyed by `session_id` (already passed today,
  unused for memory). Persist the FULL structured transcript: messages + tool
  calls + observations + emitted actions.
- Feed back a **hybrid context**: recent turns verbatim + a rolling LLM **summary**
  of older turns (token-bounded, nothing important lost in long chats).
- A typed **conversation state** object: who the visitor is, products/grades
  resolved, quotes given, what's still missing — so it never re-asks.
- Tenant-walled: a session belongs to one `company_id`; never readable cross-tenant.

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

## Data model sketch (to refine)
- `agent_sessions(session_id, company_id, lead_profile jsonb, state jsonb, summary text, created_at, last_at)`
- `agent_messages(id, session_id, company_id, role, content, tool_calls jsonb, observations jsonb, actions jsonb, ts)`
- All `company_id`-scoped; retention + delete-by-session/company.

## Open decisions
- Memory store: new Postgres tables vs reuse `chat_logs`? (BYOD tenants → their DB.)
- Cross-visit identity: anonymous session only, or link by captured email?
- Summary cadence + window sizes (token budget vs recall).
- How aggressively the agent nudges (sales-forward vs not pushy) — owner-configurable?
- Retention window default + per-tenant override.

## Status checklist
- [x] Diagnosis written (this doc)
- [ ] Phase 0 — fallback retire + carry structured state + wider window
- [ ] Phase 1 — persistent session memory + hybrid context + state object
- [ ] Phase 2 — funnel orchestration + lead profile
- [ ] Phase 3 — BI / owner analytics
- [ ] Phase 4 — privacy/retention/deletion hardening

## Related
- Grade-slot fix (`a7262269`) removed the SDS disambiguation loop — a prerequisite
  symptom of the thin-memory problem. See [[chemical-vertical-agent]].
- [[catalog-auto-import]] populates the structured catalog the agent reasons over.
