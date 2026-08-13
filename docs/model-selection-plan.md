# Model Selection - retiring dead models, centralising ids, and the Gemini 3.x question

Date: 2026-08-13.
Branch: `MainV2`.
Status: **Phase 1 COMMITTED AND PUSHED, MERGE DELIBERATELY HELD. Phase 2 (Gemini 3.x adoption) NOT STARTED - it is a real build, not a config bump.**

Branch: `bugfix/retired-gemini-models`, commit `2d54e457`, pushed to origin. Fast-forward from `MainV2` (zero divergence), so the merged tree is byte-identical to what was tested.

**Do not merge without checking with the owner first.** Held 2026-08-13 by owner decision: the client is not ready to retrain, and merging changes what training does. This is a scheduling hold, not a quality one - every gate passed (§1.7).

**What the hold costs, and it is not symmetric.** The commit fixes two independent failures with very different urgency:

- **The PDF guard half is what the hold is about.** After merge, a scanned PDF that previously reported success will report a 400. That is the correct behaviour, but owners will notice, and affected sources need retraining - which is exactly what the client is not ready for. Holding is reasonable.
- **The `gemini-2.5-pro` 404 half is an active production outage.** Paid tiers (PRO/BUSINESS/ENTERPRISE/BYOD) with generic, non-vertical bots are erroring on chat *right now*, and every day of hold is another day of that. Nothing about this half touches training or retraining.

If the outage matters more than the training-behaviour change, the model fix can be cherry-picked ahead of the PDF guard - they are independent edits in the same commit and would need splitting. Raised so the trade is explicit rather than implied.

Triggered by a question about which Gemini models to use for cost and quality.
The research answered that, and on the way found **two models already dead in production**, both failing silently.

## 0. What was actually broken

Neither of these surfaced an error to anyone. That is the through-line of this document.

| Model | Where | State | Consequence |
|---|---|---|---|
| `gemini-2.0-flash-lite` | PDF OCR, `main.py:8174` | **Retired 2026-06-01** | Every scanned PDF trained since June produced one junk row |
| `gemini-2.5-pro` | `MODEL_MAPPING` for PRO/BUSINESS/ENTERPRISE/BYOD | **404 "no longer available to new users"** | Generic (non-agent) chat erroring for every paid tier |

Both verified against the live API on 2026-08-13, not inferred from documentation.
The docs are wrong about the second one: `gemini-2.5-pro` is still listed as active with no shutdown date, and it 404s on a real key.
**Trust the API over the deprecation page.**

The vertical agent path was unaffected by the 2.5-pro failure, because `main.py:851` deliberately pins a flash model regardless of tier.
That is the only reason this was not a total outage for paid tenants.

### 0.1 Why the OCR failure lasted ten weeks

Three independent guards were missing, and each one alone would have caught it:

1. `main.py:8209` catches the vision exception into a bare `print`.
2. `process_pdf_efficiently` returns a sentinel `Document` marked `metadata={"extraction": "failed"}`.
3. **Nothing ever read that marker.** Confirmed by grep - it was written and consumed by nobody.

So a failed extraction was ingested as the literal sentence "Could not extract text from this PDF." and reported to the owner as a successful training.
This is the same failure shape as the Expresolv `/leadership` incident in `docs/bot-output-quality-plan.md` §1.4b, which PR #121 fixed for the *web* path with `html_extract.unusable_reason`.
The PDF path never got the equivalent.

## 1. Phase 1 - shipped

### 1.1 Model ids centralised

Every model id now lives in `core/config.py`. Previously they were string literals at 8 call sites across `main.py` and `services/session_store.py`, which is precisely how a retired model survived for ten weeks - nothing enumerated them.

| Constant | Value | Used by |
|---|---|---|
| `AUX_MODEL` | `gemini-2.5-flash-lite` | HyDE, rerank, eval judge, insight synthesis, teaser copy, session summaries |
| `OCR_MODEL` | `gemini-2.5-flash` | Scanned-PDF vision |
| `AGENT_MODEL` | `gemini-2.5-flash` | Vertical ReAct loop, tier-independent |

