# Chemical Vertical Agent — Hardening & Intelligence Plan

**Date:** 2026-07-04 · **Branch:** `agentic-ai` · **Status:** planned, not started

Consolidates the full audit of the chemical vertical (agent tools, handoff layer,
sample form, dashboard) plus three capability gaps: autonomous questioning,
shareable quote artifact, and cost caching. Phases are ordered by risk-reduction
per unit of effort; each phase ships independently with the suite green.

---

## Execution protocol (rules — binding for every phase)

1. **Verify before you edit — never trust this document blindly.** Line numbers
   and behavior claims were true on 2026-07-04; the code may have moved. Read
   the actual function before changing it. If the code contradicts a finding
   here (e.g. the bug is already fixed), say so and skip — do not "fix" what
   isn't broken.
2. **Do not hallucinate.** No invented endpoints, table columns, config keys,
   or library APIs. If a column/helper is assumed but not found in the code,
   stop and check the schema/migrations (`alembic`) or grep for it. Prices,
   SDS, and safety behavior must remain tool-grounded — never weaken the
   guardrail while refactoring around it.
3. **Ask, don't guess.** Stop and ask the user when a decision is product-level:
   notification tiering thresholds, quote-link expiry length, which sink hosts
   to allowlist, whether the global env sink survives, qualification-slot
   wording. Pure engineering choices (naming, test structure) — just decide.
4. **Small slices, suite green between each.** After every slice:
   `sapybase_ai_engine/venv/bin/python -m pytest tests/ -q`, `npm run test`,
   `npx tsc --noEmit`. A phase is not done with a red or skipped suite.
5. **New behavior = new tests, written with the change** (not after the phase).
   Security fixes get adversarial tests (payloads that would have exploited the
   bug). Regression: the existing guardrail tests must keep passing untouched.
6. **Revise after each phase**: re-read the diff (`git diff`) as a reviewer
   before declaring the phase done — check tenant scoping (`company_id = %s`),
   escaping, and that no debug code/logging noise is left. Then update the
   progress ledger below AND the `chemical-agent-hardening` memory entry.
7. **One phase at a time, in order.** Do not start phase N+1 with N incomplete.
   Within a phase, items may be reordered if a dependency demands it.
8. **Migrations**: additive + idempotent (`ADD COLUMN IF NOT EXISTS` style),
   consistent with how 0019/0020/0023 were handled. Never destructive. Note in
   the ledger whether a migration was applied dark to the prod control DB.
9. **Commit only when the user says to.** No pushes without explicit
   instruction. Never commit `.env`, pricing files, or keys.
10. **Pack-registry discipline** (CLAUDE.md): no `if chemical` hardcoding — new
    behavior goes through pack config (`packs/schema.py` + `packs/chemical.py`).
11. **Cost discipline**: model stack is Gemini only (flash-lite/flash/pro) — no
    other providers, and no new LLM calls where a deterministic path works.

## Progress ledger (update as you go)

| Phase | Status | Notes |
|---|---|---|
| 1 — Security & correctness hotfixes | **DONE (committed `bd11333f`)** 2026-07-04 | All 6 items landed on `agentic-ai`. Backend suite green (1287 passed / 124 skipped); `tsc` clean. See per-item notes below. No migrations. Committed with Phase 2 in `bd11333f` (SetupStrip.tsx marketing UI redesign deliberately left OUT of this commit — unrelated). |
| 2 — Input validation & anti-abuse | **DONE (committed `bd11333f`)** 2026-07-04 | All 5 items landed on `agentic-ai` (product calls confirmed with user: drop env sink; block-private-ranges SSRF; 50/company/day cap). **2.5 COMPLETE incl. the widget contact-echo.** Backend green (1287 passed / 124 skipped); `tsc` clean; frontend all-mine green (1 pre-existing unrelated `insights-panels` failure). No migrations. |
| 3 — Owner workflow | **DONE (uncommitted, 3.1–3.4)** 2026-07-04 | 3.1 PATCH status endpoints (per-table vocab, ownership-checked) + 3.2 merged `RequestsInboxPanel` (kind filter, status selects, "View chat" → conversations focus; old two panels deleted; `session_id` added to GET payloads) + 3.3 notification tiering (`_handoff_meets_tier` POR-with-email/sample only; `_handoff_dedup_ok` 1/session/kind/hr, degrade-open) + POR email gate in `request_quote` + 3.4 sink onboarding (`POST /api/companies/{id}/sample-sink/test`, `_fire_sheet_sink`→`(ok,detail)`, Apps Script template + status in `SampleFormEditor`, `channel_delivery_status` surfaced in settings GET). **Migration 0029** `companies.channel_delivery_status JSONB` (additive/idempotent) — ⚠️ settings GET now SELECTs this column → must be applied to the control DB or the endpoint 500s. Backend 1311 pass / 124 skip; frontend +15 mine green (1 pre-existing `insights-panels` fail); tsc clean. |
| 4 — Quote link + modal | not started | |
| 5 — Autonomous qualification | not started | |
| 6 — Cost caching | not started | |

