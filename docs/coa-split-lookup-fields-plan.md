# COA split lookup fields - plan

Branch: `feature/coa-split-lookup-fields`
Supersedes decision **C1** of `docs/coa-confidential-access-plan.md`.
Reads with: `docs/coa-finder-plan.md` (§7 matching), `docs/coa-confidential-access-plan.md` (§3 locked decisions, §4 matching rule).

## 0. Status - 2026-08-27

**Phases 1-5 code BUILT, Phase 5's migration APPLIED to the control DB, and the
branch is rebased onto current `MainV2` and ready to merge (2026-08-27).** One
thing left for the owner: Phase 4's live-agent check (§7 Phase 4 - needs a
real LLM call and a real Google Drive folder, the owner is running this
themselves).
Branch created off `MainV2`. Two commits: `af45e6af` (migration 0040, its own
commit per convention) and `70c78c4c` (everything else). Rebased cleanly onto
`origin/MainV2` (which had advanced 2 commits - PR #122/#123, structure-aware
chunking - with zero line-level overlap against every COA file; confirmed
before rebasing, and the rebase needed no conflict resolution). Diff against
`MainV2` is exactly 15 files, all COA-related, 1492/-160 - nothing from the
upstream work leaked in as "ours." Suite green post-rebase: backend 2816
passed/138 skipped (COA's 2754/134 combined with upstream's new chunking
tests), frontend 640/640, tsc clean.
Committed: `af45e6af` and `70c78c4c` (see above). Nothing outstanding.

**Migration numbering note**: `coa_lookup_events` was drafted as `0039` and had
to be renumbered to `0040` before applying - the control DB's `alembic_version`
was already stamped `0039` by an untracked prior migration
(`0039_company_knowledge_context`, added `company_knowledge.context`, applied
directly 2026-08-25, no file anywhere in this repo including `MainV2`).
Backfilled a stub `0039_company_knowledge_context.py` (idempotent `ADD COLUMN IF
NOT EXISTS`) so the local Alembic chain resolves - without it, `alembic
heads`/`history`/`upgrade head` hard-error (`KeyError` on the missing revision
id), not just warn. Confirmed with the owner before renumbering rather than
silently picking a number.

## 1. The problem

Expresolv's customers cannot work out what to type into the certificate panel.
The panel gives them one unlabelled box, a placeholder, and six lines of small print.

Expresolv wrote their own instructions for their customers, and those instructions are the evidence:

> 1. **Enter the Product Code** - the first 5-8 alphanumeric characters of your pack code, as shown on the product label. Example: for pack code `101LR025L` (25 Litre pack), the product code is `101LR`.
> 2. **Add a Space** - leave a single space after the product code before entering the batch number.
> 3. **Enter the Batch Number** - printed on the product label, COA and invoice. Enter it exactly as shown, including any dots. Example: `101.26R001`
>
> Search format: `[Product Code] [Batch Number]` - example: `101LR 101.26R001`

Three steps, and each one lands differently against the shipped code.

**Step 2 exists only because there is one box.**
It is not a rule about certificates, it is a workaround for the input.
Two fields delete it outright.

**Step 3 already works.**
`101.26R001` tokenizes to `101` + `26R001` and matches exactly, dots and all.
Nothing to change.

**Step 1 is the actual blocker.**
The label prints the **pack code**, `101LR025L`.
The lookup wants the **product code**, `101LR`.
The customer must know that `025L` encodes the 25-litre pack size, that it is not part of the product code, and that they have to cut it off before typing.
Nothing on the drum marks that boundary - `101LR025L` is one unbroken string.

The matcher is unforgiving here.
`tokenize` splits on runs of non-alphanumerics only, so `101LR025L` stays a **single token**, and exact equality means it can never equal `101LR`.
A customer who copies exactly what is in front of them gets the standard refusal with no indication that they typed too much.

Second example from the client, same shape: pack code `230HPLC2500M`, product code `230HPLC`, `2500M` = 2500 ml.

### 1.1 What the filenames look like

Confirmed by the client:

```
101LR_101.26R001_ACETONE LR.pdf
```

which `tokenize_filename` turns into `101LR`, `101`, `26R001`, `ACETONE`, `LR`.

The product code appears in the filename **in its short form**.
The pack size never appears.
So the tolerance has to live in the matcher or in the customer's head, and it has been living in the customer's head.

### 1.2 One COA per dispatch