`AUX_MODEL` is unchanged and that is deliberate. `gemini-2.5-flash-lite` at $0.10/$0.40 per 1M is still the cheapest model Google sells, and these are short `temperature=0.0` jobs where frontier reasoning buys nothing. Moving them to a 3.x lite model would cost 3x input and 6x output for no measurable gain.

`OCR_MODEL` is deliberately **not** the cheapest option. Volume is capped at 3 pages per document, so absolute spend is negligible, and this is the only text that source will ever have - accuracy outranks the price gap.

### 1.2 Tier mapping

| Tier | Was | Now | Note |
|---|---|---|---|
| FREE, EXPLORE | `gemini-2.5-flash-lite` | unchanged | Cheapest, verified working |
| STARTER | `gemini-2.5-flash` | unchanged | |
| PRO, BUSINESS, ENTERPRISE, BYOD | `gemini-2.5-pro` | **`gemini-2.5-flash`** | The 404 fix. Also **4x cheaper** ($0.30/$2.50 vs $1.25/$10) |

**Known regression, accepted deliberately: tier differentiation by model has collapsed.** STARTER and PRO now receive the same model, and the tiers are separated only by token ceilings (`main.py:860-867`) and plan limits. There is no working "smarter" Gemini model that also returns string content - see §2. Restoring the ladder is Phase 2's main product justification, not just a cost exercise.

### 1.3 Retired ids removed from the allowlist

`VALID_MODELS` previously allowlisted `gemini-1.5-flash` and `gemini-1.5-pro`, both long retired.
An allowlisted-but-retired model passes validation and then fails at call time; a rejected one falls back to a working tier default. Removing them is strictly safer.

### 1.4 The PDF failure is now surfaced

`pdf_extraction_failed(docs)` is a named predicate next to the sentinel, and `train_chatbot` raises a 400 with an owner-facing message rather than ingesting the sentence.
Shape deliberately mirrors the web path's `unusable_reason` check at `main.py:9181`, so both extraction paths now fail the same way.

An `except HTTPException: raise` clause was added ahead of the generic handler - without it the new 400 would have been swallowed and re-raised as a 500.

### 1.5 The adapter is now pinned

`langchain-google-genai` was **unpinned** in `requirements.txt`, so Render installed whatever was latest at build time while the local venv sat at 4.2.1.
That matters more than usual here: response content shape varies across versions and model families. Pinned to `==4.3.3`, the version everything below was verified against.

### 1.6 The dropdowns, found on a second cross-check

Two owner-facing model pickers still offered models the backend does not accept. Neither was caught by the test suite, because nothing asserts the UI options against `VALID_MODELS`.

- `src/app/(app)/dashboard/settings/admin/page.tsx:59` offered **Gemini 2.5 Pro**. With 2.5-pro removed from the allowlist, selecting it makes the admin form fail validation and become unsaveable.
- `src/app/(app)/dashboard/settings/customize/page.tsx:312` offered **Gemini 2.5 Pro** and **`gemini-3.1-pro-preview`**. The latter was *never* in `VALID_MODELS`, so any owner who picked it has silently been served the tier default while the UI told them otherwise - a pre-existing bug this change surfaced rather than caused.

Both lists are trimmed to the allowlist with a comment naming `core/config.py` as the source of truth.

**Known gap, deliberately not closed here:** the sync between these dropdowns and `VALID_MODELS` is still by convention, not enforced. A test that reads the backend allowlist and asserts the frontend options match would prevent the next drift, but it needs a shared fixture across the Python and TypeScript suites, which is its own small piece of work.

### 1.7 Test gate

| Gate | Result |
|---|---|
| Backend suite | **2699 passed, 134 skipped** (baseline was 2695; +4 new tests) |
| New tests fail against old code | **Verified** by stashing `main.py` - 3 failed, then passed after restore |
| Frontend (Vitest) | **629 passed, 40 files** |
| `npx tsc --noEmit` | **0 errors** |
| `npm run lint` | **0 errors** (67 pre-existing warnings) |
| Live guardrail evals | **11/11, twice** (`RUN_LLM_EVALS=1`, real key) |
| OCR end-to-end | **Verified** - real image through the exact call shape, `content type: str` |

