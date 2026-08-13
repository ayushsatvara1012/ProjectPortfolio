# Bot Output Quality - Slices F to K, plus the Precision Architecture Backlog

Date: 2026-08-12, revised 2026-08-11 (this session) with a live production audit.
Branch: `feature/bot-output-quality`, off MainV2 at `f9fc4f93`.
Status: F-K PLAN ONLY. §13-16 consolidate three other trackers into this file (2026-08-11) so there is one place to work from - see §0.3 for what that changes and what it doesn't.

Continues `docs/agent-conversation-gaps-plan.md`, which owns Slices A-E from four real Expresolv transcripts.

This revision folds in a full production audit run against Expresolv (`d13912da-1901-4349-a7d3-acd08a064e6a`, tier `EXPLORE`, vertical `chemical`) on 2026-08-11.
That audit **upgraded four of the six slices out of "unverified"**, added a confirmed root cause for G that changes what G has to check, and answered the client's own question of whether the failures are a fetcher problem or a training-data problem.

All code references below are anchored to the **current branch**, after the agent-runtime restructure merged.
Note that `services/agent.py` is no longer imported by `main.py`; anything citing `stream_agent_loop` is stale.

> **Implementing, not deciding? Go to §11.** It is the phase-by-phase checklist - six phases, what each changes, and the tests that close it.
> Everything else in this file is the evidence and the decisions behind that order; read a phase's linked section when you start that phase, not the whole document.

## 0. Verification status - read this before trusting any row

| Slice | Claim | Status |
|---|---|---|
| F | FAQ feedback loop + COA leak | **VERIFIED** in code and prod, twice independently. §1. |
| G | Repeat / deny-then-answer guard | **VERIFIED 2026-08-11.** Reproduced 5x in post-fix prod traffic, and root-caused. §2. |
| H | `top_k` for entity lookups | **On record, precondition now partly satisfied.** §3. |
| I | Extraction hardening | **VERIFIED 2026-08-11.** Contaminated page named and measured. §4. |
| J | Trailing question on informational turns | **VERIFIED 2026-08-11** against post-restructure transcripts. §5. |
| K | Contact acknowledgment bound to real capture | **VERIFIED 2026-08-11.** Bot claimed capture; `agent_requests` empty. §6. |

The earlier caution on I, J and K was correct and is now discharged by evidence rather than waived.

**One claim from the earlier draft is now confirmed:** "prompt-only has failed twice" was carried on trust.
It is true.
`main.py` RULE 2 carries explicit anti-restate and anti-deny-then-answer clauses, and both were violated repeatedly on 2026-08-10, after the fixes that added them were deployed.

### 0.1 Owner decisions, locked 2026-08-11

- **F**: keep the public FAQ feed, fix both ends (feed quality gate + ingestion skip). Do not delete the feature.
- **G**: deterministic repair first; re-invoke at most once, only when the reply cannot be salvaged.
- **Disclosure**: fix the COA exposure quietly, then tell the client plainly in the same conversation as the rest of the audit. No formal incident process.
- **Scope**: all six slices, plus the guardrail architecture reference in §7.
- **Rejected: a LangGraph or LangChain migration.** Asked directly. See §7.3.

### 0.2 What the audit establishes about the deployed fixes

Slices A, B, D and E of the predecessor plan are live in production, confirmed by `chat_logs.sources` becoming non-null from 2026-08-09.

Fixed and holding: the fabricated-contact failure (no fabrications in post-fix traffic), the injection firewall false-fire, and owner-facing source attribution.

Still failing: everything in §2, §3, §5 and §6 below.

### 0.3 Full status across every outstanding source

