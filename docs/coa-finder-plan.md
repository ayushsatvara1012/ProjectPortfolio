# COA Finder - plan

Chemical vertical.
Turn the currently-disabled `Request COA` hub card into a Certificate of Analysis lookup against the company's own Google Drive folder.

## 0. Status - 2026-07-29

Phases 0, 1 and 2 are **built and committed**; Phases 3 and 4 are not started.
Suite green: backend 1873, frontend 459, tsc 0, lint 0 errors.

**The pipeline has now run against the client's real Drive folder** (2026-07-29, read-only scratchpad script calling `walk_folder` and `search` directly - no dashboard, no dev server).
It worked on the first attempt.

```
folder_id extracted   1w-sEG… (from the plain folder URL)
walk                  1.44s · 8 folders · 2240 files seen · 2 non-PDF ignored · 1781 indexed · capped: ()
```

Confirmed against real filenames, not fixtures: `100.26R016` returns exactly the three grades (F1); `100EP 100.26P001` returns the single certificate; `26R16` finds `26R016`; `acetone LR` returns 16 acetone LR rows; `___`, `1` and `nonsense9999` return nothing (H6).
Every indexed file carried a `webViewLink` (H7 - the failure that would have looked healthy).
The folder is **regular Drive folders, not a Shared Drive** (Q2 answered): a root plus seven `COA <Month> 2026` subfolders.
Shortcuts, a `.lnk` and an `Untitled drawing` were classified out correctly.

**D6 dedupe is now measured, not assumed.**
411 filenames repeat and 457 copies collapse; spot-checked examples are the same certificate filed in two month folders (F4), e.g. `100MC3_100.26P001` in both July and January.
Only 3 names duplicate *within* a single folder, and those share an identical `modifiedTime` with different file IDs - genuine double-uploads, resolved by the file-ID tiebreak.
H16's worst case (distinct documents sharing a name) does not occur in this folder.

Still never exercised end to end through the product: the dashboard field, Test Connection, the endpoint, the agent tool.
No company has a COA folder saved (`pack_overrides -> 'coa'` absent on all three chemical bots).

| Phase | State | Where |
|---|---|---|
| 0 - config surface | Done | `packs/overrides.py` (`sanitize_coa`, `extract_folder_id`, `effective_coa_config`), `coa_folder` on PATCH `/api/company`, `CoaFolderField.tsx` |
| 1 - Drive connector | Done | `services/coa_drive.py` - pure `normalize`/`tokenize`/`tokenize_filename`/`display_name`/`build_document`/`dedupe`/`search`, plus `walk_folder`, `load_index` (Redis, 600s), `resolve` |
| 1 - Test Connection | Done | `POST /api/companies/{id}/coa/test-connection` + the button in `CoaFolderField.tsx` |
| 2 - lookup endpoint | Done | `GET /api/widget/coa?q=` (30/min IP, 60/min key, 404s without the tool) |
| 2 - `get_coa` tool | Done | `packs/chemical.py` ToolSpec + `_run_get_coa`/`_get_coa_observation` in `main.py` |
| 3 - widget | Not started | - |
| 4 - owner visibility | Not started | - |

Tests: `tests/test_coa_config.py`, `test_config_coa_folder_leak.py`, `test_coa_drive.py`, `test_coa_cache.py`, `test_coa_test_connection.py`, `test_coa_endpoint.py`, `src/__tests__/coa-folder-field.test.ts`, `src/__tests__/coa-test-connection.test.tsx`.

### Decisions taken during the build

**`tokenize()` and `tokenize_filename()` are separate.**
Dropping a trailing extension token unconditionally indexes `___.pdf` under a bogus `PDF` token, so it answers a query of "pdf"; never dropping it turns a *query* of "pdf" into a zero-token query, which H6 reads as match-everything.
The index side always drops it, the query side only when other tokens survive.
Both still share `normalize()`, which is all H17 requires.

**Display and matching split differently, on purpose.**
Matching splits on `_ - . space /` so `100.26R016` is two tokens; display splits on `_` only so the batch stays whole and a row reads `100RG · 100.26R016 · ACETONE RG`.
Sections §2 and §7 read like a contradiction until you build it.

**`get_coa` is the first async agent tool.**
Every other tool is a synchronous DB call and `stream_agent_loop` invoked the executor synchronously on the event-loop thread; Drive I/O there would stall the SSE stream for every visitor on the worker.
`services/agent.py` now awaits an awaitable observation (`inspect.isawaitable`), and `main.py`'s `_tool_executor` returns a coroutine for `get_coa` only.
`execute_tool` stays sync and DB-only - the Drive and Redis dependencies live in `main.py`, where the app context already is.

**The tool takes one free-text `query` slot**, not code/batch/grade fields.
A slot per field would reintroduce through the tool schema exactly the filename grammar D2 rejects.

**`get_coa` is declared to every chemical bot**, including ones with no folder configured, which return `not_configured` and hand off.
This is a live behaviour change to the existing Expresolv bot the moment it deploys: a new tool in the schema on every request.
Worth watching in a real conversation before it ships.

