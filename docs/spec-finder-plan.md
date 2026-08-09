# Specification Finder - plan

Chemical vertical.
Turn the existing `Product specs` hub card into a specification-sheet lookup against the company's own Google Drive folder.

> Reads alongside `docs/coa-finder-plan.md` and `docs/coa-confidential-access-plan.md`, **not** as a variant of them.
> COA and specs look alike and are not alike: certificates are confidential and release one document or nothing, specifications are public and are meant to be browsed.
> The only thing shared is plumbing with no policy in it.

## 0. Status - 2026-08-09

**All four phases BUILT, uncommitted.**
No migration exists and none is needed (D7).

| Phase | State |
|---|---|
| 1 - spec Drive module | **Done** - `services/spec_drive.py`, 64 tests |
| 2 - config + dashboard field | **Done** - two folder fields, owner endpoints, 73 tests |
| 3 - visitor endpoint + panel | **Done** - endpoint, feature flag, card, panel; seven resolutions in §10.3 |
| 4 - chat parity | **Done** - `spec_doc` through the `_tool_executor` wrapper |

Phase 1 verification, 2026-08-09:
backend suite 2199 passed / 134 skipped (was 2135, so +64 all new).
The COA suite is 425 green and `git status` shows **no COA file modified at all** - §9.2's contract held literally, which it could not have under the old shared-engine plan (§0.3 C2).

Phase 2 verification, 2026-08-09:
backend 2259 / 134 skipped (+60), vitest 576 across 39 files (+13), tsc 0 source errors, lint 0 errors.
All 72 existing COA **frontend** tests pass unmodified through the new wrappers, and `services/coa_drive.py`, `services/coa_throttle.py` and every `test_coa_*.py` remain untouched.
Nothing is visitor-visible yet: an owner can save a specification folder and test it, but no widget surface reads it until Phase 3.

Phase 3 verification, 2026-08-09:
backend 2301 / 134 skipped (+42), vitest 603 across 40 files (+27), tsc 0 source errors, lint 0 errors.
The COA suite is green untouched again - `services/coa_drive.py`, `services/coa_throttle.py` and every `test_coa_*.py` are unmodified, so §9.2's contract has now held across all three phases.
The panel is live but inert for every existing bot: no company has a specification folder saved, so `features.spec_picker` is false everywhere and the card behaves exactly as it did (D3).

The `too_broad` state first shipped with an `MIcon name="filter_list"`, which is not in the widget's icon registry and would have rendered the literal word `filter_list` at 30px.
The COA browser pass found the same class of defect; the assertion it left behind (`coa-picker.test.tsx`, "every MIcon the widget asks for actually resolves") caught this one before a browser did.

Phase 4 verification, 2026-08-09:
backend 2322 / 134 skipped (+21), vitest 607 across 40 files (+4), tsc 0 source errors, lint 0 errors.
Like Phase 3 it is inert until a folder is saved: with no folder the executor skips the wrapper entirely and `get_product_spec` answers exactly as it does today.

The two pre-existing `tsc` errors both live in `.next/types/validator.ts`, a generated build artifact dated five days before this work.

The plan was re-analysed against the working tree on 2026-08-09 (§0.3).
Four claims in the 2026-08-08 draft did not survive that check, and six decisions changed as a result.
D5 and D6 are **dropped**, D4 is **replaced**, and the shared-engine refactor (old Phase 0) is **cancelled**.

## 0.1 The real folder, walked - 2026-08-08

The client's specification folder was walked read-only through the shipped `coa_drive` connector.
No dashboard, no dev server, no writes.

```
folder            1KCRfrRQ… (plain shared folder URL)
walk              1.79s · 4 folders · 1086 files seen · 0 non-PDF ignored
indexed           1086 · 0 unindexable · 0 duplicates collapsed · capped: ()
webViewLink       present on 1086/1086      modifiedTime present on 1086/1086
extensions        .pdf x1086 (nothing else)
tokens per file   min 3 · mode 4 · max 15 · hard_to_find (<2 tokens): 0
structure         root 988 · /Conforming Specification 78 · /Food grade 16 · /PM Spec 4
distinct products 470 leading segments · catalog holds 511 rows for this tenant
```

**Mechanically this is the healthiest folder the connector has ever been pointed at.**
Every file is a PDF, every file carries a link, nothing is unindexable, nothing is a duplicate, and no file is too thinly named to find.
The §8.1 risk - that badly named files would make the feature unusable - **did not materialise, and is now closed**.

Search behaviour was verified against the restored ranked search, not against fixtures:

| query | matches | top rows |
|---|---|---|
| `acetone` | 20 | Acetone · USP-NF · Spec / Acetone · BP · Spec / … |
| `acetone USP` | 4 | correctly narrowed |
| `hydrogen peroxide` | 6 | 6%, 30%, 50%, Concentrate all distinct |
| `isopropyl alcohol` | 41 | |
| `xylene` | 6 | |
| `nonsense9999` | 0 | |
| `spec` | **1027** | see §0.2 |
| `LR` | **219** | see §0.2 |

The two-word narrowing works exactly as the flow needs: `acetone` gives 20 candidates, `acetone USP` gives 4.
This is the "related searches" step the requirement describes, and it is real.

### 0.1.1 Filenames name the client's customers

Roughly **a quarter of the library is customer-specific, and the filename says whose it is.**

Real indexed examples, rendered in the exact display form a visitor would see:

```
Acetone · CS11 · Spec · Lupin pharma
Acetone · CS10 · Spec · Torrent
Xylene · CS2 · Spec · Intas
Isopropyl alcohol · MC7CS2 · Spec · Macleod
N,N Diisopropylethylamine · LR · CS1 · Spec · Mankind Pharma
Hydrochloric acid · 25% solution · CS1 · Spec · serum institue
```

Measured extent:

- **32 distinct customer codes** (`CS1` x63, `CS2` x29, `MC8` x25, `MC3` x23, `CS3` x19, `MC7` x14, `CS4` x14, …)
- named companies in the trailing segment: Intas (~39 files across four spellings), Apicore 9, FKOL 7, Mankind 5, Torrent 6, Emcure 4, Amneal 3, BDR 3, KRKA 2, Macleod 2, plus a long tail of single files naming Cipla, Cadila, Alkem, Akums, Apothecon, Ahlcon, Apex lab, Sentiss, Labco, MJ bio, serum institute
- **260 of 1,086 files (24%)** carry at least one token that is rare in the folder and absent from the tenant's product catalog