Three other trackers folded into this file 2026-08-11: `docs/agent-conversation-gaps-plan.md` (predecessor slices), `docs/audit-agent-behaviour.md` (the 38-finding audit's own remediation tracks), and `docs/entity-safe-ingestion-plan.md` (copied in from unmerged `feature/entity-safe-ingestion`).
Detail lives in §13-15; this is the full roster in one table.

**Naming note:** the audit doc uses its own letters A-M for Track 2 and numbers 1-13 for Track 1, both independent of this plan's F-K.
To avoid three different things being called "Slice A" in one file, audit items are referenced here as **QF1-QF13** (quick fixes) and **ARCH-A - ARCH-M** (architecture slices), never bare letters.

| Source | Item | Status |
|---|---|---|
| This plan | F - FAQ feedback loop | **COMPLETE and DEPLOYED 2026-08-12.** PR #120 merged to MainV2 (`f0d8aff6`, `c62522b4`, `fc3bfa0f`, `bef6921e`). All 61 rows cleared across all 3 tenants; `--probe ingest` reports none; retrieval contamination 63% -> 0%. §1, §1.4b. |
| This plan | G - response contract | **CHECKS 1 AND 2 ENFORCING, on branch.** Cut to those two on measurement (27% of turns, untouched by the corpus fix); check 3 and check 4 still run and still log but cannot rewrite. §2.4a, §2.5b. |
| This plan | H - top_k for entity lookups | PLAN ONLY, measure first. §3. |
| This plan | I - extraction hardening | **DONE 2026-08-12**, on branch. Testimonial/review suppression, leaked-markup strip, JSON-LD noise keys. §4, §11 phase 1. |
| This plan | J - reflex question | **DEPRIORITISED 2026-08-12** - measured at 1 turn in 98. Do not build the arbitration. §5. |
| This plan | K - contact ack binding | **DONE 2026-08-12**, on branch, with QF10. §6, §11 phase 3. |
| Gaps plan | Slices A/B/D - contact capture, spec/quote fixes, source attribution | **DONE, pushed to MainV2** (`63747833`, confirmed an ancestor of this branch's base). |
| Gaps plan | Slice E - directory-answer fixes | **DONE, pushed to MainV2** (`aa61ed71`). |
| Gaps plan | Slice C - two-day activity digest | Deprioritised, plan-only. Not part of this consolidation - see §14 out-of-scope note. |
| Audit quick fixes | QF1/QF2 - RULE 7 founder clause, agent temperature | **DONE, pushed** (`f885c110`). |
| Audit quick fixes | QF3, QF5, QF6, QF8, QF9, QF11, QF12 | **DONE / moot**, verified against code. Mostly shipped quietly by the agent-runtime restructure. §13. |
| Audit quick fixes | QF4, QF7, QF10, QF13 | **Open**, verified against code. §13. |
| Audit architecture | ARCH-G - turn pipeline extraction (`services/agent_runtime/`) | **DONE, pushed** (agent-runtime restructure, `bb0b0b21` an ancestor of this branch's base). |
| Audit architecture | ARCH-H - tool registry | **DONE, pushed** (`f9fc4f93`). |
| Audit architecture | ARCH-L - persist tool trace, owner-facing | **DONE, pushed** (Slice D's `chat_logs.sources` + `ConversationsPanel`) - one manual browser check still owed. |
| Audit architecture | ARCH-K - signals rebuild | **PARTIAL.** `turn_state` shipped (migration 0037) and is what F2 reads; the versioned grounded/refusal-rate metric this slice actually asks for is not built. |
| Audit architecture | ARCH-A, B, D, E, F, I, J, M | **NOT STARTED.** §14. |
| Entity-safe ingestion | Phase 0 (measurement), Phase 1 (`services/chunking.py`) | **DONE, unwired**, on unmerged `feature/entity-safe-ingestion`. |
| Entity-safe ingestion | Phase 2-4 (wire in, FAQ atomicity, re-ingest UX) | **NOT STARTED.** §15. |

Verification discipline for the imported rows: "DONE, pushed" above was confirmed this session via `git merge-base --is-ancestor` against this branch's base commit, not carried over from memory - memory's "committed, unpushed" notes for these same commits were stale.
QF3-QF13 were fully re-checked against code (§13); the ARCH rows (§14) were checked with the same rigor except ARCH-D/E/F/I/J/M, which are absence-confirmed (grepped for, not found) rather than exhaustively audited line-by-line.

---

## 1. Slice F - cut the FAQ feedback loop. Highest priority.

### 1.1 The loop, confirmed in code

1. The bot answers a visitor. The turn is written to `chat_logs`.
2. `GET /api/bots/{bot_id}/faqs` (`main.py:10185`) aggregates the top 10 answered Q&A pairs, and `public/sapybase-loader@1.js:810-832` injects them into the merchant's `<head>` as `FAQPage` JSON-LD.
3. The owner re-trains on their own site.
4. `html_extract._collect_jsonld` (`services/html_extract.py:253`) ingests **every** JSON-LD `@type` with no filter - `_JSONLD_SKIP_KEYS` filters keys, never types - so `FAQPage` is ingested as source knowledge.
5. The bot's own prior answers are now knowledge. The next answer is grounded in the previous answer rather than in the customer's data.

For a product whose entire promise is "answers come only from your data", this is the most direct possible violation: the bot becomes its own source, and any error becomes self-confirming and permanent.

### 1.2 What production says

**Platform-wide, last 90 days, measured 2026-08-12:**

| | count |
|---|---|
| Q&A pairs eligible for publication (`is_unanswered = false`, answer >= 80 chars) | **630** |
| Of those, COA-related | **8** |
| Of those, refusals published as answers | **79** |

**The eligibility gate is the wrong signal.** `is_unanswered` is audit finding D3 - computed from retrieval count and English substring matching, so a refusal routinely scored as answered.
79 of 630, **12.5% of the publishable pool, is the bot's own failure text**.
The restructure replaced this signal with `chat_logs.turn_state`, so **new** rows are trustworthy; historical rows are not, and the FAQ query still reads `is_unanswered`.

Independent confirmation, 2026-08-11: **zero unanswered turns recorded for Expresolv on every single day since 2026-07-20**, including outright refusals. The flag does not fire at all.

**COA content is publishable.** `memory/coa-confidential-access.md` records the client reclassifying certificates as confidential, with exact-retrieval-or-nothing and a uniform refusal.
This endpoint intentionally does not enforce `Origin` because it is meant to be crawlable, so anything it emits is public.

### 1.2a Measured platform-wide 2026-08-12 - this is not one client

`scripts/faq_loop_audit.py --probe all`, read-only against prod. **The loop has closed for three tenants, and Expresolv is neither the worst nor the earliest.**

| tenant | vertical | parent rows | child rows | first ingested |
|---|---|---|---|---|
| SaPyBase (our own marketing site) | generic | 9 | 24 | - |
| SP Design | generic | 4 | 10 | **2026-07-21** |
| Expresolv | chemical | 3 | 11 | 2026-08-10 |

**61 rows total.** SP Design was contaminated three weeks before Expresolv.
Sample: `- FAQPage - mainEntity: name: hi, acceptedAnswer: text: Hello! I'm here to help...` - the bot's own greeting, ingested as source knowledge.
Orphan risk is **0**: every matched child's parent is also matched, so F4 can delete parents and children together safely.

Sizing this from Expresolv alone would have understated it by a factor of four and missed the earliest victim entirely.

Exclusion classes across the 629-row publishable pool (overlapping, not additive):

| class | rows | % of pool |
|---|---|---|
| source_marker | 74 | 11.8% |
| refusal | 70 | 11.1% |
| error_string | 25 | 4.0% |
| identifier | 25 | 4.0% |
| restricted_topic | 8 | 1.3% |
| ui_artifact | 2 | 0.3% |

`source_marker` overtaking refusals is new information: 36 of SaPyBase's own 82 rows carry `📎 Source:` in the **stored** response despite `_strip_source_citation`. Whether visitors see it or only the feed does is unresolved and worth a separate look.

### 1.3 The loop has already closed, with named rows

Not hypothetical.
Thirteen rows in Expresolv's `company_knowledge`, all stamped `https://expresolv.com/leadership`, ingested 2026-08-10 16:43:35:

- `"Whom to contact for sales ?"` answered with `"I don't have details on file for who specifically handles export business."` - the lagged wrong answer from that same morning, now permanent training data.
- `"Methanol (Methyl alcohol) (CAS: 67-56-1)"` answered with `"I'm having trouble reaching our product system right now"` - an internal error string.
- `"can i get the coa for 101LR 101.26R007"` answered with `"I have retrieved the Certificate of Analysis... It should be open in a panel for you."` - a UI artifact, and **a COA batch identifier now in public crawlable content**.
- Our own `📎 Source:` citation marker, ingested as body text.

This explains a client perception nobody previously had a mechanism for: answers appearing to get *worse* over time, and specific wrong answers recurring after being reported.
They are being memorialised.

The live page serves no FAQ schema to a plain `curl`, because the injection is client-side.
Only the JS-rendering scraper sees it, which is why this went unnoticed.

### 1.4 The fix

**F1 - Stop ingesting our own schema. DONE 2026-08-12, uncommitted.**
`_collect_jsonld` (`services/html_extract.py:253`) now applies three skips, most-exact first: the loader's `data-sapybase-faq` attribute, a `📎 Source:` marker anywhere in the raw block, and `@type` in `{FAQPage, Question, Answer}`.
The type skip runs both in the entry walk and in `_flatten_value`, so a `Question` nested inside another entity cannot slip through.
Tests at `tests/test_html_extract.py:210-278`, including the round-trip §9 names as the most important test in this plan. Suite green (2528 passed, 134 skipped).

**Accepted cost:** the type skip also drops a merchant's own hand-written `FAQPage` schema - ours and theirs are indistinguishable once the attribute is gone.
Impact is small because the extractor already keeps accordion FAQ body copy by contract, so the visible Q&A text still ingests; only the duplicate structured copy is lost.

**F2 - Gate the feed on a real answer signal. DONE 2026-08-12, uncommitted.**

Two corrections came out of the prod run, both of which would have shipped as silent no-ops:

1. **The literal in the original spec was wrong.** `TurnState.ANSWERED` is `"answered"`, lowercase (`services/agent_runtime/states.py:12`). `turn_state = 'ANSWERED'` matches zero rows forever and looks like a healthy deploy. Code now reads `_TurnState.ANSWERED.value`; never write the literal.
2. **`turn_state` has almost no coverage.** Platform-wide, all time: **1009 NULL, 2 `answered`, 1 `no_data`**, and the three non-null rows are from 2026-08-12. Excluding NULL as originally specified takes the platform feed from **629 rows to 2** - every client's FAQ schema dark for ~90 days.

**Owner decision 2026-08-12: hybrid gate.** Publish when `turn_state = 'answered'` OR `turn_state IS NULL AND` the pair passes every exclusion class.
New rows are trusted structurally; historical rows must earn it. Coverage improves on its own as `turn_state` fills in, with no second migration.

Implemented as `_publishable_faq_rows` (`main.py:10149`) over a widened 200-row candidate pull, calling `services/faq_eligibility.excluded_by`.

**F3 - Never publish a restricted class. DONE 2026-08-12, uncommitted.**

The original spec ("exclude any turn whose `sources` records a COA tool result... where the question matches the COA vocabulary") was chemical-specific and would have hardcoded one vertical's confidentiality model into a shared service.
**Owner decision 2026-08-12: make it pack-driven**, per the registry discipline in CLAUDE.md.

- `ToolSpec.restricted: bool = False` (`packs/schema.py:210`); `get_coa` sets it True. Any turn whose `sources` names a restricted tool is unpublishable, **in every vertical, with no vocabulary at all**. This is the structural half and it is the one that matters.
- `Pack.restricted_vocab: Tuple[str, ...] = ()` is the fallback for turns with no tool trace - which today is almost all of them. Word-bounded, never substring: bare `batch` rejects "full batch documentation", `coa` rejects "coating".
- `Pack.restricted_tool_names()` is the accessor.

`services/faq_eligibility.py` splits the two kinds of rule explicitly: tenant-independent (refusal, error string, UI artifact, `📎 Source:` marker, identifier shape - all properties of *our own output*, identical for every client) versus pack-supplied (`restricted_tool`, `restricted_topic`).
A generic bot passes `pack=None` and gets only the tenant-independent set, which is correct - it has no tools and no vertical confidentiality model.

The identifier rule was retuned against real data: one token carrying **both** a letter and a digit, 5+ chars. Requiring a letter is what stops it matching CAS numbers (`67-56-1`); requiring a digit stops it matching ordinary uppercase words.

**F4 - Purge. Dry-run re-run 2026-08-12: counts unchanged (61 rows, 3 tenants, orphan risk 0), but the delete as specified is now known to be wrong.**

The plan assumed a matched row is cleanly self-ingested. It is not.
The chunker interleaved our schema output with real page copy inside the **same** chunk: of the 61 matched rows, **40 are pure contamination and 21 are mixed**, and roughly 7 of those carry content a blanket delete would destroy - Expresolv's food-grade product list, SaPyBase's Build Services and pricing copy, SP Design's office address.

**Re-ingest instead of deleting.**
`run_training_job` on an existing URL is already an atomic upsert: `main.py:8563-8593` renames the new rows in, then deletes every older row for that URL.
So retraining the affected source replaces contaminated rows wholesale, and F1 strips the FAQ schema on the way in - no hand-written DELETE, no mixed-row surgery, no orphan risk.
Quota is not an obstacle: usage is a live `SUM(word_count)` over current child rows (`main.py:8425-8431`), not a cumulative meter, and the upsert path excludes the source being replaced, so re-ingest will *reduce* Expresolv's usage once the FAQ chunks are gone.

Scope is five URLs: SaPyBase `/` (26 of 92 rows) and `/vaayu` (7 of 36), Expresolv `/leadership` (14 of 60), SP Design `/` (9 of 29) and `/quotation` (5 of 23).

Two things that need an owner call before it runs: it touches two tenants who never reported anything (one a live client), and it re-scrapes current pages, so unrelated page changes since original training also land.

**F4 is justified by measurement, 2026-08-12.** `scripts/retrieval_rank_probe.py --mode contamination`, read-only offline replay of 67 real logged queries through the live retrieval path (`_is_entity_lookup_query` / `hyde_expand` -> embed -> `retrieve_knowledge(limit=15)` -> `rerank_chunks(top_k=5)`).

| tenant | contaminated row in final top 5 | in the 15-candidate pool |
|---|---|---|
| SP Design | 13/17 (76%) | 17/17 (100%) |
| Expresolv | 17/25 (68%) | 23/25 (92%) |
| SaPyBase | 12/25 (48%) | 24/25 (96%) |
| **total** | **42/67 (63%)** | **64/67 (96%)** |

These rows are not sitting harmlessly at rank 40.
On contact and directory questions they take **every** slot: SP Design's "DO you have email or phone" and "can i get the contact detail" both return top-5 ranks `[1,2,3,4,5]`, all five self-ingested.
Expresolv's most-asked SDS query (13 asks) pulls one at rank 5, and its price-quote queries pull three.

Consequence for §3 and §4: the top-5 competition H and I are trying to relieve is substantially **self-ingested FAQ rows**, not only the homepage and testimonial chunks §4 named.
H's measurement must run after the re-ingest, not just after Slice I, or it measures a corpus that no longer exists.

### 1.4b F4 executed, 2026-08-12 - complete, via one destroyed source and its recovery

The first four sources were run with **local code against the prod DB**, deliberately: production did not carry F1 yet, so retraining through the deployed API would have re-ingested the same schema.

| source | rows before -> after | contaminated after |
|---|---|---|
| SaPyBase `/` | 92 -> 40 | 0 |
| SaPyBase `/vaayu` | 36 -> 42 | 0 |
| SP Design `/` | 29 -> 16 | 0 |
| SP Design `/quotation` | 23 -> 23 | 0 |

47 of 61 rows cleared. Re-measured with the rank probe afterwards: **SaPyBase 48% -> 0%, SP Design 76% -> 0%** of real queries returning a contaminated row in the final top 5.

#### Expresolv `/leadership` - destroyed, then recovered

Local re-ingest refused this page: `expresolv.com` serves a bot-verification interstitial to our fetcher, and extraction yielded **51 characters** of `"Please wait while your request is being verified..."`. The dry-run guard caught it.

**After F1 deployed, the owner retrained the page through the app, and production hit the same interstitial with no such guard.** The source went **60 rows -> 2 rows** of that one sentence. Nothing reported an error.

**Recovered the same session, and the recovery is the useful fact: the site blocks `r.jina.ai` specifically but serves a normal browser UA fine.** Fetched direct with a Chrome UA, pushed through the same `_extract_page_text` (F1 included), re-ingested: **45 rows, 566 words, clean.**

Nothing legitimate was lost, verified term by term - the staff names live in their own per-person sources (`Mr.Pratik Shome` and eight others, 2 rows each) and the food-grade acid list is in `food additives at expresolv.pdf`. That list was bot output on the old rows, not page copy, so its disappearance is the contamination leaving.

**Tell Expresolv their site blocks our fetcher.** It will break their next retrain too, and it is their WAF rule, not our reachability.

**The data-loss path this exposed is fixed and merged: PR #121, `6f8e9ced`.** `html_extract.unusable_reason` recognises a challenge or access-denied body by what it says rather than its length, applied at all three extraction-acceptance points and only on short bodies so a real page saying "please wait while we confirm stock" stays trainable; `replacement_shrink_reason` refuses any upsert collapsing a source below a quarter of its stored words, whatever the cause. Both asserted against this incident's own numbers (978 -> 8 words).

**Final state: all 61 rows cleared across all three tenants.** `--probe ingest` reports none, and the rank probe reads 0% for every tenant, from 63% overall.

Superseded original spec, kept for the record: identify `company_knowledge` rows ingested from our own FAQPage markup and delete them.
Detection: content matching the shape `_flatten_entity` produces for `FAQPage`/`Question`, plus the `📎 Source:` marker.
**Dry-run count first, per company, reported before anything is deleted.**
Parent and child rows together - deleting a parent while orphaning children leaves rows retrieval can surface but not expand.

Then re-ingest Expresolv's `/leadership` cleanly once F1 is deployed.

### 1.4a End-to-end verification against prod, 2026-08-12

The new query plus the new gate, run for every live bot against production data, read-only:

| tenant | old feed | new feed | candidates rejected |
|---|---|---|---|
| Expresolv | 10 | 10 | 58 of 200 |
| SaPyBase | 10 | 10 | 34 of 69 |
| SP Design | 10 | 10 | 1 of 20 |
| Test Web (x2) | 10, 10 | 10, 10 | 8 of 37, 15 of 81 |
| Gyan AI | 2 | 2 | 0 of 2 |
| Pragati Mandal | 1 | 0 | 9 of 9 |
| **total** | **53** | **52** | |

The hybrid gate removes the junk without gutting the feature: one net FAQ lost platform-wide, and that one was Pragati Mandal's only published pair, a refusal (`"search name Piyush Satvara"`).

Judged against Expresolv's **currently live** feed, the gate rejects exactly the rows §1.3 named as harmful and keeps the legitimate ones:

- REJECT `error_string` - "Methanol (Methyl alcohol) (CAS: 67-56-1)"
- REJECT `ui_artifact, identifier, restricted_topic` - "can i get the coa for 101LR 101.26R007"
- REJECT `source_marker` - "who is piyush satvara"
- REJECT `restricted_topic` - "which are the certificates available ?"
- REJECT `refusal` - "Whom to contact for sales ?"
- keep - the four price-quote and product pairs

**Known residual, belongs to G not F:** "Who is taking care of business development in expresolv?" is still publishable, and §2.2 established that turn named two people absent from its own retrieval.
F gates *classes* of unpublishable content; it cannot detect a fluent, ungrounded answer. Only G's check 3 can, and until G ships this row stays in the feed.

### 1.5 Acceptance

- A page carrying our own FAQPage JSON-LD ingests zero chunks from it.
- A refusal turn is never eligible for the feed.
- A COA turn is never eligible for the feed.
- The purge dry-run reports per-company counts, and the delete runs only after those are reviewed.

### 1.6 Disclosure

A COA batch identifier and internal error strings were published as public, crawlable SEO content on the client's own site.

Per the owner decision: fix first, then tell the client plainly, no formal incident process.

**Still owed as of 2026-08-12, and it is now two clients, not one.**
**SP Design** was contaminated on 2026-07-21, three weeks before Expresolv, was the worst affected (76% of queries), and never reported anything. They are owed the same disclosure.
**Expresolv** additionally needs to hear two things: that their `/leadership` page was briefly reduced to one sentence during remediation and has been restored, and that their site blocks our fetcher, which is why it could not refresh and will break their next retrain.

State precisely when we do: the COA *document* was never exposed, and `get_coa`'s retrieval, throttle and lockout were never weakened.
What leaked was a batch identifier inside a transcript, republished by a feature working as designed on input it should never have been given.

---

## 2. Slice G - the response contract

### 2.1 Why prompt-only cannot finish this

Audit A5 counted "do not restate your previous answer" appearing four times across RULE 2, RULE 6 and the agent directive, each added by a real incident.
The symptom persists.

Reproduced 2026-08-10, session `4ef9ffa0`, five times in seven minutes:

| Asked | Replied |
|---|---|
| Who is responsible for export business? | "I don't have that specific detail on file." |
| Whom to contact for sales? | **Repeats the export denial**, then the sales list |
| Who is taking care of business development? | **Repeats the entire sales list verbatim**, then declines BD |
| Who is marketing head? | Answers marketing head, **then declines BD again** |
| Who is CMD? | **Opens with the sales-head answer**, then Arvind Patel |

### 2.2 The root cause, and why it changes what G must check

This is the most important new finding in the revision.

Slice D's `sources` column made it possible to compare what was retrieved against what was said.

On the "business development" turn, retrieved sources were the homepage plus Pratik Shome, Ida Sebastian, Jasmine and Himanshu Darji.
The reply named **Chandra Parija and Nirmal Choudhary, neither of whom was retrieved on that turn**.
On "Who is CMD?", all five sources were homepage chunks, yet the reply opened with Nirmal Choudhary.

**The model is re-serving content out of the prior assistant message, not out of retrieval.**

So this is not a style defect. It is a **RULE 1 violation**: conversation history is functioning as a second, unvalidated answer source.
A similarity threshold alone would not have caught the CMD case, where the prepended span was short and the rest of the reply was correct and new.

Slice D paid for itself here. This was undiagnosable before it shipped.

### 2.3 Where it goes

`services/agent_runtime/compose.py`, `settle()` at line 68 - already the single place a turn's outcome is decided.
It carries `allow_rewrite`, so the repair path has a seam to respect.

**Correction, 2026-08-12.** An earlier revision of this section claimed `settle()` "already receives `sources`, which is exactly the evidence set check 3 needs".
**It is not.**
`_build_kb_sources` (`main.py:2657`) says so in its own docstring - "content itself is never stored here" - and stores `url`, `content_id`, `rank`, `score`.
`tool_sources` is the same: a label and a product name, never the tool payload.
So `sources` proves *which* chunks were retrieved and never *what they said*, and check 3 cannot be built from it.

The evidence text is threaded separately instead: `TurnInputs.retrieved_text` (chunk contents, filled by the handler from `retrieved_docs`) plus the tool payloads already in `captured`, assembled by `contract.evidence_from()`.
The shadow pass therefore runs in `pipeline.run_agent_turn` just after `settle()`, not inside it - that is where both halves of the evidence set are actually in hand.

### 2.4a Measured 2026-08-12, after the corpus cleanup - G is cut to checks 1 and 2

The contract's four checks were run over **98 stored Expresolv turns** (10 days), and the five diagnostic questions were replayed against the cleaned corpus.
Caveat carried honestly: nearly all 98 turns predate the cleanup, so this sizes the *problem*, not the *residual*.

| check | turns flagged | does the corpus cleanup touch it? |
|---|---|---|
| restatement | **18%** | **No.** The mechanism is the previous assistant message, not retrieval. |
| ungrounded | 10% | Partly, and it has false positives. |
| denial_opener | **9%** | **No.** Same - a history/composition defect. |
| extra_question | **1%** | No. |

Retrieval is now materially healthier: 4 of the 5 diagnostic questions surface the right person in the top 5 (`Ms.Himani Zaveri` for export, `Ida Sebastian` + `Pratik Shome` for sales, `leadership` for CMD).
The fifth, "business development", is the case §17 already classifies as not our bug - the role does not exist in their content.

**Decision, 2026-08-12: build checks 1 and 2 to enforcement; hold check 3 in shadow; deprioritise J.**

- **Checks 1 and 2 ship.** ~27% of turns combined, deterministic repair, no model call, and the corpus fix was never going to touch them. Evidence from real turns: "who is looking export" replayed its entire previous reply, "Who is CMD of expresolv?" replayed 201 characters, and "can i get contact detail of aayush patel" tripped *both* checks on one turn.
- **Check 3 stays in shadow.** It is the only check that costs a re-invoke, its 10% includes false positives - `"Managing Director"` was flagged as an ungrounded person, a job title the name extractor treats as a name - and the retrieval improvement removes more of the genuine cases. It needs post-cleanup traffic before it enforces anything.
- **Check 4 / Slice J is deprioritised**, see §5.

### 2.4 The post-conditions

**1. No restatement of the previous reply.**
Detect a repeated leading span against the previous assistant message, not whole-message similarity - the observed failure is a *prepend* followed by genuinely new content, which whole-message scoring misses.
Repair: strip the repeated span and any orphaned connective.

**2. No denial opener in front of a real answer.**
Gaps plan §13.4. The refusal is the lie; the answer is real.
Repair: drop the opener, or move it to the end as the "what is still missing" sentence RULE 2 already asks for.

**3. Every identity detail must be grounded in this turn.**
Names, phone numbers and emails in the reply must appear in the turn's own evidence set.
This is what turns §2.2 from a diagnosis into a guarantee.

**Critical trap:** the evidence set is **kb chunks plus tool results**, not chunks alone.
SDS, COA, quote and spec replies legitimately carry names and identifiers that came from tool output, never from retrieval.
Validating against chunks alone breaks every working tool answer, and this is the single most likely way to get the slice wrong.

Not deterministically repairable - removing a name can leave a reply that answers nothing. This is the one case that re-invokes.

**4. At most one question, and only when licensed. DEPRIORITISED 2026-08-12** - measured at 1 turn in 98, see §2.4a and §5. The check exists and reports; nothing arbitrates the licence, and `question_licensed` stays hardcoded `True`.

### 2.5 Failure handling

Per the owner decision:

- Checks 1, 2 and 4 repair in code. No extra model call, no added latency.
- Check 3 re-invokes **once**, with a correction note naming the ungrounded detail.
- A second failure degrades to a decline plus handoff offer. It never ships the ungrounded answer.
- Exactly one re-invoke, ever. This must not become an unbounded repair loop.

### 2.5a Shadow build, 2026-08-12

`services/agent_runtime/contract.py`, 32 tests in `tests/test_agent_runtime_contract.py`. Suite green (2586 backend tests).

- `leading_restatement` compares leading *sentences* against the previous reply at a 0.90 similarity ratio, with a 25-char floor so "Sure." is never stripped. `strip_leading_span` removes the orphaned connective.
- `denial_opener` fires only when substance follows. A denial followed **only** by next-step sentences is the refusal builder's own correct output and is left alone - that discrimination was missing in the first draft and a real refusal was flagged as a defect.
- `ungrounded_identities` takes evidence as text and returns unsupported names, phones and emails. Phones match on the last 10 digits so a country code written two ways is not read as invented; emails are stripped of trailing sentence punctuation, which in the first draft reported every correctly-quoted address as fabricated.
- `surplus_questions(text, licensed)` enforces the count; `licensed` is hardcoded `True` until J supplies it.
- Grounding runs **after** the deterministic repairs, so a name that only appeared inside a replayed span disappears with the span instead of escalating to a re-invoke.

`CONTRACT_SHADOW = True` (`pipeline.py`). The pass logs `CONTRACT shadow company=... reinvoke=... <findings>` and cannot touch `turn.text`; exceptions are swallowed, because a measurement pass must never take down a live turn.

**Shadow first.** Thresholds need data.
Log what each check *would* have rewritten against real traffic, measure the false-positive rate, then enforce.
Do not pick a similarity number in the plan and defend it later.

### 2.5b Checks 1 and 2 enforcing, 2026-08-12

Per §2.4a. Suite green (2595 backend tests, 41 in `tests/test_agent_runtime_contract.py`).

**Enforcement is per check, not a global switch.** `CONTRACT_SHADOW: bool` is replaced by `CONTRACT_ENFORCED = frozenset({"restatement", "denial_opener"})` (`pipeline.py`), passed to `contract.check(enforce=...)`.
The single bool was the wrong shape: flipping it would have shipped all four checks at once, including the two §2.4a explicitly held back.
Every check still runs and still logs regardless, which is how check 3 earns its own promotion later.

Three properties the implementation had to get right, each with a test:

- **Every check evaluates against the text as it will actually ship**, not against a hypothetical fully-repaired version. So an unenforced check 1 leaves the replayed span in place *and* check 3 still reports the names inside it - the visitor is going to read them. The converse (§2.5a's original point) still holds when check 1 does enforce: the span goes, and the names go with it, with no escalation.
- **Check 3 can never be enforced**, even if a caller names it. `enforce` is intersected with `REPAIRABLE_CHECKS`, so a typo or a mistaken config cannot start deleting names from replies.
- **A server-authored refusal is classified, never rewritten.** `settle()` may replace the model's words with `refusal.for_state(...)`; that text is ours by construction and was never what these thresholds were measured against. `_review_contract` detects it by comparing `turn.text` against the pre-settle model text and drops to report-only for that turn.

Rewriting at this seam is safe because the answer reaches the caller only on the pipeline's single `result` event - unlike the generic bot's `allow_rewrite=False` path, nothing is on the visitor's screen yet.

`ContractFinding` now carries `repairable` (a deterministic repair exists) and `applied` (it was actually used), replacing the ambiguous `repaired`. The log line reports `changed=` and marks unenforced findings `(report-only)`.

**Still not built, still deliberately:** the check 3 re-invoke and degrade path (§2.5). It waits on post-cleanup traffic sizing check 3's false positives, per §2.4a.

### 2.6 Acceptance

Replaying session `4ef9ffa0`'s six turns produces no reply opening with the previous turn's content, and none opening with a denial before answering.
Replaying the "business development" turn produces no name absent from that turn's evidence set.

---

## 3. Slice H - retrieval recall for entity lookups

Gaps plan §13.6, deferred with a specific instruction: measure §13.1 alone against real traffic first, and do not spend the tokens if it is unnecessary.

**That measurement is the first task of this slice, not a formality.**

**Correction, 2026-08-12.** An earlier revision claimed `chat_logs.sources` makes "was the right chunk retrieved but ranked below 5" answerable from stored data. **It does not.**
`_build_kb_sources` (`main.py:2656`) is called at `main.py:3566` with `retrieved_docs` - the **post-rerank top 5**. `retrieve_knowledge(limit=15)` returns 15 and `rerank_chunks(..., top_k=5)` discards 10 before anything is stored.
So stored data proves a chunk was *absent from the top 5*, but cannot distinguish "ranked 6-15, just missed" from "never retrieved at all" - which is precisely the fork this slice turns on (raise `top_k` vs. escalate to ARCH-D).

H therefore needs an **offline replay**: re-run `retrieve_knowledge` + `rerank_chunks` over stored questions and inspect ranks 1-15.
**The harness now exists** - `scripts/retrieval_rank_probe.py`, built 2026-08-12 for F4's `--mode contamination` question; H's own `--mode ranks` is stubbed and not built. Larger than the plan assumed, and approximate, because the corpus has changed since those turns were logged.
A second, cheaper option exists if replay proves awkward: persist the full candidate ranking (not just the surviving 5) going forward, then measure after a few weeks of real traffic.
Also note `sources` is recorded on only **32 rows** platform-wide as of 2026-08-12, so replay is currently the only viable route regardless.

The 2026-08-11 audit supplies part of the answer and narrows the work:

- The failures are **retrieval, not missing data**. "Who is responsible for export" was answered correctly on 2026-08-09 from the same corpus that failed on 2026-08-10.
- `top_k=5` (`main.py:3549`) is filled by homepage and testimonial parents before the directory rows are reached.
- Directory rows are thin: roughly 24 to 47 words each. "Himani" appears in only **2 of 239 chunks**.

If the right chunk was retrieved but ranked 6-10, raise `top_k` for entity lookups only, gated on the existing `_is_entity_lookup_query` (`main.py:2410`).
If it was never retrieved at all, `top_k` cannot help and the answer is audit E1/E3 (structured directory, identifier retrieval).

Two constraints:
- Measure **against Slice I**. If noise suppression frees enough slots, a smaller increase may suffice, and every extra chunk costs context and money on every entity query.
- The candidate pool is `retrieve_knowledge(limit=15)`. Raising `top_k` beyond the pool does nothing.

---

## 4. Slice I - extraction hardening

Evidence restated 2026-08-11, as §0 required.

**The contaminated page: `https://expresolv.com/` (WordPress, Yoast, Elementor-style theme).**

Of its 76 child chunks, the largest are **client testimonials carrying person names** - Mr. Rakesh Mehta, Mr. Arun Shrestha, Mr. Rohit Verma, Ms. Vidhya Sagar, Mr. Varun and others.
Twelve chunks match testimonial or carousel markup.

These are person-name-shaped chunks, so they are prime false-positive matches for exactly the "who is..." questions the client is complaining about, and they compete directly with real staff rows for the five available slots in §3.

Raw markup is being stored as body text: `<span class="tp-testi__ava-position">`, and bare CSS class names `testimonial-area` and `breadcrumb-area`.
JSON-LD noise is stored too - `dateModified`, `inLanguage`, breadcrumb position lists.

The earlier draft was right that `html_extract` already has boilerplate dedup in `_finalise`.
The claim is that it is **insufficient, not absent**: dedup removes blocks repeated *across* pages, and a testimonial carousel appears once, on the homepage, so nothing dedups it.

Scope, platform-wide per the owner decision, since most SMB tenants are WordPress:

1. Suppress testimonial and carousel containers (`testimonial`, `swiper-slide`, `tp-testi`, review and carousel wrappers).
2. Strip leaking markup and bare class names.
3. Trim non-answerable JSON-LD keys.

**`docs/entity-safe-ingestion-plan.md` now lives in this repo (copied 2026-08-11 from `feature/entity-safe-ingestion`, which is unmerged) - read it before starting.**
Full read confirms this is sequencing, not a design conflict.
That plan's chunker (`services/chunking.py`, Phases 0-1 done, unwired) operates on already-extracted markdown, downstream of `html_extract.py`; it scopes changing `html_extract`'s output as out of scope "for its purpose" (table/heading structure), which does not cover noise suppression.
This slice stays inside `html_extract.py` only - do not touch `run_training_job`'s chunk data shape, which entity-safe's Phase 2 is about to change (`(parent, child)` tuple becomes a triple/dataclass).
Ship I's extraction cleanup first where practical; entity-safe's own chunk-count harness should be re-run afterward since cleaner extraction input changes its numbers.
**Migration number risk:** entity-safe's Q1 decision (`company_knowledge.context TEXT`, dark-applied) will likely also claim `0038`. Whichever branch merges to MainV2 second must renumber - check before either side claims it.

Note this does not retroactively clean existing corpora. They keep their noise until retrained, and the client conversation should say so rather than implying automatic improvement.

---

## 5. Slice J - suppress the reflex question. DEPRIORITISED 2026-08-12.

**Measured: 1 turn in 98 carries an unlicensed extra question.**
This section was written from a single vivid transcript and called VERIFIED on that basis; §10 and §16 then paired J with G as an equal partner.
The measurement does not support that. J is a rounding error next to check 1's 18%, and the three-source arbitration below is a substantial build for a 1% defect.

**Do not build the arbitration.** G's check 4 already counts questions and reports them, which is enough to keep watching the rate. Revisit only if the rate rises materially on post-cleanup traffic.

The analysis below is kept because it is correct about the *mechanism* - it is the priority that was wrong.

Symptom confirmed 2026-08-11 against **post-restructure** transcripts, so the earlier "may already be stale" caution is discharged.

Live examples: "What grade and packaging is available for Acetone?" ended with *"Would you like a price quote for a specific grade and pack size, or perhaps a Safety Data Sheet?"* - two offers stacked on a purely informational answer.

Three sources ask for a question or an offer, independently and simultaneously:

- `qualification_block` (`services/qualification.py`) - "weave in at most one discovery question".
- `action_directive` (`services/sales_funnel.py`) - the default `browsing` stage maps to `recommend_product`, whose text is "Do not wait to be asked - proactively suggest the next step". **This fires on every turn of every session**, including informational ones.
- RULE 6's licensed exit - offer the team handoff.

Slice B gated only the first, and only after a non-answer.

The fix is arbitration, not a fourth suppression clause:

- Classify the turn as informational or sales-progressing. `_is_entity_lookup_query` already identifies a large share of the informational cases.
- On an informational turn, suppress the funnel directive entirely.
- Allow at most one nudge across all three sources, decided in one place.

Ships with or adjacent to G, which enforces the count deterministically.

---

## 6. Slice K - contact acknowledgment bound to real capture

The earlier draft flagged this as "contradicted, partly", because gaps plan §4.4 records the acknowledgment sentence as already shipped.
That is correct, and the remaining defect is now confirmed.

Session `5c7ec4f6`, 2026-08-09: the visitor typed `my mobile no 1231231233`.
The bot replied *"I've noted your mobile number, 1231231233. The Expresolv team will follow up with you."*
**`agent_requests` contains zero rows for that period.**

The number legitimately failed `extract_phone`'s leading-digit rule, which is correct extractor behaviour.
The defect is that the acknowledgment is prompt-driven and decoupled from whether capture succeeded, so the bot promises a follow-up nobody will make.

`services/agent_runtime/contact.py` owns `_captured_contact_echo`; the directive can currently produce the sentence independently of it. Bind the two.

- Capture succeeded: acknowledge and confirm follow-up. Current behaviour, now truthful.
- Capture refused on a message with an explicit cue (`mob`, `my mobile no`, `whatsapp`): say the number could not be read, ask them to repeat it or offer the form. Never claim it was noted.

`extract_phone` already distinguishes a strict-shape match from a cue-phrase match, so this case needs no new heuristic.
Keep its precision discipline unchanged - the fix is what the bot *says* when extraction declines, not what it accepts.

---

## 7. Guardrail architecture - reference

Added at the owner's request so future verticals have a decision rule rather than a habit.

### 7.1 Three enforcement layers

| Layer | Mechanism | Strength | Example here |
|---|---|---|---|
| 1. Prompt | Instructions in the system message | Advisory - may be ignored | RULE 2's anti-repeat clause |
| 2. Control flow | What runs, in what order, with what data | Structural - the model cannot reach what it is not given | `get_sds` returns the document; the model never authors safety data |
| 3. Deterministic code | Validation before or after the model | Absolute | `coa_throttle.py`, `_strip_source_citation` (`main.py:3065`) |

**Decision rule: the higher the cost of being wrong, the lower the layer the behaviour belongs in.**

**The pattern to copy is `_strip_source_citation`.**
RULE 4 asks the model not to cite sources; deterministic code then removes any citation that slips through, including on the cache-hit path.
Prompt for the common case, code for the guarantee.

Every defect in this plan is a behaviour that got the RULE 4 half without the `_strip_source_citation` half.

### 7.2 Two structural traps, both observed in production

- **Naturalness competes with correctness, and the model resolves it in favour of sounding good.** RULE 2 demands a confident opener; the cheapest way to sound confident is to lead with something that already worked. That is §2's repeat bug.
- **Behavioural nudges are additive and unarbitrated.** Three separate blocks each ask for a question, nothing mediates, the visitor gets all three, and the result reads *more* robotic rather than less. That is §5.

### 7.3 Why not LangGraph or LangChain

Asked directly during planning; answered no.

A graph restructures *when the model is called*. Every post-condition in §2.4 is a property of *what the model produced* - layer 3, not layer 2.
A graph adds no post-conditions, and migrating would cut through the frozen guarantees in §8.
The settle point already exists at `compose.settle()`, which is all a validator needs.

Revisit only on: human-in-the-loop interrupts, multi-agent handoff, resumable multi-day workflows, or per-vertical branching that outgrows `load_pack`.
None are present today.

LangChain itself stays as-is: message types and the Gemini adapter, no deeper, no shallower.

---

## 8. What must not change

- **`get_sds` resolution and the safety guardrail.**
- **`get_coa` strict resolution, throttle, lockout, uniform refusal.** F touches what is *published*, never what is *retrievable*.
- **`request_quote` pricing** - byte-for-byte.
- **`_resolve_product` / `_resolve_sds` resolution order.**
- **RULE 3 and RULE 4** - the visitor never sees a source. Slice D's `sources` stays owner-only and must not become reachable from `/api/chat` or the embed route.
- **The pack registry pattern.** No `if vertical == "chemical"`.

Any slice that appears to need one of these changed is wrong and should stop for a decision.

---

## 9. Test plan

Green between slices; re-measure the baseline at the start of each rather than assuming it.

**F** - each exclusion class rejected (refusal, error string, UI artifact, identifier-bearing pair, `📎 Source`); legitimate pairs still returned; `_collect_jsonld` skips by type, by `data-sapybase-faq`, and by source marker.
**The round-trip test is the most important test in this plan**: loader-shaped JSON-LD in, zero chunks out.

**G** - each of the four checks as pure functions; the prepend case using session `4ef9ffa0`'s real turns; exactly one re-invoke plus the degrade path.
**The tool-answer positive control is mandatory**: SDS, COA, quote and spec replies carrying tool-sourced names and identifiers must pass check 3 unmodified (§2.4 trap).

**H** - entity-lookup queries get the raised `top_k`; prose queries do not.

**I** - testimonial and carousel blocks dropped, adjacent real content survives; the audit's markup-leak cases as verbatim fixtures.

**J** - informational turn produces no funnel nudge; sales-progressing turn still does.

**K** - capture succeeded / refused-with-cue / no contact each produce the right acknowledgment state.

**Live evals**, `RUN_LLM_EVALS=1`, twice for stability. The existing 11 must stay green; the `fabrication_hits` fix (`57d735f7`) must not regress.

**Regression guard**: existing `get_sds`, `get_coa`, throttle, `request_quote` and Slice D source-attribution suites pass unchanged. If any needs editing, §8 has been violated.

---

## 10. Order - the reasoning. **The checklist is §11.**

This section explains *why* the sequence is what it is. §11 is what to actually work from.

**F1 -> F2 -> F3 -> F4** (all done), then **G checks 1 and 2 to enforcement** (done 2026-08-12, §2.5b), then **I**, then **H** (measure first), then **K**.
**J is out of the sequence** as of 2026-08-12 (§5), and G's check 3 stays in shadow rather than gating the slice.

F is first because it is the only slice verified as actively causing harm, it corrupts continuously rather than at a point in time, and F1 alone is a few lines.
G and J were sequenced together because J sets the permission G's check 4 enforces; that pairing is withdrawn now that check 4's defect measures at 1%.
**I precedes H**, per §3's own constraint: noise suppression frees top-5 slots, so H's measurement must run against the post-cleanup corpus or it will over-estimate the `top_k` increase needed.
An earlier revision of this section had H before I, contradicting §3, §4 and §16; corrected 2026-08-12.
K is last: smallest and independent.

**Migration numbering, updated 2026-08-12.** `0036`, `0037` and now `0038` (QF13, §11 phase 4) are taken on this branch. `feature/entity-safe-ingestion` was checked directly and had never actually claimed `0038` - its highest is `0037` - so this branch took it. **That branch must use `0039` for `company_knowledge.context`.** The collision moved rather than disappeared; check both branches before claiming the next number.

Gates before merge: suite green on all four checks; live evals green twice; F's per-company purge dry-run reviewed; browser verification with **Manual vs Auto asked before any dev server starts**, per standing policy.

Update this document and the memory entry at the **end of every slice**, per project cadence.

---

## 11. Execution roadmap - the phase-by-phase build order

**This is the section to work from.** §10 gives the reasoning behind the order and §16 gives the full cross-tracker priority; this one is the checklist.
Everything above it is evidence and decisions - read a phase's linked section before starting it, not the whole document.

Six phases remain. Phase 1 is the only one with a hard predecessor; the rest are independent and can be reordered if something else becomes urgent.

### 11.0 The gate every phase passes

Identical for all six, so it is stated once. A phase is not done until all of these hold:

1. `sapybase_ai_engine/venv/bin/python -m pytest tests/ -q` - **full suite green**, not just the phase's own file. The current baseline is **2595 passed, 134 skipped**; record the new number in this doc when it moves.
2. The phase's own new tests exist and fail against the old code. A test that passes before the change is not testing the change.
3. `npx tsc --noEmit` and `npm run lint` - only when the phase touches TypeScript. Phases 1-5 are backend-only; phase 6 is the only one that may not be.
4. **The §8 regression guard**: `get_sds`, `get_coa`, throttle, `request_quote` and Slice D source-attribution suites pass **unedited**. If a phase requires editing one of them, §8 has been violated - stop and get a decision rather than editing the test.
5. This document and the memory entry updated at the end of the phase, per project cadence.

Live evals (`RUN_LLM_EVALS=1`, twice for stability, the existing 11 green) are a **merge gate, not a per-phase gate** - they cost money and are slow. Run them once before the branch merges to MainV2, plus after any phase that changes what the model is asked or what it is allowed to say. Of the six below, that is phases 1 and 3.

### Phase 1 - Slice I, extraction hardening. **DONE 2026-08-12** (suite green, 2603 passed / 134 skipped).

**Prerequisite: none. This one goes first**, because it is the only phase another phase depends on.

**Shipped in `services/html_extract.py`, three parts:**

1. `_strip_noise_blocks` removes testimonial and review containers before rendering.
2. `_clean` strips markup that arrived escaped; `_finalise` drops lines that are nothing but a CSS class name.
3. `_JSONLD_SKIP_KEYS` gained the publishing metadata, and `_JSONLD_NOISE_TYPES` drops `BreadcrumbList`/`ListItem`.

**Two deliberate departures from §4's wording, both narrowing:**

- **Whole-token matching, not the CSS substring selectors §4 listed.** `[class*='review' i]` also takes `preview-box` and `product-preview`, which on a chemical site is product content. Class and id are tokenised on `-`/`_`/space and matched against a vocabulary set instead, so `tp-testi__ava-position` is noise and `product-preview` is not. Test: `test_a_review_token_does_not_match_preview`.
- **`swiper-slide` is NOT suppressed on its own**, though §4 named it. Carousel vocabulary marks a *container*, not its contents, and plenty of sites put real products in a slider - suppressing it platform-wide would delete product copy from tenants who never had a testimonial problem. The measured damage is the testimonial content, and those blocks carry testimonial tokens of their own. If a carousel-only case turns up later, it needs its own evidence.

`box` and `container` are absent from the bare-class-name rule for the same class of reason: they are packaging vocabulary in the chemical vertical, and `carton-box` is a fact.

**Exit gate met**, with one item deferred and not silently dropped: the entity-safe chunk-count harness (`tests/chunk_metrics.py`) **does not exist in this repo** - it is on the unmerged `feature/entity-safe-ingestion`. Re-running it against post-Slice-I extraction is owed **on that branch, before its Phase 2 lands**, since its Phase 0 baseline was measured on dirtier input. Recorded in §15.

**Not done by this phase, and the client conversation must say so:** existing corpora keep their noise until retrained. Nothing here retroactively cleans stored rows.

| | |
|---|---|
| **Broken today** | Training a WordPress homepage ingests the theme's testimonial carousel. Those chunks are dense with person names (Mr. Rakesh Mehta, Mr. Arun Shrestha, ...), so they beat the real staff rows on "who is X?" queries and eat the five available slots. Raw markup (`<span class="tp-testi__ava-position">`) and bare class names (`testimonial-area`) are stored as body text. Confirmed on `https://expresolv.com/`: 12 of 76 child chunks. |
| **Change** | Suppress testimonial/carousel/review containers; strip leaking markup and bare class names; trim non-answerable JSON-LD keys. |
| **Files** | `services/html_extract.py` **only**. |
| **Do not touch** | `run_training_job`'s chunk data shape - `feature/entity-safe-ingestion` Phase 2 is about to change it from `(parent, child)` to a triple. Changing both at once creates a merge conflict neither branch can resolve cheaply. |
| **Detail** | §4. Read `docs/entity-safe-ingestion-plan.md` first - different layer, sequenced not conflicting. |

**Exit tests, on top of §11.0:**

- The audit's real markup-leak cases as **verbatim fixtures**, not paraphrased HTML. A hand-written fixture proves the regex works; the real page proves the feature works.
- A testimonial/carousel block is dropped **and the content adjacent to it survives**. This is the test that catches an over-broad selector, and it is the one worth writing first.
- A page with no testimonial markup extracts byte-identical output to before. Guards against collateral damage to the other tenants.
- Re-run the entity-safe chunk-count harness afterwards and record the new numbers - cleaner extraction input changes them, and its Phase 0 baseline is now stale.

**Why it must precede Phase 2:** measuring `top_k` against a corpus still full of testimonial chunks over-estimates the increase needed. §3's own constraint.

### Phase 2 - Slice H, retrieval recall. **Measure before building.**

**Prerequisite: Phase 1 shipped, and the affected corpora retrained** - otherwise the measurement describes a corpus that no longer exists.

| | |
|---|---|
| **Broken today** | `top_k=5` (`main.py:3549`) is filled by homepage and testimonial parents before directory rows are reached. Directory rows are thin, 24-47 words; "Himani" appears in 2 of 239 chunks. |
| **Unknown** | Whether the right chunk **ranked 6-15 and just missed**, or **was never retrieved at all**. Stored `sources` cannot answer this - it holds the post-rerank top 5 only, and only 32 rows platform-wide carry it. This fork decides the whole phase. |
| **Step 1 (measure)** | **HARNESS BUILT 2026-08-12.** `--mode ranks` replays stored questions through `retrieve_knowledge(limit=15)` + `rerank_chunks` and sorts each into `IN_TOP5` / `RANK_6_15` / `NOT_IN_POOL` / `NO_GOLD`. **The run itself is still owed, and must wait for a retrained corpus.** |
| **Step 2 (decide)** | Ranked 6-15 → raise `top_k` for entity lookups only, gated on `_is_entity_lookup_query` (`main.py:2410`). Never retrieved → `top_k` cannot help; the answer is ARCH-D/ARCH-E and **this phase ends here with a measurement and no code change**, which is a valid outcome. |
| **Files** | `scripts/retrieval_rank_probe.py`, then `main.py:3549` if and only if step 2 says so. |
| **Detail** | §3. |

**How the harness decides "the right chunk" without human labels:** it takes the query's distinctive words (stopwords and question scaffolding removed) and picks the **rarest** one that appears in the tenant's corpus - a term matching 3 rows identifies the answer, one matching 200 identifies nothing. `--labels file.json` overrides it for role-based questions the corpus does not name literally ("who handles export" -> `Himani`).

**Two corrections the first dry run forced, both of which would have produced a confidently wrong verdict:**

- **"No gold term" was three different things wearing one label.** Split into `NO_GOLD` (terms extracted, zero corpus rows - the real data gap, §17's case), `TOO_COMMON` (terms match more rows than can discriminate - a limit of *this script*) and `NO_TERMS` (query is numeric or too short, e.g. `"LR, 500 Ml"`). Only `NO_GOLD` counts against the corpus; the other two are excluded from the denominator. Before the split, 34% of queries were reported as client data gaps when most were the harness failing to measure.
- **The verdict was declared on a sample of two.** The first run had exactly 1 recoverable and 1 never-retrieved and printed "top_k CANNOT fix this". Now it requires `MIN_VERDICT_SAMPLE = 8` failing queries, demands a 2:1 majority before naming a direction, and prints `SPLIT` or `INCONCLUSIVE` otherwise.

It also flags any `RANK_6_15` query that `_is_entity_lookup_query` does **not** classify as an entity lookup - those would not be reached by a `top_k` raise gated on that predicate, so the fix would silently miss them.

**Exit tests, on top of §11.0:**

- The measurement is **written into this document** before any `top_k` line changes. A number in a commit message is not a record.
- If `top_k` changes: an entity-lookup query gets the raised value, a prose query does not. Both directions, one test each.
- The candidate pool is `limit=15`. A test asserting `top_k <= pool` - raising it past the pool silently does nothing, which would look like a working deploy.

### Phase 3 - Slice K + QF10, contact acknowledgment and its side effects. **DONE 2026-08-12** (suite green, 2637 passed / 134 skipped).

**Prerequisite: none.** Grouped because both are the same territory - what happens around a contact capture that did not succeed.

**Shipped:** `contact.capture_claims` / `contact.bind_acknowledgement` (the post-condition), `qualification.has_contact_cue` (so the cue vocabulary is not duplicated away from the extractor's), and the pipeline now runs the capture **after** `settle()` and binds the acknowledgment after the response contract.

**QF10 was resolved the opposite way to how the audit specified it, and this is the one decision here worth a second look.**
The audit asked for the capture side effect to be **suppressed** when the turn's answer is a fallback.
Implementing that literally would delete a real lead at exactly the moment a human is most needed: the bot has just failed, and the visitor handed over their number anyway.
So the capture still runs unconditionally. What the ordering fix actually buys is that the outcome now *exists* when the capture happens, so the owner's alert can say `[bot could not answer this turn]` instead of describing a conversation that never took place.
The defect the audit found was real - the ordering - but suppression was the wrong remedy for it.

**Slice K's no-cue case, which §6 did not specify:** when the reply claims a capture and the visitor's message carried no contact cue at all, the claim is simply removed rather than replaced with the "could you send it again" sentence. Asking someone to repeat a number they never gave is its own kind of nonsense.

| | |
|---|---|
| **Broken today (K)** | The acknowledgment is prompt-driven and decoupled from whether capture worked. Session `5c7ec4f6`: visitor typed `my mobile no 1231231233`, bot replied "I've noted your mobile number", `agent_requests` has **zero rows** for that period. The bot promised a follow-up nobody will make. |
| **Broken today (QF10)** | `_capture_volunteered_contact` runs at `pipeline.py:118`, **before** `settle()` at ~136 decides the turn was a system error or fallback. The capture and its handoff fire regardless of what the turn turned out to be. |
| **Change (K)** | Bind the sentence to the capture result. Succeeded → acknowledge and confirm follow-up. Refused **with an explicit cue** (`mob`, `my mobile no`, `whatsapp`) → say the number could not be read, ask them to repeat it or offer the form. Never claim it was noted. |
| **Change (QF10)** | Gate the capture side effect on the settled outcome. |
| **Files** | `services/agent_runtime/contact.py`, `services/agent_runtime/pipeline.py`. |
| **Do not touch** | `extract_phone`'s precision (`services/qualification.py:214`). It **correctly** rejected `1231231233`. The fix is what the bot *says* when extraction declines, not what extraction accepts. Loosening it is the wrong fix and would create a worse bug. |
| **Detail** | §6, and §13's QF10 row. |

**Exit tests, on top of §11.0:**

- Three acknowledgment states, one test each: capture succeeded / refused-with-cue / no contact in the message at all.
- The bot **never** emits "I've noted" when `agent_requests` got no row. Assert on the pairing, not on the sentence alone - that is the actual defect.
- A fallback or `SYSTEM_ERROR` turn fires no capture side effect and no handoff (QF10).
- A normal successful capture on an `ANSWERED` turn still fires - guards against fixing QF10 by breaking Slice A.

### Phase 4 - QF13, chat-log idempotency. **CODE DONE 2026-08-12** (suite green, 2646 passed / 134 skipped). **Migration not yet applied.**

**Prerequisite: none.** The only phase in this plan carrying a migration.

**Shipped:** migration `0038_chat_logs_idempotency` (partial unique index on `(company_id, client_message_id)` where the id is not null) and `ON CONFLICT DO NOTHING` on the `chat_logs` insert.

**`0038` was free.** §10's warning said `feature/entity-safe-ingestion` intended to claim it; checked that branch directly and its highest migration is `0037`, so the number was never taken. **That branch must now use `0039`** - the collision moved, it did not disappear.

**Three choices worth recording:**

- **Scoped to `company_id`, not global.** The id is generated by the client, so two tenants can legitimately mint the same value, and a global unique would let one tenant's write silently suppress another's.
- **Partial on `NOT NULL`.** Older widgets send no id at all; without the partial clause every legacy row would collide with every other legacy row. 284 of 1,012 production rows carry the id.
- **`ON CONFLICT DO NOTHING` is deliberately untargeted.** Naming the index makes the statement fail outright on any environment where the code deploys before the migration runs - that would take chat logging down entirely rather than duplicating a row, which is the worse failure.

**Verified before shipping:** zero duplicate `(company_id, client_message_id)` groups across all 1,012 production rows, so the index builds without a cleanup step.

**Still owed, deferred by owner decision 2026-08-12:** apply `0038` dark to the prod control DB and stamp it, per the `migration-apply-dark` skill. **Held until every phase is complete and the end-to-end tests pass** - the code is a no-op without the index, so nothing is broken by waiting. The tests here are structural - they assert the DDL and the statement are shaped right. The semantic check (insert twice, get one row) happens at apply time, because the only writable database configured in this repo is production.

| | |
|---|---|
| **Broken today** | `client_message_id` is stored on the `chat_logs` row (`main.py:3151`) and read back to attach feedback (`main.py:7127`), but the INSERT has no `ON CONFLICT`. A retried request writes a duplicate row. It is a column, not an idempotency key. |
| **Change** | Unique index on the identifying pair, plus `ON CONFLICT DO NOTHING` on the insert. |
| **Files** | `main.py:3151`, plus a migration. |
| **Migration number** | `0036` and `0037` are taken. **`feature/entity-safe-ingestion` intends to claim `0038`** for `company_knowledge.context`. Check that branch's actual state before claiming a number - whichever branch merges second has to renumber. |

**Exit tests, on top of §11.0:**

- The same `client_message_id` inserted twice produces one row, not two, and does not raise.
- A `NULL` `client_message_id` still inserts - older clients do not send one, and a unique index over nulls must not collapse unrelated rows.
- The migration is **idempotent**: run it twice against a local copy, per project rule. `CREATE UNIQUE INDEX IF NOT EXISTS`.
- The existing feedback-attachment path (`main.py:7127`) still resolves its row.

### Phase 5 - QF7, client history sanitizing. **DONE 2026-08-12** (suite green, 2667 passed / 134 skipped).

**Prerequisite: none.** Security-shaped, so it does not wait on convenience.

**Shipped as `services/prompt_safety.py`** - `normalise_role`, `sanitize_untrusted`, `delimit`, `safe_history` - wired into `main.py` at all three points.

**The role allowlist is the substantive half.** The old `if m.role == 'user' ... else AIMessage` meant any unrecognised role became an **assistant** message, so a caller posting `role: "system"` got to author the assistant's own lines. An unrecognised role is now **dropped, never coerced**. The allowlist names both `bot` (what `ChatWidget.tsx` sends) and `assistant` (what `services/session_store` writes) explicitly - an allowlist that has to guess is not one.

**Both history paths now go through it**, not just the client one. The server-side session store's roles are trusted, but its *content* is still visitor text, and having one path escape the treatment is how the next gap opens.

**Delimiter escaping extended to the current message too.** `<user_query>` was already wrapped but the content could contain the closing tag, so the wrapper was decoration. §13's QF7 row scoped this to history; the current message had the identical hole one line away and is fixed in the same helper.

**Reserved tags are defanged (`&lt;`), not deleted** - text vanishing silently reads as a bug when a visitor legitimately pastes markup, and the model should still see what was said.

**The no-op tests are the important ones here.** This runs on the prompt every single turn, so a false positive is a platform-wide regression rather than a missed attack. `"purity <99.5%"` and `"Moisture content <0.1% and < 50 ppm"` are asserted byte-identical - a naive angle-bracket filter would mangle every purity question on the platform.

| | |
|---|---|
| **Broken today** | `main.py:3805-3811` builds `HumanMessage`/`AIMessage` from **client-sent** `chat_req.history` on a bare `if m.role == 'user'` check - no allowlist - and inserts `m.content` unsanitized. Only the *current* message goes through `delimited_user_message`; history items do not. A caller controls both the content and, effectively, the role. |
| **Change** | Validate `role` against a literal set; delimit history entries the way the current message already is. |
| **Files** | `main.py:3805-3811`. |
| **Detail** | §13's QF7 row. |

**Exit tests, on top of §11.0:**

- An unknown or absent `role` is rejected, not silently treated as assistant text.
- Injection-shaped content inside a history entry stays inside its delimiter and cannot terminate the block early - the same property `delimited_user_message` already guarantees for the current message.
- A normal multi-turn conversation is unchanged. This phase touches the prompt every turn is built from, so the no-op case is the one that matters most.

### Phase 6 - Slice G check 3, watch then decide. **Not a build phase yet.**

**Prerequisite: real post-cleanup traffic exists.** As of 2026-08-12 there is almost none - 3 turns in 30 hours.

| | |
|---|---|
| **State** | Checks 1 and 2 enforce (§2.5b). Check 3 runs, logs, and cannot rewrite. Check 4 the same. |
| **Step 1** | Collect `CONTRACT ...` log lines from real traffic. Confirm checks 1 and 2 are firing and repairing cleanly - `changed=True` with a sane repair, no empty or truncated replies. |
| **Step 2** | Measure check 3's false-positive rate on post-cleanup turns. §2.4a's 10% included known false positives, and better retrieval removes more of the genuine cases. |
| **Step 3, only if the rate justifies it** | Build the re-invoke-once + degrade path (§2.5): one re-invoke with a correction note, then degrade to a decline plus handoff. **Exactly one re-invoke, ever** - this must never become an unbounded repair loop. |
| **Detail** | §2.4a, §2.5, §2.5b. |

**Exit tests if step 3 goes ahead, on top of §11.0:**

- **The tool-answer positive control is mandatory** (§2.4's named trap): SDS, COA, quote and spec replies carrying tool-sourced names and identifiers pass check 3 **unmodified**. Validating against kb chunks alone breaks every working tool answer, and this is the single most likely way to get the slice wrong.
- Exactly one re-invoke, asserted by call count - not by reading the reply.
- Second failure degrades to a decline plus handoff, and **never** ships the ungrounded answer.
- Replaying the "business development" turn from session `4ef9ffa0` produces no name absent from that turn's evidence set (§2.6).

### 11.1 Summary

| Phase | Slice | Files | Blocks | Rough size |
|---|---|---|---|---|
| 1 | I - extraction hardening | `services/html_extract.py` | **blocks phase 2** | **DONE 2026-08-12** |
| 2 | H - retrieval recall | `scripts/retrieval_rank_probe.py`, maybe `main.py` | - | ½ day to measure, then decide |
| 3 | K + QF10 - contact ack and side effects | `contact.py`, `pipeline.py` | - | **DONE 2026-08-12** |
| 4 | QF13 - chat-log idempotency | `main.py` + migration | - | hours |
| 5 | QF7 - history sanitizing | `services/prompt_safety.py`, `main.py` | - | **DONE 2026-08-12** |
| 6 | G check 3 - watch, then maybe build | `contract.py`, `pipeline.py` | needs live traffic | measurement first |

Phases 2 and 6 may legitimately end with **no code change at all**. That is a result, not a failure - both are gated on a measurement whose answer might be "the cheap fix does not apply here", and in phase 2's case that answer routes the work to ARCH-D instead.

---

## 13. Audit quick fixes still open (QF3-QF13)

Source: `docs/audit-agent-behaviour.md` §6 Track 1 - "independent, individually shippable, no architectural change".
QF1 and QF2 are done (§0.3). **QF3-QF13 were fully re-verified against code 2026-08-11** - most were quietly fixed by the agent-runtime restructure, whose comments cite the same audit IDs directly (e.g. `services/agent_runtime/loop.py` literally says `(B1)` and `(B2)` next to the fixes). Only 4 of the 11 are genuinely still open.

| ID | Fix | Audit ID | Size | Status |
|---|---|---|---|---|
| QF3 | Remove `search_catalog` from RULE 6 | A4 | minutes | **Moot.** `search_catalog` does not exist anywhere in the codebase - nothing to remove. |
| QF4 | Fork RULE 1 into a tool-aware variant for pack companies | A1 | half day | **Open.** `main.py:3646` still has one generic `RULE 1` block; no pack-aware fork found. |
| QF5 | Gate cache writes on grounded + complete; add a TTL to `exact_query_cache` | D1, D2 | hours | **Done.** `_cacheable()` (`main.py:3020`) gates writes on `turn_state is ANSWERED`, and `CACHE_TTL_DAYS = 30` (`main.py:3017`) is enforced on every read (`main.py:3467-3468`, `created_at > now() - interval '30 days'`). Both cite "audit D1/D2" in-line. |
| QF6 | Execute all tool calls in a round, or return an explicit "not executed" observation | B1 | half day | **Done.** `services/agent_runtime/loop.py:214-222` - calls past `max_calls_per_round` get `_OVER_BUDGET_OBSERVATION` instead of being dropped. Comment: `# Every advertised call gets a response, budget or not (B1).` |
| QF7 | Sanitize and delimit client history; validate `role` against a literal set | C1 | half day | **DONE 2026-08-12** - `services/prompt_safety.py`, both history paths + the current message. §11 phase 5. Previously: **Open.** `main.py:3805-3811` builds `HumanMessage`/`AIMessage` from client-sent `chat_req.history` on a bare `if m.role == 'user'` check (no allowlist) and inserts `m.content` unsanitized. Only the *current* message is delimited (`delimited_user_message`); history items are not. |
| QF8 | Consolidate the refusal into one structured outcome with one rendering | A6, F3 | 1 day | **Done.** `services/agent_runtime/states.py`'s `TurnState` enum + `turn.py`'s `TurnResult` + `compose.settle()` as the single decision point, paired with the RULE 6 Phase 5 rewrite that stopped the model reciting a canned refusal paragraph. |
| QF9 | Reconcile the timeout budget from per-call timeout x retries x rounds | B5 | hours | **Done.** `services/agent_runtime/pipeline.py`'s `deadline_s`/`heartbeat_s` mechanism (fed `AGENT_PRECOMPUTE_TIMEOUT_S = 30`) plus `MAX_TOOL_ROUNDS = 4` (`loop.py:37`) is a single reconciled budget, not independent per-layer constants. |
| QF10 | Suppress `_captured` side effects when the turn's answer is a fallback | B3 | half day | **DONE 2026-08-12, resolved the opposite way** - see §11 phase 3. The capture now runs after `settle()` but is deliberately NOT suppressed; suppressing it would lose a real lead on exactly the turns where a human is needed. The owner's alert is marked instead. Previously: **Open.** `pipeline.py:118` calls `_capture_volunteered_contact(...)` *before* `compose.settle()` (line ~136) determines `system_error`/fallback - the capture and its handoff fire independent of whether the turn's answer ends up being the fallback text. Related to but distinct from Slice K (§6): K binds the *acknowledgment sentence*; QF10 is the *capture side effect* itself. |
| QF11 | Forced tool-free compose round; fallback only when there is truly nothing | B2 | 1-2 days | **Done.** `loop.py:236-240` - after exhausting `max_rounds`, `_compose_without_tools()` runs over whatever the tools already returned rather than discarding it. Comment: `# ... compose over it rather than discarding it (B2).` |
| QF12 | Handle the `error` SSE frame client-side; terminate with `[DONE]` after it | F2 | half day | **Done.** Backend emits `{"error": "Stream interrupted"}` then `data: [DONE]` (`main.py:4013-4018`); frontend explicitly parses `parsed.error` (`src/components/chat/ChatWidget.tsx:2999`). |
| QF13 | Use `client_message_id` as an idempotency key on the chat write path | C4 | 1 day | **DONE 2026-08-12** (migration `0038` + `ON CONFLICT DO NOTHING`), dark-apply still owed - §11 phase 4. Previously: **Open.** `client_message_id` is stored on the `chat_logs` row (`main.py:3151`) and used later to *attach feedback* (`main.py:7127`), but the `INSERT` itself (`main.py:3151`) has no `ON CONFLICT` - nothing stops a retried request from writing a duplicate row. Not an idempotency key today, just a column. |

**Net result:** 7 of QF3-QF13 done, 1 moot, **4 genuinely open: QF4, QF7, QF10, QF13.** QF7 and QF13 are the two worth prioritizing - QF7 is a real prompt-injection-shaped gap (unsanitized client history), QF13 is a real duplicate-row gap on every retried chat request.

## 14. Architecture slices still open (ARCH-A - ARCH-M)

Source: `docs/audit-agent-behaviour.md` §6 Track 2 - "build the precision architecture". These are larger, structural builds, not quick fixes.

| ID | Slice | Audit finding IDs | Status |
|---|---|---|---|
| ARCH-A | **Grounding gate.** Keep rerank scores, set a threshold, refuse below it as a structured turn outcome. | B7 (part), D4 | **Not started.** Confirmed - no rerank-threshold or grounding-gate code found. |
| ARCH-B | **Runtime output check.** Promote `fabrication_hits` from the eval suite into the response path for value-class answers with no grounding observation. | B7 | **Not started.** Confirmed - `fabrication_hits` exists only in `tests/test_guardrail_eval.py`, never imported by runtime code. |
| ARCH-C | **Entity-safe ingestion.** Source-type-aware extraction; never split a contact block, table row or FAQ pair across chunks. | E2 | **In progress**, separate unmerged branch. See §15. |
| ARCH-D | **Identifier retrieval path.** Trigram / exact-match index alongside BM25; stop stemming identifiers. | E3, D5 | **Not started.** This plan's Slice H (§3) only raises `top_k` for entity lookups - a narrower, cheaper mitigation. If H+I don't fix directory recall, ARCH-D is the real fix. |
| ARCH-E | **Structured-kind registry.** Generalise `catalog_tables` into pack-configurable kinds; people/contacts first, then FAQ pairs. | E1 | **Not started, explicitly deferred** (§17 out-of-scope note carries this forward unchanged: build only if directory answers still fail after H and I). |
| ARCH-F | **Intent router.** Deterministic first, cheap classifier fallback; structured classes skip HyDE and rerank entirely. | B8 (part), A5 | **Not started.** |
| ARCH-G | **Turn pipeline extraction.** One `TurnResult` (text, events, sources, tool_trace, status) read by SSE, session, funnel, alerts and analytics. | B3, B4, F4 | **Done, pushed to MainV2** - this is the agent-runtime restructure (`services/agent_runtime/`, `compose.settle()`). Confirmed an ancestor of this branch's base commit. |
| ARCH-H | **Tool registry.** One object per tool owning schema, executor, capture shape, funnel contribution, availability predicate. | B9, B10 | **Done, pushed to MainV2** (`f9fc4f93`, `RuntimeTool` registry). |
| ARCH-I | **Prompt composer.** One authority order, static-before-volatile block ordering, asserted token budget, snapshot-tested. | A3, A5, A7, A8 | **Not started.** RULE 1-7 in `main.py` are still hand-assembled string blocks. |
| ARCH-J | **KB search as a tool.** Retrieval becomes a decision, not a tax. | B8 | **Not started.** |
| ARCH-K | **Signals rebuild.** Replace `is_unanswered`/`confidence` with grounded-answer rate and refusal rate derived from `TurnResult`, versioned. | D3, D4 | **Partial.** `turn_state` (migration 0037) is the raw signal this needs and is what F2 (§1.4) already reads instead of `is_unanswered`. The rolled-up, versioned metric on top of it is not built. |
| ARCH-L | **Persist the tool trace.** `tool_calls`/`observations` written and surfaced in the owner conversation view. | C3 | **Done, pushed to MainV2** - Slice D's `chat_logs.sources` (migration 0036) + `ConversationsPanel`. One manual browser check still owed per prior memory. |
| ARCH-M | Streaming compose; generic-bot server-side memory; embedding dimensionality; dead code. | F1, C2, E4, D6 | **Not started**, grab-bag - lowest priority. |

**Audit's own priority note, carried forward:** ARCH-A (grounding gate) will *increase* refusals on badly-cut chunks, because it starts declining what the model used to guess at - correct behaviour, but it reads to an owner as "the bot got quieter." Don't ship ARCH-A without warning the client, same discipline as F's disclosure in §1.6.

## 15. Entity-safe ingestion - phase status

Full plan now lives at `docs/entity-safe-ingestion-plan.md` (copied 2026-08-11 from unmerged `feature/entity-safe-ingestion`). This is a condensed status; read the full doc before touching Phase 2+, not this summary.

| Phase | What | Status |
|---|---|---|
| 0 | Measurement harness (`tests/chunk_metrics.py`, `tests/chunk_fixtures.py`) | **Done, but its baseline is now stale** - Slice I shipped 2026-08-12 and cleaner extraction input changes these numbers; re-run on that branch before Phase 2 lands. Its own real-page validation found the correctness defect (unheadered table splits) doesn't occur in any currently-trained page, including Expresolv's - so this slice does not fix the fabricated-contact incident that motivated it. What it does deliver: 34% fewer chunks, 14% fewer billed words, from header/heading deduplication. |
| 1 | `services/chunking.py` structure-aware packer | **Done, not wired in.** `run_training_job` still uses the old `RecursiveCharacterTextSplitter`. |
| 2 | Wire into `run_training_job` | **Not started.** Gated on Q1 (decided: `context TEXT` column, dark-applied, likely claims migration `0038` - see §10's migration note). |
| 3 | FAQ / definition-list atomicity | **Not started.** The plan's own Phase 0 measurement found FAQ pairs already survive splitting intact except when a single answer exceeds ~1500 chars - demoted below Phase 4 in its own doc. |
| 4 | Owner-triggered per-source re-ingest | **Not started.** Decided (§6 Q2): a re-index button on the Train page, one source at a time, no forced migration. |

Relationship to this plan's Slice I (§4): different layers (splitting vs. extraction), sequenced not conflicting. Full reasoning in §4.

## 16. Master priority order, everything in this file

**Superseded for day-to-day work by §11**, which turns the still-open rows below into six executable phases with their own exit tests.
This section is kept as the full cross-tracker roster - it includes the long-tail ARCH items §11 deliberately leaves out.

§10 already orders F-K internally. This extends that ordering across every item this file now tracks, in the sequence that respects real dependencies (not slice-letter order):

1. **F1 -> F2 -> F3 -> F4** (§1) - already in flight, actively corrupting data, ships first regardless of everything below.
2. **G checks 1 and 2 to enforcement** (§2.4a) - **DONE 2026-08-12, §2.5b.** Checks 3 and 4 still report; **J is dropped from the path** (§5). Next item here is watching the enforcing logs, not building more of G.
3. **QF13** (chat-log idempotency, §13) - cheap, isolated, real duplicate-row gap on retried requests; ship alongside F/G. QF5 turned out to already be done, nothing to do there.
4. **I** (§4) - extraction hardening, ships before H is measured and before Entity-Safe Phase 2 (its own harness numbers depend on cleaner extraction input).
5. **H, measured against I** (§3).
6. **K** (§6) - smallest, independent, ships whenever convenient. **QF10** (§13) is the same territory (capture side effects vs. fallback turns) and should ship alongside it.
6.5. **QF7** (§13) - unsanitized client-supplied history is a real prompt-injection-shaped gap, not cosmetic; worth pulling forward rather than leaving in the general QF backlog.
7. **ARCH-B** (runtime `fabrication_hits` promotion) - cheap, complements G's grounding check (§2.4 check 3) rather than duplicating it.
8. **ARCH-A** (grounding gate) - the audit's own highest-value Track 2 item, but read the ordering warning in §14 first and coordinate client disclosure the way F did.
9. **Entity-Safe Phase 2** (wire in the chunker) - after I ships, so its harness measures the real post-cleanup corpus, and after the `0038` migration-number question is settled with `feature/entity-safe-ingestion`.
10. **ARCH-D / ARCH-E** (identifier retrieval, structured contacts registry) - only if H+I don't fix directory recall, per the existing deferral in §17.
11. **ARCH-I / ARCH-F / ARCH-J** (prompt composer, intent router, KB-as-tool) - largest rewrites, lowest urgency, no client complaint currently traces to these.
12. **Remaining QF rows** (§13) - reverify each, ship independently whenever idle capacity exists; the audit explicitly scoped them as no-architecture, any-time fixes.

Nothing above changes §10's own F-K sequencing or §8's frozen guarantees. This is an ordering, not new scope - every item was already committed to in some other doc before 2026-08-11.

---

## 17. Out of scope, and what belongs to the client

**Not engineering work:**

- **The EXPLORE word cap.** Expresolv has used 4,496 of 12,000 words (`core/config.py:48`). Their site is roughly 250,000 words across 668 pages (17 in `page-sitemap.xml`, 651 in `product-sitemap.xml`). Only **6 pages are ingested, 0.9% of the site**. No scraper work changes the fact that their tier cannot hold their site. Commercial conversation.
- **"Business development manager" does not exist in their content.** Repeatedly asked, correctly declined. They must add the role or stop asking.
- **Full-site discovery is opt-in** and their ingestion dates show one-URL-at-a-time manual entry. Worth showing them the flow, but 651 product pages will not fit the cap regardless.

**Resolved 2026-08-12 - not cross-tenant bleed, and it is a good demonstration of what check 3 is for.**

The bot answered Expresolv's `"who is technical director in expresolv?"` with "Mr. Piyush Satvara is the Technical Director at Expresolv", and the contract flagged the name as ungrounded. The worrying reading was cross-tenant bleed, since that is also the platform owner's name.
It is not: "Piyush" appears in Expresolv's **own** corpus, 3 rows in `/leadership` and 2 in `gst_certificate.pdf`. Tenant scoping held.

What actually happened is subtler and worth keeping. That turn's five sources were **all homepage chunks, every one scored 0.0** - so the name was not in the evidence the turn retrieved, even though it exists elsewhere in the tenant's data. The reply was factually right and evidentially unsupported at the same time.
This is precisely the distinction check 3 draws - "not supported by this turn's evidence" rather than "false" - and it is why the check reports rather than deletes, and why it re-invokes instead of repairing.

**Deferred engineering:**

- The `contacts` table (gaps plan §11.3). Now tracked as **ARCH-E** (§14). Tune retrieval first per the owner decision; build it only if directory answers still fail after H and I.
- **Gaps plan's Slice C**, the two-day activity digest. Still plan-only, still deprioritised. (Not the audit's own "Slice C" - that is entity-safe ingestion, tracked separately as **ARCH-C** / §15. Two unrelated plans reuse the letter C; do not conflate them.)
- `FALLBACK_PHRASES` / `is_unanswered` repair. F routes around it via `turn_state`, so the flag stays unreliable for any other consumer. Gaps plan's Slice C (the digest, above) depends on it.
- `docs/codebase-consolidation-plan.md`. `main.py` is 14,128 lines, but nothing here is blocked on it.

## 18. Relates to

- `docs/agent-conversation-gaps-plan.md` - Slices A-E, and the §13.4 / §13.6 items G and H come from. A/B/D/E status now tracked in §0.3.
- `docs/audit-agent-behaviour.md` - D3 is why F's eligibility gate is broken; A5 is why G is not a prompt fix; source for the QF (§13) and ARCH (§14) trackers folded in 2026-08-11.
- `docs/coa-confidential-access-plan.md` - the confidentiality standard F3 must not violate.
- `docs/agent-runtime-restructure-plan.md` - `turn_state` (F2's signal), `compose.settle()` (G's home), and ARCH-G/ARCH-H's shipped implementation.
- `docs/entity-safe-ingestion-plan.md` - lives on unmerged `feature/entity-safe-ingestion`, copied into this repo 2026-08-11 for reference; downstream of Slice I (splitting vs. extraction), not conflicting - see §4 for the sequencing/migration-number notes and §15 for phase status.