### What the real folder disagreed with

**Volume is roughly 7x the estimate, and `MAX_FILES` is the thing it threatens.**
§1 said "a few hundred COAs per year"; the folder holds **2240 files for seven months of 2026** - 269 to 449 per month, averaging ~320.
`MAX_FILES = 5000` is therefore already 45% consumed, and on current intake is breached around **mid-2027**, after which the walk serves partial results and only says so through `WalkResult.capped`.
§6 calls the file cap the signal to move to a `coa_documents` Postgres index and puts that "years away". It is not years away.
See the open decision below.

**The 50-row result cap is load-bearing.**
`acetone` and `P001` both hit it; `EP` returns 48.
Phase 3's "keep typing to narrow" hint is a functional requirement, not decoration.

**Cache entry and search cost - since fixed, see §6.1.**
One company's listing serialized to **421 KB** of Redis, and the parse back out of it cost **38 ms on every single search** - three to five times the 7-14 ms search it fed.
Neither is what "a few hundred files fit in one cache entry" (D9) assumed.
The panel should still debounce rather than search per keystroke.

**Filename quality is better than feared**: exactly one file (`129LR.pdf`) has a single token and is findable only by that exact code, and two carry a `Copy of ` prefix that adds junk tokens without breaking anything.

### Known gaps, in priority order

1. ~~**Open decision - `MAX_FILES` vs a Postgres index.**~~ **Closed 2026-07-29 - see §6.1.** Cap raised to 25,000 after making a listing cheap enough that the raise costs nothing.
2. **Only the dashboard UI is now unexercised.** `/api/widget/coa` and `get_coa` were driven against the real DB row, Redis, Drive and a real model call on 2026-07-29 (§7.1) - which is how the conversational-query bug was found. `CoaFolderField.tsx` and Test Connection have still only run under vitest; a Vercel preview off this branch is the cleanest place to close that.
3. **H5 is open** - `/api/widget/coa` can be driven to walk Drive repeatedly. What exists is an in-process 60s cooldown plus a rule that only a miss against a *cached* listing re-walks; that is not H5, which needs the Redis single-flight to be correct across workers.
4. **H15 is partial** - Drive 403/404/5xx are classified and mapped to distinct owner- and visitor-facing outcomes, but there is no retry with backoff yet.
5. The `coa` hub card stays `disabled=True` until §13.1 is empty.

## 1. Problem

The company dispatches product daily and uploads one COA PDF per batch to a Google Drive folder.
Today a customer holding a drum has to email or call to get that batch's certificate.

The bot should answer it: the customer types the product code or batch number off their drum or invoice, sees the matching certificates, and picks one.

Scale, **measured 2026-07-29** (the earlier "a few hundred per year" was an estimate and was wrong by ~7x): **2240 files across seven months of 2026**, 269-449 per month, collapsing to 1781 distinct certificates once the same file in two month folders is deduped.
Roughly one per dispatch still holds - there are simply far more dispatches than assumed.

## 2. The core design decision - no filename grammar

**We do not parse filenames.**

The first draft of this plan reverse-engineered one client's convention (`{code}_{batch}_{description}.pdf`) into a regex.
That is exactly the hardcoded vertical logic this codebase forbids: the next client names files `ACET-LR-B1042.pdf` and the parser is dead.

Instead, every filename is **tokenized**: split on every separator (`_ - . space /`), uppercased, trimmed.

```
100RG_100.26R016_ACETONE RG.pdf   →   100RG · 100 · 26R016 · ACETONE · RG
ACET-LR-B1042.pdf                  →   ACET · LR · B1042
```

We never decide which token is "the product code" or "the batch".
The file simply contains those tokens, and search matches against them.

**Consequence: zero per-client configuration.** No pattern field, no regex in the dashboard, no onboarding step beyond pasting a folder link.
A client with any naming convention works on day one.

## 3. Reference data

The client's live folder (`COA-Expresolv 2026`), transcribed by hand 2026-07-28.
These are **test fixtures, not a specification** - the search must work on them without any of them being encoded as rules.
The folder was read for real on 2026-07-29 (§0) and the transcription held up: the shapes below are representative of all 2240 files.

```
100MC3_100.26P001_ACETONE USP-NF PH.EUR BP.pdf
100RG_100.26R016_ACETONE RG.pdf
100PU_100.26R016_ACETONE PURE.pdf
100LR_100.26R016_ACETONE LR.pdf
104IP_104.26P004_BENZYL ALCOHOL_IP.pdf          ← extra underscore
102NF_102.26P001_ BENZALKONIUM CHLORIDE 50%…    ← stray leading space
101HPLC_101.26R001_ACETONITRILE  HPLC & SPEC…   ← doubled space
106IPPCS2_106.26RD001_CHLOROFORM 106IPPCS2.pdf
104MC3P_104.24P008_BENZYL ALCOHOL USP-NF…       ← 2024 batch, filed under Jan 2026
```

Structural facts worth knowing, none of which are encoded as parsing rules:

| # | Fact | Handled by |
|---|---|---|
| F1 | One batch spans several grades - `100.26R016` appears as `100LR`, `100PU`, `100RG` | Falls out for free: three filenames contain that token, so search returns three rows |
| F2 | Descriptions contain extra underscores, stray and doubled spaces, and dots (`PH.EUR`) | Irrelevant - all are just separators to the tokenizer |
| F3 | Batch year does not match the folder it sits in (Jan 2026 holds 2024 and 2025 batches) | Folder path is never read for meaning |
| F4 | The same filename appears in two month folders - `100MC3_100.26P001` in both January and July | Identical normalized filename = same document; newest `modifiedTime` wins |
| F5 | File sizes cluster at ~29-30 KB and ~730-750 KB, sometimes within one product code | Unexplained - see §4. F4's newest-wins covers it either way |

## 4. Open items

- **File-size split (F5).**
  30 KB files are text-only; 740 KB almost certainly carry a scanned signature or stamp.
  Only matters if both variants can exist for one batch, in which case F4 already resolves it.
  Unconfirmed with the client.

## 5. Locked decisions

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Lookup | **Search-first, never browsable.** Panel opens empty; results appear only as the visitor types | No listing is ever rendered, so the production history is not on display |
| D2 | Search model | **Tokenized match, no filename grammar** (§2) | Works on any client's convention with zero configuration |
| D3 | Search keys | **Every token**, which in practice means product code, batch, grade and product name are all searchable | The owner asked for code and batch; tokenization delivers those plus the rest at no cost |
| D4 | Data source | **Google Drive only.** No join to `products`, no shared code with the SDS path | Owner's call: isolate features so one cannot break another. COA works with no catalog uploaded |
| D5 | Ambiguity | **Show every match, ranked; the visitor picks** | Handles F1, and the customer who does not know their grade |
| D6 | Duplicates | **Identical filename = same document, newest `modifiedTime` wins** | Generic version of the newest-wins invariant `_newest_https_row` enforces for SDS |
| D7 | Gating | **Open to anyone**, no email capture | Owner's choice, raised twice. Search-first is a speed bump, not a gate |
| D8 | Link delivery | **Direct Drive `webViewLink`** | Requires the folder stay shared "anyone with the link" |
| D9 | Freshness | **In-process memo + compressed Redis listing (600s TTL)** + force-refresh on a miss. No DB table, no cron | Miss-refresh removes staleness. The "a few hundred files fit in one entry" premise was wrong by ~7x; §6.1 is the correction |
| D10 | Credential | **Platform Drive API key**, not a service account | A link-shared folder is readable with a plain key. No OAuth, no per-tenant secret, no new dependency |
| D11 | Matching location | **In our own Python**, never Drive's `name contains` | Drive's `contains` does word-*prefix* matching and misses a token mid-filename |
| D12 | Folder scope | **Recurse from wherever the link points**, arbitrary depth; owner can change the link any time | No assumption about year/month structure, so a reorganisation cannot break it |
| D13 | PDF contents | **Never read**, never summarised | Filenames carry everything we index, which keeps the chemical safety guardrail intact for free |

## 6. How it works

No PDF is ever copied to us.
Drive is live-connected at all times; Redis holds only the filename listing so we do not re-walk the tree on every message.

1. Owner shares the COA folder as "anyone with the link" and pastes the folder URL into the dashboard.
2. On the first request we **walk the tree recursively** from that folder - Drive has no recursive query, so it is one `files.list` per folder, fired concurrently.
   The observed shape (root + 7 month folders) is 8 calls in roughly half a second.
3. Each filename is **tokenized** (§2) and cached in Redis under `coa:folder:{company_id}:{folder_id}` with a **600s TTL**.
   Changing the folder link changes the key, so a re-point busts the cache for free.
4. Visitor types; we match tokens in Python (§7).
5. **On a miss**: re-walk from Drive and retry once.
   That is what makes a COA uploaded two minutes ago findable, and why there is no cron job.
6. Still a miss: hand off via the existing `agent_requests(kind='coa')` path - Slack + Resend to the owner, same as `request_sample`.

Latency: ~1s for the first request in a 10-minute window, instant afterwards.

**Guard rails on the walk.** Max depth 6, max 25,000 files, max 200 folders - each breach logs a warning and serves what it has rather than hanging.
The file cap was 5,000 on an estimated volume that turned out to be ~7x too low; see §6.1.

## 6.1 Cache tiers - implemented 2026-07-29

Three tiers, cheapest first: an **in-process memo** of the already-parsed listing, **Redis** holding it compressed, then **Drive**.
Built after measuring the real folder, where the dominant cost turned out not to be Drive or Redis but rebuilding 1,781 `CoaDocument`s out of JSON on *every* search.

| | Before | After |
|---|---|---|
| Warm search (same worker) | 38 ms parse + 1 Redis GET | **0.02 ms**, no Redis |
| Cold worker | 38 ms parse | 40 ms, once per TTL |
| Cold start (walk) | 1.4 s | 1.7 s |
| Redis entry | 421 KB | **93 KB** |
| Redis reads | one per search | one per TTL per worker |