A browsable ranked list therefore publishes **which pharmaceutical companies buy which chemicals from this client**, and opening the document hands over a specification negotiated with a named third party.

**The owner was shown this evidence on 2026-08-08 and decided: everything in the configured folder is public and served, with no filtering.**
§3.1 records the decision and what it accepts.

### 0.1.2 One common word enumerates the library

`SPEC` appears in 1,028 of 1,086 filenames, so a query of `spec` matches 1,027.
`LR` matches 219.
With `min_query_tokens = 1` (§4.1) a visitor typing one ordinary word would otherwise get an arbitrary slice of the library, customer-named files included.
§4.1 resolves this with a selectivity guard.

The same walk also measured that 688 of 1,086 files (63%) match a catalog product by name tokens.
That figure drove D5's pinned-card design and is **no longer load-bearing** - D5 is dropped (§0.3).
It is kept because it is the honest measure of how well filenames and catalog agree, which matters if catalog matching is ever revisited.

## 0.2 What the corpus finding does not change

The connector, the walk, the cache tiers, the guard rails, the display cleaner and the ranked search are all **verified working against 1,086 real files**.
What §0.1.1 changes is the **corpus** - which documents are eligible to be served - not the machinery.

## 0.3 Re-analysis against the codebase - 2026-08-09

The 2026-08-08 draft was written against a reading of the tree, not a verification of it.
Every structural claim was re-checked.
What follows are the four that failed, and the decisions they moved.

**C1 - COA is no longer dormant in production.**
The draft justified the shared-engine refactor (old D4) with "COA is dormant in production (no bot has a folder saved), which makes this the cheapest moment the code will ever have to restructure".
A read-only query of the prod control DB on 2026-08-09 shows `Expresolv` (the live chemical client) carrying a valid 33-character `pack_overrides.coa.folder_id`.
COA is live and confidential, so a refactor of `coa_drive.py` is now a change to a shipped confidentiality boundary rather than to dead code.

**C2 - the old §9.2 regression contract could not have held.**
It required every existing COA test to stay green **unmodified**, while the S1/S2 fixes re-key `breaker_state(company_id)` and `forced_walk_key(company_id)`.
`tests/test_coa_resilience.py` imports `forced_walk_key` directly and calls `breaker_state(COMPANY_ID)` positionally.
The two requirements were mutually exclusive as written.

**C3 - the chat-parity mechanism was not implementable where it was placed.**
`get_product_spec` (`services/agent.py:427`) is synchronous, cursor-based, and receives only `company_id` - it cannot see `pack_overrides` and cannot await a Drive call.
The precedent already exists and is the answer: `_tool_executor` in `main.py:3812` special-cases `get_coa` to return a coroutine, which `services/agent.py:1485` awaits via `inspect.isawaitable`.
`_captured["spec"]` is also set there (`main.py:3928`), not in `agent.py`.

**C4 - every `main.py` line reference was ~350 lines stale** after the Slice A/B/D/E commits (`aa61ed71`, `63747833`).
Corrected throughout this document.

### 0.3.1 What the owner decided on this evidence - 2026-08-09

- **specs are not COA.** Nothing is carried over from the confidential design without being analysed first: no single refusal, no throttle, no lockout, no exact-retrieval-or-nothing. The public browsable list is the feature.
- **separate module, COA untouched.** `services/spec_drive.py` imports only the policy-free helpers from `coa_drive.py` and writes its own search. `coa_drive.py` is not edited.
- **Drive only on the result card.** D5 catalog enrichment is dropped: the panel shows the document, its date, and the link.
- **a broad query asks for more typing** rather than returning an arbitrary slice. No IDF weighting.
- **chat parity through the `main.py` wrapper**, following the `get_coa` precedent.

## 1. The requirement

The owner described the flow directly:

> User clicks the Specification button on the homepage, opens a new panel like COA, search bar to find the product name and gives the related searches so the user can select from it, after selecting the bot gives an open specs button with a link to open the specification PDF.

Restated on 2026-08-09: an advanced search bar where the visitor **enters the product name first**, sees the related specifications that exist for it in the Drive folder, picks one, and gets the link.

Read literally, that is four things.
A hub card that opens a full-screen panel.
A search box that returns **several ranked suggestions** as the visitor types.
A selection step.
A result carrying a link that opens the real document.

The third and fourth points are what separate this from the COA panel.
COA releases one certificate or nothing and shows no list at all, because a list of certificates published the client's production history.

## 2. What exists today

**There is no specification-document pipeline anywhere in the codebase.**
The word "spec" currently means catalog fields, not a PDF.

- `get_product_spec` (`services/agent.py:427`) reads the `products` table, with a `product_skus` fallback added by the conversation-gaps work, and returns name, CAS, grade, packaging and an `sds_available` boolean.
It is commercial data only.
It returns no document and no link, and it deliberately never returns the SDS URL.
- The `spec` hub card (`packs/chemical.py:205`) is `action="tool"` with `input_source="products"`.
Tapping it opens the inline mini-form product picker, sends a chat message, and the agent answers in prose with optional grade and pack chips.
- `products` carries `sds_ref` but no specification column.
Nothing indexes specification sheets in RAG, in Postgres, or on Drive.

So this is greenfield feature work on top of a mature connector.

### 2.1 What is reused, and what is deliberately not

Reused, because it contains no policy - it is HTTP, parsing and caching:

| Helper | Where |
|---|---|
| `normalize`, `tokenize`, `tokenize_filename`, `numeric_key`, `display_name` | `services/coa_drive.py:176-256` |
| `build_document`, `dedupe`, `duplicate_summary`, `thin_documents`, `is_pdf` | `services/coa_drive.py:264-375` |
| `walk_folder` and its guard rails (depth, folder, file, page caps, visited set, retry, `allDrives`) | `services/coa_drive.py:657-780` |
| cache tiers - `serialize_index`, `encode_index`, `deserialize_index`, `cache_key` | `services/coa_drive.py:781-953` |
| `folder_report`, `to_payload` | `services/coa_drive.py:1198-1246` |
| folder-URL to ID extraction and the injection/SSRF regex | `packs/overrides.py:38,220-256` |
| Owner UI shape - folder field, Test Connection, library health panel | `CoaFolderField.tsx`, `CoaLibraryPanel.tsx` |

