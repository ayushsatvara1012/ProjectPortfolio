# Get SDS - Crash Fix + Product-Only SDS Picker (Option B) Plan

## Goal

Two things, shipped together:

1. Fix the bug where a second SDS request (for a different product) silently falls back to the generic reply and shows no product list.
2. Rebuild the Get SDS experience around Option B: a dedicated "Get SDS" button that opens a searchable PRODUCT picker; picking a product shows its safety sheet inline (preview + open + download).

Core domain rule locked with the user (2026-07-23): **an SDS is per PRODUCT, not per grade.** The grade step is removed from the SDS flow entirely. Grade still matters for price/spec (`request_quote`, `get_product_spec`) - those are unchanged.

## Root cause of the current bug (reproduced live, 2026-07-23)

When a visitor asks for the SDS of a product whose name exactly matches a catalog name sold in multiple grades (`acetone`, `methanol`), `_resolve_product` returns `status: "ambiguous"` with an internal `rows` field - the raw DB tuples, which include the `updated_at` **datetime**.
`get_sds`/`get_product_spec` return that dict verbatim.
The agent loop then serializes every observation with `json.dumps(observation)` and **no datetime handler** ([agent.py:1185](../sapybase_ai_engine/services/agent.py)); the surrounding `try/except` wraps only the tool call, not the serialize.
So the turn throws `TypeError: Object of type datetime is not JSON serializable` -> [main.py:3746](../sapybase_ai_engine/main.py) catches it -> returns `AGENT_FALLBACK_TEXT` with no SDS/list payloads.

It looks like "only the first time works" because it depends on how the name was typed: a partial name (`aceton`) returns `candidates` only (no `rows`) and serializes fine, while an exact multi-grade name carries `rows` and crashes.

Live proof (deterministic, real DB `Test Web` c94ea365):

```
get_sds product_name='acetone'  -> ambiguous rows_in_obs=True  json.dumps=CRASH
get_sds product_name='aceton'   -> ambiguous rows_in_obs=False json.dumps=OK
get_sds product_name='methanol' -> ambiguous rows_in_obs=True  json.dumps=CRASH
```

Repro scripts: `scratchpad/probe_sds.py`, `scratchpad/repro_sds.py`, `scratchpad/check_sds_refs.py`.

## Data reality (measured, do not assume)

- Every multi-grade product in `Test Web` stores a DIFFERENT https SDS link per grade (Acetone: 3 grades -> 3 distinct URLs). The user's rule says these are the same sheet conceptually; the stored data is per-grade.
- On the real `Expresolv` tenant, one CAS number is shared across up to 6 DIFFERENT product names (e.g. CAS `7647-01-0`). CAS is therefore NOT a safe grouping key; product name is.

## Locked decisions (user, 2026-07-23)

- **D1 - Feature scope:** Option B (Get SDS button + searchable product picker + inline preview), plus the crash fix.
- **D2 - SDS is per product, not per grade.** Grade is dropped from the SDS resolution and UI.
- **D3 - When a product's grade rows hold differing links, resolve to the MOST RECENTLY UPDATED https sheet** (`max(updated_at)`, NULLS treated as oldest). Also flag products that carry multiple differing links so the owner can clean them up.
- **D4 - "One product" = grouped by exact product NAME** (case-insensitive, trimmed), not CAS.
- **D5 - Inline preview** with Open-in-tab and Download, and an automatic fallback to open-in-tab when the sheet's host blocks embedding.
- **D6 - The picker hides products with no servable https SDS** (every pick succeeds).
- **D7 - Process:** plan + memory first, then implement.
- **D8 - Phase 2 uses a SEPARATE grade-agnostic SDS resolver.** The shared `_resolve_product` (used by the working `get_product_spec`) is left byte-for-byte unchanged; only `get_sds` and the picker endpoint call the new resolver. Honors "do not alter working logic that has no error."
- **D9 - An explicitly typed grade is ignored for SDS.** "SDS for acetone HPLC" returns the product's newest sheet, same as "SDS for acetone". Grade never affects SDS resolution.
- **D10 - Existing "Request SDS" hub card (`packs/chemical.py:142`) is repointed, not duplicated or removed.** It already exists as a `HubCard(id="sds", ...)` that currently opens a lightweight product picker and routes the pick through the conversational path (`"I need the Safety Data Sheet for {value}"`). Its `action` changes from `tool`/conversational-prompt to opening the new Phase 5 deterministic picker panel directly (same product list from `/api/widget/sds-products`, same inline-preview card). Net result: one picker implementation, reachable both from the hub card and any other new "Get SDS" entry point Phase 5a adds - no second, visually-competing button and no dead old code path.

## Architecture

### Backend

**Phase 1 - Kill the crash (required, independent of Option B).**

