# List answer consistency plan

Status: DIAGNOSIS COMPLETE. D1 + Phase 3 wiring BUILT and committed, NOT merged, NOT applied to prod. Phases 1, 2, 4, 5, 6 unstarted.
Opened 2026-08-25 from three live Expresolv conversations on 2026-08-22.
Branch: `feature/list-atomic-chunking`, off `feature/entity-safe-ingestion`, with `MainV2` merged in (26 commits, none touching `main.py`, clean).

## 0. The incident

Three visitor sessions asked the same question five different ways and got five different answers.
The data was in the knowledge base the entire time.

Company `d13912da-1901-4349-a7d3-acd08a064e6a` (Expresolv), all times UTC.

| Session | Turn | Question | Answer | Recorded state |
|---|---|---|---|---|
| `5465ee61` | 06:19 | is ammonia in FSSAI product list | I don't have that on file | `no_data`, conf 0 |
| `5465ee61` | 06:20 | List of product as FSSAI | can't confirm, don't have that on file | `no_data`, conf 0 |
| `592bc5d6` | 07:10 | products under FSSAI license? | one vague sentence, no list | `answered`, conf 0.5 |
| `592bc5d6` | 07:10 | which are the products? | "categorized as Food Grade Products" | `answered`, conf 1.0 |
| `592bc5d6` | 07:11 | can give name of those products? | I don't have that on file | `no_data`, conf 0 |
| `592bc5d6` | 07:12 | list of food additives | full correct list, **39 items** | `answered`, conf 1.0 |
| `0e25f4bf` | 07:15 | which are the products under FSSAI license? | categories only, plus "I don't have a list of specific product names on file" | `answered`, conf 0.9 |
| `0e25f4bf` | 07:16 | List of products under FSSAi license? | list, but **34 items** | `answered`, conf 0.7 |

Two of these sessions carry a `Has gaps` badge in the owner dashboard.
Both badges are false.
The owner is being told to add content that is already trained, and acting on that advice makes the corpus worse.

`confidence` is again useless as a signal here, the same way [[agent-conversation-gaps]] found it useless.
The single most wrong answer of the eight ("which are the products?", answered from a leadership bio page) scored 1.0.

## 1. Root causes

Five, ordered by how much of the incident each explains.
All five were verified against production data, not inferred.

### 1.1 The source list is split across two parent chunks by the 1500-char parent cut

`run_training_job` (`main.py:8401`) splits each document into 1500-char parents with 150 overlap, then 300-char children with 50 overlap.
`food additives at expresolv.pdf` produced 5 parents and 18 children.
The 39-item numbered table straddles a parent boundary:

- `1b70c890` (1490 chars) holds items **1 to 34** plus the nutraceuticals section.
- `1a7bb141` (296 chars) holds items **29 to 39**, the tail plus the 150-char overlap.

Items 29 to 34 exist in both, which is exactly the overlap window.
There is no chunk anywhere that holds the whole list.

This is the direct and complete explanation of "34 items" versus "39 items".
The 34-item answer retrieved `1b70c890` alone.
The 39-item answer retrieved `1a7bb141` at rank 1 with score 10 and `1b70c890` alongside it.
Nothing in the pipeline knows those two parents are one table.

**This is the PDF pathway, and the existing unmerged chunker already fixes it. Tested, not assumed. See §7.**

The chunks are NOT stale relative to any shipped fix.
The splitter config has not changed on `MainV2` since `c814ba1e` (2026-04-22) and `process_pdf_efficiently` since `6aed9f74` (2026-04-09), while this PDF was ingested 2026-08-06.
Re-running the current splitter against the reconstructed page reproduces the two stored rows **byte for byte**.
So asking Expresolv to re-train today would regenerate exactly these chunks and change nothing.

Running `services/chunking.py` from `feature/entity-safe-ingestion` against the same page puts **all 39 items in one parent**.

This corrects an inherited assumption.
[[entity-safe-ingestion]] §5 closed with "this slice is a NO-OP for PDFs", and that was measured against **tables**, where `extract_text()` destroys the column boundaries irrecoverably.
A numbered list is a weaker structural claim and survives, so for this document the slice is not a no-op.
Do not carry the blanket "no-op for PDFs" claim forward.