**Not reused, because it is the confidentiality design and would be wrong here:**
`lookup`/`_matches` (exact-or-nothing, `coa_drive.py:377-425`), `services/coa_throttle.py`, the single refusal / lockout / outage message set (`chat/panels.ts:37-53`), `coaOutcome`'s one-row-or-refuse mapping, and the rule that the model never sees a filename in a visitor-facing list.

### 2.2 The ranked search already existed and was deleted

The exact search behaviour the owner described - type a name, get ranked related matches, pick one - **is the COA finder's original `search()`**, removed in `0c1eddfe` when the client reclassified certificates as confidential.

It is recoverable from `c0162cea:sapybase_ai_engine/services/coa_drive.py:398`.
It scores each query token exact, then prefix, then substring, then numeric, and runs a strict pass followed by a best-tier fallback.
It was tuned against the client's real 1,781-file folder and already carries the fix for the failure that matters most: a filler word like "drum" or "batch" must not drag the entire product catalogue into the results.

Phase 1 restores that function into `spec_drive.py` and reads it line by line rather than pasting it: it arrives with COA's constants (`MIN_QUERY_TOKENS = 2`, `MAX_RESULTS = 50`) and COA's docstrings, and both are wrong for this feature.

## 3. Locked decisions

**D1 - specification sheets are open documents.**
Browsable ranked search, a visible result list, no throttle, no lockout, no single-refusal message.
None of the `coa_confidential_access` machinery is carried over.
Re-affirmed by the owner on 2026-08-08 with §0.1.1's evidence in hand.
§3.1 records what that accepts.

**D2 - suggestions come from tokenized Drive filenames.**
A folder link is the entire onboarding.
No naming convention is encoded, no per-client regex exists, and no filename is ever parsed for meaning.
This keeps the promise that a second client with a different naming habit needs zero configuration.

**D3 - the existing `Product specs` card is repurposed, not duplicated.**
Same card, same label, same flask icon, same teal accent.
With a folder configured it opens the new panel; with no folder configured `features.spec_picker` is false and `hubCardTarget` returns `'tool'`, so the card behaves exactly as it does today.
This is the zero-regression contract and it is the reason no existing bot changes behaviour on deploy.

**D4 - separate module. `coa_drive.py` is not edited.** *(replaces the 2026-08-08 shared-engine decision)*
`services/spec_drive.py` imports the §2.1 helpers from `coa_drive` and owns its own search, its own breaker registry, its own forced-walk key prefix and its own memo.

Why it changed: the old decision rested on COA being dormant, which C1 disproved.
It also dissolves the three collisions the old plan had to fix - a breaker, a forced-walk gate and a memo keyed by company only are only a collision when two libraries share one registry, and now they do not.
The cost is duplicated plumbing at the module seam, accepted because the alternative is editing a live confidentiality boundary to make a public feature convenient.

The owner-visible half is unchanged and is a requirement: two independent folder fields, either changeable without touching the other.

**D5 - DROPPED. The result card is Drive-only.** *(was: the pinned result carries catalog facts)*
No CAS, no grades, no pack sizes, no catalog matching anywhere in this feature.
The card shows the cleaned display name, `Updated <date>`, and the Open / Download buttons.
Dropped on 2026-08-09: it only ever worked for 63% of files (§0.1.2), which meant two visibly different cards, and it added a server-side catalog token index and its whole memoization layer for a heading.

**D6 - DROPPED** along with D5. Exactly-one-or-nothing enrichment has nothing left to govern.

**D7 - no schema migration.**
The Drive folder is the source of truth and the folder link is stored in the existing `companies.pack_overrides` JSONB, exactly as the COA folder is.
No `products.spec_ref` column, no `spec_documents` table, no Alembic revision.
If the cached index ever outgrows Redis the answer is the one COA already wrote down: move to a Postgres index, and the signal is the cached entry approaching a megabyte.

**D8 - no new agent tool.**
Chat parity extends what `get_product_spec` already produces rather than declaring a `get_spec_sheet` tool.
Every added tool widens the model's choice surface and the `agent-conversation-gaps` work is currently trying to narrow it.

**D9 - a per-company confidential mode stays possible, and is not built now.**
With D4's separate module the escape hatch is cheaper than the old plan assumed: COA's exact resolver still exists, untouched, in `coa_drive.py`, so a future client needing confidential specs is a mode field that routes to a different resolver rather than a redesign.
The config shape (§10.1) leaves room for it.
Building both resolvers now would mean writing and testing a refusal path no client has asked for.

## 3.1 The corpus boundary - decided 2026-08-08

**Decision: the configured folder IS the corpus. Every PDF in it is public and served. No filtering, no allowlist, no curation step.**

It is the simplest thing that satisfies the requirement, it needs no new concepts, and D9 makes it reversible per company.

### 3.1.0 What this decision accepts

Written down plainly so nobody has to re-derive it, and so the conversation with the client is possible later without re-running the analysis:

- a visitor searching a product name can see result rows naming the client's customers (§0.1.1)
- a visitor can open a specification negotiated with a named third party
- the owner's control is **which folder they paste**, and nothing finer

None of this is a defect to be fixed in code.
It is a property of pointing a public search at a folder, and the owner has chosen it knowingly.

**The one thing that must not happen quietly** is the client discovering this from a customer rather than from us.
Whoever onboards this client should say, in one sentence, that everything in the folder they paste becomes searchable by anyone who can use the widget.
That is a conversation, not a code change, and it is the whole mitigation.
§8.3 makes the dashboard copy say the same thing.

### 3.1.1 The rule any future tightening must obey

The owner's standing instruction is that every feature is built for **all clients, not this one**.
The measured data makes that more than a principle here, because the obvious shortcuts are all client-specific grammars:

- `CS\d+` / `MC\d+` means "customer spec" is **this client's code**, not an industry convention.
The next client will use `-CUST-`, or a suffix, or nothing at all.
- A list of pharmaceutical company names is a hardcoded customer book that rots the day they win an account.
- "The trailing `_` segment is the customer" is positional filename grammar, which is exactly what D2 forbids, and it is wrong on this very folder: 625 files end in `Spec`.

So none of those may be encoded.
Whatever is chosen has to work on a folder the platform has never seen.

### 3.1.2 The generic signal that IS available

Compare filename tokens against **the tenant's own product catalog**, which every chemical bot already has.
A token that is rare in the folder and absent from the catalog is a proper-noun candidate.
On the real folder this flags **260 of 1,086 files**, and it catches the customer names correctly.

