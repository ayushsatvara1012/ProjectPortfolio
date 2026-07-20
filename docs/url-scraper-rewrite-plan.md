# URL Scraper Rewrite Plan

## Goal

Own the extraction stage of "Train from URL" so the knowledge base reflects the whole page, not the slice a third-party heuristic considers "the article".

The reported footer bug is one symptom.
Hours, pricing tables, accordion FAQs, sidebars, and location blocks are lost the same way.
This plan fixes the mechanism, not the symptom.

## Reported bug

An owner trained the bot on their homepage URL.
The footer contact details (phone, email, address) never reached the knowledge base.

## Verified evidence

Reproduced live against the reported site (`https://www.spdesigning.com/`):

- Jina's default markdown output **truncates before the footer**.
  The contact block is absent from what we store.
- Jina with `X-Return-Format: html` returns **284 KB of fully rendered DOM**, containing `<footer id="contact">`, `mailto:spdesigns28@gmail.com`, `tel:+918980775017`, and a JSON-LD block.
- The site is a client-rendered Next.js app, so Jina's headless rendering is doing real work that a plain `requests.get` would not.

Conclusion: **the fetch stage is not the problem.**
Every fact the owner is missing is already present in HTML that Jina will hand us on request.
The loss happens entirely in Jina's main-content heuristic, which is a black box we cannot tune.

## What the code actually does (premise corrections)

### 1. There is no scraper in this repo

`main.py:7830-7872` delegates fetch **and** extraction to Jina Reader, with a 3-attempt retry on 429/5xx.
The only local post-processing is `_strip_markdown_images` (`main.py:161-173`).
`requirements.txt` has no `bs4`, `lxml`, `trafilatura`, `crawl4ai`, or `playwright`.

### 2. Extraction is synchronous, inside the request handler

The Jina call sits at step 3, **before** the quota check (`main.py:8019`) and **before** `run_training_job` is queued (`main.py:8040`).
Only embedding and DB writes are backgrounded.
Any multi-page crawl must move into the background job first.

### 3. `doc.metadata["source"]` is ignored at storage time

`run_training_job` inserts with `temp_source_name`, derived from the job-level `source_name` parameter (`main.py:7365`).
The INSERT never reads `doc.metadata["source"]`.
One training job writes exactly one logical source, and the atomic swap (temp rename, then delete rows matching the original `source_name`) depends on that invariant.

### 4. `skip_splitting` is job-level and already latently wrong

`skip_splitting=bool(csv_file)` is passed job-wide (`main.py:8050`), and `url`/`file`/`csv_file` are **not mutually exclusive** - no validation rejects a combined submission, `pending_source_name` is an if/elif chain where `url` wins, and `docs` accumulates from all three branches.
A URL+CSV submission therefore stores the URL's markdown as a single unsplit chunk.
Pre-existing bug, unrelated to this plan, fix as its own commit.

## Architecture decision

**Keep Jina as a renderer. Move extraction in-house.**

Request `X-Return-Format: html` and do our own DOM extraction with BeautifulSoup.

Why this over the alternatives:

- **vs. status quo:** we stop letting an opaque heuristic decide what a business's website "is about".
  Extraction becomes deterministic and reviewable.
- **vs. self-hosted trafilatura/readability:** those are the same class of ML/heuristic boilerplate-remover.
  Swapping one heuristic for another does not give precision, it just changes whose guess we inherit.
- **vs. crawl4ai + Playwright:** the `SapyAI` Render service is on the **starter** plan (512 MB RAM, 0.5 CPU) running `gunicorn -w 2` with uvicorn workers.
  Headless Chromium needs ~300-500 MB resident and would put the whole API at OOM risk.
  Jina already does the rendering, for free, off our box.
- **vs. plain `requests.get` + our own parse:** the reported site is client-rendered.
  Static fetch returns an empty shell, so this would regress every SPA customer.

This is the only option that gets full extraction control **without** new infra, without an SPA regression, and without a domain-specific special case.