The reason it survives is narrower than "lists are held atomic", and §7 records the boundary.

### 1.2 Retrieval returns the same parent multiple times in one top-5

`retrieve_knowledge` (`main.py:2525`) ranks CHILD rows, then resolves each winner to its PARENT's content.
`1b70c890` has 6 children.
Six children can each win a rank slot and every one of them returns the same 1490 characters.

There is no `DISTINCT` on the resolved parent, and no dedupe after resolution.
Production `chat_logs.sources` proves it fired on every FSSAI turn:

- "List of products under FSSAi license?" - ranks 1 and 2 both `b0c2ac20`.
- "is ammonia in FSSAI product list" - ranks 1 and 4 both `1b70c890`.
- "List of product as FSSAI" - ranks 1 and 2 both `1b70c890`.

So the advertised top-5 was really a top-3 or top-4.
`context_text` (`main.py:3641`) then joins those duplicates, so the same passage enters the prompt two to four times.

The cost is compounding rather than merely wasteful.
On the turn that answered with 34 items, a duplicate consumed the slot that `1a7bb141` needed to complete the list, and repeating one parent three times biases the model toward whatever that parent says.

This is a plain bug, it is cheap to fix, and it is the highest value change in the plan.

### 1.3 HyDE makes the same question retrieve differently on every ask

`main.py:3607` sends the question to an LLM, gets back an invented hypothetical passage, and embeds THAT instead of the question.
Same question, different invented paragraph, different vector, different chunks.

[[agent-conversation-gaps]] already established HyDE as the root cause of the fabricated-contact incident and added `_is_entity_lookup_query` so directory lookups bypass it.
That fix was scoped to entity lookups.
A list or enumeration request is the same class of problem for the same reason, and does not currently bypass it.

### 1.4 Retrieval never sees the conversation

`retrieve_knowledge` is called with `chat_req.message` raw.
There is no history-aware rewrite step anywhere in the chat path.

A follow-up therefore retrieves as if it were the first message of the session.
Measured consequences from the transcripts:

- "which are the products?" retrieved `expresolv.com/leadership/mr-punit-kashwala` at **rank 1, score 10**, plus the LinkedIn company page.
  The model answered from those and scored itself 1.0.
- "can give name of those products?" retrieved the price list and the homepage, everything scored 0, and the turn refused.

Both are turns where the visitor had already established the subject and the retriever threw it away.

### 1.5 Rerank scores are advisory, and disagree with the refusal gate

`rerank_chunks` (`main.py:2654`) returns 0 to 9 per chunk and nothing prunes on it.
All five chunks go to the answering model regardless of score.

The result is two opposite failures in one incident:

- "is ammonia in FSSAI product list" - every chunk scored 0, all five were passed anyway, and the model had to do the rejecting itself.
- "List of product as FSSAI" - chunks scored **9**, including the list parent, and the turn STILL refused with confidence 0.

So the rerank signal and the refusal gate are two independent judgments that can contradict each other, and neither is authoritative.
Whatever is decided here has to be one decision, not two.

Worth recording explicitly: the reranker was not broken during the incident.
Zero `[RERANKER] Failed` lines in the Render logs for 2026-08-18 to 2026-08-25, so those score-0 values are genuine model judgments and not the exception fallback.

## 2. What this is NOT

**It is not the Render memory ceiling.**
See §5.
Investigated first, ruled out on evidence.

**It is not a knowledge gap.**
The content is trained and retrievable.
No re-training is required and none should be done in response to the `Has gaps` badges.

**It is not Slice H.**
[[bot-output-quality]] measured the gated `top_k` raise and recommended NOT building it.
Nothing here changes that.
The problem is duplicates inside the existing 5 slots, not that 5 is too few.

**It is not a new chunker.**
`services/chunking.py` already exists on `feature/entity-safe-ingestion` and, tested against this exact page, already fixes it (§7).
Do not write a second chunker, and do not re-solve this.
The remaining work is wiring, merging and re-training, which is [[entity-safe-ingestion]] Phase 2 resuming, not a new slice.