**The memo** (`INDEX_MEMO_MAX_ENTRIES = 8`, keyed by the same `cache_key`, expiring on the same `CACHE_TTL_SECONDS`) holds ~2 MB of parsed objects per company, so the bound caps a worker at ~16 MB however many chemical tenants onboard.
`WalkResult` and `CoaDocument` are frozen and hold only tuples, so a memoized listing is safe to hand out repeatedly.
`force=True` bypasses and replaces it, so a stale memo can never be what makes a newly uploaded COA unfindable (§6 step 5).

**Compression** is plain zlib at level 6 (`encode_index` / `decode_payload`). Filenames repeat heavily across batches, so the listing squashes 4.5x.
An uncompressed entry written by an older deploy is still read correctly - overlapping deploys share one Redis and one 600s TTL - and anything undecodable is a miss, never an exception.
The columnar variant that derives `webViewLink` from the file ID was measured (71 KB) and **rejected**: 22 KB is not worth dropping the stored link, which is the canary for H7.

This is what made raising `MAX_FILES` to 25,000 free: at that size the entry is still under a megabyte compressed.
**The signal to move to a `coa_documents` Postgres index is now the cached entry approaching 1 MB, not the file count.**

H13 is unchanged in spirit but better in practice: with Redis dead the memo still serves, so the degradation is one walk per TTL per worker rather than one per request.
Redis Cloud's free tier is 30 MB with `volatile-lru`, and our key carries a TTL, so even a full Redis evicts the listing into a cache miss - one extra walk, never an error.

## 7. Matching

Pure functions in `services/coa_drive.py`, unit-testable without Drive or Redis.

**Tokenize** both filename and query: NFKC-normalize, uppercase, split on **every run of non-alphanumerics**, drop empties, drop the extension.
The separator set was originally `_ - . space /`, picked from this client's filenames - itself a small piece of the convention-fitting D2 forbids, and the direct cause of the live bug in §7.1.
The regex is `[\W_]+`, which is Unicode-aware, so a Cyrillic or CJK filename still yields tokens instead of nothing.

**Pass 1 - strict.** Every query token must match some file token, by exact match, prefix, or substring.
**Pass 2 - fallback.** Only when pass 1 returns nothing: the documents that matched the **most** query tokens, and only if at least one of those hits was at **prefix strength or better**.
A typo therefore degrades into close suggestions, while a filler word degrades into nothing at all.

### 7.1 The conversational-query bug - found live 2026-07-29, fixed

The first real conversation against the client's folder exposed a defect no mock test could have, because every test fed a clean query like `100.26R016`.

> **Visitor:** I have a drum of acetone, batch 100.26R016. Can I get the COA?
> **Bot:** I found **50** Certificates of Analysis…

The answer is 3.
The model passes natural language straight into the tool's single free-text slot, so **every filler word became a required search token.**
Two independent causes:

1. **A comma was not a separator.** `acetone,` tokenized as one token matching nothing, so the strict pass failed.
2. **The fallback admitted anything matching one token.** With strict failed, it returned the entire acetone catalogue, capped at 50 - and 50 is the cap, not a real count.

Both are fixed above. The count reaching the model is now the count of certificates that actually match, which matters because the model reads it aloud.

Measured on the real 1781-document corpus:

| Query | Before | After |
|---|---|---|
| `acetone, batch 100.26R016` | 50 | **3** |
| `I have a drum of acetone batch 100.26R016` | 50 | **3** |
| `COA for batch 100.26R016` | 50 | **3** |
| `certificate for 100EP 100.26P001` | 50 | **1** |
| `please send the chloroform certificate` | 50 | **18** (chloroform's true count) |
| `acetnoe 100.26R016` (typo) | 50 | **3** |
| `EP` / `100EP` / `26R16` / `acetone LR` | 48 / 4 / 18 / 16 | unchanged |
| `batch`, `certificate please`, `___`, `ZZ.99Q999` | 0 | 0 |

**Accepted residual.** `can you send me the COA` still returns 12, because `ME` prefix-matches `METHANOL`.
Tightening this further means barring prefix matching for 2-character tokens, which would break the documented `EP` behaviour in §8 - a 2-character query has to keep matching mid-token.
It does not bite in practice: a query with no identifier makes the model ask for one rather than call the tool (observed), and `missing_identifier` covers the empty case.

**Ranking**: exact token > prefix > substring; more matched tokens higher; newest `modifiedTime` breaks ties.

**Numeric tolerance**: a secondary pass strips leading zeros inside numeric runs, so `26R16` still finds `26R016`.

**Constraints**: 2-character minimum (otherwise `1` returns the folder), results capped with a "keep typing to narrow" hint at the cap.

**Display**: separators rendered as ` · `, so a row reads `100RG · 100.26R016 · ACETONE RG`.
No parsing, no labelled fields - the filename is shown back, cleaned up.

## 8. Visitor experience - mirrors Get-SDS

### How Get-SDS works today (the pattern being copied)

Two entry points, **one panel**, **one resolver**.

- **Hub card** → `action: "sds_picker"`, gated by `features.sds_picker` from `/api/config`.
  `openSdsPicker()` replaces the whole chat body with a picker.
  Tapping a product **pins** a result card at the top and leaves the list live below under "Other matches" - the panel does not close.
- **Chat** → the agent calls `get_sds`, which returns a status dict.
  `_tool_executor` (`main.py:3605`) captures the result as a **structured side-channel** `{sds:{…}}` on the SSE stream - never as text in the reply.
  The tool's own `message` field instructs the model not to paste the URL and not to paraphrase the document.
  At `[DONE]`, `openSdsPickerWithResult()` opens the **same** panel with the result pre-pinned, and `fromChat` swaps the bare back-arrow for an explicit "Back to chat".
- **The invariant**: `_newest_https_row` is called by both `get_sds` and the picker endpoint, so the conversational path and the panel can never disagree about which document wins.
- **Nothing broken is ever offered**: products with no servable sheet are omitted from the picker entirely.

### The COA panel

Opens **empty** (D1) - a search box reading "Product code or batch number" over an empty state.

Typing produces a flat, ranked list of certificates:

| Typed | Result |
|---|---|
| `100EP` | exact token - that code's certificates, newest first |
| `EP` | substring - `100EP` and `104EP` certificates |
| `100.26P001` | that batch |
| `26P001`, `P001` | substring of the batch token |
| `100EP 100.26P001` | both tokens - the single certificate |
| `acetone` | description token |
| `acetone LR` | both - acetone's LR certificates |
| `100.26R016` | three rows: `100LR`, `100PU`, `100RG` (F1) |

Tapping a row **pins** the certificate - filename shown as ` · ` segments, plus release date - with Open + Download, exactly like the SDS card.
The search box stays live below the pinned card so the next lookup is one edit away.

### Chat entry

"COA for batch 100.26R016" routes to `get_coa`, which returns a status dict and a `{coa:{…}}` side-channel, same mechanism as SDS:

| Tool status | What the visitor sees |
|---|---|
| `found` | Panel opens with the certificate pinned |
| `multiple` | Panel opens with the matches listed; model says how many and asks them to pick |
| `not_found` | Model offers a handoff; panel does not open |
| `missing_identifier` | Model asks for a product code or batch number |

As with SDS, the model confirms and routes - never pastes a link, never states anything the certificate contains.

### Operational edge cases

| Case | Handling |
|---|---|
| Filename with too few meaningful tokens (`scan0012.pdf`) | Indexed anyway, but flagged to the owner in Phase 4 as effectively unfindable |
| Non-PDF files in the folder | Ignored, counted for the owner panel |
| Trashed files | Excluded at query time (`trashed=false`) |
| Drive shortcuts / aliases | Resolved to their target, or skipped if unresolvable |
| Two files identical on name *and* `modifiedTime` | Deterministic tiebreak on file ID, so results never flip-flop between requests |
| Folder unreachable - wrong link, sharing revoked, Drive down | "We couldn't reach the document library" + handoff. Never a 500, never a broken link |
| Owner changes the folder link | Cache key contains the folder ID, so the old listing is abandoned instantly |
| Batch predates the indexed folder | Handoff to the team |
| Query matches hundreds of files | Capped, newest first, "keep typing to narrow" |

## 9. Phases

### Phase 0 - config surface
- `coa` block in `companies.pack_overrides` JSONB: `{folder_id}`.
  **No migration** - `pack_overrides` exists and `packs/overrides.py` is already the sanitise + resolve layer.
- `effective_coa_config(overrides)`, following `effective_sample_sink`.
- Folder-URL → folder-ID extraction, tolerant of Drive's several URL shapes.
- Dashboard field + "Test connection" (walks the tree, reports folder and file counts).
- `GOOGLE_DRIVE_API_KEY` env var on Render - platform-wide, one key for all tenants.

### Phase 1 - Drive connector
- `services/coa_drive.py`: recursive `walk_folder()` via `httpx`, Redis cache, `tokenize()`, `search()`.
- Concurrency-bounded fan-out across subfolders; pagination handled.
- Drive failure degrades to "we couldn't reach the document library" + handoff, never a 500 in the widget.

### Phase 2 - lookup endpoint + agent tool
- `GET /api/widget/coa?q=` - the search endpoint, deterministic, no LLM.
- 404s for a bot whose pack has no `get_coa`, mirroring `/api/widget/sds-products`.
- `get_coa` `ToolSpec` in `packs/chemical.py` calling the **same** `search()` as the panel - the one-resolver invariant `_newest_https_row` establishes for SDS.
  Description states: returns a link only, never assay values.
- Rate limits matching the SDS endpoints (30/min per IP, 60/min per key).

### Phase 3 - widget
- New `coa_picker` hub-card action + `features.coa_picker` flag, parallel to `sds_picker`.
- Panel per §8; remove `disabled=True` from the `coa` hub card.
- Degrades to the `tool` mini-form if the flag is off, same fallback contract as `sds_picker`.

### Phase 4 - owner visibility
- Dashboard panel: file count, folder count, last refresh, duplicate filenames (F4), and files with too few tokens to be findable.
- Same spirit as the near-miss warnings `catalog_import.py` gives for catalog uploads.

## 10. Hardening - findings from the pre-implementation review

Reviewed 2026-07-28 before any code was written.
Each item is a build requirement, not a suggestion.

### Blocking - exploitable or silently wrong

**H1 - Query injection into the Drive `q` parameter.**
The folder ID is interpolated into `q='{folder_id}' in parents`.
A folder ID containing an apostrophe breaks out of the quoted string and rewrites the query.
**Fix**: validate against `^[A-Za-z0-9_-]{10,200}$` at *both* write time (dashboard) and read time (before every call); reject otherwise.
Never format an unvalidated value into `q`.
This is also the SSRF guard - we only ever construct the googleapis.com URL ourselves, never fetch an owner-supplied URL.

**H2 - Shared Drive returns empty with HTTP 200.**
If the folder lives in a Google Shared Drive, `files.list` without `supportsAllDrives=true&includeItemsFromAllDrives=true` returns **zero files and no error**.
The bot then says "no certificates on file" forever and nothing looks broken.
**Fix**: always send both flags.
Test Connection must report "connected, 0 files" distinctly from "connected, N files" so an empty result is never mistaken for success.

**H3 - API key leaking through exception text.**
The key travels as a URL query parameter, and `str(httpx_error)` includes the request URL.
One `except Exception as e: return str(e)` exposes the platform-wide key to a widget, a log, or a Slack handoff.
**Fix**: never interpolate exception text into a response; scrub `key=[^&]*` from anything logged.

**H4 - Folder cycles cause an unbounded walk.**
Drive shortcuts can point at an ancestor folder, so recursive descent loops.
The depth cap alone does not prevent combinatorial blowup within the cap.
**Fix**: maintain a visited-set of folder IDs for the duration of a walk; skip anything already seen.

**H5 - Miss-refresh stampede (self-inflicted DoS).**
Every miss triggers a full re-walk (§6 step 5).
A visitor typing nonsense batch numbers, or any scanner, produces unlimited Drive walks, and concurrent misses each start their own.
**Fix**: single-flight lock per company (Redis `SET NX` with a short TTL) so concurrent misses share one walk, plus a cooldown of at most one forced walk per company per 60 seconds.
Beyond the cooldown a miss answers from cache and hands off.

### High - wrong results

**H6 - An empty token list matches everything.**
"All query tokens must match" is vacuously true for zero tokens, so a query of `___` or `...` tokenizes to nothing and returns the entire folder - bypassing the 2-character minimum, which counts characters, not tokens.
**Fix**: require at least one token *after* tokenizing, and re-check length post-tokenization.

**H7 - `webViewLink` is not returned by default.**
Drive's `files.list` sends a minimal field set unless `fields=` is given.
Omit it and every result carries `webViewLink: None` - every link broken.
**Fix**: `fields=nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,shortcutDetails)`.

**H8 - The Download button would save an HTML page as `.pdf`.**
`downloadSds` (`ChatWidget.tsx:1352`) fetches the URL and saves the blob.
A Drive `webViewLink` is an HTML viewer page, not the PDF.
CORS will usually block the fetch so it falls back to opening a tab - but where it succeeds the customer gets a corrupt file with a `.pdf` name.
**Fix**: Download must target `https://drive.google.com/uc?export=download&id={fileId}`, or the button is dropped and only Open ships.

**H9 - Null `modifiedTime` raises on comparison.**
Newest-wins over a missing timestamp is the exact `TypeError` trap `_newest_https_row` documents for SDS.
**Fix**: nulls always lose; two nulls are never compared; absent any dated file the first wins deterministically.

### Medium

**H10 - Prompt injection via filenames.**
Filenames reach the model as tool observations, so anyone who can write to the Drive folder can name a file to inject instructions.
**Fix**: `get_coa` returns a status and a count, never raw filenames - the panel does all display.
Cap filename length on ingest.

**H11 - Folder ID leaking through error messages.**
"Couldn't read folder 1w-sEG…" discloses the one identifier protecting a link-shared folder.
**Fix**: generic visitor-facing text; identifiers only in server logs (§10 already bars it from `/api/config`).

**H12 - Two panels open at once.**
The SDS and COA panels both replace the chat body.
**Fix**: opening either closes the other, the way `openSampleForm` already does.

**H13 - Redis unavailable.**
**Fix**: degrade to walking per request - slower, still correct - never a 500.
The rate limiter's existing in-memory fallback is the precedent.

**H14 - Pagination loop.**
A repeating or malformed `nextPageToken` spins forever.
**Fix**: cap pages per folder.

**H15 - Drive 403 is not "not found".**
`userRateLimitExceeded` must never be reported to a visitor as "no certificate exists".
**Fix**: bounded retry with backoff, then handoff.
`byod_breaker.py` is the circuit-breaker pattern to reuse.

**H16 - Filename dedup can hide a real document.**
D6 collapses identical filenames as revisions.
A client filing per-customer subfolders with repeated names would lose documents.
Correct for this client; flagged as an assumption, with Phase 4's duplicate report as the safety net.

**H17 - Unicode normalization must match on both sides.**
Index and query must normalize identically (NFKC + uppercase) or nothing matches.
**Fix**: one shared `normalize()`, used by both paths, with a test asserting that.

### Loop safety summary

Every unbounded path is capped: walk depth (6), folders (200), files (5,000), pages per folder (H14), Drive retries (H15), forced re-walks (H5), visited folders (H4), and agent tool rounds (`MAX_TOOL_ROUNDS`, already enforced by the existing loop).
The `multiple` tool status must also tell the model the panel is already showing the matches, so it does not re-call `get_coa` with the same arguments and burn rounds.

## 11. Risks

- **Public folder exposure (D8).**
  A link-shared folder means anyone holding the *folder* ID can list every COA ever issued.
  The folder ID lives only in `pack_overrides` and **must never appear in the widget-facing `/api/config` payload** - that endpoint builds a whitelisted `safe_company` dict (`main.py:9283`) and the COA block stays out of it.
  Enforce with a test.
- **Search surface + no gate (D1 + D7).**
  Search-first renders no listing, but a determined visitor can still type a product name and read off its batches.
  A speed bump, not a lock.
  Flagged to the owner twice; the no-gate decision stands.
- **Filename quality.**
  Tokenized search is only as good as the words in the filename.
  A folder of `scan001.pdf` is unsearchable by any design; Phase 4 makes that visible.
- **Drive quota.**
  One tree walk per company per 10 minutes plus miss-refreshes.
  Far under quota, but the miss-refresh path is rate-limited so a scanning visitor cannot hammer Drive.

## 12. Tests

- `tokenize()` against every fixture in §3 - extra underscores, stray and doubled spaces, dots, ampersands, commas, parentheses and percent signs; a comma- and a pipe-delimited convention with no config change; a Cyrillic and a CJK filename.
- Conversational phrasing (§7.1): "acetone, batch X", "I have a drum of acetone batch X", "COA for batch X" all return exactly what the bare batch number returns; filler alone (`batch`, `certificate please`) returns nothing; a substring-only hit cannot carry the fallback.
- Search: exact code, substring code, full batch, partial batch, multi-token query, description-only query, F1 multi-grade fan-out.
- Strict pass returns nothing → fallback pass returns ranked near-misses.
- Numeric tolerance: `26R16` finds `26R016`.
- Ranking is stable and deterministic across repeated calls.
- **Convention independence**: the same search suite passes against a synthetic folder using a completely different naming scheme (`ACET-LR-B1042.pdf`) with no config change.
- Dedup: identical filenames across folders collapse to the newest; equal timestamps tiebreak on file ID.
- Walk: nested folders, depth cap, file cap, folder cap, pagination.
- Endpoint: mocked Drive - hit, miss-then-refresh-hit, miss-then-handoff, Drive down.
- Cache: TTL respected, force-refresh on miss, key changes when the folder link changes.
- Cache tiers (§6.1): compressed round trip; an uncompressed entry from an older deploy still reads; undecodable bytes are a miss, not an exception; a memo hit reads neither Redis nor Drive; a Redis hit warms the memo; `force` bypasses and replaces the memo; the memo expires on the TTL, is bounded, evicts least-recently-used, and never shares an entry between tenants.
- Security: COA folder ID absent from `/api/config`.
- Config: a non-chemical bot 404s on the COA endpoint.

Hardening (§10), one test each:

- H1 folder IDs containing `'`, spaces, or `&` are rejected at write *and* read time.
- H2 a Shared-Drive folder returns files (both `allDrives` flags present in the request).
- H3 no response, log line, or handoff payload contains `key=`.
- H4 a folder graph with a cycle terminates and visits each folder once.
- H5 concurrent misses trigger exactly one walk; a second forced walk inside the cooldown is refused.
- H6 queries of `___`, `...`, and `""` return nothing, not everything.
- H7 the `fields` parameter is present and every indexed file has a `webViewLink`.
- H8 the Download target is the `uc?export=download` form, never `webViewLink`.
- H9 files with a null `modifiedTime` never raise and always lose the newest-wins comparison.
- H10 `get_coa` observations carry no raw filename.
- H11 visitor-facing errors contain no folder ID.
- H13 with Redis unavailable the search still returns correct results.
- H14 a repeating `nextPageToken` terminates at the page cap.
- H15 a Drive 403 surfaces as a handoff, never as "no certificate exists".
- H17 index and query normalization are the same function.

## 13. Deferred - close before ship

Agreed 2026-07-28: build the pipeline end to end first, confirm it works against the client's real folder, then close this list.

**This is a ship-blocker checklist, not a backlog.**
The `coa` hub card keeps `disabled=True` in production until section 13.1 is empty.
Local and staging run wide open in the meantime.

Six hardening items are **not** deferred, because they are the difference between a pipeline that works and one that only looks like it works.
They land in their normal phase: H1 (folder-ID regex - injection and SSRF guard), H2 (Shared-Drive flags - a Shared Drive otherwise returns zero files with HTTP 200), H7 (`fields=` - otherwise every `webViewLink` is null), H17 (one shared `normalize()` - otherwise nothing ever matches), H9 (null `modifiedTime` raises `TypeError` and kills the search), H6 (empty token list returns the whole folder).
H4 (visited-set) and H14 (page cap) join them: both are a few lines and both prevent an unbounded loop during testing.

### 13.1 Deferred hardening

| Item | What | Phase | Test | State (2026-07-29) |
|---|---|---|---|---|
| H3 | Scrub `key=` from logs and handoff payloads | 1 | §12 H3 | **Done** - pulled forward; `scrub()` plus errors carrying no key, folder ID or URL |
| H5 | Single-flight lock + 60s forced-walk cooldown | 1 | §12 H5 | **Open** - in-process cooldown only; needs the Redis single-flight |
| H13 | Redis unavailable degrades to per-request walk | 1 | §12 H13 | **Done** - every cache failure is a miss |
| H15 | Drive 403 retry with backoff, then handoff | 1 | §12 H15 | **Partial** - classified and mapped; no retry yet |
| H10 | `get_coa` returns status + count, never raw filenames | 2 | §12 H10 | **Done** |
| H11 | No folder ID in visitor-facing error text | 2 | §12 H11 | **Done** |
| H8 | Download targets `uc?export=download`, not `webViewLink` | 3 | §12 H8 | **Done early** - `CoaDocument.download_url`; the widget still has to use it |
| H12 | Opening either panel closes the other | 3 | §12 H12 | Open - Phase 3 |
| H16 | Duplicate-filename report (safety net for the dedup assumption) | 4 | - | Open - `duplicate_names()` exists, no panel yet |

So §13.1 is down to **H5, H15, H12 and H16**.
H5's cooldown value is deliberately unset until we have measured a real walk.

### 13.2 Open questions - need the owner or the client

| # | Question | Blocks | Status |
|---|---|---|---|
| Q1 | F5 file-size split: can a 30 KB and a 740 KB variant both exist for one batch? | Nothing - D6 newest-wins covers it either way | Unconfirmed with client (we never request `size`, so the live walk could not answer it) |
| Q2 | Is the folder a regular Drive folder or a Shared Drive? | Reading Test Connection's "0 files" result correctly | **Answered 2026-07-29 - regular Drive folders**, root + 7 month subfolders. The H2 flags cost nothing and stay |
| Q3 | `GOOGLE_DRIVE_API_KEY` created and set on Render | Phase 1 | **Local done** 2026-07-29 (`sapybase_ai_engine/.env`); Render still to do |
| Q4 | API key restricted to the Drive API only (+ IP restriction if Render exposes static outbound IPs) | Ship | Not started - do before Render |
| Q5 | Dedicated GCP project, and does it need billing enabled to clear the 400M unit/day free threshold? | Phase 1 | Not started |
| Q7 | Which bot to verify against - a `Test Web` bot keeps Expresolv's production config untouched | Verification | Open |
| Q6 | Folder stays shared "anyone with the link" - feature dies (gracefully) if revoked | Ship | Owner-side, ongoing |

Quota is not a concern and needs no further investigation.
One walk is 8 `files.list` calls = 800 quota units; the per-project ceiling is 1,000,000 units/min.
Worst case with H5's cooldown is ~800 units/min per company, roughly 0.08%.
We never call `files.download` (200 units) and the PDF goes from Google straight to the customer's browser, so the 1 TB/day egress budget is untouched.
The tighter ceiling is the 325,000 units/min per-user bucket, which every tenant may share since they share one platform key - still ~400x our worst case, and the trigger to revisit D10 in favour of a service account if many chemical tenants onboard.

### 13.3 Accepted risks - decisions, not bugs

These are closed.
Listed so they are never silently re-opened as defects.

- **Public folder exposure (D8 + D7).**
  A link-shared folder with no email gate means a visitor who types a product name can read off its batch history.
  Search-first renders no listing, so it is a speed bump, not a lock.
  Raised with the owner twice; the decision stands.
- **H16 dedup assumption.**
  Identical filename = same document is correct for this client, who files one COA per batch.
  A client filing per-customer subfolders with repeated names would lose documents.
  13.1's duplicate report makes it visible rather than fixing it.
- **Filename quality ceiling.**
  Tokenized search is only as good as the words in the filename; a folder of `scan001.pdf` is unsearchable by any design.
  Phase 4 surfaces which files are effectively unfindable.

### 13.4 Scope note - Test Connection

§9 Phase 0 lists Test Connection, but it cannot mean anything without Phase 1's walker.
Phase 0 ships the folder field and its save-time validation (a bad Drive link is rejected on save, which is real feedback).
The Test Connection button ships in Phase 1 with the walker behind it, reporting folder and file counts, and distinguishing "connected, 0 files" from "connected, N files" per H2.