It is a **review aid and never a security boundary**, because the same run also flags `AEROSIL` (a genuine product), `AQUEOUS`, `AMINE`, `BOX`, `CHART`, `102`, `200`.
Used as a filter it would wrongly withhold a large slice of a legitimate library.
Used as a report it tells an owner exactly where to look.

Note that with D5 dropped, nothing in the shipped feature computes a catalog token index any more, so this report is no longer a by-product - it is work of its own if it is ever wanted.

### 3.1.3 If this is ever revisited

Three routes exist, in ascending cost:

1. **Owner curates the folder** - point the bot at a subfolder holding only generic specs.
Zero code; it is already how the config works.
2. **Catalog-match filter**, an owner switch, default off - "only show documents matching a product in my catalog".
Cuts this folder to 63%.
Note it is a corpus control and **not** a confidentiality control: `Acetone_CS11_Spec_Lupin pharma.pdf` matches the product "Acetone" and would still be served and still be named.
3. **Per-company confidential mode** - route that company's lookups to COA's existing exact resolver: no list, single refusal, throttle, lockout.
This discards the browsable requirement, which is why it is per-company and not the default (D9).

## 4. The matching rule

Restored from `c0162cea:398` into `spec_drive.py`, read rather than pasted.

1. Normalize query and filename through the **same** function - NFKC, uppercase, strip.
This is COA's H17 and it is non-negotiable: two normalizers means nothing ever matches.
2. Tokenize on any run of non-alphanumerics, dropping a trailing extension token.
3. Score each query token against the file's tokens: exact beats prefix beats substring beats numeric-normalized.
4. **Strict pass** - keep files where every query token hit something.
5. **Fallback pass**, only when strict found nothing - keep the files that matched the most query tokens, and only those where at least one token hit at prefix strength or better.
A substring-only hit is too weak to carry a result alone, because short filler words match half the corpus that way.
6. Sort by tokens matched, then total score, then newest `modifiedTime`, then file ID.
7. Cap the list.

### 4.1 What differs from COA

**`min_query_tokens = 1`.**
COA's floor of two exists because a one-token query was the oracle that let someone enumerate the library.
"acetone" is a legitimate specification query and the floor of two would break it.

**A selectivity guard, instead of the floor.** *(decided 2026-08-09)*
If the query matches more than a large fraction of the indexed library, the endpoint returns no rows and a `too_broad` status, and the panel says "keep typing a product name".
This is what stops `spec` (1,027 of 1,086) and `LR` (219) from returning an arbitrary slice.

It is deliberately **not** IDF weighting.
IDF would silently reorder results that were tuned and verified against a real 1,781-file folder, in exchange for solving a problem the guard already solves at the one point it appears.
The guard changes no ranking at all - it only declines a query too broad to mean anything.
The fraction is one constant, tuned against the measured numbers so `acetone` (20 of 1,086) passes comfortably and `LR` (219) does not.

**`result_limit = 8`.**
COA's old cap was 50, sized for a results page.
Eight is sized for a typeahead list a visitor scans without scrolling.

**Every docstring is rewritten.**
The restored function's comments explain a confidentiality design that no longer applies; left in place they would teach the next reader the wrong rule.

### 4.2 What stays identical

Leading-zero normalization inside numeric runs, so `26R16` still finds `26R016`.
Dedupe on identical normalized filenames with newest-`modifiedTime` winning, which is what makes a `v3` revision supersede `v2` automatically.
Nulls always lose the recency comparison rather than being compared, because comparing two missing timestamps raises.

## 5. The result card - Drive only

D5 is dropped, so there is exactly one card shape and it is derived entirely from the Drive file:

```
Acetone · USP-NF · Spec
Updated 3 months ago
[ Open spec ]   [ Download ]
```

- heading: `display_name(raw_name)`, the same cleaner the COA panel uses
- date: `modifiedTime`, rendered relative, omitted when absent rather than shown empty
- buttons: `view_url` opens, `download_url` downloads

**Downloads use `download_url`, never `view_url`.**
A Drive `webViewLink` is an HTML viewer page, so saving that blob under a `.pdf` name hands the customer a corrupt file.
This is COA's H8 and it applies identically.
The download filename's extension follows the source file rather than being hardcoded (§15).

**No catalog field ever appears here**, and no hazard, handling, storage or regulatory text ever does.
The safety guardrail is unchanged: those answers come only from `get_sds` and the real document.

## 6. Visitor experience

```
Home hub -> "Product specs"
  -> SpecPicker replaces the chat body
  -> types "acetone" (debounced) -> GET /api/widget/spec?q=acetone
  -> ranked list, up to 8:
       Acetone · USP-NF · Spec
       Acetone · BP · Spec
       Acetone · LR · Spec · v3
       Acetone Anhydrous · Spec
  -> types "acetone USP" -> narrows to 4
  -> taps one -> result pins above the still-live search box
       Acetone · USP-NF · Spec
       Updated 3 months ago
       [ Open spec ]   [ Download ]
  -> search box stays live for the next lookup
```

Pinning rather than closing is the pattern proven in `SdsPicker` by the sds-persistent-panel work.
A visitor comparing two grades should not have to return to Home between lookups.

**States the panel must handle**, all first-class because the panel replaces the whole chat body:

| state | when |
|---|---|
| `unconfigured` | no folder saved - offer the chat handoff |
| `prompt` | nothing typed yet, or too little to search - "start typing a product name" (R1) |
| `searching` | request in flight |
| `results` | 1-8 rows |
| `too_broad` | §4.1 guard tripped - "keep typing a product name" |
| `empty` | query was specific and matched nothing |
| `error` | Drive unreachable, with retry |
| `pinned` | a document is selected, search box still live |

`too_broad` and `empty` are deliberately **different** messages.
That distinction is exactly what COA's C3 forbids and exactly what a public browsable search needs: a visitor who typed too little must be told to type more, and a visitor who typed a real product we do not stock must be told we have nothing.
There is no locked state and no refusal state - those are COA's and they do not exist here (D1).

## 7. The chat path

"Send me the spec sheet for acetone" must reach the same place as the card.

**The Drive lookup lives in `main.py`'s `_tool_executor` (`main.py:3812`), not in `services/agent.py`.** *(decided 2026-08-09, C3)*
`get_product_spec` stays exactly as it is: synchronous, database-only, unchanged.
The wrapper already special-cases `get_coa` for precisely this reason - a Drive call is async and `services/agent.py:1485` awaits whatever the executor returns.

Shape:

1. `_tool_executor` runs `get_product_spec` as it does today.
2. When the observation is `found` **and** the company has a spec folder configured, it runs the resolved product's name through `spec_drive.search`.
3. A single confident match is attached to `_captured["spec_doc"]` and a **status only** goes back to the model.
4. The chat handler emits a `spec_doc` SSE event (`main.py:4048` yield block) and the widget opens the panel with that result pinned - the same shape as `{coa:{...}}` today.

**The event key must be `spec_doc`, not `spec`.**
`_captured["spec"]` is already taken by the catalog path (`main.py:3928`) and feeds `session_store.derive_title` (`session_store.py:322`) and the sales funnel (`sales_funnel.py:143`).
Reusing the key would silently change funnel behaviour.

`spec_doc` is added to the SSE yield list and to the `_actions` tuple persisted on the session (`main.py:4068`), alongside `sds`, `quote`, `form`, `handoff`, `grade_selector`, `pack_selector` and `coa`.

**H10 still applies to the model, and only to the model.**
A filename is attacker-controlled by anyone who can write to the folder, so the observation reaching the model carries a status and not a name.
The visitor sees filenames by design; the model does not.

With no folder configured, step 2 is skipped and everything behaves exactly as it does today.

## 8. Owner configuration and visibility

Two fields on the customise tab, rendered from one generalized `DriveFolderField` (the existing `CoaFolderField` parameterized by label, help text and endpoint - a frontend generalization, which touches no backend confidentiality code):

- **Certificate of Analysis - Google Drive folder** (existing, unchanged copy)
- **Specification sheets - Google Drive folder** (new)

The link the owner pastes is extracted to a folder ID by the existing `extract_folder_id` + `DRIVE_FOLDER_ID_RE` path and stored in `companies.pack_overrides` (D7 - no migration).

Each field has its own Test Connection button and its own library health panel, reusing the existing report: indexed count, files seen, non-PDF ignored, unindexable, duplicates collapsed with samples, and `hard_to_find` samples.

Test Connection remains the only action that forces a fresh walk, and the health panel reads the cache that populates.

**"Connected, 0 files" is not a success.**
A Shared Drive folder read without the `allDrives` flags returns zero files with HTTP 200 and is indistinguishable from an empty folder unless the count is a visible outcome of its own.
This is COA's H2 and the generalized field must keep it.

### 8.1 The filename-quality ceiling - CLOSED, verified 2026-08-08

The concern was that a specification visitor types a **product name**, so the search only works if product names are in the filenames, and `scan_0042.pdf` is unfindable by any design.

**The real folder answered this positively.**
Every one of 1,086 files carries its product name as the leading segment, the minimum token count is 3, and `hard_to_find` is zero.
The `hard_to_find` report stays in the panel for the next client, whose folder may not be this tidy, but it is not a risk for this deployment.

### 8.2 The pre-publish preview - DEFERRED

Deferred by §3.1 along with the curation step it was built to support.

Retained as a description because it is the cheapest possible version of the mitigation §3.1.0 names.
The idea: after Test Connection, show the indexed library **exactly as a visitor would see it** - same display cleaner, same ranked search box, same rows.
The owner types "acetone", sees the real result rows, and understands their folder in about two seconds, rather than imagining the output from a count.
It reuses the visitor search endpoint against the owner's own bot, so it is one component and no new backend.

### 8.3 The dashboard copy must be accurate

Small, and the one owner-facing thing §3.1 does require.

The COA field's help text says customers can look up a certificate by code or batch.
The specification field's text must say plainly that **every PDF in the folder becomes searchable by anyone who can use the widget**.
That sentence is the difference between an owner who chose this and an owner who was surprised by it, and it costs nothing.

## 9. Module structure

```
services/coa_drive.py     UNTOUCHED. Live, confidential, Expresolv depends on it.
services/spec_drive.py    NEW.
    from .coa_drive import (normalize, tokenize, tokenize_filename, numeric_key,
                            display_name, build_document, dedupe, is_pdf,
                            walk_folder, folder_report, to_payload,
                            CoaDriveError, ...)
    SPEC_BREAKER / _spec_breakers          own registry  -> no cross-library trip
    forced_walk_key -> "spec:forced:{company}"  own prefix -> own allowance
    _spec_index_memo                       own memo      -> own cap
    search(documents, query, limit)        restored + selectivity guard
    resolve(company_id, folder_id, q, ...) load index, search, return rows
```

### 9.1 Why the three collisions do not need fixing

The 2026-08-08 plan listed S1 (breaker keyed by company), S2 (forced-walk key keyed by company) and S3 (memo cap of 8 shared by two libraries) as bugs to fix inside a merged engine.
With D4's separate module each one **cannot occur**: `spec_drive` owns its own breaker registry, its own Redis key prefix and its own memo dict, so a revoked spec folder cannot fast-fail COA, cannot consume COA's re-walk allowance, and cannot evict COA's cached listing.

`coa_drive.INDEX_MEMO_MAX_ENTRIES = 8` stays as it is, because it still serves one library.
`spec_drive` gets its own cap, sized independently and with its worst-case memory figure stated where it is defined.

The Redis cache key needs no change either - the folder ID is already in it, and the two modules use different prefixes.

### 9.2 The regression contract

**No file under `services/coa_drive.py`, `services/coa_throttle.py`, or any `test_coa_*.py` is modified by this work.**
If an edit to one of them starts to look necessary, that is the signal that a helper is being reused across the policy boundary, and the fix is to copy the 15 lines into `spec_drive.py` rather than to bend the shared one.
Shared helpers are pure functions with no policy in them; the moment a change to one is needed to make specs work, it is not one of those.

The COA suite (`test_coa_cache`, `test_coa_config`, `test_coa_drive`, `test_coa_endpoint`, `test_coa_report`, `test_coa_resilience`, `test_coa_test_connection`, `test_coa_throttle`, `test_config_coa_folder_leak`) stays green untouched, and it is the tripwire.

## 10. Phases

| Phase | Delivers | Main files |
|---|---|---|
| 1 | `spec_drive.py`: restored ranked search + selectivity guard, own breaker/gate/memo, no COA edits | `services/spec_drive.py` (new) |
| 2 | Spec folder field + config plumbing + Test Connection + library health, per folder | `packs/overrides.py`, `db/models.py`, `main.py`, `driveLibrary.tsx`, `DriveFolderField.tsx`, `DriveLibraryPanel.tsx`, `SpecFolderField.tsx`, customize page, `BotSettingsContext.tsx` |
| 3 | `GET /api/widget/spec`, `spec_picker` card action, `SpecPicker` panel, `features.spec_picker` | `main.py`, `packs/chemical.py`, `ChatWidget.tsx`, `chat/panels.ts` |
| 4 | Chat parity via `spec_doc` SSE event through the `_tool_executor` wrapper | `main.py` |