- 1a. `rows` is a purely internal helper (it lets `get_sds` check whether grades share a sheet - [agent.py:184-187](../sapybase_ai_engine/services/agent.py)). It must never be part of an observation the model sees. Strip `rows` from any dict returned outward by `get_sds` and `get_product_spec`. Keep `candidates` (name/cas/grade only - datetime-free).
- 1b. Defense in depth: change [agent.py:1185](../sapybase_ai_engine/services/agent.py) to `json.dumps(observation, default=str)` so no tool can ever crash the turn on an unserializable value (datetime, Decimal) again.

**Phase 2 - Make `get_sds` product-only (D2, D3, D4, D8, D9).**

- 2a. Add a dedicated, SEPARATE grade-agnostic SDS resolver (D8 - do NOT modify the shared `_resolve_product`, which the working `get_product_spec` depends on) that:
  - resolves candidate rows by exact CAS -> exact name -> partial name,
  - groups the matched rows by trimmed, case-insensitive product NAME,
  - if exactly ONE distinct product name matched -> collapse its rows to the single sheet = the https `sds_ref` with the greatest `updated_at` (NULLS LAST) -> `status: found`,
  - if MORE THAN ONE distinct product name matched (partial name, or a CAS shared across names) -> `status: ambiguous` with `candidates` = the distinct product names (name/cas only, no `rows`, no grade),
  - if the single product has no https sheet on any row -> `status: no_sheet_on_file`,
  - if nothing matched -> `status: not_found`.
- 2b. `get_sds` ignores any `grade` argument entirely (D9): a typed grade never changes which sheet is returned. Grade is kept in the schema only for backward-compatible calls (documented as ignored) or removed from the pack tool slots. The agent directive text is updated: SDS is per product; never ask for a grade for an SDS; if several DISTINCT products match, ask which product (not which grade). The existing shared-sheet collapse block in the current `get_sds` is subsumed by the new resolver and removed.
- 2c. `found` payload is unchanged in shape: `{status, product:{name,cas_number}, sds_url, last_updated, message}` - drops `grade`/`packaging` from the SDS product object (they are not SDS-relevant).
- 2d. Data-hygiene signal (D3): when 2a sees one product with >1 distinct https link, log a structured warning and record it so an owner report can list "products with conflicting SDS links". Keep this side-effect-free for the visitor.

**Phase 3 - Picker data endpoint (D4, D6).**

- 3a. New endpoint `GET /api/widget/sds-products`, authed by `verify_api_key_and_origin` (same dual-factor key+origin as the rest of the widget), tenant-scoped.
- 3b. Returns products grouped by name that have a servable https SDS: `[{ name, cas_number, sds_url (newest https), updated_at }]`, sorted by name, hard-capped (e.g. 500) with server-side `?q=` search on name/CAS. No-sheet products omitted (D6).
- 3c. Reuses the exact same newest-https selection logic as Phase 2 (one shared helper) so the picker and the conversational path can never disagree on which sheet a product resolves to.
- 3d. Empty result -> `{ products: [] }`; the widget renders an empty state.

**Phase 4 - Feature flag on `/api/config`.**

- 4a. `/api/config` ([main.py:9140](../sapybase_ai_engine/main.py)) adds a `features.sds_picker` boolean, derived from the pack (true when the pack declares the `get_sds` tool). Config-registry driven - never `if vertical == "chemical"`.

### Frontend (ChatWidget.tsx - single source of truth)

**Phase 5 - Get SDS button + picker + inline preview.**

- 5a. Repoint the existing `HubCard(id="sds", ...)` (`packs/chemical.py:142`, D10) so its `action` opens the new deterministic picker panel directly instead of sending a conversational prompt. No new/duplicate button is added. `features.sds_picker` (Phase 4a) still gates whether this card's new behavior is active vs. left conversational, so the change is config-registry-driven, not hardcoded to chemical.
- 5b. Selecting the hub card opens an in-widget product picker panel: a search box + a filtered list fetched lazily from `/api/widget/sds-products` (fetch once, cache in state; client-side filter on top of server `?q=` for large catalogs). Loading, empty, and error (retry) states included.
- 5c. Selecting a product renders the deterministic SDS card: product name + CAS, "updated <date>", an inline PDF preview (`<iframe>`/`<embed>` of `sds_url`), and Open-in-tab + Download actions. The URL always comes from the endpoint payload (deterministic catalog data), never from the model - consistent with the existing "agent never pastes the link" rule.
- 5d. Inline-preview fallback (D5): if the embed errors or does not load within a short timeout (host sends `X-Frame-Options`/CSP), collapse the preview and show "Preview unavailable - open in a new tab" with the Open button.
- 5e. The existing conversational path (typing "SDS for X") still works: `get_sds` now returns the product-only sheet, and the widget renders the same SDS card via the existing `{sds:{...}}` side-channel. No grade chips for SDS anymore.

