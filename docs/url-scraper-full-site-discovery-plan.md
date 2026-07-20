# URL Scraper - Full-Site Route Discovery Plan

## Goal

Today's crawl picker (shipped in [url-scraper-rewrite-plan.md](url-scraper-rewrite-plan.md) Phase 3) only surfaces up to 10 candidate pages, and only if the URL path or anchor text matches a fixed intent list (`contact`, `about`, `hours`, `location`, `branch`, `visit`, `reach us`, `find us`, `get in touch`).
An owner who wants their `/pricing`, `/blog/*`, `/services/*`, or any other route trained has to go find that URL themselves and paste it in one at a time.

This plan extends discovery so pasting one homepage URL surfaces every route on the site (not just intent-matched ones), while keeping the cost/consent guarantees from Phase 3: no page is fetched through Jina until the owner selects it, and nothing is stored without explicit selection.

## Decisions (from the user, 2026-07-20)

- **D1 - Discovery method: sitemap-first, fallback to nav links.**
  Try `/sitemap.xml` and `/sitemap_index.xml` via a plain `requests.get` (no Jina, no rendering needed - sitemaps are static XML) first.
  If missing, empty, or unparseable, fall back to the existing homepage-nav-link harvest, but with the intent-keyword filter removed so every same-registrable-domain link on the entry page counts as a candidate.
  Chosen over sitemap-only because sites without a sitemap (including the originally reported site, `spdesigning.com`) would otherwise regress to zero candidates - worse than what Phase 3 already ships.

- **D2 - Candidate cap: ~100, with a search/filter box in the picker UI.**
  Bounds worst-case sitemap parsing (some sitemaps list thousands of URLs) and keeps the checklist usable.
  Chosen over "no cap" because a multi-thousand-row checklist is unusable UI and invites an owner to accidentally select an unreasonable number of pages.

- **D3 - Default selection: all unchecked.**
  Today's intent-matched candidates come pre-checked because there are at most 10 and they're all high-value (contact/hours/etc). Once the candidate set can be 100 arbitrary routes, pre-checking all of them risks an owner hitting "Start training" on a huge, unintended page set and blowing through their word quota in one click. The owner now opts in per page (or via an explicit "select all" affordance in the UI, still a deliberate click).

## What stays unchanged

- **Zero extra Jina fetches for the entry page itself** - same as today, `_fetch_url_html` is called once for the pasted URL.
- **The sitemap fetch is not a Jina fetch** - it's a direct `requests.get` against `<origin>/sitemap.xml`, so it does not touch the shared Jina quota that Phase 3's D1a was built to protect. This is a meaningfully cheaper operation than fetching every candidate page.
- **Selected pages are only fetched (through Jina) at training time**, one crawl job, sequential, shared `seen_blocks` cross-page dedup, one source per selected page, via `run_crawl_training_job` - all unchanged from Phase 3.
- **`validate_safe_url` on every discovered link, including sitemap-sourced ones** - sitemap XML is still attacker-controlled content on an SSRF surface, same rule as R5 in the original plan.
- **Estimates stay estimates.** Sitemap-derived candidates get the same `marginal_words()` per-page estimate as nav-derived ones today; sitemaps don't carry word counts, only URLs (and sometimes `<lastmod>`, which isn't a size signal).

## Scope

### Slice 1 - Sitemap fetch + parse

- New pure function in `html_extract.py` (or a new small module) - `discover_sitemap_urls(origin: str) -> list[str] | None`.
  Tries `/sitemap.xml`, then `/sitemap_index.xml`. Handles:
  - a plain `<urlset>` (list of `<url><loc>`)
  - a sitemap index (`<sitemapindex>` of nested sitemap files) - fetch each nested sitemap (bounded, e.g. max 5 nested files) and merge
  - malformed/non-XML response - return `None`, caller falls back to nav-link harvest