**It is not something re-training alone fixes.**
The fix is unmerged AND unwired: `run_training_job` on that branch still calls `RecursiveCharacterTextSplitter` directly.
Re-training Expresolv today reproduces the current chunks byte for byte (§7 test A).
Order matters: wire, merge, then re-train. Re-training first is wasted effort.

## 3. Phases

Ordered so that each phase is independently shippable and the cheap high-value work lands first.

### Phase 1 - dedupe resolved parents in retrieval

Smallest change, largest measured effect, no migration, no re-ingest, benefits every tenant immediately.

Deduplicate on the resolved `content_id` so one parent occupies at most one slot, keeping its best rank.
Both the shared path and `_byod_retrieve_knowledge` (`main.py:2638`) must change together or the two paths drift, the same trap [[entity-safe-ingestion]] recorded for the ingest pair.

Open question for this phase, decide with a measurement rather than a guess: after dedupe, does `limit=15` still yield 5 distinct parents on real queries, or does the candidate window need to widen to compensate?
The FSSAI document collapses 18 children into 5 parents, so a 15-candidate window can plausibly surface fewer than 5 distinct parents.

Proof of success: replay the eight incident turns and confirm no `content_id` appears twice in `sources`, and that the 34-item turn now sees `1a7bb141`.
The replay probe from [[bot-output-quality]] Slice H already exists and should be reused rather than rebuilt.

### Phase 2 - history-aware query rewriting

Rewrite the visitor's message into a standalone query using the session history before embedding and before BM25.
Cheap to state, and the most likely of these phases to introduce new failures, so it needs its own eval set.

Trap to design against up front: the rewrite is another LLM call in the hot path, and §1.3 is a complaint about exactly that kind of nondeterminism.
A rewrite that hallucinates a subject is worse than no rewrite.
Constrain it to resolving references against the actual prior turns, and measure it against the transcripts where the retriever currently drifts.

Also note `exact_query_cache` keys on the message with an empty-history condition (`main.py:3520`).
Confirm the rewrite does not silently change what is cacheable.

### Phase 3 - wire the chunker that already exists, then re-train

**This phase shrank from "build structure-aware PDF extraction" to "resume [[entity-safe-ingestion]] Phase 2", because the measurement that was supposed to open this phase has now been run and came back positive (§7).**
Do not build a new chunker.

The work is what that plan's Phase 2 always said it was:

- Wire `services/chunking.py` into `run_training_job` in place of the two `RecursiveCharacterTextSplitter` calls (`main.py:8475-8483`).
- The migration adding `company_knowledge.context TEXT`, additive, applied dark per the 0037 precedent.
- Retrieval composing `context` + `content`, with `word_count` still counting `content` only.
- BYOD's `(parent, child)` tuple (`main.py:8497`) becoming a triple or dataclass so the two ingest paths do not drift.

Both owner decisions this needs were already taken on 2026-08-12 and should not be re-litigated: store repeated headers once and prepend at retrieval, and re-ingest via a per-source re-index button.

Ingest-only, so it ships with zero observable effect until content is re-ingested.
Improvement and re-ingest are two events.
Expresolv's PDF specifically must be re-indexed after the merge, and it was NOT covered by their 2026-08-13 re-train, which touched the URL sources only.

**D1, decided by the owner 2026-08-25: handle a list of ANY length, so that nobody has to think about list size when a client uploads a longer document.**
BUILT the same day, suite green - see §9.
The 1500-char boundary §7 found is gone, so this phase is now purely the wiring listed above.

### Phase 4 - one grounding decision instead of two

Reconcile §1.5.
Either the rerank score gates the answer, or the refusal gate owns the decision and the score is presentation only.
Do not ship both judging independently.

This overlaps the grounding gate that [[agent-behaviour-audit]] named as the missing component and [[bot-output-quality]] partially delivered as G checks 1 and 2.
Read those first.
Phase 4 is a reconciliation, not a new subsystem.

### Phase 5 - HyDE bypass for list and enumeration queries