Phases 1 and 2 change no visitor behaviour.
Phase 3 is the first phase a visitor can see, and it is inert until an owner saves a folder.

### 10.0 How Phase 2 actually landed

Recorded because two shapes were decided while building and are not obvious from §10.1.

**The frontend generalization is one component plus three named wrappers.**
`DriveFolderField.tsx` and `DriveLibraryPanel.tsx` hold the behaviour; `driveLibrary.tsx` holds the two configs; `CoaFolderField.tsx`, `CoaLibraryPanel.tsx` and `SpecFolderField.tsx` are each a few lines binding a config to a name.
The wrappers are not compatibility shims - the customise page uses all of them - and they are what let all 72 existing COA frontend tests pass unmodified.

**The owner endpoints are a parallel pair, not one handler with a `library` path parameter.**
`/api/companies/{id}/spec/{report,test-connection}` mirror the COA pair rather than generalizing them.
A single handler would put "which library am I reading" into a request field, which is the exact shape of the mistake that reads the wrong folder for the wrong tenant - and the COA pair is the confidential library's owner surface, so it is the last thing that should grow a parameter.

**`showFailedLookups` is the only non-cosmetic difference between the two panels.**
Everything else that differs is a noun. The guessing tripwire is the confidential library's alarm; on a browsable public search a miss is a typo, and the spec report does not even compute the counter.

### 10.3 Phase 3 resolutions - 2026-08-09

Seven things this document left open that the built code decides for us.
Checked against the working tree before Phase 3 was started, so none of them is a guess.

**R1 - `too_short` collapses into `prompt`.**
`search` returns four statuses (`ok`, `empty`, `too_broad`, `too_short`) and §6's state table lists none named `too_short`.
It renders as `prompt` with the same copy, because a visitor who typed one character and a visitor who typed nothing need the identical instruction, and a fourth kind of nothing on screen teaches them nothing.

**R2 - the endpoint's rate limit is NOT COA's.**
`search_coa` carries `30/minute` per IP, which was sized for a press-to-submit field where one lookup costs one request.
A debounced typeahead spends a request per pause in typing, so 30 would start erroring mid-word after a few product searches.
The spec endpoint gets `120/minute` per IP and `300/minute` per API key, with the debounce and a two-character floor doing the real work.
The per-key ceiling is raised too, because COA's 60 is shared by every visitor of that bot and six people searching at once would hit it.
Raising it costs little: enumeration of a public library is already accepted (§3.1), and every request after the first walk is a memo or Redis hit rather than a Drive call.

**R3 - truncation is a hint, not a state.**
`SearchResult.truncated` already exists and `isopropyl alcohol` matches 41 while the panel shows 8.
A line under the list says so; it does not become a ninth panel state.

**R4 - `specOutcome` is not shaped like `coaOutcome`.**
There is no 429 branch at all, because there is no throttle (D1).
The status comes from the response body rather than being re-derived from `results.length`, which is how COA does it and is only correct when the answer is one row or none.

**R5 - the feature flag hangs off `get_product_spec`.**
D8 means no `get_spec_sheet` tool exists to gate on, so `features.spec_picker` is `get_product_spec` in the pack's tools **and** a folder saved.
The flag name and the tool name deliberately do not match.

**R6 - `test_packs.py` is the one existing backend test this phase edits.**
It asserts the spec card's action is `"tool"`, which is exactly what Phase 3 changes.
It is not a `test_coa_*` file, so §9.2's contract is untouched.

**R7 - `pinned` is not one of the panel's exclusive states.**
§6's table lists it alongside `results` and `empty`, but a pinned document renders **above** a search box that stays live, so it coexists with every other state rather than replacing one.
`specPanelState` therefore returns seven values and `pinned` is not among them - it is a separate piece of the panel.
Making it exclusive would close the search the moment a visitor found their first sheet, which is the dead end the pinning pattern exists to avoid.

Two smaller shapes decided while building, for the same reason R7 is written down:

- stale rows stay on screen while the next query is in flight, and the spinner lives in the input.
Swapping the list for "Searching…" on every debounce makes the panel flash once per word typed.
- the panel does not send `visitor_id`.
It exists on the COA endpoint only to bind the throttle, and there is no throttle here.

### 10.4 How Phase 3 actually landed

**`spec_drive` grew its own `to_payload`.**
§15 requires the download filename's extension to follow the source file, and the widget cannot infer it: `display` has the extension stripped and the download URL carries a file ID, not a name.
So the row gained an `ext` field, which meant shadowing the `to_payload` imported from `coa_drive` rather than editing it - the §9.2 rule working exactly as written.

**The panel keeps stale rows and puts the spinner in the input.**
`specPanelState` returns `results` above `searching` whenever there are rows, so a debounced typeahead does not flash "Searching…" once per word.

**`Ask in the chat` is the only route out of an empty or unconfigured panel.**
No handoff button, no support copy - a specification we do not have is not a support incident, and the conversation can take a product name that is not in the folder.

### 10.5 How Phase 4 actually landed

**R8 - the chat path sends the LIST, and pins only when there is one sheet.**
§7 said "a single confident match is attached", which is right for a product with one specification and wrong for `acetone`, which has six.
The event carries `{query, results, pinned_id}`: the panel opens on the ranked rows with the product name already in the field, and pins a row only when the resolver returned exactly one.
Pinning the top row of six would answer a question nobody asked, and it would disagree with the same search typed into the panel.

**The model may know how many, and never which.**
A count is an oracle for certificates (C3) and is nothing of the sort for a public library, so the observation carries `{status, count, message}` - useful enough for the model to say "three sheets are on screen" and carrying no filename (H10).

**It is a bonus, never the answer.**
A Drive outage, a revoked folder, a product with no sheet and a `too_broad` result all leave the observation exactly as `get_product_spec` built it.
The catalog answer is correct on its own; failing it because Drive is down would turn an extra into a dependency.

### 10.1 Config shape

`pack_overrides.spec.folder_id`, alongside the existing `pack_overrides.coa.folder_id`, sanitized by a `sanitize_spec` mirroring `sanitize_coa` (`packs/overrides.py:258`) and surfaced by `effective_spec_config` mirroring `effective_coa_config` (`packs/overrides.py:322`).

