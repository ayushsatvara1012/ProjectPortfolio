# Streaming + Cache Optimization Plan

## Goal

Make the live chemical-agent bot *feel* instant and cut its Gemini bill, without touching answer correctness or the SDS/hazard safety guarantees.

This is the reachable version of the parked P6 "cost caching" tier, rescoped after reading the actual code.

## What the code already does (premise correction)

Two assumptions from the original P6 framing turned out to be wrong or already handled:

1. **Streaming already exists for the generic RAG path.**
   `main.py` `stream_generator()` streams `chat_model.astream(messages)` token-by-token over SSE, with a 15s heartbeat (`: ping`) to keep Render/Cloudflare proxies from killing idle connections.
   That path is good and needs no work.

2. **Explicit Gemini context caching is a dead end.**
   `services/agent.py:1019-1021` documents the finding: explicit `CachedContent` needs a >=32,768-token static prefix we do not have.
   Gemini 2.x already does *implicit* context caching automatically, and `_accumulate_usage` already meters the `cache_read` / `cached_tokens` signal.
   So "turn on context caching" is not an action; maximizing the *implicit* hit rate is.

## The two real gaps

### Gap A - the agent path does not stream

The vertical-agent path (the live client) runs `run_agent_loop()` (`services/agent.py:1051`), which makes **blocking** `model.ainvoke()` calls across up to `MAX_TOOL_ROUNDS`, returns a single `precomputed_answer`, and `stream_generator()` then emits that whole string as **one** SSE token (`main.py:3685-3688`).
So the visitor sees nothing until the entire Reason->Act->Observe loop plus final compose completes (bounded by `AGENT_PRECOMPUTE_TIMEOUT_S`).
That is the perceived-latency problem for the client.

Key enabling fact: the agent's **final** round is a plain LLM text completion (`model.ainvoke` returning content with no tool_calls, `agent.py:1086-1089`).
The tool-loop rounds are not streamable text (they emit tool calls), but the final compose round is.

### Gap B - no answer-level cache, unbounded RAG token cost

Repeated/near-identical questions re-run the full agent loop and re-pay Gemini every time.
`FastAPICache` (Redis) is initialized (`main.py:1023`) but only used for config/branding reads, not for chat answers.
RAG retrieval top-k is not tuned for token cost.

## Scope (phased, suite green between each)

### Phase 1 - Agent-path progress + streamed compose (biggest perceived win)

#### Architectural constraint discovered while implementing (load-bearing)

The agent path computes the WHOLE answer *before* the SSE body streams.
`main.py:3439-3443` and the `services/agent.py` module docstring (lines 19-22) both state it: the `/api/chat` DB connection is released when the endpoint returns the `StreamingResponse`, so the generator runs with a dead cursor and the answer must be precomputed in the handler body.
Consequence: neither status events nor streamed tokens can be "bolted on" - the agent loop must run *inside* the generator with its own DB connection.
That is a deliberate change to a documented invariant, so it is split into two slices.

#### Slice 1a - streaming-capable loop, live path untouched  [DONE 2026-07-13, uncommitted]

Pure refactor in `services/agent.py`, zero live-behavior change, suite green.
- New `stream_agent_loop(...)` async generator yields `{"type":"status","tool","label"}` before each tool call and exactly one `{"type":"final","text"}` at the end.
- `run_agent_loop(...)` is now a thin drain of it, returning the same string (all prior contracts - retry, MAX_TOKENS, `usage_out` metering, `AGENT_FALLBACK_TEXT` - byte-for-byte preserved).
- Visitor-safe `_tool_status_phrase()` mapping so raw tool identifiers never reach the widget.
- 7 new tests (`TestStreamAgentLoop`); full `test_agent.py` 95 passed, handoff + guardrail green.
- Final answer still uses blocking `ainvoke`; token-level compose streaming deferred (it entangles with the empty-retry guard that fixed the truncation bug).

#### Slice 1b - wire into the generator  [PENDING - touches the live endpoint]