Explicitly rejected: a separate contact-only extractor.
It fixes footers and nothing else, and it hardcodes a business-domain concern into ingestion, which the project's pack-registry rule forbids.
Contact details should fall out of correct general extraction, not a bespoke module.

## Security note - SSRF ownership does not shift

Because Jina still performs the fetch, the page request continues to originate from **Jina's** infrastructure, not ours.
`validate_safe_url` keeps its current role and no new SSRF surface is introduced.

This is a deliberate benefit of keeping Jina as the renderer.
If a future phase moves fetching in-house, SSRF becomes our problem and must be re-validated at **every redirect hop**, not just the entry URL - see Phase 2.

## Scope

Phased, suite green between each.
Phase 1 is independently shippable and fixes the reported bug as a side effect of fixing extraction generally.

### Phase 1 - Own the extraction stage

- Switch the Jina call to `X-Return-Format: html`, keeping the existing retry/backoff and timeout handling.
- Add `beautifulsoup4` + `lxml` to `requirements.txt` (pure-Python parse, no browser, negligible memory).
- New `sapybase_ai_engine/services/html_extract.py` - a pure function `extract(html: str, base_url: str) -> str` returning structured markdown.

Extraction contract, in priority order:

1. **Strip only true noise**, by an explicit list we own: `<script>`, `<style>`, `<noscript>`, `<svg>`, `<iframe>`, `<template>`, and elements matching a cookie/consent-banner selector list.
   Nothing else is discarded by default.
   The strip list lives in one named constant so it is reviewable and tunable.
2. **Preserve document structure** - map `<h1>`-`<h6>` to markdown headings, `<ul>`/`<ol>` to lists, `<table>` to markdown tables, `<dl>` to pairs.
   Structure is what makes chunks retrievable; flattening to raw text destroys it.
3. **Keep `<footer>`, `<aside>`, and `<details>`/`<summary>`** - the accordion-FAQ and hours-block cases.
4. **Lift JSON-LD** (`schema.org`) into a readable text block appended once.
   It is the highest-signal structured data on most business sites and is invisible to any text extractor.
5. Keep `_strip_markdown_images` behaviour - drop image syntax, since chat has no image rendering.

### The precision/recall tension (design constraint, not an afterthought)

"Keep everything" is **not** the goal and would make retrieval worse.
Nav menus, cookie text, and repeated CTAs flood the index with low-value chunks, dilute embeddings, and burn the word quota - which matters because the Explore tier's word limit is small.

Precision comes from three mechanisms, all of which are in scope for Phase 1:

- The deterministic strip list above (we choose, and can review the choice).
- **Boilerplate dedup**: hash normalised block text and drop exact repeats within a document.
- A **minimum block length** threshold so single-word nav fragments never become chunks.

Measure this: record extracted word count before and after on a fixture set, and confirm the retrieval tests still pass.
If extracted words balloon without a retrieval gain, tighten the strip list rather than shipping it.

### Phase 2 - Drop Jina entirely (deferred, infra-gated)

Only if Jina's rate limits or availability become a recurring problem.
Not required for the reported bug.

Requires replacing the rendering tier, which means `crawl4ai`/Playwright on a **separate** Render worker service, not the API instance.
Costs a new Render service, so it needs an explicit yes on spend.
Also moves SSRF onto our infrastructure - redirects pinned and re-validated per hop, scheme allowlist, byte cap, IPv6 coverage.

### Phase 3 - Shallow multi-page crawl (in progress)

Depth-1, same-domain crawl of `contact`/`about`/`hours`/`locations` links.

Decisions taken 2026-07-19:

- **D1 - Owner picks, preview first.** Crawling never silently spends quota. The owner sees the candidate pages and chooses which to train. This also answers "why did one URL eat my storage".
- **D1a - REVISED 2026-07-19 (cost constraint: the whole user base is on free tier).** The original D1 had discovery fetch every candidate to show an *exact* word cost. That is the most expensive possible shape and it is now rejected. Discovery does **zero extra fetches**: links are harvested from the entry page HTML we already hold, and the per-page cost is *estimated* from the entry page via `marginal_words()`. Only pages the owner actually selects are ever fetched. See "Why the exact preview was wrong" below.
- **D2 - The background-extraction refactor ships in the same commit as the crawl**, not separately.