## Edge cases (must all be covered)

- Single-grade product with https sheet -> found.
- Multi-grade product, all rows same link -> found (newest).
- Multi-grade product, differing links -> found = newest `updated_at`; owner-flag recorded (D3).
- Multi-grade product, mix of https and null/non-https -> found = newest among the https rows.
- Product with every row null/non-https -> no_sheet_on_file (conversational: offer team handoff); hidden from picker (D6).
- Partial name matching several DISTINCT products -> ambiguous by product; conversational path asks which product / suggests the picker; picker lists them.
- CAS provided that maps to several DISTINCT product names -> ambiguous by product (list names), never auto-serve.
- `updated_at` NULL on some/all rows -> newest selection uses NULLS LAST, never raises.
- `updated_at` datetime must never reach `json.dumps` unescaped (Phase 1 regression).
- Product name casing/whitespace variants -> grouped case-insensitively and trimmed.
- Very large catalog (hundreds of products) -> cap + search; picker stays responsive.
- PDF host blocks iframe embedding -> inline preview fails -> auto-fallback to open-in-tab (D5).
- Signed/expiring `sds_ref` URLs -> if refs are time-limited, preview/open may 404; endpoint returns the stored ref as-is and the widget surfaces an "open failed" affordance. (Confirm ref type during build; public storage URLs are unaffected.)
- Generic (non-pack / no get_sds tool) bot -> button hidden, endpoint returns 404/empty, config flag false.
- Cross-tenant isolation -> endpoint strictly `WHERE company_id = %s`; a key for tenant A never sees tenant B products.
- XSS -> product names are escaped on render; `sds_url` is validated https (`_is_https`) before it is used as a link/iframe src.
- Empty catalog / no SDS products -> picker empty state, no crash.
- Endpoint/network failure -> picker error state with retry; conversational path still available.
- Grade argument still sent by an old client/model -> ignored, product sheet returned (D2).

## Test cases

**Backend (pytest):**

- Resolver: single product, multi-grade, differing links -> returns the `max(updated_at)` https ref.
- Resolver: differing links with a NULL `updated_at` row -> NULLS LAST, deterministic pick, no raise.
- Resolver: all rows non-https -> `no_sheet_on_file`.
- Resolver: partial name -> multiple distinct product names -> `ambiguous`, `candidates` present, **no `rows` key**, and `json.dumps(obs)` succeeds.
- Regression: `json.dumps(get_sds(...))` and `json.dumps(get_product_spec(...))` succeed for an exact multi-grade product (the original crash) for every returned status.
- Loop hardening: an observation containing a raw datetime passes through `run_agent_loop` without raising (`default=str`).
- CAS shared across names -> `ambiguous` by product (asserts Expresolv-shaped data).
- `grade` argument passed to `get_sds` -> ignored, same product sheet returned.
- Endpoint `/api/widget/sds-products`: returns only https-sheet products, grouped by name, newest url per product, sorted, capped, `?q=` filters by name/CAS.
- Endpoint tenant isolation: tenant A key never returns tenant B rows.
- Endpoint auth: missing/invalid key or bad origin rejected (401/403).
- `/api/config`: `features.sds_picker` true for a pack with `get_sds`, false otherwise.

**Frontend (vitest):**

- Get SDS button renders only when `features.sds_picker` is true.
- Picker fetches, renders list, and filters on search input.
- Selecting a product renders the SDS card with the correct `sds_url`.
- Inline-preview error/timeout -> fallback UI shows Open-in-tab.
- No-sheet products never appear (data contract).
- Empty and error states render (no crash).

**End-to-end / live:**

- Two-turn: SDS for `acetone`, then SDS for `methanol` - both return a sheet, neither falls back (the original bug is gone).
- `scratchpad/probe_sds.py`: every row shows `json.dumps=OK`.
- Full suite green: `npm run test`, `pytest tests/ -q`, `npx tsc --noEmit`, `npm run lint`.

## Verification

- Run `probe_sds.py` and `repro_sds.py` -> all OK, no fallback on the second product.
- Browser-verify the widget: Get SDS button -> search -> pick -> inline preview + open + download; confirm the button is absent on a generic bot; confirm dark mode and the embedding fallback.

## Out of scope

- The `[State: SDS provided ...]` repeat-ask dedup ([agent.py:965](../sapybase_ai_engine/services/agent.py)) - not implicated in the crash; SDS is now product-keyed so the note stays product-level. Leave unchanged.
- Option C (full SDS library page) and any owner-facing UI for the D3 data-hygiene report beyond a logged/recorded signal.
- Grade-level logic for price/spec (`request_quote`, `get_product_spec`) - unchanged.
