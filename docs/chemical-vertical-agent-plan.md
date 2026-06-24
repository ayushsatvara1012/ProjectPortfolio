# Chemical Vertical AI Agent — Implementation Plan

> **Status:** Planning (no code written yet) · **Created:** 2026-06-23 · **Owner:** Ayush
> **Scope:** Evolve the Sapybase/Vaayu chat widget from a generic RAG + lead-capture bot
> into a **vertical-specific ReAct AI agent**, starting with the **chemical industry** as
> the first and (for now) only vertical.

---

## 1. Vision & Strategic Decision

Today the product is a **horizontal** bot wearing different system prompts: it answers
questions from a knowledge base, scores leads, and can show a booking CTA. Every customer
gets the same shape regardless of industry.

We are pivoting to a **vertical AI agent** model. The differentiator between industries is
**not tone — it is what the bot is allowed to DO** (book, quote, fetch a safety sheet,
check stock). That capability ("the bot can take actions, not just talk") is the core thing
missing from the engine today.

### What we are building
- A **ReAct agent**: Reason → Act (call a tool) → Observe (read the result) → respond.
  In our stack this is **native function-calling** (Gemini), looped — *not* a separate
  LangChain ReAct agent. Native function-calling = the same loop, far more reliable.
- A **"vertical pack"** abstraction: an industry = **config, not a code fork**. One engine
  serves all verticals; a pack defines persona + tools + slots + hub UI + knowledge + dashboard.

### What we are explicitly NOT building
- **A drag-drop flow canvas** (Voiceflow / Botpress / Landbot style). That is a Gen-1
  (pre-LLM) decision-tree paradigm, a large engineering product in itself, a commodity, and
  it pushes work onto the customer (a plumber/chemist does not want to draw flowcharts). Our
  pitch is the opposite: *"pick your industry, connect your systems, done."* We keep only the
  *one good idea* of a flow — **deterministic guard rails around actions** — as lightweight
  config, never a canvas.

### Why chemical first
The user's relatives own a chemical factory. That gives us **real domain expertise + a real
test bed + customer zero**. We validate every feature against the factory's real data before
offering it to anyone else. We do **one vertical to perfection**, then templatize.

---

## 2. Current System Reality (grounded in the codebase)

| Concern | Where | Notes |
|---|---|---|
| Chat endpoint | `sapybase_ai_engine/main.py` `/api/chat` (~line 2456) | RAG: HyDE → embed (Gemini) → retrieve (pgvector `company_knowledge`) → rerank → generate. **Text only — no tool/function-calling yet.** |
| Per-company config | `companies` table (main.py ~1340) | `system_prompt`, `bot_name`, `logo_url`, `initial_message`, `quick_questions`, `ai_model` already exist. |
| "Booking" | `sapybase_ai_engine/booking.py` | Only validates a CTA **URL** and decides whether to *show* a button. It does **not** perform any action. |
| Lead layer | `lead_scoring.py`, `lead_alerts.py`, `slack_handoff.py`, `attribution.py`, `funnel.py`, `weekly_digest.py` | Already computes scores, attribution, human handoff (Slack), weekly digest. Reusable for the analyze/automate tier. |
| Widget UI | `src/app/components/ChatWidget.tsx` (~1500 lines) | **Single-screen chat**, brand-themed. No hub/home screen. Reads `initial_message` + `quick_questions` from config. |

**Key gap:** there is no action/tool layer. Adding it (the ReAct loop) is the central work.

---

## 3. Architectural Spine — *"the vertical drives the system, and the vertical is data"*

Everything hangs off one record: `companies.vertical`. When the owner selects
"Chemical industry", `vertical = 'chemical'` makes **one config — the chemical pack — the
source of truth** for the whole experience:

```
chemical pack
├── persona_prompt  → system prompt (safety guardrail baked in)
├── tools[]         → which agent actions are enabled   (grows each phase)
├── slots[]         → fields each tool must collect (e.g. CAS no., grade, qty)
├── hub_cards[]     → which home-screen cards show (Quote / SDS / Stock / Ask)
├── knowledge_kinds → what docs feed RAG/tools (catalog, SDS)
└── dashboard[]     → which analytics widgets the owner sees
```

### The discipline (non-negotiable)
Build chemical as the **first** pack, but **read everything from the pack — never hardcode
`if vertical == 'chemical'`** scattered across the codebase. One branch today becomes ten
branches in six months. Pack-driven from day one means vertical #2 is *mostly config*.

> Lightweight, not over-engineered: the pack starts as a **versioned config file** in the
> engine (e.g. `packs/chemical.py`), code-reviewed, with git history. Promote to a DB table
> only when owners self-edit packs (Phase 6).

---

## 4. End-to-End Flow

