# Vertical Chatbot Intelligence: Feedback Loop + Chemical Data-Precision Gaps

> **Status: IMPLEMENTED.** Formalizes the plan approved 2026-07-14; all phases
> below (except the deliberately-deferred 2c) shipped the same day. Frontend
> suite green (407 tests), backend suite green (1495 tests, up from 1479).

## Context

The question driving this plan: how to make the vertical chatbot smarter
(auto-learn from user interaction, use tools efficiently) and, for the
chemical vertical specifically, what Excel format clients should train on
and how dirty data gets cleaned before it reaches the database so the bot
answers precisely.

Research found that most of this is already built:

- `docs/archived/intelligent-agent-memory-plan.md` — session memory, sales-funnel
  state machine, next-best-action injection, owner-facing BI, privacy
  hardening — every phase through Phase 4 is checked done.
- `docs/chemical-catalog-upload-guide.md` — the client-facing Excel/CSV
  format spec, matched 1:1 to `packs/chemical.py::_CATALOG_TABLES`.
- `services/catalog_import.py` — a robust 5-stage dirty-data cleaning
  pipeline (header detection, synonym resolution, numeric/POR/boolean
  cleaning, a safety gate against wiping a catalog on a bad upload, and
  human-readable warnings for near-misses and skipped rows).

This plan targets the two concrete gaps that survived that research:

1. The catalog importer's cleaning warnings (`catalog_warnings`) are
   computed and returned by the backend but never rendered in the
   dashboard training UI — clients see "Training complete!" even when rows
   were silently skipped.
2. No visitor feedback signal exists (no thumbs up/down), so there is no
   "auto-learns from user interaction" mechanism today beyond the existing
   implicit `is_unanswered`/confidence signals and FAQ-mining endpoint.

A third, smaller item: the agent directive doesn't yet instruct the model
to reuse facts already resolved in `agent_sessions.state` before re-calling
a tool for the same slot within a session.

## Phase 1 — Surface catalog cleaning results to the client

- `src/app/(app)/dashboard/train/page.tsx`: render `status.catalog_warnings`
  (already returned by `/api/train/status/{job_id}`, `main.py:7882`/`7947`)
  as a distinct warning list alongside the success message.
- Link `docs/chemical-catalog-upload-guide.md` from the CSV/Excel upload tab.
- No backend change needed.

## Phase 2 — Feedback capture → owner-facing gaps → retrieval down-weighting

- **2a**: migration `0034_chat_logs_feedback.py` adds
  `client_message_id UUID` + `feedback SMALLINT` to `chat_logs`; thread
  `client_message_id` through `ChatRequest` → `log_chat_to_db`; new
  `POST /api/feedback` endpoint (widget-authenticated, same pattern as
  `/api/sessions/*`); `ChatWidget.tsx` gets thumbs-up/down icons per bot
  message.
- **2b**: extend the FAQ-mining query pattern (`main.py:8783-8880`) with a
  sibling "needs attention" query surfacing `feedback = -1` /
  `is_unanswered` / low-confidence turns, deduped and ranked by frequency;
  surface in the dashboard next to `SessionBiPanel.tsx`.
- **2c** (later slice, only after real feedback data exists): deterministic
  per-chunk down-weighting in the hybrid retrieval path based on downvote
  counts — no fine-tuning, floor so a chunk is never fully suppressed.

## Phase 3 — Prompt-level tool-reuse instruction

- `services/agent.py` `build_agent_directive`: one directive line telling
  the model to check `agent_sessions.state` for already-resolved facts
  before re-calling a tool for the same slot this session.

## Explicitly out of scope

- Rebuilding `services/catalog_import.py` or the memory/orchestration
  system — both already meet the bar this question is asking about.
- LLM fine-tuning or embedding retraining as a "learning" mechanism.

## Verification

- Phase 1: upload a deliberately dirty chemical sheet (mock data from
  `docs/archived/chemical-vertical-test-plan.md` with a renamed required column and
  a NOT-NULL-violating row) via the dashboard; confirm the warning list
  renders with specific sheet/column/row detail.