The client confirmed a certificate is produced per product dispatch and filed in the Drive folder, depending on what the customer ordered.
It is not per pack size.
The pack-size suffix is therefore genuinely noise for identification purposes, not information we would be discarding wrongly.

## 2. What this plan is not

It is not the per-company customisable labels and examples explored earlier in the session.
That idea is deferred deliberately (§11): split the fields, accept the pack code, watch what happens.
If confusion survives this change, the problem was never format guidance and we will have learned that cheaply.

It is also not a filename grammar.
**D2 of `coa-finder-plan.md` survives intact**, and §5 below is written so that it does.

## 3. Decisions

| # | Decision | Rationale |
|---|---|---|
| S1 | **Two labelled fields, `Product code` and `Batch number`** - reverses C1 | C1 chose one box so a customer who reverses the two values would not burn an attempt. The real-world failure turned out to be the opposite one: with no labels, customers cannot tell what either value *is*. S3 keeps C1's protection anyway |
| S2 | **The first field accepts the pack code as printed.** Extra trailing characters are tolerated | The label has no product code on it. Asking a customer to derive one from a string with no marked boundary is the defect |
| S3 | **The strict pass is field-agnostic.** Both fields are pooled into one token set and matched exactly, exactly as today | This is C1's rationale preserved: a customer who swaps the two values still resolves, and a pasted invoice line still works. Which field is which matters only to the tolerant pass |
| S4 | **The tolerant pass runs only when the strict pass matched nothing**, and tolerance applies **only to product-field tokens** | Widening can only ever add matches, so a query that already resolves cannot change behaviour, and an *ambiguous* query is never rescued into a release. The batch stays exact because it is the entropy - a tolerant batch could release the wrong certificate |
| S5 | **Tolerance is one-directional: a document token may be a prefix of a query token, never the reverse** | The reverse is the browsable-index behaviour deliberately deleted in `coa-confidential-access-plan` §4. A customer supplying *more* characters than the file holds cannot broaden a search; a customer supplying fewer can |
| S6 | **A document token qualifies for prefix matching only at 4+ characters** | Guards against short numeric tokens (`101`, `230`) prefix-matching every pack code that starts with them. It is a noise floor, not a convention: it makes no claim about what a product code looks like |
| S7 | **C2, C3, C4, C6, C7, C8 are unchanged.** Uniqueness, the single refusal, the throttle, chat parity, submission-only misses, open degradation | Nothing here touches the confidentiality model. The observable surface is identical; only the set of queries that resolve grows |
| S8 | **`get_coa` gains the same two slots** | C6. If the panel tolerates a pack code and the chat path does not, the two visitor paths disagree - which is exactly what the single-resolver invariant exists to prevent |
| S9 | **`q=` keeps working on the endpoint** | The widget is embedded on customer sites and can be cached. An old bundle must keep resolving, and it does: with no product field, the tolerant pass has no tokens to widen and the behaviour is byte-identical to today |

## 4. Why S4 and S5 are safe

Worth writing down, because "we added prefix matching to the COA lookup" reads alarming against a plan whose §4 deleted exactly that.

The deleted behaviour let a **short** query match **long** filenames: `EP` returned 48 certificates, and the result list published the client's production history.
That direction is still forbidden (S5).

What S2 needs is the opposite direction.
The customer types `230HPLC2500M` and the file holds `230HPLC` - they have supplied *more* information than the file contains, not less.
A query cannot be broadened by adding characters to it.

The remaining risk is a **wrong** release: query tokens that were meant for certificate A tolerantly matching certificate B.
Three things close it.

1. The tolerant pass runs only when the strict pass found **zero** documents, so no currently-correct answer can change.
2. Batch tokens stay exact, so the tolerant pass still requires the visitor to hold a real batch number - which is where the entropy is, and which they can only read off a drum or an invoice.
3. Uniqueness still gates the release (C2). Two tolerant survivors return nothing, same as two strict survivors.

The refusal text, the throttle and the miss ledger are untouched, so C3 and C4 hold unchanged.

## 5. The matching rule

Replaces §4 of `coa-confidential-access-plan.md`.
D2 is preserved: nothing below inspects a *filename* to decide what kind of token it holds.
The product/batch distinction exists only in **which box the visitor typed in**, and is carried as data.

Given a query with an optional `product` string and an optional `batch` string:

1. Tokenize both as today - NFKC, uppercase, split on every run of non-alphanumerics, drop a trailing extension token.
2. Pool them: `tokens = tokenize(product) + tokenize(batch)`.
3. **Refuse if fewer than 2 tokens survive the pool.** Unchanged floor, unchanged rationale, and §4.1 of the confidential-access plan still applies to it verbatim.
4. **Strict pass.** Every pooled token must match some document token by exact equality, plus the existing leading-zero numeric normalization (`26R16` == `26R016`). Keep documents where every token matched.
5. If exactly one document survives, **release it**. If two or more survive, **refuse** - do not continue to step 6.
6. **Tolerant pass**, only when step 4 produced **zero** documents and the product field produced at least one token. A **product** token matches a document token if the exact rule of step 4 holds, **or** if the document token is at least 4 characters and is a prefix of the query token. **Batch** tokens keep the exact rule with no tolerance.
7. Release only if exactly one document survives the tolerant pass. Zero, two or two hundred all return nothing.

### 5.1 Worked examples against the real corpus

Document: `101LR_101.26R001_ACETONE LR.pdf` → `101LR`, `101`, `26R001`, `ACETONE`, `LR`.

| Product field | Batch field | Pass | Result |
|---|---|---|---|
| `101LR` | `101.26R001` | strict | released - the case that works today |
| `101LR025L` | `101.26R001` | tolerant (`101LR` prefixes `101LR025L`) | **released - the case this plan exists for** |
| `230HPLC2500M` | `230.26R001` | tolerant (`230HPLC` prefixes `230HPLC2500M`) | released |
| `101.26R001` | `101LR` | strict - pooling is field-agnostic (S3) | released despite the fields being swapped |
| *(empty)* | `101.26R001` | strict, no product tokens so no tolerant pass | refused - a batch spans several grades on this client's data (§4.1 of the confidential-access plan) |
| `101LR` | `101.26R999` | both - batch never tolerated | refused |
| `101LR025L` | `101.26R999` | both | refused - tolerance on the product cannot rescue a wrong batch |
| `ACETONE` | *(empty)* | floor | refused before matching, one token |
| `101LR025L` *(pasted whole line)* | *(empty)* | floor - one token | refused |

Note the fifth and eighth rows: the two-token floor and the uniqueness rule both still do their jobs, and neither was weakened.

### 5.2 Where the code changes

`sapybase_ai_engine/services/coa_drive.py`:

- New frozen dataclass `CoaQuery(product: str = "", batch: str = "", raw: str = "")` with a `from_raw()` constructor for the `q=` path. Pure, so it unit-tests without Drive.
- `_hits(token, doc)` stays exactly as it is and remains the exact rule.
- New `_hits_tolerant(token, doc)` - `_hits` or "some document token of length >= `MIN_PREFIX_DOC_TOKEN` is a prefix of `token`".
- `MIN_PREFIX_DOC_TOKEN = 4`, beside the other guard-rail constants with the reason on it.
- `_matches(documents, query)` coerces `query` to a `CoaQuery` (`_coerce_query`, mirrors `coerce_overrides` in `packs/overrides.py`) then pools the tokens and runs the two passes. It stays module-private for the reason already documented: the match *count* is what C3 withholds.
  - **Built as a coercion, not a hard type change.** `_matches`, `lookup` and `resolve` still accept `Any` and normalize at the boundary via `CoaQuery.from_raw` when the argument isn't already a `CoaQuery`. This keeps every existing caller - `main.py`'s two `coa_drive.resolve(..., q, ...)` / `(..., query, ...)` call sites, and every raw-string test - working unchanged through Phase 1, so Phase 2 becomes "wire the new params in," not "fix what Phase 1 broke."
- `lookup(documents, query)` unchanged in contract - one document or `None`. Accepts a `CoaQuery` or anything `from_raw` can wrap.
- `resolve(...)` accepts the same. The forced re-walk still fires only when the final answer is `None` **and** the strict pass matched zero, so a tolerant release costs no extra Drive call and an ambiguous query still does not trigger a walk.

`sapybase_ai_engine/main.py`:

- `GET /api/widget/coa` accepts `product` and `batch` alongside `q`. If either new param is present, build `CoaQuery(product, batch)`; otherwise `CoaQuery.from_raw(q)` (S9).
- Rate limits, throttle order, lockout handling, `503` on Drive outage, and the payload shape are all untouched.
- `_run_get_coa` builds a `CoaQuery` from the tool's two slots.