```
Owner signs up
  → selects "Chemical industry"
  → system provisions the chemical pack (prompt, tools, hub, knowledge schema)
  → owner customizes: brand, uploads product catalog + SDS, sets pricing/quote rules,
    connects calendar / inventory
  → embeds widget on their site

Visitor opens widget
  → sees the hub (Home: Quote / SDS / Stock / Ask)
  → agent REASONS → calls a tool → OBSERVES the result → answers   (the ReAct loop)
  → lead + conversation data flow to the owner's dashboard
  → owner sees analysis: lead dossiers, drafted follow-up emails, business insights
```

---

## 5. Capability Set — Trust Tiers (feature backlog)

Tools are ordered by how much damage a bug can do — **build low-risk first**.

| Tier | Tools | Risk | Data source (all CONFIRMED to exist) |
|---|---|---|---|
| **1 — Answer** | RAG over their docs *(exists today)* | Low | Catalog / docs |
| **2 — Read-only actions** | `get_sds`, `get_product_spec`, `check_availability`, `check_compliance` | Low — pulls real data | SDS library, product catalog, inventory/ERP |
| **3 — Transact** | `request_quote`, `request_sample`, `book_technical_consult`, `escalate_to_chemist` | Medium — creates records / routes to humans | Pricing rules, calendar, Slack handoff |
| **4 — Analyze & automate** | lead dossier, `draft_followup_email`, business insights | Medium — outbound, owner-facing | Existing lead layer |

### THE non-negotiable guardrail (applies to ALL tiers)
**Safety / SDS / handling / dosage / storage / regulatory answers come ONLY from a tool that
pulls the real document or ruleset — NEVER from the model's own words.** Wrong chemical
safety info is a liability and a genuine danger. The agent collects the request (CAS number
is the precise key) and surfaces the *sourced* document; it must **refuse to improvise**
hazard/handling info and escalate instead. Likewise, **quote math is deterministic code, not
the model** — the LLM collects inputs and explains the quote; a pricing function computes it.

---

## 6. Confirmed Inputs (locked 2026-06-23)

The factory already has, in digital form:
- ✅ **Digital SDS library** (PDFs/files) → `get_sds` can serve real documents.
- ✅ **Structured product catalog** (grade, purity, CAS, packaging) → `get_product_spec` + RAG.
- ✅ **Inventory / ERP system** → `check_availability` can be *live*, not stubbed.
- ✅ **Defined pricing rules** → `request_quote` can *compute* (deterministic), not just route.

**Consequence:** every chemical tool can pull real data — nothing has to be faked.

**First feature to build (Phase 1 MVP):** `get_sds` — lowest risk, highest trust value,
exercises the full ReAct loop and the safety guardrail.

---

## 7. SDLC Roadmap — one shippable increment per phase

Each phase is a full mini-cycle (**design → build → test → ship → measure**) and leaves the
product working, just more capable. **Rule: never start a phase until the previous one is
shipped, tested, and verified against the factory's real data.**

| Phase | Delivers | Done when |
|---|---|---|
| **0 — Foundation** | `vertical` field + pack scaffolding + chemical pack registered. No behavior change. | Factory company set to `chemical`; pack loads; nothing else changes. |
| **1 — Agent loop MVP** | Function-calling (ReAct) in `/api/chat` + **one** tool `get_sds` + safety guardrail. | Bot reasons → calls `get_sds` → returns the correct real sheet; provably refuses to fabricate safety info. |
| **2 — Read-only tool suite** | `get_product_spec`, `check_availability`, `check_compliance`. | All three callable, grounded in real data. |
| **3 — Hub UI** | Pack-driven home screen (Home + Messages, action cards) on the widget. | Cards launch tools; a no-tools customer = straight to chat. |
| **4 — Transact** | `request_quote` (deterministic), `request_sample`, `book_technical_consult`, human handoff. | A real quote/booking record is created. |
| **5 — Analyze & automate** | Lead dossier + drafted follow-up email + business insights in dashboard. | Owner gets a dossier + draft email per lead. |
| **6 — Self-serve onboarding** | Owner configures the pack themselves; polish; promote pack to DB. | New owner → live agent without manual setup. |

> Concierge first: manually onboard the factory (and the first few customers) before building
> the Phase 6 self-serve UI — discover what packs actually need before automating them.

---

## 8. Phase 0 — Foundation (detailed)

**Goal:** put the pack machinery in place **without changing what any current bot does**
(ships "dark", zero risk — same discipline as the BYOD rollout).

1. **Data model**
   - Add `vertical` (text, nullable, default `NULL`) to `companies`. Existing customers stay
     `NULL` = today's generic bot. New chemical signups get `'chemical'`.
   - **Pack registry** as a versioned config file (`packs/chemical.py` or JSON), *not* a DB
     table yet.
