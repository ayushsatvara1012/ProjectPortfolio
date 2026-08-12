# Entity-Safe Ingestion (audit Slice C)

Date: 2026-08-12.
Branch: `feature/entity-safe-ingestion`, off MainV2 at `f9fc4f93`.
Status: Phases 0-1 DONE 2026-08-12. Phase 1 is built but NOT wired in - `run_training_job` still uses the old splitter until Phase 2.

Source finding: `docs/audit-agent-behaviour.md` E2, ranked 4th by wrong-answer risk.
Chosen as the next slice over Slice A (grounding gate) on the audit's own §6 warning: the gate ships badly on badly-cut chunks, so the chunks get fixed first.

Relates to `docs/agent-runtime-restructure-plan.md`, which deliberately excluded this and left the scaffold it lands on.

---

## 0. What the audit said, and what is actually true

The audit's claim (E2) is that chunking "splits entity blocks, so a name lands in one chunk and a phone number in the next", and that this is the mechanical origin of the contact fabrication.

That is directionally right and mechanically wrong, and the difference decides the fix.
Both cases below were reproduced against the real extractor and the real splitter settings before this plan was written.

### 0.1 What does not happen

For a contact table smaller than one parent chunk, the row survives.
`services/html_extract.py` renders an HTML table as a markdown pipe table, and `RecursiveCharacterTextSplitter` prefers newline boundaries, so a 4-column row of ~80 characters is never cut mid-row.
Retrieval then returns the **parent**, and the parent still holds the header.
The model sees a labelled table. This case is fine today.

### 0.2 What does happen

Two real defects, both reproduced.

**Defect 1 - the header is lost for every parent after the first.**
A 30-row team table renders to 2,590 characters, which is 3 parents at `chunk_size=1500`.

```
PARENT 0 (11 chars)   header_present=False   "## Our Team"
PARENT 1 (1485 chars) header_present=True    rows 00-15
PARENT 2 (1175 chars) header_present=False   rows 16-29
```

14 of 30 people are retrievable only as unlabelled 4-tuples:

```
| Person 16 Name | Role Title Number 16 | +91 98200 00016 | person16@acme.example |
```

Nothing in that chunk says which field is a role and which is a phone.
The model is left to infer column meaning from value shape - and inferring "the thing that looks like a phone number is this person's phone number" is exactly the confident-wrong-answer surface the audit is about.
With two adjacent rows in one chunk and no header, pairing the wrong name to the wrong number is a single plausible inference away.

**Defect 2 - headings are orphaned from what they introduce.**
`## Our Team` becomes its own 11-character parent.
The words "Our Team" therefore never accompany a single person's row, in any chunk, at any point.
A visitor asking "who is on your team" has no chunk whose text contains both the question's framing and an answer.

### 0.3 Why this is a smaller slice than the audit implies

The audit assumed extraction was part of the problem and scoped Slice C as "source-type-aware extraction".
It is not needed.
`services/html_extract.py` already preserves the structure: markdown headings, markdown pipe tables, `dl`/`dt`/`dd` as bolded terms, and JSON-LD entities flattened to `- key: value` blocks (`_collect_jsonld`, `_flatten_entity`).

The structure is present in the text and is then discarded by a splitter that counts characters and knows nothing about it.

**So this slice is not "write an extractor". It is "stop the splitter destroying what the extractor already marked".**
That is a much narrower change with a much higher confidence of being correct.

---

## 0.4 Validation against REAL customer pages, 2026-08-12 - the uncomfortable result

Before wiring Phase 1 in, the same harness was run over the five most-trained live URLs, taken from `company_knowledge` in prod.

| page | tables found | defects (old) | defects (new) | children old -> new | billed words old -> new |
|---|---|---|---|---|---|
| expresolv.com/leadership | 0 | **0** | 0 | 39 -> 16 | 566 -> 486 |
| expresolv.com/ | 0 | **0** | 0 | 76 -> 42 | 1,505 -> 1,237 |
| sapybase.com/pricing | 0 | **0** | 0 | 62 -> 46 | 1,828 -> 1,496 |
| sapybase.com/docs | 0 | **0** | 0 | 114 -> 87 | 3,460 -> 3,096 |
| spdesigning.com/designs | 0 | **0** | 0 | 40 -> 26 | 1,035 -> 863 |
| **total** | **0** | **0** | **0** | 331 -> **217** | 8,394 -> **7,178** |

**Not one real page contains an HTML table.** The correctness defect this slice was built to fix does not occur anywhere in the currently trained content.
The fixture corpus was not wrong about the mechanism - it was wrong about the prevalence.

