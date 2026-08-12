# Bot Output Quality - Slices F to K

Date: 2026-08-12.
Branch: `feature/bot-output-quality`, off MainV2 at `f9fc4f93`.
Status: PLAN ONLY.

Continues `docs/agent-conversation-gaps-plan.md`, which owns Slices A-E from four real Expresolv transcripts.
F-K were proposed in an earlier session against live client complaints about the bot's output and were **never written to the repo**, so there was nothing to implement from.
This document claims those letters and specifies them.

## 0. Verification status - read this before trusting any row

The proposal these slices came from is not in this repo and not in this session's history, so its evidence could not be re-read.
Each slice below is marked with what was actually checked against the code and production **today**, versus what is carried over on trust and still needs its evidence restated before it is built.

| Slice | Claim | Status |
|---|---|---|
| F | FAQ feedback loop + COA leak | **VERIFIED today, in code and in prod data.** Numbers in §1. |
| G | Repeat / deny-then-answer guard | **Partly on record.** §13.4 of the gaps plan names "deny-then-answer" as unaddressed. The claim "prompt-only has failed twice" is carried on trust. |
| H | `top_k` for entity lookups | **On record.** Gaps plan §13.6, explicitly deferred "until §13.1 alone is measured against real traffic". That measurement is still owed and is a precondition, not a formality. |
| I | Extraction hardening | **Unverified.** No testimonial/carousel finding exists in any plan doc. Needs a real contaminated page named before building. |
| J | Trailing question on informational turns | **Unverified.** No record. |
| K | Contact acknowledgment bound to real capture | **Contradicted, partly.** Gaps plan §4.4 bullet 2 says the acknowledgment sentence already shipped in `build_agent_directive`. The remaining defect - that it fires without a capture actually happening - is plausible but unconfirmed. |

Do not treat this table as pessimism about the earlier analysis.
Treat it as the reason F is first: it is the one that could be checked, and checking it found it worse than claimed.

---

## 1. Slice F - cut the FAQ feedback loop. Highest priority.

### 1.1 The loop, confirmed in code

1. The bot answers a visitor. The turn is written to `chat_logs`.
2. `GET /api/bots/{bot_id}/faqs` (`main.py:10182`) aggregates the top 10 answered Q&A pairs and the loader injects them into the merchant's `<head>` as `FAQPage` JSON-LD.
3. The owner re-trains on their own site.
4. `html_extract._collect_jsonld` (`services/html_extract.py:253`) ingests **every** JSON-LD `@type` with no filter - `_JSONLD_SKIP_KEYS` filters keys, never types - so `FAQPage` is ingested as source knowledge.
5. The bot's own prior answers are now knowledge. The next answer is grounded in the previous answer rather than in the customer's data.

For a product whose entire promise is "answers come only from your data", this is the most direct possible violation: the bot becomes its own source, and any error becomes self-confirming and permanent.

### 1.2 What production says, measured 2026-08-12, last 90 days

| | count |
|---|---|
| Q&A pairs eligible for publication (`is_unanswered = false`, answer >= 80 chars) | **630** |
| Of those, COA-related | **8** |
| Of those, refusals published as answers ("I don't have", "not on file", ...) | **79** |

Two separate defects fall out of this.

**The eligibility gate is the wrong signal.** `is_unanswered` is audit finding D3 - it was computed from retrieval count and English substring matching, so a refusal routinely scored as answered. 79 of 630, **12.5% of the publishable pool, is the bot's own failure text**, queued to be published as the merchant's SEO content and fed back as knowledge.
The restructure that merged today replaced this signal with `chat_logs.turn_state`, so **new** rows are trustworthy. Historical rows are not, and the FAQ query still reads `is_unanswered`.

**COA content is publishable.** `memory/coa-confidential-access.md` records the client reclassifying certificates as confidential, with exact-retrieval-or-nothing and a uniform refusal. 8 eligible rows mention COAs. This endpoint intentionally does not enforce `Origin` because it is meant to be crawlable, so anything it emits is public to Googlebot and everyone else.

### 1.3 The fix

Three independent changes, smallest first.

**F1 - Stop ingesting our own schema.** `_collect_jsonld` skips `FAQPage` and `Question`/`Answer` types. One filter, and it closes the loop at the ingestion end even if everything else stays as it is. Ship this first; it is the smallest change with the largest effect.