- Phase 2: thumbs-down a chat answer in the running widget; confirm
  `chat_logs.feedback` is set and the turn appears in the new
  owner-facing queue.
- Phase 3: ask for a product's SDS, then a follow-up reusing the same
  resolved product; confirm no redundant tool call fires.

## Status checklist

- [x] **Phase 1** — `catalog_warnings` captured on the initial `/api/train`
      response (was only ever on the immediate POST response, never the job
      status poll — computed synchronously before the chunking job is even
      queued) and rendered as a persistent, dismissible warning panel in
      `train/page.tsx`, next to (not inside) the auto-dismiss toast.
- [x] **Phase 2a** — migration `0034_chat_logs_feedback.py`
      (`client_message_id` UUID + `feedback` SMALLINT, control-plane only,
      same precedent as token metering); `ChatRequest.client_message_id` /
      `FeedbackRequest` models; `POST /api/feedback` (widget-authenticated,
      same rate-limit pattern as `/api/sessions/*`); `ChatWidget.tsx` generates
      the id per turn, sends it on `/api/chat`, and renders thumbs up/down
      under each bot reply. Tests: `test_message_feedback.py` (5).
- [x] **Phase 2b** — discovered `/api/fixes-needed/{company_id}` +
      `_build_fixes_list` already existed as the "needs attention" worklist
      (hard fallbacks + low-confidence) — extended it rather than building a
      parallel endpoint. `_build_fixes_list` gained an optional
      `downvoted_queries` set (outranks `unanswered`/`low_confidence`,
      includes a question even if otherwise well-answered); the endpoint
      fetches thumbs-down queries from the control-plane connection only
      (BYOD chat_logs doesn't have `feedback` yet). Extracted `_dedupe_ranked_qa`
      out of `get_bot_faqs` so the FAQ miner and this worklist share one
      near-duplicate-ranking helper instead of duplicating it.
      `FixesNeededPanel.tsx` gained a `downvoted` category (rose, ranked above
      amber/orange) and a count badge. Tests: `test_fixes_needed.py` (+4),
      `test_dedupe_ranked_qa.py` (7 new).
- [ ] **Phase 2c** — retrieval down-weighting. Deliberately deferred until 2a/2b
      have accumulated real feedback data to tune against.
- [x] **Phase 3** — `build_agent_directive`'s SDS paragraph now instructs the
      model to check the conversation's `[State: SDS provided for ...]` note
      (already emitted by the widget) before re-calling `get_sds` for an
      unchanged repeat ask — the same discipline `request_quote` already had.
      `get_product_spec` has no equivalent state note today, so it was left
      alone rather than adding an instruction with nothing to check against.
- [x] **Bug fix (2026-07-14, reported by maintainer)** — `get_sds` was asking
      "which grade?" for ANY product with more than one catalog row (grade or
      pack-size variants), even when every row pointed to the identical SDS
      document. An SDS is tied to the product (CAS number), not grade or pack
      size, so that question was always unnecessary in the common case.
      `_resolve_product` (`services/agent.py`) now also returns the raw
      matched `rows` alongside its trimmed `candidates` on an "ambiguous" CAS/
      name match; `get_sds` checks whether every matching row shares the same
      `https` `sds_ref` and, if so, serves it directly (grade blanked in the
      response, since it applies across all of them) instead of asking. Only
      genuinely asks for a grade now when grades really do carry *different*
      SDS documents (catalogs that upload one SDS link per grade, per
      `chemical-catalog-upload-guide.md`'s "two separate sheets" option still
      work correctly). `get_product_spec`/`request_quote` are untouched —
      grade still matters there. 6 tests updated/added in `test_agent.py`
      (3 pre-existing tests were asserting the old, incorrect behavior via a
      same-`sds_ref`-by-default test fixture — split each into a same-SDS
      case (now resolves directly) and a different-SDS case (still asks)).
      Suite green (1498 backend tests, up from 1495).