2. **Pack schema** — `chemical` initially defines: `persona_prompt`, `tools=['get_sds']`,
   `slots` (get_sds: `product_name` OR `cas_number`), `hub_cards=[]` (filled Phase 3),
   `knowledge_kinds=['catalog','sds']`.
3. **Knowledge / storage seams**
   - `products` table (or structured rows in `company_knowledge`): name, CAS number, grade,
     packaging, `sds_ref`.
   - SDS files stored (object storage or a `sds_documents` table) keyed by product/CAS so
     `get_sds` has something real to return.
4. **SDLC** — design migration → write it → unit-test pack loading → ship behind the
   `vertical` flag. Because `NULL` = unchanged, **production behavior is identical** until a
   company is set to `'chemical'`.

**Done when:** the factory's company can be set to `vertical='chemical'`, the pack loads, and
nothing else changes.

---

## 9. Phase 1 — Agent loop + `get_sds` (detailed)

**Goal:** the bot reasons, calls one real tool, returns a real SDS — proving the entire
ReAct pattern end-to-end.

1. **The loop inside `chat_endpoint`** (main.py ~2456). Today: retrieve → generate → text.
   Insert a tool step:
   ```
   1. Build request: user message + RAG context + tool declarations (from the pack)
   2. Send to Gemini
   3. Gemini replies with EITHER:
        • text       → return it (today's path, unchanged)
        • a tool call → run the tool → feed result back → Gemini writes the final answer
   4. Return answer (+ any structured payload, e.g. the SDS link/card)
   ```
   Companies with `vertical=NULL` send **zero tools**, so step 3 never fires — existing bots
   are untouched. This is the safety net.

2. **The `get_sds` tool**
   - **Inputs (slots):** `product_name` OR `cas_number` (CAS is the precise key; the agent
     asks for it if the name is ambiguous).
   - **Logic (deterministic, no LLM):** look up the product → fetch its `sds_ref` →
     return `{ found, product, sds_url, last_updated }`.
   - **If not found:** return `found:false` → agent says "I don't have that sheet, let me
     connect you to our team." **Never invents** safety content.

3. **The safety guardrail (most important part of this phase)**
   - Persona prompt explicitly forbids generating hazard/handling/dosage/storage/regulatory
     info from the model's own knowledge — that info comes **only** from `get_sds`'s document.
   - Ambiguous/unsourced safety questions → escalate to a human, don't guess.
   - **Guardrail test suite** (a release gate): a set of prompts trying to make the bot
     improvise safety info; all must refuse or route to the tool.

4. **SDLC** — build behind the pack flag → unit-test `get_sds` (found / not-found / CAS vs
   name) → write the guardrail eval set → run the loop against the factory's **real SDS
   library** → ship to the factory's own site first (customer zero) → measure (correct sheets?
   any hallucinated safety info?). Only after it's clean on the factory do we offer it wider.

**Done when:** a visitor on the factory's site asks for a product's safety sheet, the agent
calls `get_sds`, returns the *correct real document*, and provably refuses to fabricate
safety info.

---

## 10. Repeating Pattern (Phases 2+)

Every later tool repeats the Phase-1 shape:

```
declare a tool  →  wire deterministic logic (read from real data source)
                →  guardrail it  →  test on the factory's own data  →  ship  →  measure
```

- **Phase 2** adds read-only tools (spec, availability via ERP, compliance ruleset).
- **Phase 3** adds the **pack-driven hub UI** (home screen cards that *launch tools* — this is
  why the hub is justified here when it wouldn't be for, say, a plumber with empty cards).
  Make the home screen itself pack-driven: chemical shows [Quote, SDS, Stock, Ask]; a no-tools
  customer shows no hub (straight to chat).
- **Phase 4** adds transactional tools (deterministic `request_quote`, sample, consult booking)
  + human handoff via existing `slack_handoff.py`.
- **Phase 5** pipes the existing lead layer outward: lead dossier + drafted follow-up email
  (Resend is already wired) + business insights for the owner.
- **Phase 6** self-serve onboarding + promote pack config to a DB table.

---

## 11. Open Decisions (to resolve as we go)

- [ ] Exact storage for SDS files (object storage vs DB blob vs URL to existing system).
- [ ] `products` as a new table vs structured rows in `company_knowledge`.
- [ ] How `check_availability` reaches the ERP (direct connector, scheduled sync, or cache).
- [ ] Whether Phase 3 hub is a separate "home" screen or an action-button strip above chat.
- [ ] Precise guardrail prompt wording + the guardrail eval set contents.

---

## 12. Next Step

Choose one:
1. **Go deeper on Phase 0/1 design** — exact `products` / `sds_documents` schema, or the
   precise guardrail prompt wording + eval set.
2. **Greenlight Phase 0 implementation** — start writing the migration + pack scaffolding
   (dark, zero-risk), with tests, verify, then proceed to Phase 1.