**F2 - Gate the feed on a real answer signal.** Replace `is_unanswered = false` with `turn_state = 'ANSWERED'`, and exclude rows where `turn_state IS NULL` - which is every row written before today's merge - rather than trusting them. The pool shrinks; that is correct, not a regression.

**F3 - Never publish a restricted class.** Exclude any turn whose `sources` records a COA tool result, and any turn from a company with a COA folder configured where the question matches the COA vocabulary. Belt and braces, because the cost of being wrong is a confidentiality breach for a client who explicitly asked for the opposite.

**F4 - Purge.** Identify `company_knowledge` rows ingested from our own FAQPage markup and delete them. Detection: rows whose content matches the shape `_flatten_entity` produces for `FAQPage`/`Question`. Needs a dry-run count first, per company, reported before anything is deleted.

### 1.4 Acceptance

- A page carrying our own FAQPage JSON-LD ingests zero chunks from it.
- A refusal turn is never eligible for the feed.
- A COA turn is never eligible for the feed.
- The purge dry-run reports per-company counts, and the delete runs only after those are reviewed.

---

## 2. Slice G - deterministic anti-repeat guard

The instruction already exists in three places and the symptom persists, which is the standard signal that a prompt rule is the wrong layer.
Audit A5 counted "do not restate your previous answer" appearing four times across RULE 2, RULE 6 and the agent directive, each added by a real incident.

Post-process instead: compare the composed reply against the previous assistant message before it ships.
The natural home is `services/agent_runtime/compose.py`'s `settle()`, which is already the single place a turn's outcome is decided.

Two shapes to detect:

- **Repeat** - high similarity to the previous assistant message. The turn produced nothing new, so say that plainly rather than re-sending.
- **Deny-then-answer** - the reply opens with a refusal and then answers anyway (gaps plan §13.4). The refusal is the lie; the answer is real. Drop the opener.

Needs a threshold, and a threshold needs data. Run it in shadow first, logging what it *would* have rewritten, then turn it on. Do not pick a similarity number in the plan and defend it later.

---

## 3. Slice H - retrieval recall for entity lookups

Gaps plan §13.6, deferred with a specific instruction: measure §13.1 alone against real traffic first, and do not spend the tokens if it is unnecessary.

**That measurement is the first task of this slice, not a formality.** `chat_logs.sources` has been recording retrieved chunks since Slice D, so the question "did the right chunk get retrieved and ranked below 5" is now answerable from stored data rather than by replaying traffic.

If the answer is that the right chunk was retrieved but ranked 6-10, raise `top_k` for entity lookups only, gated on the existing `_is_entity_lookup_query`.
If the right chunk was never retrieved at all, `top_k` cannot help and this slice is the wrong fix - the answer is audit E1/E3 (structured directory, identifier retrieval).

---

## 4. Slices I, J, K - specify before building

**I - extraction hardening.** Needs a real client URL whose extraction is contaminated by testimonials, carousels or boilerplate. `html_extract` already has boilerplate dedup (`_finalise`), so the claim is that it is insufficient, not absent. Name the page, measure what it currently emits, then decide.

**J - trailing question on informational turns.** Gate the funnel directive the way the qualification block is already gated. Small, but confirm the symptom against a real transcript first - the restructure changed what gets appended to a reply, so the earlier observation may already be stale.

**K - contact acknowledgment.** Gaps plan §4.4 records the acknowledgment sentence as shipped. The remaining question is whether it fires when no capture happened. `services/agent_runtime/contact.py` owns `_captured_contact_echo`; check whether the directive can produce the sentence independently of it. If it can, bind the two.

---

## 5. Order

F1 -> F2 -> F3 -> F4, then G (shadow first), then H (measure first).
I, J, K after their evidence is restated.

F is first because it is the only one verified as actively causing harm, it is corrupting the knowledge base continuously rather than at a point in time, and F1 alone is a few lines.

## 6. Relates to

- `docs/agent-conversation-gaps-plan.md` - Slices A-E, and the §13.4 / §13.6 items G and H come from.
- `docs/audit-agent-behaviour.md` - D3 is why F's eligibility gate is broken.
- `docs/coa-confidential-access-plan.md` - the confidentiality standard F3 must not violate.
- `docs/agent-runtime-restructure-plan.md` - `turn_state` (F2's replacement signal) and `compose.settle()` (G's home) both come from it.