`sapybase_ai_engine/packs/chemical.py`:

- `get_coa` slots become `product_code` and `batch_number`, both required.
- Description updated to tell the model to pass the code **exactly as the visitor read it, including any pack-size characters, and never to shorten it** - the truncation instruction disappears from the model's job too, not just the customer's.
- Everything else on the spec is unchanged, `restricted=True` included.

`src/components/chat/ChatWidget.tsx`:

- `CoaPicker` takes `product` / `batch` and two change handlers instead of `query` / `onQueryChange`.
- Two labelled fields, stacked, then a full-width `Request certificate` button.
- The six-line hint block and its three invented examples (`ABC-2201 L045B` and friends) are **deleted**. One line survives: *"Copy both exactly as printed on your drum, label or invoice."*
- Submit is enabled when **either** field has content. The form must never be stricter than the lookup, and a dotted batch alone is a legitimate query that the backend will judge.
- `coaQuery` state becomes `coaProduct` + `coaBatch`; `submitCoaLookup` sends both params.
- Both fields clear together on open and on cancel. Verify no chat-side path prefills a raw string into either box - the agent cannot say which token is which, and a half-filled wrong field is worse than an empty form.
- The released card, the refusal, the lockout, the unconfigured state and the support button are all unchanged.

## 6. Guard rails - what must not change

- The refusal string, byte for byte, for every content outcome (C3).
- The throttle: 3 misses / 5 minutes → 15-minute lockout, counted on submission only (C4, C7).
- One press = one lookup. Two fields do not become two requests.
- Match counts never leave `coa_drive` (C3).
- `restricted=True` on `get_coa` - a turn that used it still cannot become public FAQ schema.
- The owner report, Test Connection, and the walk guard rails.
- `MIN_QUERY_TOKENS = 2`, applied to the pooled token set.

## 7. Phases

**Phase 1 - resolver. BUILT 2026-08-27.**
`CoaQuery`, `_hits_tolerant`, `MIN_PREFIX_DOC_TOKEN`, the two-pass `_matches`, `lookup` and `resolve` signatures.
Pure-function tests first; no endpoint or UI yet.
Suite green (2708 passed, 134 skipped, pre-existing skips - `sapybase_ai_engine/tests/`).
`CoaQuery`, `_hits_tolerant`, `MIN_PREFIX_DOC_TOKEN = 4`, two-pass `_matches` all landed in `services/coa_drive.py`; 15 new tests in `TestCoaQueryTolerantMatching` (`tests/test_coa_drive.py`), all against the library's real fixtures (`100RG`/`100PU`/`100LR` sharing one batch, the `101HPLC` ampersand filename), not synthetic data.
`main.py` untouched - zero lines changed - because `_coerce_query` absorbs raw strings.

**Phase 2 - endpoint. BUILT 2026-08-27.**
`product` / `batch` params added to `GET /api/widget/coa`; `q` retained unchanged.
The two new params win whenever either is present (`product or batch`), so a stale/empty `q` from a mid-rollout bundle can never mask them; with neither present the endpoint falls back to `CoaQuery.from_raw(q)` exactly as Phase 1 already handled.
`_run_get_coa` (the chat tool) deliberately NOT touched here - still calls `coa_drive.resolve(..., query, ...)` with the raw string, unchanged since before Phase 1. That is Phase 4's job (C6 chat parity); doing it here would race ahead of `chemical.py`'s `get_coa` slots, which do not exist yet.
9 new tests in `TestWidgetEndpointSplitFields` (`tests/test_coa_endpoint.py`): exact release via split fields, the tolerant pack-code case through the real HTTP path (not just the pure resolver), swapped fields, product/batch priority over a stray `q`, the two-token floor on a lone field, wrong-batch-never-rescued, ambiguous-pair refusal, unchanged payload shape, and the throttle counting a miss the same way regardless of which query shape earned it.
Suite green (2717 passed, 134 skipped - up from 2708 after Phase 1, i.e. exactly the 9 new tests, nothing else moved).