---

## Phase 1 — Security & correctness hotfixes (small, do first)

1. **Escape the handoff-email transcript** (`main.py` ~3566). Visitor chat
   `content` is interpolated into the owner email HTML unescaped → HTML/link
   injection into a trusted email. Fix: `html.escape(content)` for both roles.
   Test: transcript containing `<script>`/`<a href>` renders escaped.
2. **Pass `session_id` into `request_quote`** (`services/agent.py::execute_tool`
   ~709 and `main.py::_tool_executor`). Today every `quote_requests.session_id`
   is NULL → quotes can't be tied to conversations, funnel/BI joins are blind.
   Thread `chat_req.session_id` through the executor into `execute_tool`.
3. **POR-vs-priced duplicate rows resolve arbitrarily** (`request_quote` ~532).
   When dup SKU rows mix a priced row and a POR/NULL row, `prows[0]` wins by DB
   order. Rule: if any row is priced and prices agree → quote it; if rows
   disagree on POR-ness treat as `ambiguous_price` (escalate).
4. **Cap and confirm quantity** (`_parse_qty`). Clamp to 1–10 000; when the raw
   input didn't parse, return a `confirm_quantity` signal instead of silently
   using 1 (sample sheet must never say qty=1 when the buyer wrote "10-20").
5. **Honest sample-submit response** (`submit_sample_request`). If the
   `agent_requests` insert failed AND no handoff channel is configured, return
   an error instead of `{"status": "ok"}` — never tell a visitor a lost lead
   was captured. (Inside the form endpoint we can afford to fail loudly.)
6. **Fix mixed-product grade chips** (`get_product_spec` ambiguous enrichment
   ~299): only flatten grades when all candidates share one product name;
   otherwise surface product candidates, not grades.

### Phase 1 — implementation notes (done 2026-07-04, uncommitted)

- **1.1** `main._send_handoff_email`: local `import html as _html`; escaped visitor
  `content`, `bot_name`, `visitor_name/email` in the email HTML. Email *subject*
  left as raw text (mail header, not HTML) via a separate `subject_label`. Tests:
  `tests/test_handoff_email.py` (script/`<a>`/img/`<b>` neutralized; subject keeps
  literal `&`).
- **1.2** Threaded `session_id`: added optional `session_id` param to
  `agent.execute_tool`, passed into `request_quote`; `main._tool_executor` passes
  `chat_req.session_id`. (`request_quote`/`_insert_quote` already persisted the
  column — it was just always NULL.) Test: `test_request_quote_persists_session_id`.
- **1.3** Dup-row resolution rewritten: helper `_row_is_por(r)`; escalate to
  `ambiguous_price` when rows disagree on POR-ness OR priced rows disagree on the
  number; `prows[0]` only chosen once rows agree. Tests: priced+POR mix (both DB
  orders) escalates; agreeing dup rows still quote.