#### D3 - Source identity (forced by the invariant)

Crawling N pages collides with the invariant now enforced in `run_training_job`: one job stores exactly one logical source, because the atomic swap renames *and then deletes* by `source_name`.

Two options were considered:

- **(a) One source, all pages merged** under the entry URL's `source_name`. Invariant holds untouched, but the owner sees a single row and cannot inspect or remove one page, and a retrain silently changes what "that URL" means.
- **(b) One job per selected page**, each with its own `source_name` (its normalised URL). Chosen. The invariant holds unchanged, each page is independently visible/removable in the sources list, and retraining one page cannot disturb another.

(b) costs an outer loop over N jobs and makes "retrain the site" a fan-out rather than one swap. That is the honest shape of the operation, and it keeps the swap logic - the riskiest code in the ingestion path - completely untouched.

#### Why the exact preview was wrong

Measured on the reference site, 2026-07-19:

- A Jina fetch is the scarce resource, and it is **shared across all tenants** on one quota. The exact preview spent N fetches per discovery *whether or not the owner trained anything* - the worst case being an owner who opens the picker and walks away. With every tenant on free tier, that is the first thing that would break under load.
- The JSON-LD block is **half the extracted words** (170 of 340) and is emitted identically site-wide. Cross-page dedup already collapses it to zero after page 1, so a naive per-page number would have overstated real cost by ~2x. The "exact" preview would have been exact about the wrong quantity.
- Jina's render is **not stable across sessions** - the same URL returned 284 KB / 560 words earlier in the day and 41 KB / 340 words later (stable within a window, so this is its cache tier). A word count previewed at discovery is not the count you get at training time regardless.

An estimate is therefore both far cheaper and no less truthful than the "exact" number would have been.

#### Flow (revised)

1. **Discovery**: harvest links from the entry page HTML already in hand. Zero extra fetches, no background job, no Redis cache, no polling. Per-page estimate = the entry page's `marginal_words()`.
2. **Selection**: the owner sees the candidate list with an estimated cost and a running total against remaining quota, marked clearly as an estimate. Nothing is stored yet.
3. **Training**: each selected page is one background job (D3) that fetches and extracts itself. Quota is enforced per job against live remaining capacity; when it runs out the fan-out stops and reports which pages were skipped. Because pages are independent jobs, a partial run is coherent - what stored, stays stored.

#### Constraints

- **Cross-page boilerplate dedup is mandatory** - nav and footer repeat on every page. Phase 1's dedup is per-document; it has to become per-crawl, keeping the first occurrence and dropping repeats from sibling pages. Without this, a 5-page crawl stores the same footer 5 times.
- **Quota is checked against the owner's selection**, before any job is queued, using the discovery word counts (which are exact, not estimated).
- Candidate count is capped regardless of selection, to bound the discovery fan-out.
- `validate_safe_url` must run on **every** discovered link, not just the entry URL - harvested hrefs are attacker-controlled (R5).

#### Phase 3 progress

Slice 1 DONE (extraction-layer foundations, decision-free, uncommitted):

- `harvest_links(html, base_url, limit) -> list[DiscoveredLink]` - depth-1, same-registrable-domain (www and apex treated as one site), intent-matched on both URL path and anchor text, asset suffixes and non-http schemes rejected, fragment/trailing-slash deduped, entry URL excluded, capped at `MAX_DISCOVERED_LINKS`.
- `extract(..., seen_blocks=...)` now threads dedup state across pages, satisfying the mandatory cross-page boilerplate constraint. Omitting it preserves exact Phase 1 single-page behaviour.
- Live check on the reported site found 1 candidate (`/about`) and confirmed suppression works.

That live check also caught a real gap, now fixed: the JSON-LD lift kept its own private dedup set, so a crawl would have stored the same site-wide `Organization` block once per page. It now shares the caller's set.

- `marginal_words(extracted)` - free per-page cost estimate that excludes the site-wide JSON-LD block, per D1a.