This matters most for `expresolv.com/leadership`, which is the staff-directory page behind the live fabricated-contact incident.
It is built from divs and prose, not a table, so **this slice does nothing for the incident that motivated it.**
That failure is a prose-pathway failure, which is what audit Slices A (grounding gate) and E (structured directory + tool) exist to fix.

What the slice does deliver on real content is real but different from what was claimed:

- **34% fewer chunks** (331 -> 217) and **14% fewer billed words** (8,394 -> 7,178), because headings stopped being billed per chunk and blocks pack whole.
- Fewer, more coherent retrieval units. Plausibly better retrieval, **not measured** - do not claim it without measuring.
- Insurance: the moment any tenant trains a page with a real table, the defect would have appeared. It now cannot.

**Consequence for sequencing.** The correctness argument for shipping this ahead of Slices A and E does not survive contact with the real corpus.
Phase 2 should be justified on cost and robustness, or deferred behind the slices that address the prose pathway.
Recorded here rather than quietly proceeding, because the plan's own §0 was built on the opposite assumption.

---

## 1. Scope

In scope:

- A structure-aware splitter that replaces the two `RecursiveCharacterTextSplitter` calls in `run_training_job` (`main.py:8388-8399`).
- Table integrity: never split a row; repeat the header when a table spans parents.
- Heading attachment: a heading belongs to the block it introduces.
- FAQ pair and definition-list atomicity.
- A chunk-integrity test suite with fixtures, per audit §7 item 5.

Out of scope, deliberately:

- Structured contacts/FAQ **tables and tools** - that is Slice E, and it depends on this landing first.
- The grounding gate and its calibration - Slice A.
- Identifier retrieval, trigram indexing - Slice D.
- Changing what `html_extract` produces. It is already correct for this purpose.
- The PDF path, until Phase 0 measures it. See §5.

---

## 2. The two traps that decide the design

### 2.1 Repeating the header costs the tenant quota

`word_count` is stored per child row and summed for the quota (`main.py:8457`, `8506`, `9003`).
Repeating a table header into every chunk of a long table therefore **charges the tenant for it, once per chunk**.

A 30-row table split into 3 parts would bill the header 3 times instead of once.
On a wide table with long column names, that is not a rounding error.

There is already a related inconsistency to not make worse: the pre-flight quota gate at `main.py:9230` counts words in the **raw document** (`sum(len(d.page_content.split()) for d in docs)`), while the charge is the sum over **child chunks**, which already double-counts `chunk_overlap=50` words.
The gate can pass and the stored count can exceed the limit.

**Decision needed before Phase 2 - see §6 Q1.**

### 2.2 Every existing tenant is chunked the old way

Chunking happens at ingest.
Nothing changes for existing content until it is re-ingested, so this slice ships with zero observable effect until a re-train happens.

That is the audit's own operational warning applied to this slice: shipping the improvement and the re-ingest separately means the improvement looks like a no-op, and shipping a forced re-ingest for every tenant at once is a large unannounced cost.

**Decision needed before Phase 4 - see §6 Q2.**

---

## 3. Design

New module `services/chunking.py`, pure and dependency-free so it is testable without a DB, an LLM, or Redis.

### 3.1 Block segmentation

Parse the extracted markdown into a list of typed blocks, in document order:

| Block | Recognised by | Atomic? |
|---|---|---|
| `heading` | `^#{1,6} ` | attaches forward |
| `table` | consecutive `^\|` lines with a `\| --- \|` rule | rows atomic, header repeatable |
| `definition` | `**term**` followed by its body | yes |
| `entity` | JSON-LD `- Type` block and its indented `- key: value` children | yes |
| `list` | consecutive `^[-*] ` or `^\d+\. ` | item atomic |
| `paragraph` | anything else | splittable on sentence boundary |

A block is the unit the packer moves.
Only `paragraph` may be cut internally, and only at a sentence boundary.

### 3.2 Packing into parents

Greedy pack blocks into parents up to ~1500 characters, with these rules:

1. A heading never ends a parent - it moves forward to sit with the block it introduces. This fixes defect 2.
2. A table that fits goes in whole.
3. A table that does not fit splits **at row boundaries only**, and every part after the first is prefixed with the table's header row plus the separator rule, and with the nearest enclosing heading. This fixes defect 1.
4. An `entity` or `definition` block that alone exceeds the budget gets its own oversized parent rather than being cut. An over-long parent is a cost problem; a cut entity is a correctness problem.

### 3.3 Children

Children are what get embedded and searched, so a child must be independently interpretable.