Deliberately a sibling key rather than the old plan's `pack_overrides.libraries.{coa,spec}` nesting: the nesting existed to serve the merged engine, and re-shaping a key that a live bot (`Expresolv`) already has data under buys nothing now that COA is untouched.

D9's per-company mode, if it is ever built, lands as `pack_overrides.spec.mode` and defaults to the public behaviour when absent.

`COA_FOLDER_ID_RE` is renamed `DRIVE_FOLDER_ID_RE` with the regex byte-identical and the old name kept as an alias, so no COA call site changes.
It is the query-injection guard and the SSRF guard, and it must keep applying on read as well as on write.

### 10.2 Panel exclusivity

The new open handler must close `sdsPickerOpen`, `coaPickerOpen` and `sampleFormOpen`, and those handlers must close `specPickerOpen`.
Only one panel ever replaces the chat body - COA's H12, now with a fourth participant.

## 11. Tests

Backend:

- `test_spec_drive.py` - ranked mode: strict pass, best-tier fallback, the filler-word case, the numeric-normalization case, the extension-token case, empty and junk queries, the 8-row cap
- `test_spec_drive_guard.py` - the §4.1 selectivity guard: a token matching most of the library returns `too_broad` with no rows; a specific token that matches many files but not most still returns rows; a real product name never trips it
- `test_spec_drive_isolation.py` - a failing spec folder does not open COA's breaker, does not consume COA's forced-walk allowance, and does not evict COA's memoized listing
- `test_spec_endpoint.py` - 404 without the feature, `configured: false` with no folder, rate limits, result cap, `too_broad` status shape
- `test_config_spec_picker_feature.py` - the flag is true only with the chemical pack **and** a folder saved
- `test_spec_folder_leak.py` - the folder ID never appears in `/api/config`
- `test_spec_chat_parity.py` - the wrapper attaches `spec_doc` on a `found` observation with a folder configured, attaches nothing without one, and never puts a filename in the model's observation (H10)
- every existing `test_coa_*.py` file, unmodified and green (§9.2)

Frontend:

- `spec-picker.test.tsx` - the eight panel states, pin-on-select, search box stays live, Download uses `download_url`, `too_broad` and `empty` render different copy
- `panels.test.ts` - the pure `specPanelState` mapping and `hubCardTarget`'s `spec_picker` fallback to `'tool'`
- `drive-folder-field.test.ts` - URL extraction and the invalid-paste path, for both fields
- existing `coa-picker.test.tsx`, `coa-folder-field.test.ts`, `coa-library-panel.test.tsx`, `coa-test-connection.test.tsx`, unmodified and green

## 12. Hardening carried over

These are connector properties, not confidentiality policy, so they apply unchanged: the folder-ID regex on read and write (H1), both `allDrives` flags (H2), key scrubbing before logging (H3), the visited-set against shortcut loops (H4), the forced-walk single flight (H5), the zero-token match-everything hole (H6), the explicit `fields` parameter so `webViewLink` is populated (H7), download form not viewer page (H8), null timestamps never compared (H9), filename length caps (H10 storage half), the folder ID kept out of every visitor-facing payload (H11), one panel at a time (H12), Redis outage degrades to walking (H13), page caps against a repeating `nextPageToken` (H14), retry with jitter plus the breaker (H15), the duplicate report computed before dedupe (H16), one normalizer (H17).

Two are re-read rather than assumed:

**H6 in ranked mode.**
"Every query token must match" is vacuously true for zero tokens, so a query of `___` would return the whole folder.
`min_query_tokens = 1` counts **tokens after tokenizing**, never characters, and the guard must sit after tokenization.

**H11 with two folders.**
`/api/config` ships `features.spec_picker` as a boolean only.
Neither folder ID may appear there, and the leak test must cover both.

## 13. Residual risks - accepted, not solved

1. **Result rows can name the client's customers, and the documents can be theirs.**
§0.1.1 measured it: ~24% of the real folder, 32 customer codes, a dozen named pharmaceutical companies.
**Accepted by the owner on 2026-08-08 with the evidence in hand** (§3.1), not mitigated in code.
The mitigation is a sentence during onboarding (§3.1.0) and accurate dashboard copy (§8.3); the recovery path is D9.
This stays the top risk in the plan even though it is accepted, because an accepted risk that is not written down becomes a surprise.

2. **No heuristic can ever be promoted to the boundary here.**
§3.1.2 measured why: the proper-noun signal flagged `AEROSIL` (a real product), `AQUEOUS`, `BOX` and `102` alongside the genuine customer names.
If a future session is tempted to "just filter out the customer files", this is the number that says it will silently withhold a quarter of a legitimate library.

3. **Two Drive modules will drift.**
D4 buys COA's safety with duplication, and a fix to the walk or the cache now has two homes.
Mitigated by the shared helpers staying imported rather than copied, and by §9.2's rule that needing to edit a shared helper is itself the signal something is wrong.
Revisit only if a bug is ever fixed in one module and missed in the other.

4. **The selectivity guard is a tuned constant.**
It is set from one folder's measurements.
A client whose library is small enough that any real query matches "most" of it would see `too_broad` for legitimate searches, so the guard must have a floor: it cannot trip on a library below a few dozen documents.

5. **One shared platform Drive API key.**
`GOOGLE_DRIVE_API_KEY` gates both libraries.
If it is unset on Render, both features are off everywhere, and the COA work already has this as an outstanding operational gate.

## 14. Open questions

1. **Are the customer codes (`CS1`, `MC8`, …) customer identifiers or something else?**
The plan assumes they are customer-linked because they co-occur with company names, and it deliberately encodes nothing either way.
If they turn out to be internal revision codes, §0.1.1's extent figure drops and the named-company files are still the issue.

2. **Should the panel offer an empty-query browse, the way the SDS picker lists every product?**
**Recommendation stays no**, on usability rather than on secrecy: 1,086 rows is not a browse anyone reads, and an empty state that says "start typing a product name" is more useful than a list of a thousand files.

### 14.1 Answered by the walk

- Filename quality is good enough - §8.1, closed.
- Specification sheets are one-per-product-per-standard-per-customer: 470 distinct products across 1,086 files, with `isopropyl alcohol` alone holding 23. This confirms the ranked list is necessary rather than decorative.
- Everything is `.pdf`; no `.docx` handling or copy change is needed.
- The folder is regular Drive folders, not a Shared Drive, and the plain shared URL resolved correctly.
- Subfolders carry some meaning (`/Food grade`, `/Conforming Specification`), but the same words also appear in the filenames, so COA's rule that folder paths are never read for meaning holds here too.

