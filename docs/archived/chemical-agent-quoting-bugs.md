# Chemical vertical agent — client-reported quoting/answer failures

Audit from client complaints (Expresolv AI bot) about the chat agent giving
truncated or "trouble reaching our product system" answers.
Status: root cause hypothesized from code + library inspection, NOT yet
confirmed against live Render/Gemini logs (Render MCP still unauthorized —
see fix 5 below).
Fixes 1-4 implemented in `main.py` / `services/agent.py`, suite green,
not yet committed.

## Evidence (4 screenshots)

1. **Xylene** — user picks "xylene" to disambiguate, agent replies
   "The CAS number for Xylene is 1330-2" — cut off mid-digit (should be
   `1330-20-7...`). A clean, well-formed SSE payload, not a dropped
   connection — the vertical-agent path emits the whole answer as one
   `yield`, so a network-level truncation would show as broken/missing
   JSON, not a valid-but-short string.
2. **1,2-Dichloroethane** — first message in a brand-new session fails
   immediately with the generic fallback. No multi-round complexity
   needed, yet still fails — rules out "only complex flows fail."
3. **Acetic acid glacial** — grade-listing turn succeeds; the very next
   turn (pricing round: `AR DRY, 500 ML`) fails with the fallback.
4. **diacetone alcohol → chloroform** — "diacetone alcohol" fails with
   the fallback; the *next* message ("chloroform") succeeds AND
   retroactively answers diacetone alcohol correctly ("I don't have
   diacetone alcohol on file"). Proves the underlying product lookup was
   never broken — this is a per-call roll of the dice, not a dead
   product/DB issue.

## Root cause (primary): Gemini 2.5 Flash thinking tokens vs. tight output cap

- Vertical/chemical agent turns always use `gemini-2.5-flash`
  (`for_agent=True` forces this regardless of tier —
  [main.py:686-690](../sapybase_ai_engine/main.py)). **Not** flash-lite.
- `max_output_tokens` is capped per pricing tier and shared with the
  plain single-shot RAG chat path — **FREE 400 / STARTER 800 / PRO 1200
  / BUSINESS 1600 / ENTERPRISE 2048**
  ([main.py:695-703](../sapybase_ai_engine/main.py)).
- Gemini 2.5 Flash is a **thinking model**. `langchain-google-genai`
  4.2.1 (installed version) exposes `thinking_budget` / `thinking_level`
  specifically to bound this — confirmed present in the installed
  library source (`venv/.../langchain_google_genai/chat_models.py`).
  Neither is set anywhere in this codebase, so thinking defaults to
  **dynamic/unbounded**, and thinking tokens draw from the *same*
  `max_output_tokens` pool as the visible answer for 2.5-series models.
- Result: on any turn where the model reasons a bit harder (tool-call
  planning, grade/pack disambiguation, GST note, qualification
  directives), it can burn most/all of a 400-800 token budget on
  invisible reasoning before writing the visible reply →
  - Empty `content` + no `tool_calls` → `run_agent_loop` falls through
    to `AGENT_FALLBACK_TEXT`
    ([services/agent.py:1070](../sapybase_ai_engine/services/agent.py))
    — matches screenshots 2, 3, and the first half of 4.
  - Partial content, cut off mid-sentence when the model hits
    `MAX_TOKENS` mid-answer — matches screenshot 1 (Xylene).

### Ruled out
- **Gemini 2.5 Flash-Lite**: not in use for the agent path — always
  pinned to full `gemini-2.5-flash` unless a bot has an explicit
  `company_model` override (worth double-checking Expresolv AI doesn't
  have one, but not the default).
- **Pure network/proxy truncation**: the clean, grammatically valid but
  short Xylene string is inconsistent with a dropped connection or SSE
  parse issue.

## Contributing / amplifying factors (secondary, unconfirmed)

- **Render Starter plan resources**: not yet checked against real
  metrics. A memory/CPU-starved dyno would make Gemini calls slower and
  more likely to also trip the per-call and total timeouts below,
  compounding (not causing) the token-budget issue. **Next step**: now
  that the Render MCP is connected, pull `list_logs` / `get_metrics` for
  the backend service around 10:09 PM, 10:17 PM, 10:59-11:00 PM, and
  11:19 PM to check for OOM restarts or CPU throttling.
- **Tight per-call / total timeouts on the agent path**:
  `max_retries=2, timeout=20` per Gemini call
  ([main.py:707-718](../sapybase_ai_engine/main.py)), and a hard 30s
  ceiling on the whole precompute
  (`AGENT_PRECOMPUTE_TIMEOUT_S` = 30,
  [main.py:1469-1472](../sapybase_ai_engine/main.py)). A multi-round
  quote turn needs 2+ blocking Gemini calls inside that 30s budget —
  any latency blip is more consequential here than on the single-call
  generic RAG path.
- **No telemetry to distinguish causes**: `_accumulate_usage`
  ([services/agent.py:1007](../sapybase_ai_engine/services/agent.py))
  doesn't capture `finish_reason`, so there's currently no way to tell
  from logs whether a given fallback was `MAX_TOKENS`, a real API
  error, or an exhausted round budget — everything looks identical in
  logs today.
- **No retry on empty-content**: one empty/no-tool-call response
  immediately returns `AGENT_FALLBACK_TEXT`
  ([services/agent.py:1070](../sapybase_ai_engine/services/agent.py))
  with zero retry, even though screenshot 4 shows the very next turn
  often succeeds on its own.

## Recommended fixes

1. **Set `thinking_budget` explicitly on the agent model** (highest
   leverage). Either disable thinking (`thinking_budget=0`) for
   deterministic, budget-predictable tool-calling, or cap it to a small
   fixed value (e.g. 150-250) so it can never consume the whole
   response budget.
   **DONE** — `AGENT_THINKING_BUDGET = 200`
   ([main.py:1479](../sapybase_ai_engine/main.py)), applied only when
   `for_agent=True` in `get_tier_model`. Chose a fixed cap over `0`
   since the ReAct loop still benefits from a little reasoning for
   tool-call planning and grade/pack disambiguation.
2. **Give the agent path its own, larger `max_output_tokens`**,
   independent of the tier's plain-chat cap — a quote/GST/qualification
   answer needs more headroom than a simple RAG reply, and reusing the
   tier cap here was tuned for the wrong workload.
   **DONE** — `AGENT_MAX_OUTPUT_TOKENS = 2048` flat for all tiers when
   `for_agent=True`, unless a CUSTOM plan explicitly overrides
   `max_output_tokens`.
3. **Log `finish_reason`** in `_accumulate_usage` / `run_agent_loop` so
   `MAX_TOKENS` truncation is visible going forward instead of only
   inferable from screenshots.
   **DONE** — new `_finish_reason()` helper reads
   `response.response_metadata["finish_reason"]`; `run_agent_loop` logs
   a warning when it's `MAX_TOKENS`, for both the primary call and the
   retry call below.
4. **Add a single bounded retry** on empty-content/no-tool-call
   responses before falling back to `AGENT_FALLBACK_TEXT` — screenshot
   4 suggests this alone would recover a meaningful share of cases.
   **DONE** — one retry `model.ainvoke(convo)` before falling back; if
   the retry produces tool calls the loop continues normally, otherwise
   its text (or the fallback) is returned.
5. **Confirm/rule out Render resource pressure** via the now-connected
   Render MCP — pull logs/metrics for the exact failure timestamps
   before deciding whether a plan upgrade is warranted.
   **BLOCKED** — `mcp__render__list_workspaces` returns `unauthorized`.
   The `RENDER_API_KEY` referenced by `.mcp.json` needs to be the
   rotated key (see "Unrelated issue" below), exported in the shell
   profile, before this can run.

Backend suite green after 1-4: 1472 passed / 125 skipped
(`sapybase_ai_engine/tests/`, up from the pre-change 1064 baseline via
newer test additions, no regressions).
Pure code change in `main.py` (`get_tier_model`) and `services/agent.py`
(`run_agent_loop`, `_accumulate_usage`, new `_finish_reason`) — no
migration involved. Not yet committed.

## Unrelated issue found + fixed during this session: exposed Render API key

- User's `.mcp.json` initially hardcoded a live Render API key in
  plaintext, in a file that was untracked but **not** gitignored — one
  `git add .` away from landing in git history.
- Also used the wrong transport (`npx @modelcontextprotocol/server-render`
  stdio package, which doesn't match Render's actual HTTP-hosted MCP
  endpoint that had already been confirmed working via
  `claude mcp add --transport http`).
- **Fixed**: `.mcp.json` rewritten to use the HTTP transport
  (`https://mcp.render.com/mcp`) with the key read from
  `${RENDER_API_KEY}` (shell env var), so no secret is stored in the
  file — safe to commit as-is.
- **User action still pending**: rotate the exposed key in the Render
  dashboard (it was typed in plaintext into this chat) and export the
  new key as `RENDER_API_KEY` in their shell profile.

## Next step

User verifies fixes 1-4 against a live Expresolv AI session (Xylene,
1,2-Dichloroethane, Acetic acid glacial grade→price round, diacetone
alcohol→chloroform), then commit + push.
Once `RENDER_API_KEY` is rotated and exported, pull Render logs/metrics
for the four original failure timestamps to confirm (or rule out) the
resource-pressure contributing factor — informational at this point,
not blocking, since the primary root cause is already addressed.