- Within a table parent, each child is one or more whole rows, always carrying the header and the enclosing heading.
- Within a prose parent, keep today's ~300-character behaviour but cut on sentence boundaries.
- `entity` and `definition` blocks are a single child each, never subdivided.

### 3.4 What stays exactly as it is

- `skip_splitting=True` for tabular uploads. It is already correct - one row per chunk, no parent - and `catalog_import` already routes structured product sheets to typed tables ahead of it.
- The parent-child retrieval contract: children embedded, parent returned.
- The atomic temp-swap ingest sequence.
- The BYOD branch's `(parent, child)` tuple shape (`main.py:8413`).

---

## 4. Phases

Each phase is independently shippable with the suite green.

**Phase 0 - Measurement. DONE 2026-08-12.**
`tests/chunk_metrics.py` (the instrument) and `tests/chunk_fixtures.py` (the corpus).
Neither is named `test_*`, so pytest does not collect them; they are imported by the real tests that later phases add.
The corpus is raw **HTML**, not hand-written markdown, so it exercises the real extractor rather than flattering the chunker.

Baseline against today's splitter, measured on parents, since parent content is what retrieval hands the model:

| fixture | chunks | words | orphan headings | headerless tables | split rows | split entities | split definitions | defects |
|---|---|---|---|---|---|---|---|---|
| team_small | 1 | 69 | 0 | 0 | 0 | 0 | 0 | **0** |
| team_large | 3 | 517 | 1 | 1 | 0 | 0 | 0 | **2** |
| locations | 4 | 863 | 1 | 2 | 0 | 0 | 0 | **3** |
| faq | 5 | 1144 | 0 | 0 | 0 | 0 | 0 | **0** |
| faq_long_answers | 6 | 1359 | 0 | 0 | 0 | 0 | 0 | **0** |
| jsonld_contact | 1 | 63 | 0 | 0 | 0 | 0 | 0 | **0** |
| policy | 2 | 407 | 0 | 0 | 0 | 0 | 0 | **0** |
| **total** | | | **3** | **3** | **0** | **0** | **0** | **5** |

Three findings, all of which narrow the work:

**(a) The defect is exactly "a table longer than one parent", and nothing else.**
Every defect in the corpus is a table that outgrew 1500 characters.
`split_rows` is 0 everywhere: rows are genuinely never cut, because the extractor emits one row per line and the recursive splitter prefers newline boundaries.
So §3's row-atomicity rule is a guarantee to preserve, not a bug to fix, and the whole of Phase 1/2's value is header repetition plus heading attachment.

**(b) FAQ pairs do not break today, and Phase 3 is narrower than planned.**
`dt`/`dd` render as `**term**` plus a blank-line-separated body, so the splitter lands boundaries between pairs.
This holds even for long answers - `faq_long_answers` scores 0.
The boundary was measured directly: a pair splits only once its **answer alone exceeds one parent**.

```
answer_chars=1170  parents=1  split_definitions=0
answer_chars=2350  parents=5  split_definitions=1
answer_chars=3530  parents=6  split_definitions=1
```

Phase 3 is therefore justified only for answers longer than ~1500 characters, which is a real but uncommon shape.
It should be demoted below Phase 4 unless a real client page shows it.

**(c) The instrument was wrong once, and was fixed before the baseline was recorded.**
The first version had no `split_definitions` metric, so it reported FAQ as clean without being able to see the failure at all.
A metric set that cannot express a defect will always report its absence.

**PDF path, answering §5:** structure is lost at extraction, so this slice is a **no-op for PDFs**.
`process_pdf_efficiently` uses `PdfReader.extract_text()`, verified against a PDF whose table is drawn as positioned text - which is what a real PDF table is:

```
Name Role Phone Email
Priya Raman Head of QA +91 98200 11111 priya@acme.example
```

One line per visual row, so rows survive, but there are no cell delimiters and nothing marks the header.
The block segmenter cannot detect it as a table, and column boundaries are unrecoverable - "Head of QA" and a multi-word cell are indistinguishable from a space-separated pair of cells.
The vision fallback does emit markdown tables, but it only fires for scanned PDFs (`len(total_text) < 100`) and samples 3 pages.
Fixing PDFs is a separate extraction slice, exactly as the audit originally framed Slice C; it is **not** attempted here.

**Phase 1 - `services/chunking.py`. DONE 2026-08-12.**
`services/chunking.py` plus `tests/test_chunking.py` (36 tests).
Pure module - no DB, no LLM, no Redis, no config - so it is tested on text alone.

`Chunk` carries `content` and `context` as separate fields, which is Q1's decision made structural: `content` is verbatim page text and is what `word_count` bills, `context` is the enclosing headings plus the table header row, and `retrievable_text` is the two joined - what gets embedded and what the model reads.