Slice 2 DONE (uncommitted, backend-verified):

- `_fetch_url_html()` - the Jina fetch/retry/decode split out of the endpoint so discovery and per-page jobs share it; the single-URL path now calls it (unchanged behaviour, 402 gate intact).
- `POST /api/train/discover` - fetches only the entry page, harvests candidates from that HTML, estimates each via `marginal_words()`, `validate_safe_url` on every harvested href (R5). Zero extra fetches (D1a).
- `run_crawl_training_job()` - one polled job that fetches selected pages sequentially through a shared `seen_blocks` set (cross-page dedup), then trains each as its own source by delegating to `run_training_job` with a throwaway sub-job id. See the D3 refinement below.
- `POST /api/train` gains a `urls` field: when present it fans the crawl out and returns `{mode:"crawl", job_id, page_count}`; single-source path otherwise. Rejects mixing `urls` with a single source.
- Selection UI on the Train page: a "Find more pages" button runs discovery, candidates render as a checklist (all on by default) with per-page and running-total word estimates marked as estimates; the crawl status poll summarises trained / skipped-quota / failed pages.
- Tests: `tests/test_url_crawl.py` (10). Full backend suite green (1573), tsc clean.

#### D3 refined (2026-07-19)

D3 first said "one independent background job per page". That breaks cross-page dedup: independent tasks share no memory, so a shared `seen_blocks` set can't span them, and the site-wide nav/footer/JSON-LD would be stored once per page - the exact cost we are cutting. Refinement: **one crawl job that fetches sequentially through a shared `seen_blocks` set**, then trains each page as its own source via `run_training_job` (throwaway sub-job ids). The swap stays one-source-per-swap and untouched; cumulative quota is automatic because each delegated call re-reads live remaining capacity, which already includes the pages committed before it; when capacity runs out a page stores nothing and is reported under `skipped_quota`. Sequential (not concurrent) so dedup order is deterministic; it runs in the background where latency is cheap.

Not yet done: a click-through of the selection UI in the authenticated dashboard (needs a live Clerk session + backend) and the E2E retrain of the reported URL (last R7 item).

#### Measured baseline (reference site, 2026-07-19)

| | Jina markdown | Ours |
|---|---|---|
| Words | 159 | 340 |
| Fetch latency | ~0.5 s warm | ~0.5 s warm |
| Child chunks embedded | - | 14 |

Earlier in the day the same page rendered at 560 words; see the render-instability note above. The reported bug (phone + email) is fixed on both renders.

Cost levers if ingestion needs to get cheaper still, cheapest first:
1. Cross-page dedup (**built**) - removes ~50% of per-page cost from page 2 onward on this site, since JSON-LD plus nav dominate.
2. Raise `MIN_BLOCK_CHARS` - 15 of 29 body lines are 3 words or fewer, though they total only 28 words, so this is a small win.
3. Tighten `STRIP_TAGS` / add a `<nav>` strip - only if retrieval tests confirm no loss, per the precision/recall constraint above.

## Non-goals

- Rewriting chunking strategy beyond what Phase 1 needs.
- Touching PDF or CSV/catalog ingestion.
- Any change to embedding, pgvector storage, or retrieval ranking.
- Vertical-specific or domain-specific extraction rules - extraction stays pack-agnostic.
- A contact-specific module (explicitly rejected above).

## Implementation rules (Phase 1)

Binding.
Every item came from reading the code or from the live verification above.

### R1 - Parsing must never fail the job

- Wrap the whole extraction in try/except and fall back to Jina's markdown output on any parser error.
  A malformed page must degrade to today's behaviour, never 500 a training job.
- Parse with `lxml` via BeautifulSoup, treating input as **HTML, not XML**, to avoid XXE and entity-expansion classes.
- JSON-LD in the wild is messy and every case below is real:
  - multiple `<script type="application/ld+json">` blocks per page
  - top level as a single object, an array, or wrapped in `@graph`
  - `@type` as a string **or** an array (`["Organization","LocalBusiness"]`)
  - `telephone` as string or array; `address` as string or nested `PostalAddress`
  - malformed JSON - wrap each block individually, skip it, never fail the document
  - cap nesting depth when walking the structure