- **1.4** New `_classify_qty(v) -> (qty, needs_confirm)` + `QTY_MAX=10_000`;
  `_parse_qty` now clamps and delegates. `request_quote` returns new
  `confirm_quantity` status when quantity is present-but-unparseable or ≤0 (no
  persist). Missing/blank still defaults to 1 and quotes. **Sample-FORM quantity
  validation deferred to Phase 2.1** (the `quantity` column is INTEGER, so "10-20"
  can't be stored; per-field validation belongs with the 2.1 sanitizer). Tests:
  missing→quote1, unparseable/≤0→confirm, >cap clamps.
- **1.5** `_insert_agent_request` now returns `bool` (was `None`). `submit_sample_request`
  captures it; if the insert failed AND no owner channel (`slack_webhook_url` /
  `alert_email` / `owner_email`) is configured → **HTTP 502 `CAPTURE_FAILED`**
  instead of `{"status":"ok"}`. Tests: `tests/test_sample_submit_endpoint.py`
  (fail+no-channel→502; fail+email→ok; success→ok) + helper false-on-insert-fail.
- **1.6** `get_product_spec` ambiguous enrichment: only flatten grades when the
  candidates share ONE product name (case-insensitive); when names differ, emit a
  `products` list and NO `grades`/`product` (no mislabeled grade chips). Tests:
  same-product flattens, mixed-products surfaces `products`.
- **Pre-existing unrelated failure (NOT mine):** frontend
  `src/__tests__/insights-panels.test.tsx > decouples "Won" click…` fails on the
  clean pre-change tree too (ActionCenterPanel Won-deal UI). Left untouched.

## Phase 2 — Input validation & anti-abuse (public endpoints)

1. **Visitor-side field sanitizer** (sibling of `sanitize_form_fields`, in
   `packs/overrides.py`): per-field length caps, email regex for `email` type,
   digits/`+`-only for `tel`, drop keys not in the effective form. Applied in
   `submit_sample_request` before insert/sink/handoff.
2. **Anti-spam for `/api/widget/sample-request`**: per-company daily cap
   (Redis counter), hidden honeypot field in the widget form, dedup by
   `(contact_email, product)` within 10 min.
3. **Sheet-sink SSRF guard** (`_fire_sheet_sink`): reuse the Slack-webhook
   pattern — allowlist known sink hosts (`script.google.com`,
   `hooks.zapier.com`, Power Automate) OR resolve-and-block private/loopback
   ranges; set `follow_redirects=False`.
4. **Drop the global env sink fallback** for multi-tenant safety: no per-bot
   sink → no sink push (DB record + owner email already cover capture). Keep
   env sink only behind an explicit "platform demo company" allowlist.
5. **Validate model-supplied contact args** (quote handoff): email-shape check
   before it becomes `reply_to`; widget confirms captured contact back to the
   visitor.

### Phase 2 — implementation notes (done 2026-07-04, uncommitted)

Product decisions confirmed with the user before building:
- **2.4** → drop the global env sink entirely (per-bot only; no demo-company
  allowlist — none exists in the code).
- **2.3** → block private/loopback/link-local/reserved ranges, allow any public
  host (not a 3-host allowlist); `follow_redirects=False`.
- **2.2** → daily cap = **50 / company / day**.

- **2.1** `packs/overrides.sanitize_visitor_fields(raw, effective_form)`: per-type
  length caps (`_VISITOR_MAX_LEN`), `email` kept only if it matches
  `\A[^@\s]+@[^@\s]+\.[^@\s]+\Z`, `tel` reduced to digits + one leading `+`, and
  keys not in the effective form are dropped (except the `cas_number` hidden
  prefill via `_VISITOR_EXTRA_KEYS`). Wired into `submit_sample_request` BEFORE the
  required-field check, so the whole downstream (insert `form_data`, handoff, sink)
  sees only clean values. Exported through `packs/__init__`. Tests in
  `tests/test_pack_overrides.py::TestSanitizeVisitorFields` + endpoint tests.
- **2.2** Honeypot: constant `SAMPLE_HONEYPOT_FIELD="website"`; the widget renders a
  visually-hidden `website` input (`ChatWidget.tsx` SampleForm), and the endpoint
  returns a fake `ok` (never tips off the bot) + drops the submit if it's filled.
  Dedup: `sample_dedup:{company_id}:{sha1(email|product)}` `SET nx ex=600` → second
  identical submit returns `{ok, duplicate:true}`. Daily cap:
  `sample_cap:{company_id}:{YYYYMMDD}` `INCR` + `EXPIRE 86400`, 429 `RATE_LIMITED`
  past `SAMPLE_DAILY_CAP_PER_COMPANY`. All three degrade OPEN if Redis is down.
  Also added module-level `r = None` (the endpoint now references `r`
  unconditionally; previously a latent NameError before startup / in tests).
- **2.3** `main._url_resolves_to_public_ip(url)`: non-raising sibling of
  `validate_safe_url` using `socket.getaddrinfo` (checks ALL resolved addresses,
  IPv4+IPv6); `_fire_sheet_sink` calls it and skips on non-public/unresolvable, and
  now uses `follow_redirects=False`. One-shot check (not DNS-rebind-proof; the URL
  is owner-configured, so acceptable). Tests: `test_validate_safe_url.py::TestUrlResolvesToPublicIp`.
- **2.4** `effective_sample_sink(overrides)` lost its `env_url/env_secret` params —
  per-bot sink ONLY, `("","")` when absent. `SAMPLE_SINK_WEBHOOK_URL/SECRET`
  globals removed; endpoint call + stale comment updated. Tests in
  `TestEffectiveSampleSink` rewritten (no env fallback).
- **2.5** `main._valid_reply_to(email) -> Optional[str]`: shape + length(≤254) check
  (`\A...\Z` anchored, so a trailing-newline header-injection can't slip through);
  used for the agent-handoff email `reply_to`. **Widget contact-echo (done):**
  `_captured_contact_echo(tool_args)` (validated email via `_valid_reply_to`, phone
  ≤32, name ≤120; None when nothing usable) is attached to the quote-card payload as
  `captured_contact`; `ChatWidget.tsx` renders a subtle "We'll reach you at … Not
  right? Just send the correct one." line under the quote card when an email/phone
  was captured. Tests: `test_handoff_email.py` (`_valid_reply_to`,
  `_captured_contact_echo`).

**Residual carried forward:** sample-FORM `number` fields (e.g. `quantity="10-20"`
via a direct API call bypassing the widget's `type=number`) are still coerced by
`_parse_qty`→1 for the typed column while `form_data` keeps the raw string. Behind
the widget input this can't happen; low-severity data-quality edge, not a hole.

## Phase 3 — Owner workflow (dashboard operability)

**Product decisions confirmed with the user (2026-07-04):**
- **Instant-alert tier** = **POR quotes (with the visitor's email captured first)**
  + **sample submits** (already carry contact). Priced quotes and bare
  price-checks are **dashboard-only** — no instant ping. Per-session dedup: one
  ping per session per kind per hour.
- **POR contact gate**: when a quote resolves to POR, the agent should capture
  the visitor's **email before finalizing the POR** so every POR owner-alert
  arrives with a contact. (Solicit-then-notify, don't hard-block an answer.)
- **Weekly digest** → **PARKED** (defer the cron + digest email to a later slice).
- **Inbox** → **MERGE** QuoteRequestsPanel + AgentRequestsPanel into ONE Requests
  panel with a quote/sample kind filter.
- **Sink onboarding (3.4)** → **deferred to the tail** of this phase (adds a
  `last_delivery_status` migration).
- **Status vocab discrepancy noted:** `quote_requests.status` today is
  `new|sent|won|lost`; `agent_requests.status` is `new|handled`. Keep each
  table's own vocab in the PATCH validator (per-kind allowed sets) — do NOT
  force a single unified set that would allow invalid states.

1. **Status management** (slice 3.1): `PATCH /api/companies/{id}/quote-requests/{rid}`
   and `PATCH /api/companies/{id}/agent-requests/{rid}` with a per-table
   allowed-status set, ownership-checked (`WHERE company_id = %s AND user_id`).
   Buttons in the panel.
2. **Unified requests inbox** (slice 3.2): one panel, kind filter (quote/sample),
   replacing the separate QuoteRequestsPanel/AgentRequestsPanel views.
   Click-through to the session transcript (enabled by Phase 1.2 `session_id`).
3. **Notification tiering** (slice 3.3): instant Slack/email only for POR quotes
   (email captured) + sample submits; priced/bare price-checks → dashboard only.
   Per-session dedup (one ping per session per kind per hour). Includes the POR
   contact-capture gate in the agent's quote path.
4. **Sink onboarding** (slice 3.4, tail): copy-paste Google Apps Script template
   + "Send test row" button next to the sink URL field; store and display
   `last_delivery_status` per channel (Slack/email/sink) in settings.

## Phase 4 — Shareable quote link + structured modal

1. Migration: `quote_requests.public_token` (uuid, unique, indexed) +
   `expires_at` (default 30 days).
2. `GET /api/public/quote/{token}`: read-only, token-gated, rate-limited,
   returns structured quote + company branding; 410 after expiry.
3. Next.js public page `/q/[token]`: branded quote (product/grade/pack/qty/
   price, "GST extra as applicable", validity date), CTAs → request sample /
   contact team. No auth.
4. Widget: quote card gains "View & share quote" → modal with the structured
   quote + copy-link button. `request_quote` observation returns `quote_url`;
   the model is told to mention (never fabricate) the link; the widget renders
   the button deterministically, same pattern as the SDS button.
5. Later (parked): PDF download of the quote page.

## Phase 5 — Autonomous qualification (goal-based questioning)

Keep tools deterministic; make the *directive* goal-based instead of scripted.

1. Pack config: `qualification_slots` on `Pack` (chemical: application,
   monthly_volume, industry, delivery_city, timeline) — config, not code.
2. Persist answered facts into the existing per-session `lead_profile`
   (deterministic extraction on tool-arg capture + a light parse of visitor
   answers; no extra LLM call).
3. System-message block: "KNOWN buyer facts: … / UNKNOWN: … — weave AT MOST
   one natural discovery question into your reply when it fits; never
   interrogate, never block an answer on it." The model chooses which/when —
   that's the intelligence — while prices/SDS still only come from tools.
4. Raise `MAX_TOOL_ROUNDS` 3 → 4 (needed once the model both answers and
   reasons about qualification).
5. Surface collected facts in the owner's request records (`form_data` /
   lead profile → request panels), so a sample request arrives with
   application + volume attached.
6. Eval gate: extend the guardrail eval set with qualification turns — assert
   no price/safety leakage and ≤1 discovery question per reply.

## Phase 6 — Cost caching (three tiers)

1. **Gemini explicit context caching** for the static prompt prefix (platform
   rules + persona + agent directive + tool schemas), keyed per company,
   TTL ~1 h, refreshed on settings/pack-override change. Biggest cost lever;
   zero correctness risk.
2. **Tool-result cache** (Redis): `_resolve_product` / `_quote_rows` results
   keyed `(company_id, catalog_version, normalized_args)`, TTL 15 min, bumped
   `catalog_version` on every catalog import (reuse `invalidate_cache` hook).
3. **Guarded answer cache** for vertical bots (today fully bypassed,
   `main.py` ~2808): cache the final answer ONLY when the turn (a) had no
   session context in play, (b) used no tools or only read-only tools with
   `found` status, and (c) captured no contact. Key includes catalog_version.
   NEVER cache turns touching `request_quote`/`request_sample` (side effects:
   DB rows, owner notifications must fire every time).
4. Metering: log cache hit-rate + per-turn token counts into the existing
   usage tracking so the ROI panel can show "cost per conversation" trending.

---

## Test & acceptance

- Every phase: backend pytest + frontend vitest + `tsc --noEmit` green.
- Phase 1.1/2.x get dedicated security tests (escaping, SSRF allowlist,
  oversized/forged payloads rejected).
- Phase 5 gated by the guardrail eval set (no safety/price leakage).
- Phase 6 gated by a correctness test: a quote turn is never served from cache;
  catalog re-upload invalidates spec/SDS answers.

## Key file map (where everything lives)

- `sapybase_ai_engine/services/agent.py` — ReAct loop, all tools
  (`get_sds`, `get_product_spec`, `request_quote`, `request_sample`),
  `execute_tool` dispatcher, `build_agent_directive`, `_parse_qty`.
- `sapybase_ai_engine/main.py` — `/api/chat` agent precompute + `_tool_executor`
  capture (~3140–3350), handoff email builders (~3560), `_fire_agent_handoff` /
  `_fire_sheet_sink` (~3590–3650), cache bypass for vertical bots (~2808),
  `/api/widget/sample-request` (~4741), `/api/companies/{id}/agent-requests`
  (~4660), `/api/companies/{id}/quote-requests` (~4598).
- `sapybase_ai_engine/services/agent_handoff.py` — pure Slack/email builders
  (correctly escaped; the model for fixing the older transcript email).
- `sapybase_ai_engine/packs/` — `chemical.py` (pack config: tools, hub cards,
  sample form, catalog tables), `schema.py` (Pack/ToolSpec/FormField dataclasses),
  `overrides.py` (owner-side sanitizers — sibling home for the visitor-side one).
- `src/components/chat/ChatWidget.tsx` — SSE event handling (sds/quote/form/
  grade_selector/pack_selector), sample form, quote card (Phase 4 modal here).
- `src/components/dashboard/AgentRequestsPanel.tsx` + `QuoteRequestsPanel.tsx`
  — Phase 3 merges these into one inbox with status buttons.
- `sapybase_ai_engine/tests/` — `test_agent.py`, `test_agent_handoff.py`,
  `test_packs.py`, `test_pack_overrides.py` (extend, don't fork).
- `sapybase_ai_engine/services/` — `sales_funnel.py` (stage machine, Phase 5
  hooks), `session_store.py` (lead profile persistence).

## Out of scope (parked)

- PDF quote rendering; multi-line-item quotes/cart.
- `book_technical_consult` (Phase 4c, pending client requirements).
- Semantic (embedding-based) intent cache — revisit only if exact-match hit
  rate proves too low.