**Phase 3 - panel. BUILT 2026-08-27.**
`CoaPicker` in `ChatWidget.tsx` now takes `product`/`batch`/`onProductChange`/`onBatchChange` instead of `query`/`onQueryChange`. Two stacked labelled fields ("Product code", "Batch number"), a full-width "Request certificate" button below both, and the six-line hint block plus its three invented examples (`ABC-2201 L045B` etc.) deleted down to one line: "Copy both exactly as printed on your drum, label or invoice — including any extra characters after the product code, like a pack size."
Submit enabled on **either** field having content (`!product.trim() && !batch.trim()` disables, not an AND) - the form must never be stricter than the lookup (§5.2), and this is asserted by a new test (`'is enabled once EITHER field has content, not just both'`).
State (`coaProduct`/`coaBatch`), `openCoaPicker`/`openCoaPickerWithResult` (both fields reset together, still left EMPTY on a chat-opened result - comment updated to explain why with two fields instead of one: there is no reliable way to split what the model captured), and `submitCoaLookup` (sends `product=`/`batch=` instead of `q=`) all updated.
`coa-picker.test.tsx` rewritten to the new prop shape - all 47 tests pass, plus the new either-field-enables-submit test.
Vitest green (635/635, 40 files - up from 626 before this phase, i.e. the file's net test count after the rewrite). tsc clean. eslint 0 errors on both touched files (5 pre-existing warnings elsewhere, unrelated).
Browser-verified: a throwaway route rendering the real `CoaPicker` directly (not a mockup) was used to check all four states (prompt/released/refused/locked) in both light and OS-dark (`prefers-color-scheme`, since this codebase's Tailwind v4 has no `.dark`-class variant - confirmed no `@custom-variant dark` exists), and to confirm typing into ONLY the product field enables Request. Route deleted after verification; nothing shipped from it.

**Phase 4 - chat parity (C6). Code BUILT 2026-08-27, live-agent check open.**
`packs/chemical.py`: `get_coa` slots replaced - `product_code` and `batch_number`, both
required - and the description rewritten to tell the model to pass the product code
exactly as read, including any trailing pack-size characters, and never to shorten it
or guess where it ends. The worked example is now two named args
(`product_code='100RG'`, `batch_number='100.26R016'`) instead of one space-joined string.
`main.py`'s `_run_get_coa` builds `coa_drive.CoaQuery.from_fields(product_code, batch_number)`
the same way `search_coa` already does, and folds a call with both slots blank into the
same `not_found` refusal a blank `query` used to get (still costs the visitor nothing).
`services/agent_runtime/tools/get_coa.py`'s `_capture` now reads `product_code`/`batch_number`
and rebuilds the owner-facing `query` display string by joining whichever of the two are
present - `sources.py` and the owner-report shape are unchanged, since they only ever read
that already-joined string, not the tool's args directly.
Every place that asserted the old single `query` slot updated to match: `test_packs.py`
(slot names), `test_agent.py` (schema shape), `test_agent_runtime_registry.py` (capture
shape), `test_coa_endpoint.py` (`run_tool` calls rewritten via a new `coa_args()` helper
that splits a legacy single string into the two slots the way the model is instructed to).
New test proves the actual point of the phase: `test_a_pack_code_read_out_in_chat_resolves_via_the_tolerant_pass`
calls `_run_get_coa` with the padded pack code `100RG025L` and confirms it releases the
same certificate the panel's tolerant-pass test releases (`TestOneResolver` in
`test_coa_endpoint.py`) - same resolver, same result, proven through the code path the
chat tool actually runs, not just the pure `coa_drive` matcher.
Suite green: 2719 passed / 134 skipped (up from 2717 after Phase 3 - the new tolerant-chat
test plus one new description test, minus nothing removed).

**Still open**: the plan's own checklist item, "live agent check that a pack code read out
in chat resolves" - an end-to-end conversation through a real LLM against a real Drive
folder, which needs live credentials and a real company's COA config. Asked the owner how
to handle this (2026-08-27) - **they will run it themselves.** Phase 4 stays open until they
confirm; nothing else is pending. The automated test above proves the resolver and capture
pipeline `_run_get_coa` actually runs in production; it does not prove the model reliably
extracts `product_code`/`batch_number` from a spoken sentence - that is what the live check
is for.

**Phase 5 - instrumentation. Code BUILT and migration APPLIED 2026-08-27.**
Log the **shape** of each lookup, never the values: which fields were filled, strict or tolerant release, refused, and whether the visitor hit Contact support.
COA queries are confidential and `get_coa` is restricted - counting is fine, storing what people typed is not.
This is what makes "did it work?" answerable in three weeks instead of a second round of anecdotes.

**New table, `coa_lookup_events`** (migration `0040_coa_lookup_events.py` - drafted as `0039`, renumbered; see the numbering note in §0 - mirrors `teaser_events` from 0033: no generic widget-event pipeline exists, so each analytics-worthy feature gets its own narrow CHECK-constrained sink):
`id`, `company_id`, `source` (`panel`|`chat`), `outcome` (`strict`|`tolerant`|`refused`|`contact_support`), `fields` (`product_only`|`batch_only`|`both`|NULL), `created_at`. No identifier, filename or count column exists to leak one by accident.
Additive (`CREATE TABLE IF NOT EXISTS`) and idempotent. **Applied to the control DB (project `tticllabbbqwnhsmggfo`, Supabase MCP) and `alembic_version` stamped `0040`** - table shape verified post-apply via `information_schema.columns`, matches exactly (6 columns, correct nullability). The `migration-apply-dark` skill CLAUDE.md names does not actually exist in this environment (checked project and global `.claude/skills/` - neither has it), so this was done by hand following its documented intent: apply dark via the DB tool, then stamp as a no-op.

**The one new resolver surface**: `coa_drive.resolve_with_shape()` - same resolution as `resolve()`, plus which pass released it (`"strict"`/`"tolerant"`/`"refused"`). `resolve()` itself is now a thin wrapper that drops the shape, so its contract and every existing caller/test are untouched. `_matches` similarly became a thin wrapper over the new `_matches_by_pass`, which is what actually knows which of the two passes ran.

**Where the shape is logged**: `main.py`'s `search_coa` and `_run_get_coa` both call `resolve_with_shape` instead of `resolve`, then fire `_log_coa_event(company_id, source, outcome, fields)` - but only after a real resolution happened (never on `not_configured`, a lockout short-circuit, or a Drive outage, since nothing was actually looked up in those cases). `fields` comes from a pure helper, `_coa_fields_shape(product, batch)`, and is `None` for the legacy `q=` path (S9) since there is no box to attribute a release to.

**The bug caught before it shipped**: `_log_coa_event` runs *inside* the actual lookup path, not a dedicated beacon endpoint like `teaser-event` - so `get_db_connection()` itself (which can raise `HTTPException` on a pool error) had to be wrapped in its own try/except, not just the insert. The first draft mirrored `teaser-event`'s exact shape and would have turned a DB hiccup into a broken certificate release. `TestLogCoaEventNeverBreaksTheLookup` in `test_coa_endpoint.py` proves the fixed version: a real certificate still releases with `get_db_connection` raising.

**Contact-support click**: the one COA event only the browser can see. New endpoint `POST /api/widget/coa-event` (`{"source": "panel"|"chat"}`, validated 400 on anything else) logs `outcome="contact_support"`. `ChatWidget.tsx`'s `contactSupportFromCoa` now calls `logCoaContactSupport()` first, a fire-and-forget `fetch` (same `keepalive: true` discipline as the loader's own `teaser-event` beacon) tagged `source: coaFromChat ? 'chat' : 'panel'` - errors are swallowed, since analytics must never block the actual handoff.