1. Run the agent path inside `stream_generator()` using a generator-owned connection (`get_db_connection()` opened in the generator, released in its `finally`), because the outer conn is gone by then.
2. Consume `stream_agent_loop`: forward `status` -> `data: {"status": label}` SSE, accumulate the `final` text and emit it (as today, one block; token streaming is a later slice).
3. Move the agent-path session persistence (`session_store` / `sales_funnel` / `qualification`, currently `main.py:3588-3676`) onto the generator-owned connection / commit.
4. Preserve every side-channel event (`sds`, `quote`, `form`, `grade_selector`, `pack_selector`, `[DONE]`), the `AGENT_PRECOMPUTE_TIMEOUT_S` safety net, and the `AGENT_FALLBACK_TEXT` degrade path.
5. Widget (`ChatWidget.tsx`): render a transient status line from `status` events; `token` handling unchanged.

Risk: this is the live client's chat endpoint and cannot be fully E2E-tested from the harness (needs real Gemini + widget). Deploy deliberately, ideally client off-hours. Needs a go/no-go on timing before landing.

### Phase 2 - Implicit-cache-friendly prompt ordering (cost, no API change)

1. Assemble the agent `messages` so the **large static prefix** (system directive + tool schemas + pack instructions + few-shot, if any) is FIRST and **byte-identical** across turns for a given pack.
2. Move all per-turn dynamic content (user message, session-memory summary, lead profile) to the END.
3. Verify via the already-metered `cached_tokens` that the implicit hit rate rises (watch `SessionBiPanel` "Agent cost" row).
No new Gemini features; this only reorders what we already send so Gemini's automatic cache matches more prefix.

### Phase 3 - Redis answer cache for repeats (cost + instant on hit)

1. Add a short-TTL answer cache keyed on `(company_id, pack_vertical, normalized_question)` for **generic, non-personalized** answers only.
2. HARD EXCLUDE from caching: anything that produced an `sds` / `quote` / `form` / handoff, anything with lead-specific content, and anything where session memory influenced the reply.
   SDS/hazard answers must always come fresh from tool-returned documents (CLAUDE.md safety rule).
3. On hit, stream the cached string through the existing SSE path (so the client UX is identical).

### Phase 4 - RAG top-k trim (cost)

1. Lower generic-path retrieval top-k (start 4) and measure answer quality; back off only if quality drops.
2. Fewer chunks = fewer input tokens every call = cheaper + faster, independent of caching.

## Explicitly out of scope

- Explicit `CachedContent` wiring (needs 32K static prefix; not viable).
- Any change to SDS/hazard sourcing.
- Model-tier routing (already exists per model-stack memory).
- Render plan / worker changes (handled separately; `-w 2` already applied).

## Risks

- **Streaming the final compose can double-count tokens** if a round both streams and is re-metered; route `_accumulate_usage` on the streamed final response exactly once.
- **Status events could leak internal tool names**; map tool -> friendly phrase, never emit raw tool identifiers.
- **Answer cache poisoning** a personalized reply into a shared key is the main hazard; the exclusion list in Phase 3.2 is the guardrail and needs a dedicated test.
- Transaction-mode pooler already in use; none of this adds session-state SQL.

## Test plan

- Phase 1: SSE contract test - agent path now emits >=1 `status` then streamed `token`s then `[DONE]`; fallback path still emits single token + `[DONE]`.
- Phase 2: assert the static prefix is byte-identical across two turns of the same pack; assert `cached_tokens` > 0 on the second turn against a stub.
- Phase 3: cache-exclusion test - an SDS/quote/lead turn is never written to the answer cache; a plain repeat is served from cache.
- Phase 4: retrieval-count assertion + a small answer-quality regression set.
- Full suite green (backend pytest, frontend vitest, `tsc --noEmit`, lint) between phases.

## Success criteria

- Live client sees first visible motion in <500ms (status), first answer token streaming instead of a single blob.
- Measured `cached_tokens` share rises and average input tokens/turn falls (SessionBiPanel).
- Zero regressions in SDS/quote/handoff correctness.