Measured against the Phase 0 baseline, same harness, same corpus:

| | old splitter | new chunker |
|---|---|---|
| defects | **5** | **0** |
| children (embedded + billed) | 135 | **119** |
| billed words | 4,626 | **4,257** |

Both cost numbers move the right way, which is the point of the `context` split: headers and headings stopped being billed once per chunk.
`tests/test_chunking.py::TestCost` locks both, because scoring zero defects by never splitting anything would be trivial otherwise.

**One real bug found by the corpus rather than by design.** The packer originally held a single pending heading, so `### Clause 0` overwrote `## Shipping and returns` and no chunk could say which document the clause belonged to. Headings are now a **stack**: a deeper heading nests, a sibling pops. `test_a_subheading_does_not_erase_its_parent` and `test_a_sibling_heading_pops_the_previous_one` cover it.

**One test was wrong before the code was.** `test_no_content_is_lost` asserted against `chunk.content` and therefore reported the heading fix as data loss - the heading had moved into `context` by design. It now asserts against `retrievable_text`, with a companion test proving table body rows still appear in billed content and the header still reaches every part.

**Phase 2 - Wire into `run_training_job`.**
Replace the two splitter calls.
Resolve the quota question (§6 Q1) before this lands, since it changes stored word counts.
Phase 0's harness re-run becomes the acceptance evidence.

**Phase 3 - FAQ and definition atomicity.**
Q/A pairs and `dl` blocks, which Phase 1 handles structurally but which deserve their own fixtures and assertions - the audit ranks FAQ pairs as the second-highest-value structured kind.

**Phase 4 - Re-ingest.**
Whatever §6 Q2 decides.
At minimum: an owner-visible "re-train to improve answer quality" affordance on the Train page, and a way to re-run ingestion for one source without the owner re-uploading the file.

---

## 5. Open question this plan does not answer yet

Whether the PDF path (`process_pdf_efficiently`, `main.py:8127`) preserves table structure at all.
If it flattens tables to prose before chunking, then for PDFs this slice is a no-op and the real fix is in extraction - which would be a genuine "source-type-aware extraction" sub-slice, exactly as the audit originally framed it.
Phase 0 measures this before any commitment is made.

---

## 6. Owner decisions (both taken 2026-08-12)

**Q1 - Who pays for repeated table headers? DECIDED: (c) store once, prepend at retrieval.**
The header and the enclosing heading are stored **once**, in a new `company_knowledge.context` column, and prepended to the chunk when it is retrieved.
The tenant is never billed for structural context they did not write, and the chunk text stays exactly the content that was on the page.

Consequences this slice must carry:

- A migration adding `context TEXT` to `company_knowledge` (additive, nullable, `IF NOT EXISTS`), applied dark per the 0037 precedent.
- The retrieval path composes `context + content` when building what the model sees. `word_count` continues to count `content` only, so quota semantics are unchanged and no existing tenant's usage moves.
- The embedding question is now explicit and must be answered in Phase 1: is the child embedded with or without its context prefix? Embedding **with** context is what makes "who is on your team" retrieve a row at all (defect 2), so the current intent is with-context for the embedding and with-context for what the model reads, while `word_count` still bills without. That means the stored vector and the billed text deliberately differ - write it down where the next reader will find it.
- BYOD's `(parent, child)` tuple shape (`main.py:8413`) becomes a triple or a small dataclass. Do not let the two paths drift.

**Q2 - How does existing content get re-chunked? DECIDED: (b) per-source re-index button.**
Owner-triggered, one source at a time, from the Train page.
No forced migration, no surprise embedding bill, and the owner sees the improvement when they ask for it.

Consequences:

- Re-index must reuse the existing atomic temp-swap so a re-index that fails leaves the old rows serving.
- It re-chunks and re-embeds from the **stored** content where possible, so the owner does not have to re-upload the original file. Whether the original text is recoverable per source type is a Phase 4 question - a URL source can be re-scraped, an uploaded PDF may not be recoverable and may need the file again. Establish this before building the button, not after.
- It is the natural place to show the owner what improved: chunk count before/after is a legible proxy.

---

## 7. Do not regress

- `catalog_import` routing structured product sheets to typed tables before any chunking happens.
- `skip_splitting` for tabular uploads.
- Quota counting children only, parents free.
- The atomic temp-swap: new rows under a temp key, verified, renamed, old rows deleted.
- The conflicting-`metadata["source"]` guard at `main.py:8359` - it prevents cross-source data loss.