- Cap the raw URL count read from the sitemap before any filtering (defend against a sitemap listing 50,000 URLs - don't hold all of them in memory unbounded).
- Filter to same-registrable-domain (reuse the existing `_registrable_host` helper), drop non-page suffixes (reuse `_NON_PAGE_SUFFIXES`), drop the entry URL itself.
- Truncate to `MAX_DISCOVERED_LINKS` (raised from 10 to ~100 - see D2) preserving sitemap order (sitemaps are often priority-ordered, unlike DOM order).

### Slice 2 - Wire into `/api/train/discover`

- `discover_crawl_links` in `main.py:7829` tries `discover_sitemap_urls` first; if it returns candidates, use them (labelled from the URL path since sitemaps have no anchor text - e.g. `/about-us` -> `About us`).
- Falls back to today's `harvest_links(html, entry)` with the intent filter removed (or a parallel "harvest all" function - TBD during implementation, likely a `require_intent_match: bool = True` parameter on the existing function to avoid duplicating the domain/suffix/dedup logic).
- Response shape is unchanged (`entry` + `candidates` + `estimate_note`) so the frontend picker doesn't need a breaking change, only a UI update for volume (D2, D3).

### Slice 3 - Picker UI (`src/app/(app)/dashboard/train/page.tsx`)

- Search/filter input above the candidate checklist (D2) - client-side substring filter over URL/label, no new endpoint needed since candidates are already all fetched in one `/discover` response.
- Default checkbox state: unchecked (D3). Keep an explicit "Select all filtered" / "Clear all" control since 100 individual clicks is bad UX even with opt-in.
- Running word-estimate total already exists; must recompute correctly against a 100-candidate list, not just <=10.

## Non-goals

- Recursive (depth >1) crawling - still depth-1 from the entry URL or its sitemap, consistent with the original Phase 3 scope decision.
- Deduping near-duplicate routes (e.g. `/blog/page/1`, `/blog/page/2` as separate high-volume low-value candidates) - punt to the owner's own judgment via the search/select UI; cross-page *content* dedup at training time already handles repeated boilerplate.
- Changing quota enforcement - unchanged, still checked per selected page at training time against live remaining capacity (Phase 3 D1a/D3).

## Open items for implementation

- Exact behavior when a sitemap index references sitemaps on a *different* subdomain of the same registrable domain (e.g. `www.` vs no subdomain) - should follow the same same-registrable-domain rule used elsewhere (`_registrable_host`), not sub-domain-exact match.
- Confirm `MAX_DISCOVERED_LINKS` raise to ~100 doesn't blow past any existing rate limit on `/api/train/discover` (currently `10/minute`, see `main.py:7830`) - that limiter is about request frequency, not response size, so should be unaffected, but worth a quick sanity check.

## Status

Planned 2026-07-20.
Implemented 2026-07-20 (all 3 slices), suite green (backend html_extract 60 tests, tsc 0, lint 0 errors), uncommitted.

- Slice 1 (`sapybase_ai_engine/services/html_extract.py`): `parse_sitemap`, `discover_sitemap_urls(origin, fetch)` (index nesting bounded by `MAX_NESTED_SITEMAPS=5`, `MAX_SITEMAP_URLS=5000`), `links_from_sitemap` + `_label_from_url`; `harvest_links` gained `require_intent_match` param; `MAX_DISCOVERED_LINKS` raised 10 -> 100.
- Slice 2 (`main.py`): `_fetch_sitemap_text` (direct `requests.get`, SSRF-validated, non-Jina); `/api/train/discover` is now sitemap-first (`asyncio.to_thread` around the blocking discovery), falling back to `harvest_links(..., require_intent_match=False)`. Response shape unchanged.
- Slice 3 (`train/page.tsx`): default selection now unchecked (D3); added client-side filter box (shown when >8 candidates), "Select all shown" / "Clear all", "N of M selected" counter, scrollable list (`max-h-72`). Empty-selection train still falls back to single-URL.

NEXT = live dashboard click-through against a site with and without a sitemap (auth/backend gated, not runnable in the implementing session), then commit.