Extend the `_is_entity_lookup_query` precedent to enumeration requests, or retire HyDE.
Deliberately last, because Phases 1 and 2 may remove enough variance that this is no longer worth the risk of a classifier that mislabels.
Measure before building.

### Phase 6 - fix the false `Has gaps` badges

Once Phases 1 to 3 land, the incident turns stop being `no_data` and the badges resolve themselves.
What does NOT resolve itself is that the dashboard presented a retrieval failure as a content gap, which is advice that damages the corpus when followed.
Decide whether `Has gaps` needs to distinguish "nothing trained matches" from "something matched and the turn still refused".
`sources` already carries the data to tell those apart, since a refusal with score-9 chunks is visibly not a content gap.

## 4. Separate bug found in the same logs, unrelated to any of the above

Both owner-facing request list endpoints have been returning 500 in production since 2026-07-05.

```
list_quote_requests error: operator does not exist: text = uuid
list_agent_requests error: operator does not exist: text = uuid
```

`main.py:5896` and `main.py:6036` join `agent_sessions` to pull `lead_profile -> 'qualification'`:

```sql
LEFT JOIN agent_sessions s ON s.session_id = q.session_id AND s.company_id = q.company_id
```

`agent_sessions.company_id` is `text`.
`quote_requests.company_id` and `agent_requests.company_id` are both `uuid`.
Postgres rejects the comparison at plan time, so these endpoints fail unconditionally, not just when rows exist.

Introduced by `c0bd1d6a` (2026-07-05, chemical agent hardening Phase 5 autonomous qualification), which is the commit that added the qualification join.
The qualification field it was added to serve has therefore never once been delivered.

Two things to settle rather than reflexively casting in the query:
whether the fix is a cast at the join or a column type correction with a migration,
and whether anything else compares `agent_sessions.company_id` against a `uuid` column.
`session_id` is `text` on all three tables, so only `company_id` is affected.

This is its own commit, per the atomicity rule.
It does not belong in any phase above.

## 5. Render memory, investigated and ruled out as a cause

The service was sitting at 96 to 99 percent of its memory limit when the incident happened, which is why it was suspected.
It is not the cause, and the evidence is clean.

`SapyAI` (`srv-d6vjl2ffte5s73dtpks0`), Starter plan, 512 MiB limit, `gunicorn -w 2 -k uvicorn.workers.UvicornWorker`.

Ruled out because:

- At 06:19 to 07:16 on 2026-08-22 memory was flat at 527 to 528 MB.
  No spike, no dip, no correlation with any of the eight turns.
- Zero OOM kills, SIGKILLs or worker timeouts in the logs for 2026-08-18 to 2026-08-25.
- Zero `[RERANKER] Failed` entries, so the reranker was healthy throughout.
- Instance `-276pm` ran unbroken from 2026-08-13 through 2026-08-25.
  No restarts during or near the incident.
- CPU sat at 0.003 cores.
  Nothing was under pressure.
- Every failure in §1 is deterministic and reproducible from the stored chunks and `sources` at any memory level.

**It is still a real problem on its own track.**
Every instance shows the same ramp:

| Instance | First reading | After 2 to 3 days |
|---|---|---|
| `-68bls` (from 2026-07-31) | 355 MB | 529 MB |
| `-rd2p9` (from 2026-08-10) | 339 MB | 524 MB |
| `-276pm` (from 2026-08-13) | 423 MB | 533 MB, 99.4 percent |

Boot is already 300 to 420 MB of 512 MiB with 2 workers, and the process climbs to a plateau just under the ceiling within 2 to 3 days, then sits there.
The periodic drops without restarts say part of that is reclaimable page cache, so do not call it a confirmed leak on this evidence alone.
The ramp being consistent and instance-scoped is what makes it worth measuring properly.

There is effectively no headroom.
Nothing has OOMed yet.
A concurrent PDF ingest or a retrain while the process sits at 99 percent is the plausible first casualty, which matters more than usual because Phase 3 is a PDF ingest change.