### 14.2 Deferred - written down so it is not re-derived

- **the pre-publish preview** (§8.2) - the owner's own view of what a visitor sees
- **the proper-noun report** (§3.1.2) - "names we did not recognise"; no longer a free by-product now that D5 is dropped
- **per-company confidential mode** (D9) - the config shape leaves room, the resolver already exists in `coa_drive`

## 15.1 Pre-push audit - 2026-08-09

An end-to-end pass over the committed feature (`d4a1f787`), looking for defects rather than confirming the tests.

### 15.1.1 One real defect, found and fixed

**An absent product plus one ordinary word answered `too_broad`.**
`benzene` alone correctly answered `empty`.
`benzene spec` did not: the strict pass found nothing, the fallback kept every file carrying `SPEC` (1,027 of 1,086 on the real folder), and the guard relabelled that `too_broad`.
The visitor was told to keep typing, which is the one instruction that cannot work - no amount of typing produces a product the folder does not contain - and the query had a true answer already.

The fix is that `too_broad` can only ever come from the **strict** pass.
A broad strict result means every word matched and together failed to select, so more typing helps.
A broad fallback result means the words did not all match, so what is left is every file sharing whichever common word did, and `empty` is the true answer.
`test_spec_drive_guard.py` carries the regression, including the invariant stated once: no query is `too_broad` unless something matched it fully.

The fallback's own purpose is untouched - `acetone drum` still degrades to the acetone sheets (§4 step 5).

**The `too_broad` copy was also only right in one direction.**
It said "keep typing the product name", which is wrong for the visitor who typed the product name and needs a grade.
It now names all three: product name, grade or standard.

### 15.1.2 Measured, and better than the plan assumed

- **cached entry: 10 KB for 1,086 documents.** D7's escape hatch (move to a Postgres index when the entry nears a megabyte) is ~100x away. The sizing risk is closed with a number.
- **search: 1-9 ms** across the same corpus, so the per-keystroke cost of a typeahead is the Drive/Redis tier, never the ranking.
- **production is inert**: a read-only query of the prod control DB confirms no chemical bot has a `spec.folder_id`, so `features.spec_picker` is false everywhere and D3's zero-regression contract holds on deploy.

### 15.1.3 Resolved 2026-08-09 - attach, don't auto-open

**The chat path used to open the panel for every resolved product, not only for a document request.**
`get_product_spec` is the general product-discovery tool, so "what packaging does acetone come in?" replaced the chat body with the specification panel.
`get_coa` never had this problem because asking for a certificate IS the tool.
D8 (no new tool) and §7 (open the panel) were individually right and collided here.

**Fixed by attaching, not opening.**
`spec_doc` is now attached to the bot's reply the same way `quote` already is - `Message.specDoc`, set alongside `content` when the stream completes - and the widget renders a small tappable card instead of forcing a screen change.
Tapping it calls the same `openSpecPickerWithResults` the mechanism always had; only who calls it changed, from the stream handler to the visitor.
An ordinary packaging question now gets its ordinary answer, with the spec sheets one tap away rather than the whole chat body replaced under it.

`_SPEC_DOC_MESSAGE` in `main.py` changed to match: it told the model the sheets were "already open in a panel", which stopped being true.
It now says the sheets are available and will be shown as a card, with the H10 constraints (no link, no filename, no content) unchanged.

### 15.1.4 Recorded, not fixed

- **diacritics do not fold.** `Acétone` is unfindable by `acetone`, because `normalize` is NFKC and NFKC keeps accents. Fixing it means NFKD plus combining-mark stripping inside `coa_drive.normalize`, which §9.2 forbids touching - the isolation D4 bought has this as its price, and a European client is where it would first be felt. CJK filenames work correctly.
- **no single flight on a cold cache.** Eight parallel first-searches walk Drive eight times. COA has the same shape, but a debounced typeahead makes the window wider than a button press does.
- **a failed re-walk turns `empty` into a 503.** Inherited from `coa_drive.resolve`: the forced re-walk after a miss propagates its error rather than falling back to the answer already computed.
- **Test Connection is not rate limited** and bypasses the H5 forced-walk gate, so an owner can walk Drive as fast as they can click. Inherited from COA and bounded only by the global 200/hour default.
- **`GOOGLE_DRIVE_API_KEY` on Render is still unverified** (risk 5). It gates both libraries.

## 15. Generalization - the edge cases across clients

The owner's standing instruction is that this is platform capability, not one client's feature.
The real folder is one data point and a tidy one, so these are the cases the design must survive on a folder nobody has seen.

**A client whose filenames are not Latin script.**
The tokenizer is already Unicode-aware.
Worth an explicit test with a non-Latin filename rather than trusting the regex comment.

**A client filing per-customer subfolders with repeated filenames.**
Dedupe collapses identical normalized filenames and would lose documents here.
COA already recorded this as H16 and answered it with the duplicate report rather than a guess; the same report covers it, and this folder happens to collapse zero.

**A folder far larger than this one.**
1,086 files is small against the 25,000 cap and the 1.79s walk.
The binding constraint stays what COA measured: the cached entry size, with a Postgres index as the escape hatch when it nears a megabyte.

**A very small library.**
The §4.1 guard needs a floor so it cannot trip on a folder of twelve documents where any query legitimately matches most of them (risk 4).

**A folder that is a Shared Drive, or is not actually shared.**
Both `allDrives` flags stay mandatory (H2), and "connected, 0 files" must stay a visible non-success outcome.
This folder is regular Drive folders and shared correctly, so neither path was exercised by the walk - they remain covered by tests only.

**A client whose documents are not PDFs.**
`is_pdf` already accepts several extensions.
This folder is 100% PDF, so the mixed-extension path is untested in the wild; the download filename extension must follow the source file rather than being hardcoded to `.pdf`.

**A client with one document per product and no standards or grades.**
The ranked list would return a single row for most queries, and the panel must not look broken when the "related searches" step has nothing to disambiguate.
Selecting the only result should feel like a confirmation, not a dead end.

**A client with no product catalog.**
No longer relevant to this feature: with D5 dropped nothing here reads `products` except `get_product_spec` on the chat path, which already handles an empty catalog.
