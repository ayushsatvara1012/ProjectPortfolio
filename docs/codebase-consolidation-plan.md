# Codebase consolidation plan

Goal: a codebase an outsider can navigate, where every feature plugs into a shared spine instead of growing its own, so pipelines and logic stop being duplicated.

This is the first plan in `docs/` that **removes** rather than adds.
That absence is itself the root cause, and §7 fixes it.

## 0. Status - 2026-08-04

PLAN ONLY.
Nothing built.

Sequenced so that every phase is independently shippable, behaviour-preserving, and abandonable without leaving the tree half-migrated.

## 1. The diagnosis

The components are well built.
The composition was never designed.

Measured:

| Symptom | Number |
|---|---|
| `main.py` | 13,817 lines, 114 endpoints |
| The `/api/chat` endpoint alone | ~1,236 lines in one function (3099-4335) |
| Top-level modules | 27, of which 17 are `byod_*` |
| Modules in the "lead" concept space | 8 (~1,200 lines total) |
| Owner-notification functions | 7, each with its own gating |
| Per-turn logic call sites kept in sync by hand | 2 (streaming `main.py:3873`, non-streaming `main.py:5945`) |

The felt problem is not complexity, it is **illegibility**: you cannot answer "where does X happen?" from the structure.
Where an owner gets notified has seven answers.
Where a tool runs has two.
What a lead is has eight.

That is what makes it unreadable to an outsider, and it is also what causes re-duplication - when a concept has no obvious home, the next feature builds its own.

## 2. The most important finding

**`api/routers/` already exists, and it already works.**

`api/routers/byod_admin.py` (439 lines) and `api/routers/byod_client.py` (181 lines) were extracted on 2026-06-28 and are wired at `main.py:1340-1341` via `include_router`.
The migration was started and then stalled after two routers.

This changes the whole risk profile.
This plan is not "introduce an architecture".
It is **"finish a migration that already has a proven pattern, a working example, and a green suite in this repo."**

Everything in Phase 2 follows a template that exists in the tree today.

## 3. Principles

Four rules that every phase obeys.
If a step appears to require breaking one, stop and re-plan.

1. **No behaviour change.** Every phase is a move or a merge. Not one visitor-visible or owner-visible behaviour changes. Where two things being merged behave differently, the difference is preserved explicitly and flagged, never smoothed over.
2. **The suite is the contract.** Tests are not rewritten to match moved code. If a test needs editing beyond an import path, the move was not a move.
3. **One phase, one concept.** No phase both moves files and changes a rule.
4. **Abandonable at any point.** After each phase the tree is coherent and shippable. There is no "halfway" state that has to be finished before release.

## 4. Structural phases

### Phase 1 - Guardrails (do this first, it is small)

Before moving anything:

- Record the baseline: backend pytest, frontend vitest, `tsc`, lint. Numbers written into this file, not assumed.
- Add `tests/test_architecture.py` - cheap structural assertions that fail loudly on regression:
  - `main.py` stays under a declining line ceiling (set just above current, lowered each phase).
  - No new `@app.` route decorators in `main.py` (count-based, ratchets down).
  - Every module in `services/` has a module docstring.
- Characterization tests for anything about to move that is currently untested. Moving untested code is how a "pure move" silently changes behaviour.

### Phase 2 - Finish the router migration

`main.py` -> `api/routers/*.py`, following the `byod_admin.py` template exactly.

Order is deliberate: largest and safest first, riskiest last, so the pattern is proven before it touches the chat path.

| Order | Router | Endpoints | Why this position |
|---|---|---|---|
| 1 | `admin.py` | 34 | Biggest single win, owner-facing, well covered by tests |
| 2 | `companies.py` (+ `/api/company`) | 11 | Straight CRUD |
| 3 | `leads.py` | 8 | Includes `/api/leads/capture` - touched by Phase 3 |
| 4 | `knowledge.py` + `train.py` | 10 | Ingest surface |
| 5 | `widget.py` | 5 | Public surface, includes the COA panel endpoint |
| 6 | `sessions.py`, `user.py`, `explore.py`, `webhooks.py`, `eval.py`, `public.py` | ~20 | Small, mechanical |
| 7 | `internal.py` (cron) | 4 | Cron endpoints incl. the weekly digest |
| 8 | `chat.py` | 1 | Last. The 1,236-line endpoint, highest risk |