Tests: `TestMatchShape` (test_coa_drive.py, pure, 5 cases) for the pass-labelling; `TestResolveWithShape` (test_coa_endpoint.py, Drive-backed) for strict/tolerant/refused through the real cache+re-walk path; `TestCoaFieldsShape` (6 cases); `TestCoaLookupEventLogging` (endpoint + tool, 10 cases covering what DOES and does NOT get logged - unconfigured, lockout, outage all correctly log nothing); `TestLogCoaEventNeverBreaksTheLookup` (3 cases, the DB-failure regression above); `TestCoaEventEndpoint` (4 cases). Frontend: `chatwidget_coa_event.test.ts` mirrors the source-selection/API-key-guard/body-shape logic, following this codebase's established convention (`chatwidget_hub.test.ts` etc.) of testing ChatWidget's extracted decision logic rather than rendering the full component with a mocked `fetch`.
Suite green: backend 2754 passed / 134 skipped (up from 2719 - 35 new tests). Frontend 640/640 (up from 635 - 5 new). tsc clean. eslint 0 new errors on both touched files (5 pre-existing warnings elsewhere in ChatWidget.tsx, unrelated - confirmed by direct `eslint src/components/chat/ChatWidget.tsx`).
Not done: no live browser verification of the Contact-support beacon (it is a non-visual, fire-and-forget, error-swallowed call with no UI change - the mirrored-logic tests plus the endpoint's own integration tests are the coverage; the same live-credentials concern flagged for Phase 4 would apply to testing it against a real embedded widget).

## 8. Tests

Backend, pure (no Drive, no Redis):

- `101LR025L` + `101.26R001` releases the `101LR` certificate via the tolerant pass.
- `230HPLC2500M` + `230.26R001` likewise.
- `101LR` + `101.26R001` still releases, and does so on the **strict** pass (assert the tolerant pass was not needed).
- Fields swapped, correct values → released, proving S3.
- Wrong batch with a tolerated product → refused.
- Reverse direction refused: a query token that is a **prefix of** a document token never matches (`101` must not release `101LR`'s certificate).
- The 4-character floor: a document token `101` does not prefix-match the query `101LR025L`.
- Ambiguous strict result is **not** escalated to the tolerant pass.
- Batch alone still refused on the current corpus shape.
- Two-token floor still refuses a single pooled token.
- `CoaQuery.from_raw` reproduces today's behaviour exactly on every example in `coa-confidential-access-plan` §4's table.

Backend, endpoint:

- `product` + `batch` and legacy `q` produce identical results for an exact query.
- A tolerant release still counts no miss; a refusal still counts one.
- Lockout still fires on the third miss and still precedes the Drive call.

Frontend:

- Request enabled with only one field filled.
- Both fields sent as separate params.
- Fields clear on open and cancel.
- Released, refused, locked, unconfigured and outage states unchanged - the existing `coa-picker.test.tsx` assertions should survive with only the input selectors updated.

## 9. Migration

Phases 1-4: none. No schema change, no `pack_overrides` key, no Alembic revision.

Phase 5 adds one: `0040_coa_lookup_events.py`, additive and idempotent
(`CREATE TABLE IF NOT EXISTS coa_lookup_events ...`), mirroring `teaser_events`
(0033). **Applied to the control DB 2026-08-27**, `alembic_version` stamped `0040`.

Drafted as `0039` and renumbered before applying: the control DB's
`alembic_version` was already at `0039` from an untracked prior migration
(`company_knowledge.context`, applied directly 2026-08-25, no file in this repo
on any branch). Backfilled a stub `0039_company_knowledge_context.py`
(idempotent `ADD COLUMN IF NOT EXISTS`) so the local chain - and any future
`alembic upgrade head` against this same database - resolves correctly instead
of erroring on an unknown revision id.

## 10. Residual risks - accepted, not solved

1. **Swapped fields plus a pack code fails.** The strict pass rescues a swap of two correct values, but if the pack code is in the batch box the tolerant pass will not widen it. Judged acceptable: labels make the swap much less likely than the unlabelled box did.
2. **A 4+ character numeric document token could still prefix-match.** `2301` would prefix `2301...`. Rare, and the exact batch requirement plus uniqueness still gate the release.
3. **The tolerant pass can turn a would-be-refusal into a different refusal.** If two documents tolerantly match, the visitor sees the same refusal they saw before. No regression, but no help either.
4. **Filename quality remains the ceiling.** A one-token filename is findable only by typing that token, and nothing here changes that (§11 of `coa-finder-plan.md`).

## 11. Deferred - written down so it is not re-derived

**Per-company field labels and examples in the dashboard.**
Two label strings and two example strings on `pack_overrides`, so `Product code` / `Batch number` can become `Item code` / `Lot no.` for the next client, with that client's real formats as placeholders.
Explicitly *not* built now, on the owner's instruction: ship the split fields, watch whether customers cope, and only add the customisation if they do not.
The reason this is the right order is that it isolates the variable - if confusion survives two labelled fields that accept the pack code, the cause is not format guidance and we would have built a settings surface for nothing.

**Owner-editable lookup guidelines.**
Rejected earlier in the same session and recorded here so it is not revived: a free-text prompt field lets a client rewrite bot behaviour in ways we cannot see or test, and it does not address the truncation problem at all.

## 12. Open questions

None blocking Phase 1.

Two that shape Phase 5's read, both for the client:

- Is the pack-size suffix always trailing? Every example so far is (`101LR` + `025L`, `230HPLC` + `2500M`), and the tolerant rule assumes it. A leading or infixed size would need a different rule.
- Are their customers being sent the written guideline today? If they are and still fail, that is the strongest possible confirmation that step 1's truncation is the blocker rather than step 2's space.