### R2 - Resource limits (512 MB instance, synchronous handler)

- Cap the HTML body we will parse (5 MB suggested; the verified sample was 284 KB).
  Reject or truncate past the cap rather than parsing unbounded input next to two uvicorn workers.
- Note the total request budget: the Jina call already burns up to 3 attempts x 20 s plus backoff inside the same synchronous handler.
  HTML parsing is now added to that path - keep it O(n) and state the worst-case budget in a comment.

### R3 - Encoding

Honour the declared charset.
`requests` guesses latin-1 for `text/html` lacking a charset, which silently mojibakes addresses, names, and any non-ASCII content.
Use `response.content` with explicit detection, not `response.text`.

### R4 - Output quality gates

- Extracted output shorter than the current markdown output is a **regression signal**, not a pass.
  Assert on it in tests.
- Empty or whitespace-only extraction must fall back to Jina's markdown, never store an empty document.
- Dedup normalised block text within the document; strip punctuation and whitespace before comparing so `+1 (555) 123-4567` and `+15551234567` are recognised as the same fact.

### R5 - Untrusted content

Scraped page content is attacker-controlled input that lands in LLM context.
Treat all extracted text as **data, never instructions**, consistent with the injection defence already applied to summarised agent memory.
Never interpolate raw scraped text into a system prompt.

### R6 - Quota interaction

`estimated_words` (`main.py:8019`) is summed across all docs and is now likely to grow, since we keep more of the page.
Confirm the 402 `WORD_QUOTA_OVERFLOW` message still reads sensibly, and check a realistic page against Explore-tier limits before shipping.

### R7 - Testing bar

- Unit: `html_extract.py` against fixture HTML - footer present, `<details>` accordion, markdown table, JSON-LD in all shapes from R1, malformed JSON-LD, cookie banner stripped, nav dedup, empty document.
- Regression: the reported site's rendered HTML as a fixture - assert phone, email, and footer text all survive extraction.
- Regression: word-count before/after on the fixture set, to catch strip-list drift in either direction.
- Regression: CSV/catalog path untouched.
- E2E: retrain the reported URL and confirm the bot answers the phone/email question.

## Status

Phase 1: **implemented 2026-07-19, uncommitted.**

- `sapybase_ai_engine/services/html_extract.py` - `extract(html, base_url) -> str`, with the strip list, structure mapping, JSON-LD lift, dedup and min-block threshold all as specified.
- `main.py` sends `X-Return-Format: html`, decodes via `_decode_response_body` (R3), and extracts via `_extract_page_text`, which falls back to the raw body on any parser error or empty output (R1/R4).
- `beautifulsoup4` + `lxml` added to `requirements.txt`.
- 29 unit/regression tests in `tests/test_html_extract.py`. Full backend suite green (1539 passed, 125 skipped).

Live verification against `https://www.spdesigning.com/`:

| | Jina markdown | Our extraction |
|---|---|---|
| Words | 159 | 560 |
| `spdesigns28@gmail.com` | absent | present |
| `+918980775017` | absent | present |

Address, geo, opening hours and the full service catalog now come through via the JSON-LD lift.

Note: re-measured later the same day, Jina returned a smaller render of the same URL and the numbers were 159 -> **340**. The bug fix holds on both. See "Why the exact preview was wrong" under Phase 3 for the render-instability detail.

R6 checked: Explore's limit is 12,000 words (`core/config.py`), so this page moved from 1.3% to 4.7% of quota - roughly 21 such pages still fit, and the 402 copy still reads sensibly.

Not yet done for Phase 1: the E2E retrain of the reported URL through the live dashboard (R7 last item).

Phases 2 and 3: deferred, gated on the open decisions above.

Pre-existing bugs found while planning, to fix as separate commits:
- `url`/`file`/`csv_file` not mutually exclusive, so a combined submission stores the URL doc unsplit (premise correction 4).
- `doc.metadata["source"]` silently ignored by the INSERT, a trap for any future multi-source job (premise correction 3).