Shared dependencies (`get_db_connection`, auth, rate limiting, `r`) move to `api/deps.py` as FastAPI dependencies rather than being imported back out of `main.py` - otherwise the routers stay coupled to the file they were extracted from and nothing is actually gained.

End state: `main.py` is app construction, middleware, and `include_router` calls. Target under 500 lines.

**Nothing else happens in this phase.** No renaming, no merging, no logic touched. The chat endpoint arrives in `api/routers/chat.py` still 1,236 lines long, and that is correct - Phase 4 shrinks it, in a file where that is tractable.

## 5. Spine phases

These are what stop re-duplication.
Each replaces N implementations of one concept with one, and gives the next feature an obvious place to plug in.

### Phase 3 - One notification spine

Today: `_fire_webhook`, `_fire_slack`, `_send_handoff_email`, `_fire_agent_handoff`, `_fire_sheet_sink`, `_send_digest_email`, `_send_hot_lead_email` - seven functions, each with its own tiering, dedup, and recipient resolution. Roughly ten call sites total, so this is smaller than it sounds.

This is the seam that has already caused real damage: a phone number reached no one, and the hot-lead alert turns out to be unreachable from chat because it lives inside `/api/leads/capture`. Nobody chose that. It emerged.

Target: `services/notifications.py` exposing one entry point.

- One `OwnerEvent` shape: kind, company, session, contact, payload, urgency.
- One recipient resolution (today `resolve_alert_recipient` and `resolve_digest_recipient` are near-duplicates).
- One tiering decision, one dedup, one channel fan-out (Slack / email / webhook / sheet).
- Per-kind rules stay as **data**, mirroring the pack pattern: which kinds are real-time, which are digest-only, which need a valid reply-to.

Migration is strangler-style: build the spine, route one caller through it, confirm identical output, repeat. The existing quote-tiering rule (priced quotes never interrupt the owner) is preserved verbatim as a data entry, not re-derived.

### Phase 4 - One turn pipeline

Today the streaming and non-streaming chat paths each run their own copy of per-turn work - `extract_facts` at `main.py:3873` and `main.py:5945`, plus session persistence, funnel, scoring, logging, metering. Keeping them in sync is manual, and they have already drifted.

Target: one `services/turn_pipeline.py` with the post-reply sequence expressed once, called by both paths.

This is the phase that shrinks `chat.py` from 1,236 lines to something readable, and it is the reason Phase 2 puts chat last.

### Phase 5 - One tool contract

Today: four tools dispatched by a sync `if`-chain in `services/agent.py:986`, and `get_coa` executed separately in `main.py:6198` because it needed async and Google Drive. Same concept, two homes, split by implementation accident. Side effects (records, dedup, handoff) are hand-rolled per tool.

Target:

- One async dispatcher, `get_coa` included.
- `ToolSpec` gains `kind: read | write`, so write tools get uniform record-writing, dedup, and notification instead of each inventing it.
- Tool results get one observation shape.

This phase pays for itself immediately: the deferred tool layer in `docs/agent-conversation-gaps-plan.md` §8 becomes roughly half the work, because a new tool becomes a declaration plus a function rather than a declaration plus five integration points.

### Phase 6 - Collapse the lead domain

Eight modules, ~1,200 lines: `attribution`, `funnel`, `lead_alerts`, `lead_outcomes`, `lead_scoring`, `qualification`, `sales_funnel`, `session_bi`.

Low risk: all are leaf modules imported only by `main.py`, except `qualification` (also `packs/`) and `lead_outcomes` (also `db/models.py`).

Target: one `services/lead/` package with a single vocabulary - identity, qualification, scoring, stage, outcome, attribution - as submodules of one concept rather than eight peers with overlapping names.

Mostly renaming and re-homing. Behaviour preserved. The win is that "what is a lead in this system" gains one answer.

## 6. Legibility phase

### Phase 7 - The map

Structure alone does not make a codebase readable to an outsider. They need a way in.

`ARCHITECTURE.md` at the repo root:

1. **One request, end to end.** A single visitor message traced through every layer with real file references - widget, `/api/chat`, retrieval, pack, agent loop, tools, turn pipeline, notification, storage. One page. This is the single highest-value document for a new reader, and it does not exist.
2. **Where does X live.** A table from concept to owning module. Not a directory listing - a lookup for "I want to change how quotes are priced."
3. **The concept registry.** One home per concept, stated explicitly: notification, tool execution, turn pipeline, lead, pack config, tenant routing. This is the anti-duplication contract - a feature that needs one of these extends it and does not create a sibling.
4. **The BYOD boundary.** 17 modules is the largest complexity driver in the repo and an outsider cannot tell what is core and what is BYOD. Draw the line explicitly.

Plus a module docstring convention: every module in `services/` states what it owns and what it deliberately does not, in the style `services/qualification.py` and `services/coa_throttle.py` already use. Several modules already do this well; the phase makes it uniform and enforces it in `test_architecture.py`.

## 7. Process phase

### Phase 8 - Stop the regrowth

The structural work is worthless if the process that produced the sprawl continues.

The current workflow - plan doc per feature, memory entry per feature, tests per feature - is disciplined and it is why the components are good.
It has no counterpart for consolidation.
Roughly thirty plans in `docs/`, every one of them additive, not one that merges two things that turned out to be the same thing.

Three changes:

1. **`CLAUDE.md` rule:** every plan doc must name which existing spine it extends, or argue explicitly why a new concept is warranted. "Which spine does this attach to?" becomes a question asked before building, not after.
2. **Consolidation cadence:** every fourth feature plan is a consolidation plan. Scheduled, not aspirational.
3. **`test_architecture.py` ratchets.** The ceilings from Phase 1 only ever go down. This is what makes the improvement permanent rather than a one-time cleanup that decays.

## 8. Sequencing and cost

Rough sizing, not commitments:

| Phase | Size | Risk | Value |
|---|---|---|---|
| 1 Guardrails | 0.5 day | none | enables everything |
| 2 Routers | 4-6 days | low (mechanical, proven pattern) | **highest** |
| 3 Notifications | 2-3 days | medium (merging divergent rules) | **highest** |
| 4 Turn pipeline | 2-3 days | medium | high |
| 5 Tool contract | 2-3 days | medium | high, and pays forward |
| 6 Lead domain | 2 days | low (leaf modules) | medium |
| 7 The map | 1-2 days | none | **highest for an outsider** |
| 8 Process | 0.5 day | none | highest long-term |

Honest read: **phases 1, 2, 3 and 7 deliver most of the felt improvement.** If the appetite runs out after those, stop there - the tree is coherent and the remaining phases stay available.

Suggested order: 1 -> 2 -> 7 (first draft) -> 3 -> 4 -> 5 -> 6 -> 7 (final) -> 8.

`ARCHITECTURE.md` is drafted early because writing the end-to-end trace is the fastest way to discover which seams are genuinely confusing, and revised at the end once they are fixed.

## 9. Interaction with the other open plan

`docs/agent-conversation-gaps-plan.md` (slices A, B, C) is unaffected and can ship before, during, or after this.

Its slices touch `services/qualification.py`, `services/agent.py`, and add `services/activity_digest.py` - all of which move in phases 5 and 6.
Slice A's contact-notification path is exactly what Phase 3 unifies.

Recommended: **ship agent-conversation-gaps A and B first.** They fix live customer-facing failures and are small. Do not hold a lost-lead fix behind a refactor.

Slice C (the digest) is better built after Phase 3, so it plugs into the notification spine instead of becoming the eighth notifier.

## 10. What this plan does not claim

It does not make the system simpler - the domain is not simple, and multi-tenancy plus BYOD plus per-vertical packs is inherently complex.
It makes the complexity **findable**.

It does not address whether the BYOD data plane should exist at all.
That is a business decision about what is being sold, not an architecture decision, and it should be made deliberately rather than resolved by a refactor.
Phase 7 only draws the boundary clearly so the question can be asked honestly.

It will not, by itself, prevent all future duplication.
Only Phase 8 does that, and only if it is actually followed.