New regression guard: `test_no_configured_model_is_retired` asserts no known-retired id appears in `MODEL_MAPPING`, `VALID_MODELS`, or the three constants. Add ids to its set as Google retires them.

## 2. Phase 2 - Gemini 3.x, and the one thing blocking it

**The cost/intelligence case is strong and was verified live.** Every 3.x id resolves and responds fast:

| Model | Latency (short prompt) | Input / Output per 1M |
|---|---|---|
| `gemini-3.5-flash-lite` | **0.57s** | $0.30 / $2.50 |
| `gemini-3.5-flash` | **1.23s** | $1.50 / $9.00 |
| `gemini-3.6-flash` | 1.19s | $1.50 / $7.50 |
| `gemini-2.5-flash` (current) | 0.63s | $0.30 / $2.50 |

`gemini-3.5-flash-lite` costs **exactly what `gemini-2.5-flash` costs** and is substantially more capable - Artificial Analysis puts the 3.1 lite generation at Intelligence Index 34 against 2.5-flash's 21, and 3.5-flash-lite supersedes 3.1. On price alone it is a free upgrade.

An earlier concern that `gemini-3.5-flash` had a 37.8s time-to-first-token was **measured and disproved** - that figure is for high reasoning effort and does not apply here. Latency is not a blocker.

### 2.1 The blocker: content shape

**On 3.x models `response.content` is a list of content blocks. On 2.5 it is a plain string.**

```
gemini-3.5-flash-lite  -> [{'type': 'text', 'text': 'OK', 'extras': {...}}]
gemini-2.5-flash-lite  -> 'OK'
```

This is a property of the **model**, not the adapter version. Verified against `output_version` set to `v0`, `v1`, and unset: 3.x returns a list in all three. There is no compatibility switch.

**22 call sites in `main.py` and `services/` read `.content` as text.** Swapping the model without addressing this prints `[{'type': 'text', ...}]` into live visitor replies.

### 2.2 What Phase 2 actually requires

1. A normalisation helper at the model boundary - one function that flattens list-or-string content to text, applied where responses are consumed, not scattered.
2. An audit of all 22 `.content` consumers against it.
3. Re-run the live guardrail evals. Changing the chat model changes what the model says.
4. **Re-validate the response-contract thresholds.** `docs/bot-output-quality-plan.md` §2.5a tuned `leading_restatement` at a 0.90 similarity ratio against 2.5-series output. Those numbers are not transferable on inspection.
5. Decide the tier ladder: `gemini-3.5-flash-lite` for STARTER and `gemini-3.5-flash` for PRO+ restores differentiation and is cost-neutral-to-better at both levels.

This is a plan-sized piece of work with a live-traffic risk surface, which is why it did not ship alongside the outage fix.

## 3. What must not change

- `AUX_MODEL` staying on `gemini-2.5-flash-lite` unless a measurement says otherwise. The rerank call (`main.py:2679`) is the one worth A/B-ing, because it gates the top-5 that becomes the answer - but judge it with `scripts/retrieval_rank_probe.py`, not by feel.
- `gemini-embedding-001` (`core/embedding_config.py:14`). Stable, no retirement, $0.15. Changing it means re-embedding every row in `company_knowledge` and possibly altering the vector column - `core/embedding_config.py:8-11` spells out the cost. `gemini-embedding-2` exists but is preview.
- The agent's tier-independent model pin (`main.py:851`). It is why the 2.5-pro outage was not total.

## 4. Owed to the client / owner

- **Any tenant on PRO, BUSINESS, ENTERPRISE or BYOD with a generic (non-vertical) bot has had erroring chat.** Duration unknown - it depends when Google cut off 2.5-pro for this key. Worth checking error logs to size it before deciding whether to tell them.
- **Any owner who trained a scanned PDF since 2026-06-01 has a source containing one junk sentence.** Those sources need re-training after this deploys. They are identifiable: `company_knowledge` rows whose content is exactly "Could not extract text from this PDF."

## 5. Relates to

- `docs/bot-output-quality-plan.md` - §1.4b's PR #121 is the same silent-data-loss shape this fixes for the PDF path; §2.5a owns the contract thresholds Phase 2 must re-validate.
- `core/embedding_config.py` - the embedding model and its migration cost.