Recommended handling: treat as a capacity item, not a bug hunt, until there is a reason to think otherwise.
Raise the plan or drop to 1 worker to buy headroom, and only then decide whether the ramp deserves a real investigation.
Do not schedule Phase 3 re-ingest work against a process sitting at 99 percent.

## 6. Evidence

Everything above was read from production, not reasoned from code alone.

- `chat_logs` rows for sessions `5465ee61`, `592bc5d6`, `0e25f4bf`, including the full `sources` array per turn.
  That column exists because of [[agent-conversation-gaps]] Slice D, and it is the reason this diagnosis took hours instead of days.
  It is the second incident it has paid for.
- `company_knowledge` rows for `food additives at expresolv.pdf`, all 5 parents and 18 children with their `parent_id` links and content.
- Render metrics for `srv-d6vjl2ffte5s73dtpks0`, memory and CPU and instance count, 2026-07-28 to 2026-08-25.
- Render logs for the same service across the incident window and the surrounding week.
- `information_schema.columns` for the `text` versus `uuid` mismatch in §4.

## 7. Test - would re-training fix this?

Asked 2026-08-25 because a chunking fix was believed shipped and Expresolv known not to have re-trained.
Run rather than reasoned about, since the whole question is whether stored chunks match what current code would produce.

Method: reconstruct the source page by removing the 143-char overlap between the two stored parents (`1b70c890` + `1a7bb141`), giving 1643 chars containing all 39 items, then run both splitters against it.
Script kept out of the repo, it is a one-shot probe rather than a fixture.

**Test A - current `MainV2` splitter, 1500/150.**

Reproduces the two stored rows byte for byte, so the reconstruction is faithful and today's code still produces the defect.

| parent | chars | items |
|---|---|---|
| 1 | 1490 | 1-34 (34/39) |
| 2 | 296 | 29-39 (11/39) |

Parents holding the whole list: **0**.

**Test B - `services/chunking.py` from `feature/entity-safe-ingestion`.**

| parent | chars | items |
|---|---|---|
| 1 | 447 | none |
| 2 | 1193 | **1-39 (39/39)** |

Parents holding the whole list: **1**.

**Conclusions.**

1. The chunks are not stale relative to shipped code, so re-training today changes nothing.
   The splitter has been untouched since 2026-04-22 and this PDF was ingested 2026-08-06.
2. The fix exists and works on this document, but is unmerged and unwired, so the blocker is not Expresolv's re-train.
3. Sequence is wire, merge, re-train.
   Re-training before the merge is wasted effort.

**The mechanism is narrower than it looks, and this is the part worth remembering.**
The segmenter classifies both blocks as `paragraph`, not `list`.
The list survives because a blank line splits the page into two blocks and the second one, at 1193 chars, fits inside the 1500 parent budget and is packed whole.

It is not being held atomic.
Swept across list lengths, one parent holds the whole list at 39 items (1370 chars) and **fails from 50 items (1734 chars) upward**, which is simply the parent budget.
The same sweep with single-spaced numbering, which the segmenter does classify as `list`, fails at exactly the same point, confirming the block kind is not what saves it.

Incidentally, the PDF's double space after each number (`1.  Acetic acid`) defeats `_LIST_ITEM`, which expects `\d+\. \S`.
That is why a numbered list arrives as a paragraph.
Worth knowing before anyone relies on `list` classification for PDF content.

Expresolv's list is 1370 chars and therefore inside the safe range.
A longer client list would fail, which is what the gap noted in Phase 3 is about.

## 8. Next

Owner decision on where to start.
Phase 1 is the recommendation: it is small, it needs no migration and no re-ingest, it helps every tenant, and it is the one change that would have turned the 34-item answer into the 39-item answer on its own.

Phase 3 is the honest fix for the reported symptom but is the largest piece of work, and its first task is a measurement that could shrink it substantially.

§4 is independent of all of it and can be fixed at any time.

## 9. D1 built - lists of any length, 2026-08-25

Branch `feature/list-atomic-chunking`, off `feature/entity-safe-ingestion` because that is where the chunker lives.
Committed: nothing, working tree only.
Suite: 2571 passed, 134 skipped (baseline 2559 + 12 new tests).

Three changes to `services/chunking.py`, all small:

1. **`_LIST_ITEM` now accepts `\s+` after the marker instead of one space.**
   A PDF renders `1.  Acetic acid` with two, so every numbered list extracted from a PDF was classified as prose.
   That misclassification is what routed the list into the sentence splitter in the first place.
2. **An oversized list is cut between items.**
   The row-packing loop that `_split_table` already used is now `_split_lines`, shared by both, because a table row and a list item are the same kind of promise: the line is the record, so the line boundary is the only honest seam.
3. **Every part of a split list carries the line that introduces it**, via `_lead_in`, which takes the previous paragraph's last line when it ends in a colon.
   This is the list's answer to a table's header row.
   `35. Sodium metabisulphite` on its own is unusable; `A comprehensive range of food-grade additives:` travelling with it is not.
   It rides in `context`, so it is charged once, consistent with the D-Q1 decision for table headers.

A fourth change was needed and is easy to miss: **`_children_for` re-segments rather than sentence-splits.**
Children are what actually get embedded and searched, so a parent that correctly holds a list together was still handing severed items to the index.

Verified against the real Expresolv page and a synthetic sweep at 39, 50, 60, 100, 140, 300 and 600 items (up to ~21,000 chars):
every item present exactly once, no item in two parents, every part carrying its label, and no child severing an item.
A list that fits in one parent is still packed whole, so the narrow case did not regress.

Deliberately NOT done: making `list` atomic.
Atomic means never cut, which for a 600-item list means one enormous chunk.
Divisible at item boundaries is the correct shape, and it is what tables already do.

## 10. Phase 3 wiring built - 2026-08-25

Commit `6a31951b`, on `feature/list-atomic-chunking`.
Suite 2749 passed / 134 skipped. `npx eslint src public` 0 errors.
NOT merged, NOT applied to any database.

`MainV2` was merged into the branch first, since it had moved 26 commits ahead and carried migration 0038.
None of those commits touch `main.py`, so the merge was clean and the suite stayed green.

What landed:

- `run_training_job` calls `chunking.split` instead of the two `RecursiveCharacterTextSplitter` passes.
- Migration `0039` adds `company_knowledge.context`, additive and idempotent, no backfill.
  NULL reads as "no context", which is exactly the pre-migration behaviour, so existing rows are unaffected.
- The same additive column lands on tenant databases through `_build_schema_sql`, following the `word_count` precedent.
- `word_count` still counts `content` alone, so no existing tenant's quota moves.
- The child is embedded from `retrievable_text`, so the vector sees the label while the billed text does not.
  Stored vector and billed text differ deliberately.
- Retrieval rejoins context and content in SQL, in both the hybrid and the pure-vector branches.
- BYOD's `(parent, child)` tuple became `byod_ingest.ChunkPair`, carrying both contexts.
  Legacy 2-tuples still normalise, and dedup identity stays on child content alone, so a reworded heading does not re-embed an unchanged page.

Tests added: three in `tests/test_training_chunking_wiring.py` driving a real `run_training_job` and capturing what reaches ingest, plus three in the BYOD ingest suite.
The wiring test deliberately asserts on the seam rather than re-testing the chunker, which has its own suite.

**Still required before any of this reaches a client, in this order:**

1. Apply `0039` to the prod control DB, dark, then stamp - per the `migration-apply-dark` precedent. NOT DONE, and it is a production database change that needs the owner's go-ahead.
2. Merge to `MainV2` via PR.
3. Re-index Expresolv's `food additives at expresolv.pdf` specifically.
   Their 2026-08-13 re-train covered URL sources only, so this will not happen incidentally.

**One thing to watch on the first re-ingest, flagged not fixed.**
Billed words fall when headers and lead-ins stop being billed per chunk ([[entity-safe-ingestion]] measured -14% on real pages).
`replacement_shrink_reason` refuses an upsert that collapses a source to under a quarter of its stored words, so a 14% fall is comfortably inside the guard.
It is worth re-checking on the first real re-index rather than assuming, because the guard fires on the billed number and that number is now defined differently.
